#!/usr/bin/env python3
# Verify every feel feature individually: boot the real game, drive the real
# flight model, toggle ONE feature at a time, and assert its effect.
import sys, time, os, subprocess, json
sys.path.insert(0, os.path.dirname(__file__))
import cdp_helper, websocket, urllib.request
OUT = "/tmp/feat"
os.makedirs(OUT, exist_ok=True)

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
p.ws.close()   # reload drops the session — re-attach below
time.sleep(5)
p = None
for _ in range(12):
    try:
        cand = cdp_helper.Page(f"index.html?v={N}")
        cand.send("Runtime.enable")
        if cand.js("typeof updateFlight") == "function":
            p = cand
            break
    except Exception:
        pass
    time.sleep(1.5)
if p is None:
    raise RuntimeError("could not re-attach after reload")
print("boot:", p.js("({three:THREE.REVISION, bld:buildings.length, feats:FEATURE_LIST.length})"))
errs = p.console_since()
print("console:", errs if errs else "(clean)")
assert not errs, "console errors on boot!"

# hide overlays for clean shots
p.js("document.getElementById('overlay').style.display='none'; document.getElementById('hint').style.display='none'; 'ok'")
# FREEZE the live game loop so the test's manual state + render is what's
# captured in screenshots (no rAF race overwriting the forced pose).
p.js("window.requestAnimationFrame = function(){ return 0; }; 'frozen'")

results = {}
def check(name, cond, detail=""):
    results[name] = "PASS" if cond else "FAIL"
    print(f"  [{ 'OK' if cond else 'XX' }] {name}: {detail}")

def js(expr):
    r = p.js(expr)
    if isinstance(r, dict) and "error" in r:
        raise RuntimeError(f"JS error in {expr[:60]}: {r['error']}")
    return r

# ---------- reset helper (drive the REAL flight model for n frames) ----------
RESET = """(function(resetPos){
  yaw=0; yawRate=0; steerInput=0; vel.set(0,0,0);
  astro.position.set(resetPos.x,resetPos.y,resetPos.z);
  tilt.rotation.set(0,0,0); camHeading=0; camPitch=0.34; camDist=10;
  impact.t=0; if(typeof boostMeter!=='undefined') boostMeter=1; return 'reset';
})"""
def drive(n, keys_js):
    return js(f"""(function(){{
      for(let i=0;i<{n};i++){{
        updateFlight(1/60, {keys_js});
        updateFlames(0, vel.length(), 0, false);
        updateSparks(1/60, vel.length(), 0);
        updateBursts(1/60); updateStreaks(1/60, vel.length(), false);
        updateRings(1/60, astro.position);
        updateCamera(1/60, astro.position);
      }}
      renderer.render(scene, camera);
      return JSON.stringify({{sp:vel.length().toFixed(1), px:vel.x.toFixed(2), pz:vel.z.toFixed(2),
        pitch:THREE.MathUtils.radToDeg(tilt.rotation.x).toFixed(1),
        roll:THREE.MathUtils.radToDeg(tilt.rotation.z).toFixed(1),
        camroll:THREE.MathUtils.radToDeg(camera.rotation.z).toFixed(1),
        fov:camera.fov.toFixed(1), got:ringsGot}});
    }})()""")

print("== 1. dive pose ==")
js("featSet('dive', true); " + RESET + "({x:0,y:14,z:60})")
js("for(let i=0;i<300;i++){updateFlight(1/60,{KeyW:true,ShiftLeft:true}); updateFlames(0,vel.length(),1,true); updateCamera(1/60,astro.position);} renderer.render(scene,camera); 'ok'")
a = json.loads(js("JSON.stringify({pitch:THREE.MathUtils.radToDeg(tilt.rotation.x).toFixed(1), flame:flames.children[0].rotation.x.toFixed(2)})"))
p.screenshot(f"{OUT}/dive_on.jpg", fmt="jpeg", quality=85)   # capture the ON (diving) frame NOW
js("featSet('dive', false); " + RESET + "({x:0,y:14,z:60})")
js("for(let i=0;i<300;i++){updateFlight(1/60,{KeyW:true,ShiftLeft:true}); updateFlames(0,vel.length(),1,true); updateCamera(1/60,astro.position);} renderer.render(scene,camera); 'ok'")
b = json.loads(js("JSON.stringify({pitch:THREE.MathUtils.radToDeg(tilt.rotation.x).toFixed(1), flame:flames.children[0].rotation.x.toFixed(2)})"))
check("dive", float(a["pitch"]) < -60 and float(a["flame"]) > 0.8 and float(b["pitch"]) > -45 and float(b["flame"]) < 0.1,
      f"ON pitch={a['pitch']}° flame-hold={a['flame']} | OFF pitch={b['pitch']}° flame={b['flame']}")
