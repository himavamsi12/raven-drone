import * as THREE from "three";
import { SUN_POSITION } from "@/lib/constants";

/**
 * Live daylight (Raven addition, not in the shipped bundle). The aircraft stays near the origin while the
 * terrain scrolls, so a fixed sun/environment gives frozen highlights. Forward travel instead sways the
 * sun/sky heading (gentle course corrections) and passes cloud shade over the aircraft, so reflections
 * slide across the shell, arms and blades. Written once per frame by MainScene, read by RavenModel.
 * Terrain is an unlit ShaderMaterial, so only lit materials (the drones) respond.
 */
export const sunlight = {
  /** Yaw (rad, about +Y) applied to the sun direction and the drone environment map. */
  heading: 0,
  /** Small pitch (rad) applied to the environment map only. */
  pitch: 0,
  /** 1 = clear sun, ~0.7 = under passing cloud. */
  shade: 1,
  /** Normalised direction towards the (swayed) sun. */
  direction: SUN_POSITION.clone().normalize(),
};

const UP = new THREE.Vector3(0, 1, 0);
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** travel = terrain offset (~0.5–0.75 units/s in the hero); t = elapsed seconds. */
export function updateSunlight(travel: number, t: number, still: boolean) {
  if (still) {
    sunlight.heading = 0;
    sunlight.pitch = 0;
    sunlight.shade = 1;
  } else {
    // ~30 s sway plus a faster ~13 s correction, both driven by distance flown.
    sunlight.heading = 0.3 * Math.sin(travel * 0.35 + t * 0.01) + 0.08 * Math.sin(travel * 0.8 + 1.3);
    sunlight.pitch = 0.06 * Math.sin(travel * 0.5 + 0.4);
    // Broken cloud: occasional ~3 s dips to 70% direct sun.
    const cover = 0.5 + 0.5 * (0.65 * Math.sin(travel * 0.8 + t * 0.03) + 0.35 * Math.sin(travel * 1.9 + 2.1));
    sunlight.shade = 1 - 0.3 * smoothstep(0.55, 0.9, cover);
  }
  sunlight.direction.copy(SUN_POSITION).applyAxisAngle(UP, sunlight.heading).normalize();
}
