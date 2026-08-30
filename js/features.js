'use strict';
// ---------------------------------------------------------------------------
// features.js — the feel-feature registry.
//
// Every control/camera/VFX improvement lives behind a feature flag so the
// player can hot-toggle each one in the pause menu and A/B the feel.
// State is plain booleans checked inline by the game modules
// (physics/pose/camera/effects/...), so toggling is instant and cannot
// leave stale state behind. Settings persist to localStorage.
// ---------------------------------------------------------------------------

const FEATURES = {
  dive:    { key: '1', on: true,  name: 'Rocket dive pose',        desc: 'Body aligns with the thrust — near-vertical at full boost' },
  align:   { key: '2', on: true,  name: 'Turn assist',             desc: 'Velocity follows the nose — kills floaty crosswind drift' },
  brake:   { key: '3', on: true,  name: 'Coast brake',             desc: 'Snappy settle when you let go of the throttle' },
  steer:   { key: '4', on: false, name: 'Smooth steering',         desc: 'Control-surface turns (eased rate) instead of instant yaw' },
  bank:    { key: '5', on: true,  name: 'Camera bank & look-ahead',desc: 'Camera rolls into turns and aims ahead of the ship' },
  warp:    { key: '6', on: true,  name: 'Speed FOV warp',          desc: 'Field of view widens with speed' },
  shake:   { key: '7', on: false, name: 'Speed shake',             desc: 'Subtle high-frequency camera vibration at speed' },
  arms:    { key: '8', on: true,  name: 'Streamlined arms',        desc: 'Arms sweep back at speed, gentle idle bob at rest' },
  streaks: { key: '9', on: false, name: 'Boost speed streaks',     desc: 'Speed lines flare out at high speed / boost' },
  impact:  { key: '0', on: true,  name: 'Impact feedback',         desc: 'Camera shake + spark burst when you clip a wall' },
  rings:   { key: 'q', on: true,  name: 'Ring pickup juice',       desc: 'Pop, spark burst and HUD pulse when you grab a ring' },
  sparks:  { key: 'w', on: true,  name: 'Spark trail',             desc: 'Flame spark particles behind the ship' },
};
const FEATURE_LIST = Object.keys(FEATURES);

// ---- persistence -----------------------------------------------------------
const FEAT_STORE = 'astrofly.feats.v1';
(function load(){
  try {
    const raw = localStorage.getItem(FEAT_STORE);
    if(!raw) return;
    const saved = JSON.parse(raw);
    for(const id of FEATURE_LIST){
      if(typeof saved[id] === 'boolean') FEATURES[id].on = saved[id];
    }
  } catch(e){ /* fresh start */ }
})();
function saveFeatures(){
  const out = {};
  for(const id of FEATURE_LIST) out[id] = FEATURES[id].on;
  try { localStorage.setItem(FEAT_STORE, JSON.stringify(out)); } catch(e){}
}

// ---- public helpers --------------------------------------------------------
function featOn(id){ return FEATURES[id].on; }
function _sync(id){ if(typeof menuSyncFeature === 'function') menuSyncFeature(id); }
function featToggle(id){
  const f = FEATURES[id];
  if(!f) return false;
  f.on = !f.on;
  saveFeatures();
  _sync(id);
  return f.on;
}
function featSet(id, on){
  const f = FEATURES[id];
  if(!f) return;
  f.on = !!on;
  saveFeatures();
  _sync(id);
}
