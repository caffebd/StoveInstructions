import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ReflectorForSSRPass } from 'three/addons/objects/ReflectorForSSRPass.js';
import { fireVertexShader, fireFragmentShader } from './shaders/fireShader.js';
import { logVertexShader, logFragmentShader } from './shaders/logShader.js';
import { stoveBodyVertexShader, stoveBodyFragmentShader } from './shaders/stoveBodyShader.js';
import { metalVertexShader, metalFragmentShader } from './shaders/metalShader.js';
import { glassVertexShader, glassFragmentShader } from './shaders/glassShader.js';
import { ropeVertexShader, ropeFragmentShader } from './shaders/ropeShader.js';
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { cameraValues } from './cameraValues.js';


let currentAction = null;
let playedActions = new Set();
let activeCameraMoveToken = 0;
let initialViewState = null;
const MOBILE_CAMERA_DISTANCE_MULTIPLIER = 1.14;
const MOBILE_CAMERA_STEP_OVERRIDES = {
  installation: {
    step_3: {
      distanceMultiplier: 1.4,
      targetOffset: [-0.16, 0.0, 0.0],
    },
    rear_outlet_config_4: {
      distanceMultiplier: 1.18,
      targetOffset: [0.25, 0.0, 0.0],
    },
  },
};

function isMobileViewport() {
  return window.innerWidth <= 768;
}

function getControlsEnabledBaseline() {
  return initialViewState?.controlsEnabled ?? true;
}

