'use strict';
// ---------------------------------------------------------------------------
// city.js — procedural low-poly city: window textures, towers, the central
// corridor, rooftop clutter, and the hero building with a slanted roof.
// ---------------------------------------------------------------------------

// ---------- window textures ----------
function makeBuildingTexture(){
  const c = document.createElement('canvas'); c.width=64; c.height=128;
  const g = c.getContext('2d');
  const baseHues = [[0.74,0.79],[0.70,0.75],[0.78,0.83],[0.66,0.71],[0.76,0.74]];
  const [a,b] = baseHues[(Math.random()*baseHues.length)|0];
  const light = () => {
    const warm = Math.random()<0.35;
    const r = warm? (215+Math.random()*25)|0 : (a*255)|0;
    const gg = warm? (190+Math.random()*25)|0 : (b*255)|0;
    const bl = warm? (150+Math.random()*25)|0 : ((a+b)/2*255+14)|0;
    return `rgb(${r},${gg},${bl})`;
  }
  g.fillStyle = `rgb(${(b*255-26)|0},${(b*255-18)|0},${(b*255-4)|0})`;
  g.fillRect(0,0,64,128);
  const rows=14, cols=6, mx=6, my=7;
  const cw=(64-mx*2)/cols, ch=(128-my*2)/rows;
  for(let r=0;r<rows;r++) for(let q=0;q<cols;q++){
    const rnd=Math.random();
    if(rnd<0.62) g.fillStyle=light();
    else g.fillStyle=`rgb(${(120+Math.random()*60)|0},${(125+Math.random()*60)|0},${(135+Math.random()*50)|0})`;
    g.fillRect(mx+q*cw, my+r*ch, cw-2, ch-3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=4;
  return t;
}
const texPool=[]; for(let i=0;i<10;i++) texPool.push(makeBuildingTexture());

// ---------- city ----------
const buildings=[]; // {minX,maxX,minZ,maxZ,top}
const cityGroup=new THREE.Group(); scene.add(cityGroup);
const STEP=22, HALF=9;
for(let ix=-HALF; ix<=HALF; ix++){
  for(let iz=-HALF; iz<=HALF; iz++){
    if(ix===0) continue;                 // central corridor along Z
    if(Math.abs(iz)<=1 && ix!==0 && Math.abs(ix)===1 && Math.random()<0.5) continue;
    if(Math.random()<0.22) continue;     // gaps
    const w=9+Math.random()*7, d=9+Math.random()*7;
    const h=16+Math.random()*Math.random()*85;
    const cx=ix*STEP+(Math.random()*6-3), cz=iz*STEP+(Math.random()*6-3);
    const tex=texPool[(Math.random()*texPool.length)|0].clone();
    tex.needsUpdate=true;
    tex.repeat.set(Math.max(1,Math.round(w/10)), Math.max(1,Math.round(h/14)));
    const mat=new THREE.MeshLambertMaterial({map:tex});
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    b.position.set(cx,h/2,cz);
    cityGroup.add(b);
    buildings.push({minX:cx-w/2-0.6,maxX:cx+w/2+0.6,minZ:cz-d/2-0.6,maxZ:cz+d/2+0.6,top:h+0.6});
    // rooftop clutter
    if(Math.random()<0.5){
      const rw=1.5+Math.random()*2, rh=0.8+Math.random()*1.4;
      const rt=new THREE.Mesh(new THREE.BoxGeometry(rw,rh,rw*1.4),
        new THREE.MeshLambertMaterial({color:0x9aa4ad}));
      rt.position.set(cx+(Math.random()*w*0.4-w*0.2), h+rh/2, cz+(Math.random()*d*0.4-d*0.2));
      cityGroup.add(rt);
    }
    // antenna spire on tall ones
    if(h>60 && Math.random()<0.5){
      const sp=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.2,h*0.22),
        new THREE.MeshLambertMaterial({color:0x8a939c}));
      sp.position.set(cx,h+h*0.11,cz);
      cityGroup.add(sp);
    }
  }
}
// hero building with slanted roof (left of start corridor)
{
  const h=70,w=16,d=16,cx=-24,cz=30;
  const tex=texPool[2].clone(); tex.needsUpdate=true; tex.repeat.set(1.6,5);
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({map:tex}));
  b.position.set(cx,h/2,cz); cityGroup.add(b);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(w*1.04,2.4,d*1.04),
    new THREE.MeshLambertMaterial({color:0xaeb6bd}));
  roof.position.set(cx,h+0.6,cz); roof.rotation.z=0.12; cityGroup.add(roof);
  buildings.push({minX:cx-w/2-0.6,maxX:cx+w/2+0.6,minZ:cz-d/2-0.6,maxZ:cz+d/2+0.6,top:h+1.4});
}
