'use strict';
// ---------------------------------------------------------------------------
// menu.js — the ESC pause menu: per-feature feel toggles.
//
// ESC releases the pointer lock, the game freezes (main.js checks
// menuOpen) and this overlay lists every feel feature. Each row toggles
// its feature instantly (features.js) while paused, so you can try the
// difference on the next frame of flight. Settings persist.
// ---------------------------------------------------------------------------

let menuOpen = false;
const menuEl = document.getElementById('menu');
const menuList = menuEl.querySelector('#menuList');

function menuBuild(){
  menuList.innerHTML = '';
  for(const id of FEATURE_LIST){
    const f = FEATURES[id];
    const row = document.createElement('div');
    row.className = 'mrow';
    row.id = 'feat_' + id;

    const kb = document.createElement('span');
    kb.className = 'mk';
    kb.textContent = f.key.toUpperCase();
    const txt = document.createElement('span');
    txt.className = 'mtxt';
    const nm = document.createElement('b'); nm.textContent = f.name;
    const ds = document.createElement('i'); ds.textContent = f.desc;
    txt.appendChild(nm); txt.appendChild(ds);
    const st = document.createElement('span');
    st.className = 'mst on';
    st.textContent = 'ON';

    row.appendChild(kb); row.appendChild(txt); row.appendChild(st);
    row.addEventListener('click', () => featToggle(id));
    menuList.appendChild(row);
  }
}

function menuSyncFeature(id){
  if(!menuEl || !menuEl.classList.contains('show')) return;
  const row = document.getElementById('feat_' + id);
  if(row){
    const st = row.querySelector('.mst');
    st.textContent = FEATURES[id].on ? 'ON' : 'OFF';
    st.className = 'mst ' + (FEATURES[id].on ? 'on' : 'off');
    row.classList.toggle('dim', !FEATURES[id].on);
  }
}
function menuSyncAll(){
  for(const id of FEATURE_LIST) menuSyncFeature(id);
}

function menuShow(){
  if(menuOpen) return;
  menuOpen = true;
  menuEl.classList.add('show');
  menuSyncAll();
}
function menuHide(){
  if(!menuOpen) return;
  menuOpen = false;
  menuEl.classList.remove('show');
}
function menuToggle(){ menuOpen ? menuHide() : menuShow(); }

addEventListener('keydown', (e) => {
  if(e.code === 'Escape' && document.pointerLockElement === null){
    // ESC while released: open the menu (and vice versa)
    e.preventDefault();
    menuToggle();
  }
});
// while the menu is open, number keys toggle features without touching the game
// while the menu is open, the feature keys toggle features
addEventListener('keydown', (e) => {
  if(!menuOpen) return;
  for(const id of FEATURE_LIST){
    const k = FEATURES[id].key;
    const code = k >= '0' && k <= '9' ? 'Digit' + k : 'Key' + k.toUpperCase();
    if(e.code === code){ featToggle(id); e.preventDefault(); break; }
  }
  if(e.code === 'KeyM'){
    // re-launch: close menu and re-lock
    menuHide();
    renderer.domElement.requestPointerLock();
  }
});
document.getElementById('menuLaunch').addEventListener('click', () => {
  menuHide();
  renderer.domElement.requestPointerLock();
});

// pointer-lock lifecycle:
//   ESC (or any lock drop) -> release -> open the menu (once the game has
//   started; the start overlay owns the pre-first-flight release).
//   Re-lock (M / click)    -> close the menu.
let everLaunched = false;
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if(locked){ everLaunched = true; menuHide(); return; }
  if(!everLaunched) return;          // start overlay handles it
  if(!menuOpen) menuShow();
});
menuBuild();