function getMobileCameraAdjustment(setName, stepName, endQuaternion) {
  if (!isMobileViewport()) {
    return {
      distanceMultiplier: 1,
      targetOffset: new THREE.Vector3(0, 0, 0),
      positionOffset: new THREE.Vector3(0, 0, 0),
    };
  }

  const stepOverride = MOBILE_CAMERA_STEP_OVERRIDES[setName]?.[stepName] ?? {};
  const distanceMultiplier = stepOverride.distanceMultiplier ?? MOBILE_CAMERA_DISTANCE_MULTIPLIER;
  const localTargetOffset = stepOverride.targetOffset ?? [0, 0, 0];
  const localPositionOffset = stepOverride.positionOffset ?? [0, 0, 0];
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(endQuaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(endQuaternion);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(endQuaternion);

  const targetOffset = right.clone().multiplyScalar(localTargetOffset[0])
    .add(up.clone().multiplyScalar(localTargetOffset[1]))
    .add(forward.clone().multiplyScalar(localTargetOffset[2]));
  const positionOffset = right.clone().multiplyScalar(localPositionOffset[0])
    .add(up.clone().multiplyScalar(localPositionOffset[1]))
    .add(forward.clone().multiplyScalar(localPositionOffset[2]));

  return {
    distanceMultiplier,
    targetOffset,
    positionOffset,
  };
}

function normalizeRotationComponent(value) {
  return THREE.MathUtils.degToRad(value);
}

function normalizeRotation(rotation) {
  return new THREE.Euler(
    normalizeRotationComponent(rotation.x),
    normalizeRotationComponent(rotation.y),
    normalizeRotationComponent(rotation.z),
    rotation.order || 'XYZ'
  );
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function round6(value) {
  return Number(value.toFixed(6));
}

function formatVector3(vec) {
  return `${round6(vec.x)}, ${round6(vec.y)}, ${round6(vec.z)}`;
}

function eulerToDegrees(euler) {
  return new THREE.Euler(
    round6(THREE.MathUtils.radToDeg(euler.x)),
    round6(THREE.MathUtils.radToDeg(euler.y)),
    round6(THREE.MathUtils.radToDeg(euler.z)),
    euler.order
  );
}

function formatStepSnippet(stepName, position, rotationDeg) {
  return `${stepName}: {\n  position: new THREE.Vector3(${formatVector3(position)}),\n  rotation: new THREE.Euler(${round6(rotationDeg.x)}, ${round6(rotationDeg.y)}, ${round6(rotationDeg.z)}),\n},`;
}

function getModelFocusPoint() {
  if (!model) return new THREE.Vector3(0, 0, 0);
  const bounds = new THREE.Box3().setFromObject(model);
  if (bounds.isEmpty()) return model.position.clone();
  return bounds.getCenter(new THREE.Vector3());
}

function captureCameraSnapshot(setKey, stepName) {

  const position = camera.position.clone();
  const rotationRad = camera.rotation.clone();
  const rotationDeg = eulerToDegrees(rotationRad);
  const quaternion = camera.quaternion.clone();
  const target = controls ? controls.target.clone() : getModelFocusPoint();
  const distanceToTarget = position.distanceTo(target);

  const snapshot = {
    set: setKey,
    step: stepName,
    position: {
      x: round6(position.x),
      y: round6(position.y),
      z: round6(position.z),
    },
    rotationRadians: {
      x: round6(rotationRad.x),
      y: round6(rotationRad.y),
      z: round6(rotationRad.z),
      order: rotationRad.order,
    },
    rotationDegrees: {
      x: round6(rotationDeg.x),
      y: round6(rotationDeg.y),
      z: round6(rotationDeg.z),
      order: rotationDeg.order,
    },
    quaternion: {
      x: round6(quaternion.x),
      y: round6(quaternion.y),
      z: round6(quaternion.z),
      w: round6(quaternion.w),
    },
    target: {
      x: round6(target.x),
      y: round6(target.y),
      z: round6(target.z),
    },
    distanceToTarget: round6(distanceToTarget),
    zoom: round6(camera.zoom),
    fov: round6(camera.fov),
    near: round6(camera.near),
    far: round6(camera.far),
  };

  const stepSnippet = formatStepSnippet(stepName, position, rotationDeg);
  const setStepCommand = `cameraValues.setStep('${setKey}', '${stepName}', { position: [${formatVector3(position)}], rotation: [${round6(rotationDeg.x)}, ${round6(rotationDeg.y)}, ${round6(rotationDeg.z)}] });`;

  console.group(`[Camera Snapshot] ${setKey} / ${stepName}`);
  console.log('Snapshot object:', snapshot);
  console.log('Step snippet:');
  console.log(stepSnippet);
  console.log('Set command:');
  console.log(setStepCommand);
  console.groupEnd();

  return { snapshot, stepSnippet, setStepCommand };
}

function createCameraCapturePanel({ getSetKey, getStepName }) {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position: fixed',
    'bottom: 20px',
    'left: 20px',
    'z-index: 9999',
    'display: flex',
    'flex-direction: column',
    'gap: 6px',
    'padding: 8px',
    'border-radius: 8px',
    'background: rgba(16,16,16,0.78)',
    'backdrop-filter: blur(4px)',
    'font-family: sans-serif',
  ].join(';');

  const label = document.createElement('div');
  label.textContent = 'Camera Capture';
  label.style.cssText = 'color:#fff;font-size:12px;';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'step name (optional)';
  input.style.cssText = 'font-size:12px;padding:6px;border-radius:6px;border:none;min-width:170px;';

  const button = document.createElement('button');
  button.textContent = 'Capture (K)';
  button.style.cssText = 'font-size:12px;padding:6px 10px;border:none;border-radius:6px;background:#3b78e7;color:#fff;cursor:pointer;';

  const hint = document.createElement('div');
  hint.textContent = 'Logs step snippet to console';
  hint.style.cssText = 'color:#cfcfcf;font-size:11px;';

  const runCapture = () => {
    const raw = input.value.trim();
    const stepName = raw || getStepName() || 'step_custom';
    const setKey = getSetKey();
    captureCameraSnapshot(setKey, stepName);
  };

  button.addEventListener('click', runCapture);

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea') return;
    if (e.repeat) return;
    if (e.code === 'KeyK') {
      runCapture();
    }
  });

  panel.appendChild(label);
  panel.appendChild(input);
  panel.appendChild(button);
  panel.appendChild(hint);
  document.body.appendChild(panel);
  panel.style.display = 'none';
}

