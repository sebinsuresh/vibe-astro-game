"""CDP helper: drive the visible Chrome on 127.0.0.1:9222."""
import json, base64, websocket, urllib.request

CDP = "http://127.0.0.1:9222"

def targets():
    with urllib.request.urlopen(CDP + "/json") as r:
        return json.load(r)

def find_page(substr, tid=None):
    for t in targets():
        if t.get("type") != "page":
            continue
        if tid is not None:
            if t.get("id") == tid:
                return t
        elif substr in t.get("url", ""):
            return t
    return None

def close_tab(tid):
    # newer Chrome reads the id from the PATH, not the query string
    try:
        with urllib.request.urlopen(CDP + "/json/close/" + tid, timeout=6) as r:
            r.read()
            return True
    except Exception:
        return False

def purge(substr="index.html"):
    """Close every page whose url contains substr. Returns count closed."""
    n = 0
    for _ in range(6):
        ps = [t for t in targets() if t.get("type") == "page" and substr in t.get("url", "")]
        if not ps:
            break
        for t in ps:
            if close_tab(t["id"]):
                n += 1
        import time as _t
        _t.sleep(0.8)
    return n

class Page:
    def __init__(self, url_substr, tid=None):
        t = find_page(url_substr, tid)
        if not t:
            raise RuntimeError("no page matching " + url_substr)
        self.id = t["id"]
        self.ws = websocket.create_connection(t["webSocketDebuggerUrl"], timeout=30)
        self._n = 0

    def send(self, method, **params):
        self._n += 1
        self.ws.send(json.dumps({"id": self._n, "method": method, "params": params}))
        import time as _t
        deadline = _t.time() + 25
        while True:
            if _t.time() > deadline:
                raise RuntimeError("CDP timeout: " + method)
            m = json.loads(self.ws.recv())
            if m.get("id") == self._n:
                if "error" in m:
                    raise RuntimeError(m["error"])
                return m.get("result", {})

    def js(self, expr):
        r = self.send("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True)
        if "exceptionDetails" in r:
            return {"error": r["exceptionDetails"].get("exception", {}).get("description", str(r["exceptionDetails"]))}
        return r.get("result", {}).get("value")

    def console_since(self, drain=True):
        """Collect buffered Runtime console events (call after Runtime.enable)."""
        import time as _t
        evs = []
        while True:
            try:
                self.ws.settimeout(0.2)
                m = json.loads(self.ws.recv())
            except Exception:
                break
            finally:
                self.ws.settimeout(30)
            if m.get("method") == "Runtime.consoleAPICalled":
                args = m.get("params", {}).get("args", [])
                evs.append(" ".join(str(a.get("value", a.get("description", ""))) for a in args))
            elif m.get("method") == "Runtime.exceptionThrown":
                d = m.get("params", {}).get("exceptionDetails", {})
                evs.append("EXC: " + str(d.get("exception", {}).get("description", d)))
        return evs

    def screenshot(self, path, fmt="png", quality=80):
        r = self.send("Page.captureScreenshot", format=fmt, quality=quality)
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        return path

    def close(self):
        self.ws.close()
