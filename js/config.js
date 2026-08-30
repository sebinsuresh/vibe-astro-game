'use strict';
// ---------------------------------------------------------------------------
// config.js — tuning constants for ASTRO FLY.
// Every magic number the game uses lives here so behaviour is easy to tweak.
// (Classic script: these become globals shared by the other modules.)
// ---------------------------------------------------------------------------

// ---- atmosphere / scene ----
const FOGCOL   = 0xcfd8e0;   // fog colour (matches the sky horizon haze)
const SKY_TOP  = 0x4c8fd6;   // zenith  (clear blue)
const SKY_MID  = 0xa9cbe6;   // mid sky
const SKY_HZ   = 0xe8edf0;   // horizon haze
const FOG_NEAR = 55;
const FOG_FAR  = 400;

// ---- colours (chibi astro-boy palette) ----
const CREAM  = 0xf2e8d8;
const MAROON = 0x8e1f30;
const BLACK  = 0x181818;
const RED    = 0xc23344;

// ---- flight physics ----
const W_B   = 16;   // normal forward thrust acceleration
const BOOST = 30;   // boosted thrust acceleration
const VERT  = 12;   // vertical (R/F) acceleration
const RADIUS = 0.7; // player collision radius
const DRAG_BASE = 0.35;            // vel *= DRAG_BASE^dt  (~0.66/s retention)
const MAX_SPEED_CRUISE = 17;
const MAX_SPEED_BOOST  = 34;
const WORLD_XZ   = 380;            // hard world bounds (x/z)
const WORLD_Y_MIN = 1.6;
const WORLD_Y_MAX = 280;

// ---- world ----
const RING_COUNT = 25;
const RING_PICKUP_DIST_SQ = 7;     // squared distance for ring collection

// ---- camera (trailing chase cam) ----
const CAM_TURN_SPEED   = 0.0042;   // mouse X -> steer the ship (rad / px)
const CAM_PITCH_SPEED  = 0.0024;   // mouse Y -> look up/down (rad / px)
const CAM_PITCH_MIN    = 0.10;
const CAM_PITCH_MAX    = 0.95;
const CAM_PITCH_DEFAULT = 0.34;    // elevation: behind + slightly above
const CAM_DIST_MIN     = 5;
const CAM_DIST_MAX     = 16;
const CAM_DIST_WHEEL   = 0.005;
const CAM_DIST_DEFAULT = 10;
const CAM_LOOK_UP      = 1.2;      // camera base lift above player
const CAM_LOOK_AHEAD_H = 3.0;      // look-at point ahead along heading
const CAM_LOOK_UP_TGT  = 1.4;      // look-at height above player
const CAM_FOLLOW       = 0.0006;   // camera position lerp base (1 - base^dt)
const CAM_HEADING_LAG  = 0.014;    // camera heading lerp base (trail behind yaw)
const CAM_SPEED_DZ     = 0.10;     // extra camera distance per m/s (pull back at speed)
const CAM_SPEED_DZ_MAX = 6;        // cap on that extra distance
const CAM_FOV_BASE     = 65;       // base field of view
const CAM_FOV_SPEED    = 0.35;     // extra degrees per m/s (sense of speed)
const CAM_FOV_MAX      = 82;       // cap on the widened fov

// ---- body pose (lean) ----
const LEAN       = 0.34;   // [legacy] forward pitch at full cruise (rad, ≈19°)
const BOOST_LEAN = 0.60;   // [legacy] forward pitch at full speed while boosting
const DIVE_CRUISE  = 1.05; // rocket-dive pose: pitch at full cruise speed (≈60°)
const DIVE_BOOST   = 1.58; // rocket-dive pose: pitch at full boost (≈90° — body flat, feet up)
const FLAME_HOLD   = 1.0;  // how strongly the flames stay vertical (1 = fully)

// ---- control feel ----
const ALIGN_POW    = 0.005;  // turn assist: velocity-to-nose lerp base
const BRAKE_POW    = 0.50;   // coast brake: extra drag base when throttle is off
const STEER_GAIN   = 0.014;  // smooth steering: yaw-rate gained per px of mouse
const STEER_EASE   = 0.0004; // smooth steering: yaw-rate easing base (per frame)
const KEY_TURN     = 2.0;    // key turn rate target (rad/s)
const KEY_TURN_BOOST = 2.6;  // … while boosting

// ---- camera feel ----
const CAM_BANK     = 0.7;    // camera bank factor (share of ship roll)
const AHEAD_PER_SPEED = 0.25;// look-ahead metres per m/s
const AHEAD_MAX    = 8;      // cap on look-ahead distance
const SHAKE_AMP    = 0.05;   // speed shake amplitude (m) at cruise
const SHAKE_AMP_BOOST = 0.10;// … while boosting

// ---- effects ----
const SPARKS = 70;                 // spark-trail particle pool
const STREAKS = 48;                // boost speed-line pool
