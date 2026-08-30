#!/usr/bin/env python3
# Record a real gameplay clip of ASTRO FLY via CDP.
# Freezes the page clock + rAF, drives the REAL flight model from JS at a
# fixed 60Hz (scripted AI pilot: seeks rings, boosts), captures every 2nd
# sim frame (~30 fps), encodes with ffmpeg -> /tmp/astro_demo.mp4
import sys, time, os, subprocess, json
sys.path.insert(0, os.path.dirname(__file__))
import cdp_helper, websocket, urllib.request
OUT = "/tmp/astro_demo"
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith((".png", ".jpg")): os.remove(os.path.join(OUT, f))

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
p.send("Network.enable"); p.send("Network.setCacheDisabled", cacheDisabled=True)
p.js("location.reload(true)")
time.sleep(5)
print("boot:", p.js("({three:THREE.REVISION, bld:buildings.length, sky:!!skyDome})"))
p.send("Runtime.enable")
p.js("document.getElementById('overlay').style.display='none'; document.getElementById('hint').style.display='none'; 'hidden'")
print("load console:", p.console_since())

# ---- scripted AI pilot driving the REAL flight model ------------------------
print("pilot:", p.js("""window.stepDemo = (function(){
  window.requestAnimationFrame = function(){ return 0; };       // freeze page clock
  clock.getDelta = function(){ return 1/60; };
  var F = 1/60, t = 0, got = 0, cool = 0, cruiseTurn = 0, dir = 1;
  // reset ship + camera
  yaw = 0; vel.set(0,0,0); astro.position.set(0, 14, 60);
  tilt.rotation.set(0,0,0); camHeading = 0; camPitch = 0.34; camDist = 10;
  function bestRing(){
    var best = null, bs = 1e18;
    for(var i=0;i<rings.length;i++){
      var r = rings[i];
      if(!r.visible) continue;
      var d = astro.position.distanceTo(r.position);
      if(d > 110) continue;
      var dirv = r.position.clone().sub(astro.position).normalize();
      var hdg = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      var score = d * (1.5 - hdg.dot(dirv)) + Math.abs(r.position.y - astro.position.y) * 1.5;
      if(score < bs){ bs = score; best = r; }
    }
    return best;
  }
  return function(){
    t += F;
    var p = astro.position, keys = {};
    var tgt = (cool <= 0 && got < 7) ? bestRing() : null;
    if(tgt){
      // lead-aim: fly at where the ring will be, not where it is
      var sp = Math.max(vel.length(), 4);
      var d = p.distanceTo(tgt.position);
      var lead = tgt.position.clone().addScaledVector(vel, Math.min(1.2, d/sp) * 0.85);
      var dx = lead.x - p.x, dz = lead.z - p.z;
      var ty = Math.atan2(-dx, -dz);
      var dd = (ty - yaw) % (Math.PI*2);
      if(dd > Math.PI) dd -= Math.PI*2; if(dd < -Math.PI) dd += Math.PI*2;
      if(dd > 0.12) keys.KeyA = true; else if(dd < -0.12) keys.KeyD = true;
      var dy = tgt.position.y - p.y;
      if(dy > 2) keys.KeyR = true; else if(dy < -2) keys.KeyF = true;
      keys.KeyW = true;
      if(d > 35) keys.ShiftLeft = true;   // boost the approach
    } else {
      keys.KeyW = true;
      // gentle S-cruise for visual interest
      if(cruiseTurn > 0){ cruiseTurn--; keys[ dir>0 ? 'KeyA' : 'KeyD' ] = true; }
      else if(got >= 4 && Math.random() < 0.01){ cruiseTurn = 45; dir = -dir; }
      if(p.y < 13) keys.KeyR = true; else if(p.y > 26) keys.KeyF = true;
    }
    // boost once we have some rings (showcase the speed feel)
    if(got >= 5 && cool <= 0) keys.ShiftLeft = true;
    var flight = updateFlight(F, keys);
    updateFlames(t, flight.speed, flight.thrust, flight.boost);
    updateSparks(F, flight.speed, flight.thrust);
    updateMarkers();
    var before = ringsGot;
    updateRings(F, p);
    if(ringsGot > before){ got++; cool = 50; }
    cool--;
    updateCamera(F, p);
    updateHUD(flight.speed, p);
    renderer.render(scene, camera);
    return { f: (t*60)|0, sp: flight.speed.toFixed(1), got: ringsGot,
             x: p.x.toFixed(0), y: p.y.toFixed(0), z: p.z.toFixed(0) };
  };
})()"""))

t0 = time.time()
FRAMES_PER_SHOT = 2   # 60Hz sim / 2 = 30 fps video
TARGET_FPS = 30
CAPTURES = 420         # ~14 s of gameplay (stays under the tool timeout)
BUDGET = 280           # hard wall-clock cap for the capture loop
last = None
for i in range(CAPTURES):
    if time.time() - t0 > BUDGET:
        print("budget hit, stopping at", i)
        break
    for _ in range(FRAMES_PER_SHOT):
        last = p.js("stepDemo()")
        if isinstance(last, dict) and "error" in last:
            print("STEP ERROR:", last["error"])
            print("console:", p.console_since())
            p.close()
            sys.exit(1)
    p.screenshot(f"{OUT}/f{i:04d}.jpg", fmt="jpeg", quality=82)
    if i % 100 == 0:
        print(f"frame {i}: {last}  ({(time.time()-t0):.0f}s elapsed)")
print("captured:", CAPTURES, "frames, last:", last)

# ---- encode -----------------------------------------------------------------
v = subprocess.run(["ffmpeg","-y","-framerate","%d"%TARGET_FPS,
                    "-i", f"{OUT}/f%04d.jpg",
                    "-c:v","libx264","-pix_fmt","yuv420p","-crf","20",
                    "-preset","medium","/tmp/astro_demo.mp4"],
                   capture_output=True, text=True)
print("ffmpeg rc:", v.returncode)
if v.returncode != 0:
    print(v.stderr[-2000:])
sz = os.path.getsize("/tmp/astro_demo.mp4")
print("size: %.1f MB" % (sz/1e6))
p.close()
