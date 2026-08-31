'use strict';
// ---------------------------------------------------------------------------
// model.js — loads the character model from models/manifest.json (GLB/GLTF, or
// OBJ fallback), wires it into the same `astro`/`tilt` rig the procedural
// character uses, plays its animation clips, and drives a hover-bob.
//
// ADAPTABLE: to use a different model (e.g. a real Astro Boy .glb) just drop
// the file into /models/astro/ and edit models/manifest.json — no code changes.
//
// The flame VFX + jet light built in player.js stay anchored to `tilt`, so they
// travel with the model. pose.js keeps driving tilt.rotation, so dive/strafe/
// turn lean still works. Movement (vel/yaw in physics.js) is untouched.
//
// Exposes: modelState { ready, mixer, active, useModel() }
// ---------------------------------------------------------------------------

const modelState = { ready:false, mixer:null, active:false, usingModel:false,
                     modelWrap:null, anims:[] };

// measure a model's extents from RAW MESH GEOMETRY in the root's local space.
// Box3.setFromObject is wrong for skinned (Armature) models: it measures the
// current bone-pose extent, not the geometry. Skinning is excluded on purpose —
// animation clips deform around the bind pose, so the fit stays valid.
// Measure a model's extents for fit/centering, in the root's LOCAL space.
// SKINNED models must be measured from their SKELETON (bone) extent: the
// rendered position of a SkinnedMesh is determined by the bones, NOT by the
// position-attribute bounding box (which is ~100x off for Xbot) and not by
// Box3.setFromObject (which ignores skinning entirely).
// Non-skinned models use the raw mesh-geometry box.
function fitBounds(root){
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const box = new THREE.Box3();
  let hasSkin = false, hasMesh = false;
  root.traverse(o => {
    if(o.isBone){
      hasSkin = true;
      const w = o.getWorldPosition(new THREE.Vector3());
      box.expandByPoint(new THREE.Vector3().copy(w).applyMatrix4(rootInv));
    } else if(o.isMesh && o.geometry){
      hasMesh = true;
      if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      m.copy(rootInv).multiply(o.matrixWorld);
      box.union(o.geometry.boundingBox.clone().applyMatrix4(m));
    }
  });
  if(!hasSkin && !hasMesh) box.makeEmpty();
  return box;
}

function geometryBounds(root){
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4();
  let any = false;
  root.traverse(o => {
    if(o.isMesh && o.geometry){
      if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      m.copy(rootInv).multiply(o.matrixWorld);   // mesh-local -> root-local
      box.union(o.geometry.boundingBox.clone().applyMatrix4(m));
      any = true;
    }
  });
  if(!any) box.makeEmpty();
  return box;
}

async function initModel(){
  try{
    const man = await (await fetch('models/manifest.json')).json();
    // `man.file` is relative to the manifest's directory (models/), not the page
    const manDir = 'models/manifest.json'.replace(/[^/]+$/, '');   // 'models/'
    const modelUrl = man.file.startsWith('/') || /^https?:/.test(man.file)
      ? man.file
      : manDir + man.file;
    let scene, clips;
    if(/\.(obj)$/i.test(man.file)){
      // geometry-only fallback (no animations)
      const txt = await (await fetch(modelUrl)).text();
      const g = parseSimpleOBJ(txt);
      scene = g; clips = [];
    } else {
      const gltf = await new Promise((res, rej) =>
        new THREE.GLTFLoader().load(modelUrl, res, undefined, rej));
      scene = gltf.scene || (gltf.scenes && gltf.scenes[0]);
      clips = gltf.animations || [];
    }
    if(!scene) throw new Error('model has no scene');

    const wrap = new THREE.Group();
    if(man.orientation === 'facing-positive-z') scene.rotation.y = Math.PI;
    else if(man.orientation === 'facing-positive-x') scene.rotation.y = -Math.PI/2;
    else if(man.orientation === 'facing-negative-x') scene.rotation.y = Math.PI/2;
    wrap.add(scene);
    wrap.scale.setScalar(man.scale || 1.0);
    tilt.add(wrap);

    // fit + stand on the same baseline as the procedural body.
    // (Bounds are measured in the model's LOCAL space — see geometryBounds —
    //  then scaled to the final size so centering stays exact.)
    wrap.updateMatrixWorld(true);
    const box = fitBounds(scene);        // skeleton-aware bounds
    const size = box.getSize(new THREE.Vector3());
    const targetH = 1.15;                    // procedural body height
    const s = (size.y > 0) ? (targetH / size.y) * (man.scale || 1.0) : (man.scale || 1.0);
    wrap.scale.setScalar(s);
    wrap.updateMatrixWorld(true);
    wrap.position.x = -(box.min.x + box.max.x) * 0.5 * s;
    wrap.position.y = -box.min.y * s;         // feet at y=0 (tilt space)
    wrap.position.z = -(box.min.z + box.max.z) * 0.5 * s;
    _modelBobBase = 0;                        // hover-bob baseline (feet line)

    // flame VFX + jet light (tilt-space, feet baseline) already read as foot jets

    modelState.modelWrap = wrap;
    modelState.anims = clips;
    modelState.ready = true;
    if(clips.length) modelState.mixer = new THREE.AnimationMixer(wrap);

    // choose which body to show
    modelState.active = featOn('model');
    applyBodyVisibility();
    console.log('[model] loaded', man.file, 'clips:', clips.map(c=>c.name).join(','));
  }catch(e){
    console.warn('[model] failed to load model — using procedural body.', e);
    modelState.ready = false;
    modelState.active = false;
    applyBodyVisibility();
  }
}

