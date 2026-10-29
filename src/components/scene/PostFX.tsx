"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { BlendFunction, Effect, EffectComposer, EffectPass, RenderPass, SMAAEffect } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BG_COLOR, SKY_COLOR, thermalState } from "@/lib/constants";
import { remap } from "@/lib/math";
import { SCENE, scenes } from "@/lib/scenes";

/** Flock scene radial-blur crossfade (shipped module 8743 + shader 79755). */
class RenderTargetMixEffect extends Effect {
  constructor(target: THREE.WebGLRenderTarget) {
    super(
      "RenderTargetMixEfx",
      /* glsl */ `
uniform sampler2D uRenderTarget;
uniform float uMixFactor;
uniform float uNextSceneProgress;
#define MAX_STRENGTH 0.3

float Exponential_easeInOut(float begin, float change, float duration, float time) {
    if (time == 0.0) return begin;
    if (time == duration) return begin + change;
    float t = time / (duration / 2.0);
    if (t < 1.0) return change / 2.0 * pow(2.0, 10.0 * (t - 1.0)) + begin;
    return change / 2.0 * (-pow(2.0, -10.0 * (t - 1.0)) + 2.0) + begin;
}

float Sinusoidal_easeInOut(float begin, float change, float duration, float time) {
    return -change / 2.0 * (cos(PI * time / duration) - 1.0) + begin;
}

float rand(vec3 scale, float seed) {
    return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);
}

vec3 crossFade(vec2 texCoord, float dissolve) {
    vec3 fromColor = texture2D(inputBuffer, texCoord).rgb;
    vec3 toColor = texture2D(uRenderTarget, texCoord).rgb;
    return mix(fromColor, toColor, dissolve);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float progress = uMixFactor;
    float fadeOut = 1.0 - smoothstep(0.05, 0.15, uNextSceneProgress);
    if (progress <= 0.0 || fadeOut <= 0.0) {
        outputColor = inputColor;
        return;
    }
    vec2 center = vec2(0.5);
    float dissolve = Exponential_easeInOut(0.0, 1.0, 1.0, progress);
    float strength = Sinusoidal_easeInOut(0.0, MAX_STRENGTH, 0.5, progress);
    vec3 color = vec3(0.0);
    float total = 0.0;
    vec2 toCenter = center - uv;
    float offset = rand(vec3(12.9898, 78.233, 151.7182), 0.0) * 0.5;
    for (float t = 0.0; t <= 20.0; t++) {
        float percent = (t + offset) / 20.0;
        float weight = percent - percent * percent;
        color += crossFade(uv + toCenter * percent * strength, dissolve) * weight;
        total += weight;
    }
    vec3 blurred = color / total;
    outputColor = vec4(mix(inputColor.rgb, blurred, fadeOut), 1.0);
}`,
      {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map<string, THREE.Uniform>([
          ["uRenderTarget", new THREE.Uniform(target.texture)],
          ["uMixFactor", new THREE.Uniform(0)],
          ["uNextSceneProgress", new THREE.Uniform(0)],
        ]),
      },
    );
  }
  set mixFactor(v: number) {
    this.uniforms.get("uMixFactor")!.value = v;
  }
  set nextSceneProgress(v: number) {
    this.uniforms.get("uNextSceneProgress")!.value = v;
  }
}

