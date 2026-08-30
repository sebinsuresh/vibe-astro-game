'use strict';
// ---------------------------------------------------------------------------
// input.js — keyboard state, pointer-lock mouse STEERING, and wheel zoom.
//
// The mouse STEERS the ship: horizontal motion turns it (writes to `yaw`),
// vertical motion tilts the chase camera up/down. A/D keys also turn, as a
// keyboard alternative. Exposes: keys, camPitch, camDist, locked.
// ---------------------------------------------------------------------------

const keys={};
addEventListener('keydown',e=>{ keys[e.code]=true; if(e.code==='Space')e.preventDefault(); });
addEventListener('keyup',e=>{ keys[e.code]=false; });

let camPitch=CAM_PITCH_DEFAULT, camDist=CAM_DIST_DEFAULT;
let locked=false;
// smooth steering state (feature "steer"): the mouse drives a YAW RATE
// target with control-surface easing, not an instant yaw step.
let steerInput=0;   // rad/s requested by the mouse (decays to 0 = centred)
const overlay=document.getElementById('overlay');
overlay.addEventListener('click',()=>{ renderer.domElement.requestPointerLock(); });
renderer.domElement.addEventListener('click',()=>{ if(!locked && !menuOpen) renderer.domElement.requestPointerLock(); });
document.addEventListener('pointerlockchange',()=>{
  locked = document.pointerLockElement===renderer.domElement;
  if(locked) overlay.style.display='none';
  else if(!everLaunched) overlay.style.display='flex';
});
addEventListener('mousemove',e=>{
  if(!locked) return;
  if(featOn('steer')){
    // mouse right -> steerInput negative = turn right (matches key convention)
    steerInput = Math.max(-9, Math.min(9, steerInput - e.movementX*STEER_GAIN));
  } else {
    yaw      -= e.movementX*CAM_TURN_SPEED;   // legacy: instant
  }
  camPitch -= e.movementY*CAM_PITCH_SPEED;  // mouse up   -> look up
  camPitch = Math.max(CAM_PITCH_MIN, Math.min(CAM_PITCH_MAX, camPitch));
});
addEventListener('wheel',e=>{
  camDist = Math.max(CAM_DIST_MIN, Math.min(CAM_DIST_MAX, camDist + e.deltaY*CAM_DIST_WHEEL));
});
