import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ReflectorForSSRPass } from 'three/addons/objects/ReflectorForSSRPass.js';
import { fireVertexShader, fireFragmentShader } from './shaders/fireShader.js';
import { logVertexShader, logFragmentShader } from './shaders/logShader.js';
import { stoveBodyVertexShader, stoveBodyFragmentShader } from './shaders/stoveBodyShader.js';
import { metalVertexShader, metalFragmentShader } from './shaders/metalShader.js';
import { glassVertexShader, glassFragmentShader } from './shaders/glassShader.js';
import { ropeVertexShader, ropeFragmentShader } from './shaders/ropeShader.js';
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';


let currentAction = null;
let playedActions = new Set();


function playAction(name) {
  const nextAction = actions[name];
  if (!nextAction) return;

  // If something was playing before, remove its influence
  // if (currentAction && currentAction !== nextAction) {
  //   currentAction.fadeOut(0.1);           // or: currentAction.stop()
  // }

  nextAction
    .reset()
    .setEffectiveWeight(1)
    .setEffectiveTimeScale(1)
    .fadeIn(0.1)                           // optional but recommended
    .play();

  currentAction = nextAction;

  console.log(`Playing: ${name}`);
}
function playTwoActions(name1, name2) {
  const action1 = actions[name1];
  const action2 = actions[name2];

  if (action1) action1.reset().play();
  if (action2) action2.reset().play();

  console.log(`Playing: ${name1} + ${name2}`);
}
function playMultipleActions(names) {
  names.forEach((name) => {
    const action = actions[name];
    if (action) {
      action.reset();
      action.setEffectiveWeight(1);
      action.play();
    }
  });
}
function playSequence(names) {
  const list = Array.isArray(names) ? names : [names];
  let index = 0;

  function playNext() {
    if (index >= list.length) return;

    const name = list[index];
    const action = actions[name];
    if (!action) {
      index++;
      playNext();
      return;
    }

    action.reset();
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
    action.play();

    const onFinished = (e) => {
      if (e.action === action) {
        mixer.removeEventListener('finished', onFinished);
        index++;
        playNext();
      }
    };

    mixer.addEventListener('finished', onFinished);
  }

  playNext();
}
function playActionLerp(name, t) {
  const action = actions[name];
  if (!action) {
    // console.warn(`Animation "${name}" not found, Available:`, Object.keys(actions));
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
  stats.begin();

  timer.update();

  const delta = timer.getDelta();

customMaterials.forEach(mat => {
  if (mat.uniforms.TIME) {
    mat.uniforms.TIME.value += delta;
  }

  const integrate = (phaseName, speedName, minSpeed = 0.0, maxSpeed = 3.0) => {
    const phaseU = mat.uniforms[phaseName];
    const speedU = mat.uniforms[speedName];
    if (!phaseU || !speedU) return;

    const t = Number(speedU.value);           // expected 0..1 blend
    if (!Number.isFinite(t)) return;

    const speed = minSpeed + (maxSpeed - minSpeed) * t; // lerp
    phaseU.value += delta * speed;
  };

  // one accumulator per effect
  integrate("gradientSpeedDelta",  "gradientSpeed",  0.0, 1.0);
  integrate("vtxNoiseSpeedDelta",  "vtxNoiseSpeed",  0.0, 1.0);
  integrate("fireSpeedDelta",  "fireSpeed",  0.0, 3.0);
  integrate("fireSpeedHDelta",  "fireSpeedH",  0.0, 3.0);
  integrate("fireFlickerSpeedDelta",  "fireFlickerSpeed",  0.0, 20.0);
  integrate("noiseSpeedDelta",  "noiseSpeed",  0.0, 3.0);
});
  
  if (mixer) mixer.update(delta);
  if (controls) controls.update();

  composer.render();

  stats.end();
}
function lerp(a, b, t) {
  return a * (1 - t) + b * t;
}

const animNames = [
  'step_1',      
  'step_2',      
  'step_3',      
  'step_4',      
  'step_5',      
  'step_6',      
  'step_7',      
  'step_8',      
  'step_9',      
  'step_10',      
  'step_11',      
  'positioning_stove',
  'top_outlet_config',
  'rear_outlet_config_1',
  'rear_outlet_config_2',
  'rear_outlet_config_3',
  'flue_cage_install',      
];

const actions = {};
const finishedActions = new Set();
const customMaterials = [];


let mixer;
let model;

const textureLoader = new THREE.TextureLoader();

const noiseTex = textureLoader.load('/assets/textures/fire.png');
noiseTex.flipY = false;
noiseTex.wrapS = THREE.RepeatWrapping;
noiseTex.wrapT = THREE.RepeatWrapping;

const gradientTex = textureLoader.load('/assets/textures/gradient.png');
gradientTex.flipY = false;
gradientTex.wrapS = THREE.RepeatWrapping;
gradientTex.wrapT = THREE.RepeatWrapping;
gradientTex.colorSpace = THREE.SRGBColorSpace;

const logTex = textureLoader.load('/assets/textures/wood.png');
logTex.flipY = false;
logTex.wrapS = THREE.RepeatWrapping;
logTex.wrapT = THREE.RepeatWrapping;
logTex.colorSpace = THREE.SRGBColorSpace;

const stoveMasksAO = textureLoader.load('/assets/textures/stove_masks_AO.png');
stoveMasksAO.flipY = false;
stoveMasksAO.wrapS = THREE.RepeatWrapping;
stoveMasksAO.wrapT = THREE.RepeatWrapping;

const stoveNormals = textureLoader.load('/assets/textures/stove_normals_1.png');
stoveNormals.flipY = false;
stoveNormals.wrapS = THREE.RepeatWrapping;
stoveNormals.wrapT = THREE.RepeatWrapping;

// UNIFORMS & MATERIALS -----------------------------

const stove_insulation_uniforms = {
  stoveMasksAO: { value: stoveMasksAO },
  TIME:           { value: 0.0 },
  lightCol:       { value: new THREE.Color('#ff4400') },
  lightStrength:  { value: 0.0 },
  lightPos:       { value: new THREE.Vector3(0.0, 0.018, 0.0) },
  lightRange:     { value: 0.31 },
  lightFalloff:   { value: 1.27 },
  stoveColA:      { value: new THREE.Color('#cbab87') },
  stoveColB:      { value: new THREE.Color('#8b6e4d') },
  stoveRoughA:    { value: 0.69 },
  stoveRoughB:    { value: 1.0 },
}; 

const stove_insulation_mat = new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial, 
  // specularIntensityMap: stoveMasksAO,
  vertexShader: stoveBodyVertexShader,
  fragmentShader: stoveBodyFragmentShader,
  uniforms: stove_insulation_uniforms,
});

