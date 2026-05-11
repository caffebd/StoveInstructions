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
import { ReflectorForSSRPass } from 'three/addons/objects/ReflectorForSSRPass.js';
import { fireVertexShader, fireFragmentShader } from './shaders/fireShader.js';
import { logVertexShader, logFragmentShader } from './shaders/logShader.js';
import { stoveBodyVertexShader, stoveBodyFragmentShader } from './shaders/stoveBodyShader.js';
import { metalVertexShader, metalFragmentShader } from './shaders/metalShader.js';
import { glassVertexShader, glassFragmentShader } from './shaders/glassShader.js';
import { ropeVertexShader, ropeFragmentShader } from './shaders/ropeShader.js';
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

function isMobileViewport() {
  return window.innerWidth <= 768;
}

function getQualityTier() {
  const cores = navigator.hardwareConcurrency ?? 4;
  if (!isMobileViewport()) return 'high';
  if (cores >= 8) return 'high';   // high-end mobile (M-series, Snapdragon 8+)
  if (cores >= 5) return 'medium'; // mid-range mobile
  return 'low';                     // low-end mobile
}

const qualityTier = getQualityTier();
const dprCap = qualityTier === 'low' ? 1 : qualityTier === 'medium' ? 1.5 : 2;

const airControlSections = [
  {
    label: 'Section 1 of 3',
    title: 'Air Controls',
    summary: 'Your stove features a single air control lever designed to manage airflow for optimal performance, depending on the type of fuel being used. The lever has 6 clicker settings to help fine-tune the airflow and set the appliance correctly for efficient operation.',
    bullets: [],
  },
  {
    label: 'Section 2 of 3',
    title: 'For Wood Burning',
    summary: '',
    bullets: [
      'Lever Moved to the Left of Centre: Air is introduced down the glass via the Airwash system. This is the primary setting for burning wood efficiently.',
      'Ignition Mode: When the control lever is positioned fully to the left (3 clicks from the centre), it allows maximum airflow for ignition or boosting the fire. This mode should only be used when starting or reviving the fire.',
      'Controlling the Fire: Moving the lever closer to the centre reduces the amount of air entering the appliance. The additional clicker settings are designed to help you adjust airflow precisely for steady combustion and efficient heat output.',
    ],
  },
  {
    label: 'Section 3 of 3',
    title: 'For Smokeless Coal Burning',
    summary: '',
    bullets: [
      'Lever Moved to the Right of Centre: A higher volume of air is directed upwards through the grate, which is ideal for burning smokeless fuels that require more airflow for proper combustion.',
      'Ignition Mode: When the control lever is positioned fully to the right (3 clicks from the centre), it allows maximum airflow for ignition or boosting the fire. This mode should only be used briefly when starting or reviving the fire.',
      'Controlling the Fire: Gradually moving the lever closer to the centre reduces the airflow for controlled and efficient burning of smokeless fuels.',
    ],
  },
];

function createAirControlPanelController() {
  const panel = document.getElementById('instruction-panel');
  const header = document.getElementById('instruction-panel-header');
  const collapseBtn = document.getElementById('instruction-collapse-btn');
  const stepLabel = document.getElementById('instruction-step-label');
  const title = document.getElementById('instruction-title');
  const summary = document.getElementById('instruction-summary');
  const bullets = document.getElementById('instruction-bullets');
  const prevBtn = document.getElementById('instruction-prev-btn');
  const nextBtn = document.getElementById('instruction-next-btn');

  if (!panel || !header || !collapseBtn || !stepLabel || !title || !summary || !bullets || !prevBtn || !nextBtn) {
    return;
  }

  let isCollapsed = false;
  let dragPointerId = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let index = 0;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function setCollapsed(nextCollapsed) {
    isCollapsed = nextCollapsed;
    panel.classList.toggle('collapsed', isCollapsed);
    collapseBtn.textContent = isCollapsed ? 'Expand' : 'Collapse';
    collapseBtn.setAttribute('aria-expanded', String(!isCollapsed));
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

  function render() {
    const section = airControlSections[index];
    stepLabel.textContent = section.label;
    title.textContent = section.title;
    summary.textContent = section.summary;
    summary.style.display = section.summary ? 'block' : 'none';

    bullets.innerHTML = '';
    section.bullets.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      bullets.appendChild(li);
    });

    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === airControlSections.length - 1;
  }

  prevBtn.addEventListener('click', () => {
    if (index === 0) return;
    index -= 1;
    render();
  });

  nextBtn.addEventListener('click', () => {
    if (index === airControlSections.length - 1) return;
    index += 1;
    render();
  });

  collapseBtn.addEventListener('click', () => {
    setCollapsed(!isCollapsed);
  });

  header.addEventListener('pointerdown', startDrag);
  header.addEventListener('pointermove', onDrag);
  header.addEventListener('pointerup', stopDrag);
  header.addEventListener('pointercancel', stopDrag);

  setCollapsed(window.innerWidth <= 768);
  render();
}

createAirControlPanelController();


function playAction(name) {
  const action = actions[name];
  if (!action) {
    // console.warn(`Animation "${name}" not found. Available:`, Object.keys(actions));
    return;
  }
  
  // Keep other animations playing with weight 0 (frozen at final frame)
  Object.values(actions).forEach((a) => {
    if (a !== action) {
      a.setEffectiveWeight(0);
      if (!a.isRunning()) {
        a.play();
      }
    }
  });
  
  // Don't reset—just play from current time (should be 0 if never started)
  action.setEffectiveWeight(1).play();
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

  updateLerp(delta);

  const wood_burning = fireLerp < 0.5;
  const explosions_burning = fireLerp < 0.75;
  const coal_burning = fireLerp > 0.5;

  for (const m of woodFireMeshObjects) m.visible = wood_burning;
  for (const m of explosionsMeshObjects) m.visible = explosions_burning;
  for (const m of coalFireMeshObjects) m.visible = coal_burning;
    

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
  
  if (scene.environmentRotation) {
    scene.environmentRotation.set(
      camera.rotation.x + environmentBaseRotation.x,
      camera.rotation.y + environmentBaseRotation.y,
      camera.rotation.z + environmentBaseRotation.z,
      camera.rotation.order
    );
  }

  if (mixer) mixer.update(delta);
  if (controls) controls.update();

  updateLeverHighlight(delta);
  composer.render();

  stats.end();
}
function setTarget(value) {
  const clampedValue = THREE.MathUtils.clamp(value, 0, 1);
  targetLerp = clampedValue;

  if (lerpSlider) {
    lerpSlider.value = String(clampedValue);
  }
}
function updateLerp(deltaTime) {
  if (Math.abs(targetLerp - animLerp) < 0.001) return;

  const animSpeed = 0.5;
  const fireSpeed = 0.5;

  animLerp += (targetLerp - animLerp) * animSpeed * deltaTime;
  fireLerp += (targetLerp - fireLerp) * fireSpeed * deltaTime;

  updateFireMaterialType('cards', materialsByType.cards);
  updateFireMaterialType('cylinders', materialsByType.cylinders);
  updateFireMaterialType('explosions', materialsByType.explosions);
  updateLogMaterialType('log', materialsByType.log);
  updateLogMaterialType('coal', materialsByType.coal);
  updateLogMaterialType('ember_bed', materialsByType.ember_bed);
  updateStoveMaterialType('stove_insulation', materialsByType.stove);

  playActionLerp('stove_lever', animLerp);
}
function updateFireMaterialType(type, materials) {
  if (materials.length === 0) return;

  const states = fireStates[type];
  const blended = lerpFiveFireStates(states.left, states.left_middle, states.middle, states.right_middle, states.right, fireLerp);

  materials.forEach(mat => {
    mat.uniforms.gradientScaling.value = blended.gradientScaling;
    mat.uniforms.gradientSpeed.value = blended.gradientSpeed;
    mat.uniforms.vtxNoiseScaling.value = blended.vtxNoiseScaling;
    mat.uniforms.vtxNoiseSpeed.value = blended.vtxNoiseSpeed;
    mat.uniforms.vtxNoiseWarp.value = blended.vtxNoiseWarp;

    mat.uniforms.rotation.value = blended.rotation;
    mat.uniforms.rotationRandom.value = blended.rotationRandom;
    mat.uniforms.rotationUVPow.value = blended.rotationUVPow;
    mat.uniforms.rotationAffect.value = blended.rotationAffect;
    mat.uniforms.rotationWorld.value = blended.rotationWorld;
    mat.uniforms.rotationWorldRandom.value = blended.rotationWorldRandom;
    mat.uniforms.rotationWorldUVPow.value = blended.rotationWorldUVPow;
    mat.uniforms.rotationWorldAffect.value = blended.rotationWorldAffect;

    mat.uniforms.offset.value = blended.offset;
    mat.uniforms.offsetRandom.value = blended.offsetRandom;
    mat.uniforms.offsetUVPow.value = blended.offsetUVPow;
    mat.uniforms.offsetAffect.value = blended.offsetAffect;

    mat.uniforms.UV_Y_Sub.value = blended.UV_Y_Sub;
    mat.uniforms.UV_Y_Add.value = blended.UV_Y_Add;

    mat.uniforms.fireSize.value = blended.fireSize;
    mat.uniforms.fireSizeVertical.value = blended.fireSizeVertical;
    mat.uniforms.fireSpeed.value = blended.fireSpeed;
    mat.uniforms.fireSpeedHorizontal.value = blended.fireSpeedHorizontal;
    mat.uniforms.fireAmount.value = blended.fireAmount;
    mat.uniforms.fireDensity.value = blended.fireDensity;

    mat.uniforms.fireBorderTop.value = blended.fireBorderTop;
    mat.uniforms.fireBorderBottom.value = blended.fireBorderBottom;
    mat.uniforms.fireFlickerAmount.value = blended.fireFlickerAmount;
    mat.uniforms.fireFlickerSpeed.value = blended.fireFlickerSpeed;
    mat.uniforms.fireWarp.value = blended.fireWarp;
    mat.uniforms.noiseScale.value = blended.noiseScale;
    mat.uniforms.noiseSpeed.value = blended.noiseSpeed;
  });
}
function updateLogMaterialType(type, materials) {
  if (materials.length === 0) return;

  const states = logStates[type];
  const blended = lerpFiveLogStates(states.left, states.left_middle, states.middle, states.right_middle, states.right, fireLerp);

  materials.forEach(mat => {
    mat.uniforms.logCoal.value = blended.logCoal;
    mat.uniforms.burnCol.value = blended.burnCol;
    mat.uniforms.glowCol.value = blended.glowCol;
    mat.uniforms.burnAmount.value = blended.burnAmount;
    mat.uniforms.burnStrength.value = blended.burnStrength;
    mat.uniforms.glowAmount.value = blended.glowAmount;
    mat.uniforms.glowStrength.value = blended.glowStrength;
  });
}
function updateStoveMaterialType(type, materials) {
  if (materials.length === 0) return;

  const states = stoveStates[type];
  const blended = lerpFiveStoveStates(states.left, states.left_middle, states.middle, states.right_middle, states.right, fireLerp);

  materials.forEach(mat => {
    mat.uniforms.lightCol.value = blended.lightCol;
    mat.uniforms.lightStrength.value = blended.lightStrength;
    mat.uniforms.lightPos.value = blended.lightPos;
    mat.uniforms.lightRange.value = blended.lightRange;
    mat.uniforms.lightFalloff.value = blended.lightFalloff;
    mat.uniforms.stoveColA.value = blended.stoveColA;
    mat.uniforms.stoveColB.value = blended.stoveColB;
    mat.uniforms.stoveRoughA.value = blended.stoveRoughA;
    mat.uniforms.stoveRoughB.value = blended.stoveRoughB;
  });
}
function lerp(a, b, t) {
  return a * (1 - t) + b * t;
}

