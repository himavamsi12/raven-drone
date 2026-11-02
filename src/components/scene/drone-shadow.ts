import * as THREE from "three";

/**
 * Drone shadow on the terrain (Raven, user 2026-11-02: separate the dark drone from the ground naturally, no extra
 * lights). The terrain is an unlit ShaderMaterial and never receives the scene's shadow map, so the drones' opaque
 * parts are rendered each frame from the light into a small silhouette map (white = lit, black = drone), and every
 * TerrainMaterial projects its world position into that map and darkens the ground (`droneShadowTerrain`).
 *
 * Light: the real sun direction in daylight (crisper, stronger); under the hero preset's overcast light (sun off)
 * a softer, lighter shadow that leans 40% of the way toward the sun (a hazy sky is still brightest there). Straight
 * down it hid exactly behind the drone. Written by DroneShadow (MainScene).
 */
export const DRONE_SHADOW_LAYER = 5;
export const DRONE_SHADOW_SIZE = 1024;

/** Shared uniform objects: every TerrainMaterial references these same instances. */
export const droneShadowUniforms = {
  uDroneShadow: { value: null as THREE.Texture | null },
  uDroneShadowMatrix: { value: new THREE.Matrix4() },
  uDroneShadowStrength: { value: 0 },
  /** Penumbra radius in shadow-map UV. */
  uDroneShadowSoft: { value: 0.02 },
};

export const droneShadowTerrain = /* glsl */ `
uniform sampler2D uDroneShadow;
uniform mat4 uDroneShadowMatrix;
uniform float uDroneShadowStrength;
uniform float uDroneShadowSoft;

/** 0 = lit, 1 = fully in the drone's shadow. */
float droneShadowAt(vec3 worldPos) {
  if (uDroneShadowStrength <= 0.0) return 0.0;
  vec4 lp = uDroneShadowMatrix * vec4(worldPos, 1.0);
  vec2 uv = lp.xy / lp.w * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  // 12-tap disc (two rings + centre) for a soft penumbra.
  float occ = 1.0 - texture2D(uDroneShadow, uv).r;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0471976;
    vec2 o = vec2(cos(a), sin(a));
    occ += 1.0 - texture2D(uDroneShadow, uv + o * uDroneShadowSoft * 0.5).r;
    occ += 1.0 - texture2D(uDroneShadow, uv + vec2(o.y, -o.x) * uDroneShadowSoft).r;
  }
  occ /= 13.0;
  // fade out at the map border
  vec2 e = smoothstep(0.0, 0.08, uv) * smoothstep(0.0, 0.08, 1.0 - uv);
  return occ * e.x * e.y * uDroneShadowStrength;
}`;