function moveCameraToStep(setName, stepName, durationMs = 668) {
  const stepCamera = cameraValues.getStep(setName, stepName);
  if (!stepCamera) return Promise.resolve(false);

  const token = ++activeCameraMoveToken;
  const startPosition = camera.position.clone();
  const endPosition = stepCamera.position.clone();
  const endRotation = normalizeRotation(stepCamera.rotation);
  const endQuaternion = new THREE.Quaternion().setFromEuler(endRotation);

  const hasControls = !!controls;
  const startTarget = hasControls ? controls.target.clone() : null;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(endQuaternion);
  const targetDistance = hasControls ? Math.max(camera.position.distanceTo(controls.target), 1) : 1;
  const baseEndTarget = endPosition.clone().addScaledVector(forward, targetDistance);
  const mobileAdjustment = getMobileCameraAdjustment(setName, stepName, endQuaternion);
  const endTarget = baseEndTarget.clone().add(mobileAdjustment.targetOffset);
  const endCameraVector = endPosition.clone().sub(baseEndTarget)
    .multiplyScalar(mobileAdjustment.distanceMultiplier);
  const adjustedEndPosition = endTarget.clone()
    .add(endCameraVector)
    .add(mobileAdjustment.positionOffset);
  const startQuaternion = hasControls ? null : camera.quaternion.clone();

  if (hasControls) controls.enabled = false;

  return new Promise((resolve) => {
    const startTime = performance.now();

    const tick = (now) => {
      if (token !== activeCameraMoveToken) {
        if (hasControls) controls.enabled = getControlsEnabledBaseline();
        resolve(false);
        return;
      }

      const t = Math.min((now - startTime) / durationMs, 1);
      const eased = easeOutCubic(t);

      camera.position.lerpVectors(startPosition, adjustedEndPosition, eased);

      if (hasControls) {
        controls.target.lerpVectors(startTarget, endTarget, eased);
        controls.update();
      } else {
        camera.quaternion.copy(startQuaternion).slerp(endQuaternion, eased);
      }

      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }

      if (hasControls) {
        controls.target.copy(endTarget);
        controls.enabled = getControlsEnabledBaseline();
        controls.update();
      }

      resolve(true);
    };

    requestAnimationFrame(tick);
  });
}

function captureInitialViewState() {
  initialViewState = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    target: controls ? controls.target.clone() : null,
    controlsEnabled: controls ? controls.enabled : false,
  };
}

function restoreInitialViewState() {
  activeCameraMoveToken++;

  if (!initialViewState) return;

  camera.position.copy(initialViewState.position);

  if (controls && initialViewState.target) {
    controls.target.copy(initialViewState.target);
    controls.enabled = initialViewState.controlsEnabled;
    controls.update();
  } else {
    camera.quaternion.copy(initialViewState.quaternion);
  }
}


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
  
  if (mixer) mixer.update(delta);
  if (controls) controls.update();

  if (scene.environmentRotation) {
    scene.environmentRotation.set(
      camera.rotation.x + environmentBaseRotation.x,
      camera.rotation.y + environmentBaseRotation.y,
      camera.rotation.z + environmentBaseRotation.z,
      camera.rotation.order
    );
  }

  composer.render();

  stats.end();
}
function lerp(a, b, t) {
  return a * (1 - t) + b * t;
}

