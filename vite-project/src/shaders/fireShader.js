import { pbrCommonGLSL } from './pbrSnippet.js';
const preamble = /* glsl */`
  ${pbrCommonGLSL}

  uniform float TIME;

  uniform sampler2D fireTex;
  uniform sampler2D fireCol;
  uniform float vColRAffect;
  uniform float vColGAffect;
  uniform float UV_Y_Affect;
  uniform float fireSize;
  uniform float fireSpeed;
  uniform float fireAmount;
  uniform float fireDensity;
  uniform float fireBorderTop;
  uniform float fireBorderBottom;
  uniform float fireDirection;
  uniform float fireStability;
  uniform float fireFlickerAmount;
  uniform float fireFlickerSpeed;
  uniform float fireWarp;
  uniform float noiseScale;
  uniform float noiseSpeed;
  uniform float worldUVScale;
  uniform float meshDisplaceRange;
  uniform float meshDisplaceSpeed;
  uniform float xDisplaceAmount;
  uniform float yDisplaceAmount;
  uniform float zDisplaceAmount;
  uniform float xOffsetDir;
  uniform float yOffsetDir;
  uniform float zOffsetDir;

  uniform float metalness;
  uniform float roughness;
  uniform float ao;

  varying vec2 UV;
  varying vec4 COLOR;
  varying vec3 objectPos;
  varying vec3 objectOrigin;

  vec3 srgbToLinear(vec3 sRGB) {
    return mix(
        sRGB * 0.0773993808,
        pow(sRGB * 0.9478672986 + 0.0521327014, vec3(2.4)),
        step(vec3(0.04045), sRGB)
    );
  }
  vec3 linearToSrgb(vec3 c) {
    return mix(
        c * 12.92,
        1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
        step(vec3(0.0031308), c)
    );
  }
  vec3 srgbToLinearCheap(vec3 sRGB) {
    return pow(sRGB, vec3(2.2));
  }
  float heightBlend(float h1, float h2, float height_offset, float contrast, float mask){
	  height_offset = 1.0 - height_offset;
    float add1 = h1 + height_offset;
	  float subtract1 = h2 - height_offset;
    float add2 = subtract1 + mask;
	  float max1 = max(add1, add2);
	  float subtract2 = max1 - add1;
	  float multiply1 = subtract2 * (contrast * 100.0);
    float result = clamp(multiply1, 0.0, 1.0);
	  return result;
  }
  float fresnel(vec3 normal, vec3 view, bool invert, float power){
	  float fresnel = pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), power);
	  fresnel = mix(fresnel, 1.0 - fresnel, float(invert));
    return fresnel;
  }
  vec2 UVPanner(vec2 uv_in, float time, vec2 speed) {
    return uv_in + (time * speed);
  }
  vec2 rotateUV(vec2 uv, float angle, vec2 pivot) {
    float angle_rad = radians(angle);
    vec2 pivot_internal = clamp(pivot, 0.0, 1.0);

    mat2 rotate = mat2(
    vec2(cos(angle_rad), -sin(angle_rad)),
    vec2(sin(angle_rad), cos(angle_rad)));
		
		uv -= pivot_internal;
		uv = rotate * uv;
		uv += pivot_internal;
		return uv;
  }
  float offset(float v, float offset){
	  return clamp((v - (offset)) / (1.0 - offset), 0.0, 1.0);
  }
  vec3 hashNoise3( vec3 p ) {
	  p *= mat3(vec3(127.1, 311.7, -53.7), vec3(269.5, 183.3, 77.1), vec3(-301.7, 27.3, 215.3));
	  return 2.0 * fract(fract(p)*4375.55) -1.0;
  }
  float hashNoise( float p ) {
	  vec3 v = vec3(p);
    v *= mat3(vec3(127.1, 311.7, -53.7), vec3(269.5, 183.3, 77.1), vec3(-301.7, 27.3, 215.3));
	  return (2.0 * fract(fract(v) * 4375.55) -1.0).x;
  }

`
const vertexShaderSource = /* glsl */ `
${preamble}

void main() {
  // -------------- GLSL Specific ---------------------
  vec3 VERTEX = position;
  mat4 MODEL_MATRIX = modelMatrix;
  COLOR = color;
  UV = uv;
  // --------------------------------------------------
  
  objectPos = VERTEX;
	vec3 worldPos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	objectOrigin = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	vec2 worldUV = (worldPos.xz / 5.0) * worldUVScale;
	vec2 vUV = UVPanner(worldUV, TIME, vec2(0.5, 1.3));

	float noise = texture(fireTex, vUV).g;

	float mesh_displace_speed = mix(0.0, 40.0, meshDisplaceSpeed);
	vec3 random = mix(vec3(-meshDisplaceRange), vec3(meshDisplaceRange), sin(objectOrigin * TIME * mesh_displace_speed));
	vec3 rand_spots = hashNoise3(worldPos);

	float uv_y_mask = 1.0 - UV.y;

	float offset_x = sin(random.x) * sin(noise) * uv_y_mask;
	float offset_y = sin(random.y) * sin(noise) * uv_y_mask;
	float offset_z = sin(random.z) * sin(noise) * uv_y_mask;
	
	
	objectOrigin;

	vec3 bend_dir = vec3(xOffsetDir, yOffsetDir, zOffsetDir) * uv_y_mask;

	VERTEX.x += offset_x * xDisplaceAmount;
	VERTEX.y += offset_y * yDisplaceAmount * UV.y;;
	VERTEX.z += offset_z * zDisplaceAmount;
	VERTEX += sign(bend_dir) * pow(abs(bend_dir), vec3(1.9));
  
  
  // -------------- GLSL Specific ---------------------
  gl_Position = projectionMatrix * viewMatrix * (modelMatrix * vec4(VERTEX, 1.0));
  // --------------------------------------------------

}
`;

