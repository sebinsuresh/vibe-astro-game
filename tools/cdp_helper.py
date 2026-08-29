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

    def screenshot(self, path):
        r = self.send("Page.captureScreenshot", format="png")
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        return path

    def close(self):
        self.ws.close()
