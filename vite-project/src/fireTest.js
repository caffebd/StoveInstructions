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
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { vertexShader, fragmentShader } from './shaders/fireShader.js';

const textureLoader = new THREE.TextureLoader();
const fireTexture = textureLoader.load('/src/assets/textures/fire.png');
fireTexture.wrapS = THREE.RepeatWrapping;
fireTexture.wrapT = THREE.RepeatWrapping; 

class FireState {
  constructor({
    fireCol = new THREE.Color(1.0, 0.3, 0.1),
    fireSpeed = 1.0,
    fireAmount = 0.758,
    fireDensity = 0.187,
    fireBorderTop = 0.24,
    fireBorderBottom = 0.199,
    fireDirection = 0.5,
    fireSize = 1.0,
    fireStability = 1.0,
    meshDisplaceRange = 0.038,
    meshDisplaceSpeed = 0.081,
    xOffsetDir = 0.0,
    yOffsetDir = 0.0,
    zOffsetDir = 0.0,
    worldUVScale = 15.0
  } = {}) {
    this.fireCol = fireCol;

    this.fireSpeed = fireSpeed;
    this.fireAmount = fireAmount;
    this.fireDensity = fireDensity;
    this.fireBorderTop = fireBorderTop;
    this.fireBorderBottom = fireBorderBottom;
    this.fireDirection = fireDirection;
    this.fireSize = fireSize;
    this.fireStability = fireStability;

    this.meshDisplaceRange = meshDisplaceRange;
    this.meshDisplaceSpeed = meshDisplaceSpeed;

    this.xOffsetDir = xOffsetDir;
    this.yOffsetDir = yOffsetDir;
    this.zOffsetDir = zOffsetDir;

    this.worldUVScale = worldUVScale;
  }
}



let animLerp = 0;
let fireLerp = 0;
let targetLerp = 0;

let mixer;
let model;

const left = new FireState({
  fireCol : new THREE.Color(1.0, 0.3, 0.1),
  fireSpeed : 1.0,
  fireAmount : 0.0,
  fireDensity : 0.187,
  fireBorderTop : 0.24,
  fireBorderBottom : 0.199,
  fireDirection : 0.5,
  fireSize : 1.0,
  fireStability : 1.0,
  meshDisplaceRange : 0.038,
  meshDisplaceSpeed : 0.081,
  xOffsetDir : 0.0,
  yOffsetDir : 0.0,
  zOffsetDir : 0.095,
  worldUVScale : 15.0
});

const middle = new FireState({
  fireCol : new THREE.Color(1.0, 0.3, 0.1),
  fireSpeed : 0.7,
  fireAmount : 0.7,
  fireDensity : 0.7,
  fireBorderTop : 0.2,
  fireBorderBottom : 0.13,
  fireDirection : 0.5,
  fireSize : 0.5,
  fireStability : 0.3,
  meshDisplaceRange : 0.02,
  meshDisplaceSpeed : 0.05,
  xOffsetDir : 0.0,
  yOffsetDir : 0.0,
  zOffsetDir : 0.0,
  worldUVScale : 15.0
});

const right = new FireState({
  fireCol : new THREE.Color(1.0, 0.3, 0.1),
  fireSpeed : 0.3,
  fireAmount : 0.758,
  fireDensity : 0.187,
  fireBorderTop : 0.24,
  fireBorderBottom : 0.199,
  fireDirection : 0.1,
  fireSize : 0.5,
  fireStability : 0.5,
  meshDisplaceRange : 0.038,
  meshDisplaceSpeed : 0.081,
  xOffsetDir : 0.2,
  yOffsetDir : 0.0,
  zOffsetDir : 0.095,
  worldUVScale : 15.0
});

// let blendedState = lerpFireState(left, middle, fireLerp);
let blendedState = lerpThreeStates(left, middle, right, fireLerp);

function buildFireUniforms(state, fireTexture) {
  return {
    fireTex: { value: fireTexture },
    fireCol: { value: state.fireCol.clone() },

    fireSpeed: { value: state.fireSpeed },
    fireAmount: { value: state.fireAmount },
    fireDensity: { value: state.fireDensity },
    fireBorderTop: { value: state.fireBorderTop },
    fireBorderBottom: { value: state.fireBorderBottom },
    fireDirection: { value: state.fireDirection },
    fireSize: { value: state.fireSize },
    fireStability: { value: state.fireStability },

    meshDisplaceRange: { value: state.meshDisplaceRange },
    meshDisplaceSpeed: { value: state.meshDisplaceSpeed },

    xOffsetDir: { value: state.xOffsetDir },
    yOffsetDir: { value: state.yOffsetDir },
    zOffsetDir: { value: state.zOffsetDir },

    worldUVScale: { value: state.worldUVScale }
  };
}

