"""Record a scripted demo flight of ASTRO FLY via CDP screencast.

Usage: .venv/bin/python record_demo.py <TID> [duration_s]
Writes JPEG frames to /tmp/rec/ and prints stats.
"""
import json, base64, time, os, sys, shutil
import websocket, urllib.request

CDP = "http://127.0.0.1:9222"

def ws_url_for(tid):
    with urllib.request.urlopen(CDP + "/json") as r:
        for t in json.load(r):
            if t.get("id") == tid and t.get("type") == "page":
                return t["webSocketDebuggerUrl"]
    raise RuntimeError("tab not found: " + tid)

DURATION = float(sys.argv[2]) if len(sys.argv) > 2 else 22.0
OUT = "/tmp/rec"
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT)

# scripted flight: (seconds_from_start, action)  W/S throttle, A/D turn, R/F vertical, Shift boost
SCRIPT = [
    (0.6,  "down:KeyW"),
    (3.4,  "down:KeyD"),          # right turn + bank
    (5.0,  "up:KeyD"),
    (5.0,  "down:KeyA"),          # left turn
    (6.6,  "up:KeyA"),
    (7.4,  "down:KeyR"),          # climb
    (9.0,  "up:KeyR"),
    (9.0,  "down:ShiftLeft"),     # boost
    (11.0, "up:ShiftLeft"),
    (11.6, "down:KeyF"),          # descend
    (13.0, "up:KeyF"),
    (15.2, "up:KeyW"),
    (16.0, "down:KeyS"),          # slow / drift
    (17.4, "up:KeyS"),
]
KEYMAP = {"KeyW":87,"KeyA":65,"KeyS":83,"KeyD":68,"KeyR":82,"KeyF":70,
          "ShiftLeft":16,"ShiftRight":16,"Space":32}

ws = websocket.create_connection(ws_url_for(sys.argv[1]), timeout=20)
_n = 0
def send(method, **params):
    global _n
    _n += 1
    ws.send(json.dumps({"id": _n, "method": method, "params": params}))
    deadline = time.time() + 20
    while True:
        if time.time() > deadline:
            raise RuntimeError("CDP timeout " + method)
        m = json.loads(ws.recv())
        if m.get("id") == _n:
            if "error" in m:
                raise RuntimeError(m["error"])
            return m.get("result", {})

def drain_once(timeout=0.25):
    """Return one CDP message or None (used inside the timed loop)."""
    ws.settimeout(timeout)
    try:
        return json.loads(ws.recv())
    except (websocket.WebSocketTimeoutException, TimeoutError):
        return None

def evaluate(expr):
    r = send("Runtime.evaluate", expression=expr, returnByValue=True)
    if "exceptionDetails" in r:
        print("EVAL ERROR:", r["exceptionDetails"])

# wait for page load
time.sleep(3.5)
print("three:", evaluate("typeof THREE!=='undefined'?THREE.REVISION:'MISSING'"))

# setup: hide overlays, reset state to a clean start
evaluate("""(function(){
  document.getElementById('overlay').style.display='none';
  document.getElementById('paused').style.display='none';
  astro.position.set(0,14,80); vel.set(0,0,0);
  yaw=0; camHeading=0; camPitch=0.34; camDist=10;
  return 'ok';
})()""")

send("Page.enable")
send("Page.startScreencast", format="jpeg", quality=75,
     maxWidth=1600, maxHeight=900, everyNthFrame=1)

t0 = time.time()
scheduled = set()
frame_no = 0
first_frame_at = None
last_frame_at = None
while True:
    now = time.time() - t0
    for i, (t, act) in enumerate(SCRIPT):
        if i not in scheduled and now >= t:
            scheduled.add(i)
            kind, code = act.split(":")
            ws.send(json.dumps({"id": _n + 1, "method": "Input.dispatchKeyEvent",
                "params": {"type": kind, "code": code,
                           "windowsVirtualKeyCode": KEYMAP.get(code, 0)}}))
            _n += 1
    if now > DURATION:
        break
    m = drain_once(0.3)
    if m and m.get("method") == "Page.screencastFrame":
        d = m["params"]
        data = base64.b64decode(d["data"])
        with open(f"{OUT}/f_{frame_no:04d}.jpg", "wb") as f:
            f.write(data)
        frame_no += 1
        now2 = time.time()
        if first_frame_at is None:
            first_frame_at = now2
        last_frame_at = now2
        ws.send(json.dumps({"id": _n + 1, "method": "Page.screencastFrameAcked",
                            "params": {"sessionId": d["sessionId"]}}))
        _n += 1

send("Page.stopScreencast")
ws.close()

print(f"frames={frame_no}")
if first_frame_at and last_frame_at and frame_no > 1:
    span = last_frame_at - first_frame_at
    print(f"span={span:.2f}s rate={frame_no/max(span,1e-6):.1f}fps")
