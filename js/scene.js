'use strict';
// ---------------------------------------------------------------------------
// scene.js — renderer, scene, fog, lights and the ground plane.
// ---------------------------------------------------------------------------

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// ---------- scene / camera / lights ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(FOGCOL);
scene.fog = new THREE.Fog(FOGCOL, FOG_NEAR, FOG_FAR);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 900);

scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const sun = new THREE.DirectionalLight(0xffffff, 0.55);
sun.position.set(-0.4, 1, 0.3);
scene.add(sun);

// ---------- ground ----------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1200, 1200),
  new THREE.MeshLambertMaterial({ color: 0xb8c3cf })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
