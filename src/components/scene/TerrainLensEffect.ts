import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";

/**
 * Raven lens pass (not in the shipped bundle): physically driven motion blur + depth of field on the terrain only.
 * Runs right after the scene render, on its colour + depth.
 *
 * Per pixel the world position is rebuilt from depth. Only the terrain height band (ground, houses; world y below
 * uTerrainTop) is treated; the drones fly above it and stay sharp. Taps that land on something nearer than the pixel
 * (a drone edge) are rejected, so nothing bleeds into the ground.
 *  - Motion blur: velocity = how this world point moved on screen since last frame = terrain travel this frame
 *    (it slides along -Z) plus the camera's own motion (reprojection with last frame's view-projection). Streak =
 *    velocity x shutter time, so near ground smears more than far ground and it scales with flight speed / scroll.
 *    The travel part is multiplied by uSpeedGain: the scene's terrain only drifts ~0.5 units/s, far too slow to read
 *    as a fast drone, so the streak is exposed as if the ground passed uSpeedGain times faster (camera part stays 1x).
 *  - Depth of field: thin lens focused on the hero drone. Blur diameter ~ |1 - focus / distance| (circle of
 *    confusion at fixed focal length and aperture); uCocInf is the diameter (px at 1080p) for a point at infinity.
 */
export class TerrainLensEffect extends Effect {
  constructor() {
    super(
      "TerrainLensEfx",
      /* glsl */ `
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform mat4 uPrevViewProj;
uniform vec2 uTexel;
uniform float uPxScale;
uniform float uNear;
uniform float uFar;
uniform float uTerrainStep;
uniform float uShutter;
uniform float uMotion;
uniform float uSpeedGain;
uniform float uMaxCocPx;
uniform float uFocus;
uniform float uCocInf;
uniform float uMaxBlurPx;
uniform float uTerrainTop;
uniform float uFrame;

float linearDepth(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  outputColor = inputColor;
  if (depth >= 0.99999) return; // sky
  vec4 view = uInvProj * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  view /= view.w;
  vec3 world = (uCamWorld * vec4(view.xyz, 1.0)).xyz;
  float terrain = 1.0 - smoothstep(uTerrainTop - 0.08, uTerrainTop + 0.08, world.y);
  if (terrain <= 0.0) return;

  // Motion: where was this ground point last frame? (terrain slid -Z by uTerrainStep)
  vec4 prevCam = uPrevViewProj * vec4(world, 1.0);
  vec4 prevAll = uPrevViewProj * vec4(world + vec3(0.0, 0.0, uTerrainStep), 1.0);
  vec2 camUv = prevCam.xy / prevCam.w * 0.5 + 0.5;
  vec2 allUv = prevAll.xy / prevAll.w * 0.5 + 0.5;
  vec2 vel = ((uv - camUv) + (camUv - allUv) * uSpeedGain) * uShutter * uMotion;
  float vLen = length(vel / uTexel);
  if (vLen > uMaxBlurPx) vel *= uMaxBlurPx / vLen;

  // Depth of field (thin lens), in pixels.
  float dist = length(view.xyz);
  float coc = min(uCocInf * uPxScale * abs(1.0 - uFocus / dist), uMaxCocPx);
  if (length(vel / uTexel) < 0.5 && coc < 0.5) return;

  // Nearer-object test (drone: never smear it into the ground) is linearDepth(tap) < 0.8 * lin. linearDepth is
  // monotonic in depth, so it is done on raw depth against that threshold mapped back once (perf: no per-tap divide).
  float lin = linearDepth(depth);
  float nearDepth = 0.5 * ((uFar + uNear - 2.0 * uNear * uFar / (0.8 * lin)) / (uFar - uNear) + 1.0);
  vec3 sum = inputColor.rgb;
  float total = 1.0;
  const int TAPS = 24; // long streaks: fewer taps band visibly
  const float GOLDEN = 2.39996;
  float jitter = fract(sin(dot(uv * 913.7 + uFrame, vec2(12.9898, 78.233))) * 43758.5453);
  // Tap i sits at angle (i + jitter) * GOLDEN + jitter * 6.2832: start there and rotate by GOLDEN per tap.
  float a0 = jitter * (GOLDEN + 6.2832);
  vec2 dir = vec2(cos(a0), sin(a0));
  mat2 STEP = mat2(cos(GOLDEN), sin(GOLDEN), -sin(GOLDEN), cos(GOLDEN));
  vec2 discPx = coc * 0.5 * uTexel;
  for (int i = 0; i < TAPS; i++) {
    float fi = float(i) + jitter;
    float t = fi / float(TAPS) - 0.5;
    float r = sqrt(fi / float(TAPS));
    vec2 tapUv = uv + vel * t + dir * r * discPx;
    dir = STEP * dir;
    if (readDepth(tapUv) < nearDepth) continue;
    sum += texture2D(inputBuffer, tapUv).rgb;
    total += 1.0;
  }
  outputColor = vec4(mix(inputColor.rgb, sum / total, terrain), inputColor.a);
}`,
      {
        blendFunction: BlendFunction.NORMAL,
        attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
        uniforms: new Map<string, THREE.Uniform>([
          ["uInvProj", new THREE.Uniform(new THREE.Matrix4())],
          ["uCamWorld", new THREE.Uniform(new THREE.Matrix4())],
          ["uPrevViewProj", new THREE.Uniform(new THREE.Matrix4())],
          ["uTexel", new THREE.Uniform(new THREE.Vector2(1, 1))],
          ["uPxScale", new THREE.Uniform(1)],
          ["uNear", new THREE.Uniform(0.1)],
          ["uFar", new THREE.Uniform(1000)],
          ["uTerrainStep", new THREE.Uniform(0)],
          ["uShutter", new THREE.Uniform(0)],
          ["uMotion", new THREE.Uniform(1)],
          ["uSpeedGain", new THREE.Uniform(1)],
          ["uMaxCocPx", new THREE.Uniform(18)],
          ["uFocus", new THREE.Uniform(10)],
          ["uCocInf", new THREE.Uniform(0)],
          ["uMaxBlurPx", new THREE.Uniform(36)],
          ["uTerrainTop", new THREE.Uniform(-1.5)],
          ["uFrame", new THREE.Uniform(0)],
        ]),
      },
    );
  }
  u(name: string) {
    return this.uniforms.get(name)!;
  }
}
