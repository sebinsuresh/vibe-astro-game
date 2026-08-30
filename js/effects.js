'use strict';
// ---------------------------------------------------------------------------
// effects.js — rocket-flame / glow / jet-light, spark trail, and boost
// speed-streaks VFX, updated each frame based on the flight state.
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

  // rocket-dive pose (feature "dive"): the body pitches into the dive but
  // the jets keep pointing at the ground — hold the flames near-vertical.
  if(featOn('dive')){
    for(const i of [0,2]){
      flames.children[i].rotation.x = THREE.MathUtils.lerp(
        flames.children[i].rotation.x, _diveAmt * FLAME_HOLD, 0.2);
    }
  } else {
    for(const i of [0,2]) flames.children[i].rotation.x = 0;
  }
}

function updateSparks(dt, s, thrust){
  const active = featOn('sparks');
  for(let i=0;i<SPARKS;i++){
    const sd=sparkData[i];
    if(!active){ sparkPos[i*3+1] = -9999; continue; }
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

// ---------- impact / ring bursts (features "impact", "rings") --------------
// Small one-shot particle bursts reusing the spark pool's visual style:
// a handful of short-lived points spawned at an event location.
const burstPos = new Float32Array(96*3);
const burstData = [];
for(let i=0;i<96;i++) burstData.push({life:0, vel:new THREE.Vector3()});
const burstGeo = new THREE.BufferGeometry();
burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
const bursts = new THREE.Points(burstGeo, new THREE.PointsMaterial({
  color: 0xffc060, size: 0.28, transparent: true, opacity: 0.95, depthWrite: false
}));
bursts.visible = false;
scene.add(bursts);
let _burstIdx = 0;

function spawnBurst(x, y, z, n, color){
  // callers gate on their own feature; this is pure VFX
  if(bursts.material.color.getHex() !== color){
    bursts.material.color.setHex(color);
  }
  bursts.visible = true;
  for(let k=0;k<n;k++){
    const i = _burstIdx = (_burstIdx+1) % 96;
    burstPos[i*3]=x; burstPos[i*3+1]=y; burstPos[i*3+2]=z;
    burstData[i].life = 0.25 + Math.random()*0.35;
    burstData[i].vel.set(
      (Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10);
  }
}

function updateBursts(dt){
  let any = false;
  for(let i=0;i<96;i++){
    const bd = burstData[i];
    if(bd.life > 0){
      bd.life -= dt;
      if(bd.life <= 0){ burstPos[i*3+1] = -9999; }
      else {
        bd.vel.y -= 9*dt;
        burstPos[i*3]+=bd.vel.x*dt; burstPos[i*3+1]+=bd.vel.y*dt; burstPos[i*3+2]+=bd.vel.z*dt;
        any = true;
      }
    }
  }
  bursts.visible = any;
  burstGeo.attributes.position.needsUpdate = any || bursts.visible;
}

// ---------- boost speed streaks (feature "streaks") -------------------------
// Radial speed lines that flare out from around the screen edges at high
// speed — a camera-space effect: long thin quads in a group parented to the
// camera, fading in with speed.
const streakGroup = new THREE.Group();
camera.add(streakGroup);
const streakMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
  blending: THREE.AdditiveBlending
});
const _streaks = [];
for(let i=0;i<STREAKS;i++){
  const len = 3 + Math.random()*5;
  const geo = new THREE.PlaneGeometry(0.06, len);
  geo.translate(0, -len/2, 0);
  const m = new THREE.Mesh(geo, streakMat);
  // scatter on a cylinder around the camera axis (mostly off-centre)
  const ang = Math.random()*Math.PI*2;
  const rad = 2.2 + Math.random()*2.6;
  m.position.set(Math.cos(ang)*rad, Math.sin(ang)*rad, -14 - Math.random()*10);
  m.rotation.z = Math.PI/2 + (Math.random()-0.5)*0.7;  // mostly radial
  _streaks.push(m);
  streakGroup.add(m);
}

function updateStreaks(dt, s, boost){
  let target = 0;
  if(featOn('streaks')){
    const over = Math.max(0, s - MAX_SPEED_CRUISE*0.55) / (MAX_SPEED_BOOST - MAX_SPEED_CRUISE*0.55);
    target = Math.min(1, over) * (boost ? 1 : 0.55);
  }
  streakMat.opacity = THREE.MathUtils.lerp(streakMat.opacity, target*0.5, 1 - Math.pow(0.02, dt));
  streakGroup.visible = streakMat.opacity > 0.01;
}

// ---------- strafe side jets (A/D) ------------------------------------------
// Small rocket cones on the shoulders that FIRE IN THE OPPOSITE direction of
// the strafe (reaction mass: push left to move right) and point BACKWARDS so
// their trails read as side thrust, mirroring the foot-rocket convention.
const _jetConeGeo = new THREE.ConeGeometry(0.13, 0.85, 10, 1, true);
_jetConeGeo.rotateX(-Math.PI/2);   // +X = base, tip at +X*0.85 (trails back)
const jetMatL = new THREE.MeshBasicMaterial({color:0xff6a1f, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false});
const jetMatR = jetMatL.clone();
const jetL = new THREE.Mesh(_jetConeGeo, jetMatL);
const jetR = new THREE.Mesh(_jetConeGeo, jetMatR);
const jets = new THREE.Group();
jets.add(jetL); jets.add(jetR);
tilt.add(jets);

function updateJets(dt, strafe){
  // strafe: -1 (A, move left) … +1 (D, move right)
  const targetL = strafe > 0 ? 0.75 + Math.random()*0.2 : 0;   // D -> L jet fires (pushes right)
  const targetR = strafe < 0 ? 0.75 + Math.random()*0.2 : 0;   // A -> R jet fires (pushes left)
  const k = 1 - Math.pow(0.001, dt);   // fast in/out
  jetMatL.opacity = THREE.MathUtils.lerp(jetMatL.opacity, targetL, k);
  jetMatR.opacity = THREE.MathUtils.lerp(jetMatR.opacity, targetR, k);
  const onL = jetMatL.opacity > 0.02, onR = jetMatR.opacity > 0.02;
  jetL.visible = onL; jetR.visible = onR;
  if(onL) jetL.position.set(-0.42, 0.72,  0.15);   // over the LEFT shoulder, trailing back
  if(onR) jetR.position.set( 0.42, 0.72,  0.15);
  // gentle flicker in length
  const f = 0.85 + Math.sin(performance.now()*0.045)*0.15;
  jetL.scale.set(onL ? f : 0.001, onL ? 1 : 0.001, onL ? 1 : 0.001);
  jetR.scale.set(onR ? f : 0.001, onR ? 1 : 0.001, onR ? 1 : 0.001);
}