const instructionCopyBySet = {
  unpacking: {
    step_2: {
      stepNumber: 2,
      title: 'Lid',
      bullets: [
        "Gently lift the lid off the stove and set it aside. Removing the lid reduces weight at the top, improving the stove's stability during transport.",
      ],
    },
    step_3: {
      stepNumber: 3,
      title: 'Door',
      bullets: [
        'Open the door fully, then lift it up and off its hinges to remove it from the stove.',
        'Take care not to break the glass. Place the door on a cushioned surface, away from any heavy objects that could impact the glass.',
      ],
    },
    step_4: {
      stepNumber: 4,
      title: 'Log Guard',
      bullets: [
        'Detach the log guard from the interior of the firebox by lifting it up and tilting it toward you. Set it aside for reassembly.',
      ],
    },
    step_5: {
      stepNumber: 5,
      title: 'Ash Pan',
      bullets: [
        'Slide the ash pan out from the bottom of the firebox and place it in a secure location.',
      ],
    },
    step_6: {
      stepNumber: 6,
      title: 'Baffle Brick',
      bullets: [
        'To remove the baffle brick, lift it up at the front to expose the two supporting pins.',
        'Remove these pins, then carefully slide the baffle brick toward you. Place it aside for later reassembly.',
      ],
    },
    step_7: {
      stepNumber: 7,
      title: 'Lining Bricks',
      bullets: [
        'Remove the side bricks first, followed by the back bricks. Handle these bricks with care as they can be fragile.',
      ],
    },
    step_8: {
      stepNumber: 8,
      title: 'Grate',
      bullets: [
        "Lift the grate up and out of the firebox. Set it aside to further reduce the stove's weight.",
      ],
    },
    step_9: {
      stepNumber: 9,
      title: 'Convection Side Panels',
      bullets: [
        'Detach the convection side panels (if applicable) by unscrewing the fasteners at the top of the stove.',
        'Slide the panels up to remove them completely.',
      ],
    },
    step_10: {
      stepNumber: 10,
      title: 'Heat Shield',
      bullets: [
        'Carefully remove the heat shield (if applicable) by unscrewing its fasteners and setting it aside for re-installation.',
      ],
    },
    step_11: {
      stepNumber: 11,
      title: 'Blanking Plate',
      bullets: [
        'Carefully remove the blanking plate (if applicable) by unscrewing its fasteners and setting it aside for re-installation.',
      ],
    },
  },
  installation: {
    step_3: {
      stepNumber: 1,
      title: 'Door',
      bullets: [
        'Open the door fully, then lift it up and off its hinges to remove it from the stove.',
        'Take care not to break the glass. Place the door on a cushioned surface, away from any heavy objects that could impact the glass.',
      ],
    },
    step_6: {
      stepNumber: 2,
      title: 'Baffle Brick',
      bullets: [
        'To remove the baffle brick, lift it up at the front to expose the two supporting pins.',
        'Remove these pins, then carefully slide the baffle brick toward you. Place it aside for later reassembly.',
      ],
    },
    step_10: {
      stepNumber: 3,
      title: 'Heat Shield',
      bullets: [
        'Carefully remove the heat shield (if applicable) by unscrewing its fasteners and setting it aside for re-installation.',
      ],
    },
    step_11: {
      stepNumber: 4,
      title: 'Blanking Plate',
      bullets: [
        'Carefully remove the blanking plate (if applicable) by unscrewing its fasteners and setting it aside for re-installation.',
      ],
    },
    positioning_stove: {
      stepNumber: 5,
      title: 'Positioning and Levelling the Stove',
      bullets: [
        'Level the stove on the hearth by adjusting the hex screws on the base.',
      ],
    },
    top_outlet_config: {
      stepNumber: 6,
      title: 'Top Outlet Configuration',
      bullets: [
        'The flue collar and blanking plate positions can be adjusted based on installation requirements. Each part features a ceramic gasket to ensure a proper seal.',
        'Position the flue collar over the top outlet. Install the M6 flanged bolts through the keyhole slots in the collar.',
        'Align the ceramic gasket between the flue collar and the appliance. Twist the collar slightly to lock it into position. Fully tighten the bolts to secure the flue collar in place.',
      ],
    },
    rear_outlet_config_1: {
      stepNumber: 7,
      title: 'Rear Outlet Configuration',
      bullets: [
        'Position the flue collar over the rear outlet, ensuring the ceramic gasket is placed between the collar and the appliance.',
        'Bolt the flue collar securely in place. Make sure to tighten the bolts on the flue collar to ensure a proper seal.',
      ],
    },
    rear_outlet_config_2: {
      stepNumber: 8,
      title: 'Levelling Disk',
      bullets: [
        'Remove the M6 flanged bolt from the centre of the blanking plate and from the top of the appliance.',
        'Before installation, remove the locking nut from the top plate levelling disk. Install the levelling disk into the top opening and adjust it to be flush with the top plate.',
      ],
    },
    rear_outlet_config_3: {
      stepNumber: 9,
      title: 'Levelling Disk',
      bullets: [
        'Reattach the locking nut from inside the appliance and tighten it to securely hold the levelling disk in place.',
      ],
    },
    rear_outlet_config_4: {
      stepNumber: 10,
      title: 'Heat Shield Disk',
      bullets: [
        'Remove the circular disk from the heat shield and then reinstall the heat shield.',
      ],
    },
    flue_cage_install: {
      stepNumber: 11,
      title: 'Flue Cage Installation',
      bullets: [
        'Align the flue cage into position over the flue outlet. Secure it in place by bolting it up into the spacing bolt.',
        'Ensure all bolts are fully tightened to keep the flue cage securely in position.',
      ],
    },
  },
};