function lerpFireState(a, b, t) {
  const result = new FireState();

  result.gradientScaling = lerp(a.gradientScaling, b.gradientScaling, t);
  result.gradientSpeed = lerp(a.gradientSpeed, b.gradientSpeed, t);
  result.vtxNoiseScaling = lerp(a.vtxNoiseScaling, b.vtxNoiseScaling, t);
  result.vtxNoiseSpeed = lerp(a.vtxNoiseSpeed, b.vtxNoiseSpeed, t);
  result.vtxNoiseWarp = lerp(a.vtxNoiseWarp, b.vtxNoiseWarp, t);

  result.rotation = new THREE.Vector3(
  lerp(a.rotation.x, b.rotation.x, t),
  lerp(a.rotation.y, b.rotation.y, t),
  lerp(a.rotation.z, b.rotation.z, t)
  );

  result.rotationRandom = new THREE.Vector3(
  lerp(a.rotationRandom.x, b.rotationRandom.x, t),
  lerp(a.rotationRandom.y, b.rotationRandom.y, t),
  lerp(a.rotationRandom.z, b.rotationRandom.z, t)
  );

  result.rotationUVPow = lerp(a.rotationUVPow, b.rotationUVPow, t);
  result.rotationAffect = lerp(a.rotationAffect, b.rotationAffect, t);
  
  
  result.rotationWorld = new THREE.Vector3(
  lerp(a.rotationWorld.x, b.rotationWorld.x, t),
  lerp(a.rotationWorld.y, b.rotationWorld.y, t),
  lerp(a.rotationWorld.z, b.rotationWorld.z, t)
  );
  
  result.rotationWorldRandom = new THREE.Vector3(
  lerp(a.rotationWorldRandom.x, b.rotationWorldRandom.x, t),
  lerp(a.rotationWorldRandom.y, b.rotationWorldRandom.y, t),
  lerp(a.rotationWorldRandom.z, b.rotationWorldRandom.z, t)
  );

  result.rotationWorldUVPow = lerp(a.rotationWorldUVPow, b.rotationWorldUVPow, t);
  result.rotationWorldAffect = lerp(a.rotationWorldAffect, b.rotationWorldAffect, t);

  result.offset = new THREE.Vector3(
  lerp(a.offset.x, b.offset.x, t),
  lerp(a.offset.y, b.offset.y, t),
  lerp(a.offset.z, b.offset.z, t)
  );

  result.offsetRandom = new THREE.Vector3(
  lerp(a.offsetRandom.x, b.offsetRandom.x, t),
  lerp(a.offsetRandom.y, b.offsetRandom.y, t),
  lerp(a.offsetRandom.z, b.offsetRandom.z, t)
  );

  result.offsetUVPow = lerp(a.offsetUVPow, b.offsetUVPow, t);
  result.offsetAffect = lerp(a.offsetAffect, b.offsetAffect, t);

  result.UV_Y_Sub = lerp(a.UV_Y_Sub, b.UV_Y_Sub, t);
  result.UV_Y_Add = lerp(a.UV_Y_Add, b.UV_Y_Add, t);

  result.fireSize = lerp(a.fireSize, b.fireSize, t);
  result.fireSizeVertical = lerp(a.fireSizeVertical, b.fireSizeVertical, t);
  result.fireSpeed = lerp(a.fireSpeed, b.fireSpeed, t);
  result.fireSpeedHorizontal = lerp(a.fireSpeedHorizontal, b.fireSpeedHorizontal, t);
  result.fireAmount = lerp(a.fireAmount, b.fireAmount, t);
  result.fireDensity = lerp(a.fireDensity, b.fireDensity, t);

  result.fireBorderTop = lerp(a.fireBorderTop, b.fireBorderTop, t);
  result.fireBorderBottom = lerp(a.fireBorderBottom, b.fireBorderBottom, t);
  result.fireFlickerAmount = lerp(a.fireFlickerAmount, b.fireFlickerAmount, t);
  result.fireFlickerSpeed = lerp(a.fireFlickerSpeed, b.fireFlickerSpeed, t);
  result.fireWarp = lerp(a.fireWarp, b.fireWarp, t);
  result.noiseScale = lerp(a.noiseScale, b.noiseScale, t);
  result.noiseSpeed = lerp(a.noiseSpeed, b.noiseSpeed, t);

  return result;
}
function lerpLogState(a, b, t) {
  const result = new LogState();

  result.logCoal = lerp(a.logCoal, b.logCoal, t);
  result.burnCol = a.burnCol.clone().lerp(b.burnCol, t);
  result.glowCol = a.glowCol.clone().lerp(b.glowCol, t);
  result.burnAmount = lerp(a.burnAmount, b.burnAmount, t);
  result.burnStrength = lerp(a.burnStrength, b.burnStrength, t);
  result.glowAmount = lerp(a.glowAmount, b.glowAmount, t);
  result.glowStrength = lerp(a.glowStrength, b.glowStrength, t);

  return result;
}
function lerpStoveState(a, b, t) {
  const result = new StoveState();

  result.lightCol = a.lightCol.clone().lerp(b.lightCol, t);
  result.lightStrength = lerp(a.lightStrength, b.lightStrength, t);
  result.lightPos = new THREE.Vector3(
    lerp(a.lightPos.x, b.lightPos.x, t),
    lerp(a.lightPos.y, b.lightPos.y, t),
    lerp(a.lightPos.z, b.lightPos.z, t)
  );
  result.lightRange = lerp(a.lightRange, b.lightRange, t);
  result.lightFalloff = lerp(a.lightFalloff, b.lightFalloff, t);
  result.stoveColA = a.stoveColA.clone().lerp(b.stoveColA, t);
  result.stoveColB = a.stoveColB.clone().lerp(b.stoveColB, t);
  result.stoveRoughA = lerp(a.stoveRoughA, b.stoveRoughA, t);
  result.stoveRoughB = lerp(a.stoveRoughB, b.stoveRoughB, t);

  return result;
}

function lerpThreeFireStates(left, middle, right, t) {
  if (t <= 0.5) {
    const localT = t * 2.0;
    return lerpFireState(left, middle, localT);
  } else {
    const localT = (t - 0.5) * 2.0;
    return lerpFireState(middle, right, localT);
  }
}
function lerpFiveFireStates(s0, s1, s2, s3, s4, t) {
  if (t <= 0.25) {
    return lerpFireState(s0, s1, t * 4.0);
  } else if (t <= 0.5) {
    return lerpFireState(s1, s2, (t - 0.25) * 4.0);
  } else if (t <= 0.75) {
    return lerpFireState(s2, s3, (t - 0.5) * 4.0);
  } else {
    return lerpFireState(s3, s4, (t - 0.75) * 4.0);
  }
}

function lerpThreeLogStates(left, middle, right, t) {
  if (t <= 0.5) {
    const localT = t * 2.0;
    return lerpLogState(left, middle, localT);
  } else {
    const localT = (t - 0.5) * 2.0;
    return lerpLogState(middle, right, localT);
  }
}
function lerpFiveLogStates(s0, s1, s2, s3, s4, t) {
  if (t <= 0.25) {
    return lerpLogState(s0, s1, t * 4.0);
  } else if (t <= 0.5) {
    return lerpLogState(s1, s2, (t - 0.25) * 4.0);
  } else if (t <= 0.75) {
    return lerpLogState(s2, s3, (t - 0.5) * 4.0);
  } else {
    return lerpLogState(s3, s4, (t - 0.75) * 4.0);
  }
}

function lerpThreeStoveStates(left, middle, right, t) {
  if (t <= 0.5) {
    const localT = t * 2.0;
    return lerpStoveState(left, middle, localT);
  } else {
    const localT = (t - 0.5) * 2.0;
    return lerpStoveState(middle, right, localT);
  }
}
function lerpFiveStoveStates(s0, s1, s2, s3, s4, t) {
  if (t <= 0.25) {
    return lerpStoveState(s0, s1, t * 4.0);
  } else if (t <= 0.5) {
    return lerpStoveState(s1, s2, (t - 0.25) * 4.0);
  } else if (t <= 0.75) {
    return lerpStoveState(s2, s3, (t - 0.5) * 4.0);
  } else {
    return lerpStoveState(s3, s4, (t - 0.75) * 4.0);
  }
}

