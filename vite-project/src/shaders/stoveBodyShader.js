const preamble = `

uniform float TIME;
varying vec4 COLOR;
varying vec2 UV;
varying vec3 VERTEX;

uniform sampler2D stoveMasksAO;
uniform sampler2D stoveNormals;
uniform vec3 lightCol;
uniform float lightStrength;
uniform vec3 lightPos;
uniform float lightRange;
uniform float lightFalloff;
uniform vec3 stoveColA;
uniform vec3 stoveColB;
uniform float stoveRoughA;
uniform float stoveRoughB;

varying vec3 worldPos;
varying vec3 objectPos;
varying vec3 objectOrigin;

float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float smoothRandom(vec3 seed, float time, float speed) {
	float t = time * speed;
	float i = floor(t);
	float f = fract(t);	
	// Cubic smoothstep
	float u = f * f * (3.0 - 2.0 * f);	
	// Two consecutive random values seeded by position + time index
	float a = hash(seed + i);
	float b = hash(seed + i + 1.0);	
	return mix(a, b, u);
}
vec3 pointLight(vec3 world_pos, vec3 light_pos, vec3 light_color, float light_str, float range, float falloff) {
    float dist = length(world_pos - light_pos);
    float atten = pow(1.0 - clamp(dist / range, 0.0, 1.0), falloff);
    return (light_color * atten) * light_str;
}
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
vec3 deriveZ(float x_in, float y_in){
    vec2 normalXY = vec2(x_in * 2.0 - 1.0, y_in * 2.0 - 1.0);
	float z = sqrt(max(1.0 - dot(normalXY, normalXY), 0.0));
	vec3 normal = vec3(normalXY.x, normalXY.y, z);
	return normal * 0.5 + 0.5;
}

`;

const vertexShaderSource = `
${preamble}

void main() {
	// -------------- GLSL Specific ---------------------
	vec3 VERTEX = position;
	mat4 MODEL_MATRIX = modelMatrix;
	// COLOR = color;
	UV = uv;
	// --------------------------------------------------
	objectPos = VERTEX;
	worldPos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	objectOrigin = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

	// -------------- GLSL Specific ---------------------
	csm_Position = VERTEX;
	// --------------------------------------------------

}
`;

const fragmentShaderSource = `
${preamble}

void main() {
	vec2 uv = UV * 15.0;
	vec4 masks = texture(stoveMasksAO, uv);
	vec4 normals = texture(stoveNormals, uv);
	float ao = texture(stoveMasksAO, UV).a - 0.03;
	// float ao = texture(stoveMasksAO, UV).a - 0.07;


	float flicker = smoothRandom(objectOrigin, TIME, 1.0);

	vec3 flame_light = pointLight(objectPos, lightPos, lightCol, lightStrength * mix(0.4, 0.75, flicker), lightRange, lightFalloff);
	vec3 albedo = vec3(mix(stoveColB, stoveColA, masks.r));
  	albedo = albedo + (flame_light * 1.0);
	float rough = mix(stoveRoughA, stoveRoughB, masks.r);
  	vec3 normal_map = deriveZ(normals.r, normals.g);

	csm_DiffuseColor = vec4(vec3(albedo), 1.0);
	csm_Roughness = rough;
	// csm_AO = 1.0 - ao;


}

`;

export const stoveBodyVertexShader = vertexShaderSource;
export const stoveBodyFragmentShader = fragmentShaderSource;