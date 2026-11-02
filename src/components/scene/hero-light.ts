import * as THREE from "three";
import { SCENE, scenes } from "@/lib/scenes";

/**
 * Hero lighting preset (user, 2026-11-02: values from their lighting panel, applied to the hero section only).
 * Weight 1 through the opening, the hero frame and the whole Airframe chapter (DELTA_DRONE); blends slowly to the
 * regular daylight (sunlight.ts) over the first 60% of SWARM_SCENE. The first version blended over DELTA_DRONE
 * 0.05-0.3, which one snapped gesture crosses in a moment: the drone visibly jumped from sky fill to hard sun (user,
 * 2026-11-02: the transition must be smooth and seamless).
 *
 * Conventions (the panel's source was not available): azimuth = three `atan2(x, -z)` in degrees (the scene sun
 * SUN_POSITION is -53 there, next to the panel's -51), elevation above the horizon; environment rotation is the
 * drone materials' `envMapRotation` Euler (x = tilt/pitch, y = direction/yaw, z = roll, XYZ order); "intensity x"
 * multiplies the drone's existing environment intensity. Shadow bias "-0.0" is the existing -0.0004 at one decimal.
 */
export const HERO_LIGHT = {
  sun: { intensity: 0, color: "#fffaf2", azimuth: -51, elevation: -8, castShadow: true, bias: -0.0004 },
  hemisphere: { intensity: 1.65, sky: "#cfe3ff", ground: "#8a7f70" },
  environment: { intensity: 0.65, yaw: -27, pitch: 35, roll: 91 },
  post: { grain: 0.06, sharpen: 0 },
} as const;

/** Regular (non-hero) values the preset blends from. */
export const DAYLIGHT = { sunIntensity: 4, grain: 0.25, sharpen: 0.3 } as const;

const DEG = Math.PI / 180;
const az = HERO_LIGHT.sun.azimuth * DEG;
const el = HERO_LIGHT.sun.elevation * DEG;

export const heroLight = {
  /** 1 in the hero section, 0 once the story has moved on. */
  weight: 1,
  sunDirection: new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize(),
  sunColor: new THREE.Color(HERO_LIGHT.sun.color),
  envRotation: new THREE.Euler(
    HERO_LIGHT.environment.pitch * DEG,
    HERO_LIGHT.environment.yaw * DEG,
    HERO_LIGHT.environment.roll * DEG,
  ),
};

/** SWARM_SCENE progress by which the drone is back on the regular daylight. */
const BLEND_END = 0.6;

/** Called once per frame (MainScene, before the drones and post read it). */
export function updateHeroLight() {
  const p = scenes()[SCENE.SWARM_SCENE].progress;
  const t = Math.min(Math.max(p / BLEND_END, 0), 1);
  heroLight.weight = 1 - t * t * (3 - 2 * t);
}