/** Grade, grain, vignette and thermal palette box (shipped module 98894 + shader 25460). */
class FinalEffect extends Effect {
  constructor() {
    super(
      "FinalEfx",
      /* glsl */ `
uniform vec3 uBgColor;
uniform float uOpacity;
uniform float uVignetteFrom;
uniform float uVignetteTo;
uniform vec2 uVignetteAspect;
uniform vec3 uVignetteColor;
uniform float uSaturation;
uniform float uContrast;
uniform float uBrightness;
uniform vec3 uTintColor;
uniform float uTintOpacity;
uniform float uSharpenKernelOffset;
uniform float uSharpenOpacity;
uniform float uGamma;
uniform float uGrainAmount;
uniform float uTime;
uniform float uThermalInvert;
uniform vec2 uThermalInvertPos;
uniform vec2 uThermalInvertSize;
uniform vec2 uThermalInvertTargetPos;

float hash13(vec3 p3) {
  p3 = fract(p3 * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 screen(vec3 cb, vec3 cs) { return cb + cs - (cb * cs); }
vec3 colorDodge(vec3 cb, vec3 cs) { return mix(min(vec3(1.0), cb / (1.0 - cs)), vec3(1.0), step(vec3(1.0), cs)); }
vec3 sharpen(sampler2D image, vec2 uv) {
  mat3 kernel = mat3(-1, -1, -1, -1, 9, -1, -1, -1, -1);
  float offset = uSharpenKernelOffset;
  vec3 sum = vec3(0.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      sum += texture2D(image, uv + vec2(float(x), float(y)) * offset).rgb * kernel[x + 1][y + 1];
    }
  }
  return sum;
}
vec3 colorVibrancy(vec3 color, float vibrancy, float luma) {
  float maxVal = max(max(color.r, color.g), color.b);
  float minVal = min(min(color.r, color.g), color.b);
  float sat = maxVal - minVal;
  float vibFactor = smoothstep(0.0, 0.5, sat);
  vibFactor = 1.0 + vibrancy * (1.0 - vibFactor);
  return mix(vec3(luma), color, vibFactor);
}
vec3 gammaCorrect(vec3 color, float gamma) { return pow(clamp(color, 0.0, 1.0), vec3(1.0 / gamma)); }
vec3 ACESFilm(vec3 x) { return (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14); }

const vec3 ironPalette[10] = vec3[10](
  vec3(1.0, 0.996, 0.957),
  vec3(1.0, 0.855, 0.055),
  vec3(0.961, 0.486, 0.0),
  vec3(0.878, 0.216, 0.227),
  vec3(0.690, 0.004, 0.596),
  vec3(0.486, 0.0, 0.616),
  vec3(0.290, 0.0, 0.588),
  vec3(0.106, 0.0, 0.502),
  vec3(0.0, 0.0, 0.290),
  vec3(0.0, 0.0, 0.039)
);
vec3 palette(in float t) {
  t = clamp(t, 0.0, 1.0);
  float scaledT = t * 9.0;
  int index = int(floor(scaledT));
  float f = scaledT - float(index);
  index = min(index, 8);
  return mix(ironPalette[index], ironPalette[index + 1], f);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 sharpenedColor = sharpen(inputBuffer, uv);
  vec3 color = mix(inputColor.rgb, sharpenedColor, uSharpenOpacity);
  float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color = colorVibrancy(color, uSaturation, luma);
  color = 0.5 + (1.0 + uContrast) * (color - 0.5);
  color += uBrightness;
  float grain = fract(sin(dot(uv, vec2(100.9898 + uTime * 1.1, 100.233))) * 43758.5453);
  float darkGrainAmount = uGrainAmount * pow(1. - luma, 3.);
  color += color * (grain - 0.8) * (uGrainAmount + darkGrainAmount);
  color = mix(color, screen(colorDodge(color, uTintColor), uTintColor), uTintOpacity);
  float d = length((uv - 0.5) * uVignetteAspect) * 2.0;
  color = mix(color, uVignetteColor, smoothstep(uVignetteFrom, uVignetteTo, d));
  color += hash13(vec3(gl_FragCoord.xy, uTime)) / 255.0;
  float verticalFalloff = smoothstep(0.25, 0.75, abs(uv.y - 0.5));
  color = mix(color, uVignetteColor, verticalFalloff);

  vec2 boxPos = vec2(uThermalInvertPos.x, 1.0 - uThermalInvertPos.y);
  vec2 targetPos = vec2(uThermalInvertTargetPos.x, 1.0 - uThermalInvertTargetPos.y);
  vec2 halfSize = 0.5 * uThermalInvertSize;
  vec2 boxMin = boxPos - halfSize;
  vec2 boxMax = boxPos + halfSize;
  bool inBox = all(greaterThanEqual(uv, boxMin)) && all(lessThanEqual(uv, boxMax));
  float legendWidth = uThermalInvertSize.x * 0.02;
  vec2 legendMax = vec2(boxMax.x, boxMax.y);
  vec2 legendMin = vec2(boxMax.x - legendWidth, boxMin.y);
  bool inLegend = all(greaterThanEqual(uv, legendMin)) && all(lessThanEqual(uv, legendMax));
  if (inBox) {
    float di = 1.0 - smoothstep(0.00, 0.6, distance(uv, targetPos));
    float di2 = 1.0 - smoothstep(0.015, 0.1, distance(uv, targetPos));
    di = pow(di, 24.0);
    di2 = pow(di2, 32.0);
    luma = mix(luma * 0.2, luma, di);
    luma = mix(luma, pow(luma * 7.0, 2.0), di2);
    vec3 thermalColor = palette(1.0 - luma);
    thermalColor = pow(thermalColor, vec3(1.75));
    color = mix(color, thermalColor, uThermalInvert);
  }
  if (inLegend) {
    float legendT = (uv.y - legendMin.y) / (legendMax.y - legendMin.y);
    legendT = pow(legendT * 1.0, 1.75);
    vec3 legendColor = palette(1.0 - legendT);
    legendColor *= vec3(2.0, 1.0, 1.0);
    legendColor = pow(legendColor, vec3(1.5));
    color = mix(color, legendColor, uThermalInvert);
  }
  float fadeOut = smoothstep(0.0, 1.0 - uOpacity, uv.y);
  color = mix(uBgColor, color, fadeOut);
  color = gammaCorrect(color, uGamma);
  color = mix(color, ACESFilm(color), 0.15);
  outputColor = vec4(vec3(color), 1.0);
}`,
      {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map<string, THREE.Uniform>([
          ["uBgColor", new THREE.Uniform(BG_COLOR)],
          ["uOpacity", new THREE.Uniform(1)],
          ["uVignetteFrom", new THREE.Uniform(0)],
          ["uVignetteTo", new THREE.Uniform(1)],
          ["uVignetteAspect", new THREE.Uniform(new THREE.Vector2())],
          ["uVignetteColor", new THREE.Uniform(new THREE.Color("#000"))],
          ["uSaturation", new THREE.Uniform(0.3)],
          ["uContrast", new THREE.Uniform(0.02)],
          ["uBrightness", new THREE.Uniform(0.02)],
          ["uTintColor", new THREE.Uniform(new THREE.Color("#092b3b"))],
          ["uTintOpacity", new THREE.Uniform(0.06)],
          ["uGamma", new THREE.Uniform(1.1)],
          ["uSharpenKernelOffset", new THREE.Uniform(14e-5)],
          ["uSharpenOpacity", new THREE.Uniform(0.3)],
          ["uGrainAmount", new THREE.Uniform(0.25)],
          ["uTime", new THREE.Uniform(0)],
          ["uThermalInvert", new THREE.Uniform(0)],
          ["uThermalInvertPos", new THREE.Uniform(new THREE.Vector2())],
          ["uThermalInvertSize", new THREE.Uniform(new THREE.Vector2())],
          ["uThermalInvertTargetPos", new THREE.Uniform(new THREE.Vector2())],
        ]),
      },
    );
  }
  u(name: string) {
    return this.uniforms.get(name)!;
  }
}

