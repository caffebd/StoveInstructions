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
    step_2: {
      position: new THREE.Vector3(1.054553, 1.107653, 0.847028),
      rotation: new THREE.Euler(-52.594648, 37.099388, 38.266357),
    },
    step_3: {
      position: new THREE.Vector3(0.72035, 0.540348, 1.589729),
      rotation: new THREE.Euler(-21.931931, 22.668044, 8.820575),
    },
    step_4: {
      position: new THREE.Vector3(0.657158, 0.483836, 1.449377),
      rotation: new THREE.Euler(-21.931931, 22.668044, 8.820575),
    },
    step_5: {
      position: new THREE.Vector3(0.657158, 0.483836, 1.449377),
      rotation: new THREE.Euler(-21.931931, 22.668044, 8.820575),
    },
    step_6: {
      position: new THREE.Vector3(0.050082, -0.378384, 1.082743),
      rotation: new THREE.Euler(21.997591, 4.717068, -1.902737),
    },
    step_7: {
      position: new THREE.Vector3(0.092364, -0.03748, 1.151413),
      rotation: new THREE.Euler(2.202197, 7.111809, -0.272777),
    },
    step_8: {
      position: new THREE.Vector3(0.759746, 0.422165, 0.998009),
      rotation: new THREE.Euler(-27.965571, 37.302624, 17.83621),
    },
    step_9: {
      position: new THREE.Vector3(0.432653, 1.029932, 0.784549),
      rotation: new THREE.Euler(-50.717989, 20.982013, 23.641992),
    },
    step_10: {
      position: new THREE.Vector3(-0.467965, 0.846993, -0.879718),
      rotation: new THREE.Euler(-133.740203, -23.132649, -157.680444),
    },
    step_11: {
      position: new THREE.Vector3(-0.467971, 0.846992, -0.879715),
      rotation: new THREE.Euler(-133.740203, -23.132649, -157.680444),
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