js("featSet('dive', true); " + RESET + "({x:0,y:14,z:60})")

print("== 2. turn assist (align) ==")
# build speed heading -Z, then yaw 90° right and coast: with align, lateral vel dies
for feat, name in [(True,"ON"),(False,"OFF")]:
    js(f"featSet('align', {str(feat).lower()}); " + RESET + "({x:0,y:14,z:60})")
    js("for(let i=0;i<240;i++){updateFlight(1/60,{KeyW:true});} yaw+=Math.PI/2; for(let i=0;i<90;i++){updateFlight(1/60,{});} 'ok'")
    v = json.loads(js("JSON.stringify({lat:Math.hypot(vel.x,-( -Math.sin(yaw)*vel.x - Math.cos(yaw)*vel.z)*0+0,0).toFixed(1)})"))
    # lateral = velocity component perpendicular to nose
    lat = js("(()=>{const hx=-Math.sin(yaw),hz=-Math.cos(yaw);const a=vel.x*hx+vel.z*hz;return Math.hypot(vel.x-hx*a, vel.z-hz*a).toFixed(1);})()")
    print(f"  align {name}: lateral drift after 90° turn = {lat} m/s")
    if feat: align_on = float(lat)
    else: align_off = float(lat)
check("align", align_off > align_on * 3, f"OFF drift={align_off} > ON drift={align_on} (3x gap)")
js("featSet('align', true)")

print("== 3. coast brake ==")
for feat, name in [(True,"ON"),(False,"OFF")]:
    js(f"featSet('brake', {str(feat).lower()}); " + RESET + "({x:0,y:14,z:60})")
    js("for(let i=0;i<240;i++){updateFlight(1/60,{KeyW:true});} for(let i=0;i<90;i++){updateFlight(1/60,{});} 'ok'")
    sp = float(json.loads(js("vel.length().toFixed(1)")))
    print(f"  brake {name}: speed after 1.5s coast = {sp}")
    if feat: brake_on = sp
    else: brake_off = sp
check("brake", brake_on < brake_off * 0.5, f"ON {brake_on} < OFF {brake_off} (settles faster)")
js("featSet('brake', true)")

print("== 4. smooth steering ==")
js("featSet('steer', true); " + RESET + "({x:0,y:14,z:60})")
# push mouse input then watch yawRate rise gradually (eased), not step
js("steerInput=-4; for(let i=0;i<6;i++){updateFlight(1/60,{KeyW:true});} 'ok'")
r6 = float(js("yawRate.toFixed(2)"))
js("for(let i=0;i<60;i++){updateFlight(1/60,{KeyW:true});} 'ok'")
r66 = float(js("yawRate.toFixed(2)"))
js("steerInput=0; for(let i=0;i<60;i++){updateFlight(1/60,{KeyW:true});} 'ok'")
r_release = float(js("yawRate.toFixed(2)"))
check("steer", r6 < abs(-4)*0.6 and r66 > r6 and abs(r_release) < 0.5,
      f"yawRate 6 frames after input={r6} (eased, not instant -4) -> {r66} -> released {r_release}")
js("featSet('steer', false); steerInput=0")

print("== 5. camera bank + look-ahead ==")
# measure the true view roll from the camera's world RIGHT vector
# (asin(right.y) is unambiguous at any view pitch; "+0" normalises -0,
#  which CDP's returnByValue drops to null)
CAMROLL = "(()=>{const r=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);return Math.asin(Math.max(-1,Math.min(1,r.y)))*180/Math.PI + 0;})()"
js("featSet('bank', true); " + RESET + "({x:0,y:14,z:60})")
js("for(let i=0;i<200;i++){updateFlight(1/60,{KeyW:true}); updateCamera(1/60,astro.position);} keys['KeyD']=true; for(let i=0;i<30;i++){updateFlight(1/60,keys); updateCamera(1/60,astro.position);} keys['KeyD']=false; renderer.render(scene,camera); 'ok'")
bank_on = json.loads(js("JSON.stringify({camroll:" + CAMROLL + ", ahead:camPitch})"))
js("featSet('bank', false); " + RESET + "({x:0,y:14,z:60})")
js("for(let i=0;i<200;i++){updateFlight(1/60,{KeyW:true}); updateCamera(1/60,astro.position);} keys['KeyD']=true; for(let i=0;i<30;i++){updateFlight(1/60,keys); updateCamera(1/60,astro.position);} keys['KeyD']=false; renderer.render(scene,camera); 'ok'")
bank_off = float(js(CAMROLL))
check("bank", abs(float(bank_on["camroll"])) > 2 and abs(bank_off) < 0.5, f"ON camroll={bank_on['camroll']}° | OFF {bank_off}°")
js("featSet('bank', true)")

