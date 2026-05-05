export const pbrCommonGLSL = /* glsl */`

const float PI = 3.14159265358979323846;
const float gamma = 2.2;

vec3 gammaCorrection(vec3 color) {
    return pow(color, vec3(gamma));
}

vec3 deGammaCorrection(vec3 color) {
    return pow(color, vec3(1.0 / gamma));
}

vec3 BRDF_Diffuse(in vec3 color) {
    return color / PI;
}

float Specular_D(in float roughness, in vec3 N, in vec3 H) {
    float a2 = pow(roughness, 2.0);
    float NoH = saturate(dot(N, H));
    return a2 / (PI * pow(pow(NoH, 2.0) * (a2 - 1.0) + 1.0, 2.0));
}

float Specular_G1(in float roughness, in vec3 N, in vec3 X) {
    float k = pow(roughness + 1.0, 2.0) / 8.0;
    float NoX = max(dot(N, X), 1e-5);
    return NoX / (NoX * (1.0 - k) + k);
}

float Specular_G(in float roughness, in vec3 N, in vec3 V, in vec3 L) {
    return Specular_G1(roughness, N, L) * Specular_G1(roughness, N, V);
}

vec3 Specular_F(in vec3 specularColor, in vec3 V, in vec3 H) {
    float VoH = saturate(dot(V, H));
    return specularColor + (1.0 - specularColor) * pow(2.0, (-5.55473 * VoH - 6.98316) * VoH);
}

vec3 BRDF_Specular(in vec3 specularColor, in float roughness, in vec3 L, in vec3 N, in vec3 V) {
    vec3 H = normalize(V + L);
    float NoL = saturate(dot(N, L));
    if (NoL <= 0.0) return vec3(0.0);
    float NoV = max(dot(N, V), 1e-5);
    return Specular_D(roughness, N, H) * Specular_F(specularColor, V, H) * Specular_G(roughness, N, V, L) / (NoL * NoV);
}

vec3 prefilterIrradiance(samplerCube irradianceMap, vec3 N) {
    return textureCube(irradianceMap, N).rgb;
}

vec3 prefilterEnvMap(samplerCube envMap, float roughness, vec3 R) {
    return textureCube(envMap, vec3(R.x, -R.y, -R.z), roughness).rgb;
}

vec2 integrateBRDF(sampler2D BRDFlut, float roughness, float NoV) {
    return texture2D(BRDFlut, vec2(roughness, NoV)).xy;
}

vec3 approximateSpecularIBL(samplerCube envMap, sampler2D BRDFlut, vec3 specularColor, float roughness, vec3 N, vec3 V) {
    float NoV = saturate(dot(N, V));
    vec3 R = 2.0 * dot(V, N) * N - V;
    vec3 prefilteredColor = prefilterEnvMap(envMap, roughness, R);
    vec2 envBRDF = integrateBRDF(BRDFlut, roughness, NoV);
    return prefilteredColor * (specularColor * envBRDF.x + envBRDF.y);
}

// Main entry point.
// baseColor, ambientColor, lightColor — linear-space RGB vectors
// roughness, metalness              — [0, 1] scalars
// L, N, V                           — world-space light / normal / view vectors (not yet normalised here)
// envMap, irradianceMap, BRDFlut    — IBL textures (pass null-equivalent when unused)
vec4 calculatePBR(
    vec3 baseColor,
    vec3 ambientColor,
    vec3 lightColor,
    float roughness,
    float metalness,
    vec3 L,
    vec3 N,
    vec3 V,
    samplerCube envMap,
    samplerCube irradianceMap,
    sampler2D BRDFlut
) {
    vec3 _baseColor    = gammaCorrection(baseColor);
    vec3 diffuseColor  = mix(_baseColor, vec3(0.0), metalness);
    vec3 specularColor = mix(vec3(0.04),  _baseColor, metalness);

    vec3 _N = normalize(N);
    vec3 _V = normalize(-V);   // view vector points toward the camera
    vec3 _L = normalize(L);

    // Direct lighting
    float NoL = saturate(dot(_N, _L));
    vec3 directColor = (ambientColor + BRDF_Diffuse(diffuseColor) + BRDF_Specular(specularColor, roughness, _L, _N, _V))
                       * lightColor * NoL;

    // Image-based lighting
    vec3 iblDiffuse  = BRDF_Diffuse(diffuseColor) * prefilterIrradiance(irradianceMap, _N);
    vec3 iblSpecular = approximateSpecularIBL(envMap, BRDFlut, specularColor, roughness, _N, _V);
    vec3 envColor    = iblDiffuse + iblSpecular;

    vec3 finalColor = deGammaCorrection(directColor + envColor);
    return vec4(finalColor, 1.0);
}

`;