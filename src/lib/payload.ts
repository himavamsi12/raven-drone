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

/**
 * Altitude stage (user, 2026-11-03: "how much it fly in altitude wise ... zoom out in the side view ... draw a line from
 * the ground ... 5000m ... show the upcoming terrains which is taller"): the next gesture after the payload frame.
 * Same clay world and vector drone; the camera pulls back to a low side view (taller ridges ahead on the right), and a
 * dimension line rises from the ground under the drone to its skids (overlays/AltitudeCallout.tsx).
 */
export const ALTITUDE_VH = 200;
export const ALTITUDE_TIMELINE = {
  /** Payload callout leaves. */
  payloadExit: 0.02,
  /** Payload box back from yellow to the vector white. */
  highlightOut: [0.02, 0.35],
  /** Camera to the side view (payload-camera.ts applyAltitudeCamera eases its parts inside this). */
  camera: [0.02, 1],
  /** Clay fog opens up so the far ridges ahead show. */
  fog: [0.2, 0.95],
  /** Callout shown from here. */
  callout: 0.9,
} as const;

/** The altitude callout copy (user's figure: "5000m"). */
export const ALTITUDE_COPY = {
  kicker: "Operating altitude",
  value: "5,000 m",
  body: "Raven flies at up to 5,000 m, up to the clinics on the last ridge.",
} as const;

/** Page range of the altitude stage (directly after the payload stage), set by story-map `measureStoryMap`. */
export const altitudeRange = { Q: 0, T: 0 };
/** Altitude progress for a page scroll (0 = payload frame, 1 = side view with the altitude line). */
export const altitudeProgress = (page: number) => (altitudeRange.T > 0 ? clamp01((page - altitudeRange.Q) / altitudeRange.T) : 0);

/**
 * Mountain stage (user, 2026-11-03, final story: payload, then this; the altitude side view is gone): the gesture after
 * the payload frame. The ground under the drone already is the `net` section's terrain of
 * assets/html/raven_homepage (3).html ("Mapped to the last ridge", scene/net-terrain.ts), swept in by the payload
 * stage's clay front; its massif waits behind the drone in the haze. The camera pulls back to that section's view (the
 * haze clears, the drone gets small), then the route line draws from the drone to the top of the massif and the
 * altitude figure (user's "5,000 m") and the one checkpoint (Ridge Clinic) come in. A camera move, nothing grows.
 */
export const ROUTE_VH = 200;
export const ROUTE_TIMELINE = {
  /** Payload callout leaves. */
  payloadExit: 0.02,
  /** Payload box back from yellow to the vector white. */
  highlightOut: [0.02, 0.35],
  /** Camera pull-back to the section view (payload-camera.ts applyRouteCamera eases inside this). */
  camera: [0.02, 1],
  /** Section look (its fog, idle sway, pointer tilt) takes over from the close payload view. */
  section: [0.05, 0.85],
  /** Route line drawing starts here (time-driven, DroneRig ROUTE_PATH.drawS); callout and pin come in with it. */
  path: 0.9,
} as const;

/**
 * Checkpoints (the section's sites; its depot is where the drone hovers): the clinic on top of the main massif, which
 * the drone flies to, and the summit station (user: "add another checkpoint ... how we have showed in the Html").
 */
export const ROUTE_COPY = { destination: "Ridge Clinic", second: "Summit Station" } as const;
/** Flight up the route once the line has drawn (s), and the altitude the counter reaches at the route's top. */
export const ROUTE_FLIGHT = { drawS: 1.6, flyS: 6.5, returnS: 0.8, topM: 5000 } as const;

/**
 * Speed stage (user, 2026-11-03: distance and speed from the first checkpoint to the second; first tried as a drone
 * POV, then "maintain the same camera angle", the path "very simple" and in green): the gesture after the mountain
 * frame. Same section view; the drone flies leg 2 (one smooth arc, green) from the clinic to the summit station while
 * the HUD measures it: distance left (the path's own length, at the section's scale), speed and time.
 */
export const SPEED_VH = 200;
export const SPEED_TIMELINE = {
  /** Mountain callout leaves. */
  routeExit: 0.02,
  /** Stage weight (the view itself does not change). */
  camera: [0.02, 1],
  /** Flight starts (time-driven, SPEED_FLIGHT.flyS) and the HUD comes in. */
  fly: 0.9,
} as const;
/**
 * Figures. Distance: the section's "scene units ~ 50 m". Speed: from the user's own `net` section, whose cards give
 * 11.8 km in 9 min (Ridge Clinic) and 18.4 km in 14 min (Summit Station), both ~79 km/h. Time = distance / speed.
 * The flight on screen is compressed to `flyS`; the HUD shows the real distance and time.
 */
