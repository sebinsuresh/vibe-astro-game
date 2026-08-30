'use strict';
// ---------------------------------------------------------------------------
// scene.js — renderer, scene, fog, lights, the gradient sky dome and the
// city-street ground (procedural asphalt texture).
// ---------------------------------------------------------------------------

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// ---------- scene / camera / lights ----------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOGCOL, FOG_NEAR, FOG_FAR);

const camera = new THREE.PerspectiveCamera(CAM_FOV_BASE, innerWidth / innerHeight, 0.1, 900);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xfff2e0, 0.55);
sun.position.set(-0.4, 1, 0.3);
scene.add(sun);

// ---------- sky: big inverted dome, vertical gradient + sun glow ----------
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(700, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(SKY_TOP) },
      midColor: { value: new THREE.Color(SKY_MID) },
      hzColor:  { value: new THREE.Color(SKY_HZ) },
      sunDir:   { value: new THREE.Vector3(-0.35, 0.7, 0.2).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor, midColor, hzColor, sunDir;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float t = d.y;
        vec3 col = t < 0.25
          ? mix(hzColor, midColor, smoothstep(0.0, 0.25, t))
          : mix(midColor, topColor, smoothstep(0.25, 0.75, t));
        float glow = max(0.0, dot(d, sunDir));
        col += vec3(1.0, 0.85, 0.6) * pow(glow, 12.0) * 0.25;
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
);
scene.add(skyDome);

// ---------- street texture (procedural asphalt) ----------
function makeStreetTexture(){
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  // asphalt base with speckle noise
  g.fillStyle = '#565e68';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    const v = 70 + (Math.random() * 40) | 0;
    g.fillStyle = `rgba(${v},${v + 6},${v + 12},0.28)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // block grid lines (city blocks, ~22 m apart at this tile size)
  g.strokeStyle = 'rgba(152,161,171,0.55)'; g.lineWidth = 3;
  for (let p = 0; p <= 256; p += 64) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke();
  }
  // dashed lane markers down each corridor
  g.fillStyle = 'rgba(214,219,224,0.8)';
  for (let y = 0; y < 256; y += 32) { g.fillRect(62, y, 3, 16); g.fillRect(190, y, 3, 16); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  t.anisotropy = 8;
  t.encoding = THREE.sRGBEncoding;
  return t;
}

// ---------- ground ----------
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1200, 1200),
  new THREE.MeshLambertMaterial({ map: makeStreetTexture() })
);
ground.rotation.x = -Math.PI / 2;   // plane normal up: street at y=0, towers above
scene.add(ground);
