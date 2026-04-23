import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { fireVertexShader, fireFragmentShader } from './shaders/fireShader.js';
import { logsVertexShader, logsFragmentShader } from './shaders/logsShader.js';
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ReflectorForSSRPass } from 'three/addons/objects/ReflectorForSSRPass.js';

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
    if (mat.uniforms.firePhase) {
      const speedUniform = mat.uniforms.fireSpeed;
      if (speedUniform && typeof speedUniform.value === 'number') {
        const currentFireSpeed = speedUniform.value;
        mat.uniforms.firePhase.value += delta * currentFireSpeed;
      }
    }
  });
  
  if (mixer) mixer.update(delta);
  if (controls) controls.update();

  composer.render();
}
function setTarget(value) {
  targetLerp = value;
}
function updateLerp(deltaTime) {
  if (Math.abs(targetLerp - animLerp) < 0.001) return;

  const animSpeed = 0.5;
  const fireSpeed = 0.5;

  animLerp += (targetLerp - animLerp) * animSpeed * deltaTime;
  fireLerp += (targetLerp - fireLerp) * fireSpeed * deltaTime;

  // Update each material type with its own blended state
  updateFireMaterialType('cards', materialsByType.cards);
  updateFireMaterialType('cylinders', materialsByType.cylinders);
  updateFireMaterialType('explosions', materialsByType.explosions);
  updateLogMaterialType('logs', materialsByType.logs);

  playActionLerp('stove_lever', animLerp);
}
function updateFireMaterialType(type, materials) {
  if (materials.length === 0) return;

  const states = fireStates[type];
  const blended = lerpThreeFireStates(states.left, states.middle, states.right, fireLerp);

  materials.forEach(mat => {
    mat.uniforms.vColRAffect.value = blended.vColRAffect;
    mat.uniforms.vColGAffect.value = blended.vColGAffect;
    mat.uniforms.UV_Y_Affect.value = blended.UV_Y_Affect;
    mat.uniforms.fireSize.value = blended.fireSize;
    mat.uniforms.fireSpeed.value = blended.fireSpeed;
    mat.uniforms.fireAmount.value = blended.fireAmount;
    mat.uniforms.fireDensity.value = blended.fireDensity;
    mat.uniforms.fireBorderTop.value = blended.fireBorderTop;
    mat.uniforms.fireBorderBottom.value = blended.fireBorderBottom;
    mat.uniforms.fireDirection.value = blended.fireDirection;
    mat.uniforms.fireStability.value = blended.fireStability;
    mat.uniforms.fireFlickerAmount.value = blended.fireFlickerAmount;
    mat.uniforms.fireFlickerSpeed.value = blended.fireFlickerSpeed;
    mat.uniforms.fireWarp.value = blended.fireWarp;
    mat.uniforms.noiseScale.value = blended.noiseScale;
    mat.uniforms.noiseSpeed.value = blended.noiseSpeed;
    mat.uniforms.worldUVScale.value = blended.worldUVScale;
    mat.uniforms.meshDisplaceRange.value = blended.meshDisplaceRange;
    mat.uniforms.meshDisplaceSpeed.value = blended.meshDisplaceSpeed;
    mat.uniforms.xDisplaceAmount.value = blended.xDisplaceAmount;
    mat.uniforms.yDisplaceAmount.value = blended.yDisplaceAmount;
    mat.uniforms.zDisplaceAmount.value = blended.zDisplaceAmount;
    mat.uniforms.xOffsetDir.value = blended.xOffsetDir;
    mat.uniforms.yOffsetDir.value = blended.yOffsetDir;
    mat.uniforms.zOffsetDir.value = blended.zOffsetDir;
  });
}
function updateLogMaterialType(type, materials) {
  if (materials.length === 0) return;

  const states = logStates[type];
  const blended = lerpThreeLogStates(states.left, states.middle, states.right, fireLerp);

  materials.forEach(mat => {
    mat.uniforms.burnCol.value = blended.burnCol;
    mat.uniforms.glowCol.value = blended.glowCol;
    mat.uniforms.burnAmount.value = blended.burnAmount;
    mat.uniforms.burnStrength.value = blended.burnStrength;
    mat.uniforms.glowAmount.value = blended.glowAmount;
    mat.uniforms.glowStrength.value = blended.glowStrength;
  });
}
function lerp(a, b, t) {
  return a * (1 - t) + b * t;
}
function lerpFireState(a, b, t) {
  const result = new FireState();

  result.vColRAffect = lerp(a.vColRAffect, b.vColRAffect, t);
  result.vColGAffect = lerp(a.vColGAffect, b.vColGAffect, t);
  result.UV_Y_Affect = lerp(a.UV_Y_Affect, b.UV_Y_Affect, t);
  result.fireSize = lerp(a.fireSize, b.fireSize, t);
  result.fireSpeed = lerp(a.fireSpeed, b.fireSpeed, t);
  result.fireAmount = lerp(a.fireAmount, b.fireAmount, t);
  result.fireDensity = lerp(a.fireDensity, b.fireDensity, t);
  result.fireBorderTop = lerp(a.fireBorderTop, b.fireBorderTop, t);
  result.fireBorderBottom = lerp(a.fireBorderBottom, b.fireBorderBottom, t);
  result.fireDirection = lerp(a.fireDirection, b.fireDirection, t);
  result.fireStability = lerp(a.fireStability, b.fireStability, t);
  result.fireFlickerAmount = lerp(a.fireFlickerAmount, b.fireFlickerAmount, t);
  result.fireFlickerSpeed = lerp(a.fireFlickerSpeed, b.fireFlickerSpeed, t);
  result.fireWarp = lerp(a.fireWarp, b.fireWarp, t);

  result.noiseScale = lerp(a.noiseScale, b.noiseScale, t);
  result.noiseSpeed = lerp(a.noiseSpeed, b.noiseSpeed, t);
  result.worldUVScale = lerp(a.worldUVScale, b.worldUVScale, t);
  result.meshDisplaceRange = lerp(a.meshDisplaceRange, b.meshDisplaceRange, t);
  result.meshDisplaceSpeed = lerp(a.meshDisplaceSpeed, b.meshDisplaceSpeed, t);
  result.xDisplaceAmount = lerp(a.xDisplaceAmount, b.xDisplaceAmount, t);

  result.yDisplaceAmount = lerp(a.yDisplaceAmount, b.yDisplaceAmount, t);
  result.zDisplaceAmount = lerp(a.zDisplaceAmount, b.zDisplaceAmount, t);
  result.xOffsetDir = lerp(a.xOffsetDir, b.xOffsetDir, t);
  result.yOffsetDir = lerp(a.yOffsetDir, b.yOffsetDir, t);
  result.zOffsetDir = lerp(a.zOffsetDir, b.zOffsetDir, t);

  return result;
}
function lerpLogState(a, b, t) {
  const result = new LogState();

  result.burnCol = [lerp(a.burnCol[0], b.burnCol[0], t), lerp(a.burnCol[1], b.burnCol[1], t), lerp(a.burnCol[2], b.burnCol[2], t)];
  result.glowCol = [lerp(a.glowCol[0], b.glowCol[0], t), lerp(a.glowCol[1], b.glowCol[1], t), lerp(a.glowCol[2], b.glowCol[2], t)];
  result.burnAmount = lerp(a.burnAmount, b.burnAmount, t);
  result.burnStrength = lerp(a.burnStrength, b.burnStrength, t);
  result.glowAmount = lerp(a.glowAmount, b.glowAmount, t);
  result.glowStrength = lerp(a.glowStrength, b.glowStrength, t);

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
function lerpThreeLogStates(left, middle, right, t) {
  if (t <= 0.5) {
    const localT = t * 2.0;
    return lerpLogState(left, middle, localT);
  } else {
    const localT = (t - 0.5) * 2.0;
    return lerpLogState(middle, right, localT);
  }
}
class FireState {
  constructor({
    vColRAffect = 1.0,
    vColGAffect = 0.0,
    UV_Y_Affect = 0.5590000265525,
    fireSize = 0.6350000301625,
    fireSpeed = 0.5550000263625,
    fireAmount = 0.9290000441275,
    fireDensity = 0.5710000271225,
    fireBorderTop = 0.4370000207575,
    fireBorderBottom = 0.2670000126825,
    fireDirection = 0.5,
    fireStability = 1.0,
    fireFlickerAmount = 0.02800000133,
    fireFlickerSpeed = 0.5,
    fireWarp = 0.138000006555,
    noiseScale = 0.3710000176225,
    noiseSpeed = 0.174000008265,
    worldUVScale = 11.575,
    meshDisplaceRange = 0.027000001282499998,
    meshDisplaceSpeed = 0.106000005035,
    xDisplaceAmount = 1.0,
    yDisplaceAmount = 0.0,
    zDisplaceAmount = 0.0,
    xOffsetDir = 0.0,
    yOffsetDir = 0.0,
    zOffsetDir = 0.0,
  } = {}) {
    this.vColRAffect = vColRAffect;
    this.vColGAffect = vColGAffect;
    this.UV_Y_Affect = UV_Y_Affect;
    this.fireSize = fireSize;
    this.fireSpeed = fireSpeed;
    this.fireAmount = fireAmount;
    this.fireDensity = fireDensity;
    this.fireBorderTop = fireBorderTop;
    this.fireBorderBottom = fireBorderBottom;
    this.fireDirection = fireDirection;
    this.fireStability = fireStability;
    this.fireFlickerAmount = fireFlickerAmount;
    this.fireFlickerSpeed = fireFlickerSpeed;
    this.fireWarp = fireWarp;
    this.noiseScale = noiseScale;
    this.noiseSpeed = noiseSpeed;
    this.worldUVScale = worldUVScale;
    this.meshDisplaceRange = meshDisplaceRange;
    this.meshDisplaceSpeed = meshDisplaceSpeed;
    this.xDisplaceAmount = xDisplaceAmount;
    this.yDisplaceAmount = yDisplaceAmount;
    this.zDisplaceAmount = zDisplaceAmount;
    this.xOffsetDir = xOffsetDir;
    this.yOffsetDir = yOffsetDir;
    this.zOffsetDir = zOffsetDir;
  }
}
class LogState {
  constructor({
    burnCol = [0.18777841, 0.17290697, 0.12215609],
    glowCol = [1, 0.18039216, 0],
    burnAmount = 0.6550000311125,
    burnStrength = 0.2000000095,
    glowAmount = 0.754000035815,
    glowStrength = 0.1150000054625,
  } = {}) {
    this.burnCol = burnCol;
    this.glowCol = glowCol;
    this.burnAmount = burnAmount;
    this.burnStrength = burnStrength;
    this.glowAmount = glowAmount;
    this.glowStrength = glowStrength;
  }
}
function buildFireUniforms(state) {
  return {
    vColRAffect: { value: state.vColRAffect },
    vColGAffect: { value: state.vColGAffect },
    UV_Y_Affect: { value: state.UV_Y_Affect },
    fireSize: { value: state.fireSize },
    fireSpeed: { value: state.fireSpeed },
    fireAmount: { value: state.fireAmount },
    fireDensity: { value: state.fireDensity },
    fireBorderTop: { value: state.fireBorderTop },
    fireBorderBottom: { value: state.fireBorderBottom },
    fireDirection: { value: state.fireDirection },
    fireStability: { value: state.fireStability },
    fireFlickerAmount: { value: state.fireFlickerAmount },
    fireFlickerSpeed: { value: state.fireFlickerSpeed },
    fireWarp: { value: state.fireWarp },

    noiseScale: { value: state.noiseScale },
    noiseSpeed: { value: state.noiseSpeed },
    worldUVScale: { value: state.worldUVScale },
    meshDisplaceRange: { value: state.meshDisplaceRange },
    meshDisplaceSpeed: { value: state.meshDisplaceSpeed },
    xDisplaceAmount: { value: state.xDisplaceAmount },
    yDisplaceAmount: { value: state.yDisplaceAmount },
    zDisplaceAmount: { value: state.zDisplaceAmount },
    xOffsetDir: { value: state.xOffsetDir },
    yOffsetDir: { value: state.yOffsetDir },
    zOffsetDir: { value: state.zOffsetDir },
  };
}
function buildLogUniforms(state) {
  return {
    burnCol: { value: state.burnCol },
    glowCol: { value: state.glowCol },
    burnAmount: { value: state.burnAmount },
    burnStrength: { value: state.burnStrength },
    glowAmount: { value: state.glowAmount },
    glowStrength: { value: state.glowStrength },
  };
}
const fireStates = {
  cards: {
    left: new FireState({
      vColRAffect : 1.0,
      vColGAffect : 0.0,
      UV_Y_Affect : 1.0,
      fireSize : 0.6350000301625,
      fireSpeed : 0.71200003382,
      fireAmount : 0.8390000398525,
      fireDensity : 0.382000018145,
      fireBorderTop : 0.3370000160075,
      fireBorderBottom : 0.2010000095475,
      fireDirection : 0.5,
      fireStability : 1.0,
      fireFlickerAmount : 0.0,
      fireFlickerSpeed : 0.5,
      fireWarp : 0.1110000052725,
      noiseScale : 0.35200001672,
      noiseSpeed : 0.174000008265,
      worldUVScale : 11.575,
      meshDisplaceRange : 0.02700000128249999,
      meshDisplaceSpeed : 0.106000005035,
      xDisplaceAmount : 0.1,
      yDisplaceAmount : 0.0,
      zDisplaceAmount : 0.0,
      xOffsetDir : 0.0,
      yOffsetDir : 0.0,
      zOffsetDir : 0.0,
    }),
    middle: new FireState({
      vColRAffect : 0.4790000227525,
      vColGAffect : 0.74400003534,
      UV_Y_Affect : 0.35600001691,
      fireSize : 0.2370000112575,
      fireSpeed : 0.2050000097375,
      fireAmount : 0.834000039615,
      fireDensity : 0.1890000089775,
      fireBorderTop : 0.2050000097375,
      fireBorderBottom : 0.182000008645,
      fireDirection : 0.5,
      fireStability : 0.9710000461225,
      fireFlickerAmount : 0.0,
      fireFlickerSpeed : 0.5,
      fireWarp : 0.106000005035,
      noiseScale : 0.19600000931,
      noiseSpeed : 0.1130000053675,
      worldUVScale : 11.575,
      meshDisplaceRange : 0.1330000063175,
      meshDisplaceSpeed : 0.2650000125875,
      xDisplaceAmount : 0.15200000722,
      yDisplaceAmount : 0.0,
      zDisplaceAmount : 0.0,
      xOffsetDir : 0.08500005153750001,
      yOffsetDir : 0.0,
      zOffsetDir : -0.10399995744000001,
    }),
    right: new FireState({
      vColRAffect : 0.0,
      vColGAffect : 1.0,
      UV_Y_Affect : 0.0950000045125,
      fireSize : 0.5350000254125,
      fireSpeed : 0.774000036765,
      fireAmount : 0.8390000398525,
      fireDensity : 0.2110000100225,
      fireBorderTop : 0.2230000105925,
      fireBorderBottom : 0.1770000084075,
      fireDirection : 0.5,
      fireStability : 1.0,
      fireFlickerAmount : 0.0,
      fireFlickerSpeed : 0.5,
      fireWarp : 0.1110000052725,
      noiseScale : 0.35200001672,
      noiseSpeed : 0.174000008265,
      worldUVScale : 11.575,
      meshDisplaceRange : 0.02700000128249999,
      meshDisplaceSpeed : 0.106000005035,
      xDisplaceAmount : 0.1,
      yDisplaceAmount : 0.0,
      zDisplaceAmount : 0.0,
      xOffsetDir : 0.0,
      yOffsetDir : 0.0,
      zOffsetDir : 0.0,
    })
  },
  cylinders: {
    left: new FireState({
      vColRAffect : 1.0,
      vColGAffect : 0.0,
      UV_Y_Affect : 0.0,
      fireSize : 0.4010000190475,
      fireSpeed : 1.0,
      fireAmount : 0.0,
      fireDensity : 0.5,
      fireBorderTop : 0.166000007885,
      fireBorderBottom : 0.21600001026,
      fireDirection : 0.5,
      fireStability : 1.0,
      fireFlickerAmount : 0.0,
      fireFlickerSpeed : 0.5,
      fireWarp : 0.5,
      noiseScale : 0.5,
      noiseSpeed : 0.5,
      worldUVScale : 15.525,
      meshDisplaceRange : 0.0230000010925,
      meshDisplaceSpeed : 0.5,
      xDisplaceAmount : 0.1,
      yDisplaceAmount : 0.1,
      zDisplaceAmount : 0.1,
      xOffsetDir : 0.0,
      yOffsetDir : 0.0,
      zOffsetDir : 0.0,
    }),
    middle: new FireState({
      vColRAffect : 1.0,
      vColGAffect : 0.0,
      UV_Y_Affect : 0.0,
      fireSize : 0.4010000190475,
      fireSpeed : 1.0,
      fireAmount : 0.0,
      fireDensity : 0.5,
      fireBorderTop : 0.166000007885,
      fireBorderBottom : 0.21600001026,
      fireDirection : 0.5,
      fireStability : 1.0,
      fireFlickerAmount : 0.0,
      fireFlickerSpeed : 0.5,
      fireWarp : 0.5,
      noiseScale : 0.5,
      noiseSpeed : 0.5,
      worldUVScale : 15.525,
      meshDisplaceRange : 0.0230000010925,
      meshDisplaceSpeed : 0.5,
      xDisplaceAmount : 0.1,
      yDisplaceAmount : 0.1,
      zDisplaceAmount : 0.1,
      xOffsetDir : 0.0,
      yOffsetDir : 0.0,
      zOffsetDir : 0.0,
    }),
    right: new FireState({
      vColRAffect : 1.0,
      vColGAffect : 0.0,
      UV_Y_Affect : 0.0950000045125,
      fireSize : 0.4170000198075,
      fireSpeed : 0.774000036765,
      fireAmount : 0.8770000416575,
      fireDensity : 0.2490000118275,
      fireBorderTop : 0.278000013205,
      fireBorderBottom : 0.2000000095,
      fireDirection : 0.5,
      fireStability : 0.5600000266,
      fireFlickerAmount : 0.3330000158175,
      fireFlickerSpeed : 0.28400001349,
      fireWarp : 0.20400000969,
      noiseScale : 0.35200001672,
      noiseSpeed : 0.174000008265,
      worldUVScale : 11.575,
      meshDisplaceRange : 0.050000002375,
      meshDisplaceSpeed : 1.0,
      xDisplaceAmount : 0.1050000049875,
      yDisplaceAmount : 0.194000009215,
      zDisplaceAmount : 0.10400000494,
      xOffsetDir : 0.0,
      yOffsetDir : 0.0,
      zOffsetDir : 0.0,
    })
  },
  explosions: {
    left: new FireState({
      vColRAffect : 1.0,
      vColGAffect : 0.0,
      UV_Y_Affect : 0.0,
      fireSize : 0.55200002622,
      fireSpeed : 0.758000036005,
      fireAmount : 0.4850000230375,
      fireDensity : 0.0,
      fireBorderTop : 0.2330000110675,
      fireBorderBottom : 0.1010000047975,
      fireDirection : 0.5,
      fireStability : 0.0,
      fireFlickerAmount : 0.0,
      fireFlickerSpeed : 0.5,
      fireWarp : 0.12400000589,
      noiseScale : 0.32400001539,
      noiseSpeed : 0.26400001254,
      worldUVScale : 11.575,
      meshDisplaceRange : 0.027000001282499998,
      meshDisplaceSpeed : 0.106000005035,
      xDisplaceAmount : 1.0,
      yDisplaceAmount : 0.0,
      zDisplaceAmount : 0.0,
      xOffsetDir : 0.0,
      yOffsetDir : 0.0,
      zOffsetDir : 0.0,
    }),
    middle: new FireState({
      vColRAffect : 1.0,
      vColGAffect : 0.0,
      UV_Y_Affect : 0.0,
      fireSize : 0.3730000177175,
      fireSpeed : 0.3130000148675,
      fireAmount : 0.7730000367175,
      fireDensity : 0.2410000114475,
      fireBorderTop : 0.3470000164825,
      fireBorderBottom : 0.22000001045,
      fireDirection : 0.5,
      fireStability : 1.0,
      fireFlickerAmount : 0.0,
      fireFlickerSpeed : 0.5,
      fireWarp : 0.06800000323,
      noiseScale : 0.35200001672,
      noiseSpeed : 0.1270000060325,
      worldUVScale : 11.575,
      meshDisplaceRange : 0.02700000128249999,
      meshDisplaceSpeed : 0.106000005035,
      xDisplaceAmount : 0.1,
      yDisplaceAmount : 0.0,
      zDisplaceAmount : 0.0,
      xOffsetDir : 0.0,
      yOffsetDir : 0.0,
      zOffsetDir : 0.0,
    }),
    right: new FireState({
      vColRAffect : 1.0,
      vColGAffect : 0.0,
      UV_Y_Affect : 0.0,
      fireSize : 0.3730000177175,
      fireSpeed : 0.61200002907,
      fireAmount : 0.782000037145,
      fireDensity : 0.350000016625,
      fireBorderTop : 0.390000018525,
      fireBorderBottom : 0.234000011115,
      fireDirection : 0.5,
      fireStability : 1.0,
      fireFlickerAmount : 0.1090000051775,
      fireFlickerSpeed : 0.5,
      fireWarp : 0.1150000054625,
      noiseScale : 0.35200001672,
      noiseSpeed : 0.1270000060325,
      worldUVScale : 11.575,
      meshDisplaceRange : 0.02700000128249999,
      meshDisplaceSpeed : 0.106000005035,
      xDisplaceAmount : 0.1,
      yDisplaceAmount : 0.0,
      zDisplaceAmount : 0.0,
      xOffsetDir : 0.0,
      yOffsetDir : 0.0,
      zOffsetDir : 0.0,
    })
  }
};
const logStates = {
  logs: {
    left: new LogState({
      burnCol : [0.18777841, 0.17290697, 0.12215609],
      glowCol : [1, 0.18039216, 0],
      burnAmount : 0.6550000311125,
      burnStrength : 0.2000000095,
      glowAmount : 0.754000035815,
      glowStrength : 0.1150000054625,
    }),
    middle: new LogState({
      burnCol : [0.18777841, 0.17290697, 0.12215609],
      glowCol : [1, 0.18039216, 0],
      burnAmount : 0.6550000311125,
      burnStrength : 0.2000000095,
      glowAmount : 0.754000035815,
      glowStrength : 0.1150000054625,
    }),
    right: new LogState({
      burnCol : [0.18777841, 0.17290697, 0.12215609],
      glowCol : [1, 0.18039216, 0],
      burnAmount : 0.6550000311125,
      burnStrength : 0.2000000095,
      glowAmount : 0.754000035815,
      glowStrength : 0.1150000054625,
    })
  },
};

const materialsByType = {
  cards: [],
  cylinders: [],
  explosions: [],
  logs: []
};

const animNames = [
  // 'stove_top',
  // 'stove_door',
  // 'stove_grill',
  // 'stove_lever',
  // 'stove_ashpan'      
];

const actions = {};
const finishedActions = new Set();
const customMaterials = [];


const fireCards = new Set([
  'fire_card_01',
  'fire_card_02',
  'fire_card_03',
  'fire_card_04',
]);

const fireCylinders = new Set([
  'fire_cylinder_01',
  'fire_cylinder_02',
  'fire_cylinder_03',
  'fire_cylinder_04',
  'fire_cylinder_05',
  'fire_cylinder_06',
  'fire_cylinder_07',
  'fire_cylinder_08',
  'fire_cylinder_09',
  'fire_cylinder_10',
  'fire_cylinder_11',
  'fire_cylinder_12',
  'fire_cylinder_13',
  'fire_cylinder_14',
]);

const fireExplosions = new Set([
  'fire_explosion_01',
])

const logs = new Set([
  'logs',
])

let animLerp = 0;
let fireLerp = 0;
let targetLerp = 0;

let mixer;
let model;

// Texture loader
const textureLoader = new THREE.TextureLoader();

const fireMaskTex = textureLoader.load('/src/assets/textures/fire.png');
fireMaskTex.wrapS = THREE.RepeatWrapping;
fireMaskTex.wrapT = THREE.RepeatWrapping;

const fireColorTex = textureLoader.load('/src/assets/textures/fire_gradient.png');
fireColorTex.wrapS = THREE.RepeatWrapping;
fireColorTex.wrapT = THREE.RepeatWrapping;
fireColorTex.colorSpace = THREE.SRGBColorSpace;

const logColorTex = textureLoader.load('/src/assets/textures/logs_color.png');
logColorTex.wrapS = THREE.RepeatWrapping;
logColorTex.wrapT = THREE.RepeatWrapping;
logColorTex.colorSpace = THREE.SRGBColorSpace;

// Scene stuff
const timer = new THREE.Timer();
timer.connect(document);

const container = document.getElementById('container');

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 100);
camera.position.set(5, 2, 8);