function buildFireUniforms(state) {
  return {
    gradientScaling: { value: state.gradientScaling },
    gradientSpeed: { value: state.gradientSpeed },
    vtxNoiseScaling: { value: state.vtxNoiseScaling },
    vtxNoiseSpeed: { value: state.vtxNoiseSpeed },
    vtxNoiseWarp: { value: state.vtxNoiseWarp },
    rotation: { value: state.rotation },
    rotationRandom: { value: state.rotationRandom },
    rotationUVPow: { value: state.rotationUVPow },
    rotationAffect: { value: state.rotationAffect },
    rotationWorld: { value: state.rotationWorld },
    rotationWorldRandom: { value: state.rotationWorldRandom },
    rotationWorldUVPow: { value: state.rotationWorldUVPow },
    rotationWorldAffect: { value: state.rotationWorldAffect },
    offset: { value: state.offset },
    offsetRandom: { value: state.offsetRandom },
    offsetUVPow: { value: state.offsetUVPow },
    offsetAffect: { value: state.offsetAffect },
    UV_Y_Sub: { value: state.UV_Y_Sub },
    UV_Y_Add: { value: state.UV_Y_Add },
    fireSize: { value: state.fireSize },
    fireSizeVertical: { value: state.fireSizeVertical },
    fireSpeed: { value: state.fireSpeed },
    fireSpeedHorizontal: { value: state.fireSpeedHorizontal },
    fireAmount: { value: state.fireAmount },
    fireDensity: { value: state.fireDensity },
    fireBorderTop: { value: state.fireBorderTop },
    fireBorderBottom: { value: state.fireBorderBottom },
    fireFlickerAmount: { value: state.fireFlickerAmount },
    fireFlickerSpeed: { value: state.fireFlickerSpeed },
    fireWarp: { value: state.fireWarp },
    noiseScale: { value: state.noiseScale },
    noiseSpeed: { value: state.noiseSpeed },
  };
}
function buildLogUniforms(state) {
  return {
    logCoal: { value: state.logCoal},
    burnCol: { value: state.burnCol },
    glowCol: { value: state.glowCol },
    burnAmount: { value: state.burnAmount },
    burnStrength: { value: state.burnStrength },
    glowAmount: { value: state.glowAmount },
    glowStrength: { value: state.glowStrength },
  };
}
function buildStoveUniforms(state) {
  return {
    lightCol: { value: state.lightCol },
    lightStrength: { value: state.lightStrength },
    lightPos: { value: state.lightPos },
    lightRange: { value: state.lightRange },
    lightFalloff: { value: state.lightFalloff },
    stoveColA: { value: state.stoveColA },
    stoveColB: { value: state.stoveColB },
    stoveRoughA: { value: state.stoveRoughA },
    stoveRoughB: { value: state.stoveRoughB },
  };
}
class FireState {
  constructor({
    gradientScaling = 0.0,
    gradientSpeed = 0.0,
    vtxNoiseScaling = 0.0,
    vtxNoiseSpeed = 0.0,
    vtxNoiseWarp = 0.0,

    rotation = new THREE.Vector3(0.0, 0.0, 0.0),
    rotationRandom = new THREE.Vector3(0.0, 0.0, 0.0),
    rotationUVPow = 0.0,
    rotationAffect = 0.0,
    rotationWorld = new THREE.Vector3(0.0, 0.0, 0.0),
    rotationWorldRandom = new THREE.Vector3(0.0, 0.0, 0.0),
    rotationWorldUVPow = 0.0,
    rotationWorldAffect = 0.0,

    offset = new THREE.Vector3(0.0, 0.0, 0.0),
    offsetRandom = new THREE.Vector3(0.0, 0.0, 0.0),
    offsetUVPow = 0.0,
    offsetAffect = 0.0,

    UV_Y_Sub = 0.0,
    UV_Y_Add = 0.0,

    fireSize = 0.0,
    fireSizeVertical = 0.0,
    fireSpeed = 0.0,
    fireSpeedHorizontal = 0.0,
    fireAmount = 0.0,
    fireDensity = 0.0,

    fireBorderTop = 0.0,
    fireBorderBottom = 0.0,
    fireFlickerAmount = 0.0,
    fireFlickerSpeed = 0.0,
    fireWarp = 0.0,
    noiseScale = 0.0,
    noiseSpeed = 0.0,
  } = {}) {
    this.gradientScaling = gradientScaling;
    this.gradientSpeed = gradientSpeed;
    this.vtxNoiseScaling = vtxNoiseScaling;
    this.vtxNoiseSpeed = vtxNoiseSpeed;
    this.vtxNoiseWarp = vtxNoiseWarp;
    this.rotation = rotation;
    this.rotationRandom = rotationRandom;
    this.rotationUVPow = rotationUVPow;
    this.rotationAffect = rotationAffect;
    this.rotationWorld = rotationWorld;
    this.rotationWorldRandom = rotationWorldRandom;
    this.rotationWorldUVPow = rotationWorldUVPow;
    this.rotationWorldAffect = rotationWorldAffect;
    this.offset = offset;
    this.offsetRandom = offsetRandom;
    this.offsetUVPow = offsetUVPow;
    this.offsetAffect = offsetAffect;
    this.UV_Y_Sub = UV_Y_Sub;
    this.UV_Y_Add = UV_Y_Add;
    this.fireSize = fireSize;
    this.fireSizeVertical = fireSizeVertical;
    this.fireSpeed = fireSpeed;
    this.fireSpeedHorizontal = fireSpeedHorizontal;
    this.fireAmount = fireAmount;
    this.fireDensity = fireDensity;
    this.fireBorderTop = fireBorderTop;
    this.fireBorderBottom = fireBorderBottom;
    this.fireFlickerAmount = fireFlickerAmount;
    this.fireFlickerSpeed = fireFlickerSpeed;
    this.fireWarp = fireWarp;
    this.noiseScale = noiseScale;
    this.noiseSpeed = noiseSpeed;
  }
}
class LogState {
  constructor({
    logCoal = 0.0,
    ashAmount = 0.0,
    ashStrength = 0.0,
    burnCol = new THREE.Color('#ffffff'),
    glowCol = new THREE.Color('#ffffff'),
    burnAmount = 0.6550000311125,
    burnStrength = 0.2000000095,
    glowAmount = 0.754000035815,
    glowStrength = 0.1150000054625,
  } = {}) {
    this.logCoal = logCoal;
    this.ashAmount = ashAmount;
    this.ashStrength = ashStrength;
    this.burnCol = burnCol;
    this.glowCol = glowCol;
    this.burnAmount = burnAmount;
    this.burnStrength = burnStrength;
    this.glowAmount = glowAmount;
    this.glowStrength = glowStrength;
  }
}
class StoveState {
  constructor({
    lightCol = new THREE.Color('#ffffff'),
    lightStrength = 0.6550000311125,
    lightPos = new THREE.Vector3(0.0, 0.0, 0.0),
    lightRange = 0.754000035815,
    lightFalloff = 0.1150000054625,
    stoveColA = new THREE.Color('#ffffff'),
    stoveColB = new THREE.Color('#ffffff'),
    stoveRoughA = 0.1150000054625,
    stoveRoughB = 0.1150000054625,

  } = {}) {
    this.lightCol = lightCol;
    this.lightStrength = lightStrength;
    this.lightPos = lightPos;
    this.lightRange = lightRange;
    this.lightFalloff = lightFalloff;
    this.stoveColA = stoveColA;
    this.stoveColB = stoveColB;
    this.stoveRoughA = stoveRoughA;
    this.stoveRoughB = stoveRoughB;
  }
}

// STATES -----------------------------

