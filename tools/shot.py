#!/usr/bin/env python3
"""shot.py — robust screenshot/recording for the headful Chrome (CDP :9222).

Abstracts away the fiddly bits that make Chrome capture unreliable:

  * wakes the display (xset s reset / DPMS force on) and keeps it awake for the
    capture window,
  * focuses + raises the Chrome window (wmctrl) so its compositor tab is
    visible (an occluded/background tab gets throttled: no rAF, no GPU frames),
  * activates the specific tab in Chrome (Target.activateTarget over CDP) so
    WebGL in it is live,
  * captures via CDP Page.captureScreenshot (full page, not just the viewport
    clip of a possibly-occluded window),
  * for video, drives CDP Page.screencast at ~30 fps into ffmpeg.

Usage:
  python3 tools/shot.py shot  --url-contains "index.html" --out /tmp/x.jpg
  python3 tools/shot.py shot  --url-contains "index.html" --out /tmp/x.jpg --pre-js "menuOpen=true; ..."
  python3 tools/shot.py rec   --url-contains "index.html" --out /tmp/x.mp4 --seconds 12 --pre-js "..."

--pre-js runs right before capture (e.g. to freeze the sim, hide overlays,
place the camera).  All values are treated as data, never as instructions.
"""
import argparse, base64, json, os, re, socket, subprocess, sys, time, urllib.request

try:
    import websocket  # websocket-client (in .venv; run with .venv/bin/python)
except ImportError:
    sys.exit("error: 'websocket' module missing — run with .venv/bin/python tools/shot.py")

CDP = "http://127.0.0.1:9222"
CHROME_WIN_TITLE_HINTS = ["astro", "ASTRO", "Fly"]   # window title substrings, else newest chrome window


def cdp_get(path):
    return json.load(urllib.request.urlopen(CDP + path, timeout=10))


def cdp_put(path):
    return json.load(urllib.request.urlopen(urllib.request.Request(CDP + path, method="PUT"), timeout=10))


def run(cmd, quiet=True):
    """Run a shell command, returning (ok, output). Never raises."""
    try:
        p = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        if quiet:
            return p.returncode == 0, (p.stdout + p.stderr).strip()
        print("CMD:", cmd)
        print(p.stdout, p.stderr)
        return p.returncode == 0, (p.stdout + p.stderr).strip()
    except Exception as e:
        return False, str(e)


def wake_screen():
    """Make sure the physical display is on and won't sleep during capture."""
    run("xset s reset 2>/dev/null")
    run("xset -dpms 2>/dev/null")          # disable auto-sleep for the capture window
    run("xset s off 2>/dev/null")
    # best effort: force DPMS on (works on most composites)
    run("xset dpms force on 2>/dev/null")
    time.sleep(0.3)


def focus_chrome_window():
    """Raise/focus the Chrome window so it composites visible frames."""
    ok, out = run("wmctrl -l 2>/dev/null")
    if not ok:
        print("warn: wmctrl unavailable, skipping window focus")
        return
    lines = [l for l in out.splitlines() if l.strip()]
    # prefer a window whose title mentions the game; else the most recently active
    target = None
    for l in lines:
        parts = l.split(None, 1)
        if len(parts) == 2 and any(h.lower() in parts[1].lower() for h in CHROME_WIN_TITLE_HINTS):
            target = l.split()[0]
            break
    if not target and lines:
        target = lines[0].split()[0]
    if target:
        run(f"wmctrl -i -a {target} 2>/dev/null")
        time.sleep(0.3)


def activate_tab(ws, target_id):
    """Foreground a tab in Chrome (so its WebGL isn't throttled)."""
    # use the browser-level endpoint for Target.activateTarget
    try:
        bv = cdp_get("/json/version")["webSocketDebuggerUrl"]
        b = websocket.create_connection(bv, timeout=8)
        b.send(json.dumps({"id": 1, "method": "Target.activateTarget", "params": {"targetId": target_id}}))
        b.recv()
        b.close()
    except Exception as e:
        print("warn: could not activate tab:", e)


