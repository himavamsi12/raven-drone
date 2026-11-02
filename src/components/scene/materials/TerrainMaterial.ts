import * as THREE from "three";
import { panoramaLookup } from "../shaders/panorama";
import { computeScreenUv } from "../shaders/screen-uv";

/** Terrain shader (shipped class `y`). Fog + diagonal "scan" reveal of a lit grayscale relief. */
export class TerrainMaterial extends THREE.ShaderMaterial {
  constructor(noiseTexture: THREE.Texture) {
    super({
      vertexShader: /* glsl */ `
varying vec2 vUv;
varying vec3 vViewNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;

void main() {
    vUv = uv;
    vPosition = position;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vViewNormal = normalMatrix * normalize(vec3(2.0 * normal.x, 1.0 * normal.y, 2.0 * normal.z));
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}`,
      fragmentShader: /* glsl */ `
varying vec2 vUv;
varying vec3 vViewNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vPosition;

uniform sampler2D uNoiseTexture;
uniform sampler2D uBaseTexture;
uniform sampler2D uCityTexture;
uniform bool uisCity;
uniform vec2 uResolution;
uniform float uDpr;
uniform float uHideRatio;
uniform vec3 uBgColor;
uniform float uLightingIntensity;
uniform float uFresnelPower;
uniform float uNoiseInfluence;
uniform float uNoiseFrequency;
uniform float uLightingMix;
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uFogDensity;
uniform float uFogExponent;
uniform vec3 uFogSkyColor;
uniform float uFogBlendFactor;
// Raven opening: fog fades into the panorama in the view direction instead of a flat colour (0 = shipped fog).
uniform float uPanoMix;
${panoramaLookup}

vec3 inverseTransformDirection(in vec3 dir, in mat4 matrix) {
    return normalize((vec4(dir, 0.0) * matrix).xyz);
}

${computeScreenUv}

float computeScanr(vec2 screenUv) {
    return screenUv.x < uHideRatio ? 1.0 : 0.0;
}

vec3 applyFog(vec3 color, float distance) {
    float fogDistance = clamp((distance - uFogStart) / max(0.0001, uFogEnd - uFogStart), 0.0, 1.0);
    float fogAmount = pow(fogDistance, uFogExponent);
    fogAmount *= uFogDensity;
    fogAmount = mix(fogAmount, fogAmount * uFogBlendFactor, uFogBlendFactor);
    vec3 fogColor = uFogSkyColor;
    if (uPanoMix > 0.0) {
        float edge = abs(gl_FragCoord.x / uResolution.x * 2.0 - 1.0);
        vec4 land = panoramaColor(vWorldPosition - cameraPosition, edge);
        fogColor = mix(fogColor, land.rgb, land.a * uPanoMix);
    }
    return mix(color, fogColor, fogAmount);
}

vec3 sampleMaterials() {
    vec4 textureColor = texture(uBaseTexture, vUv);
    vec4 cityColor = texture(uCityTexture, vUv);
    vec3 baseColor = textureColor.rgb;
    if (uisCity) {
        baseColor = mix(baseColor, cityColor.rgb, cityColor.a);
    }
    float distance = length(vViewPosition);
    return applyFog(baseColor, distance);
}

vec3 modifyNormalWithNoise(vec3 vertexNormalWorld) {
    float noise = texture2D(uNoiseTexture, vPosition.xz * uNoiseFrequency).r;
    float influence = uNoiseInfluence * noise;
    vec3 perturbedNormal = mix(vertexNormalWorld, vec3(0.0, -1.0, 0.0), influence);
    return normalize(perturbedNormal);
}

vec3 computeFresnelLighting(vec3 modifiedNormal, vec3 viewDir, vec3 lightDir) {
    float vertexNdL = max(0.0, dot(modifiedNormal, lightDir));
    float vertexNdV = max(dot(modifiedNormal, viewDir), 0.0);
    float fresnel = pow(1.0 - vertexNdV, uFresnelPower);
    vec3 litColor = vec3(4.0) * pow(vertexNdL, 8.0);
    litColor += 2. * uLightColor * pow(vertexNdL, 40.0) * pow(1.0 - vertexNdV, 40.0);
    litColor = pow(litColor, vec3(4.)) * 0.05;
    litColor += vec3(1.0) * uLightColor * fresnel * pow(vertexNdL, 4.0);
    litColor *= 0.2 + 0.8 * clamp(pow(1.0 - modifiedNormal.z, 5.0), 0.0, 1.0);
    litColor = pow(litColor, vec3(0.8)) * 2.;
    litColor += vec3(1.) * uLightingIntensity;
    return litColor;
}

vec3 applyFresnelLightingToColor(vec3 baseColor) {
    vec3 vertexNormal = normalize(vViewNormal);
    vec3 vertexNormalWorld = inverseTransformDirection(vertexNormal, viewMatrix);
    vec3 modifiedNormal = modifyNormalWithNoise(vertexNormalWorld);
    vec3 viewDirView = normalize(-vViewPosition);
    vec3 viewDir = inverseTransformDirection(viewDirView, viewMatrix);
    vec3 lightDir = normalize(uLightDirection);
    vec3 litColor = computeFresnelLighting(modifiedNormal, viewDir, lightDir);
    float yBasedIntensity = 1. - vUv.y;
    litColor = pow(litColor, vec3(yBasedIntensity * 2.));
    litColor *= yBasedIntensity;
    litColor += vPosition.y * 0.01;
    vec3 blended = mix(baseColor, baseColor * litColor, uLightingMix);
    float gray = dot(blended, vec3(0.299, 0.587, 0.114));
    return vec3(gray);
}

vec3 renderMappedTextureMode() {
    vec3 baseColor = sampleMaterials();
    vec2 screenUv = computeScreenUv();
    vec3 colorFinal;
    if (computeScanr(screenUv) > 0.5) {
        vec3 scanGridColor = vec3(1.0 / 255.0);
        scanGridColor = applyFresnelLightingToColor(scanGridColor);
        float border = uDpr / uResolution.x * 2.0;
        if (screenUv.x < uHideRatio + border && screenUv.x > uHideRatio - border) {
            scanGridColor += vec3(0.1);
        }
        colorFinal = scanGridColor;
    } else {
        colorFinal = baseColor;
    }
    return colorFinal;
}

void main() {
    gl_FragColor = vec4(renderMappedTextureMode(), 1.0);
}`,
      depthWrite: true,
      uniforms: {
        uResolution: { value: new THREE.Vector2() },
        uDpr: { value: 1 },
        uBaseTexture: { value: null },
        uCityTexture: { value: null },
        uisCity: { value: false },
        uHideRatio: { value: 0 },
        uBgColor: { value: new THREE.Color() },
        uScanRatio: { value: 0 },
        uNoiseTexture: { value: noiseTexture },
        uLightingIntensity: { value: 0.5 },
        uFresnelPower: { value: 5 },
        uNoiseInfluence: { value: 0.15 },
        uNoiseFrequency: { value: 48 },
        uLightingMix: { value: 0.8 },
        uLightDirection: { value: new THREE.Vector3(1, 1, 0.8) },
        uLightColor: { value: new THREE.Color("#ffffff") },
        uFogStart: { value: 12 },
        uFogEnd: { value: 36 },
        uFogDensity: { value: 1 },
        uFogExponent: { value: 1 },
        uFogSkyColor: { value: new THREE.Color("#c9e0f7") },
        uFogBlendFactor: { value: 0.5 },
        uPanoMix: { value: 0 },
        uPanorama: { value: null },
        uCloudTime: { value: 0 },
      },
    });
  }
}
