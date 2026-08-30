'use strict';
// ---------------------------------------------------------------------------
// camera.js — trailing chase camera.
//
// Sits BEHIND the ship along its heading and looks a little ahead of it, so
// pressing W flies "into" the screen (forward, along the nose), matching the
// reference third-person feel. The camera heading lags slightly behind the
// ship's yaw so it trails on hard turns, and the position is smoothed so it
// follows rather than snapping. With speed, the camera pulls back a little
// and the FOV widens slightly for a sense of speed. Buildings are still
// respected via collideCamera.
// ---------------------------------------------------------------------------

const _camPos  = new THREE.Vector3();
const _camLook = new THREE.Vector3();
let camHeading = 0;   // smoothed heading the camera follows (lags behind yaw)

function updateCamera(dt, p){
  const s = vel.length();

  // camera trails the ship's heading (a little lag on turns)
  camHeading = lerpAngle(camHeading, yaw, 1 - Math.pow(CAM_HEADING_LAG, dt));

  // pull back a bit at speed so the character stays framed
  const dist = camDist + Math.min(CAM_SPEED_DZ_MAX, s*CAM_SPEED_DZ);
  const c = Math.cos(camPitch), sinP = Math.sin(camPitch);

  // position: BEHIND the ship (opposite of its nose) + above
  // nose = (-sin(yaw), -cos(yaw))  =>  behind = (+sin, +cos)
  _camPos.set(
    p.x + Math.sin(camHeading)*c*dist,
    p.y + sinP*dist + CAM_LOOK_UP,
    p.z + Math.cos(camHeading)*c*dist
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

  // subtle speed-warp: widen the FOV with speed, smoothed
  const targetFov = Math.min(CAM_FOV_MAX, CAM_FOV_BASE + s*CAM_FOV_SPEED);
  if(Math.abs(camera.fov - targetFov) > 0.01){
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.08);
    camera.updateProjectionMatrix();
  }
}
