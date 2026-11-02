"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { BlendFunction, CopyPass, Effect, EffectComposer, EffectPass, RenderPass, SMAAEffect } from "postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BG_COLOR, SKY_COLOR, terrainOffset } from "@/lib/constants";
import { damp, remap } from "@/lib/math";
import { computeSceneRanges, SCENE, sceneDataAt, scenes, useScenes, type SceneData, type SceneId } from "@/lib/scenes";
import { mapStory, openingNow, storyMap, useStage, wipeProgress, wipeRatioAt } from "@/lib/story-map";
import { useMediaQuery } from "@/lib/use-media-query";
import { clayState } from "./clay-map";
import { fisheyeAt } from "./opening";
import { TerrainLensEffect } from "./TerrainLensEffect";
import { DAYLIGHT, HERO_LIGHT, heroLight } from "./hero-light";
import { cameraTilt } from "./camera-tilt";

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

/**
 * Raven opening lens (not in the shipped bundle): barrel distortion for the wide low shot. Centre magnified, edges
 * compressed, corners pinned to the corners so nothing outside the render is sampled. Strength 0 = identity; the pass
 * is disabled at the hero frame and after.
 */
class FisheyeEffect extends Effect {
  constructor() {
    super(
      "FisheyeEfx",
      /* glsl */ `
uniform float uStrength;
uniform float uAspect;
void mainUv(inout vec2 uv) {
  vec2 d = (uv - 0.5) * vec2(uAspect, 1.0);
  float rMax2 = 0.25 * (uAspect * uAspect + 1.0);
  d *= (1.0 + uStrength * dot(d, d) / rMax2) / (1.0 + uStrength);
  uv = 0.5 + d / vec2(uAspect, 1.0);
}`,
      {
        uniforms: new Map<string, THREE.Uniform>([
          ["uStrength", new THREE.Uniform(0)],
          ["uAspect", new THREE.Uniform(1)],
        ]),
      },
    );
  }
  u(name: string) {
    return this.uniforms.get(name)!;
  }
}

/**
 * Raven: diagonal transition from story band 1 (Route) into band 2 (Care teams map), user 2026-11-01. The shipped
 * Phalanx wipe (terrain/grid/fire shaders, `computeScreenUv` + `hideRatio`) restyles one continuous overhead view; Raven
 * skips the thermal/ignition flight that led there. So the Route stays live (terrain travel, drone hover) and the
 * swept side shows the Care teams map at phalanx .5, rendered once off screen (`Preroll` in `usePostFX`): in the shipped scene
 * that frame is static (terrain stopped, camera parked). Same edge maths as `computeScreenUv` on the composer uv
 * (= gl_FragCoord / drawing-buffer size, as in the terrain shader) and the same 0.1 border on the swept side.
 */
class DiagonalWipeEffect extends Effect {
  constructor(capture: THREE.Texture) {
    super(
      "DiagonalWipeEfx",
      /* glsl */ `
uniform sampler2D uCapture;
uniform float uRatio;
uniform float uBorder;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 s = (uv - 0.5) / sqrt(2.0) + 0.5;
  float a = radians(5.0 * 45.0);
  float x = cos(a) * (s.x - 0.5) - sin(a) * (s.y - 0.5) + 0.5;
  if (x < uRatio) {
    vec3 map = texture2D(uCapture, uv).rgb;
    if (x > uRatio - uBorder) map += vec3(0.1);
    outputColor = vec4(map, 1.0);
  } else {
    outputColor = inputColor;
  }
}`,
      {
        uniforms: new Map<string, THREE.Uniform>([
          ["uCapture", new THREE.Uniform(capture)],
          ["uRatio", new THREE.Uniform(0)],
          ["uBorder", new THREE.Uniform(0.001)],
        ]),
      },
    );
  }
  u(name: string) {
    return this.uniforms.get(name)!;
  }
}

/** Frames rendered in the map state before the capture (clip seekers, terrain travel and fog settle in one). */
const MAP_SETTLE_FRAMES = 3;
type Preroll = { state: "idle" | "running" | "done"; frame: number; saved: { id: SceneId; ref: SceneData; val: SceneData }[]; warm: number };

