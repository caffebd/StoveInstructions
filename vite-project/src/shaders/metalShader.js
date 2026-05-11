const preamble = /* glsl */`

  uniform float TIME;

  uniform sampler2D stoveMasks;
  uniform sampler2D stoveAO;
  uniform int maskSelect;
  uniform vec3 stoveColorA;
  uniform vec3 stoveColorB;
  uniform float stoveRoughA;
  uniform float stoveRoughB;

  varying vec2 UV;

  vec2 rotateUV(vec2 uv, float angle, vec2 pivot) {
    float angle_rad = radians(angle);
    vec2 pivot_internal = clamp(pivot, 0.0, 1.0);

    mat2 rotate = mat2(
    vec2(cos(angle_rad), -sin(angle_rad)),
    vec2(sin(angle_rad), cos(angle_rad))
	  );
		  uv -= pivot_internal;
		  uv = rotate * uv;
		  uv += pivot_internal;
		  return uv;
}

`
const vertexShaderSource = /* glsl */ `
${preamble}

void main() {
  // -------------- GLSL Specific ---------------------
  vec3 VERTEX = position;
  mat4 MODEL_MATRIX = modelMatrix;
  UV = uv;
  // --------------------------------------------------

  // -------------- GLSL Specific ---------------------
  csm_Position = VERTEX;
  // --------------------------------------------------

}
`;

const fragmentShaderSource = /* glsl */ `
${preamble}

void main() {
  vec2 uv = rotateUV(UV * 15.0, 0.0, vec2(0.5, 0.5));
	vec4 masks = texture(stoveMasks, uv);
	float ao = texture(stoveAO, UV).a - 0.03;
	float mask;
	if (maskSelect == 0){
		mask = masks.r;
	} else if (maskSelect == 1){
		mask = masks.g;
	} else if (maskSelect == 2){
		mask = masks.b;
	} else if (maskSelect == 3){
		mask = masks.a;
	}
	float rough = mix(stoveRoughA, stoveRoughB, mask);
	vec3 albedo = mix(stoveColorA, stoveColorB, mask);

  csm_DiffuseColor = vec4(albedo, 1.0);
  csm_Roughness = rough;
  csm_Metalness = 1.0;
  csm_AO = 1.0 - ao;
  
}
`;

export const metalVertexShader = vertexShaderSource;
export const metalFragmentShader = fragmentShaderSource;