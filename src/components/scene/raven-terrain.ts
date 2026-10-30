import { heroPlateEnabled } from "./HeroPlate";

/**
 * Raven mountain-village tile (`raven-terrain.glb`, built from glb/raven-terrain/): replaces the shipped natural
 * `Land-A` tile and adds its `Houses`; the city tile keeps the shipped geometry and base map.
 * `?terrain=original` restores the shipped natural tile for comparison. The `?plate=h00` video prototype was matched
 * against the shipped terrain and supplies its own hero background, so it also gets the original tile: the plate and
 * the Raven terrain never share a test.
 */
export type TerrainVariant = "raven" | "original";

export function terrainVariant(): TerrainVariant {
  if (typeof window === "undefined") return "raven";
  const original = new URLSearchParams(window.location.search).get("terrain") === "original";
  return original || heroPlateEnabled() ? "original" : "raven";
}

/**
 * Ground height (tile-local glTF y) under each DetectionPoints anchor on the Raven tile, in POINTS order. Sampled
 * from the decoded asset by glb/raven-terrain/check_terrain.py; the shipped anchors sit on their own ground the same
 * way (within ~0.3 local units).
 */
export const RAVEN_DETECTION_Y: readonly number[] = [
  2.2072, 15.3542, 5.7944, 10.9097, 10.5347, 1.7904, 9.2352, 9.6087, 3.5862, -0.7122, 2.6627, -0.8854, -5.0324,
  0.7143, 9.9548, 4.1922, 7.5388, -1.7035, -1.5125, -0.6144, 4.2309, 3.701, -5.9048, 4.1747, 9.9282, 9.0975, -1.2693,
  0.6607, 3.1108, -0.1179, -4.8476, -1.7569, 2.1922, -0.6558,
];