/** Puts the store into `data` without notifying React (DOM chapter copy, HUD and nav never see it); returns undo info. */
function enterSilently(data: Record<SceneId, SceneData>) {
  const st = useScenes.getState();
  const saved: Preroll["saved"] = [];
  for (const id of Object.keys(data) as SceneId[]) {
    const ref = st[id];
    saved.push({ id, ref, val: { ...ref } });
    Object.assign(ref, data[id]);
  }
  return saved;
}
/** Restores what `enterSilently` replaced, unless a real scroll update already swapped that scene's object. */
function leaveSilently(saved: Preroll["saved"]) {
  const st = useScenes.getState();
  for (const { id, ref, val } of saved) if (st[id] === ref) Object.assign(ref, val);
}

/** Grade, grain and vignette (shipped module 98894 + shader 25460; thermal palette box dropped with the thermal chapter). */
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
        ]),
      },
    );
  }
  u(name: string) {
    return this.uniforms.get(name)!;
  }
}

/** Lens (Raven): exposure for the terrain motion blur and the thin-lens blur at infinity (px at 1080p). */
const SHUTTER_S = 1 / 30;
/** Perceived flight speed: terrain-travel streak exposed as if the ground passed this many times faster.
 * 3 -> 1.5 and the streak cap 16 -> 9 px (user, 2026-11-02: terrain motion blur was too strong). */
const SPEED_GAIN = 1.5;
/** Longest motion streak and largest defocus disc (px at 1080p). */
const MAX_BLUR_PX = 9;
/**
 * Thin-lens focus on the drone (user, 2026-11-02: blur the landscape like a film lens / the eye focusing on the
 * product). CoC = COC_INF_PX * |1 - focus / dist|: from overhead the ground is only ~15% beyond the drone, so 5 gave
 * < 1 px; 60 gives ~8 px there, and the far hero background reaches the 14 px cap. Drones are never blurred.
 */
const MAX_COC_PX = 14;
const COC_INF_PX = 60;
/**
 * Only when the camera looks down on the drone (user: not in the hero or the chapters that follow it obliquely).
 * Elsewhere the original light blur (5). Blend by view direction: -dir.y 0.75 -> 0.95 (hero/Route ~0.55, top views 1).
 */
const COC_INF_PX_BASE = 5;
const _camDir = new THREE.Vector3();
/** Smoothed top-view weight: follows the tilt, eased over ~0.4 s so snaps and camera-track switches never pop. */
const topViewState = { value: 0 };
/** Top of the terrain band in world Y (parent -2.5 + 0.04 x highest roof ~20 local = -1.7); drones fly above. */
const TERRAIN_TOP = -1.55;
const _vp = new THREE.Matrix4();
const _drone = new THREE.Vector3();
const _eye = new THREE.Vector3();