const bookletMaxStepBySet = Object.fromEntries(
  Object.entries(instructionCopyBySet).map(([key, steps]) => [
    key,
    Object.values(steps).reduce((max, item) => Math.max(max, item.stepNumber ?? 0), 0),
  ])
);

function prettifyStepName(stepName) {
  if (!stepName) return 'Instruction';
  return stepName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function createInstructionPanelController() {
  const panel = document.getElementById('instruction-panel');
  const header = document.getElementById('instruction-panel-header');
  const stepLabel = document.getElementById('instruction-step-label');
  const title = document.getElementById('instruction-title');
  const bullets = document.getElementById('instruction-bullets');
  const collapseBtn = document.getElementById('instruction-collapse-btn');

  if (!panel || !header || !stepLabel || !title || !bullets || !collapseBtn) {
    return {
      update: () => {},
    };
  }

  let isCollapsed = false;
  let dragPointerId = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function setCollapsed(nextCollapsed) {
    isCollapsed = nextCollapsed;
    panel.classList.toggle('collapsed', isCollapsed);
    collapseBtn.textContent = isCollapsed ? 'Expand' : 'Collapse';
    collapseBtn.setAttribute('aria-expanded', String(!isCollapsed));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function startDrag(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('button')) return;

    const rect = panel.getBoundingClientRect();
    dragPointerId = event.pointerId;
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    panel.classList.add('dragging');

    const computed = window.getComputedStyle(panel);
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = 'auto';
    panel.style.transform = 'none';
    if (computed.bottom !== 'auto') {
      panel.style.bottom = 'auto';
    }

    header.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function onDrag(event) {
    if (dragPointerId !== event.pointerId) return;

    const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
    const nextLeft = clamp(event.clientX - dragOffsetX, 8, maxLeft);
    const nextTop = clamp(event.clientY - dragOffsetY, 8, maxTop);

    panel.style.left = `${nextLeft}px`;
    panel.style.top = `${nextTop}px`;
  }

  function stopDrag(event) {
    if (dragPointerId !== event.pointerId) return;
    header.releasePointerCapture?.(event.pointerId);
    dragPointerId = null;
    panel.classList.remove('dragging');
  }

  collapseBtn.addEventListener('click', () => {
    setCollapsed(!isCollapsed);
  });

  header.addEventListener('pointerdown', startDrag);
  header.addEventListener('pointermove', onDrag);
  header.addEventListener('pointerup', stopDrag);
  header.addEventListener('pointercancel', stopDrag);

  function update({ stepText, titleText, bulletItems }) {
    stepLabel.textContent = stepText;
    title.textContent = titleText;
    bullets.innerHTML = '';

    bulletItems.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      bullets.appendChild(li);
    });
  }

  setCollapsed(window.innerWidth <= 768);

  return {
    update,
  };
}

const instructionPanel = createInstructionPanelController();

const animationSets = [
  {
    key: 'unpacking',
    label: 'Unpacking',
    animations: [
      // 'step_1',
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
      
    ],
  },
  {
    key: 'installation',
    label: 'Installation',
    animations: [
      'step_3',
      'step_6',
      'step_10',
      'step_11',
      'positioning_stove',
      'top_outlet_config',
      'rear_outlet_config_1',
      'rear_outlet_config_2',
      'rear_outlet_config_3',
      'rear_outlet_config_4',
      'flue_cage_install',
    ],
  },
];

const animNames = [];
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

