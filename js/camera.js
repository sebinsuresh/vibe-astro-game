'use strict';
// ---------------------------------------------------------------------------
// camera.js — trailing chase camera.
//
// Sits BEHIND the character along its heading and looks a little ahead of
// it, so pressing W flies "into" the screen (forward, along the nose). The
// camera heading lags slightly behind the character's yaw so it trails on
// hard turns (clamped, so it can't swing past ~90° behind the nose), and
// its position is smoothed so it follows rather than snapping.
//
// Feel features (toggled in the ESC menu, see features.js):
//   "bank"  — camera rolls with the character's bank + look-ahead grows
//   "warp"  — FOV widens with speed (sense of speed)
//   "shake" — subtle high-frequency vibration scaled by speed/boost
//   "impact"— damped shake impulse when the character clips a wall
//             (physics.js records the impulse in the global `impact`)
// Buildings are always respected via collideCamera.
// ---------------------------------------------------------------------------

const _camPos  = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _zAxis   = new THREE.Vector3(0, 0, 1);
const _bankQ   = new THREE.Quaternion();
let camHeading = 0;   // smoothed heading the camera follows (lags behind yaw)
let _camBank   = 0;   // smoothed camera roll (rad)
let _shakeT = 0;      // high-frequency clock for speed shake

function updateCamera(dt, p){
  const s = vel.length();

  // camera trails the character's heading (a little lag on turns).
  // The lag is CLAMPED so the camera can never swing more than ~86° around
  // the character — past that, the chase cam starts looking back at the
  // character's face from the front, which reads as a disorienting "flip".
  let d = (yaw - camHeading) % (Math.PI*2);
  if(d > Math.PI) d -= Math.PI*2;
  if(d < -Math.PI) d += Math.PI*2;
  d = THREE.MathUtils.clamp(d, -CAM_LAG_MAX, CAM_LAG_MAX);
  camHeading += d * (1 - Math.pow(CAM_HEADING_LAG, dt));

  // pull back a bit at speed so the character stays framed
  const dist = camDist + Math.min(CAM_SPEED_DZ_MAX, s*CAM_SPEED_DZ);
  const c = Math.cos(camPitch), sinP = Math.sin(camPitch);

  // position: BEHIND the character (opposite of its nose) + above
  // nose = (-sin(yaw), -cos(yaw))  =>  behind = (+sin, +cos)
  _camPos.set(
    p.x + Math.sin(camHeading)*c*dist,
    p.y + sinP*dist + CAM_LOOK_UP,
    p.z + Math.cos(camHeading)*c*dist
  );
  collideCamera(_camPos);

  // look-at: a little AHEAD of the character along its nose + up.
  // The look-ahead grows with speed ("bank" feature) so the horizon swings
  // with the character and the camera reads as one unit with the pilot.
  const ahead = featOn('bank')
    ? CAM_LOOK_AHEAD_H + Math.min(AHEAD_MAX, s*AHEAD_PER_SPEED)
    : CAM_LOOK_AHEAD_H;
  _camLook.set(
    p.x - Math.sin(yaw)*ahead,
    p.y + CAM_LOOK_UP_TGT,
    p.z - Math.cos(yaw)*ahead
  );

  camera.position.lerp(_camPos, 1 - Math.pow(CAM_FOLLOW, dt));
  // Pin the world up-vector before lookAt: lookAt builds the view matrix
  // from `this.up`, so a fixed (0,1,0) keeps the horizon level through
  // sustained turns — ground always stays below.
  camera.up.set(0, 1, 0);
  camera.lookAt(_camLook);

  // camera bank: roll a share of the character's roll into the turn.
  // Applied as a rotation about the VIEW axis (post-multiplied quaternion)
  // instead of writing `camera.rotation.z` — an Euler write would rebuild
  // the whole quaternion from the camera's own Euler angles, and around a
  // ±90° camera yaw that decomposition jumps ~180°, which is what used
  // to flip the whole view upside down on sustained turns.
  const targetBank = featOn('bank') ? tilt.rotation.z * CAM_BANK : 0;
  _camBank += (targetBank - _camBank) * (1 - Math.pow(0.001, dt));
  if(Math.abs(_camBank) > 1e-4){
    _bankQ.setFromAxisAngle(_zAxis, _camBank);
    camera.quaternion.multiply(_bankQ);
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