const cast_iron_uniforms = {
  stoveMasksAO: { value: stoveMasksAO },
  TIME:           { value: 0.0 },
  lightCol:       { value: new THREE.Color('#ff4400') },
  lightStrength:  { value: 0.0 },
  lightPos:       { value: new THREE.Vector3(0.0, 0.018, 0.0) },
  lightRange:     { value: 0.31 },
  lightFalloff:   { value: 1.27 },
  stoveColA:      { value: new THREE.Color('#333333') },
  stoveColB:      { value: new THREE.Color('#141414') },
  stoveRoughA:    { value: 0.6 },
  stoveRoughB:    { value: 0.7 },
}; 

const cast_iron_mat = new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial, 
  normalMap: stoveNormals,
  // normalScale: 0.0,
  // specularIntensityMap: stoveMasksAO,
  vertexShader: stoveBodyVertexShader,
  fragmentShader: stoveBodyFragmentShader,
  uniforms: cast_iron_uniforms,
  patchMap: {
  "*": {
    "#include <normal_fragment_maps>": `
      #ifdef USE_NORMALMAP
        vec4 packedNormal = texture2D(normalMap, uv);

        vec2 rg = packedNormal.rg * 2.0 - 1.0;
        vec3 mapN = vec3(rg, 1.0);
        mapN.xy *= normalScale;

        normal = normalize(tbn * mapN);
      #endif
    `
    }
  },
});

