'use strict';
// ---------------------------------------------------------------------------
// player.js — the chibi astro-boy: body, hair spikes, arms, rocket-boot legs,
// flame/glow VFX, a warm jet light, and the spark-trail particle pool.
// ---------------------------------------------------------------------------

const astro=new THREE.Group();      // world pos + yaw
const tilt=new THREE.Group();       // pitch/roll
astro.add(tilt);
function mat(c){ return new THREE.MeshLambertMaterial({color:c}); }

// torso
const torso=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.5,0.34), mat(MAROON));
torso.position.y=0.62; tilt.add(torso);
const chest=new THREE.Mesh(new THREE.SphereGeometry(0.27,12,10), mat(MAROON));
chest.position.set(0,0.72,0.05); chest.scale.set(1.05,0.8,0.8); tilt.add(chest);

// head — the face (eyes/mouth) points along the nose (local -Z, the travel
// direction), so the trailing chase camera (behind/above, +Z) reads the
// character's hair and spikes, while the face looks out into the screen.
const head=new THREE.Group(); head.position.y=1.18; tilt.add(head);
const face=new THREE.Mesh(new THREE.SphereGeometry(0.42,20,16), mat(CREAM)); head.add(face);
// hair — covers the TOP + BACK of the head so the back reads as a dark hair
// dome (not a face!) from the trailing camera, leaving the face open on the
// front (-Z). Tilted toward the back (+Z); cap reaches ~125° down the back,
// hairline crosses the front at ~60° (eyes at ~87° stay clear).
const hair=new THREE.Mesh(new THREE.SphereGeometry(0.445,20,14,0,Math.PI*2,0,Math.PI*0.52), mat(BLACK));
hair.rotation.x=0.55; hair.position.y=0.05; head.add(hair);
// signature spikes — on the BACK-top of the head, pointing up/back (read from behind)
const spikeGeo=new THREE.ConeGeometry(0.115,0.55,8);
const s1=new THREE.Mesh(spikeGeo,mat(BLACK)); s1.position.set(0,0.36,0.16); s1.rotation.x=0.5; head.add(s1);
const s2=new THREE.Mesh(spikeGeo,mat(BLACK)); s2.position.set(0.2,0.30,0.10); s2.rotation.set(0.4,0,-0.5); head.add(s2);
const s3=new THREE.Mesh(spikeGeo,mat(BLACK)); s3.position.set(-0.2,0.30,0.10); s3.rotation.set(0.4,0,0.5); head.add(s3);
// eyes
const eyeGeo=new THREE.SphereGeometry(0.055,10,8);
const e1=new THREE.Mesh(eyeGeo,mat(BLACK)); e1.position.set(0.15,0.02,-0.37); head.add(e1);
const e2=new THREE.Mesh(eyeGeo,mat(BLACK)); e2.position.set(-0.15,0.02,-0.37); head.add(e2);
// mouth — small dark line so the face side is unmistakable
const mouth=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.035,0.02), mat(BLACK));
mouth.position.set(0,-0.13,-0.40); head.add(mouth);

// arms — spread for flight (kept globally so pose.js can streamline them)
const armGroups = [];
function arm(side){
  const a=new THREE.Group(); a.position.set(0.30*side,0.72,0);
  a.rotation.z=side*-1.15; a.rotation.x=0.15;
  const up=new THREE.Mesh(new THREE.CapsuleGeometry(0.09,0.28,4,8),mat(CREAM)); up.position.y=0.2; a.add(up);
  const hand=new THREE.Mesh(new THREE.SphereGeometry(0.1,10,8),mat(CREAM)); hand.position.y=0.42; a.add(hand);
  return a;
}
armGroups.push(arm(1), arm(-1));
armGroups.forEach(a=>tilt.add(a));

// legs + rocket boots
const flames=new THREE.Group();
// glow texture (radial)
const glowCanvas=document.createElement('canvas'); glowCanvas.width=glowCanvas.height=128;
{
  const g=glowCanvas.getContext('2d');
  const gr=g.createRadialGradient(64,64,4,64,64,64);
  gr.addColorStop(0,'rgba(255,240,200,1)');
  gr.addColorStop(0.3,'rgba(255,160,60,0.85)');
  gr.addColorStop(0.65,'rgba(255,110,30,0.35)');
  gr.addColorStop(1,'rgba(255,90,20,0)');
  g.fillStyle=gr; g.fillRect(0,0,128,128);
}
const glowTex=new THREE.CanvasTexture(glowCanvas);

function leg(side){
  const l=new THREE.Group(); l.position.set(0.14*side,0.38,0);
  const th=new THREE.Mesh(new THREE.CapsuleGeometry(0.095,0.2,4,8),mat(CREAM)); th.position.y=-0.1; l.add(th);
  const boot=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.17,0.26,10),mat(RED)); boot.position.y=-0.34; l.add(boot);
  const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.13,0.1,10),
    new THREE.MeshBasicMaterial({color:0xff9a3c}));
  nozzle.position.y=-0.49; l.add(nozzle);
  tilt.add(l);
  // flame — wide at nozzle, tapering to a trailing tip. SOLID (reads on pale fog).
  function cone(r,len,color,op){
    const geo=new THREE.ConeGeometry(r,len,12,1,true);
    geo.rotateX(Math.PI);      // apex to the trailing tip
    geo.translate(0,-len/2,0); // base (wide) at y=0 = nozzle, tip at y=-len
    return new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:op<1,opacity:op,
      side:THREE.DoubleSide,depthWrite:false}));
  }
  const fm  = cone(0.24,1.5, 0xff5a14, 0.96);
  const mid = cone(0.16,1.1, 0xffa528, 0.98);
  const core= cone(0.08,0.85,0xfff2cc, 1.0);
  const fgrp=new THREE.Group(); fgrp.add(fm); fgrp.add(mid); fgrp.add(core);
  fgrp.position.set(0.14*side,-0.12,0);
  flames.add(fgrp);
  // soft glow halo (subtle, small so it never swallows the character)
  const gs=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,opacity:0.55,
    blending:THREE.AdditiveBlending,depthWrite:false}));
  gs.position.set(0.14*side,-0.35,0);
  gs.scale.set(0.9,0.9,1);
  flames.add(gs);
}
leg(1); leg(-1);
tilt.add(flames);

// warm point light at the jets (subtle)
const jetLight=new THREE.PointLight(0xff8c3a, 0.8, 8, 1.8);
jetLight.position.set(0,-0.4,0.2);
tilt.add(jetLight);

astro.position.set(0,14,60);
scene.add(astro);

// ---------- spark trail ----------
const sparkPos=new Float32Array(SPARKS*3);
const sparkData=[];
for(let i=0;i<SPARKS;i++) sparkData.push({life:Math.random()*0.8, vel:new THREE.Vector3()});
const sparkGeo=new THREE.BufferGeometry();
sparkGeo.setAttribute('position',new THREE.BufferAttribute(sparkPos,3));
const sparks=new THREE.Points(sparkGeo,new THREE.PointsMaterial({color:0xff8a1e,size:0.22,transparent:true,opacity:0.95,depthWrite:false}));
scene.add(sparks);