def connect_page(url_contains, fresh=False, url=None):
    """Find (or open) a page tab matching url_contains, return (ws, target_id).

    url: explicit URL to open when no matching tab exists (defaults to the
    game root). Pass the full page URL (e.g. .../tools/model_viewer.html).

    NOTE: Chrome exits when its LAST tab is closed, so closing matching tabs
    never closes a chrome:// page; at most one New Tab is left behind (harmless).
    """
    tabs = cdp_get("/json")
    pages = [t for t in tabs if t["type"] == "page" and url_contains in t.get("url", "")]
    if fresh and pages:
        for t in pages:
            try:
                urllib.request.urlopen(CDP + "/json/close/" + t["id"], timeout=5)
            except Exception:
                pass
        time.sleep(0.8)
        tabs = cdp_get("/json")
        pages = [t for t in tabs if t["type"] == "page" and url_contains in t.get("url", "")]
    if not pages:
        # open a new tab at the explicit url (or the game root)
        target_url = url or "http://127.0.0.1:8000/index.html"
        newtab = cdp_put("/json/new?" + target_url)
        time.sleep(0.5)
        ws = None
        for _ in range(30):
            try:
                ws = websocket.create_connection(newtab["webSocketDebuggerUrl"], timeout=4)
                ws.settimeout(25)
                break
            except Exception:
                time.sleep(0.5)
        if ws is None:
            sys.exit("error: could not connect to new tab CDP endpoint")
        return ws, newtab["id"]
    ws = None
    for _ in range(30):
        try:
            ws = websocket.create_connection(pages[0]["webSocketDebuggerUrl"], timeout=4)
            ws.settimeout(25)
            break
        except Exception:
            time.sleep(0.5)
    if ws is None:
        sys.exit("error: could not connect to existing tab CDP endpoint (tried 30x)")
    return ws, pages[0]["id"]


class Page:
    def __init__(self, ws, target_id):
        self.ws = ws
        self.target_id = target_id
        self._n = 0

    def cmd(self, method, params=None, timeout=20):
        self._n += 1
        try:
            self.ws.send(json.dumps({"id": self._n, "method": method, "params": params or {}}))
            self.ws.settimeout(timeout)
            while True:
                x = json.loads(self.ws.recv())
                if x.get("id") == self._n:
                    return x
        except (socket.timeout, TimeoutError):
            return {"id": self._n, "error": {"message": "CDP timeout on " + method}}
        except websocket.WebSocketTimeoutException:
            return {"id": self._n, "error": {"message": "CDP timeout on " + method}}

    def js(self, expr, timeout=20):
        r = self.cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout=timeout)
        if r.get("error"):
            return "EVALTIMEOUT:" + str(r["error"])[:120]
        res = r.get("result", {})
        if res.get("exceptionDetails"):
            return "JSEXC:" + json.dumps(res["exceptionDetails"].get("exception", {}).get("description", ""))[:200]
        return res.get("result", {}).get("value")

    def screenshot(self, out, fmt="jpeg", quality=88):
        d = self.cmd("Page.captureScreenshot", {"format": fmt, "quality": quality})
        data = d.get("result", {}).get("data")
        if not data:
            return False
        open(out, "wb").write(base64.b64decode(data))
        return True


def prepare(url_contains, fresh=False, pre_js=None, wait_js=None, wait_s=8.0, url=None):
    wake_screen()
    focus_chrome_window()
    ws, tid = connect_page(url_contains, fresh=fresh, url=url)
    activate_tab(ws, tid)
    p = Page(ws, tid)
    if wait_js:
        # poll a JS expression until truthy (e.g. modelState.ready)
        deadline = time.time() + wait_s
        while time.time() < deadline:
            v = p.js(wait_js)
            if v in (True, 1, "true"):
                break
            time.sleep(0.5)
    if pre_js:
        p.js(pre_js)
        time.sleep(0.4)
    return p