const fireStates = {
  cards: {
    left: new FireState({
      gradientScaling : 1.0,
      gradientSpeed : 0.39,
      vtxNoiseScaling : 3.68,
      vtxNoiseSpeed : 0.1,
      vtxNoiseWarp : 0.54,
      rotation : new THREE.Vector3(0.21, 0, 0),
      rotationRandom : new THREE.Vector3(0.098, 0, 0),
      rotationUVPow : 0.78400003724,
      rotationAffect : 1.0,
      rotationWorld : new THREE.Vector3(0.61, 0, 0),
      rotationWorldRandom : new THREE.Vector3(0, 0, 0.2),
      rotationWorldUVPow : 0.57600002736,
      rotationWorldAffect : 1.0,
      offset : new THREE.Vector3(0, 0, 0),
      offsetRandom : new THREE.Vector3(0.095, 0.05, 0.11),
      offsetRandomSpeed : 0.5,
      offsetUVPow : 0.494000023465,
      offsetAffect : 0.0,
      UV_Y_Sub : 0.0,
      UV_Y_Add : 0.0,
      fireSize : 0.4970000236075,
      fireSizeVertical : 0.5,
      fireSpeed : 0.2810000133475,
      fireSpeedHorizontal : 0.0,
      fireAmount : 1.0,
      fireDensity : 0.8530000405175,
      fireBorderTop : 0.2090000099275,
      fireBorderBottom : 0.202000009595,
      fireFlickerAmount : 0.0,
      fireFlickerSpeed : 0.5,
      fireWarp : 0.178000008455,
      noiseScale : 0.250000011875,
      noiseSpeed : 0.374000017765,
    }),
    left_middle: new FireState({
      gradientScaling : 1.0,
      gradientSpeed : 0.39,
      vtxNoiseScaling : 3.68,
      vtxNoiseSpeed : 0.1,
      vtxNoiseWarp : 0.54,
      rotation : new THREE.Vector3(0.18, 0, 0),
      rotationRandom : new THREE.Vector3(0.098, 0, 0),
      rotationUVPow : 0.78400003724,
      rotationAffect : 1.0,
      rotationWorld : new THREE.Vector3(0, 0, 0),
      rotationWorldRandom : new THREE.Vector3(0, 0, 0.2),
      rotationWorldUVPow : 0.57600002736,
      rotationWorldAffect : 1.0,
      offset : new THREE.Vector3(0, 0, 0),
      offsetRandom : new THREE.Vector3(0.095, 0.05, 0.11),
      offsetRandomSpeed : 0.5,
      offsetUVPow : 0.494000023465,
      offsetAffect : 0.0,
      UV_Y_Sub : 0.0,
      UV_Y_Add : 0.0,
      fireSize : 0.4970000236075,
      fireSizeVertical : 0.5,
      fireSpeed : 0.2810000133475,
      fireSpeedHorizontal : 0.0,
      fireAmount : 1.0,
      fireDensity : 0.5910000280725,
      fireBorderTop : 0.2090000099275,
      fireBorderBottom : 0.202000009595,
      fireFlickerAmount : 0.0,
      fireFlickerSpeed : 0.5,
      fireWarp : 0.178000008455,
      noiseScale : 0.250000011875,
      noiseSpeed : 0.374000017765,
    }),
    middle: new FireState({
gradientScaling : 1.0,
gradientSpeed : 0.39,
vtxNoiseScaling : 3.68,
vtxNoiseSpeed : 0.1,
vtxNoiseWarp : 0.54,
rotation : new THREE.Vector3(0.18, 0, 0),
rotationRandom : new THREE.Vector3(0.098, 0, 0),
rotationUVPow : 0.78400003724,
rotationAffect : 1.0,
rotationWorld : new THREE.Vector3(0, 0, 0),
rotationWorldRandom : new THREE.Vector3(0, 0, 0.2),
rotationWorldUVPow : 0.57600002736,
rotationWorldAffect : 1.0,
offset : new THREE.Vector3(0, 0, 0),
offsetRandom : new THREE.Vector3(0.095, 0.05, 0.11),
offsetUVPow : 0.494000023465,
offsetAffect : 0.0,
UV_Y_Sub : 0.0,
UV_Y_Add : 0.0,
fireSize : 0.4970000236075,
fireSizeVertical : 0.5,
fireSpeed : 0.2810000133475,
fireSpeedHorizontal : 0.0,
fireAmount : 0.3290000156275,
fireDensity : 0.5910000280725,
fireBorderTop : 0.2090000099275,
fireBorderBottom : 0.202000009595,
fireFlickerAmount : 0.0,
fireFlickerSpeed : 0.5,
fireWarp : 0.178000008455,
noiseScale : 0.250000011875,
noiseSpeed : 0.374000017765,
    }),
    right_middle: new FireState({
      gradientScaling : 1.0,
      gradientSpeed : 0.39,
      vtxNoiseScaling : 3.68,
      vtxNoiseSpeed : 0.1,
      vtxNoiseWarp : 0.54,
      rotation : new THREE.Vector3(0.18, 0, 0),
      rotationRandom : new THREE.Vector3(0.098, 0, 0),
      rotationUVPow : 0.78400003724,
      rotationAffect : 1.0,
      rotationWorld : new THREE.Vector3(0, 0, 0),
      rotationWorldRandom : new THREE.Vector3(0, 0, 0.2),
      rotationWorldUVPow : 0.57600002736,
      rotationWorldAffect : 1.0,
      offset : new THREE.Vector3(0, 0, 0),
      offsetRandom : new THREE.Vector3(0.095, 0.05, 0.11),
      offsetRandomSpeed : 0.5,
      offsetUVPow : 0.494000023465,
      offsetAffect : 0.0,
      UV_Y_Sub : 0.0,
      UV_Y_Add : 0.0,
      fireSize : 0.4970000236075,
      fireSizeVertical : 0.5,
      fireSpeed : 0.32,
      fireSpeedHorizontal : 0.0,
      fireAmount : 1.0,
      fireDensity : 0.5910000280725,
      fireBorderTop : 0.2090000099275,
      fireBorderBottom : 0.202000009595,
      fireFlickerAmount : 0.0,
      fireFlickerSpeed : 0.5,
      fireWarp : 0.178000008455,
      noiseScale : 0.250000011875,
      noiseSpeed : 0.374000017765,
    }),
    right: new FireState({
      gradientScaling : 1.0,
      gradientSpeed : 0.39,
      vtxNoiseScaling : 3.68,
      vtxNoiseSpeed : 0.1,
      vtxNoiseWarp : 0.54,
      rotation : new THREE.Vector3(0.21, 0, 0),
      rotationRandom : new THREE.Vector3(0.098, 0, 0),
      rotationUVPow : 0.78400003724,
      rotationAffect : 1.0,
      rotationWorld : new THREE.Vector3(0.61, 0, 0),
      rotationWorldRandom : new THREE.Vector3(0, 0, 0.2),
      rotationWorldUVPow : 0.57600002736,
      rotationWorldAffect : 1.0,
      offset : new THREE.Vector3(0, 0, 0),
      offsetRandom : new THREE.Vector3(0.095, 0.05, 0.11),
      offsetRandomSpeed : 0.5,
      offsetUVPow : 0.494000023465,
      offsetAffect : 0.0,
      UV_Y_Sub : 0.0,
      UV_Y_Add : 0.0,
      fireSize : 0.4970000236075,
      fireSizeVertical : 0.2,
      fireSpeed : 0.42,
      fireSpeedHorizontal : 0.0,
      fireAmount : 1.0,
      fireDensity : 0.8530000405175,
      fireBorderTop : 0.2090000099275,
      fireBorderBottom : 0.202000009595,
      fireFlickerAmount : 0.0,
      fireFlickerSpeed : 0.5,
      fireWarp : 0.178000008455,
      noiseScale : 0.250000011875,
      noiseSpeed : 0.374000017765,
    }),
  },
  cylinders: {
    left: new FireState({
      gradientScaling : 1.0,
      gradientSpeed : 0.77,
      vtxNoiseScaling : 3.68,
      vtxNoiseSpeed : 0.1,
      vtxNoiseWarp : 0.54,
      rotation : new THREE.Vector3(0, 0, 0),
      rotationRandom : new THREE.Vector3(0.1, 0.1, 0.34),
      rotationUVPow : 1.0,
      rotationAffect : 1.0,
      rotationWorld : new THREE.Vector3(0, 0.12, 0),
      rotationWorldRandom : new THREE.Vector3(0.05, 0.05, 5.115),
      rotationWorldUVPow : 0.2470000117325,
      rotationWorldAffect : 1.0,
      offset : new THREE.Vector3(0, 0, 0),
      offsetRandom : new THREE.Vector3(0, 0, 0),
      offsetRandomSpeed : 0.5,
      offsetUVPow : 1.0,
      offsetAffect : 1.0,
      UV_Y_Sub : 0.0,
      UV_Y_Add : 0.0,
      fireSize : 0.5570000264575,
      fireSizeVertical : 0.5,
      fireSpeed : 0.74400003534,
      fireSpeedHorizontal : 0.0,
      fireAmount : 1.0,
      fireDensity : 0.5,
      fireBorderTop : 0.166000007885,
      fireBorderBottom : 0.1650000078375,
      fireFlickerAmount : 0.7270000345325,
      fireFlickerSpeed : 0.1930000091675,
      fireWarp : 0.5,
      noiseScale : 0.5,
      noiseSpeed : 0.5,
    }),
    left_middle: new FireState({
      gradientScaling : 1.0,
      gradientSpeed : 0.77,
      vtxNoiseScaling : 3.68,
      vtxNoiseSpeed : 0.1,
      vtxNoiseWarp : 0.54,
      rotation : new THREE.Vector3(0, 0, 0),
      rotationRandom : new THREE.Vector3(0.1, 0.1, 0.34),
      rotationUVPow : 1.0,
      rotationAffect : 1.0,
      rotationWorld : new THREE.Vector3(0, 0.12, 0),
      rotationWorldRandom : new THREE.Vector3(0.05, 0.05, 5.115),
      rotationWorldUVPow : 0.2470000117325,
      rotationWorldAffect : 1.0,
      offset : new THREE.Vector3(0, 0, 0),
      offsetRandom : new THREE.Vector3(0, 0, 0),
      offsetRandomSpeed : 0.5,
      offsetUVPow : 1.0,
      offsetAffect : 1.0,
      UV_Y_Sub : 0.0,
      UV_Y_Add : 0.0,
      fireSize : 0.5570000264575,
      fireSizeVertical : 0.5,
      fireSpeed : 0.74400003534,
      fireSpeedHorizontal : 0.0,
      fireAmount : 1.0,
      fireDensity : 0.5,
      fireBorderTop : 0.166000007885,
      fireBorderBottom : 0.1650000078375,
      fireFlickerAmount : 0.7270000345325,
      fireFlickerSpeed : 0.1930000091675,
      fireWarp : 0.5,
      noiseScale : 0.5,
      noiseSpeed : 0.5,
    }),
    middle: new FireState({
gradientScaling : 1.0,
gradientSpeed : 0.77,
vtxNoiseScaling : 3.68,
vtxNoiseSpeed : 0.1,
vtxNoiseWarp : 0.54,
rotation : new THREE.Vector3(0, 0, 0),
rotationRandom : new THREE.Vector3(0.1, 0.1, 0.34),
rotationUVPow : 1.0,
rotationAffect : 0.46800002223,
rotationWorld : new THREE.Vector3(0, 0.12, 0),
rotationWorldRandom : new THREE.Vector3(0.05, 0.05, 5.115),
rotationWorldUVPow : 0.2470000117325,
rotationWorldAffect : 0.1710000081225,
offset : new THREE.Vector3(0, 0, 0),
offsetRandom : new THREE.Vector3(0, 0, 0),
offsetUVPow : 1.0,
offsetAffect : 1.0,
UV_Y_Sub : 0.0,
UV_Y_Add : 0.0230000010925,
fireSize : 0.2170000103075,
fireSizeVertical : 0.5,
fireSpeed : 0.058000002755,
fireSpeedHorizontal : 0.0,
fireAmount : 1.0,
fireDensity : 0.5,
fireBorderTop : 0.166000007885,
fireBorderBottom : 0.1650000078375,
fireFlickerAmount : 0.782000037145,
fireFlickerSpeed : 0.0400000019,
fireWarp : 0.2410000114475,
noiseScale : 0.5,
noiseSpeed : 0.5,
    }),
    right_middle: new FireState({
gradientScaling : 1.0,
gradientSpeed : 0.77,
vtxNoiseScaling : 3.68,
vtxNoiseSpeed : 0.1,
vtxNoiseWarp : 0.54,
rotation : new THREE.Vector3(0, 0, 0),
rotationRandom : new THREE.Vector3(0.1, 0.1, 0.34),
rotationUVPow : 1.0,
rotationAffect : 0.46800002223,
rotationWorld : new THREE.Vector3(0, 0.12, 0),
rotationWorldRandom : new THREE.Vector3(0.05, 0.05, 5.115),
rotationWorldUVPow : 0.2470000117325,
rotationWorldAffect : 0.1710000081225,
offset : new THREE.Vector3(0, 0, 0),
offsetRandom : new THREE.Vector3(0, 0, 0),
offsetUVPow : 1.0,
offsetAffect : 1.0,
UV_Y_Sub : 0.0,
UV_Y_Add : 0.0230000010925,
fireSize : 0.2170000103075,
fireSizeVertical : 0.5,
fireSpeed : 0.058000002755,
fireSpeedHorizontal : 0.0,
fireAmount : 1.0,
fireDensity : 0.5,
fireBorderTop : 0.166000007885,
fireBorderBottom : 0.1650000078375,
fireFlickerAmount : 0.782000037145,
fireFlickerSpeed : 0.0400000019,
fireWarp : 0.2410000114475,
noiseScale : 0.5,
noiseSpeed : 0.5,
    }),
    right: new FireState({
gradientScaling : 1.0,
gradientSpeed : 0.77,
vtxNoiseScaling : 3.68,
vtxNoiseSpeed : 0.1,
vtxNoiseWarp : 0.54,
rotation : new THREE.Vector3(0, 0, 0),
rotationRandom : new THREE.Vector3(0.1, 0.1, 0.34),
rotationUVPow : 1.0,
rotationAffect : 0.46800002223,
rotationWorld : new THREE.Vector3(0, 0.12, 0),
rotationWorldRandom : new THREE.Vector3(0.05, 0.05, 5.115),
rotationWorldUVPow : 0.2470000117325,
rotationWorldAffect : 0.1710000081225,
offset : new THREE.Vector3(0, 0, 0),
offsetRandom : new THREE.Vector3(0, 0, 0),
offsetUVPow : 1.0,
offsetAffect : 1.0,
UV_Y_Sub : 0.0,
UV_Y_Add : 0.0230000010925,
fireSize : 0.2170000103075,
fireSizeVertical : 0.5,
fireSpeed : 0.058000002755,
fireSpeedHorizontal : 0.0,
fireAmount : 1.0,
fireDensity : 0.5,
fireBorderTop : 0.166000007885,
fireBorderBottom : 0.1650000078375,
fireFlickerAmount : 0.782000037145,
fireFlickerSpeed : 0.0400000019,
fireWarp : 0.2410000114475,
noiseScale : 0.5,
noiseSpeed : 0.5,
    }),
  },
  explosions: {
    left: new FireState({
gradientScaling : 0.2,
gradientSpeed : 0.1,
vtxNoiseScaling : 3.68,
vtxNoiseSpeed : 0.05,
vtxNoiseWarp : 0.35,
rotation : new THREE.Vector3(0.07, 0, 0),
rotationRandom : new THREE.Vector3(0, 0, 0),
rotationUVPow : 0.78400003724,
rotationAffect : 1.0,
rotationWorld : new THREE.Vector3(0, 0, 0),
rotationWorldRandom : new THREE.Vector3(0, 0, 0),
rotationWorldUVPow : 1.0,
rotationWorldAffect : 1.0,
offset : new THREE.Vector3(0, 0.08, 0),
offsetRandom : new THREE.Vector3(0.08, 0.05, 0.02),
offsetRandomSpeed : 1.0,
offsetUVPow : 0.0,
offsetAffect : 1.0,
UV_Y_Sub : 0.0,
UV_Y_Add : 0.0,
fireSize : 0.346000016435,
fireSizeVertical : 0.5,
fireSpeed : 0.154000007315,
fireSpeedHorizontal : 0.050000002375,
fireAmount : 0.0,
fireDensity : 0.4870000231325,
fireBorderTop : 0.2630000124925,
fireBorderBottom : 0.190000009025,
fireFlickerAmount : 0.52400002489,
fireFlickerSpeed : 0.050000002375,
fireWarp : 0.16400000779,
noiseScale : 0.51200002432,
noiseSpeed : 0.1650000078375,
    }),
    left_middle: new FireState({
gradientScaling : 0.2,
gradientSpeed : 0.1,
vtxNoiseScaling : 3.68,
vtxNoiseSpeed : 0.05,
vtxNoiseWarp : 0.35,
rotation : new THREE.Vector3(0.07, 0, 0),
rotationRandom : new THREE.Vector3(0, 0, 0),
rotationUVPow : 0.78400003724,
rotationAffect : 1.0,
rotationWorld : new THREE.Vector3(0, 0, 0),
rotationWorldRandom : new THREE.Vector3(0, 0, 0),
rotationWorldUVPow : 1.0,
rotationWorldAffect : 1.0,
offset : new THREE.Vector3(0, 0.005, 0),
offsetRandom : new THREE.Vector3(0.08, 0.05, 0.02),
offsetRandomSpeed : 1.0,
offsetUVPow : 0.0,
offsetAffect : 1.0,
UV_Y_Sub : 0.0,
UV_Y_Add : 0.0,
fireSize : 0.346000016435,
fireSizeVertical : 0.5,
fireSpeed : 0.154000007315,
fireSpeedHorizontal : 0.050000002375,
fireAmount : 0.6,
fireDensity : 0.4870000231325,
fireBorderTop : 0.2630000124925,
fireBorderBottom : 0.190000009025,
fireFlickerAmount : 0.52400002489,
fireFlickerSpeed : 0.050000002375,
fireWarp : 0.16400000779,
noiseScale : 0.51200002432,
noiseSpeed : 0.1650000078375,
    }),
    middle: new FireState({
gradientScaling : 0.2,
gradientSpeed : 0.1,
vtxNoiseScaling : 3.68,
vtxNoiseSpeed : 0.05,
vtxNoiseWarp : 0.35,
rotation : new THREE.Vector3(0.07, 0, 0),
rotationRandom : new THREE.Vector3(0, 0, 0),
rotationUVPow : 0.78400003724,
rotationAffect : 1.0,
rotationWorld : new THREE.Vector3(0, 0, 0),
rotationWorldRandom : new THREE.Vector3(0, 0, 0),
rotationWorldUVPow : 1.0,
rotationWorldAffect : 1.0,
offset : new THREE.Vector3(0, 0.005, 0),
offsetRandom : new THREE.Vector3(0.08, 0.05, 0.02),
offsetRandomSpeed : 1.0,
offsetUVPow : 0.0,
offsetAffect : 1.0,
UV_Y_Sub : 0.0,
UV_Y_Add : 0.0,
fireSize : 0.346000016435,
fireSizeVertical : 0.5,
fireSpeed : 0.154000007315,
fireSpeedHorizontal : 0.050000002375,
fireAmount : 0.92,
fireDensity : 0.4870000231325,
fireBorderTop : 0.2630000124925,
fireBorderBottom : 0.190000009025,
fireFlickerAmount : 0.52400002489,
fireFlickerSpeed : 0.050000002375,
fireWarp : 0.16400000779,
noiseScale : 0.51200002432,
noiseSpeed : 0.1650000078375,
    }),
    right_middle: new FireState({
gradientScaling : 0.2,
gradientSpeed : 0.1,
vtxNoiseScaling : 3.68,
vtxNoiseSpeed : 0.05,
vtxNoiseWarp : 0.35,
rotation : new THREE.Vector3(0.07, 0, 0),
rotationRandom : new THREE.Vector3(0, 0, 0),
rotationUVPow : 0.78400003724,
rotationAffect : 1.0,
rotationWorld : new THREE.Vector3(0, 0, 0),
rotationWorldRandom : new THREE.Vector3(0, 0, 0),
rotationWorldUVPow : 1.0,
rotationWorldAffect : 1.0,
offset : new THREE.Vector3(0, 0.08, 0),
offsetRandom : new THREE.Vector3(0.08, 0.05, 0.02),
offsetRandomSpeed : 1.0,
offsetUVPow : 0.0,
offsetAffect : 1.0,
UV_Y_Sub : 0.0,
UV_Y_Add : 0.0,
fireSize : 0.346000016435,
fireSizeVertical : 0.5,
fireSpeed : 0.154000007315,
fireSpeedHorizontal : 0.050000002375,
fireAmount : 0.6,
fireDensity : 0.4870000231325,
fireBorderTop : 0.2630000124925,
fireBorderBottom : 0.190000009025,
fireFlickerAmount : 0.52400002489,
fireFlickerSpeed : 0.050000002375,
fireWarp : 0.16400000779,
noiseScale : 0.51200002432,
noiseSpeed : 0.1650000078375,
    }),
    right: new FireState({
gradientScaling : 0.2,
gradientSpeed : 0.1,
vtxNoiseScaling : 3.68,
vtxNoiseSpeed : 0.05,
vtxNoiseWarp : 0.35,
rotation : new THREE.Vector3(0.07, 0, 0),
rotationRandom : new THREE.Vector3(0, 0, 0),
rotationUVPow : 0.78400003724,
rotationAffect : 1.0,
rotationWorld : new THREE.Vector3(0, 0, 0),
rotationWorldRandom : new THREE.Vector3(0, 0, 0),
rotationWorldUVPow : 1.0,
rotationWorldAffect : 1.0,
offset : new THREE.Vector3(0, 0.08, 0),
offsetRandom : new THREE.Vector3(0.08, 0.05, 0.02),
offsetRandomSpeed : 1.0,
offsetUVPow : 0.0,
offsetAffect : 1.0,
UV_Y_Sub : 0.0,
UV_Y_Add : 0.0,
fireSize : 0.346000016435,
fireSizeVertical : 0.5,
fireSpeed : 0.154000007315,
fireSpeedHorizontal : 0.050000002375,
fireAmount : 0.0,
fireDensity : 0.4870000231325,
fireBorderTop : 0.2630000124925,
fireBorderBottom : 0.190000009025,
fireFlickerAmount : 0.52400002489,
fireFlickerSpeed : 0.050000002375,
fireWarp : 0.16400000779,
noiseScale : 0.51200002432,
noiseSpeed : 0.1650000078375,
    }),
  },
};
const logStates = {
  log: {
    left: new LogState({
      logCoal : 0.0,
      ashAmount : 0.0,
      ashStrength : 0.042000001995,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff3300'),
      burnAmount : 0.46800002223,
      burnStrength : 0.178000008455,
      glowAmount : 0.65200003097,
      glowStrength : 0.2110000100225,
    }),
    left_middle: new LogState({
      logCoal : 0.0,
      ashAmount : 1.0,
      ashStrength : 0.042000001995,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff3300'),
      burnAmount : 0.426000020235,
      burnStrength : 0.178000008455,
      glowAmount : 0.65200003097,
      glowStrength : 0.0590000028025,
    }),
    middle: new LogState({
      logCoal : 0.0,
      ashAmount : 0.0,
      ashStrength : 0.042000001995,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff3300'),
      burnAmount : 0.3090000146775,
      burnStrength : 0.178000008455,
      glowAmount : 0.6310000299725,
      glowStrength : 0.02000000095,
    }),
    right_middle: new LogState({
      logCoal : 0.0,
      ashAmount : 0.0,
      ashStrength : 0.042000001995,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff3300'),
      burnAmount : 0.3090000146775,
      burnStrength : 0.178000008455,
      glowAmount : 0.6310000299725,
      glowStrength : 0.02000000095,
    }),
    right: new LogState({
      logCoal : 0.0,
      ashAmount : 0.0,
      ashStrength : 0.042000001995,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff3300'),
      burnAmount : 0.3090000146775,
      burnStrength : 0.178000008455,
      glowAmount : 0.6310000299725,
      glowStrength : 0.02000000095,
    }),
  },
  coal: {
    left: new LogState({
      logCoal : 1.0,
      ashAmount : 0.8730000414675,
      ashStrength : 0.274000013015,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff0000'),
      burnAmount : 0.0610000028975,
      burnStrength : 0.066000003135,
      glowAmount : 0.8710000413725,
      glowStrength : 0.01200000057,
    }),
    left_middle: new LogState({
      logCoal : 1.0,
      ashAmount : 0.8730000414675,
      ashStrength : 0.274000013015,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff0000'),
      burnAmount : 0.0610000028975,
      burnStrength : 0.066000003135,
      glowAmount : 0.8710000413725,
      glowStrength : 0.01200000057,
    }),
    middle: new LogState({
      logCoal : 1.0,
      ashAmount : 0.8730000414675,
      ashStrength : 0.274000013015,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff0000'),
      burnAmount : 0.0610000028975,
      burnStrength : 0.066000003135,
      glowAmount : 0.8710000413725,
      glowStrength : 0.004,
    }),
    right_middle: new LogState({
      logCoal : 1.0,
      ashAmount : 0.8730000414675,
      ashStrength : 0.274000013015,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff0000'),
      burnAmount : 0.0610000028975,
      burnStrength : 0.066000003135,
      glowAmount : 0.903,
      glowStrength : 0.01,
    }),
    right: new LogState({
      logCoal : 1.0,
      ashAmount : 0.8730000414675,
      ashStrength : 0.274000013015,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff0000'),
      burnAmount : 0.0610000028975,
      burnStrength : 0.066000003135,
      glowAmount : 0.994,
      glowStrength : 0.01,
    }),
  },
  ember_bed: {
    left: new LogState({
      logCoal : 0.0,
      ashAmount : 0.0,
      ashStrength : 0.042000001995,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff0000'),
      burnAmount : 0.46800002223,
      burnStrength : 0.178000008455,
      glowAmount : 0.65200003097,
      glowStrength : 0.2110000100225,
    }),
    left_middle: new LogState({
      logCoal : 0.0,
      ashAmount : 1.0,
      ashStrength : 0.042000001995,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff0000'),
      burnAmount : 0.426000020235,
      burnStrength : 0.178000008455,
      glowAmount : 0.65200003097,
      glowStrength : 0.0590000028025,
    }),
    middle: new LogState({
      logCoal : 0.0,
      ashAmount : 0.879,
      ashStrength : 0.01,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff0000'),
      burnAmount : 0.239,
      burnStrength : 0.178000008455,
      glowAmount : 0.692,
      glowStrength : 0.016,
    }),
    right_middle: new LogState({
      logCoal : 1.0,
      ashAmount : 0.619,
      ashStrength : 0.014,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff0000'),
      burnAmount : 0.309,
      burnStrength : 0.178,
      glowAmount : 0.949,
      glowStrength : 0.1,
    }),
    right: new LogState({
      logCoal : 1.0,
      ashAmount : 0.619,
      ashStrength : 0.014,
      burnCol : new THREE.Color('#393939'),
      glowCol : new THREE.Color('#ff0000'),
      burnAmount : 0.309,
      burnStrength : 0.178,
      glowAmount : 1.0,
      glowStrength : 0.2,
    }),
  },
};
const stoveStates = {
  stove_insulation: {
    left: new StoveState({
      lightCol : new THREE.Color('#ff4400'),
      lightStrength : 12.575,
      lightPos : new THREE.Vector3(0.0, 0.018, 0.004),
      lightRange : 0.31,
      lightFalloff : 1.27,
      stoveColA : new THREE.Color('#cbab87'),
      stoveColB : new THREE.Color('#8b6e4d'),
      stoveRoughA : 0.69,
      stoveRoughB : 1.0,
    }),
    left_middle: new StoveState({
      lightCol : new THREE.Color('#ff4400'),
      lightStrength : 9.575,
      lightPos : new THREE.Vector3(0.0, 0.018, 0.004),
      lightRange : 0.31,
      lightFalloff : 1.27,
      stoveColA : new THREE.Color('#cbab87'),
      stoveColB : new THREE.Color('#8b6e4d'),
      stoveRoughA : 0.69,
      stoveRoughB : 1.0,
    }),
    middle: new StoveState({
      lightCol : new THREE.Color('#ff4400'),
      lightStrength : 2.165,
      lightPos : new THREE.Vector3(0.0, 0.018, 0.004),
      lightRange : 0.31,
      lightFalloff : 1.27,
      stoveColA : new THREE.Color('#cbab87'),
      stoveColB : new THREE.Color('#8b6e4d'),
      stoveRoughA : 0.69,
      stoveRoughB : 1.0,
    }),
    right_middle: new StoveState({
      lightCol : new THREE.Color('#ff4400'),
      lightStrength : 8.575,
      lightPos : new THREE.Vector3(0.0, 0.018, 0.004),
      lightRange : 0.31,
      lightFalloff : 1.27,
      stoveColA : new THREE.Color('#cbab87'),
      stoveColB : new THREE.Color('#8b6e4d'),
      stoveRoughA : 0.69,
      stoveRoughB : 1.0,
    }),
    right: new StoveState({
      lightCol : new THREE.Color('#ff4400'),
      lightStrength : 12.575,
      lightPos : new THREE.Vector3(0.0, 0.018, 0.004),
      lightRange : 0.31,
      lightFalloff : 1.27,
      stoveColA : new THREE.Color('#cbab87'),
      stoveColB : new THREE.Color('#8b6e4d'),
      stoveRoughA : 0.69,
      stoveRoughB : 1.0,
    }),
  },
};