const stove_body_uniforms = {
  stoveMasksAO: { value: stoveMasksAO },
  TIME:           { value: 0.0 },
  lightCol:       { value: new THREE.Color('#ff4400') },
  lightStrength:  { value: 0.0 },
  lightPos:       { value: new THREE.Vector3(0.0, 0.018, 0.0) },
  lightRange:     { value: 0.31 },
  lightFalloff:   { value: 1.27 },
  stoveColA:      { value: new THREE.Color('#131313') },
  stoveColB:      { value: new THREE.Color('#131313') },
  stoveRoughA:    { value: 0.6 },
  stoveRoughB:    { value: 0.6 },
}; 

const stove_body_mat = new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial, 
  // normalMap: stoveNormals,
  // specularIntensityMap: stoveMasksAO,
  vertexShader: stoveBodyVertexShader,
  fragmentShader: stoveBodyFragmentShader,
  uniforms: stove_body_uniforms,
  side: THREE.FrontSide,
  vertexColors: true,
});

const rope_mat = new CustomShaderMaterial({
  baseMaterial: THREE.MeshStandardMaterial,
  vertexShader: ropeVertexShader,
  fragmentShader: ropeFragmentShader,
  uniforms: {
    stoveMasksAO: stoveMasksAO,
  },
  normalMap: stoveNormals,
  patchMap: {
  "*": {
    "#include <normal_fragment_maps>": `
      #ifdef USE_NORMALMAP
        vec4 packedNormal = texture2D(normalMap, rotateUV(UV * 250.0, -45.0, vec2(0.5)));

        vec2 ba = packedNormal.ba * 2.0 - 1.0;
        vec3 mapN = vec3(ba, 1.0);
        mapN.rg *= normalScale;

        normal = normalize(tbn * mapN);
      #endif
    `
    }
  },
})

const rubber_mat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#3f3b3b'),
  roughness: 0.8,
})

const brushed_metal_uniforms = {
  TIME: { value: 1.0 },
  stoveMasksAO:   { value: stoveMasksAO },
  maskSelect: { value: 1 },
  stoveColorA: { value: new THREE.Color('#d4d4d4') },
  stoveColorB: { value: new THREE.Color('#acacac') },
  stoveRoughA: { value: 0.341 },
  stoveRoughB: { value: 0.103 },
}

const handle_metal_uniforms = {
  TIME: { value: 1.0 },
  stoveMasksAO:   { value: stoveMasksAO },
  maskSelect: { value: 2 },
  stoveColorA: { value: new THREE.Color('#544d48') },
  stoveColorB: { value: new THREE.Color('#544d48') },
  stoveRoughA: { value: 0.347 },
  stoveRoughB: { value: 0.198 },
}

const brushed_metal_mat = new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial,
  // specularIntensityMap: stoveMasksAO,
  vertexShader: metalVertexShader,
  fragmentShader: metalFragmentShader,
  uniforms: brushed_metal_uniforms,

})

const handle_metal_mat = new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial,
  // specularIntensityMap: stoveMasksAO,
  vertexShader: metalVertexShader,
  fragmentShader: metalFragmentShader,
  uniforms: handle_metal_uniforms,

})

const glass_mat = new THREE.MeshStandardMaterial({
  color: ('#ffffff'),
  transparent: true,
  opacity: 0.02,
  roughness: 0.0,
})


// Scene stuff
const timer = new THREE.Timer();
timer.connect(document);

const container = document.getElementById('container');