const dataPanelTex = textureLoader.load('/assets/textures/data_plate.png');
logTex.flipY = false;
logTex.wrapS = THREE.RepeatWrapping;
logTex.wrapT = THREE.RepeatWrapping;
logTex.colorSpace = THREE.SRGBColorSpace;

const stoveMasks = textureLoader.load('/assets/textures/stove_masks.png');
stoveMasks.flipY = false;
stoveMasks.wrapS = THREE.RepeatWrapping;
stoveMasks.wrapT = THREE.RepeatWrapping;

const stoveNormals = textureLoader.load('/assets/textures/stove_normals_1.png');
stoveNormals.flipY = false;
stoveNormals.wrapS = THREE.RepeatWrapping;
stoveNormals.wrapT = THREE.RepeatWrapping;

const stoveAO = textureLoader.load('/assets/textures/stove_separate_ao.png');
stoveAO.flipY = false;

// STOVE BODY --------------------------

const stove_insulation_uniforms = {
  stoveMasks: { value: stoveMasks },
  stoveAO: { value: stoveAO },
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
  specularIntensityMap: stoveAO,
  vertexShader: stoveBodyVertexShader,
  fragmentShader: stoveBodyFragmentShader,
  uniforms: stove_insulation_uniforms,
});

const cast_iron_uniforms = {
  stoveMasks: { value: stoveMasks },
  stoveAO: { value: stoveAO },
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
  specularIntensityMap: stoveAO,
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
  stoveMasks: { value: stoveMasks },
  stoveAO: { value: stoveAO },
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
  specularIntensityMap: stoveAO,
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
    stoveMasks: stoveMasks,
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

const metal_uniforms = {
  TIME: { value: 1.0 },
  stoveMasks:   { value: stoveMasks },
  stoveAO: { value: stoveAO },
  maskSelect: { value: 1 },
  stoveColorA: { value: new THREE.Color('#959595') },
  stoveColorB: { value: new THREE.Color('#959595') },
  stoveRoughA: { value: 0.15 },
  stoveRoughB: { value: 0.15 },
}

const metal_mat = new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial,
  specularIntensityMap: stoveAO,
  vertexShader: metalVertexShader,
  fragmentShader: metalFragmentShader,
  uniforms: metal_uniforms,

})

const brushed_metal_uniforms = {
  TIME: { value: 1.0 },
  stoveMasks:   { value: stoveMasks },
  stoveAO: { value: stoveAO },
  maskSelect: { value: 1 },
  stoveColorA: { value: new THREE.Color('#959595') },
  stoveColorB: { value: new THREE.Color('#888888') },
  stoveRoughA: { value: 0.341 },
  stoveRoughB: { value: 0.103 },
}

const brushed_metal_mat = new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial,
  specularIntensityMap: stoveAO,
  vertexShader: metalVertexShader,
  fragmentShader: metalFragmentShader,
  uniforms: brushed_metal_uniforms,

})

const handle_metal_uniforms = {
  TIME: { value: 1.0 },
  stoveMasks:   { value: stoveMasks },
  stoveAO: { value: stoveAO },
  maskSelect: { value: 2 },
  stoveColorA: { value: new THREE.Color('#544d48') },
  stoveColorB: { value: new THREE.Color('#544d48') },
  stoveRoughA: { value: 0.347 },
  stoveRoughB: { value: 0.198 },
}

const handle_metal_mat = new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial,
  specularIntensityMap: stoveAO,
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
const clock = new THREE.Clock();
const timer = {
  update() {},
  getDelta() {
    return clock.getDelta();
  },
};

const container = document.getElementById('container');

const stats = new Stats();
container.appendChild(stats.dom);
stats.dom.style.position = 'absolute';
stats.dom.style.top = '10px';
stats.dom.style.right = '10px';
stats.dom.style.left = 'auto';
stats.dom.style.display = 'none';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(0.5, 0.1, 1.5);

const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

composer.setSize(window.innerWidth, window.innerHeight);

const ssaoPass = new SSAOPass(
  scene,
  camera,
  window.innerWidth,
  window.innerHeight,
);