const fireLight = new THREE.PointLight(0xff8d00, 2.0);
scene.add( fireLight );
const pointLighthelper = new THREE.PointLightHelper( fireLight, 1);
// scene.add(pointLighthelper);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const ssrPass = new SSRPass({
  renderer,
  scene,
  camera,
  width: innerWidth,
  height: innerHeight,
})

// composer.addPass(ssrPass);

const ssaoPass = new SSAOPass(renderer, camera, innerWidth, innerHeight);

// composer.addPass(ssaoPass);

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.5,   // intensity
  0.7,   // radius
  0.8    // threshold
);

composer.addPass(bloom);

const rgbe = new HDRLoader();
const envMap = await rgbe.loadAsync('src/assets/hdri/photo_studio_01_2k.hdr' );
envMap.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = envMap;
scene.environmentRotation.set(0, 0, 0);
scene.background = new THREE.Color(0xe6cdad);
scene.backgroundBlurriness = 1;
scene.backgroundIntensity = 0.9;
scene.environmentIntensity = 0.9;

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.7, 0);
controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN = 2,
  MIDDLE: THREE.MOUSE.ROTATE = 0,
  RIGHT: THREE.MOUSE.ZOOM
};

controls.update();

// GLTF Loader
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
      let materialType = null;
      let baseMaterial = null;

      if (!child.isMesh) return;

      if (fireCards && fireCylinders && fireExplosions.has(child.name)){
        child.castShadow = false;
        child.receiveShadow = false;
      };

      if (fireCards.has(child.name)){
        materialType = 'cards';
        const blended = lerpThreeFireStates(
          fireStates.cards.left,
          fireStates.cards.middle,
          fireStates.cards.right,
          fireLerp
        );
        baseMaterial = new THREE.ShaderMaterial({
          uniforms: buildFireUniforms(blended),
          vertexShader : fireVertexShader,
          fragmentShader : fireFragmentShader,
          transparent : true,
          side : THREE.DoubleSide,
          alphaTest : 0.5,
          depthWrite : false,
          vertexColors : true,
          depthTest : true,
        });
      }

      else if (fireCylinders.has(child.name)){
        materialType = 'cylinders';
        const blended = lerpThreeFireStates(
          fireStates.cylinders.left,
          fireStates.cylinders.middle,
          fireStates.cylinders.right,
          fireLerp
        );
        baseMaterial = new THREE.ShaderMaterial({
          uniforms: buildFireUniforms(blended),
          vertexShader : fireVertexShader,
          fragmentShader : fireFragmentShader,
          transparent : true,
          side : THREE.DoubleSide,
          alphaTest : 0.5,
          depthWrite : false,
          vertexColors : true,
        });
      }

      else if (fireExplosions.has(child.name)){
        materialType = 'explosions';
        const blended = lerpThreeFireStates(
          fireStates.explosions.left,
          fireStates.explosions.middle,
          fireStates.explosions.right,
          fireLerp
        );
        baseMaterial = new THREE.ShaderMaterial({
          uniforms: buildFireUniforms(blended),
          vertexShader : fireVertexShader,
          fragmentShader : fireFragmentShader,
          transparent : true,
          side : THREE.DoubleSide,
          alphaTest : 0.5,
          depthWrite : false,
          vertexColors : true,
        });
      }

      if (baseMaterial && materialType) {
        baseMaterial.uniforms.TIME = { value : 0};
        baseMaterial.uniforms.firePhase = { value : 0};
        baseMaterial.uniforms.fireTex = { value : fireMaskTex};
        baseMaterial.uniforms.fireCol = { value : fireColorTex};
        child.material = baseMaterial;

        materialsByType[materialType].push(baseMaterial);
        customMaterials.push(baseMaterial);

        console.log(`Applied ${materialType} log shader to:`, child.name);
      }
    });

    model.traverse((child) => {
      let materialType = null;
      let baseMaterial = null;

      if (!child.isMesh) return;

      else if (logs.has(child.name)){
        materialType = 'logs';
        const blended = lerpThreeLogStates(
          logStates.logs.left,
          logStates.logs.middle,
          logStates.logs.right,
          fireLerp
        );
        baseMaterial = new THREE.ShaderMaterial({
          uniforms: buildLogUniforms(blended),
          vertexShader : logsVertexShader,
          fragmentShader : logsFragmentShader,
          vertexColors : true,
        });
      }

      if (baseMaterial && materialType) {
        baseMaterial.uniforms.TIME = { value : 0};
        baseMaterial.uniforms.firePhase = { value : 0};
        baseMaterial.uniforms.logTex = { value : logColorTex};
        baseMaterial.uniforms.noiseTex = { value : fireMaskTex};
        child.material = baseMaterial;

        materialsByType[materialType].push(baseMaterial);
        customMaterials.push(baseMaterial);

        console.log(`Applied ${materialType} log shader to:`, child.name);
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


window.playActionLerp = playActionLerp;
window.actions = actions;
window.customMaterials = customMaterials;