const stats = new Stats();
container.appendChild(stats.dom);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(0.5, 0.1, 1.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const ssaoPass = new SSAOPass(
  scene,
  camera,
  window.innerWidth,
  window.innerHeight,
);

// composer.addPass(ssaoPass);

// const bloom = new UnrealBloomPass(
//   new THREE.Vector2(window.innerWidth, window.innerHeight),
//   0.18,   // intensity
//   0.1,   // radius
//   0.8    // threshold
// );

// composer.addPass(bloom);

const outputPass = new OutputPass();
composer.addPass( outputPass );


const rgbe = new HDRLoader();
const envMap = await rgbe.loadAsync('/assets/hdri/brown_photostudio_01_2k.hdr');
envMap.mapping = THREE.EquirectangularReflectionMapping;

scene.environment = envMap;
scene.environmentRotation.set(0, 0, 0);
scene.background = new THREE.Color('#C5BEB6');
scene.backgroundBlurriness = 1;
// scene.backgroundIntensity = 0.9;
scene.environmentIntensity = 0.99;

const axesHelper = new THREE.AxesHelper( 5 );
// scene.add( axesHelper );

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN = 2,
  MIDDLE: THREE.MOUSE.ROTATE = 0,
  RIGHT: THREE.MOUSE.ZOOM
};

controls.update();

renderer.setAnimationLoop(animate);

// GLTF Loader
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.184.0/examples/jsm/libs/draco/gltf/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.load(
  '/assets/gltf/stove.glb',
  (gltf) => {
    model = gltf.scene;
    model.position.set(0, 0, 0);
    scene.add(model);
    
    
    model.traverse((child) => {
      if (!child.isMesh) return;

      const oldMat = child.material;
      oldMat.dispose();

      
      if (child.isMesh) {
        
        if (child.material.name === 'cast_iron') {
          child.material = cast_iron_mat;

        } else if (child.material.name === 'stove_body') {
          child.material = stove_body_mat;
          child.material.dithering = true;

        } else if (child.material.name === 'insulation_surface') {
          child.material = stove_insulation_mat;

        } else if (child.material.name === 'insulation_surface_nolight') {
          child.material = stove_insulation_mat;

        } else if (child.material.name === 'glass') {
          child.material = glass_mat;
          
        } else if (child.material.name === 'rope') {
          child.material = rope_mat;

        } else if (child.material.name === 'rubber') {
          child.material = rubber_mat;

        } else if (child.material.name === 'metal') {
          child.material = brushed_metal_mat;
          
        } else if (child.material.name === 'handle') {
          child.material = handle_metal_mat;
        };

      }
  

    });

    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
      action.enabled = true;              // keep it evaluatable
      actions[clip.name] = action;
      animNames.push(clip.name);
    });
    
    mixer.addEventListener("finished", (e) => {
      e.action.paused = true;             // holds last frame
      e.action.enabled = true;            // keep its pose applied
    });
    
    console.log('Available actions:', Object.keys(actions));

    let animIndex = 0;

    function playByIndex(i) {
      animIndex = (i + animNames.length) % animNames.length; // wrap
      playAction(animNames[animIndex]);
    }
    
    // Initial (optional)
    playByIndex(0);
    
    document.getElementById("prevBtn").addEventListener("click", () => {
      playByIndex(animIndex - 1);
    });
    
    document.getElementById("nextBtn").addEventListener("click", () => {
      playByIndex(animIndex + 1);
    });


    // document.querySelectorAll('#buttons button').forEach((btn, i) => {
    //   btn.style.cssText = 'padding:5px 15px;font-size:15px;cursor:pointer;background:#fff;border:1px solid #ccc;border-radius:4px;';
    //   btn.addEventListener('click', () => {
    //     playAction(animNames[i]);
    //   });
    // });

    // document.querySelector('#btn-12').addEventListener('click', () => {
    //   playSequence(['step_2', 'step_3']);
    // });

    // document.getElementById('btn-12').addEventListener('click', () => {
    //   playTwoActions('step_2', 'step_3');
    // });

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


window.playActionLerp = playActionLerp;
window.actions = actions;
window.customMaterials = customMaterials;
