'use strict';
// ---------------------------------------------------------------------------
// physics.js — flight state, the per-frame movement model, and collision.
//
// Flight model (heading-relative):
//   MOUSE / A D  steer the character (yaw) left/right (auto-banks into the turn)
//   W/S  thrust forward/back along the player's nose
//   R/F  ascend/descend
//   SHIFT boost (more thrust, faster turns, higher speed cap)
// Drag + speed caps keep it feeling floaty but controllable.
// The trailing chase camera follows the character's heading, so "forward" (W)
// always points away from the camera.
// ---------------------------------------------------------------------------

const vel = new THREE.Vector3();
let yaw = 0;
let yawRate = 0;    // current yaw rate (rad/s) — smooth steering + bank source
// impact feedback (feature "impact"): the last wall clip's impulse, read by
// camera.js (shake) and effects.js (spark burst). `t` decays in camera.js.
// `mag` is the SPEED AT IMPACT (m/s) — captured in collide() BEFORE the
// velocity is deflected, so a hard hit shakes more than a graze.
const impact = { nx:0, ny:0, nz:0, mag:0, t:0 };
function hitImpact(nx, ny, nz, mag){
  impact.nx = nx; impact.ny = ny; impact.nz = nz;
  impact.mag = mag;
  impact.t = 1;
}

// --- collision helpers ------------------------------------------------------
function collide(p){
  const spd = () => Math.hypot(vel.x, vel.y, vel.z);   // speed BEFORE deflection
  for(const b of buildings){
    if(p.y > b.top) continue;
    if(p.x>b.minX && p.x<b.maxX && p.z>b.minZ && p.z<b.maxZ){
      const dx1=p.x-b.minX, dx2=b.maxX-p.x, dz1=p.z-b.minZ, dz2=b.maxZ-p.z;
      const m=Math.min(dx1,dx2,dz1,dz2);
      if(m===dx1){p.x=b.minX-RADIUS; hitImpact(-1,0,0,spd()); vel.x=Math.min(0,vel.x)*-0.1;}
      else if(m===dx2){p.x=b.maxX+RADIUS; hitImpact(1,0,0,spd()); vel.x=Math.max(0,vel.x)*-0.1;}
      else if(m===dz1){p.z=b.minZ-RADIUS; hitImpact(0,0,-1,spd()); vel.z=Math.min(0,vel.z)*-0.1;}
      else {p.z=b.maxZ+RADIUS; hitImpact(0,0,1,spd()); vel.z=Math.max(0,vel.z)*-0.1;}
    }
  }
  if(p.y<WORLD_Y_MIN){p.y=WORLD_Y_MIN; hitImpact(0,-1,0,spd()); vel.y=Math.max(0,vel.y)*-0.2;}
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
      // push out along ALL penetrating axes (not just the smallest one):
      // resolving one axis per pass can leave the camera inside the box and
      // the chase view tilts wildly. A few passes fully free the camera.
      for(let k=0;k<4;k++){
        const dx1=p.x-(b.minX-R), dx2=(b.maxX+R)-p.x;
        const dz1=p.z-(b.minZ-R), dz2=(b.maxZ+R)-p.z;
        const m=Math.min(dx1,dx2,dz1,dz2);
        if(m>1e-3) break;                 // free
        if(m===dx1) p.x=b.minX-R;
        else if(m===dx2) p.x=b.maxX+R;
        else if(m===dz1) p.z=b.minZ-R;
        else p.z=b.maxZ+R;
      }
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
  // yaw turn — two modes:
  //   smooth steering (featOn('steer')): mouse + keys drive an EASED yaw
  //     rate (control-surface feel); the mouse input self-centres when
  //     you stop moving it.
  //   legacy (off): keys turn at a fixed rate, mouse applies instant yaw.
  const turn = (keys['KeyA']?1:0) + (keys['KeyD']?-1:0); // A = left (+), D = right (-)
  if(featOn('steer')){
    const target = steerInput + turn*(boost?KEY_TURN_BOOST:KEY_TURN);
    yawRate += (target - yawRate) * (1 - Math.pow(STEER_EASE, dt*60));
    steerInput *= Math.pow(0.1, dt);          // self-center
    yaw += yawRate * dt;
  } else {
    const before = yaw;
    yaw += turn * (boost?2.6:2.0) * dt;
    yawRate = yawRate*0.7 + ((yaw-before)/Math.max(dt,1e-4))*0.3;  // low-passed actual rate
  }

  // thrust along the character's heading (nose)
  const accel = boost ? BOOST : W_B;
  const hx=-Math.sin(yaw), hz=-Math.cos(yaw);
  vel.x += hx*az*accel*dt;
  vel.z += hz*az*accel*dt;
  vel.y += ay * VERT * (boost?1.6:1) * dt;

  // drag + speed cap
  //   base drag always applies; the "coast brake" feature (featOn('brake'))
  //   adds strong extra drag once the throttle is off, so you settle
  //   quickly instead of drifting floaty.
  let dragBase = DRAG_BASE;
  if(featOn('brake') && thrust < 0.01) dragBase *= BRAKE_POW;
  vel.multiplyScalar(Math.pow(dragBase, dt));
  const maxS = boost ? MAX_SPEED_BOOST : MAX_SPEED_CRUISE;
  const s = vel.length();
  if(s > maxS) vel.multiplyScalar(maxS / s);

  // turn assist (featOn('align')): ease the velocity vector onto the nose.
  // Without it, speed keeps the direction you had when you turned — the
  // "floaty" crosswind drift. With it, you fly where you point.
  if(featOn('align') && s > 0.3){
    const hx=-Math.sin(yaw), hz=-Math.cos(yaw);
    const ahead = vel.x*hx + vel.z*hz;          // forward component
    const lateralX = vel.x - hx*ahead;          // sideways drift (xz plane)
    const lateralZ = vel.z - hz*ahead;
    const lat = Math.hypot(lateralX, lateralZ);
    if(lat > 0.05){
      const keep = Math.pow(ALIGN_POW, dt);     // decay base of the drift
      vel.x -= lateralX * (1 - keep);
      vel.z -= lateralZ * (1 - keep);
    }
  }

  // integrate + world bounds
  astro.position.addScaledVector(vel, dt);
  astro.position.x = Math.max(-WORLD_XZ, Math.min(WORLD_XZ, astro.position.x));
  astro.position.z = Math.max(-WORLD_XZ, Math.min(WORLD_XZ, astro.position.z));
  astro.position.y = Math.max(WORLD_Y_MIN, Math.min(WORLD_Y_MAX, astro.position.y));
  collide(astro.position);

  // orient: nose is authoritative; body pitch / bank pose in pose.js
  astro.rotation.y = yaw;
  const sp = vel.length();
  applyPose(dt, { thrust, speed: sp, boost });

  return { thrust, speed: sp, boost };
}
