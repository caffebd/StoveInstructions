const preamble = `

varying vec2 UV;
varying vec4 COLOR;
varying vec3 objectPos;
varying vec3 objectOrigin;

vec3 deriveZ(float x_in, float y_in){
    vec2 normalXY = vec2(x_in * 2.0 - 1.0, y_in * 2.0 - 1.0);
	float z = sqrt(max(1.0 - dot(normalXY, normalXY), 0.0));
	vec3 normal = vec3(normalXY.x, normalXY.y, z);
	return normal * 0.5 + 0.5;
}

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
const vertexShaderSource = `
${preamble}

void main() {
  // -------------- GLSL Specific ---------------------
  vec3 VERTEX = position;
  mat4 MODEL_MATRIX = modelMatrix;
  // COLOR = color;
  UV = uv;
  // --------------------------------------------------



  // -------------- GLSL Specific ---------------------
	csm_Position = VERTEX;
  // --------------------------------------------------

}
`;

const fragmentShaderSource = `
${preamble}


void main() {
  vec2 uv = UV;

  csm_DiffuseColor = vec4(vec3(0.03), 1.0);
  csm_Roughness = 0.45;
}
`;

export const ropeVertexShader = vertexShaderSource;
export const ropeFragmentShader = fragmentShaderSource;