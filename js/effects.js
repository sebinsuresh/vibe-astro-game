'use strict';
// ---------------------------------------------------------------------------
// effects.js — rocket-flame / glow / jet-light and spark-trail VFX, updated
// each frame based on the flight state.
//
// `flames` children order: [0] L flame group, [1] L glow sprite,
//                          [2] R flame group, [3] R glow sprite.
// ---------------------------------------------------------------------------

function updateFlames(t, s, thrust, boost){
  const fl = (0.35 + Math.min(1.4, s*0.07)) * (boost?1.55:1)
           * (0.85 + Math.sin(t*40)*0.08 + Math.random()*0.08);
  const on = s>0.4 || thrust>0;
  for(const i of [0,2]){
    flames.children[i].scale.set(1, fl, 1);
    flames.children[i].visible = on;
  }
  for(const i of [1,3]){
    flames.children[i].visible = on;
    flames.children[i].scale.setScalar((on?1.0:0.001) * (0.9 + fl*0.35));
  }
  jetLight.intensity = on ? 1.2 + fl*1.4 : 0;
}

function updateSparks(dt, s, thrust){
  for(let i=0;i<SPARKS;i++){
    const sd=sparkData[i];
    sd.life-=dt;
    if(sd.life<=0){
      if(Math.random()<Math.min(0.95, thrust*0.85) && s>0.5){
        sd.life=0.3+Math.random()*0.5;
        const side=Math.random()<0.5?0:1;
        const local=new THREE.Vector3(0.14*(side?1:-1),-0.2,0.05);
        astro.updateMatrixWorld();
        local.applyMatrix4(astro.matrixWorld);
        sparkPos[i*3]=local.x; sparkPos[i*3+1]=local.y; sparkPos[i*3+2]=local.z;
        sd.vel.set((Math.random()-0.5)*2.5, -3-Math.random()*4, (Math.random()-0.5)*2.5)
          .addScaledVector(vel, 0.35);
      } else {
        sparkPos[i*3+1] = -9999; // hide dead sparks
      }
    } else {
      sd.vel.y -= 6*dt;
      sparkPos[i*3]+=sd.vel.x*dt; sparkPos[i*3+1]+=sd.vel.y*dt; sparkPos[i*3+2]+=sd.vel.z*dt;
    }
  }
  sparkGeo.attributes.position.needsUpdate=true;
}
