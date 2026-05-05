import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// --- Scene setup ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 3);

// --- Load HDR environment (needed for IBL) ---
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader().load('your_env.hdr', (texture) => {
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;
  scene.environment = envMap; // <-- This is what IBL chunks sample from
  texture.dispose();
  pmremGenerator.dispose();
});

// --- Shader Material ---
const material = new THREE.ShaderMaterial({
  lights: true,           // injects Three's light uniforms
  extensions: {
    derivatives: true,    // needed for some PBR calculations
  },
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.lights,    // point/dir/spot light uniforms
    THREE.UniformsLib.fog,
    {
      // your custom PBR params
      roughness:   { value: 0.3 },
      metalness:   { value: 0.9 },
      baseColor:   { value: new THREE.Color(0x88aaff) },
      envMapIntensity: { value: 1.0 },
      // envMap is set automatically from scene.environment by Three.js
      // when using ShaderMaterial you need to pass it manually:
      envMap:      { value: null }, // set after HDR loads
    }
  ]),

  vertexShader: /* glsl */`
    varying vec3 vWorldNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldPos;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos    = worldPos.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vViewDir     = normalize(cameraPosition - worldPos.xyz);

      gl_Position  = projectionMatrix * viewMatrix * worldPos;
    }
  `,

  fragmentShader: /* glsl */`
    // --- Three.js built-in includes ---
    #include <common>
    #include <packing>
    #include <bsdfs>
    #include <lights_pars_begin>
    #include <envmap_common_pars_fragment>
    #include <envmap_physical_pars_fragment>
    #include <lights_physical_pars_fragment>

    uniform float roughness;
    uniform float metalness;
    uniform vec3  baseColor;
    uniform float envMapIntensity;

    varying vec3 vWorldNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldPos;

    void main() {
      vec3 N = normalize(vWorldNormal);
      vec3 V = normalize(vViewDir);

      // --- Build the PhysicalMaterial struct Three.js expects ---
      PhysicalMaterial material;
      material.diffuseColor      = baseColor * (1.0 - metalness);
      material.roughness         = max(roughness, 0.0525);
      material.specularColor     = mix(vec3(0.04), baseColor, metalness);
      material.specularF90       = 1.0;
      #ifdef USE_CLEARCOAT
        material.clearcoat             = 0.0;
        material.clearcoatRoughness    = 0.0;
        material.clearcoatF0           = vec3(0.04);
        material.clearcoatF90          = 1.0;
      #endif
      #ifdef USE_IRIDESCENCE
        material.iridescence           = 0.0;
        material.iridescenceIOR        = 1.3;
        material.iridescenceThickness  = 400.0;
      #endif

      // --- Reflected env direction for IBL ---
      vec3 reflectVec = reflect(-V, N);

      // --- Accumulate direct lights using Three's structs ---
      GeometricContext geometry;
      geometry.position = vWorldPos;
      geometry.normal   = N;
      geometry.viewDir  = V;

      ReflectedLight reflectedLight;
      reflectedLight.directDiffuse   = vec3(0.0);
      reflectedLight.directSpecular  = vec3(0.0);
      reflectedLight.indirectDiffuse = vec3(0.0);
      reflectedLight.indirectSpecular = vec3(0.0);

      // Point lights
      #if NUM_POINT_LIGHTS > 0
        PointLight pointLight;
        IncidentLight directLight;
        for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
          pointLight = pointLights[i];
          getPointLightInfo(pointLight, geometry, directLight);
          RE_Direct_Physical(directLight, geometry, material, reflectedLight);
        }
      #endif

      // Directional lights
      #if NUM_DIR_LIGHTS > 0
        DirectionalLight dirLight;
        IncidentLight directLight2;
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
          dirLight = directionalLights[i];
          getDirectionalLightInfo(dirLight, geometry, directLight2);
          RE_Direct_Physical(directLight2, geometry, material, reflectedLight);
        }
      #endif

      // --- IBL (Image Based Lighting) indirect ---
      RE_IndirectDiffuse_Physical(vec3(0.5), geometry, material, reflectedLight);
      RE_IndirectSpecular_Physical(
        getIBLRadiance(reflectVec, material.roughness, 0),   // env specular
        getIBLIrradiance(N),                                 // env diffuse
        getIBLSheen(geometry, material.roughness, 0),
        geometry, material, reflectedLight
      );

      vec3 color = reflectedLight.directDiffuse
                 + reflectedLight.directSpecular
                 + reflectedLight.indirectDiffuse  * envMapIntensity
                 + reflectedLight.indirectSpecular * envMapIntensity;

      gl_FragColor = vec4(color, 1.0);

      // Tone mapping & color space handled by Three if using outputColorSpace
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});

// --- Geometry ---
const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), material);
scene.add(mesh);

// Add a point light so NUM_POINT_LIGHTS > 0
const light = new THREE.PointLight(0xffffff, 2, 20);
light.position.set(2, 3, 2);
scene.add(light);

// Animate
function animate() {
  requestAnimationFrame(animate);
  mesh.rotation.y += 0.005;
  renderer.render(scene, camera);
}
animate();