function applyBodyVisibility(){
  const usingModel = modelState.ready && modelState.active;
  modelState.usingModel = usingModel;
  // procedural body: shown only when NOT using the loaded model
  torso.visible = chest.visible = head.visible = !usingModel;
  armGroups.forEach(a => a.visible = !usingModel);
  // loaded model
  if(modelState.modelWrap) modelState.modelWrap.visible = usingModel;
  // flame VFX + jet light always travel with the body (rocket flight)
  if(flames) flames.visible = true;
  if(jetLight) jetLight.visible = true;
}
// public: called by the feature system / menu when "model" toggles
modelState.useModel = function(v){
  if(!modelState.ready) return;               // procedural body if no model
  modelState.active = !!v;
  applyBodyVisibility();
};
// feature-system hook: re-apply when the "model" flag changes
if(typeof setFeatureHook === 'function') setFeatureHook((id) => {
  if(id === 'model') modelState.useModel(featOn('model'));
});

let _lastClip = null, _lastClipAction = null;
function updateModelAnim(dt, f){
  if(!(modelState.ready && modelState.usingModel)) return;
  if(modelState.mixer){
    modelState.mixer.update(dt);
    // pick a clip from game state: boost/fast -> run, slow -> walk, stop -> idle
    const want = pickClipName(f);
    const clip = modelState.anims.find(c => (c.name||'').toLowerCase() === want.toLowerCase());
    if(clip && clip !== _lastClip){
      const a = modelState.mixer.clipAction(clip);
      if(_lastClipAction) _lastClipAction.fadeOut(0.18);
      a.reset().fadeIn(0.18).play();
      _lastClipAction = a; _lastClip = clip;
    }
  }
  // gentle hover bob at rest (reads as floating, fades out with speed)
  if(modelState.modelWrap && _modelBobBase !== undefined){
    const bob = Math.sin(performance.now()*0.0035) * 0.03 * (1 - Math.min(1, f.speed/MAX_SPEED_CRUISE));
    modelState.modelWrap.position.y = _modelBobBase + bob;
  }
}
let _modelBobBase = undefined;
function pickClipName(f){
  const names = modelState.anims.map(c => (c.name||'').toLowerCase());
  const has = re => names.find(n => re.test(n));
  if(f.speed < 0.6) return has(/^idle$|idle|stand|wait|rest/) || names[0];
  if(f.boost)       return has(/fly|run|boost|fast|sprint/) || has(/walk|run|move/) || names[0];
  return has(/run|walk|move|locomot/) || names[0];
}

// tiny OBJ parser (v / f only) — for the manifest "obj" fallback
function parseSimpleOBJ(txt){
  const verts = [], faces = [];
  for(const line of txt.split('\n')){
    const p = line.trim().split(/\s+/);
    if(p[0]==='v') verts.push(+p[1], +p[2], +p[3]);
    else if(p[0]==='f'){
      const idx = p.slice(1).map(s => parseInt(s.split('/')[0]) - 1);
      for(let i=1;i<idx.length-1;i++) faces.push(idx[0], idx[i], idx[i+1]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(faces, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color:0xb9c4d6}));
  const g = new THREE.Group(); g.add(mesh);
  return g;
}
