'use strict';
// ---------------------------------------------------------------------------
// physics.js — flight state, the per-frame movement model, and collision.
//
// Flight model (heading-relative):
//   W/S  thrust forward/back along the player's nose
//   A/D  yaw left/right (auto-banks into the turn)
//   R/F  ascend/descend
//   SHIFT boost (more thrust, faster turns, higher speed cap)
// Drag + speed caps keep it feeling floaty but controllable.
// ---------------------------------------------------------------------------

const vel = new THREE.Vector3();
let yaw = 0;

// --- collision helpers ------------------------------------------------------
function collide(p){
  for(const b of buildings){
    if(p.y > b.top) continue;
    if(p.x>b.minX && p.x<b.maxX && p.z>b.minZ && p.z<b.maxZ){
      const dx1=p.x-b.minX, dx2=b.maxX-p.x, dz1=p.z-b.minZ, dz2=b.maxZ-p.z;
      const m=Math.min(dx1,dx2,dz1,dz2);
      if(m===dx1){p.x=b.minX-RADIUS; vel.x=Math.min(0,vel.x)*-0.1;}
      else if(m===dx2){p.x=b.maxX+RADIUS; vel.x=Math.max(0,vel.x)*-0.1;}
      else if(m===dz1){p.z=b.minZ-RADIUS; vel.z=Math.min(0,vel.z)*-0.1;}
      else {p.z=b.maxZ+RADIUS; vel.z=Math.max(0,vel.z)*-0.1;}
    }
  }
  if(p.y<WORLD_Y_MIN){p.y=WORLD_Y_MIN; vel.y=Math.max(0,vel.y)*-0.2;}
}
function inBuilding(x,y,z){
  for(const b of buildings){
    if(y<=b.top && x>b.minX && x<b.maxX && z>b.minZ && z<b.maxZ) return true;
  }
  return false;
}
function collideCamera(p){
  const R=0.5;
  for(const b of buildings){
    if(p.y > b.top) continue;
    if(p.x>b.minX-R && p.x<b.maxX+R && p.z>b.minZ-R && p.z<b.maxZ+R){
      const dx1=p.x-(b.minX-R), dx2=(b.maxX+R)-p.x, dz1=p.z-(b.minZ-R), dz2=(b.maxZ+R)-p.z;
      const m=Math.min(dx1,dx2,dz1,dz2);
      if(m===dx1) p.x=b.minX-R;
      else if(m===dx2) p.x=b.maxX+R;
      else if(m===dz1) p.z=b.minZ-R;
      else p.z=b.maxZ+R;
    }
  }
  if(p.y<0.5) p.y=0.5;
}
function lerpAngle(a,b,t){
  let d=(b-a)%(Math.PI*2);
  if(d>Math.PI)d-=Math.PI*2; if(d<-Math.PI)d+=Math.PI*2;
  return a+d*t;
}

// --- per-frame flight update ------------------------------------------------
// Returns { thrust, speed, boost } for the VFX / camera.
function updateFlight(dt, keys){
  const boost = !!(keys['ShiftLeft'] || keys['ShiftRight']);

  let ay=0, az=0, thrust=0;
  if(keys['KeyW']){ az+=1;  thrust+=1;   }
  if(keys['KeyS']){ az-=0.7;thrust+=0.5; }
  if(keys['KeyR']){ ay+=1;  thrust+=0.6; }
  if(keys['KeyF']){ ay-=1;  thrust+=0.6; }
  const turn = (keys['KeyA']?1:0) + (keys['KeyD']?-1:0); // A = turn left, D = turn right
  const accel = boost ? BOOST : W_B;

  // thrust along the character's heading (nose)
  const hx=-Math.sin(yaw), hz=-Math.cos(yaw);
  vel.x += hx*az*accel*dt;
  vel.z += hz*az*accel*dt;
  vel.y += ay * VERT * (boost?1.6:1) * dt;

  // yaw turn + bank into the turn
  yaw += turn * (boost?2.6:2.0) * dt;
  const targetRoll = turn * -0.55; // D = right bank
  tilt.rotation.z = THREE.MathUtils.lerp(tilt.rotation.z, targetRoll, 0.1);

  // drag + speed cap
  vel.multiplyScalar(Math.pow(DRAG_BASE, dt));
  const maxS = boost ? MAX_SPEED_BOOST : MAX_SPEED_CRUISE;
  const s = vel.length();
  if(s > maxS) vel.multiplyScalar(maxS / s);

  // integrate + world bounds
  astro.position.addScaledVector(vel, dt);
  astro.position.x = Math.max(-WORLD_XZ, Math.min(WORLD_XZ, astro.position.x));
  astro.position.z = Math.max(-WORLD_XZ, Math.min(WORLD_XZ, astro.position.z));
  astro.position.y = Math.max(WORLD_Y_MIN, Math.min(WORLD_Y_MAX, astro.position.y));
  collide(astro.position);

  // orient: nose is authoritative; slight pitch from vertical speed
  astro.rotation.y = yaw;
  tilt.rotation.x = THREE.MathUtils.lerp(tilt.rotation.x,
    Math.max(-0.45, Math.min(0.6, vel.y*0.035)), 0.12);

  return { thrust, speed: vel.length(), boost };
}
