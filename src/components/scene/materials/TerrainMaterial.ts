import * as THREE from "three";
import { groundDimUniforms } from "../ground-dim";
import { panoramaLookup } from "../shaders/panorama";
import { computeScreenUv } from "../shaders/screen-uv";

/**
 * Raven payload stage (lib/payload.ts): the live ground turns into the grey clay model on black (colours, shading and
 * dot grid of scene/clay-map.ts, after the reference's `net` section). The change sweeps as a front from the far
 * ridges toward the camera (user's reference recording: the far terrain changes first), with a faint scan line on
 * the front. Shared uniform objects: one write reaches every terrain material (tiles, villages).
 */
export const payloadClayUniforms = {
  /** Sweep progress 0 (live ground) -> 1 (all clay). */
  uPayloadClay: { value: 0 },
  uPayloadBg: { value: new THREE.Color("#0e0e0e") }, // CLAY.bg
  uPayloadLow: { value: new THREE.Color("#262626") }, // CLAY.low
  uPayloadHigh: { value: new THREE.Color("#8e8e8e") }, // CLAY.high
  uPayloadIce: { value: new THREE.Color("#e4e4e4") }, // CLAY.ice
  /** Clay key light (world): from the upper left of the hero/payload views (camera looks toward -z). */
  uPayloadLight: { value: new THREE.Vector3(-0.62, 0.62, -0.2).normalize() },
};

/** Clay sweep: front distance from the camera at progress 0 / 1, and the soft band either side of it (world units). */
const CLAY_FRONT = { far: 46, near: 0, band: 4 }; // the hero/payload views see ground from ~5 to ~40 units
/** Clay fog to the background (world units from the camera): far ridges fade into black like the reference. */
const CLAY_FOG = { start: 16, end: 58 };
/** Dot grid: 3 dots per map unit (CLAY.dotDensity) in tile-local units (TERRAIN_SCALE .04: 25 local per map unit). */
const CLAY_DOTS = 3 * 0.04;

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
uniform float uGroundDim; // black overlay under the cloud wisps (ground-dim.ts)
uniform float uPayloadClay;
uniform vec3 uPayloadBg;
uniform vec3 uPayloadLow;
uniform vec3 uPayloadHigh;
uniform vec3 uPayloadIce;
uniform vec3 uPayloadLight;
uniform float uPayloadHouse; // 1 on the village houses (light clay, like the clay map's houses)
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

// Raven payload stage: live colour -> clay model, swept from far to near (payloadClayUniforms).
vec3 payloadClay(vec3 col, float distance) {
    if (uPayloadClay <= 0.0) return col;
    vec3 n = inverseTransformDirection(normalize(vViewNormal), viewMatrix); // 2x horizontal relief, like the clay map
    float diff = max(dot(n, uPayloadLight), 0.0);
    float slope = 1.0 - clamp(n.y, 0.0, 1.0);
    vec3 base = mix(uPayloadLow, uPayloadHigh, smoothstep(-9.0, 30.0, vPosition.y));
    base *= 0.82 + 0.18 * smoothstep(0.15, 0.6, slope);
    // Brighter than the overhead clay map: this view looks across the relief, so less of it faces the light.
    base = mix(base, uPayloadHigh * 1.15, uPayloadHouse); // CLAY.house #a9a9a9
    vec3 clay = base * (0.3 + 1.05 * diff) + uPayloadIce * 0.02;
    // Regular dot grid draped over the ground (tile-local, so the dots travel with it); round on screen, faded where
    // it gets denser than a few pixels.
    vec2 g = vPosition.xz * ${CLAY_DOTS.toFixed(4)};
    vec2 fw = max(fwidth(g), vec2(1e-4));
    float rpx = length(g - floor(g + 0.5)) / max(fw.x, fw.y); // round dots even on slopes seen at an angle
    float dotMask = (1.0 - smoothstep(0.8, 1.5, rpx)) * (1.0 - smoothstep(0.12, 0.3, max(fw.x, fw.y)));
    dotMask *= smoothstep(0.5, 0.75, n.y); // steep faces stretch the draped grid into dashes: dots on gentle ground only
    clay = mix(clay, uPayloadIce * 0.75, dotMask * 0.32);
    clay = mix(clay, uPayloadBg, smoothstep(${CLAY_FOG.start.toFixed(1)}, ${CLAY_FOG.end.toFixed(1)}, distance));
    // Front: far ridges first, then toward the camera.
    float front = mix(${CLAY_FRONT.far.toFixed(1)}, ${CLAY_FRONT.near.toFixed(1)}, uPayloadClay);
    float w = smoothstep(front - ${CLAY_FRONT.band.toFixed(1)}, front + ${CLAY_FRONT.band.toFixed(1)}, distance);
    float line = exp(-pow((distance - front) / 0.6, 2.0)) * (1.0 - smoothstep(0.85, 1.0, uPayloadClay));
    return mix(col, clay, w) + uPayloadIce * line * 0.22;
}

vec3 sampleMaterials() {
    vec4 textureColor = texture(uBaseTexture, vUv);
    vec4 cityColor = texture(uCityTexture, vUv);
    vec3 baseColor = textureColor.rgb;
    if (uisCity) {
        baseColor = mix(baseColor, cityColor.rgb, cityColor.a);
    }
    float distance = length(vViewPosition);
    return payloadClay(applyFog(baseColor, distance) * (1.0 - uGroundDim), distance);
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
        ...groundDimUniforms, // shared instance: one update reaches every terrain material
        ...payloadClayUniforms, // shared too (payload stage)
        uPayloadHouse: { value: 0 }, // own per material (Terrain sets it on the village material)
      },
    });
  }
}