/** Composer: scene -> flock crossfade -> AA -> final grade (shipped module 41480). */
export function usePostFX(flockTarget: THREE.WebGLRenderTarget) {
  const { gl, scene, size, camera } = useThree();
  const aspect = useRef(new THREE.Vector2());
  const [composer, final, mix] = useMemo(() => {
    const composer = new EffectComposer(gl, { multisampling: 0 });
    const final = new FinalEffect();
    const mix = new RenderTargetMixEffect(flockTarget);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new EffectPass(camera, mix));
    // Shipped bundle constructs a default effect here (minified `eF`); SMAA is inferred.
    composer.addPass(new EffectPass(camera, new SMAAEffect()));
    composer.addPass(new EffectPass(camera, final));
    return [composer, final, mix] as const;
  }, [gl, scene, camera, flockTarget]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size]);
  useEffect(() => () => composer.dispose(), [composer]);
  useEffect(() => {
    const k = size.height / Math.sqrt(size.width * size.width + size.height * size.height);
    aspect.current.set((size.width / size.height) * k, k);
  }, [size]);

  // A positive-priority frame callback disables R3F's automatic render.
  useFrame(() => {}, 1);
  useFrame((state, dt) => {
    const s = scenes();
    const multi = s[SCENE.MULTI_THREAT_RESPONSE];
    if (multi.hideRatio > 0.8) return;
    mix.mixFactor = remap(s[SCENE.FLOCK_SCENE].progress, 0.75, 1, 0, 1);
    mix.nextSceneProgress = s[SCENE.REAL_TIME_DETECTION].progress;
    final.u("uVignetteAspect").value.copy(aspect.current);
    final.u("uTime").value = state.clock.getElapsedTime();
    final.u("uOpacity").value = remap(multi.hideRatio, 0, 0.25, 1, 0);
    final.u("uThermalInvert").value = thermalState.shouldInvert;
    final.u("uThermalInvertPos").value.copy(thermalState.pos);
    final.u("uThermalInvertSize").value.copy(thermalState.size);
    final.u("uThermalInvertTargetPos").value.copy(thermalState.targetPos);
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    const night = s[SCENE.IGNITION_VERIFIED].progress > 0.99;
    gl.setClearColor(night ? BG_COLOR : SKY_COLOR, 1);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    composer.render(dt);
  }, 100);
}
