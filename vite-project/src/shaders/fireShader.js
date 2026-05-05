const preamble = /* glsl */`

  const float ceilingY = 0.119;
  const float ceilingSoftness = 0.285;
  
  uniform float TIME;

  uniform float gradientSpeedDelta;
  uniform float vtxNoiseSpeedDelta;
  uniform float fireSpeedDelta;
  uniform float fireSpeedHDelta;
  uniform float fireFlickerSpeedDelta;
  uniform float noiseSpeedDelta;

  uniform sampler2D noiseTex;
  uniform sampler2D gradientTex;
  uniform float gradientScaling;
  uniform float gradientSpeed;
  uniform float vtxNoiseScaling;
  uniform float vtxNoiseSpeed;
  uniform float vtxNoiseWarp;
  uniform vec3 rotation;
  uniform vec3 rotationRandom;
  uniform float rotationUVPow;
  uniform float rotationAffect;
  uniform vec3 rotationWorld;
  uniform vec3 rotationWorldRandom;
  uniform float rotationWorldUVPow;
  uniform float rotationWorldAffect;
  uniform vec3 offset;
  uniform vec3 offsetRandom;
  uniform float offsetUVPow;
  uniform float offsetAffect;
  uniform float UV_Y_Sub;
  uniform float UV_Y_Add;
  uniform float fireSize;
  uniform float fireSizeVertical;
  uniform float fireSpeed;
  uniform float fireSpeedH;
  uniform float fireAmount;
  uniform float fireDensity;
  uniform float fireBorderTop;
  uniform float fireBorderBottom;
  uniform float fireFlickerAmount;
  uniform float fireFlickerSpeed;
  uniform float fireWarp;
  uniform float noiseScale;
  uniform float noiseSpeed;

  varying vec2 UV;
  varying vec4 COLOR;
  varying vec3 VERTEX;
  varying vec3 NORMAL;
  varying vec3 objectPos;
  varying vec3 objectOrigin;
  varying vec2 worldUV;
  varying vec2 noiseUV;
  varying vec2 gradientUV;


vec3 meshRotate(vec3 vertex, vec3 rotation_angle, vec3 pivot, mat4 model_matrix, bool use_world_space) {

    vec3 pos = vertex;
    if (use_world_space) {
        pos = (model_matrix * vec4(vertex, 1.0)).xyz;
    }

    vec3 dir = pos - pivot;

    // Rotate around X
    if (abs(rotation_angle.x) > 0.0001) {
        vec3 axis = vec3(1.0, 0.0, 0.0);
        float cos_theta = cos(rotation_angle.x);
        float sin_theta = sin(rotation_angle.x);
        dir = dir * cos_theta + cross(axis, dir) * sin_theta + axis * dot(axis, dir) * (1.0 - cos_theta);
    }

    // Rotate around Y
    if (abs(rotation_angle.y) > 0.0001) {
        vec3 axis = vec3(0.0, 1.0, 0.0);
        float cos_theta = cos(rotation_angle.y);
        float sin_theta = sin(rotation_angle.y);
        dir = dir * cos_theta + cross(axis, dir) * sin_theta + axis * dot(axis, dir) * (1.0 - cos_theta);
    }

    // Rotate around Z
    if (abs(rotation_angle.z) > 0.0001) {
        vec3 axis = vec3(0.0, 0.0, 1.0);
        float cos_theta = cos(rotation_angle.z);
        float sin_theta = sin(rotation_angle.z);
        dir = dir * cos_theta + cross(axis, dir) * sin_theta + axis * dot(axis, dir) * (1.0 - cos_theta);
    }

    vec3 result = dir + pivot;

    if (use_world_space) {
        result = (inverse(model_matrix) * vec4(result, 1.0)).xyz;
    }

    return result;
}
vec3 rotateAboutAxis(vec3 vertex, vec3 axis, float angle, vec3 pivot, mat4 model_matrix, bool use_world_space){

    vec3 pos = vertex;
    if(use_world_space){
        pos = (model_matrix * vec4(vertex, 1.0)).xyz;
    }


    vec3 dir = pos - pivot;
    axis = normalize(axis);
	float cos_theta = cos(angle);
	float sin_theta = sin(angle);
	vec3 rotated_dir = dir * cos_theta + cross(axis, dir) * sin_theta + axis * dot(axis, dir) * (1.0 - cos_theta);
	vec3 result = rotated_dir + pivot;

    if(use_world_space){
        result = (inverse(model_matrix) * vec4(result, 1.0)).xyz;
    }

    return result;
}
float saturate(float v) {
	return clamp(v, 0.0, 1.0);
}
float levels(float color, float minInput, float midInput, float maxInput, float minOutput, float maxOutput) {
    float rangeAdjusted = clamp((color - minInput) / (maxInput - minInput), 0.0, 1.0);
    float gammaAdjusted = pow(rangeAdjusted, 1.0 / midInput);
    float final = mix(minOutput, maxOutput, gammaAdjusted);
    return saturate(final);
}
float histScan(float v, float position_in, float contrast_in) {
    float position = 1.0 - position_in;
    float a = (max(position, 0.5) - 0.5) * 2.0;
    float b = min(position * 2.0, 1.0);
    float c = min(contrast_in * 0.5, 1.0);
    c = max(c, 0.0);
    float levelInLow = mix(a, b, c);
    float levelInHigh = mix(b, a, c);
    
    return levels(v, levelInLow, 0.5, levelInHigh, 0.0, 1.0);
}
float histRange(float v, float range_in, float position_in){
    float a = (range_in * 0.5) + (1.0 - position_in);
    float b = (1.0 - position_in) * 2.0;
    float levelOutLow = 1.0 - min(a, b);

    float levelOutHigh = min((range_in * 0.5) + position_in, position_in * 2.0);

    return levels(v, 0.0, 0.5, 1.0, levelOutLow, levelOutHigh);
}
float heightBlend(float h1, float h2, float height_offset, float contrast, float uv_y_sub_mask){
	height_offset = 1.0 - height_offset;
    float add1 = h1 + height_offset;
	float subtract1 = h2 - height_offset;
    float add2 = subtract1 + uv_y_sub_mask;
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
    vec2(sin(angle_rad), cos(angle_rad))
	);
		
		uv -= pivot_internal;
		uv = rotate * uv;
		uv += pivot_internal;
		return uv;
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
float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float smoothRandom(vec3 seed, float time, float speed) {
    float t = time * speed;
    float i = floor(t);
    float f = fract(t);

    // Cubic smoothstep
    float u = f * f * (3.0 - 2.0 * f);

    // Two consecutive offset_rand_val values seeded by position + time index
    float a = hash(seed + i);
    float b = hash(seed + i + 1.0);

    return mix(a, b, u);
}
vec3 smoothRandom3(vec3 seed, float time, vec3 speed) {
    vec3 t = vec3(time) * speed;
    vec3 i = floor(t);
    vec3 f = fract(t);

    // Cubic smoothstep per component
    vec3 u = f * f * (3.0 - 2.0 * f);

    // Each component hashed with a unique axis-offset so x/y/z never correlate
    vec3 a = vec3(
        hash(seed + vec3(i.x, 0.0, 0.0)),
        hash(seed + vec3(0.0, i.y, 0.0)),
        hash(seed + vec3(0.0, 0.0, i.z))
    );
    vec3 b = vec3(
        hash(seed + vec3(i.x + 1.0, 0.0, 0.0)),
        hash(seed + vec3(0.0, i.y + 1.0, 0.0)),
        hash(seed + vec3(0.0, 0.0, i.z + 1.0))
    );

    return mix(a, b, u);
}
vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x; // 0-1 (maps to 0-360 deg)
    float s = hsl.y; // 0-1
    float l = hsl.z; // 0-1

    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}
vec3 rgb2hsl(vec3 rgb) {
    float maxC = max(rgb.r, max(rgb.g, rgb.b));
    float minC = min(rgb.r, min(rgb.g, rgb.b));
    float delta = maxC - minC;

    float l = (maxC + minC) * 0.5;
    float s = 0.0;
    float h = 0.0;

    if (delta > 0.0001) {
        s = delta / (1.0 - abs(2.0 * l - 1.0));

        if (maxC == rgb.r)      h = mod((rgb.g - rgb.b) / delta, 6.0) / 6.0;
        else if (maxC == rgb.g) h = ((rgb.b - rgb.r) / delta + 2.0) / 6.0;
        else                    h = ((rgb.r - rgb.g) / delta + 4.0) / 6.0;
    }

    return vec3(h, s, l);
}
vec3 adjustHSL(vec3 rgb, float hueShift, float saturation, float lightness) {
    vec3 hsl = rgb2hsl(rgb);
    hsl.x = fract(hsl.x + hueShift); // hueShift: -1 to 1 (full rotation)
    hsl.y = clamp(hsl.y * saturation, 0.0, 1.0); // saturation: 0=grey, 1=original, 2=double
    hsl.z = clamp(hsl.z * lightness,  0.0, 1.0); // lightness:  0=black, 1=original, 2=white
    return hsl2rgb(hsl);
}

`
const vertexShaderSource = /* glsl */ `
${preamble}

void main() {
  // -------------- GLSL Specific ---------------------
  VERTEX = position;
  NORMAL = normal;
  mat4 MODEL_MATRIX = modelMatrix;
  COLOR = color;
  UV = uv;
  // --------------------------------------------------
  
	objectPos = VERTEX;
	vec3 worldPos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	objectOrigin = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	worldUV = (worldPos.xz / 1024.0);

	float uv_y_sub_mask = pow(1.0 - UV.y, 1.8);


	// vec3 bend_dir = vec3(xOffsetDir, yOffsetDir, zOffsetDir) * uv_y_sub_mask;

	noiseUV = worldUV * 50.0;
	noiseUV *= vtxNoiseScaling;
	noiseUV = UVPanner(noiseUV, vtxNoiseSpeedDelta, vec2(0.0, 1.0));
	float worldNoise_1 = textureLod(noiseTex, noiseUV, 4.0).g;

	gradientUV = rotateUV(worldUV, 90.0, vec2(0.0, 0.5));
	gradientUV *= 1500.0;
	gradientUV *= gradientScaling;
	gradientUV = UVPanner(gradientUV, gradientSpeedDelta, vec2(1.0, 0.0));
	gradientUV += (worldNoise_1 * vtxNoiseWarp);
	
	float gradient = texture(gradientTex, gradientUV).a;

	vec3 rand_val = mix(vec3(0.0), vec3(1.0), sin(objectOrigin * (sin(TIME) * 0.99)));
	vec3 rand_1 = smoothRandom3(objectOrigin, TIME, vec3(0.6));
	vec3 rand_2 = smoothRandom3(objectOrigin, TIME, vec3(1.9));
	vec3 rand_3 = smoothRandom3(objectOrigin, TIME, vec3(0.8));

	vec3 rand_1_signed = rand_1 * 2.0 - 1.0;
	vec3 rand_2_signed = rand_2 * 2.0 - 1.0;
	vec3 rand_3_signed = rand_3 * 2.0 - 1.0;

	vec3 rand_spots = hashNoise3(worldPos);

	vec3 rand_grad = vec3(pow(gradient, 0.8));
	rand_grad.x -= mix(-0.1512, 0.1232, sin(TIME));
	rand_grad.y -= mix(-0.1123, 0.1432, sin(TIME + 2.5161));
	rand_grad.z -= mix(-0.165, 0.17723, sin(TIME + 0.561));
	
	vec3 scale_random;
	scale_random = mix(vec3(0.9), vec3(1.0), rand_3_signed);
	VERTEX *= scale_random;


	vec3 rotation_random;
	rotation_random = ((rotation * 0.5) + (mix(-rotationRandom, rotationRandom, rand_grad) ) * rand_2_signed);
	rotation_random *= pow(uv_y_sub_mask, rotationUVPow);
	rotation_random *= rotationAffect;
	
	VERTEX = meshRotate(
  		VERTEX,
  		rotation_random,
  		vec3(0.0, 0.0, 0.0),
  		MODEL_MATRIX,
  		false
	);

	vec3 rotation_world_random;
	rotation_world_random = ((rotationWorld * 0.5) + (mix(-rotationWorldRandom, rotationWorldRandom, rand_grad) ) * rand_1_signed);
	rotation_world_random *= pow(uv_y_sub_mask, rotationWorldUVPow);
	rotation_world_random *= rotationWorldAffect;

	VERTEX = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;


	vec3 offset_random;
	offset_random = ((offset * 0.5) + (mix(-offsetRandom, offsetRandom, rand_grad) ) * rand_1_signed);
	offset_random *= pow(uv_y_sub_mask, offsetUVPow);
	offset_random *= offsetAffect;

	VERTEX += offset_random;
	
	VERTEX = (inverse(MODEL_MATRIX) * vec4(VERTEX, 1.0)).xyz;

	VERTEX = meshRotate(
  		VERTEX,
  		rotation_world_random,
  		objectOrigin,
  		MODEL_MATRIX,
  		true
	);

	vec3 world_v = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);

	vec3 world_lean = (MODEL_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
	float lean_len  = length(world_lean.xz);
	vec2 push_dir   = (lean_len > 0.0001) ? world_lean.xz / lean_len : vec2(0.0, 1.0);
	vec2 rot_push_dir = vec2(0.0, (sin(rotation_random.x)));

	float softZone = ceilingY - ceilingSoftness;
	float t        = clamp((world_v.y - softZone) / ceilingSoftness, 0.0, 1.0);
	float smooth_t = pow(t, 20.0);

	float overshoot = max(0.0, world_v.y - softZone);
	world_v.y       = min(world_v.y, ceilingY);
	world_v.xz     += rot_push_dir * (overshoot + smooth_t * ceilingSoftness);

	VERTEX = (inverse(MODEL_MATRIX) * vec4(world_v, 1.0)).xyz;
  
  
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
	// noise_uv = rotateUV(noise_uv, mix(-45.0, 45.0, fireDirection), vec2(0.5, 1.0));
	noise_uv.x += mix(-3.0, 3.0, sin(TIME * 0.05));
	noise_uv.y += noiseSpeedDelta;
	float noise = texture(noiseTex, noise_uv).g;

	vec2 fire_uv = uv * mix(0.1, 1.0, fireSize);
	fire_uv.y = (fire_uv.y - 0.5) * mix(0.0, 2.0, fireSizeVertical) + 0.5;
	// fire_uv = rotateUV(fire_uv, mix(-45.0, 45.0, fireDirection), vec2(0.5, 1.0));
	// fire_uv.x -= mix(-3.0, 3.0, sin(TIME * 0.1));
	fire_uv.y += fireSpeedDelta;
	fire_uv.x += fireSpeedHDelta;


	fire_uv.y += (noise * mix(0.0, 0.7, fireWarp));

	vec4 textures = texture(noiseTex, fire_uv);

	// float fire_mask = max((COLOR.r * vColRAffect), (COLOR.g * vColGAffect));
	float uv_y_add_mask = UV.y - (1.0 - UV_Y_Add);
	uv_y_add_mask = clamp(uv_y_add_mask, 0.0, 1.0);
	float uv_y_sub_mask = pow(1.0 - UV.y, mix(0.0, 4.0, UV_Y_Sub));

	
	// float flicker_mask = clamp(sin(objectOrigin.x * TIME * mix(0.0, 120.0, fireFlickerSpeed)), 0.0, 1.0);
	float flicker_mask = smoothRandom(objectOrigin, fireFlickerSpeedDelta, 1.0);

	float fire_tex = (textures.r * (textures.a * 1.3));
	fire_tex = clamp(fire_tex, 0.0, 1.0);
	float border_top = mix(0.0, 5.0, fireBorderTop);
	float border_bottom = mix(0.0, 5.0, fireBorderBottom);
	fire_tex = smoothstep(border_bottom - border_top, border_bottom, fire_tex);

	float uv_mask = UV.y;
	float fire = fire_tex;
	// fire -= (noise - fireStability);
	float mask = noise + (COLOR.r);
	mask -= (1.0 - COLOR.r);
	mask = min(mask, mask * uv_y_sub_mask);
	mask = clamp(mask, 0.0, 1.0);
	
	fire -= histScan(1.0 - uv_mask, 0.01, 0.0);
	fire -= (1.0 - mask);
	fire *= fireDensity;
	fire -= (flicker_mask * fireFlickerAmount);
	fire += uv_y_add_mask;
	fire -= (1.0 - fireAmount);
	fire = clamp(fire, 0.0, 1.0);

	float worldNoise_1 = textureLod(noiseTex, noiseUV, 4.0).g;
	
	float gradient = texture(gradientTex, gradientUV).a;
	

	vec3 fire_color = texture(gradientTex, vec2(fire, 0.5)).rgb;
    vec3 emissive = fire_color * 1.0;


    gl_FragColor = vec4(fire_color + emissive, fire);
    // gl_FragColor = vec4(vec3(1.0), 1.0);
}
`;

export const fireVertexShader = vertexShaderSource;
export const fireFragmentShader = fragmentShaderSource;
