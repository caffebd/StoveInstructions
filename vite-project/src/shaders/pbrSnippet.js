export const pbrCommonGLSL = `
const float PI = 3.14159265359;

float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;
  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  return a2 / (PI * denom * denom + 1e-5);
}

float geometrySchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k + 1e-5);
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  float ggx2 = geometrySchlickGGX(NdotV, roughness);
  float ggx1 = geometrySchlickGGX(NdotL, roughness);
  return ggx1 * ggx2;
}

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

vec3 calculatePBR(
  vec3 albedo,
  vec3 worldPos,
  vec3 worldNormal,
  vec3 lightDirection,
  vec3 lightColor,
  vec3 ambientColor,
  float metalness,
  float roughness,
  float ao
) {
  float safeRoughness = clamp(roughness, 0.04, 1.0);
  float safeMetalness = clamp(metalness, 0.0, 1.0);
  float safeAO = clamp(ao, 0.0, 1.0);

  vec3 N = normalize(worldNormal);
  vec3 V = normalize(cameraPosition - worldPos);

  float hasCustomDir = step(1e-5, dot(lightDirection, lightDirection));
  float hasCustomColor = step(1e-5, dot(lightColor, lightColor));
  float hasAmbient = step(1e-5, dot(ambientColor, ambientColor));

  vec3 defaultLightDir = normalize(vec3(0.5, 1.0, 0.3));
  vec3 L = normalize(mix(defaultLightDir, -lightDirection, hasCustomDir));
  vec3 radiance = mix(vec3(1.0), lightColor, hasCustomColor);
  vec3 ambient = mix(vec3(0.03), ambientColor, hasAmbient);
  vec3 H = normalize(V + L);

  vec3 F0 = mix(vec3(0.04), albedo, safeMetalness);
  vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
  float NDF = distributionGGX(N, H, safeRoughness);
  float G = geometrySmith(N, V, L, safeRoughness);

  vec3 numerator = NDF * G * F;
  float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 1e-5;
  vec3 specular = numerator / denominator;

  vec3 kS = F;
  vec3 kD = (vec3(1.0) - kS) * (1.0 - safeMetalness);

  float NdotL = max(dot(N, L), 0.0);
  vec3 Lo = (kD * albedo / PI + specular) * radiance * NdotL;
  vec3 ambientTerm = ambient * albedo * safeAO;

  vec3 color = ambientTerm + Lo;
  color = color / (color + vec3(1.0));
  return pow(color, vec3(1.0 / 2.2));
}
`;
