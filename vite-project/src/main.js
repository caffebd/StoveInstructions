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

let mixer;
let model;
const actions = {};
const finishedActions = new Set();

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

// ─── Container & Stats ────────────────────────────────────────────────────────

const container = document.getElementById('container');

// const stats = new Stats();
// container.appendChild(stats.dom);

// ─── Scene ────────────────────────────────────────────────────────────────────

const scene = new THREE.Scene();

// ─── Camera ───────────────────────────────────────────────────────────────────

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 100);
camera.position.set(5, 2, 8);

// ─── Renderer ─────────────────────────────────────────────────────────────────




const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 0.5;
ssaoPass.minDistance = 0.001;
ssaoPass.maxDistance = 0.1;
composer.addPass(ssaoPass);

const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
composer.addPass(smaaPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

renderer.toneMapping = THREE.NoToneMapping;


// ─── Sky & Environment ────────────────────────────────────────────────────────

const hdri = new HDRLoader();
const envMap = await hdri.loadAsync( 'src/assets/hdri/brown_photostudio_06_2k.hdr' );
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
  RIGHT: THREE.MOUSE.ZOOM
  };
controls.update();

// ─── Model ────────────────────────────────────────────────────────────────────


const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('jsm/libs/draco/gltf/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.load(
  'src/assets/gltf/stove.glb',
  (gltf) => {
    model = gltf.scene;
    model.position.set(0, 1, 0);
    model.scale.set(5.0, 5.0, 5.0);
    scene.add(model);

    model.traverse((child) => {
      if (child.isMesh) {
        const mats = child.material.forEach ? child.material : [child.material];
        mats.forEach(mat => {
          ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach(prop => {
            if (mat[prop]) {
              mat[prop].wrapS = THREE.RepeatWrapping;
              mat[prop].wrapT = THREE.RepeatWrapping;
              mat[prop].repeat.set(2, 2);
            }
          });
        });
      }
    });

    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
      actions[clip.name] = action;
    });

    console.log('Available actions:', Object.keys(actions));

    document.getElementById('btn-1').addEventListener('click', () => { playAction('Animation1'); updateInstructions(1); });
    document.getElementById('btn-2').addEventListener('click', () => { playAction('Animation2'); updateInstructions(2); });
    document.getElementById('btn-3').addEventListener('click', () => { playAction('Animation3'); updateInstructions(3); });
    document.getElementById('btn-4').addEventListener('click', () => { playAction('Animation4'); updateInstructions(4); });
    document.getElementById('btn-reset').addEventListener('click', () => { resetAnimations(); updateInstructions(0); });

    renderer.setAnimationLoop(animate);

    const animNames = [
      'STOVE2-TOP.001Action',
      'STOVE2-CAST-DOOR1.001Action',
      'STOVE2-GRILL-SIDES-1BAR.001Action',
      'STOVE2-ASH-PAN-FRONTAction',      
    ];

    document.querySelectorAll('#buttons button').forEach((btn, i) => {
      btn.style.cssText = 'padding:10px 20px;font-size:14px;cursor:pointer;background:#fff;border:1px solid #ccc;border-radius:4px;';
      btn.addEventListener('click', () => {
        playAction(animNames[i]);
        updateInstructions(i + 1);
      });
    });
  },
  undefined,
  (error) => { console.error(error); }
);

// ─── Resize ───────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

function playAction(name) {
  const action = actions[name];
  if (!action) {
    console.warn(`Animation "${name}" not found. Available:`, Object.keys(actions));
    return;
  }
  action.reset().play();
  console.log(`Playing: ${name}`);
}

function resetAnimations() {
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

  mixer.update(delta);
  controls.update();

  composer.render();
}