const fragmentShaderSource = /* glsl */ `
${preamble}


void main() {

  vec2 uv = UV;
	vec2 noise_uv = uv * mix(0.0, 2.0, noiseScale);
	noise_uv = rotateUV(noise_uv, mix(-45.0, 45.0, fireDirection), vec2(0.5, 1.0));
	noise_uv.x += mix(-0.5, 0.5, sin(TIME * 0.5));
	noise_uv.y += TIME * mix(0.0, 5.0, noiseSpeed);
	float noise = texture(fireTex, noise_uv).g;

	vec2 fire_uv = uv * mix(0.1, 1.0, fireSize);
	fire_uv = rotateUV(fire_uv, mix(-45.0, 45.0, fireDirection), vec2(0.5, 1.0));
	fire_uv.x += mix(-0.5, 0.5, sin(TIME * 0.2));
	fire_uv.y += TIME * mix(0.0, 3.0, fireSpeed);

	fire_uv += (noise * mix(0.0, 0.7, fireWarp));

	vec4 textures = texture(fireTex, fire_uv);

	float fire_mask = max((COLOR.r * vColRAffect), (COLOR.g * vColGAffect));
	float uv_y_mask = (UV.y * UV_Y_Affect);
	float flicker_mask = clamp(sin(objectOrigin.x * TIME * mix(0.0, 120.0, fireFlickerSpeed)), 0.0, 1.0);

	float fire_tex = (textures.r * (textures.a * 1.3));
	fire_tex = clamp(fire_tex, 0.0, 1.0);
	float border_top = mix(0.0, 5.0, fireBorderTop);
	float border_bottom = mix(0.0, 5.0, fireBorderBottom);
	fire_tex = smoothstep(border_bottom - border_top, border_bottom, fire_tex);

	float fire = heightBlend(
		0.5, fire_tex,
		mix(0.0, 0.9, fireAmount),
		mix(0.0, 0.02, fireDensity),
		fire_mask * pow(UV.y, mix(0.0, 2.0, UV_Y_Affect)));
	
	fire -= clamp((1.0 - fireStability) - noise, 0.0, 1.0) ;
	fire -= (flicker_mask * fireFlickerAmount);
	fire = clamp( fire, 0.0, 1.0);
  

	vec3 fire_color = texture(fireCol, vec2(fire, 0.5)).rgb;
  vec3 emissive = fire_color * 5.0;

  vec3 worldPos = vec3(0.0); // Set from vertex shader if needed
  vec3 worldNormal = vec3(0.0, 1.0, 0.0); // Set from vertex shader if needed

  vec3 pbrColor = calculatePBR(
    fire_color,
    worldPos,
    worldNormal,
    vec3(0.0), // lightDirection - use default
    vec3(0.0), // lightColor - use default
    vec3(0.0), // ambientColor - use default
    metalness,
    roughness,
    ao
  );


  gl_FragColor = vec4(pbrColor + emissive, fire);
}
`;

export const fireVertexShader = vertexShaderSource;
export const fireFragmentShader = fragmentShaderSource;
