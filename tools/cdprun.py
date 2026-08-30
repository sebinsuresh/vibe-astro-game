#!/usr/bin/env python3
"""cdprun.py — run a JS expression (or file) in the visible Chrome game tab via CDP.

Usage:
  cdprun.py EXPR                       # evaluate EXPR in a live :8000 tab
  cdprun.py --file run.js              # evaluate file contents
  cdprun.py --reload EXPR              # fresh page (re-navigate), wait for game, then eval
  cdprun.py --tab ID-PREFIX EXPR       # target a specific tab
Env:  CDP_HOST (default 127.0.0.1:9222), READY_TIMEOUT (default 20s)
Exits non-zero and prints the exception on failure.
"""
import json, os, sys, time, urllib.request
import websocket

CDP = os.environ.get("CDP_HOST", "127.0.0.1:9222")
READY_JS = "typeof camPitch!=='undefined' && typeof updateFlight!=='undefined'"


def targets():
    with urllib.request.urlopen(f"http://{CDP}/json") as r:
        return json.load(r)


def find_tab(substr=":8000", tid_prefix=None):
    for t in targets():
        if t.get("type") != "page" or substr not in t.get("url", ""):
            continue
        if tid_prefix and not t["id"].startswith(tid_prefix):
            continue
        return t
    return None


class Conn:
    def __init__(self, ws_url, timeout=15):
        self.ws_url = ws_url
        self.ws = websocket.create_connection(ws_url, timeout=timeout)
        self._n = 0

    def cmd(self, method, **params):
        self._n += 1
        self.ws.send(json.dumps({"id": self._n, "method": method, "params": params}))
        dl = time.time() + 15
        while time.time() < dl:
            m = json.loads(self.ws.recv())
            if m.get("id") == self._n:
                if "error" in m:
                    raise RuntimeError(m["error"])
                return m.get("result", {})

    def js(self, expr):
        r = self.cmd("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True)
        if "exceptionDetails" in r:
            d = r["exceptionDetails"]
            raise RuntimeError("JS: " + str(d.get("exception", {}).get("description", d))[:500])
        v = r.get("result", {}).get("value")
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return v
        return v

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass


def connect(tab=None, timeout=15):
    tab = tab or find_tab()
    if tab is None:
        raise RuntimeError("no game tab found on " + CDP)
    return Conn(tab["webSocketDebuggerUrl"], timeout=timeout)


def wait_ready(c, timeout=20.0):
    dl = time.time() + timeout
    while time.time() < dl:
        try:
            if c.js(READY_JS):
                return True
        except Exception:
            pass
        time.sleep(0.4)
    return False


def reload_page(c):
    """Hard-reload the tab (ws dies); return a fresh connection to the same tab."""
    # disable the HTTP cache FIRST so the reload re-fetches from disk
    try:
        c.cmd("Network.enable")
        c.cmd("Network.setCacheDisabled", cacheDisabled=True)
    except Exception:
        pass
    tid = None
    for t in targets():
        if t.get("type") == "page" and t["webSocketDebuggerUrl"] == c.ws_url:
            tid = t["id"]
            break
    c.ws.send(json.dumps({"id": 999999, "method": "Runtime.evaluate",
                          "params": {"expression": "location.reload(true); 1"}}))
    time.sleep(1.0)  # let the navigation actually start before the socket dies
    c.close()
    time.sleep(3.0)
    for _ in range(12):
        t = None
        if tid:
            for x in targets():
                if x["id"] == tid:
                    t = x
                    break
        if t is None:
            t = find_tab()
        if t:
            try:
                nc = Conn(t["webSocketDebuggerUrl"])
                if wait_ready(nc):
                    return nc
                nc.close()
            except Exception:
                pass
        time.sleep(1.0)
    raise RuntimeError("could not re-attach after reload")


def main():
    args = sys.argv[1:]
    do_reload = False
    if "--reload" in args:
        do_reload = True
        args.remove("--reload")
    tab_pref = None
    if args and args[0] == "--tab":
        tab_pref = args[1]
        args = args[2:]
    if args and args[0] == "--file":
        expr = open(args[1]).read()
    else:
        expr = " ".join(args) if args else sys.stdin.read()

    c = connect(tid_prefix=tab_pref) if tab_pref else connect()
    if not wait_ready(c):
        print("PAGE NOT READY", file=sys.stderr)
        sys.exit(2)
    if do_reload:
        c = reload_page(c)
    try:
        result = c.js(expr)
    finally:
        c.close()
    print(json.dumps(result, indent=1, default=str))


if __name__ == "__main__":
    main()
