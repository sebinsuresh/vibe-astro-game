'use strict';
// ---------------------------------------------------------------------------
// config.js — tuning constants for ASTRO FLY.
// Every magic number the game uses lives here so behaviour is easy to tweak.
// (Classic script: these become globals shared by the other modules.)
// ---------------------------------------------------------------------------

// ---- atmosphere / scene ----
const FOGCOL   = 0xd7dfe8;   // fog + sky colour (high-key "fog city")
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

// ---- effects ----
const SPARKS = 70;                 // spark-trail particle pool