def cmd_shot(a):
    p = prepare(a.url_contains, fresh=a.fresh, pre_js=a.pre_js, wait_js=a.wait_js, wait_s=a.wait, url=a.url)
    ok = p.screenshot(a.out, fmt=a.format, quality=a.quality)
    print("shot", "OK" if ok else "FAIL", a.out)
    p.ws.close()
    sys.exit(0 if ok else 1)


def chrome_window_geom():
    """Return (x, y, w, h) of the Chrome window from wmctrl, else None."""
    ok, out = run("wmctrl -lG 2>/dev/null")
    if not ok:
        return None
    for l in out.splitlines():
        parts = l.split()
        if len(parts) >= 7 and any(h.lower() in l.lower() for h in CHROME_WIN_TITLE_HINTS):
            # wmctrl -lG: id desktop x y w h host title...
            return int(parts[2]), int(parts[3]), int(parts[4]), int(parts[5])
    # fallback: largest window
    best = None
    for l in out.splitlines():
        parts = l.split()
        if len(parts) >= 7:
            area = int(parts[4]) * int(parts[5])
            if best is None or area > best[3]:
                best = (int(parts[2]), int(parts[3]), int(parts[4]), int(parts[5]), area)
    return (best[0], best[1], best[2], best[3]) if best else None


def screen_size():
    """Physical screen dimensions via xset q (fallback 1920x1080)."""
    ok, out = run("xset q 2>/dev/null")
    m = re.search(r"Dimensions:\s*(\d+)x(\d+)", out)
    if m:
        return int(m.group(1)), int(m.group(2))
    return 1920, 1080


def cmd_rec(a):
    """Record the Chrome window by grabbing the SCREEN (x11grab).

    The composited screen is ground truth: it always shows the visible
    active tab, and is immune to the per-tab compositor throttling that
    stalls CDP screencast / captureScreenshot on background tabs.
    We still wake the display + focus/activate the tab first so the game
    is what's on screen.
    """
    p = prepare(a.url_contains, fresh=a.fresh, pre_js=a.pre_js, wait_js=a.wait_js, wait_s=a.wait, url=a.url)
    geom = chrome_window_geom()
    display = os.environ.get("DISPLAY", ":0.0")
    sw, sh = screen_size()
    if geom:
        x, y, w, h = geom
        # clamp to the screen (x11grab rejects areas outside the screen;
        # window may extend past the right/bottom edge)
        w = min(w, sw - x)
        h = min(h, sh - y)
        src = f"{display}+{x},{y}"
        size = f"{w}x{h}"
        print(f"recording screen region {size}+{x},{y} (screen {sw}x{sh})")
    else:
        src, size = display, f"{sw}x{sh}"
        print("warn: could not resolve window geom, grabbing full screen")
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "x11grab", "-framerate", "30",
         "-video_size", size, "-i", src, "-t", str(a.seconds),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", a.out],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    err = proc.wait()
    p.ws.close()
    ok = err == 0 and os.path.exists(a.out) and os.path.getsize(a.out) > 1000
    print("rec", "OK" if ok else "FAIL", a.out, f"({a.seconds}s, exit={err})")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def add_common(sp):
        sp.add_argument("--url-contains", required=True)
        sp.add_argument("--url", default=None, help="explicit URL to open when no matching tab exists (fresh)")
        sp.add_argument("--pre-js", default=None)
        sp.add_argument("--wait-js", default=None)
        sp.add_argument("--wait", type=float, default=8.0)
        sp.add_argument("--fresh", action="store_true", help="open a fresh tab instead of reusing")

    sp = sub.add_parser("shot", help="take one screenshot")
    add_common(sp)
    sp.add_argument("--out", required=True)
    sp.add_argument("--format", default="jpeg", choices=["jpeg", "png"])
    sp.add_argument("--quality", type=int, default=88)
    sp.set_defaults(fn=cmd_shot)

    sp = sub.add_parser("rec", help="record a short video")
    add_common(sp)
    sp.add_argument("--out", required=True)
    sp.add_argument("--seconds", type=float, default=8.0)
    sp.set_defaults(fn=cmd_rec)

    a = ap.parse_args()
    a.fn(a)
