const outputs = `
  vec3 ALBEDO;
  vec3 NORMAL_MAP;
  float ROUGHNESS;
  float AO;
  float METALLIC;
  vec3 BENT_NORMAL_MAP;
  float ALPHA;
`

const preamble = `

  uniform float TIME;

  varying vec2 UV;

`
const vertexShaderSource = `
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

const fragmentShaderSource = `
${preamble}
${outputs}


void main() {

  ALBEDO = vec3(1.0);
	ROUGHNESS = 0.0;
	ALPHA = 0.02;
  
  vec3 worldPos = vec3(0.0);
  vec3 worldNormal = vec3(0.0, 1.0, 0.0);

  vec3 pbrColor = calculatePBR(
    ALBEDO,
    worldPos,
    worldNormal,
    vec3(0.0), // lightDirection - use default
    vec3(0.0), // lightColor - use default
    vec3(0.0), // ambientColor - use default
    METALLIC,
    ROUGHNESS,
    AO
  );

  vec4 color = vec4(pbrColor, ALPHA);
  

  gl_FragColor = vec4(color);
}
`;

export const glassVertexShader = vertexShaderSource;
export const glassFragmentShader = fragmentShaderSource;