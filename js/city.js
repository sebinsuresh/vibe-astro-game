'use strict';
// ---------------------------------------------------------------------------
// city.js — procedural low-poly city: varied building palette, multi-material
// facades (windows + roof + plinth), setback/slanted roof shapes, and ground
// props (trees, streetlights, clutter). All low-poly, keeps `buildings`
// (AABB collision) correct.
// ---------------------------------------------------------------------------

// ---------- facades ----------
// A palette of building "styles" so the city isn't one flat colour. Each has
// a base wall hue (as HSV-ish rgb multipliers) and a window tint.
const STYLES = [
  { wall:[0.36,0.42,0.56], win:0.86, roof:0x2b3346, plinth:0x1c212e, name:'steel-blue'  },
  { wall:[0.30,0.46,0.50], win:0.80, roof:0x243338, plinth:0x161f22, name:'teal'        },
  { wall:[0.52,0.50,0.52], win:0.72, roof:0x3a3a42, plinth:0x24242a, name:'slate'       },
  { wall:[0.55,0.40,0.52], win:0.88, roof:0x3a2b3a, plinth:0x241a24, name:'mauve'       },
  { wall:[0.60,0.54,0.46], win:0.68, roof:0x3d3830, plinth:0x241f1a, name:'warm-gray'   },
  { wall:[0.40,0.40,0.60], win:0.90, roof:0x2b2b46, plinth:0x1a1a2e, name:'indigo'      },
  { wall:[0.44,0.52,0.40], win:0.70, roof:0x2b3628, plinth:0x1a2118, name:'moss'        },
];
// pick a style with weighting toward the cooler tones (they read as "city")
function pickStyle(){
  const r = Math.random();
  return STYLES[r<0.34?0 : r<0.52?1 : (Math.random()*STYLES.length)|0];
}

// window facade texture, with variety (grid vs banded, lit vs sparse)
function makeFacadeTexture(style){
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const [wr,ww,wb] = style.wall;
  g.fillStyle = `rgb(${(wr*255)|0},${(ww*255)|0},${(wb*255)|0})`;
  g.fillRect(0,0,64,128);

  const banded = Math.random() < 0.4;        // horizontal floor bands
  const rows = banded ? 16 : 13;
  const cols = banded ? 5 : (3 + (Math.random()*3)|0);
  const mx = 5, my = 6;
  const cw = (64-mx*2)/cols, ch = (128-my*2)/rows;
  const litProb = 0.35 + Math.random()*0.5;   // how many windows glow
  for(let r=0;r<rows;r++){
    for(let q=0;q<cols;q++){
      const warm = Math.random() < 0.4;
      const glow = Math.random() < litProb;
      let col;
      if(glow){
        const R = warm? 226 : (wr*255+120)|0;
        const G = warm? 198 : (ww*255+120)|0;
        const B = warm? 150 : (wb*255+150)|0;
        col = `rgb(${R|0},${G|0},${B|0})`;
      } else {
        // unlit: darker than the wall
        const d = 0.45 + Math.random()*0.2;
        col = `rgb(${(wr*255*d)|0},${(ww*255*d)|0},${(wb*255*d)|0})`;
      }
      g.fillStyle = col;
      const inset = banded? 1 : 2;
      g.fillRect(mx+q*cw+inset, my+r*ch+inset, cw-2*inset, ch-2*inset);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.encoding = THREE.sRGBEncoding;
  return t;
}

// small shared material helpers (one roof/plinth/trims set per style, reused)
const _styleMatCache = {};
function styleSharedMats(style){
  const key = style.name;
  let m = _styleMatCache[key];
  if(!m){
    m = _styleMatCache[key] = {
      roof:   new THREE.MeshLambertMaterial({ color: style.roof }),
      plinth: new THREE.MeshLambertMaterial({ color: style.plinth }),
      trims:  new THREE.MeshLambertMaterial({ color: 0x9aa4ad }),
    };
  }
  return m;
}
function styleMaterials(style, w, h){
  const shared = styleSharedMats(style);
  // facade is per-building (unique texture + repeat), sides share it
  const tex = makeFacadeTexture(style);
  tex.repeat.set(Math.max(1, Math.round(w/9)), Math.max(1, Math.round(h/13)));
  const facade = new THREE.MeshLambertMaterial({ map: tex });
  // BoxGeometry material order: +x -x +y(top) -y(bottom) +z -z
  return [facade, facade, shared.roof, shared.plinth, facade, facade];
}

// ---------- city ----------
const buildings=[]; // {minX,maxX,minZ,maxZ,top}
const cityGroup=new THREE.Group(); scene.add(cityGroup);
const STEP=22, HALF=9;

function addBuilding(cx, cz, w, d, h, style){
  const mats = styleMaterials(style, Math.max(w,d), h);
  const b = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mats);
  b.position.set(cx, h/2, cz);
  cityGroup.add(b);
  const pad = 0.6;
  buildings.push({minX:cx-w/2-pad, maxX:cx+w/2+pad, minZ:cz-d/2-pad, maxZ:cz+d/2+pad, top:h+pad});
  return { cx, cz, w, d, h, style, mat: mats, group: b };
}

for(let ix=-HALF; ix<=HALF; ix++){
  for(let iz=-HALF; iz<=HALF; iz++){
    if(ix===0) continue;                 // central corridor along Z
    if(Math.abs(iz)<=1 && Math.abs(ix)===1 && Math.random()<0.5) continue;
    if(Math.random()<0.22) continue;     // gaps
    const w=9+Math.random()*7, d=9+Math.random()*7;
    const h=16+Math.random()*Math.random()*85;
    const cx=ix*STEP+(Math.random()*6-3), cz=iz*STEP+(Math.random()*6-3);
    const style = pickStyle();
    const b = addBuilding(cx, cz, w, d, h, style);

    // --- shape variety (kept low-poly, collision added for tall steps) ---
    const roll = Math.random();
    if(h > 34 && roll < 0.5){
      // setback / stepped top: a smaller box on top (skyscraper massing)
      const sw = w*0.62, sd = d*0.62, sh = h*0.28;
      const sm = styleMaterials(style, Math.max(sw,sd), sh+h);
      const sb = new THREE.Mesh(new THREE.BoxGeometry(sw,sh,sd), sm);
      sb.position.set(cx, h+sh/2, cz);
      cityGroup.add(sb);
      const p=0.6;
      buildings.push({minX:cx-sw/2-p,maxX:cx+sw/2+p,minZ:cz-sd/2-p,maxZ:cz+sd/2+p,top:h+sh+p});
    } else if(h > 40 && roll < 0.8){
      // slanted roof slab
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w*1.03, 1.6, d*1.03), styleSharedMats(style).roof);
      roof.position.set(cx, h+0.6, cz);
      roof.rotation.z = (Math.random()<0.5?1:-1)*(0.10+Math.random()*0.10);
      cityGroup.add(roof);
    } else {
      // flat parapet + occasional rooftop box
      if(Math.random()<0.6){
        const rw=1.6+Math.random()*2, rh=0.8+Math.random()*1.4;
        const rt=new THREE.Mesh(new THREE.BoxGeometry(rw,rh,rw*1.4), styleSharedMats(style).trims);
        rt.position.set(cx+(Math.random()*w*0.4-w*0.2), h+rh/2, cz+(Math.random()*d*0.4-d*0.2));
        cityGroup.add(rt);
      }
      if(h>60 && Math.random()<0.5){
        const sp=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.2,h*0.22), styleSharedMats(style).trims);
        sp.position.set(cx,h+h*0.11,cz); cityGroup.add(sp);
        // red beacon
        const bc=new THREE.Mesh(new THREE.SphereGeometry(0.28,8,6),
          new THREE.MeshLambertMaterial({color:0xff3b3b, emissive:0x551010}));
        bc.position.set(cx, h+h*0.22, cz); cityGroup.add(bc);
      }
    }
  }
}