const fireCardsMat = new THREE.ShaderMaterial({
  uniforms: buildFireUniforms(blendedState, fireTexture),
  vertexShader,
  fragmentShader,
  transparent: true,
  side: THREE.DoubleSide,
  alphaTest: 0.5,
  depthWrite: false,
});

const actions = {};
const finishedActions = new Set();
const customMaterials = [];

const timer = new THREE.Timer();
timer.connect(document);

const container = document.getElementById('container');

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 100);
camera.position.set(5, 2, 8);

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
// composer.addPass(ssaoPass);

const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
composer.addPass(smaaPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.2,  // strength
  0.2,  // radius
  0.86  // threshold
);
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

renderer.toneMapping = THREE.NoToneMapping;

const hdri = new HDRLoader();
const envMap = await hdri.loadAsync('src/assets/hdri/brown_photostudio_06_2k.hdr' );
envMap.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = envMap;
scene.environmentRotation.set(0, 36, 0);
scene.background = new THREE.Color(0x878787);
scene.backgroundBlurriness = 1;
scene.backgroundIntensity = 0.2;
scene.environmentIntensity = 1.0;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.7, 0);
controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN = 2,
  MIDDLE: THREE.MOUSE.ROTATE = 0,
  RIGHT: THREE.MOUSE.ZOOM
};
controls.update();

const fireCylindersMat = new THREE.ShaderMaterial({
  uniforms: {
      fireTex: { value: fireTexture },
      fireCol: { value: new THREE.Color(1.0, 0.3, 0.1)},
      fireSpeed: { value : 1.0},
      fireAmount: { value : 0.758},
      fireDensity: { value : 0.187},
      fireBorderTop: { value : 0.24},
      fireBorderBottom: { value : 0.199},
      fireDirection: { value : 0.5},
      fireSize: { value : 1.0},
      fireStability: { value : 1.0},
      meshDisplaceRange: { value : 0.02},
      meshDisplaceSpeed: { value : 0.081},
      xOffsetDir: { value : 0.0},
      yOffsetDir: { value : 0.0},
      zOffsetDir: { value : 0.0},
      worldUVScale: { value : 15.0},
  },
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
  transparent: true,
  side: THREE.DoubleSide,
  alphaTest: 0.5,
  depthWrite: false,
  // blending: THREE.AdditiveBlending
});

const fireCards_a = new Set([
  'fire_card_01',
  'fire_card_02',
  'fire_card_03',
  'fire_card_04'
]);

const fireCylinders_a = new Set([
  'fire_cylinders_01'
]);


