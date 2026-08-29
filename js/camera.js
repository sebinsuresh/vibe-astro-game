'use strict';
// ---------------------------------------------------------------------------
// camera.js — trailing chase camera.
//
// Sits BEHIND the ship along its heading and looks a little ahead of it, so
// the ship always faces AWAY from the camera. Pressing W flies you "into" the
// screen (forward), matching the reference third-person feel. The camera
// heading lags slightly behind the ship's yaw so it trails on hard turns, and
// the position is smoothed so it follows rather than snapping. Buildings
// still get respected via collideCamera.
// ---------------------------------------------------------------------------

const _camPos  = new THREE.Vector3();
const _camLook = new THREE.Vector3();
let camHeading = 0;   // smoothed heading the camera follows (lags behind yaw)

function updateCamera(dt, p){
  // camera trails the ship's heading (a little lag on turns)
  camHeading = lerpAngle(camHeading, yaw, 1 - Math.pow(CAM_HEADING_LAG, dt));

  const c = Math.cos(camPitch), s = Math.sin(camPitch);

  // position: BEHIND the ship (opposite of its nose) + above
  // nose = (-sin(yaw), -cos(yaw))  =>  behind = (+sin, +cos)
  _camPos.set(
    p.x + Math.sin(camHeading)*c*camDist,
    p.y + s*camDist + CAM_LOOK_UP,
    p.z + Math.cos(camHeading)*c*camDist
  );
  collideCamera(_camPos);

  // look-at: a little AHEAD of the ship along its nose + up
  //   ahead = nose = (-sin(yaw), -cos(yaw))
  _camLook.set(
    p.x - Math.sin(yaw)*CAM_LOOK_AHEAD_H,
    p.y + CAM_LOOK_UP_TGT,
    p.z - Math.cos(yaw)*CAM_LOOK_AHEAD_H
  );

  camera.position.lerp(_camPos, 1 - Math.pow(CAM_FOLLOW, dt));
  camera.lookAt(_camLook);
}
