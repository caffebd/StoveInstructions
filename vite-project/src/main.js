import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

// ─── State ────────────────────────────────────────────────────────────────────

// Stats tracking
let _statsFrameCount = 0;
let _statsFps = 0;
let _statsLastFpsTime = performance.now();
let _statsLastFrameTime = performance.now();
let _statsDomUpdateTime = 0;

let mixer;
let model;
const actions = {};
const finishedActions = new Set();
let zoomDirection = 0;

const stepNames = [
  'STOVE2-TOP.001Action',
  'STOVE2-CAST-DOOR1.001Action',
  'STOVE2-GRILL-SIDES-1BAR.001Action',
  'STOVE2-ASH-PAN-FRONTAction',
];

const instructions = {
  1: {
    heading: 'Step 1: Lid',
    text: "Gently lift the lid off the stove and set it aside. Removing the lid reduces weight at the top, improving the stove's stability during transport."
  },
  2: {
    heading: 'Step 2: Door',
    text: "Open the door fully, then lift it up and off its hinges to remove it from the stove. Take care not to break the glass. Place the door on a cushioned surface, away from any heavy objects that could impact the glass."
  },
  3: {
    heading: 'Step 3: Log Guard',
    text: "Detach the log guard from the interior of the firebox by lifting it up and tilting it toward you. Set it aside for reassembly."
  },
  4: {
    heading: 'Step 4: Ash Pan',
    text: "Slide the ash pan out from the bottom of the firebox and place it in a secure location."
  }
};

function updateInstructions(step) {
  const heading = document.getElementById('instruction-heading');
  const text = document.getElementById('instruction-text');
  if (step === 0) {
    heading.textContent = 'Ready';
    text.textContent = 'Click any step button below to see product instructions.';
  } else if (instructions[step]) {
    heading.textContent = instructions[step].heading;
    text.textContent = instructions[step].text;
  }
}

// ─── Timer ────────────────────────────────────────────────────────────────────

const timer = new THREE.Timer();
timer.connect(document);

// ─── Container ────────────────────────────────────────────────────────────────

const container = document.getElementById('container');

// ─── Stats Panel ──────────────────────────────────────────────────────────────

document.getElementById('stats-collapse-btn').addEventListener('click', () => {
  const overlay = document.getElementById('stats-overlay');
  const btn = document.getElementById('stats-collapse-btn');
  overlay.classList.toggle('collapsed');
  btn.textContent = overlay.classList.contains('collapsed') ? '\u25b2' : '\u25bc';
});

function updateStats(frameMs) {
  const overlay = document.getElementById('stats-overlay');
  if (overlay.classList.contains('collapsed')) return;

  const info = renderer.info;

  const fpsEl = document.getElementById('stat-fps');
  fpsEl.textContent = _statsFps;
  fpsEl.className = 'stat-value' + (_statsFps >= 50 ? ' good' : _statsFps >= 30 ? '' : ' warn');

  const msEl = document.getElementById('stat-ms');
  msEl.textContent = frameMs.toFixed(1) + ' ms';
  msEl.className = 'stat-value' + (frameMs < 20 ? ' good' : frameMs < 34 ? '' : ' warn');

  document.getElementById('stat-calls').textContent = info.render.calls;
  document.getElementById('stat-tris').textContent = info.render.triangles.toLocaleString();
  document.getElementById('stat-geo').textContent = info.memory.geometries;
  document.getElementById('stat-tex').textContent = info.memory.textures;
  document.getElementById('stat-prog').textContent = info.programs ? info.programs.length : '–';
}

// ─── Scene ────────────────────────────────────────────────────────────────────

const scene = new THREE.Scene();

// ─── Camera ───────────────────────────────────────────────────────────────────

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 100);
camera.position.set(5, 2, 8);

// ─── Device Detection ────────────────────────────────────────────────────────

const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth <= 768;
document.body.classList.toggle('is-mobile', isMobile);

// ─── Renderer ─────────────────────────────────────────────────────────────────




const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
renderer.setPixelRatio(isMobile ? Math.min(window.devicePixelRatio, 2) : window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

// Prevent browser middle-mouse autoscroll icon stealing events from OrbitControls
renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 1) e.preventDefault();
});

const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

if (!isMobile) {
  const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ssaoPass.kernelRadius = 0.5;
  ssaoPass.minDistance = 0.001;
  ssaoPass.maxDistance = 0.1;
  composer.addPass(ssaoPass);

  const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
  composer.addPass(smaaPass);
}

const outputPass = new OutputPass();
composer.addPass(outputPass);

renderer.toneMapping = THREE.NoToneMapping;


// ─── Sky & Environment ────────────────────────────────────────────────────────

const hdri = new HDRLoader();
const envMap = await hdri.loadAsync( '/hdri/brown_photostudio_06_2k.hdr' );
envMap.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = envMap;
scene.environmentRotation.set(0, 36, 0);
// scene.background = envMap;
scene.background = new THREE.Color(0x878787);
scene.backgroundBlurriness = 1;
scene.backgroundIntensity = 0.2;
scene.environmentIntensity = 1.0;

// const skyUniforms = sky.material.uniforms;
// skyUniforms['turbidity'].value = 0;
// skyUniforms['rayleigh'].value = 3;
// skyUniforms['mieDirectionalG'].value = 0.7;
// skyUniforms['cloudElevation'].value = 1;
// skyUniforms['sunPosition'].value.set(-0.8, 0.19, 0.56); // elevation: 11, azimuth: -55

// const pmremGenerator = new THREE.PMREMGenerator(renderer);
// const environment = pmremGenerator.fromScene(sky).texture;
// scene.background = environment;
// scene.environment = environment;


