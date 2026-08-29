'use strict';
// ---------------------------------------------------------------------------
// hud.js — speed / altitude readout + the fading controls hint.
// ---------------------------------------------------------------------------

const speedEl = document.getElementById('speed');
const altEl   = document.getElementById('alt');

function updateHUD(s, p){
  speedEl.textContent = s.toFixed(1) + ' m/s';
  altEl.textContent   = Math.round(p.y - WORLD_Y_MIN);
}

const hint = document.getElementById('hint');
setTimeout(()=>hint.style.opacity = 0, 12000);