const materialsByType = {
  cards: [],
  cylinders: [],
  explosions: [],
  log: [],
  coal: [],
  ember_bed: [],
  stove: []
};

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
];

const actions = {};
const finishedActions = new Set();
const customMaterials = [];

// MESHES -----------------------------

const log_meshes = new Set([
  'log',
]);
const wood_fire_meshes = new Set([
  'wood_fire_01',
  'wood_fire_02',
  'wood_fire_03',
  'wood_fire_04',
  'wood_fire_05',
  'wood_fire_06',
  'wood_fire_07',
]);
const coal_meshes = new Set([
  'coal'
]);
const coal_fire_meshes = new Set([
  'coal_fire_01',
  'coal_fire_02',
  'coal_fire_03',
  'coal_fire_04',
  'coal_fire_05',
]);
const fire_cylinder_meshes = new Set([
  'fire_cylinder_01',
  'fire_cylinder_02',
  'fire_cylinder_03',
  'fire_cylinder_04',
  'fire_cylinder_05',
  'fire_cylinder_06',
  'fire_cylinder_07',
  'fire_cylinder_08',
]);
const fire_explosion_meshes = new Set([
  'fire_explosion_01',
  'fire_explosion_02',
  'fire_explosion_03',
]);
const ember_bed_meshes = new Set([
  'ember_bed',
]);