// ─── Controls ─────────────────────────────────────────────────────────────────

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.7, 0);
controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN = 2,
  MIDDLE: THREE.MOUSE.ROTATE = 0,
  RIGHT: THREE.MOUSE.ROTATE
  };
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN,
};
controls.minDistance = 2;
controls.maxDistance = 25;
controls.update();

// ─── Zoom Buttons (desktop only) ─────────────────────────────────────────────

if (!isMobile) {
  const zoomInBtn = document.getElementById('btn-zoom-in');
  const zoomOutBtn = document.getElementById('btn-zoom-out');

  function stopZoom() { zoomDirection = 0; }

  zoomInBtn.addEventListener('mousedown', () => { zoomDirection = 1; });
  zoomOutBtn.addEventListener('mousedown', () => { zoomDirection = -1; });
  window.addEventListener('mouseup', stopZoom);
  zoomInBtn.addEventListener('mouseleave', stopZoom);
  zoomOutBtn.addEventListener('mouseleave', stopZoom);
}

// ─── Model ────────────────────────────────────────────────────────────────────


const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('jsm/libs/draco/gltf/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.load(
  '/gltf/stove.glb',
  (gltf) => {
    model = gltf.scene;
    model.position.set(0, 1, 0);
    model.scale.set(5.0, 5.0, 5.0);
    scene.add(model);

    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
      actions[clip.name] = action;
    });

    console.log('Available actions:', Object.keys(actions));

    document.getElementById('btn-1').addEventListener('click', () => { playStep(0); updateInstructions(1); });
    document.getElementById('btn-2').addEventListener('click', () => { playStep(1); updateInstructions(2); });
    document.getElementById('btn-3').addEventListener('click', () => { playStep(2); updateInstructions(3); });
    document.getElementById('btn-4').addEventListener('click', () => { playStep(3); updateInstructions(4); });
    document.getElementById('btn-reset').addEventListener('click', () => { resetAnimations(); updateInstructions(0); });

    mixer.addEventListener('finished', () => {
      if (isMobile) document.getElementById('instructions-overlay').classList.remove('anim-playing');
    });

    document.getElementById('collapse-btn').addEventListener('click', () => {
      const overlay = document.getElementById('instructions-overlay');
      const btn = document.getElementById('collapse-btn');
      overlay.classList.toggle('collapsed');
      btn.textContent = overlay.classList.contains('collapsed') ? '\u25b2' : '\u25bc';
    });

    renderer.setAnimationLoop(animate);

    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  },
  undefined,
  (error) => { console.error(error); }
);

// ─── Resize ───────────────────────────────────────────────────────────────────

function handleMobileOrientation() {
  const isLandscape = window.innerWidth > window.innerHeight;
  const overlay = document.getElementById('instructions-overlay');
  const btn = document.getElementById('collapse-btn');
  overlay.classList.toggle('collapsed', isLandscape);
  if (btn) btn.textContent = isLandscape ? '\u25b2' : '\u25bc';
}

if (isMobile) handleMobileOrientation();

function doResize(w, h) {
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  if (isMobile) handleMobileOrientation();
}

// ResizeObserver fires after the browser has finished reflowing the container,
// giving accurate dimensions on Android regardless of Chrome/Firefox timing.
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const w = entry.contentRect.width;
    const h = entry.contentRect.height;
    if (w > 0 && h > 0) doResize(w, h);
  }
});
resizeObserver.observe(container);

function jumpToEnd(action) {
  action.reset();
  action.time = action.getClip().duration;
  action.play();
  action.paused = true;
}

function playStep(stepIndex) {
  if (isMobile) document.getElementById('instructions-overlay').classList.add('anim-playing');
  // Snap all prior steps to their final frame
  for (let i = 0; i < stepIndex; i++) {
    const a = actions[stepNames[i]];
    if (a) jumpToEnd(a);
  }
  // Reset all later steps
  for (let i = stepIndex + 1; i < stepNames.length; i++) {
    const a = actions[stepNames[i]];
    if (a) { a.stop(); a.reset(); }
  }
  // Play the requested step
  const action = actions[stepNames[stepIndex]];
  if (!action) {
    console.warn(`Animation "${stepNames[stepIndex]}" not found. Available:`, Object.keys(actions));
    return;
  }
  action.stop();
  action.reset();
  action.play();
}

function resetAnimations() {
  if (isMobile) document.getElementById('instructions-overlay').classList.remove('anim-playing');
  finishedActions.clear();
  Object.values(actions).forEach((action) => {
    action.stop();
    action.reset();
  });
  mixer.stopAllAction();
  model.traverse((child) => {
    if (child.isMesh && child.morphTargetDictionary) {
      child.morphTargetInfluences.forEach((_, i) => {
        child.morphTargetInfluences[i] = 0;
      });
    }
  });
}

// ─── Loop ─────────────────────────────────────────────────────────────────────

function animate() {
  timer.update();

  const delta = timer.getDelta();

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const _now = performance.now();
  const _frameMs = _now - _statsLastFrameTime;
  _statsLastFrameTime = _now;
  _statsFrameCount++;
  if (_now - _statsLastFpsTime >= 1000) {
    _statsFps = Math.round(_statsFrameCount * 1000 / (_now - _statsLastFpsTime));
    _statsFrameCount = 0;
    _statsLastFpsTime = _now;
  }
  if (_now - _statsDomUpdateTime > 250) {
    _statsDomUpdateTime = _now;
    updateStats(_frameMs);
  }

  if (zoomDirection !== 0) {
    const zoomSpeed = 0.012;
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    const newDist = Math.max(controls.minDistance, Math.min(controls.maxDistance,
      offset.length() * (1 - zoomDirection * zoomSpeed)
    ));
    offset.setLength(newDist);
    camera.position.copy(controls.target).add(offset);
  }

  mixer.update(delta);
  controls.update();

  composer.render();
}