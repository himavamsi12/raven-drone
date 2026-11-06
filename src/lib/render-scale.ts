import { create } from "zustand";

/**
 * Raven render resolution (user 2026-11-03: "the drone ... should not pixelate in any of the screens").
 *
 * Three densities, all in drawing-buffer pixels per CSS pixel:
 * - canvas: the screen's own density (max 2). The composited frame, grade, wipe and fisheye run here, so the drones are
 *   never stretched by the browser (the old 1.5 cap stretched every frame 1.33x on retina screens).
 * - scene: terrain, sky, clouds, lens and SMAA (PostFX low composer). Adaptive between 1 and the canvas density:
 *   starts at 1.5 (the previous cap) and follows the frame rate (FixedContainer PerformanceMonitor). The whole frame at
 *   native density is not affordable on large retina screens (2560x1440 at 2x measured ~7 fps on an M3).
 * - drones: rendered on their own (PostFX `renderSceneAndDrones`) at the canvas density with MSAA, then
 *   depth-composited over the scene.
 */

/** Canvas density: the screen's own, capped at 2. */
export function canvasDpr() {
  return typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);
}

/** Scene density for a PerformanceMonitor factor (0..1): 1x .. canvas density, in quarter steps (fewer reallocations). */
export function sceneDprFor(factor: number, canvas = canvasDpr()) {
  const min = Math.min(1, canvas);
  const d = min + (canvas - min) * Math.min(Math.max(factor, 0), 1);
  return Math.min(canvas, Math.max(min, Math.round(d * 4) / 4));
}

/** Starting factor: scene density 1.5 (or the canvas density if lower), the cap the scene was tuned at. */
export function initialSceneFactor(canvas = canvasDpr()) {
  return canvas > 1 ? (Math.min(1.5, canvas) - 1) / (canvas - 1) : 1;
}

/**
 * Drone layer MSAA samples: 4 on 1x screens, 2 from 1.5x up (at retina density 2 samples looked the same as 4 and cost
 * less; measured on an M3, 2026-11-03). Supersampling the layer (2x on 1x screens) cost ~15 fps at 1920x1080.
 */
export function droneLayerSamples(canvas = canvasDpr()) {
  // Phones (user 2026-11-06: drone edges pixelate on mobile): the canvas is capped at 2x on 3x screens, so the browser
  // upscales the frame 1.5x and 2 samples left visible steps on the thin arms and legs. The drone layer is cropped to the
  // drone and phone screens are small, so 4 samples are cheap there.
  if (isPhoneScreen()) return 4;
  return canvas < 1.5 ? 4 : 2;
}

/** Phone-sized screen (shorter side under 600 CSS px: portrait and landscape phones, not tablets). */
export function isPhoneScreen() {
  return typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 600;
}

export const useRenderScale = create<{ sceneDpr: number; setSceneDpr: (dpr: number) => void }>((set) => ({
  sceneDpr: typeof window === "undefined" ? 1 : sceneDprFor(initialSceneFactor()),
  setSceneDpr: (dpr) => set((s) => (s.sceneDpr === dpr ? s : { sceneDpr: dpr })),
}));