const woodFireMeshObjects = [];
const coalFireMeshObjects = [];
const explosionsMeshObjects = [];

let animLerp = 0;
let fireLerp = 0;
let targetLerp = 0;

let mixer;
let model;
let stoveModel;
let lerpSlider;

const leverPickTargets = [];
const leverOccluderTargets = [];
const leverNodeNames = new Set();
const leverPointerRaycaster = new THREE.Raycaster();
const leverPointerNdc = new THREE.Vector2();

let hoveredLeverMesh = null;
let draggingLeverMesh = null;
let lastHighlightedLeverMesh = null;
let leverHighlightValue = 0;

const LEVER_HOVER_STRENGTH = 0.05;
const LEVER_ACTIVE_STRENGTH = 0.15;
const LEVER_HIGHLIGHT_COLOR = 0xffffff;

let leverDragActive = false;
let leverDragPointerId = null;
let leverLastClientX = 0;

const LEVER_DRAG_SENSITIVITY = 1 / 250;

function extractClipNodeNames(clip) {
  const names = new Set();
  if (!clip || !Array.isArray(clip.tracks)) return names;

  clip.tracks.forEach((track) => {
    const path = String(track.name || '').split('.')[0];
    path.split('/').forEach((segment) => {
      const cleaned = segment.replace(/\[[^\]]+\]/g, '').trim();
      if (cleaned) names.add(cleaned);
    });
  });

  return names;
}