ssaoPass.kernelRadius = 0.5;
ssaoPass.minDistance = 0.001;
ssaoPass.maxDistance = 0.1;

composer.addPass(ssaoPass);

// const bloom = new UnrealBloomPass(
//   new THREE.Vector2(window.innerWidth, window.innerHeight),
//   0.18,   // intensity
//   0.1,   // radius
//   0.8    // threshold
// );

// composer.addPass(bloom);

const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
composer.addPass(smaaPass);

const outputPass = new OutputPass();
composer.addPass( outputPass );


const rgbe = new RGBELoader();
rgbe.load(
  '/assets/hdri/brown_photostudio_01_2k.hdr',
  (envMap) => {
    envMap.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = envMap;
  },
  undefined,
  (error) => {
    console.error('Failed to load HDR environment map for stoveInstructions:', error);
  }
);
const environmentBaseRotation = new THREE.Euler(0, 0, 0);
scene.environmentRotation.copy(environmentBaseRotation);
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

      child.material.dispose();

      
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
          child.material = metal_mat;

        } else if (child.material.name === 'brushed_metal') {
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

    let currentSetIndex = 0;
    let setAnimIndex = -1;
    let activePlayToken = 0;

    function getActiveSet() {
      return animationSets[currentSetIndex];
    }

    function getActiveAnimationOrder() {
      return getActiveSet().animations;
    }

    function getAnimationName(i) {
      const setList = getActiveAnimationOrder();
      return setList[(i + setList.length) % setList.length];
    }

    function snapActionToStart(action) {
      if (!action) return;
      action.stop();
      action.reset();
      action.enabled = true;
      action.paused = true;
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(1);
    }

    function snapActionToEnd(action) {
      if (!action) return;
      action.reset();
      action.enabled = true;
      action.paused = false;
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(1);
      action.play();
      action.time = action.getClip().duration;
      action.paused = true;
    }

    // Rebuild cumulative step state so backward navigation instantly restores later-step parts.
    function applySetStateAtIndex(order, activeIndex) {
      order.forEach((name, idx) => {
        const action = actions[name];
        if (!action) return;
        if (idx < activeIndex) {
          snapActionToEnd(action);
        } else {
          snapActionToStart(action);
        }
      });

      if (mixer) mixer.update(0);
    }

    function updateSetButtons() {
      document.getElementById('setUnpackingBtn')?.classList.toggle('active', currentSetIndex === 0);
      document.getElementById('setInstallationBtn')?.classList.toggle('active', currentSetIndex === 1);
      const activeSetLabel = document.getElementById('activeSetLabel');
      if (activeSetLabel) {
        activeSetLabel.textContent = `Set: ${getActiveSet().label}`;
      }
      updateProgressBar();
    }

    function getProgressState() {
      const steps = getActiveAnimationOrder().length;
      if (setAnimIndex < 0) {
        return { current: 0, steps, label: `0 of ${steps} steps` };
      }

      const stepName = getAnimationName(setAnimIndex);
      const activeSet = getActiveSet();
      const unpackingInstruction = instructionCopyBySet[activeSet.key]?.[stepName];

      if (unpackingInstruction) {
        const current = unpackingInstruction.stepNumber;
        const total = bookletMaxStepBySet[activeSet.key] ?? steps;
        return {
          current,
          steps: total,
          label: `Step ${current} of ${total}`,
        };
      }

      const current = setAnimIndex + 1;
      return {
        current,
        steps,
        label: `Step ${current} of ${steps}`,
      };
    }

    function updateProgressBar() {
      const { current, steps, label: progressLabel } = getProgressState();
      const fill = document.getElementById('step-progress-fill');
      const label = document.getElementById('step-progress-label');
      if (fill) {
        fill.style.width = `${(current / steps) * 100}%`;
      }
      if (label) {
        label.textContent = progressLabel;
      }
    }

    function updateInstructionPanel() {
      const activeSet = getActiveSet();
      const activeSetAnimations = getActiveAnimationOrder();

      if (setAnimIndex < 0) {
        instructionPanel.update({
          stepText: 'Step --',
          titleText: `${activeSet.label} Instructions`,
          bulletItems: ['Use Next to begin the selected set.'],
        });
        return;
      }

      const stepName = getAnimationName(setAnimIndex);
      const mappedInstruction = instructionCopyBySet[activeSet.key]?.[stepName];

      if (mappedInstruction) {
        instructionPanel.update({
          stepText: `Step ${mappedInstruction.stepNumber}`,
          titleText: mappedInstruction.title,
          bulletItems: mappedInstruction.bullets,
        });
        return;
      }

      const fallbackNumber = setAnimIndex + 1;
      instructionPanel.update({
        stepText: `Step ${fallbackNumber}`,
        titleText: prettifyStepName(stepName),
        bulletItems: [
          `Follow this animation step in the ${activeSet.label.toLowerCase()} sequence (${fallbackNumber} of ${activeSetAnimations.length}).`,
        ],
      });
    }

    function setActiveSet(index) {
      const nextIndex = (index + animationSets.length) % animationSets.length;
      if (nextIndex === currentSetIndex) {
        updateSetButtons();
        updateInstructionPanel();
        return;
      }

      activePlayToken++;
      currentSetIndex = nextIndex;
      setAnimIndex = -1;
      resetAnimations();
      restoreInitialViewState();
      updateSetButtons();
      updateInstructionPanel();
    }

    async function playByIndex(i) {
      const order = getActiveAnimationOrder();
      const clampedIndex = Math.max(-1, Math.min(i, order.length - 1));

      if (clampedIndex < 0) {
        setAnimIndex = -1;
        activePlayToken++;
        resetAnimations();
        restoreInitialViewState();
        updateProgressBar();
        updateInstructionPanel();
        return;
      }

      setAnimIndex = clampedIndex;
      const stepName = getAnimationName(setAnimIndex);
      const requestToken = ++activePlayToken;
      const activeSetKey = getActiveSet().key;

      applySetStateAtIndex(order, clampedIndex);

      await moveCameraToStep(activeSetKey, stepName);
      if (requestToken !== activePlayToken) return;

      playAction(stepName);
      updateProgressBar();
      updateInstructionPanel();
    }

    function playNext() {
      const order = getActiveAnimationOrder();
      const nextIndex = setAnimIndex < 0 ? 0 : Math.min(setAnimIndex + 1, order.length - 1);
      playByIndex(nextIndex);
    }

    function playPrevious() {
      const prevIndex = setAnimIndex <= 0 ? -1 : setAnimIndex - 1;
      playByIndex(prevIndex);
    }
    
    // Initial set and animation
    const initialSetParam = new URLSearchParams(window.location.search).get('set');
    const initialSetIndex = initialSetParam === 'installation' ? 1 : 0;
    setActiveSet(initialSetIndex);
    captureInitialViewState();
    createCameraCapturePanel({
      getSetKey: () => getActiveSet().key,
      getStepName: () => (setAnimIndex < 0 ? null : getAnimationName(setAnimIndex)),
    });
    
    const menuToggle = document.getElementById('menu-toggle');
    const setSelector = document.getElementById('set-selector');
    if (menuToggle && setSelector) {
      menuToggle.addEventListener('click', () => {
        const isOpen = setSelector.classList.toggle('open');
        menuToggle.setAttribute('aria-expanded', String(isOpen));
      });
    }

    document.getElementById('setUnpackingBtn').addEventListener('click', () => {
      setActiveSet(0);
      setSelector?.classList.remove('open');
      menuToggle?.setAttribute('aria-expanded', 'false');
    });
    document.getElementById('setInstallationBtn').addEventListener('click', () => {
      setActiveSet(1);
      setSelector?.classList.remove('open');
      menuToggle?.setAttribute('aria-expanded', 'false');
    });
    document.getElementById('airControlsBtn')?.addEventListener('click', () => {
      renderer.setAnimationLoop(null);
      window.location.assign('/stoveDemo.html');
    });
    document.getElementById('prevBtn').addEventListener('click', () => {
      playPrevious();
    });
    document.getElementById('nextBtn').addEventListener('click', () => {
      playNext();
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

