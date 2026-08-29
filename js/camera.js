'use strict';
// ---------------------------------------------------------------------------
// camera.js — orbiting chase camera that follows the player, stays out of
// buildings, and looks a bit ahead/above them.
// ---------------------------------------------------------------------------

const _camTarget = new THREE.Vector3();

function updateCamera(dt, p){
  const cp = camPitch;
  const cpx = p.x + Math.sin(camYaw)*Math.cos(cp)*camDist;
  const cpz = p.z + Math.cos(camYaw)*Math.cos(cp)*camDist;
  const cpy = p.y + Math.sin(cp)*camDist + CAM_LOOK_UP;
  _camTarget.set(cpx, cpy, cpz);
  collideCamera(_camTarget);
  camera.position.lerp(_camTarget, 1 - Math.pow(CAM_FOLLOW, dt));
  camera.lookAt(p.x, p.y + CAM_LOOK_AHEAD, p.z);
}
