'use strict';
// ---------------------------------------------------------------------------
// camera.js — trailing chase camera.
//
// Sits BEHIND the ship along its heading and looks a little ahead of it, so
// pressing W flies "into" the screen (forward, along the nose). The camera
// heading lags slightly behind the ship's yaw so it trails on hard turns,
// and its position is smoothed so it follows rather than snapping.
//
// Feel features (toggled in the ESC menu, see features.js):
//   "bank"  — camera rolls with the ship's bank + look-ahead grows with speed
//   "warp"  — FOV widens with speed (sense of speed)
//   "shake" — subtle high-frequency vibration scaled by speed/boost
//   "impact"— damped shake impulse when the ship clips a wall (physics.js
//             records the impulse in the global `impact`)
// Buildings are always respected via collideCamera.
// ---------------------------------------------------------------------------

const _camPos  = new THREE.Vector3();
const _camLook = new THREE.Vector3();
let camHeading = 0;   // smoothed heading the camera follows (lags behind yaw)
let _shakeT = 0;      // high-frequency clock for speed shake

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

  // look-at: a little AHEAD of the ship along its nose + up.
  // The look-ahead grows with speed ("bank" feature) so the horizon swings
  // with the ship and the camera reads as one unit with the pilot.
  const ahead = featOn('bank')
    ? CAM_LOOK_AHEAD_H + Math.min(AHEAD_MAX, s*AHEAD_PER_SPEED)
    : CAM_LOOK_AHEAD_H;
  _camLook.set(
    p.x - Math.sin(yaw)*ahead,
    p.y + CAM_LOOK_UP_TGT,
    p.z - Math.cos(yaw)*ahead
  );

  camera.position.lerp(_camPos, 1 - Math.pow(CAM_FOLLOW, dt));
  camera.lookAt(_camLook);

  // camera bank: roll a share of the ship's roll into the turn
  if(featOn('bank')){
    camera.rotation.z = tilt.rotation.z * CAM_BANK;
  } else {
    camera.rotation.z = 0;
  }

  // speed shake: subtle high-frequency jitter, scaled by speed/boost
  _shakeT += dt;
  if(featOn('shake') && s > 2){
    const amp = (s > MAX_SPEED_CRUISE)
      ? SHAKE_AMP_BOOST
      : SHAKE_AMP * Math.min(1, s/MAX_SPEED_CRUISE);
    camera.position.x += Math.sin(_shakeT*37)*amp;
    camera.position.y += Math.sin(_shakeT*53+1.7)*amp;
  }

  // impact shake: damped impulse from the last wall clip (feature "impact")
  if(featOn('impact') && impact.t > 0.001){
    impact.t *= Math.pow(0.02, dt);              // fast decay
    const imp = Math.min(1, impact.mag*0.15) * impact.t;
    camera.position.x += impact.nx*imp + Math.sin(_shakeT*90)*imp*0.5;
    camera.position.y += impact.ny*imp + Math.sin(_shakeT*83+2)*imp*0.5;
    camera.position.z += impact.nz*imp + Math.sin(_shakeT*97+4)*imp*0.5;
  }

  // subtle speed-warp: widen the FOV with speed, smoothed (feature "warp")
  const targetFov = featOn('warp')
    ? Math.min(CAM_FOV_MAX, CAM_FOV_BASE + s*CAM_FOV_SPEED)
    : CAM_FOV_BASE;
  if(Math.abs(camera.fov - targetFov) > 0.01){
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.08);
    camera.updateProjectionMatrix();
  }
}