/** Composer: scene -> terrain lens (Raven) -> flock crossfade -> AA -> final grade (shipped module 41480). */
export function usePostFX(flockTarget: THREE.WebGLRenderTarget) {
  const { gl, scene, size, camera } = useThree();
  const aspect = useRef(new THREE.Vector2());
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // `?lens=off` disables the Raven lens pass (comparison).
  const [lensOn] = useState(() => typeof window === "undefined" || new URLSearchParams(window.location.search).get("lens") !== "off");
  const lensState = useRef({ prevVP: new THREE.Matrix4(), prevOffset: 0, step: 0, first: true, frame: 0, drone: null as THREE.Object3D | null });
  const pre = useRef<Preroll>({ state: "idle", frame: 0, saved: [], warm: 0 });
  const lastSide = useRef(0);
  const mixWarm = useRef(3);
  const [composer, final, mix, mixPass, lens, fisheye, fisheyePass, capturePass, wipe, wipePass, finalPass] = useMemo(() => {
    const composer = new EffectComposer(gl, { multisampling: 0 });
    const final = new FinalEffect();
    const mix = new RenderTargetMixEffect(flockTarget);
    const lens = new TerrainLensEffect();
    const fisheye = new FisheyeEffect();
    const fisheyePass = new EffectPass(camera, fisheye);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new EffectPass(camera, lens)); // needs the scene depth: first pass after the render
    composer.addPass(fisheyePass); // Raven opening: bends the finished frame, before AA and grade
    const mixPass = new EffectPass(camera, mix);
    composer.addPass(mixPass);
    // Shipped bundle constructs a default effect here (minified `eF`); SMAA is inferred.
    composer.addPass(new EffectPass(camera, new SMAAEffect()));
    // Raven band 1 → band 2: the Care teams map is captured here once (off screen, no swap), then laid over the live
    // Route on the swept side; both before the grade, so grain and vignette stay live across the edge.
    const capturePass = new CopyPass();
    const wipe = new DiagonalWipeEffect(capturePass.texture);
    const wipePass = new EffectPass(camera, wipe);
    capturePass.enabled = false;
    wipePass.enabled = false;
    composer.addPass(capturePass);
    composer.addPass(wipePass);
    const finalPass = new EffectPass(camera, final);
    composer.addPass(finalPass);
    return [composer, final, mix, mixPass, lens, fisheye, fisheyePass, capturePass, wipe, wipePass, finalPass] as const;
  }, [gl, scene, camera, flockTarget]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
    // The capture target was resized (cleared) and the camera track may have switched (mobile/desktop): re-render.
    if (pre.current.state === "done") pre.current = { state: "idle", frame: 0, saved: [], warm: 0 };
  }, [composer, size]);
  useEffect(() => () => composer.dispose(), [composer]);
  useEffect(() => {
    const k = size.height / Math.sqrt(size.width * size.width + size.height * size.height);
    aspect.current.set((size.width / size.height) * k, k);
  }, [size]);

  // A positive-priority frame callback disables R3F's automatic render.
  useFrame(() => {}, 1);
  useFrame((state, dt) => {
    const p = pre.current;
    // Off-screen map render: the store was put into the map state at the end of the previous frame, so every scene
    // component has already updated for it this frame. Nothing reaches the canvas (final pass off) and the DOM never
    // re-renders (silent store), so the visitor keeps seeing the last presented frame for these few frames.
    if (p.state === "running") {
      p.frame++;
      const capture = p.frame >= MAP_SETTLE_FRAMES;
      runFrame(state, dt, { capture, offscreen: true });
      if (capture) {
        leaveSilently(p.saved);
        storyMap.preroll = false;
        lensState.current.first = true;
        p.state = "done";
      }
      return;
    }
    runFrame(state, dt, { capture: false, offscreen: false });
    // Start the map render once the scene has rendered a few frames and the layout is measured (behind the loader on
    // a normal load; on resize it costs a few frames of a held picture).
    if (p.state === "idle" && storyMap.W > 0 && ++p.warm > 10) {
      const vh = storyMap.vh || window.innerHeight;
      storyMap.preroll = true;
      p.saved = enterSilently(sceneDataAt(mapStory(), computeSceneRanges(vh), vh));
      p.frame = 0;
      p.state = "running";
    }
  }, 100);

  function runFrame(state: { clock: THREE.Clock; camera: THREE.Camera }, dt: number, o: { capture: boolean; offscreen: boolean }) {
    const s = scenes();
    const multi = s[SCENE.MULTI_THREAT_RESPONSE];
    if (!o.offscreen) {
      if (multi.hideRatio > 0.8) return;
      if (useStage.getState().cover === 0) return; // Raven: stage off screen after the story
    }
    // Journey's network map is not shown (user, 2026-11-02: Journey removed); the pass stays for the load-time warm-up.
    const mixFactor = 0;
    const nextProgress = s[SCENE.REAL_TIME_DETECTION].progress;
    mix.mixFactor = mixFactor;
    mix.nextSceneProgress = nextProgress;
    // Perf: the shader passes the input through unchanged when mixFactor <= 0 or its fadeOut (1 - smoothstep(.05, .15,
    // next)) is 0; skip the full-screen pass then.
    // Raven: also run it for the first frames (mixFactor 0 = input unchanged) so it compiles at load, not as a one-frame
    // stall when the Journey map fades in.
    mixPass.enabled = (mixFactor > 0 && nextProgress < 0.15) || mixWarm.current-- > 0;
    final.u("uVignetteAspect").value.copy(aspect.current);
    final.u("uTime").value = state.clock.getElapsedTime();
    // Hero preset (hero-light.ts): grain and sharpen from the user's panel in the hero, shipped values after.
    const h = heroLight.weight;
    final.u("uGrainAmount").value = DAYLIGHT.grain + (HERO_LIGHT.post.grain - DAYLIGHT.grain) * h;
    final.u("uSharpenOpacity").value = DAYLIGHT.sharpen + (HERO_LIGHT.post.sharpen - DAYLIGHT.sharpen) * h;
    final.u("uOpacity").value = remap(multi.hideRatio, 0, 0.25, 1, 0);
    updateLens(state.camera, dt);
    const barrel = fisheyeAt(openingNow());
    fisheyePass.enabled = barrel > 1e-4;
    fisheye.u("uStrength").value = barrel;
    fisheye.u("uAspect").value = size.width / size.height;
    // Diagonal transition (Route live, map captured): active strictly inside the wipe range of the page.
    const page = window.scrollY;
    const t = wipeProgress(page);
    const side = t <= 0 ? 0 : t >= 1 ? 2 : 1;
    if ((side === 2) !== (lastSide.current === 2)) lensState.current.first = true; // camera cut at the switch: no history
    lastSide.current = side;
    capturePass.enabled = o.capture;
    finalPass.enabled = !o.offscreen;
    wipePass.enabled = !o.offscreen && side === 1 && pre.current.state === "done";
    wipe.u("uRatio").value = wipeRatioAt(page);
    wipe.u("uBorder").value = 2 / size.width; // shipped: uDpr / uResolution.x * 2 in drawing-buffer pixels
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    const night = s[SCENE.IGNITION_VERIFIED].progress > 0.99;
    gl.setClearColor(night ? BG_COLOR : SKY_COLOR, 1);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    composer.render(dt);
    lensState.current.prevVP.copy(_vp);
  }

  function updateLens(cam: THREE.Camera, dt: number) {
    const st = lensState.current;
    const pc = cam as THREE.PerspectiveCamera;
    cam.updateWorldMatrix(true, false); // camera lives under the clip-driven mover/dolly groups
    _vp.multiplyMatrices(pc.projectionMatrix, pc.matrixWorldInverse);
    const offset = terrainOffset.current ?? 0;
    let step = offset - st.prevOffset;
    st.prevOffset = offset;
    if (st.first || Math.abs(step) > 2 || dt > 0.1) {
      // first frame, wrap/ramp jump or a stalled tab: no history, no blur this frame
      st.prevVP.copy(_vp);
      step = 0;
      st.step = 0;
      st.first = false;
    }
    // Smooth the per-frame travel so frame-time jitter does not make the streak length flicker.
    st.step = damp(st.step, step, 10, dt);
    st.drone ??= scene.getObjectByName("Drone1Group") ?? null;
    cam.getWorldPosition(_eye);
    const focus = st.drone ? st.drone.getWorldPosition(_drone).distanceTo(_eye) : 10;
    const ratio = gl.getPixelRatio();
    const u = (n: string) => lens.u(n).value;
    u("uInvProj").copy(pc.projectionMatrixInverse);
    u("uCamWorld").copy(pc.matrixWorld);
    u("uPrevViewProj").copy(st.prevVP);
    u("uTexel").set(1 / (size.width * ratio), 1 / (size.height * ratio));
    lens.u("uPxScale").value = (size.height * ratio) / 1080;
    lens.u("uNear").value = pc.near;
    lens.u("uFar").value = pc.far;
    lens.u("uTerrainStep").value = st.step;
    // Streak = per-frame screen motion scaled to the exposure: velocity x shutter time.
    lens.u("uShutter").value = dt > 0 ? Math.min(SHUTTER_S / dt, 4) : 0;
    lens.u("uMotion").value = reducedMotion || !lensOn ? 0 : 1;
    lens.u("uSpeedGain").value = SPEED_GAIN;
    lens.u("uFocus").value = focus;
    pc.getWorldDirection(_camDir);
    // Top views, and the overhead chapters now shown obliquely (camera-tilt.ts).
    const topTarget = Math.max(THREE.MathUtils.smoothstep(-_camDir.y, 0.75, 0.95), cameraTilt.weight);
    topViewState.value += (topTarget - topViewState.value) * (1 - Math.exp(-dt / 0.4));
    const topView = topViewState.value;
    // Raven clay map (clay-map.ts): a sharp model, no depth of field (its contours and dots are the content).
    const dof = lensOn && !clayState.on;
    lens.u("uCocInf").value = dof ? COC_INF_PX_BASE + (COC_INF_PX - COC_INF_PX_BASE) * topView : 0;
    lens.u("uMaxBlurPx").value = MAX_BLUR_PX * ((size.height * ratio) / 1080);
    lens.u("uMaxCocPx").value = MAX_COC_PX * ((size.height * ratio) / 1080);
    lens.u("uTerrainTop").value = TERRAIN_TOP;
    lens.u("uFrame").value = st.frame = (st.frame + 1) % 997;
  }
}