print("== 6. FOV warp ==")
js("featSet('warp', true); " + RESET + "({x:0,y:14,z:60})")
js("for(let i=0;i<300;i++){updateFlight(1/60,{KeyW:true,ShiftLeft:true}); updateCamera(1/60,astro.position);} 'ok'")
fov_hi = float(js("camera.fov.toFixed(1)"))
js("featSet('warp', false); for(let i=0;i<60;i++){updateCamera(1/60,astro.position);} 'ok'")
fov_lo = float(js("camera.fov.toFixed(1)"))
check("warp", fov_hi > 70 and fov_lo < 66, f"ON at speed fov={fov_hi} | OFF {fov_lo}")
js("featSet('warp', true)")

print("== 7. speed shake ==")
js("featSet('shake', true); " + RESET + "({x:0,y:14,z:60})")
js("for(let i=0;i<300;i++){updateFlight(1/60,{KeyW:true,ShiftLeft:true});} camera.position.copy(astro.position); 'ok'")
pos = []
for _ in range(4):
    js("camera.position.set(0,0,0); for(let i=0;i<3;i++){updateCamera(1/60,astro.position);} 'ok'")
    pos.append(js("camera.position.x.toFixed(3)"))
js("featSet('shake', false); for(let i=0;i<3;i++){updateCamera(1/60,astro.position);} 'ok'")
var_on = max(map(float,pos)) - min(map(float,pos))
js("camera.position.set(0,0,0); for(let i=0;i<3;i++){updateCamera(1/60,astro.position);} 'ok'")
x1 = js("camera.position.x.toFixed(3)")
for _ in range(3):
    js("camera.position.set(0,0,0); for(let i=0;i<3;i++){updateCamera(1/60,astro.position);} 'ok'")
    x2 = js("camera.position.x.toFixed(3)")
    if abs(float(x1)-float(x2)) < 1e-4: var_off = 0.0; break
else: var_off = 999
check("shake", var_on > 0.05 and var_off < 0.01, f"ON pos-var={var_on:.3f} | OFF {var_off:.3f}")
js("featSet('shake', false)")

print("== 8. arms ==")
js("featSet('arms', true); " + RESET + "({x:0,y:14,z:60})")
js("for(let i=0;i<300;i++){updateFlight(1/60,{KeyW:true,ShiftLeft:true});} 'ok'")
arm_hi = float(js("armSmX.toFixed(2)"))
js("featSet('arms', false); for(let i=0;i<90;i++){updateFlight(1/60,{KeyW:true});} 'ok'")
arm_off = float(js("armSmX.toFixed(2)"))
check("arms", arm_hi > 0.9 and abs(arm_off-0.15) < 0.05, f"ON at boost={arm_hi} (swept back) | OFF={arm_off} (neutral)")
js("featSet('arms', true)")

print("== 9. boost streaks ==")
js("featSet('streaks', true); " + RESET + "({x:0,y:14,z:60})")
# track PEAK opacity across the boost run: the meter drains after ~2.9s so
# streaks fade by the end; the feature is proven by the peak it reached.
st_on = float(js("(function(){let pk=0; for(let i=0;i<300;i++){updateFlight(1/60,{KeyW:true,ShiftLeft:true}); updateStreaks(1/60, vel.length(), true); pk=Math.max(pk,streakMat.opacity);} return pk.toFixed(2);})()"))
js("featSet('streaks', false); for(let i=0;i<90;i++){updateStreaks(1/60, vel.length(), true);} 'ok'")
st_off = float(js("streakMat.opacity.toFixed(2)"))
check("streaks", st_on > 0.2 and st_off < 0.02, f"ON peak-opacity={st_on} | OFF={st_off}")
js("featSet('streaks', false)")

