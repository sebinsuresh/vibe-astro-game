'use strict';
// ---------------------------------------------------------------------------
// main.js — game loop, startup and window resize.
// Runs after config/scene/city/player/physics/effects/rings/input/camera/hud.
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();
let t = 0;
let _lastImpactT = 0;   // to fire a spark burst on a FRESH wall clip

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;

  if(menuOpen){ renderer.render(scene, camera); return; }  // frozen behind menu

  // flight
  const flight = updateFlight(dt, keys);

  // impact spark burst (feature "impact"): a fresh collision (impact.t
  // reset to 1) sprays sparks where the hull met the wall.
  if(featOn('impact') && impact.t === 1 && _lastImpactT !== 1 && flight.speed > 2){
    const p = astro.position;
    spawnBurst(p.x + impact.nx*0.6, p.y + impact.ny*0.6, p.z + impact.nz*0.6, 30, 0xffc060);
  }
  _lastImpactT = impact.t;

  // VFX + pose markers
  updateFlames(t, flight.speed, flight.thrust, flight.boost);
  updateJets(dt, flight.strafe);
  updateSparks(dt, flight.speed, flight.thrust);
  updateBursts(dt);
  updateStreaks(dt, flight.speed, flight.boost);
  updateMarkers();

  // rings + camera + HUD
  const p = astro.position;
  updateRings(dt, p);
  updateCamera(dt, p);
  updateHUD(flight.speed, p);

  renderer.render(scene, camera);
}
animate();

addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