// hero building with slanted roof (left of start corridor)
{
  const h=72,w=16,d=16,cx=-24,cz=30, style=STYLES[0];
  addBuilding(cx,cz,w,d,h,style);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(w*1.04,2.4,d*1.04),
    new THREE.MeshLambertMaterial({color:style.roof}));
  roof.position.set(cx,h+0.6,cz); roof.rotation.z=0.12; cityGroup.add(roof);
}

// ---------- ground props (break up the flat street; low, no flight collision) ----------
function makeTree(color){
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.35,1.6,6),
    new THREE.MeshLambertMaterial({color:0x4a3524}));
  trunk.position.y = 0.8; g.add(trunk);
  const fol = new THREE.Mesh(new THREE.ConeGeometry(1.4,3.2,7),
    new THREE.MeshLambertMaterial({color:color}));
  fol.position.y = 3.0; g.add(fol);
  const fol2 = new THREE.Mesh(new THREE.ConeGeometry(1.0,2.2,7),
    new THREE.MeshLambertMaterial({color:color}));
  fol2.position.y = 4.4; g.add(fol2);
  return g;
}
function makeStreetlight(){
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,5,6),
    new THREE.MeshLambertMaterial({color:0x5b636b}));
  pole.position.y = 2.5; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.12,0.12),
    new THREE.MeshLambertMaterial({color:0x5b636b}));
  arm.position.set(0.8,5,0); g.add(arm);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.2,0.5),
    new THREE.MeshLambertMaterial({color:0xfff2c0, emissive:0x8a7a3a}));
  lamp.position.set(1.5,4.9,0); g.add(lamp);
  return g;
}
const treeCols = [0x3f7d4f, 0x4f8f4a, 0x6b9e4a, 0x2f6d5a];
// line trees + streetlights along the corridors and a few random blocks
for(let z=-HALF*STEP; z<=HALF*STEP; z+=STEP){
  for(const x of [-2, 2]){
    if(Math.random()<0.5) continue;
    const t = makeTree(treeCols[(Math.random()*treeCols.length)|0]);
    t.position.set(x*STEP/2 + (Math.random()*4-2), 0, z + (Math.random()*6-3));
    t.scale.setScalar(0.8 + Math.random()*0.5);
    cityGroup.add(t);
    if(Math.random()<0.5){
      const s = makeStreetlight();
      s.position.set(x*STEP/2 + 2, 0, z + 3);
      cityGroup.add(s);
    }
  }
}
// scattered ground clutter (low boxes = crates/props, no collision)
for(let i=0;i<40;i++){
  const gx = (Math.random()*2-1)*HALF*STEP;
  const gz = (Math.random()*2-1)*HALF*STEP;
  if(Math.abs(gx)<4) continue;   // keep the corridor clear
  const s = 0.6+Math.random()*1.4;
  const prop = new THREE.Mesh(new THREE.BoxGeometry(s, s*(0.4+Math.random()*0.6), s),
    new THREE.MeshLambertMaterial({color: new THREE.Color().setHSL(Math.random(),0.15,0.35+Math.random()*0.2)}));
  prop.position.set(gx, s*0.2, gz);
  prop.rotation.y = Math.random()*Math.PI;
  cityGroup.add(prop);
}
