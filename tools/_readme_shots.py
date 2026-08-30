#!/usr/bin/env python3
# README screenshots from the real game + real trailing camera:
#   docs/screenshots/gameplay-cruise.png  (~cruise speed, moderate lean)
#   docs/screenshots/gameplay-boost.png   (full boost, max lean)
import sys, time, os, subprocess, json
sys.path.insert(0, os.path.dirname(__file__))
import cdp_helper, websocket, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = str(int(time.time()))
URL = f"http://127.0.0.1:8000/index.html?v={N}"
print("purged:", cdp_helper.purge())
r = subprocess.run(["curl","-sS","-X","PUT",f"http://127.0.0.1:9222/json/new?{URL}"],capture_output=True,text=True)
tid = json.loads(r.stdout)["id"]
time.sleep(6)
with urllib.request.urlopen("http://127.0.0.1:9222/json/version", timeout=5) as f:
    bws = json.load(f)["webSocketDebuggerUrl"]
_b = websocket.create_connection(bws, timeout=10)
_b.send(json.dumps({"id":1,"method":"Target.activateTarget","params":{"targetId":tid}}))
_b.recv(); _b.close()
p = cdp_helper.Page(f"index.html?v={N}")
print("boot:", p.js("({three:THREE.REVISION, bld:buildings.length, markers:markersOn})"))
p.js("(()=>{ document.getElementById('overlay').style.display='none'; "
     "document.getElementById('hint').style.display='none'; return 'hidden'; })()")

def fly(boost, steps):
    p.js(f"""(()=>{{
      yaw=0; camHeading=0; vel.set(0,0,0); astro.position.set(0,14,80);
      tilt.rotation.set(0,0,0); camPitch=0.34; camDist=10;
      for(let i=0;i<{steps};i++){{
        keys['KeyW']=true; keys['ShiftLeft']={'true' if boost else 'false'};
        updateFlight(1/60, keys);
        keys['KeyW']=false; keys['ShiftLeft']=false;
        updateFlames(1, vel.length(), 1, {boost}); updateSparks(1/60, vel.length(), 1);
        updateRings(1/60, astro.position); updateCamera(1/60, astro.position);
        updateHUD(vel.length(), astro.position);
      }}
      for(let i=0;i<10;i++) updateCamera(1/60, astro.position);
      renderer.render(scene, camera);
      return {{ sp:vel.length().toFixed(1), lean:THREE.MathUtils.radToDeg(tilt.rotation.x).toFixed(1),
                pos:astro.position.toArray().map(v=>v.toFixed(0)) }};
    }})()""")
    time.sleep(0.3)

print("cruise:", fly(False, 150))
p.screenshot(os.path.join(ROOT, "docs/screenshots/gameplay-cruise.png"))
print("boost:", fly(True, 240))
p.screenshot(os.path.join(ROOT, "docs/screenshots/gameplay-boost.png"))
print("saved both")
