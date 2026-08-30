'use strict';
// ---------------------------------------------------------------------------
// marker.js — floating "FWD" / "BACK" labels so it's obvious which way the
// character is facing (and which way is travel direction). Toggle with T.
// Both labels are camera-facing sprites flanking the head: FWD ahead of the
// face (nose side, -Z), BACK behind it (+Z, the chase-cam side).
// ---------------------------------------------------------------------------

function makeMarker(text){
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 72px "Segoe UI", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 14; g.strokeStyle = 'rgba(24,32,42,0.9)';
  g.strokeText(text, 128, 64);
  g.fillStyle = '#ffffff';
  g.fillText(text, 128, 64);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.95, depthWrite: false }));
  sp.scale.set(1.1, 0.55, 1);
  return sp;
}

const fwdMarker  = makeMarker('FWD');
fwdMarker.position.set(0, 2.0, -0.85);   // ahead of the face (nose side)
const backMarker = makeMarker('BACK');
backMarker.position.set(0, 2.0, 0.85);   // behind the head (camera side)
tilt.add(fwdMarker); tilt.add(backMarker);

let markersOn = false;   // dev aid — off by default, T toggles
let _prevT = false;
function updateMarkers(){
  const down = !!keys['KeyT'];
  if(down && !_prevT) markersOn = !markersOn;   // toggle on T key-down
  _prevT = down;
  fwdMarker.visible = backMarker.visible = markersOn;
}
