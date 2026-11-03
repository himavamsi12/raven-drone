import * as THREE from "three";
import { create } from "zustand";

/**
 * Raven payload stage (user, 2026-11-03): the page is now hero -> payload only. After the opening move lands on the
 * hero frame, one scroll gesture plays the payload stage over page [Q, Q + T] (story-map `storyMap.Q/T`):
 *   - the live mountain terrain turns into the grey clay model on black, sweeping from the far ridges to the drone
 *     (materials/TerrainMaterial `payloadClay`), sky and clouds fade to black,
 *   - the camera eases in toward the drone and lowers to the payload box (scene/payload-camera.ts),
 *   - the drone turns into its vector form, sweeping top to bottom (Drone.tsx `vectorise`),
 *   - the payload box lights up and the callout "15-25 kg" (user's figure) comes in (overlays/PayloadCallout.tsx).
 * Everything is a pure function of the scroll position, so it plays forward and backward with the scroll.
 */
export const PAYLOAD_VH = 200;
/** Snap duration for the whole stage (hero -> payload frame), whatever the viewport height. */
export const PAYLOAD_MS = 4200;

/** Stage timeline in payload progress (0 = hero frame, 1 = payload frame). */
export const PAYLOAD_TIMELINE = {
  /** Hero copy leaves (it used to leave at DELTA_DRONE .075). */
  heroExit: 0.02,
  /** Sky, clouds and clear colour to black. */
  sky: [0.04, 0.5],
  /** Clay sweep front, far ridges -> under the drone. */
  clay: [0.04, 0.7],
  /** Camera move toward the payload. */
  zoom: [0.04, 1],
  /** Drone to vector form (sweep top -> bottom). */
  vector: [0.3, 0.82],
  /** Payload box highlight. */
  highlight: [0.72, 0.95],
  /** Callout shown from here (enters with its own text motion). */
  callout: 0.9,
  /** Terrain travel speed in the clay view (x hero speed). */
  claySpeed: 0.4,
} as const;

/** The callout copy (user, 2026-11-03: "we can carry upto 15 to 25 kg"). */
export const PAYLOAD_COPY = {
  kicker: "Payload capacity",
  value: "15–25 kg",
  body: "We can carry up to 15–25 kg of medical supplies.",
} as const;

/** Clay look on black (scene/clay-map.ts CLAY, the reference's `net` section colours). */
export const PAYLOAD_BG = new THREE.Color("#0e0e0e");

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** C2 ease (smootherstep) of p over [a, b]. */
export const easeRange = (p: number, [a, b]: readonly [number, number]) => {
  const t = clamp01((p - a) / (b - a));
  return t * t * t * (t * (6 * t - 15) + 10);
};

/** Page range of the stage, set by story-map `measureStoryMap`. */
export const payloadRange = { Q: 0, T: 0 };

/** Payload progress for a page scroll (0 = hero frame, 1 = payload frame). */
export const payloadProgress = (page: number) => (payloadRange.T > 0 ? clamp01((page - payloadRange.Q) / payloadRange.T) : 0);
/** Payload progress now (root Lenis scrolls the window, so scrollY is the smoothed page scroll). */
export const payloadNow = () => (typeof window === "undefined" ? 0 : payloadProgress(window.scrollY));

/** Eased stage weights for a payload progress (one place for every consumer). */
export function payloadLook(p = payloadNow()) {
  const t = PAYLOAD_TIMELINE;
  return {
    p,
    sky: easeRange(p, t.sky),
    clay: easeRange(p, t.clay),
    zoom: easeRange(p, t.zoom),
    vector: clamp01((p - t.vector[0]) / (t.vector[1] - t.vector[0])), // the sweep shader eases its own front
    highlight: easeRange(p, t.highlight),
  };
}

/** Threshold store for the DOM (hero copy out, callout in); written on every scroll tick (SmoothScroll). */
export const usePayload = create<{ p: number; setP: (p: number) => void }>()((set, get) => ({
  p: 0,
  setP: (p) => {
    if (Math.abs(get().p - p) > 0.002 || ((p === 0 || p === 1) && get().p !== p)) set({ p });
  },
}));

/** Payload box on screen (CSS px from the top-left), written by DroneRig every frame for the callout. */
export const payloadScreen = { x: 0, y: 0, ok: false };
