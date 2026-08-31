'use strict';
// ---------------------------------------------------------------------------
// hud.js — speed / altitude readout + the fading controls hint.
// ---------------------------------------------------------------------------

const speedEl = document.getElementById('speed');
const altEl   = document.getElementById('alt');
const boostFill = document.getElementById('boostfill');

function updateHUD(s, p){
  speedEl.textContent = s.toFixed(1) + ' m/s';
  altEl.textContent   = Math.round(p.y - WORLD_Y_MIN);
  // boost meter: width = charge %, red tint when low
  const m = (typeof boostMeter !== 'undefined') ? boostMeter : 1;
  boostFill.style.width = (Math.max(0, Math.min(1, m))*100).toFixed(1) + '%';
  boostFill.classList.toggle('low', m < 0.28);
}

const hint = document.getElementById('hint');
setTimeout(()=>hint.style.opacity = 0, 12000);
