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

// ---- camera ----
const CAM_YAW_SPEED   = 0.0026;
const CAM_PITCH_SPEED = 0.0022;
const CAM_PITCH_MIN   = 0.06;
const CAM_PITCH_MAX   = 1.15;
const CAM_DIST_MIN    = 4;
const CAM_DIST_MAX    = 14;
const CAM_DIST_WHEEL  = 0.004;
const CAM_PITCH_DEFAULT = 0.30;
const CAM_DIST_DEFAULT  = 9;
const CAM_LOOK_AHEAD = 1.5;        // look-at height above player
const CAM_LOOK_UP    = 1.1;        // camera base lift
const CAM_FOLLOW     = 0.0001;     // camera lerp base (1 - base^dt)

// ---- effects ----
const SPARKS = 70;                 // spark-trail particle pool