const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('jsm/libs/draco/gltf/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.load(
  'src/assets/gltf/stoveWithFire.glb',
  (gltf) => {
    model = gltf.scene;
    model.position.set(0, 0, 0);
    model.scale.set(5.0, 5.0, 5.0);
    // model.rotation.set(0.0, 180.0, 0.0);
    scene.add(model);

    model.traverse((child) => {
      if (child.isMesh && fireCards_a.has(child.name)) {
        console.log('Applying fire shader to:', child.name);
        const newMat = fireCardsMat.clone();
        newMat.vertexColors = true;
        newMat.uniforms.TIME = { value: 0 };
        newMat.uniforms.fireTex = { value: fireTexture };
        child.material = newMat;
        customMaterials.push(newMat);
      }
    });

    model.traverse((child) => {
      if (child.isMesh && fireCylinders_a.has(child.name)) {
        console.log('Applying fire shader to:', child.name);
        const newMat = fireCylindersMat.clone();
        newMat.vertexColors = true;
        newMat.uniforms.TIME = { value: 0 };
        newMat.uniforms.fireTex = { value: fireTexture };
        child.material = newMat;
        customMaterials.push(newMat);
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

    renderer.setAnimationLoop(animate);

    const animNames = [
      'stove_top',
      'stove_door',
      'stove_grill',
      'stove_lever',
      // 'stove_ashpan'      
    ];

    document.querySelectorAll('#buttons button').forEach((btn, i) => {
      btn.style.cssText = 'padding:10px 20px;font-size:14px;cursor:pointer;background:#fff;border:1px solid #ccc;border-radius:4px;';
      btn.addEventListener('click', () => {
        playAction(animNames[i]);
      });
    });

    document.getElementById('btn-left').addEventListener('click', () => {
      setTarget(0);
      // console.log(fireLerp);
    });
    document.getElementById('btn-middle').addEventListener('click', () => {
      setTarget(0.5);
      // console.log(fireLerp);
    });
    document.getElementById('btn-right').addEventListener('click', () => {
      setTarget(1);
      // console.log(fireLerp);
    });

  
  },
  undefined,
  (error) => { console.error(error); }
);

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

function playActionLerp(name, t) {
  const action = actions[name];
  if (!action) {
    console.warn(`Animation "${name}" not found, Available:`, Object.keys(actions));
    return;
  }

  const clip = action.getClip();
  const duration = clip.duration;

  action.play();
  action.paused = true;

  action.time = t * duration;

  mixer.update(0);
}

function resetAnimations() {
  finishedActions.clear();
  Object.values(actions).forEach((action) => {
    action.stop();
    action.reset();
  });
  if (mixer) mixer.stopAllAction();
  if (model) model.traverse((child) => {
    if (child.isMesh && child.morphTargetDictionary) {
      child.morphTargetInfluences.forEach((_, i) => {
        child.morphTargetInfluences[i] = 0;
      });
    }
  });
}

function animate() {
  timer.update();

  const delta = timer.getDelta();

  updateLerp(delta);
    

  customMaterials.forEach(mat => {
    if (mat.uniforms.TIME) {
      mat.uniforms.TIME.value += delta;
    }
  });
  
  if (mixer) mixer.update(delta);
  controls.update();

  composer.render();
}

function setTarget(value) {
  targetLerp = value;
}

function updateLerp(time) {
  if (Math.abs(targetLerp - animLerp) > 0.001) {
    const animSpeed = 0.5;
    const fireSpeed = 0.2;

    animLerp += (targetLerp - animLerp) * animSpeed * time;
    fireLerp += (targetLerp - fireLerp) * fireSpeed * time;

    // blendedState = lerpFireState(left, middle, fireLerp);
    blendedState = lerpThreeStates(left, middle, right, fireLerp);
    customMaterials.forEach(mat => {
      mat.uniforms.fireCol.value.copy(blendedState.fireCol);                                                                                                                               
      mat.uniforms.fireSpeed.value = blendedState.fireSpeed;                                                                                                                        
      mat.uniforms.fireAmount.value = blendedState.fireAmount;
      mat.uniforms.fireDensity.value = blendedState.fireDensity;                                                                                                                     
      mat.uniforms.fireBorderTop.value = blendedState.fireBorderTop;                                                                                                                
      mat.uniforms.fireBorderBottom.value = blendedState.fireBorderBottom;                                                                                                      
      mat.uniforms.fireDirection.value = blendedState.fireDirection;                                                                                                              
      mat.uniforms.fireSize.value = blendedState.fireSize;
      mat.uniforms.fireStability.value = blendedState.fireStability;                                                                                                                 
      mat.uniforms.meshDisplaceRange.value = blendedState.meshDisplaceRange;                                                                                                         
      mat.uniforms.meshDisplaceSpeed.value = blendedState.meshDisplaceSpeed;
      mat.uniforms.xOffsetDir.value = blendedState.xOffsetDir;
      mat.uniforms.yOffsetDir.value = blendedState.yOffsetDir;
      mat.uniforms.zOffsetDir.value = blendedState.zOffsetDir;
      mat.uniforms.worldUVScale.value = blendedState.worldUVScale;
    });
    
    playActionLerp('stove_lever', animLerp);
    
  }
}

function lerp(a, b, t) {
  return a * (1 - t) + b * t;
}
function lerpFireState(a, b, t) {
  const result = new FireState();

  result.fireCol = a.fireCol.clone().lerp(b.fireCol, t);

  result.fireSpeed = lerp(a.fireSpeed, b.fireSpeed, t);
  result.fireAmount = lerp(a.fireAmount, b.fireAmount, t);
  result.fireDensity = lerp(a.fireDensity, b.fireDensity, t);
  result.fireBorderTop = lerp(a.fireBorderTop, b.fireBorderTop, t);
  result.fireBorderBottom = lerp(a.fireBorderBottom, b.fireBorderBottom, t);
  result.fireDirection = lerp(a.fireDirection, b.fireDirection, t);
  result.fireSize = lerp(a.fireSize, b.fireSize, t);
  result.fireStability = lerp(a.fireStability, b.fireStability, t);

  result.meshDisplaceRange = lerp(a.meshDisplaceRange, b.meshDisplaceRange, t);
  result.meshDisplaceSpeed = lerp(a.meshDisplaceSpeed, b.meshDisplaceSpeed, t);

  result.xOffsetDir = lerp(a.xOffsetDir, b.xOffsetDir, t);
  result.yOffsetDir = lerp(a.yOffsetDir, b.yOffsetDir, t);
  result.zOffsetDir = lerp(a.zOffsetDir, b.zOffsetDir, t);

  result.worldUVScale = lerp(a.worldUVScale, b.worldUVScale, t);

  return result;
}
function lerpThreeStates(left, middle, right, t) {
  if (t <= 0.5) {
    const localT = t * 2.0;
    return lerpFireState(left, middle, localT);
  } else {
    const localT = (t - 0.5) * 2.0;
    return lerpFireState(middle, right, localT);
  }
}


window.playActionLerp = playActionLerp;
window.actions = actions;
window.customMaterials = customMaterials;