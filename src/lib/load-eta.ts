import { ASSETS, DRACO_PATH } from "@/lib/assets";

/**
 * Loader ETA (user 2026-11-09: "show how long it will take to load the site, not the complete site"): seconds until
 * the reveal, i.e. the first frame, NOT until every full-quality map has arrived.
 *
 * The reveal waits on (measured, cold load, 2026-11-09):
 *   1. the scene's JS (three.js, R3F, the scene; ~330 KB compressed on a production build, requested after
 *      hydration as FixedContainer's dynamic import) and the first-frame files below (~1.1 MB over the wire): drone +
 *      terrain previews, env map, Draco, camera/drone clips, noise textures;
 *   2. the mountain build in its worker + material compile behind the loader (~1.5-2 s on an M-series Mac);
 *   3. on fast links only, up to FULL_MAP_WAIT_MS (Terrain.tsx, 0.8 s) for the full-quality maps.
 * The estimate is (first-frame bytes still missing) / (link speed measured from what has downloaded so far) + 2 + 3.
 * Sizes are the compressed (encodedBodySize) bytes measured on a cold load; re-measure if those assets are rebuilt.
 * `npm run dev` ships ~10 MB of unminified JS, so the figure is only meaningful on a production build.
 */
const FIRST_FRAME_BYTES: Record<string, number> = {
  [ASSETS.raven]: 446344,
  [ASSETS.ravenTerrain]: 203241,
  [ASSETS.env]: 148909,
  [`${DRACO_PATH}draco_wasm_wrapper.js`]: 11748,
  [`${DRACO_PATH}draco_decoder.wasm`]: 63458,
  [ASSETS.cameraAnimations]: 14354,
  [ASSETS.cameraAnimationsMobile]: 9705,
  [ASSETS.droneAnimations]: 8099,
  [ASSETS.droneAnimationsMobile]: 7992,
  [ASSETS.droneLowpoly]: 12693,
  [ASSETS.blueNoise]: 48759,
  [ASSETS.noise]: 109434,
};
/** Scene JS chunks loaded after hydration (production build, compressed, 2026-11-09). */
const SCENE_JS_BYTES = 340e3;
let sceneCode = false;
/** FixedContainer's module has run: every scene chunk is in. */
export function markSceneCodeLoaded() {
  sceneCode = true;
}
/**
 * Mountain build + shader compile after the files are in (s). Measured 2.0-5.8 s on an M-series Mac (cold, production
 * build): the build shares the CPU with the full-quality map decodes, so this is the typical case, not a bound.
 */
const PREPARE_S = 2;
/** While preparing, the figure never drops below this (s): past the estimate it holds at "~1 s", not "<1 s". */
const PREPARE_FLOOR_S = 1;
/** Fast links: the reveal waits up to this long for the full-quality maps (Terrain.tsx FULL_MAP_WAIT_MS). */
const FULL_MAP_WAIT_S = 0.8;
/** Terrain.tsx SLOW_PAGE_MS: past this the reveal no longer waits for the full-quality maps. */
const SLOW_PAGE_MS = 8000;
/** Link speed assumed before anything has finished downloading (bytes/s, ~4G). */
const DEFAULT_RATE = 1.5e6;

export type LoadPhase = "loading" | "preparing";

/**
 * Seconds left until the reveal, from the resource timings so far. `preparingSince` is the page time at which the
 * scene's first frame was up (files done), or null while still loading.
 */
export function estimateRevealSeconds(preparingSince: number | null): number | null {
  if (typeof performance === "undefined" || !performance.getEntriesByType) return null;
  const now = performance.now();
  const hdWait = now < SLOW_PAGE_MS ? FULL_MAP_WAIT_S : 0;
  if (preparingSince !== null) return Math.max(PREPARE_FLOOR_S, PREPARE_S + hdWait - (now - preparingSince) / 1000);

  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  let bytes = 0;
  let start = Infinity;
  let end = 0;
  const done = new Set<string>();
  for (const e of entries) {
    const size = e.encodedBodySize || e.transferSize;
    // Cached responses (size 0 or ~instant) say nothing about the link.
    if (size > 2048 && e.responseEnd - e.requestStart > 5) {
      bytes += size;
      start = Math.min(start, e.requestStart);
      end = Math.max(end, e.responseEnd);
    }
    let path = e.name;
    try {
      path = new URL(e.name).pathname;
    } catch {}
    if (path in FIRST_FRAME_BYTES) done.add(path);
  }
  // Links of ~4G and faster fill several requests at once; the summed span is the honest throughput.
  const rate = bytes > 64 * 1024 && end > start ? Math.max(bytes / ((end - start) / 1000), 50e3) : DEFAULT_RATE;
  let missing = sceneCode ? 0 : SCENE_JS_BYTES;
  for (const [path, size] of Object.entries(FIRST_FRAME_BYTES)) if (!done.has(path)) missing += size;
  return missing / rate + PREPARE_S + hdWait;
}

/** "~7 s", "~1 min" etc.; null hides the ETA. */
export function formatEta(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  if (seconds < 1.5) return "~1 s";
  if (seconds < 60) return `~${Math.ceil(seconds)} s`;
  return `~${Math.round(seconds / 60)} min`;
}
