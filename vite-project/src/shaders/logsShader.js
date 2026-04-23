import { pbrCommonGLSL } from './pbrSnippet.js';

const preamble = /* glsl */`
  ${pbrCommonGLSL}

  uniform float TIME;

  uniform sampler2D logTex;
  uniform sampler2D noiseTex;
  uniform vec3 burnCol;
  uniform vec3 glowCol;
  uniform float burnAmount;
  uniform float burnStrength;
  uniform float glowAmount;
  uniform float glowStrength;

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

  // -------------- GLSL Specific ---------------------
  gl_Position = projectionMatrix * viewMatrix * (modelMatrix * vec4(VERTEX, 1.0));
  // --------------------------------------------------

}
`;

const fragmentShaderSource = /* glsl */ `
${preamble}


void main() {

  vec2 uv_scroll = UV;
	uv_scroll.x += (TIME * 0.005);
	uv_scroll.y += (TIME * 0.005);
	vec3 albedo = texture(logTex, UV).rgb;
	vec4 noise_texture = texture(noiseTex, UV * 3.0);
	vec4 noise_texture_pan = texture(noiseTex, uv_scroll);

	float burn_mask;
	float glow_mask;

	burn_mask = heightBlend(albedo.b, mix(0.1, 0.9, noise_texture.a * noise_texture.g), burnAmount, mix(0.0, 0.1, burnStrength), 1.0);
	glow_mask = heightBlend(albedo.b, mix(0.1, 0.9, noise_texture.a * noise_texture.g), glowAmount, mix(0.0, 0.07, glowStrength), COLOR.g) * noise_texture_pan.r;

	vec3 burn_color = burnCol * albedo;
	// vec3 glow_color = glowCol * mix(0.4, 1.0, noise_texture.a);
  	vec3 glow_color = srgbToLinear(glowCol) * mix(0.4, 1.0, noise_texture.a);

	vec3 final_color = mix(albedo, burn_color, burn_mask);
	final_color = mix(final_color, glow_color, glow_mask);

	vec3 emissive = mix(vec3(0.0), glow_color * (mix(0.0, 30.0, glowAmount)), glow_mask);

  float alpha = 1.0;
  
  // Use PBR for base lighting
  vec3 worldPos = vec3(0.0); // Set from vertex shader if needed
  vec3 worldNormal = vec3(0.0, 1.0, 0.0); // Set from vertex shader if needed
  
  vec3 pbrColor = calculatePBR(
    final_color,
    worldPos,
    worldNormal,
    vec3(0.0), // lightDirection - use default
    vec3(0.0), // lightColor - use default
    vec3(0.0), // ambientColor - use default
    metalness,
    roughness,
    ao
  );

  vec3 color = pbrColor + emissive;
  

  gl_FragColor = vec4(color, alpha);
}
`;

export const logsVertexShader = vertexShaderSource;
export const logsFragmentShader = fragmentShaderSource;