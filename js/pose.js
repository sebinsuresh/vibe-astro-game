'use strict';
// ---------------------------------------------------------------------------
// pose.js — the character's per-frame flight pose (pitch + roll), derived from
// the flight state so the body reads the way it's actually moving:
//
//   • leans forward (nose-down) in proportion to forward speed — extra when
//     boosting (the reference shows a ~20–35° dive at full burn)
//   • gentle lean-back when flying backwards (S)
//   • subtle nose-up / nose-down while ascending / descending
//   • banks into turns (roll), matching the existing feel
//
// Purely cosmetic: it only writes to `tilt.rotation` — never to `vel` or
// `yaw` — so it cannot change the movement.
// ---------------------------------------------------------------------------

function applyPose(dt, f){
  const fwd = -Math.sin(yaw)*vel.x - Math.cos(yaw)*vel.z; // + = forward along nose

  // forward lean, scaled by forward speed; boost multiplies it.
  // clamp so a full reverse reads as a moderate lean-back, not a flip.
  const fr = Math.max(-0.8, Math.min(1, fwd / MAX_SPEED_CRUISE));
  const lean = (f.boost ? BOOST_LEAN : LEAN) * fr;

  // vertical tilt from vertical velocity (subtle, clamped)
  const vPitch = Math.max(-0.45, Math.min(0.6, vel.y*0.035));

  // forward speed -> nose DOWN (-rotation.x); climbing -> nose UP (+rotation.x)
  const targetPitch = -lean + vPitch;

  // bank into the turn — keep the EXACT sign/amount the approved build had
  // (A = roll one way, D = the other; magnitude 0.55)
  const turn = (keys['KeyA']?1:0) + (keys['KeyD']?-1:0);
  const targetRoll = turn * -0.55;

  // frame-rate-independent smoothing (~10% per frame at 60 fps)
  const t = 1 - Math.pow(0.001, dt);
  tilt.rotation.x = THREE.MathUtils.lerp(tilt.rotation.x, targetPitch, t);
  tilt.rotation.z = THREE.MathUtils.lerp(tilt.rotation.z, targetRoll, t);
}
