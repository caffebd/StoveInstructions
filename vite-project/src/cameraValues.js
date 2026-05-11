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
    step_3: {
      position: new THREE.Vector3(1.035256, 0.235604, 1.175898),
      rotation: new THREE.Euler(-11.329805, 40.802068, 7.459041),
    },
    step_6: {
      position: new THREE.Vector3(0.045265, -0.601434, 1.298974),
      rotation: new THREE.Euler(26.284813, 1.697044, -0.837989),
    },
    step_10: {
      position: new THREE.Vector3(0.765069, 0.481056, -1.302663),
      rotation: new THREE.Euler(-161.225466, 28.762061, 170.71061),
    },
    step_11: {
      position: new THREE.Vector3(0.667788, 0.51511, -1.168457),
      rotation: new THREE.Euler(-161.225466, 28.762061, 170.71061),
    },
    positioning_stove: {
      position: new THREE.Vector3(-0.657003, -0.980395, 0.805632),
      rotation: new THREE.Euler(35.486909, -32.608355, 21.016943),
    },
    top_outlet_config: {
      position: new THREE.Vector3(-0.254048, -0.389538, 0.563338),
      rotation: new THREE.Euler(40.569174, -18.870391, 15.477943),
    },
    rear_outlet_config_1: {
      position: new THREE.Vector3(0.517878, 0.318898, -0.919049),
      rotation: new THREE.Euler(-172.64268, 29.174947, 176.398377),
    },
    rear_outlet_config_2: {
      position: new THREE.Vector3(-0.157332, -0.322599, 0.385214),
      rotation: new THREE.Euler(48.902575, -17.005944, 18.536102),
    },
    rear_outlet_config_3: {
      position: new THREE.Vector3(-0.410012, 0.899713, 0.684473),
      rotation: new THREE.Euler(-37.182597, -22.32989, -16.077372),
    },
    rear_outlet_config_4: {
      position: new THREE.Vector3(0.490446, 0.444156, -1.309415),
      rotation: new THREE.Euler(-167.288555, 15.79623, 176.486229),
    },
    flue_cage_install: {
      position: new THREE.Vector3(0.158223, -0.35313, 0.495232),
      rotation: new THREE.Euler(43.716626, 9.844696, -9.284875),
    },
  },
});

export { CameraValues, cameraValues };
