import * as THREE from 'three';

class CameraValues {
  constructor(initial = {}) {
    Object.assign(this, initial);
  }

  setStep(setName, stepName, { position, rotation }) {
    if (!this[setName]) this[setName] = {};
    this[setName][stepName] = {
      position: position.clone ? position.clone() : new THREE.Vector3(...position),
      rotation: rotation.clone ? rotation.clone() : new THREE.Euler(...rotation),
    };
    return this[setName][stepName];
  }

  getStep(setName, stepName) {
    return this[setName]?.[stepName];
  }
}

const cameraValues = new CameraValues({
  unpacking: {
    step_1: {
      position: new THREE.Vector3(1.29048, -0.943253, 1.54497),
      rotation: new THREE.Euler(52, 0, 53),
    },
    step_2: {
      position: new THREE.Vector3(1.47905, -1.40783, 0.036086),
      rotation: new THREE.Euler(88.7135, 0, 51.9645),
    },
    step_3: {
      position: new THREE.Vector3(1.47905, -1.40783, 0.036086),
      rotation: new THREE.Euler(88.7135, 0, 51.9645),
    },
    step_4: {
      position: new THREE.Vector3(1.47905, -1.40783, 0.036086),
      rotation: new THREE.Euler(88.7135, 0, 51.9645),
    },
    step_5: {
      position: new THREE.Vector3(0.001052, -0.972269, -0.487812),
      rotation: new THREE.Euler(121.524, 0, 0),
    },
    step_6: {
      position: new THREE.Vector3(-0.020895, -2.0486, -0.084951),
      rotation: new THREE.Euler(91.7752, 0, 0.728345),
    },
    step_7: {
      position: new THREE.Vector3(-0.037177, -1.64876, 1.19047),
      rotation: new THREE.Euler(52.9871, 0, 0),
    },
    step_8: {
      position: new THREE.Vector3(1.08274, -0.830344, 1.17098),
      rotation: new THREE.Euler(50.7998, 0, 53.5898),
    },
    step_9: {
      position: new THREE.Vector3(1.09436, 1.42217, 0.113837),
      rotation: new THREE.Euler(86.1618, 0, 142.542),
    },
    step_10: {
      position: new THREE.Vector3(1.09436, 1.42217, 0.113837),
      rotation: new THREE.Euler(86.1618, 0, 142.542),
    },
  },
  installation: {
    step_1: {
      position: new THREE.Vector3(1.47905, -1.40783, 0.036086),
      rotation: new THREE.Euler(88.7135, 0, 51.9645),
    },
    step_2: {
      position: new THREE.Vector3(0.001052, -0.972269, -0.487812),
      rotation: new THREE.Euler(121.524, 0, 0),
    },
    step_3: {
      position: new THREE.Vector3(1.09436, 1.42217, 0.113837),
      rotation: new THREE.Euler(86.1618, 0, 142.542),
    },
    step_4: {
      position: new THREE.Vector3(1.09436, 1.42217, 0.113837),
      rotation: new THREE.Euler(86.1618, 0, 142.542),
    },
    step_5: {
      position: new THREE.Vector3(0.615079, 1.02734, -1.0731),
      rotation: new THREE.Euler(117.878, 0, 149.468),
    },
    step_6: {
      position: new THREE.Vector3(0.001052, -0.972269, -0.487812),
      rotation: new THREE.Euler(121.524, 0, 0),
    },
    step_7: {
      position: new THREE.Vector3(1.09436, 1.42217, 0.113837),
      rotation: new THREE.Euler(86.1618, 0, 142.542),
    },
    step_8: {
      position: new THREE.Vector3(0.001052, -0.972269, -0.487812),
      rotation: new THREE.Euler(121.524, 0, 0),
    },
    step_9: {
      position: new THREE.Vector3(1.09436, 1.42217, 0.113837),
      rotation: new THREE.Euler(86.1618, 0, 142.542),
    },
    step_10: {
      position: new THREE.Vector3(0.001052, -0.972269, -0.487812),
      rotation: new THREE.Euler(121.524, 0, 0),
    },
  },
});

export { CameraValues, cameraValues };