export const SPEED_FIGURES = { metresPerUnit: 50, kmh: 79 } as const;
export const SPEED_FLIGHT = { flyS: 11, returnS: 1, rampShare: 0.12 } as const;
export const SPEED_COPY = { kicker: "Speed and distance", to: "To Summit Station" } as const;
/** Page range of the speed stage (directly after the mountain stage), set by story-map `measureStoryMap`. */
export const speedRange = { Q: 0, T: 0 };
export const speedProgress = (page: number) => (speedRange.T > 0 ? clamp01((page - speedRange.Q) / speedRange.T) : 0);
/** Speed stage on screen, written by DroneRig: leg 2 metres left, current speed (km/h), flight progress, summit pin. */
export const speedScreen = { left: 0, total: 0, kmh: 0, fly: 0, vx: 0, vy: 0, ok: false };

/** Page range of the mountain stage (directly after the payload stage), set by story-map `measureStoryMap`. */
export const routeRange = { Q: 0, T: 0 };
/** Mountain stage progress for a page scroll (0 = payload frame, 1 = section view with the route line). */
export const routeProgress = (page: number) => (routeRange.T > 0 ? clamp01((page - routeRange.Q) / routeRange.T) : 0);

/** Payload progress for a page scroll (0 = hero frame, 1 = payload frame). */
export const payloadProgress = (page: number) => (payloadRange.T > 0 ? clamp01((page - payloadRange.Q) / payloadRange.T) : 0);
/** Payload progress now (root Lenis scrolls the window, so scrollY is the smoothed page scroll). */
export const payloadNow = () => (typeof window === "undefined" ? 0 : payloadProgress(window.scrollY));

/** Eased stage weights for the current scroll (payload stage, then altitude stage; one place for every consumer). */
export function payloadLook(page = typeof window === "undefined" ? 0 : window.scrollY) {
  const t = PAYLOAD_TIMELINE;
  const p = payloadProgress(page);
  const a = altitudeProgress(page);
  const r = routeProgress(page);
  const sp = speedProgress(page);
  const rt = ROUTE_TIMELINE;
  return {
    p,
    a,
    r,
    sky: easeRange(p, t.sky),
    clay: easeRange(p, t.clay),
    zoom: easeRange(p, t.zoom),
    vector: clamp01((p - t.vector[0]) / (t.vector[1] - t.vector[0])), // the sweep shader eases its own front
    highlight: easeRange(p, t.highlight) * (1 - easeRange(r, ROUTE_TIMELINE.highlightOut)),
    /** Altitude stage camera weight (raw progress in its range; the camera eases its parts). */
    side: clamp01((a - ALTITUDE_TIMELINE.camera[0]) / (ALTITUDE_TIMELINE.camera[1] - ALTITUDE_TIMELINE.camera[0])),
    fog: easeRange(a, ALTITUDE_TIMELINE.fog),
    /** Mountain stage camera weight (raw; applyRouteCamera eases it) and the section look's weight. */
    wide: clamp01((r - rt.camera[0]) / (rt.camera[1] - rt.camera[0])),
    section: easeRange(r, rt.section),
    /** Speed stage progress and its camera weight (raw; the chase blend eases it). */
    sp,
    chase: clamp01((sp - SPEED_TIMELINE.camera[0]) / (SPEED_TIMELINE.camera[1] - SPEED_TIMELINE.camera[0])),
  };
}

/** Threshold store for the DOM (hero copy out, callout in); written on every scroll tick (SmoothScroll). */
export const usePayload = create<{ p: number; a: number; r: number; sp: number; setP: (p: number, a: number, r: number, sp: number) => void }>()((set, get) => ({
  p: 0,
  a: 0,
  r: 0,
  sp: 0,
  setP: (p, a, r, sp) => {
    const s = get();
    const moved = (x: number, y: number) => Math.abs(x - y) > 0.002 || ((x === 0 || x === 1) && x !== y);
    if (moved(p, s.p) || moved(a, s.a) || moved(r, s.r) || moved(sp, s.sp)) set({ p, a, r, sp });
  },
}));

/** Payload box on screen (CSS px from the top-left), written by DroneRig every frame for the callout. */
export const payloadScreen = { x: 0, y: 0, ok: false };
/** Altitude line ends on screen (CSS px): ground under the drone (gx, gy) and the drone's skids (dx, dy). */
export const altitudeScreen = { gx: 0, gy: 0, dx: 0, dy: 0, ok: false };
/**
 * Mountain stage on screen (CSS px), written by DroneRig: the two sites (clinic, summit), how far the route lines have
 * drawn (0..1) and the altitude fraction the flying drone has reached (0..1, counter).
 */
export const routeScreen = { vx: 0, vy: 0, v2x: 0, v2y: 0, ok2: false, draw: 0, draw2: 0, alt: 0, ok: false };