print("== 10. impact feedback ==")
js("featSet('impact', true); " + RESET + "({x:0,y:14,z:60})")
# fly straight into a building wall (corridor starts ~x=+11; push into it)
js("vel.set(0,0,-30); for(let i=0;i<120;i++){updateFlight(1/60,{});} 'ok'")
imp = json.loads(js("JSON.stringify({t:impact.t>0, mag:impact.mag.toFixed(1)})"))
# force a wall hit directly: teleport INSIDE a building's side, moving toward the wall
js("""(()=>{
  const b = buildings.find(b=>b.top>20 && b.top<80);
  astro.position.set(b.minX+0.3, 8, (b.minZ+b.maxZ)/2);
  vel.set(15,0,0); updateFlight(1/60,{});
  return 'hit';
})()""")
imp2 = json.loads(js("JSON.stringify({t:impact.t, nx:impact.nx, mag:impact.mag.toFixed(1)})"))
check("impact", imp2["t"] > 0 and imp2["nx"] == -1 and float(imp2["mag"]) > 5, f"after wall hit: t={imp2['t']} nx={imp2['nx']} mag={imp2['mag']}")
js("featSet('impact', true)")

print("== 11. ring juice ==")
js("featSet('rings', true); " + RESET + "({x:0,y:14,z:60})")
js("""(()=>{
  const r = rings.find(r=>r.visible);
  astro.position.copy(r.position); vel.set(0,0,0);
  updateRings(1/60, astro.position);
  return JSON.stringify({got:ringsGot, pulse:document.getElementById('ringcount').classList.contains('pulse')});
})()""")
ring = json.loads(js("JSON.stringify({got:ringsGot, pulse:document.getElementById('ringcount').classList.contains('pulse')})"))
check("rings", ring["got"] >= 1 and ring["pulse"], f"got={ring['got']} pulse={ring['pulse']}")
js("featSet('rings', true)")

print("== 12. spark trail toggle ==")
js("featSet('sparks', true); " + RESET + "({x:0,y:14,z:60})")
js("for(let i=0;i<120;i++){updateFlight(1/60,{KeyW:true}); updateSparks(1/60, vel.length(), 1);} 'ok'")
live_on = int(js("(function(){let n=0; for(let i=0;i<SPARKS;i++) if(sparkPos[i*3+1]>-9000) n++; return n;})()"))
js("featSet('sparks', false); for(let i=0;i<120;i++){updateSparks(1/60, 10, 1);} 'ok'")
live_off = int(js("(function(){let n=0; for(let i=0;i<SPARKS;i++) if(sparkPos[i*3+1]>-9000) n++; return n;})()"))
check("sparks", live_on > 5 and live_off == 0, f"ON live={live_on} | OFF live={live_off}")
js("featSet('sparks', true)")

print("== menu + persistence ==")
rows = int(js("document.querySelectorAll('.mrow').length"))
expect_rows = int(js("Object.keys(FEATURES).length"))   # keep in sync with features.js
# render a boost frame as the blurred backdrop, then open the menu over it
js(RESET + "({x:0,y:14,z:60})")
js("for(let i=0;i<300;i++){updateFlight(1/60,{KeyW:true,ShiftLeft:true}); updateFlames(0,vel.length(),1,true); updateSparks(1/60,vel.length(),1); updateCamera(1/60,astro.position);} renderer.render(scene,camera); 'ok'")
js("menuShow(); 'ok'")
shown = js("document.getElementById('menu').classList.contains('show')")
p.screenshot(f"{OUT}/menu.jpg", fmt="jpeg", quality=85)   # capture WHILE the menu is shown
js("featToggle('dive'); 'ok'")
saved = js("(JSON.parse(localStorage.getItem('astrofly.feats.v1'))||{}).dive")
check("menu", rows == expect_rows and shown is True and saved is False, f"rows={rows}/{expect_rows} shown={shown} dive persisted={saved}")
js("featToggle('dive'); menuHide(); 'ok'")

# gameplay screenshot with everything ON (boosting)
js(RESET + "({x:0,y:14,z:60})")
js("for(let i=0;i<300;i++){updateFlight(1/60,{KeyW:true,ShiftLeft:true}); updateFlames(0,vel.length(),1,true); updateSparks(1/60,vel.length(),1); updateBursts(1/60); updateStreaks(1/60,vel.length(),true); updateRings(1/60,astro.position); updateCamera(1/60,astro.position);} renderer.render(scene,camera); 'ok'")
p.screenshot(f"{OUT}/all_on_boost.jpg", fmt="jpeg", quality=85)

fails = [k for k,v in results.items() if v=="FAIL"]
print("\n==== SUMMARY:", "ALL PASS" if not fails else f"FAILURES: {fails}", "====")
print("results:", json.dumps(results))
p.close()
