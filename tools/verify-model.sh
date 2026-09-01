#!/bin/bash
# verify-model.sh — loop-verify the character model across states.
# Each step opens a FRESH, activated, focused tab (screen awake) so captures
# are live frames (not throttled/occluded/stale). Outputs to $OUT:
#   cruise.jpg / boost.jpg / bank.jpg   in-game flight states (real physics)
#   face.png                            clean front-face close-up (model viewer)
#   flight.mp4                          in-flight recording (x11grab)
set -uo pipefail
cd ~/astro_proto || exit 1
PY=.venv/bin/python
OUT=${1:-/tmp/verify}; mkdir -p "$OUT"
GAME="http://127.0.0.1:8000/index.html"
VIEWER="http://127.0.0.1:8000/tools/model_viewer.html"
WAIT="typeof modelState!=='undefined' && modelState.ready"
HIDE="document.getElementById('overlay').style.display='none';document.getElementById('hint').style.display='none';"

drive(){
  local name=$1 drv=$2
  timeout 90 $PY tools/shot.py shot --fresh --url "$GAME" --url-contains "index.html" \
    --wait-js "$WAIT" --pre-js "$HIDE $drv" --wait 8 --out "$OUT/$name.jpg" 2>&1 | tail -1
}

echo "## verify-model: $OUT"
drive cruise "menuOpen=true; astro.position.set(0,14,60); vel.set(0,0,0); yaw=0; tilt.rotation.set(0,0,0); for(var i=0;i<400;i++){updatePhysics(1/60);updateVisuals(1/60);updateCamera(1/60);} "
drive boost  "menuOpen=true; astro.position.set(0,14,60); vel.set(0,0,0); yaw=0; tilt.rotation.set(0,0,0); for(var i=0;i<360;i++){keys.KeyW=true;keys.ShiftLeft=true;updatePhysics(1/60);updateVisuals(1/60);updateCamera(1/60);} "
drive bank   "menuOpen=true; astro.position.set(0,14,60); vel.set(0,0,0); yaw=0; tilt.rotation.set(0,0,0); for(var i=0;i<240;i++){keys.KeyW=true;keys.KeyA=true;updatePhysics(1/60);updateVisuals(1/60);updateCamera(1/60);} "

# clean front-face close-up in the standalone model viewer (no launch-overlay fight)
timeout 90 $PY tools/shot.py shot --fresh --url "$VIEWER" --url-contains "model_viewer.html" \
  --wait-js "typeof modelRoot!=='undefined' && modelRoot" --wait 14 \
  --pre-js "(function(){var box=new THREE.Box3().setFromObject(modelRoot);var c=box.getCenter(new THREE.Vector3());var r=Math.max(box.getSize(new THREE.Vector3()).y,0.5);ctrl.target.copy(c);camera.position.set(c.x,c.y,c.z+r*1.5);ctrl.update();renderer.render(scene,camera);})()" \
  --out "$OUT/face.png" 2>&1 | tail -1

# in-flight recording (screen grab, unthrottled)
timeout 120 $PY tools/shot.py rec --fresh --url "$GAME" --url-contains "index.html" \
  --seconds 6 --wait-js "$WAIT" \
  --pre-js "$HIDE for(var i=0;i<600;i++){keys.KeyW=true;updatePhysics(1/60);updateVisuals(1/60);updateCamera(1/60);}" \
  --out "$OUT/flight.mp4" 2>&1 | tail -1

echo "## done"
ls -la "$OUT"/cruise.jpg "$OUT"/boost.jpg "$OUT"/bank.jpg "$OUT"/face.png "$OUT"/flight.mp4 2>/dev/null
