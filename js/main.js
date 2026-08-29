'use strict';
// ---------------------------------------------------------------------------
// main.js — game loop, startup and window resize.
// Runs after config/scene/city/player/physics/effects/rings/input/camera/hud.
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();
const fwd = new THREE.Vector3();
let t = 0;

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;

  // camera basis (forward = where camera looks, horizontal)
  fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));

  // flight
  const flight = updateFlight(dt, keys);

  // VFX
  updateFlames(t, flight.speed, flight.thrust, flight.boost);
  updateSparks(dt, flight.speed, flight.thrust);

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
