'use strict';
// ---------------------------------------------------------------------------
// input.js — keyboard state, pointer-lock mouse-orbit, and wheel zoom.
// Exposes: keys, camYaw, camPitch, camDist, locked.
// ---------------------------------------------------------------------------

const keys={};
addEventListener('keydown',e=>{ keys[e.code]=true; if(e.code==='Space')e.preventDefault(); });
addEventListener('keyup',e=>{ keys[e.code]=false; });

let camYaw=0, camPitch=CAM_PITCH_DEFAULT, camDist=CAM_DIST_DEFAULT;
let locked=false;
const overlay=document.getElementById('overlay');
const pausedEl=document.getElementById('paused');
overlay.addEventListener('click',()=>{ renderer.domElement.requestPointerLock(); });
renderer.domElement.addEventListener('click',()=>{ if(!locked) renderer.domElement.requestPointerLock(); });
document.addEventListener('pointerlockchange',()=>{
  locked = document.pointerLockElement===renderer.domElement;
  overlay.style.display = locked?'none':'flex';
  pausedEl.style.display = locked?'none':'block';
});
addEventListener('mousemove',e=>{
  if(!locked) return;
  camYaw   += e.movementX*CAM_YAW_SPEED;
  camPitch -= e.movementY*CAM_PITCH_SPEED;
  camPitch = Math.max(CAM_PITCH_MIN, Math.min(CAM_PITCH_MAX, camPitch));
});
addEventListener('wheel',e=>{
  camDist = Math.max(CAM_DIST_MIN, Math.min(CAM_DIST_MAX, camDist + e.deltaY*CAM_DIST_WHEEL));
});
