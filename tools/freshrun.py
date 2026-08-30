#!/usr/bin/env python3
"""freshrun.py — purge all game tabs, open ONE fresh tab, wait for game, run JS.

Usage:  freshrun.py --file /tmp/speedtest.js
        freshrun.py 'MAX_SPEED_CRUISE'
Prints the JSON result. Non-zero exit on failure.
"""
import json, sys, time, urllib.request
import websocket

CDP = "http://127.0.0.1:9222"
URL = "http://127.0.0.1:8000/"
READY_JS = "typeof camPitch!=='undefined' && typeof updateFlight!=='undefined'"

def targets():
    with urllib.request.urlopen(CDP + "/json") as r:
        return json.load(r)

def close_all_game_tabs():
    for _ in range(4):
        ts = [t for t in targets() if t.get("type") == "page" and ":8000" in t.get("url", "")]
        if not ts:
            break
        for t in ts:
            try:
                urllib.request.urlopen(CDP + "/json/close/" + t["id"], timeout=5)
            except Exception:
                pass
        time.sleep(1.0)
    left = [t for t in targets() if t.get("type") == "page" and ":8000" in t.get("url", "")]
    return len(left)

def open_one_tab():
    req = urllib.request.Request(CDP + "/json/new?" + URL, method="PUT")
    with urllib.request.urlopen(req, timeout=10) as r:
        t = json.load(r)
    # poll until it's in the target list with a ws url
    for _ in range(10):
        for x in targets():
            if x["id"] == t["id"]:
                return x
        time.sleep(0.5)
    raise RuntimeError("new tab did not appear")

def connect(ws_url, timeout=15):
    ws = websocket.create_connection(ws_url, timeout=timeout)
    n = [0]
    def cmd(method, **params):
        n[0] += 1
        ws.send(json.dumps({"id": n[0], "method": method, "params": params}))
        dl = time.time() + 15
        while time.time() < dl:
            m = json.loads(ws.recv())
            if m.get("id") == n[0]:
                if "error" in m:
                    raise RuntimeError(m["error"])
                return m.get("result", {})
    def js(expr):
        r = cmd("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True)
        if "exceptionDetails" in r:
            d = r["exceptionDetails"]
            raise RuntimeError("JS: " + str(d.get("exception", {}).get("description", d))[:500])
        return r.get("result", {}).get("value")
    return ws, cmd, js

def main():
    if sys.argv[1] == "--file":
        expr = open(sys.argv[2]).read()
    else:
        expr = sys.argv[1]

    leftover = close_all_game_tabs()
    print(f"[purged, {leftover} left]", file=sys.stderr)
    t = open_one_tab()
    time.sleep(1.0)
    # fresh tabs can be slow to answer CDP — retry connect + first command
    ws = cmd = js = None
    for attempt in range(20):
        try:
            ws, cmd, js = connect(t["webSocketDebuggerUrl"])
            cmd("Runtime.evaluate", expression="1+1", returnByValue=True)
            break
        except Exception as e:
            if ws:
                try: ws.close()
                except Exception: pass
            print(f"[connect retry {attempt+1}: {type(e).__name__}]", file=sys.stderr)
            time.sleep(1.5)
    if ws is None:
        print("COULD NOT CONNECT TO NEW TAB", file=sys.stderr)
        sys.exit(3)
    try:
        cmd("Network.enable")
        cmd("Network.setCacheDisabled", cacheDisabled=True)
        # wait for ready
        ok = False
        for _ in range(40):
            try:
                if js(READY_JS):
                    ok = True
                    break
            except Exception:
                pass
            time.sleep(0.5)
        if not ok:
            print("PAGE NOT READY", file=sys.stderr)
            sys.exit(2)
        print(f"[ready] {t['url']}", file=sys.stderr)
        result = js(expr)
        print(json.dumps(result, indent=1, default=str))
    finally:
        try:
            ws.close()
        except Exception:
            pass

if __name__ == "__main__":
    main()