function isLikelyLeverName(name) {
  const n = String(name || '').toLowerCase();
  return /(lever|air|damper|intake|control|slider)/.test(n);
}

function isLeverMesh(mesh) {
  let current = mesh;
  while (current) {
    if (leverNodeNames.has(current.name) || isLikelyLeverName(current.name)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function registerLeverDragTargets(stoveRoot, animations) {
  leverPickTargets.length = 0;
  leverOccluderTargets.length = 0;
  leverNodeNames.clear();

  const stoveLeverClip = animations.find((clip) => clip.name === 'stove_lever');
  const clipNames = extractClipNodeNames(stoveLeverClip);
  clipNames.forEach((name) => leverNodeNames.add(name));

  stoveRoot.traverse((child) => {
    if (!child.isMesh) return;
    if (isLeverMesh(child)) {
      leverPickTargets.push(child);
    } else {
      leverOccluderTargets.push(child);
    }
  });

  addLeverHoleDragCollider(stoveRoot);
}

function addLeverHoleDragCollider(stoveRoot) {
  const leverMesh = leverPickTargets.find((m) => isLikelyLeverName(m.name)) || leverPickTargets[0];
  if (!leverMesh || !leverMesh.geometry) return;

  if (!leverMesh.geometry.boundingBox) {
    leverMesh.geometry.computeBoundingBox();
  }

  const bounds = leverMesh.geometry.boundingBox;
  if (!bounds) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  const majorAxis = (size.x >= size.y && size.x >= size.z)
    ? 'x'
    : (size.y >= size.z ? 'y' : 'z');

  const holeOffset = size[majorAxis] * 0.42;
  const holeRadius = Math.max(0.007, Math.min(size.x, size.y, size.z) * 0.7);

  const tipA = center.clone();
  const tipB = center.clone();
  tipA[majorAxis] += holeOffset;
  tipB[majorAxis] -= holeOffset;

  addLeverDragCollider(leverMesh, tipA, holeRadius);
  addLeverDragCollider(leverMesh, tipB, holeRadius * 0.9);
}

function addLeverDragCollider(leverMesh, position, radius) {
  const colliderGeometry = new THREE.SphereGeometry(radius, 14, 12);
  const colliderMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const collider = new THREE.Mesh(colliderGeometry, colliderMaterial);
  collider.name = 'lever_drag_collider';
  collider.position.copy(position);
  leverMesh.add(collider);
  leverPickTargets.push(collider);
}

function setLeverPointerNdc(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  leverPointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  leverPointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function getLeverTargetMesh(object) {
  let current = object;
  while (current) {
    if (current.isMesh && current.name !== 'lever_drag_collider' && isLeverMesh(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function ensureLeverHighlightMaterial(mesh) {
  if (!mesh || !mesh.material || mesh.userData.highlightMaterialPrepared) return;

  const material = mesh.material;
  mesh.userData.highlightBaseEmissive = material.emissive ? material.emissive.clone() : null;
  mesh.userData.highlightBaseEmissiveIntensity = typeof material.emissiveIntensity === 'number' ? material.emissiveIntensity : 0;
  mesh.userData.originalMaterial = material;
  mesh.material = material.clone();
  mesh.userData.highlightMaterialPrepared = true;
}

function restoreLeverHighlight(mesh) {
  if (!mesh?.material) return;
  if (mesh.userData.highlightBaseEmissive && mesh.material.emissive) {
    mesh.material.emissive.copy(mesh.userData.highlightBaseEmissive);
  }
  if (typeof mesh.userData.highlightBaseEmissiveIntensity === 'number') {
    mesh.material.emissiveIntensity = mesh.userData.highlightBaseEmissiveIntensity;
  }
  mesh.material.needsUpdate = true;
}

function updateLeverHighlight(delta) {
  const targetMesh = draggingLeverMesh || hoveredLeverMesh;
  const targetStrength = draggingLeverMesh ? LEVER_ACTIVE_STRENGTH : (hoveredLeverMesh ? LEVER_HOVER_STRENGTH : 0);
  const blend = THREE.MathUtils.clamp(delta * 12, 0, 1);

  leverHighlightValue = THREE.MathUtils.lerp(leverHighlightValue, targetStrength, blend);

  if (targetMesh !== lastHighlightedLeverMesh) {
    if (lastHighlightedLeverMesh) {
      restoreLeverHighlight(lastHighlightedLeverMesh);
    }
    lastHighlightedLeverMesh = targetMesh;
  }

  if (targetMesh && targetMesh.material && 'emissive' in targetMesh.material) {
    ensureLeverHighlightMaterial(targetMesh);
    targetMesh.material.emissive.setHex(LEVER_HIGHLIGHT_COLOR);
    targetMesh.material.emissiveIntensity = leverHighlightValue;
    targetMesh.material.needsUpdate = true;
  } else if (!targetMesh && lastHighlightedLeverMesh) {
    restoreLeverHighlight(lastHighlightedLeverMesh);
    lastHighlightedLeverMesh = null;
  }
}

function isPointerOverLever(event) {
  if (!stoveModel || leverPickTargets.length === 0) return false;

  setLeverPointerNdc(event);
  leverPointerRaycaster.setFromCamera(leverPointerNdc, camera);
  const hits = leverPointerRaycaster.intersectObjects(
    [...leverPickTargets, ...leverOccluderTargets],
    true
  );
  const hit = hits[0];

  if (!hit) {
    hoveredLeverMesh = null;
    if (!leverDragActive) renderer.domElement.style.cursor = '';
    return false;
  }

  hoveredLeverMesh = getLeverTargetMesh(hit.object);
  if (!hoveredLeverMesh) {
    if (!leverDragActive) renderer.domElement.style.cursor = '';
    return false;
  }

  if (!leverDragActive) {
    renderer.domElement.style.cursor = 'grab';
  }

  return true;
}

function stopLeverDragging() {
  if (!leverDragActive) return;
  leverDragActive = false;
  leverDragPointerId = null;
  controls.enabled = true;
  draggingLeverMesh = null;
  renderer.domElement.style.cursor = '';
}

function setupLeverDragInteraction() {
  const canvas = renderer.domElement;

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!isPointerOverLever(event)) return;

    leverDragActive = true;
    draggingLeverMesh = hoveredLeverMesh;
    leverDragPointerId = event.pointerId;
    leverLastClientX = event.clientX;
    controls.enabled = false;
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!leverDragActive) {
      isPointerOverLever(event);
      return;
    }

    if (event.pointerId !== leverDragPointerId) return;

    const deltaX = event.clientX - leverLastClientX;
    leverLastClientX = event.clientX;
    setTarget(targetLerp + deltaX * LEVER_DRAG_SENSITIVITY);
    event.preventDefault();
  });

  canvas.addEventListener('pointerup', (event) => {
    if (event.pointerId !== leverDragPointerId) return;
    canvas.releasePointerCapture?.(event.pointerId);
    stopLeverDragging();
    isPointerOverLever(event);
  });

  canvas.addEventListener('pointercancel', stopLeverDragging);
  canvas.addEventListener('pointerleave', () => {
    if (!leverDragActive) {
      hoveredLeverMesh = null;
      canvas.style.cursor = '';
    }
  });
}

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

const stoveAO = textureLoader.load('/assets/textures/stove_combined_ao.png');
stoveAO.flipY = false;

// FIRE -----------------------------

const fire_card_uniforms = buildFireUniforms(
  lerpFiveFireStates(
    fireStates.cards.left,
    fireStates.cards.left_middle,
    fireStates.cards.middle,
    fireStates.cards.right_middle,
    fireStates.cards.right,
    fireLerp
));

const fire_cards_mat = new THREE.ShaderMaterial({
  vertexShader: fireVertexShader,
  fragmentShader: fireFragmentShader,
  uniforms: fire_card_uniforms,
  transparent : true,
  side : THREE.DoubleSide,
  alphaTest : 0.5,
  depthWrite : false,
  vertexColors : true,
  depthTest : true,
})

const fire_cylinders_uniforms = buildFireUniforms(
  lerpFiveFireStates(
    fireStates.cylinders.left,
    fireStates.cylinders.left_middle,
    fireStates.cylinders.middle,
    fireStates.cylinders.right_middle,
    fireStates.cylinders.right,
    fireLerp
));

const fire_cylinders_mat = new THREE.ShaderMaterial({
  vertexShader: fireVertexShader,
  fragmentShader: fireFragmentShader,
  uniforms: fire_cylinders_uniforms,
  transparent : true,
  side : THREE.DoubleSide,
  alphaTest : 0.5,
  depthWrite : false,
  vertexColors : true,
  depthTest : true,
})

const fire_explosions_uniforms = buildFireUniforms(
  lerpFiveFireStates(
    fireStates.explosions.left,
    fireStates.explosions.left_middle,
    fireStates.explosions.middle,
    fireStates.explosions.right_middle,
    fireStates.explosions.right,
    fireLerp
));

const fire_explosions_mat = new THREE.ShaderMaterial({
  vertexShader: fireVertexShader,
  fragmentShader: fireFragmentShader,
  uniforms: fire_explosions_uniforms,
  transparent : true,
  side : THREE.DoubleSide,
  alphaTest : 0.5,
  depthWrite : false,
  vertexColors : true,
  depthTest : true,
})

const log_uniforms = buildLogUniforms(
  lerpFiveLogStates(
    logStates.log.left,
    logStates.log.left_middle,
    logStates.log.middle,
    logStates.log.right_middle,
    logStates.log.right,
    fireLerp
  )
);

const log_mat = new CustomShaderMaterial({
  baseMaterial: THREE.MeshStandardMaterial,
  vertexShader: logVertexShader,
  fragmentShader: logFragmentShader,
  uniforms: log_uniforms,
  vertexColors: true,
})

const coal_uniforms = 
  buildLogUniforms(
    lerpFiveLogStates(
      logStates.coal.left,
      logStates.coal.left_middle,
      logStates.coal.middle,
      logStates.coal.right_middle,
      logStates.coal.right,
      fireLerp
    )
  );

const coal_mat = new CustomShaderMaterial({
  baseMaterial: THREE.MeshStandardMaterial,
  vertexShader: logVertexShader,
  fragmentShader: logFragmentShader,
  uniforms: coal_uniforms,
  vertexColors: true,
})

const ember_bed_uniforms = buildLogUniforms(
  lerpFiveLogStates(
    logStates.ember_bed.left,
    logStates.ember_bed.left_middle,
    logStates.ember_bed.middle,
    logStates.ember_bed.right_middle,
    logStates.ember_bed.right,
    fireLerp
  )
);

const ember_bed_mat = new CustomShaderMaterial({
  baseMaterial: THREE.MeshStandardMaterial,
  vertexShader: logVertexShader,
  fragmentShader: logFragmentShader,
  uniforms: ember_bed_uniforms,
  vertexColors: true,
})

// STOVE BODY --------------------------

const stove_insulation_light_uniforms = buildStoveUniforms(
  lerpFiveStoveStates(
    stoveStates.stove_insulation.left,
    stoveStates.stove_insulation.left_middle,
    stoveStates.stove_insulation.middle,
    stoveStates.stove_insulation.right_middle,
    stoveStates.stove_insulation.right,
    fireLerp
  )
)

const stove_insulation_light_mat = new CustomShaderMaterial({
  vertexColors: true,
  baseMaterial: THREE.MeshPhysicalMaterial, 
  specularIntensityMap: stoveAO,
  vertexShader: stoveBodyVertexShader,
  fragmentShader: stoveBodyFragmentShader,
  uniforms: stove_insulation_light_uniforms,
  side: THREE.FrontSide,
});

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
  stoveRoughA: { value: 0.241 },
  stoveRoughB: { value: 0.103 },
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

document.getElementById('setUnpackingBtn')?.addEventListener('click', () => {
  window.location.assign('/instructions.html?set=unpacking');
});

document.getElementById('setInstallationBtn')?.addEventListener('click', () => {
  window.location.assign('/instructions.html?set=installation');
});

document.getElementById('airControlsBtn')?.addEventListener('click', () => {
  window.location.assign('/stoveDemo.html');
});

const menuToggle = document.getElementById('menu-toggle');
const setSelector = document.getElementById('set-selector');
if (menuToggle && setSelector) {
  menuToggle.addEventListener('click', () => {
    const isOpen = setSelector.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

const container = document.getElementById('container');

const stats = new Stats();
container.appendChild(stats.dom);
stats.dom.style.display = 'none';

// Slider for targetLerp (0-1)
lerpSlider = document.createElement('input');
lerpSlider.type = 'range';
lerpSlider.min = '0';
lerpSlider.max = '1';
lerpSlider.step = '0.01';
lerpSlider.value = targetLerp;
Object.assign(lerpSlider.style, {
  position: 'fixed',
  bottom: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '300px',
  zIndex: '1000',
  userSelect: 'none',
  webkitUserSelect: 'none',
  webkitTouchCallout: 'none',
  touchAction: 'none',
  accentColor: '#e5531a',
});
lerpSlider.addEventListener('input', (e) => setTarget(parseFloat(e.target.value)));
// container.appendChild(lerpSlider);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(0.5, 0.1, 1.5);

const renderer = new THREE.WebGLRenderer({ antialias: qualityTier !== 'low' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.style.touchAction = 'none';
renderer.domElement.style.userSelect = 'none';
renderer.domElement.style.webkitUserSelect = 'none';
renderer.domElement.style.webkitTouchCallout = 'none';

container.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = 'none';

const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.1,   // intensity
  0.1,   // radius
  0.85    // threshold
);

composer.addPass(bloom);

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
    console.error('Failed to load HDR environment map for stoveDemo:', error);
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
setupLeverDragInteraction();

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
    stoveModel = gltf.scene;
    model.position.set(0, 0, 0);
    scene.add(model);
    
    
    model.traverse((child) => {
      if (!child.isMesh) return;

      const oldMat = child.material;
      oldMat.dispose();

      let materialType = null;
      let baseMaterial = null;
      
      if (child.isMesh) {
        
        if (child.material.name === 'cast_iron') {
          child.material = cast_iron_mat;

        } else if (child.material.name === 'insulation_surface') {
          materialType = 'stove';
          baseMaterial = stove_insulation_light_mat;
          
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

        if (baseMaterial && materialType) {
        baseMaterial.uniforms.TIME = { value : 0};
        baseMaterial.uniforms.stoveMasks = { value : stoveMasks};
        baseMaterial.uniforms.stoveAO = { value : stoveAO};
        baseMaterial.uniforms.stoveNormals = { value : stoveNormals};
        child.material = baseMaterial;

        materialsByType[materialType].push(baseMaterial);
        customMaterials.push(baseMaterial);
      }
  

      };
    });

    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
      actions[clip.name] = action;
    });
    
    console.log('Available actions:', Object.keys(actions));

    registerLeverDragTargets(stoveModel, gltf.animations);


    document.querySelectorAll('#buttons button').forEach((btn, i) => {
      btn.style.cssText = 'padding:5px 15px;font-size:15px;cursor:pointer;background:#fff;border:1px solid #ccc;border-radius:4px;';
      btn.addEventListener('click', () => {
        playAction(animNames[i]);
      });
    });

    const demoSequenceBtn = document.querySelector('#btn-12');
    demoSequenceBtn?.addEventListener('click', () => {
      playSequence(['step_2', 'step_3']);
    });

  },
  undefined,
  (error) => { console.error(error); }
);

loader.load(
  '/assets/gltf/fire.glb',
  (gltf) => {
    model = gltf.scene;
    model.position.set(0, 0, 0);
    scene.add(model);

    model.traverse((child) => {
      let materialType = null;
      let baseMaterial = null;

      if (!child.isMesh) return;

      if (wood_fire_meshes && coal_fire_meshes && fire_cylinder_meshes && fire_explosion_meshes.has(child.name)){
        child.castShadow = false;
        child.receiveShadow = false;
      };

      if (wood_fire_meshes.has(child.name)){
        materialType = 'cards';
        baseMaterial = fire_cards_mat.clone();
        woodFireMeshObjects.push(child);
        // child.visible = false;

      } else if (coal_fire_meshes.has(child.name)){
        materialType = 'cards';
        baseMaterial = fire_cards_mat.clone();
        coalFireMeshObjects.push(child);
        // child.visible = false;

      } else if (fire_cylinder_meshes.has(child.name)){
        materialType = 'cylinders';
        baseMaterial = fire_cylinders_mat.clone();

      } else if (fire_explosion_meshes.has(child.name)){
        materialType = 'explosions';
        baseMaterial = fire_explosions_mat.clone();
        explosionsMeshObjects.push(child);
        // child.visible = false;

      } else if (log_meshes.has(child.name)){
        materialType = 'log';
        baseMaterial = log_mat.clone();
        woodFireMeshObjects.push(child);

      } else if (coal_meshes.has(child.name)){
        materialType = 'coal';
        baseMaterial = coal_mat.clone();
        coalFireMeshObjects.push(child);
        // child.visible = false;

      } else if (ember_bed_meshes.has(child.name)){
        materialType = 'ember_bed';
        baseMaterial = ember_bed_mat.clone();

      };

      if (baseMaterial && materialType) {
        baseMaterial.uniforms.TIME = { value : 0},

        baseMaterial.uniforms.gradientSpeedDelta = { value: 0 },
        baseMaterial.uniforms.vtxNoiseSpeedDelta = { value: 0 },
        baseMaterial.uniforms.fireSpeedDelta = { value: 0 },
        baseMaterial.uniforms.fireSpeedHDelta = { value: 0 },
        baseMaterial.uniforms.fireFlickerSpeedDelta = { value: 0 },
        baseMaterial.uniforms.noiseSpeedDelta = { value: 0 },
        baseMaterial.uniforms.fireSpeedDelta = { value: 0 },

        
        baseMaterial.uniforms.noiseTex = { value : noiseTex};
        baseMaterial.uniforms.gradientTex = { value : gradientTex};
        baseMaterial.uniforms.logTex = { value : logTex};
        child.material = baseMaterial;

        materialsByType[materialType].push(baseMaterial);
        customMaterials.push(baseMaterial);
      }
    });

    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
      actions[clip.name] = action;
    });
  
  },
  undefined,
  (error) => { console.error(error); }
);


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});


window.playActionLerp = playActionLerp;
window.actions = actions;
window.customMaterials = customMaterials;
