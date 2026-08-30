'use strict';
// ---------------------------------------------------------------------------
// pose.js — the character's per-frame flight pose (pitch + roll + arms),
// derived from the flight state so the body reads the way it's actually moving.
//
// Rocket-dive pose (feature "dive", on by default):
//   The rockets live on his feet, so the body pitches forward in proportion
//   to forward speed — at full cruise he's ~60° into the dive, at full
//   boost ~90° (body flat, feet trailing up). The flames stay held
//   near-vertical (effects.js) so the jets still point at the ground
//   while the body dives.
//
// Legacy pose (feature off): the old ~19°/34° lean.
//
// In both modes:
//   • gentle lean-back when flying backwards (S)
//   • subtle nose-up / nose-down while ascending / descending
//   • banks into turns (roll)
//   • arms: sweep back at speed, gentle idle bob at rest (feature "arms")
//
// Purely cosmetic: it only writes to `tilt.rotation` / arm rotation — never
// to `vel` or `yaw` — so it cannot change the movement.
// ---------------------------------------------------------------------------

let _diveAmt = 0;    // current dive pitch (rad) — effects.js uses it to hold the flames vertical
let armSmX   = 0.15; // smoothed arm sweep (rotation.x)

function applyPose(dt, f){
  const fwd = -Math.sin(yaw)*vel.x - Math.cos(yaw)*vel.z; // + = forward along nose
  const fr  = Math.max(-0.8, Math.min(1, fwd / MAX_SPEED_CRUISE));
  const vPitch = Math.max(-0.45, Math.min(0.6, vel.y*0.035));
  // bank follows the ACTUAL yaw rate (works for mouse + keys, both modes);
  // magnitude matches the old fixed 0.55 at a full 2 rad/s key turn.
  const targetRoll = -THREE.MathUtils.clamp(yawRate, -2, 2) * 0.275
    - strafeInput * STRAFE_BANK;   // lean INTO the strafe direction (D -> lean right)

  let targetPitch;
  if(featOn('dive')){
    _diveAmt = (f.boost ? DIVE_BOOST : DIVE_CRUISE) * fr;
    targetPitch = -_diveAmt + vPitch*0.4;
  } else {
    _diveAmt = 0;
    targetPitch = -(f.boost ? BOOST_LEAN : LEAN) * fr + vPitch;
  }

  // frame-rate-independent smoothing (~fast settle)
  const t = 1 - Math.pow(0.001, dt);
  tilt.rotation.x = THREE.MathUtils.lerp(tilt.rotation.x, targetPitch, t);
  tilt.rotation.z = THREE.MathUtils.lerp(tilt.rotation.z, targetRoll, t);

  // arms: streamline at speed, idle bob at rest
  if(featOn('arms')){
    const s = Math.min(1, f.speed / MAX_SPEED_CRUISE);
    const sweep = 0.15 + (f.boost ? 1.05 : 0.7) * s;
    const bob = Math.sin(t*2.2) * 0.05 * (1 - s);
    armSmX = THREE.MathUtils.lerp(armSmX, sweep + bob, 1 - Math.pow(0.01, dt));
  } else {
    armSmX = THREE.MathUtils.lerp(armSmX, 0.15, 1 - Math.pow(0.01, dt));
  }
  for(const a of armGroups) a.rotation.x = armSmX;
}
