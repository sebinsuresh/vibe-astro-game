'use strict';
// ---------------------------------------------------------------------------
// rings.js — collectible rings: placement (building-free) + pickup detection.
// ---------------------------------------------------------------------------

const rings=[]; let ringsGot=0;
const ringGeo=new THREE.TorusGeometry(2.4,0.28,10,40);
const ringMat=new THREE.MeshBasicMaterial({color:0xffa040});
for(let i=0;i<RING_COUNT;i++){
  const r=new THREE.Mesh(ringGeo,ringMat.clone());
  let ok=false, x=0, y=0, z=0;
  for(let tries=0; tries<20 && !ok; tries++){
    const side=Math.random()<0.5?-1:1;
    x = side*(14+Math.random()*120);
    y = 6+Math.random()*60;
    z = -20-Math.random()*240;
    ok = !inBuilding(x,y,z);
  }
  if(!ok) continue;
  r.position.set(x,y,z);
  r.lookAt(0,y,z-40);
  scene.add(r); rings.push(r);
}
document.querySelector('#rings .big').innerHTML = '<span id="ringcount">0</span>/' + rings.length;

function updateRings(dt, p){
  for(const r of rings){
    if(r.visible){
      r.rotation.z += dt*0.6;
      if(r.position.distanceToSquared(p) < RING_PICKUP_DIST_SQ){
        r.visible=false; ringsGot++;
        document.getElementById('ringcount').textContent=ringsGot;
        // pickup juice (feature "rings"): spark burst at the ring + HUD pulse
        if(featOn('rings')){
          spawnBurst(r.position.x, r.position.y, r.position.z, 26, 0xffa040);
          const el = document.getElementById('ringcount');
          el.classList.remove('pulse');
          void el.offsetWidth;              // restart the CSS animation
          el.classList.add('pulse');
        }
      }
    }
  }
}
