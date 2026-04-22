// Godot spatial → Three.js ShaderMaterial
// cull_disabled → material.side = DoubleSide
// depth_draw_opaque → depthWrite: true

const preamble = /* glsl */`
  uniform sampler2D fireTex;
  uniform float TIME;
  uniform vec3 fireCol;
  uniform float fireSpeed;
  uniform float fireAmount;
  uniform float fireDensity;
  uniform float fireBorderTop;
  uniform float fireBorderBottom;
  uniform float fireDirection;
  uniform float fireSize;
  uniform float fireStability;
  uniform float meshDisplaceRange;
  uniform float meshDisplaceSpeed;
  uniform float xOffsetDir;
  uniform float yOffsetDir;
  uniform float zOffsetDir;
  uniform float worldUVScale;

  varying vec2 UV;
  varying vec4 COLOR;
  varying vec3 objectPos;
  varying vec3 debug;

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
  vec3 VERTEX = position;
  COLOR = color;

  UV = uv;
  objectPos = position;
  vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 origin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec2 worldUV = (worldPos.xz / 5.0) * worldUVScale;
	vec2 vUV = UVPanner(worldUV, TIME, vec2(-1.3, 0.0));

  float noise = texture(fireTex, vUV).g;

  float mesh_displace_speed = mix(0.0, 40.0, meshDisplaceSpeed);
	vec3 random = mix(vec3(-meshDisplaceRange), vec3(meshDisplaceRange), sin(origin * TIME * mesh_displace_speed));
	vec3 rand_spots = hashNoise3(worldPos);

	float mask = 1.0 - UV.y;

	float offset_x = sin(random.x) * sin(noise) * mask;
	float offset_z = sin(random.z) * sin(noise) * mask;
	
	debug = vec3(rand_spots);

	vec3 bend_dir = vec3(xOffsetDir, yOffsetDir, zOffsetDir) * mask;

  VERTEX.x += offset_x;
	VERTEX.z += offset_z;
	VERTEX += bend_dir;

  debug = vec3(vUV.x);
  

  gl_Position = projectionMatrix * viewMatrix * (modelMatrix * vec4(VERTEX, 1.0));


}
`;

const fragmentShaderSource = /* glsl */ `
${preamble}


void main() {

  vec2 uv = UV;

	vec2 fire_uv = uv * mix(0.1, 1.0, fireSize);
	fire_uv = rotateUV(fire_uv, mix(-45.0, 45.0, fireDirection), vec2(0.5, 0.5));
	fire_uv.x += mix(-0.5, 0.5, sin(TIME * 0.2));
	fire_uv.y += TIME * mix(0.0, 2.0, fireSpeed);
	vec2 noise_uv = uv * 1.5;
	noise_uv.x += mix(-0.7, 0.7, cos(TIME * 0.7));
	noise_uv.y += TIME * mix(0.0, 5.0, fireSpeed);

	float noise = texture(fireTex, noise_uv).g;

	vec4 textures = texture(fireTex, fire_uv);

	float fire_mask = COLOR.r;

	float fire_tex = (textures.r * (textures.a * 1.3)) - mix(0.0, 1.0, 1.0 - fireAmount);
	fire_tex -= ((noise - clamp((fireStability - 0.8), 0.0, 1.0)) * (1.0 - fireStability) + 0.3);
	float mask = UV.y;
	float fire = fire_tex;
	fire += mask;
	
	float border_top = mix(0.0, 5.0, fireBorderTop);
	float border_bottom = mix(0.0, 5.0, fireBorderBottom);
	fire = smoothstep(border_bottom - border_top, border_bottom, fire);
	fire -= (1.0 - COLOR.r);


	fire *= mix(0.0, 5.0, fireDensity);
	fire = clamp(fire, 0.0, 1.0);

	// vec3 fire_color = texture(fireCol, vec2(fire, 0.5)).rgb;
  vec3 fire_color = fireCol * fire;
  // fire_color = clamp(fire_color, 0.0, 1.0);
  // vec3 fire_emissive = fire_color * 2.0;

  gl_FragColor = vec4(fire_color * 4.0, fire);
}
`;

export const vertexShader = vertexShaderSource;
export const fragmentShader = fragmentShaderSource;
