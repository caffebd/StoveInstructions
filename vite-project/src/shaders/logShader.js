const preamble = `

uniform float TIME;

uniform sampler2D logTex;
uniform sampler2D noiseTex;
uniform float logCoal;
uniform float ashAmount;
uniform float ashStrength;
uniform vec3 burnCol;
uniform vec3 glowCol;
uniform float burnAmount;
uniform float burnStrength;
uniform float glowAmount;
uniform float glowStrength;

varying vec2 UV;
varying vec4 COLOR;
varying vec3 objectPos;
varying vec3 objectOrigin;

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
	csm_Position = VERTEX;
  // --------------------------------------------------

}
`;

const fragmentShaderSource = `
${preamble}


void main() {
  vec2 uv_scroll = UV;
	vec4 noise_texture = texture(noiseTex, UV * 5.0);
	vec4 albedo_height = texture(logTex, UV);
	vec3 albedo = adjustHSL(albedo_height.rgb, 1.0, 0.3, 1.3);
	albedo = mix(albedo, mix(vec3(0.6), vec3(0.7), noise_texture.a), float(logCoal));
	float height = mix(albedo_height.a, noise_texture.g, float(logCoal));

	float burn_mask;
	float glow_mask;
	float ash_mask;

	ash_mask = heightBlend(0.5, albedo.b, ashAmount, ashStrength, COLOR.b);
	burn_mask = heightBlend(albedo.b, height, 1.0 - burnAmount, mix(0.0, 0.1, burnStrength), COLOR.r);
	glow_mask = heightBlend(albedo.b, 1.0 - height, glowAmount, mix(0.0, 0.07, glowStrength), COLOR.g);
	glow_mask *= (1.0 - ash_mask);

	vec3 ash_color = adjustHSL(albedo_height.rgb, 1.0, 0.25, 1.8);
	vec3 burn_color = burnCol * albedo;
	vec3 glow_color = glowCol * mix(0.4, 1.0, noise_texture.a);

	vec3 color = mix(burn_color, albedo, burn_mask);
	color = mix(color, glow_color, glow_mask);
	color = mix(color, ash_color, ash_mask);
    color = clamp(color, 0.0, 1.0);

	vec3 emissive = mix(vec3(0.0), glow_color * (mix(0.0, 30.0, glowAmount)), glow_mask);

	float ao = (height - 0.1) * 1.3;
	ao = mix(ao, 1.0, ash_mask);

	float roughness = mix(0.95, 0.8, height);
  

    csm_DiffuseColor = vec4(color, 1.0);
    csm_Emissive = emissive;
    csm_Roughness = roughness;
    csm_AO = 1.0 - ao;
}
`;

export const logVertexShader = vertexShaderSource;
export const logFragmentShader = fragmentShaderSource;