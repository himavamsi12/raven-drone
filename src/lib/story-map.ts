import { create } from "zustand";
import { easeInOutCubic } from "./math";
import { computeSceneRanges, SCENE, SCENE_ORDER, type SceneId, type SceneRange } from "./scenes";

/**
 * Raven homepage: the shipped scroll story runs as two page bands joined by the shipped diagonal Phalanx wipe.
 *   opening: live 3D camera move (scene/opening.ts)    page [0, P]            story held at 0
 *   band 1: intro → real-time-detection (Route)       page [P, P + E1]       story [0, E1]
 *   wipe:   first half of phalanx-ai's page range      page [X, X + W]        story held at E1 (Route stays live)
 *   band 2: phalanx-ai .5 → multi-threat               page [X + W, X + L2]   story S2 + (page - X), X = P + E1
 * Skipped: thermal and ignition (fire). User, 2026-11-01: the #parts section between the bands was removed and the
 * shipped diagonal transition joins Route to the Care teams map, with the terrain and drone still moving under it.
 * Through the wipe the story holds on Route; PostFX lays the Care teams map (phalanx .5, rendered once off screen: it is
 * static in the shipped scene) over the swept side, `ratio = wipeRatio`. At X + W the story switches to that same map
 * frame. Scene ranges, progress and every component keep working in story coordinates; only the scroll ↔ story
 * conversion knows about the bands.
 *
 * Journey (flock-scene) removed (user, 2026-11-02): its network map is never shown and its story range plays on only
 * JOURNEY_PAGE_SHARE of its page length, as part of the Route snap range, so one gesture flies Prepare -> Route in a
 * single continuous camera move (no cut, no stop). Band 1 page length = story length - (1 - share) x Journey.
 */
export const JOURNEY_PAGE_SHARE = 0.3;
export const BAND_1_END: SceneId = SCENE.REAL_TIME_DETECTION;
/** Band 2 starts at the END of this scene (ignition-verified ends where phalanx-ai, the diagonal wipe, begins). */
export const BAND_2_OPEN: SceneId = SCENE.IGNITION_VERIFIED;
export const BAND_1 = SCENE_ORDER.slice(0, SCENE_ORDER.indexOf(BAND_1_END) + 1);
export const BAND_2 = SCENE_ORDER.slice(SCENE_ORDER.indexOf(BAND_2_OPEN) + 1);
/** Spacer heights in vh (match page.tsx). Band 1 hands straight to band 2, so only band 2 adds a screen to scroll away. */
export const BAND_1_VH = 2500 - (1 - JOURNEY_PAGE_SHARE) * 500; // 1px intro + 5 × 500, Journey at 30% (= 2150, page.tsx)
export const BAND_2_VH = 3200; // phalanx 500 + 5 × 500 + 100 (zone) + 100
/**
 * Raven opening (user, 2026-11-01): page [0, P] flies the live camera from a low wide-angle shot under the hovering
 * drone up into the hero frame (story 0, scene/opening.ts), then band 1 starts at P. Matches the `#opening` spacer in
 * page.tsx.
 */
export const OPENING_VH = 300;

export const storyMap = { vh: 0, P: 0, E1: 0, S2: 0, L2: 0, X: 0, W: 0, F0: 0, F1: 0, preroll: false };

/** Band 1 story offset -> page offset (Journey compressed to JOURNEY_PAGE_SHARE). */
function band1Page(story: number) {
  const { F0, F1 } = storyMap;
  if (story <= F0) return story;
  if (story <= F1) return F0 + (story - F0) * JOURNEY_PAGE_SHARE;
  return story - (F1 - F0) * (1 - JOURNEY_PAGE_SHARE);
}
/** Band 1 page offset -> story offset (inverse of band1Page). */
function band1Story(page: number) {
  const { F0, F1 } = storyMap;
  const f1Page = F0 + (F1 - F0) * JOURNEY_PAGE_SHARE;
  if (page <= F0) return page;
  if (page <= f1Page) return F0 + (page - F0) / JOURNEY_PAGE_SHARE;
  return page + (F1 - F0) * (1 - JOURNEY_PAGE_SHARE);
}
/** Page length of band 1. */
const band1Length = () => band1Page(storyMap.E1);

/** Re-measure from the layout (band 2 spacer position depends on the sections above it). */
export function measureStoryMap() {
  const vh = window.innerHeight;
  const ranges = computeSceneRanges(vh);
  const end = (id: SceneId) => ranges[SCENE_ORDER.indexOf(id)].end;
  storyMap.vh = vh;
  const band1 = document.getElementById("story-band-1");
  storyMap.P = band1 ? band1.getBoundingClientRect().top + window.scrollY : (OPENING_VH / 100) * vh;
  storyMap.E1 = end(BAND_1_END);
  storyMap.F1 = end(SCENE.FLOCK_SCENE);
  storyMap.F0 = ranges[SCENE_ORDER.indexOf(SCENE.FLOCK_SCENE)].start;
  storyMap.S2 = end(BAND_2_OPEN);
  storyMap.L2 = ranges[ranges.length - 1].end - storyMap.S2;
  storyMap.W = 0.5 * ranges[SCENE_ORDER.indexOf(SCENE.PHALANX_AI)].height; // shipped wipe = phalanx-ai 0 → .5
  const band2 = document.getElementById("story-band-2");
  storyMap.X = band2 ? band2.getBoundingClientRect().top + window.scrollY : storyMap.P + band1Length();
  return ranges;
}

/** Page scroll → story scroll. Route holds through the wipe [X, X + W); then the story continues at phalanx .5. */
export function toStory(page: number) {
  const { P, E1, S2, X, W } = storyMap;
  if (page <= P) return 0;
  if (page <= P + band1Length()) return band1Story(page - P);
  if (page < X + W) return E1;
  return S2 + (page - X);
}

/** Story position the wipe lands on (phalanx-ai .5: map fully swept, outline not drawn yet). */
export const mapStory = () => storyMap.S2 + storyMap.W;

/** Story scroll → page scroll (skipped scenes clamp to the nearest band edge). */
export function toPage(story: number) {
  const { P, E1, S2, X } = storyMap;
  if (story <= E1) return P + band1Page(story);
  if (story < S2) return story - E1 < S2 - story ? P + band1Length() : X;
  return X + (story - S2);
}

/**
 * Stage offset for the fixed story stage: it covers the viewport through both bands (joined by the diagonal wipe) and
 * scrolls away after band 2 like the shipped sticky stage. Returns the stage top in px (0 = covering) or null when off
 * screen.
 */
export function stageTop(page: number): number | null {
  const { vh, X, L2 } = storyMap;
  if (page <= X + L2) return 0;
  if (page < X + L2 + vh) return -(page - X - L2);
  return null;
}

/** Story scene ranges in page space (for chapter snapping): one band from the opening to the end of the story. */
export function pageBands(ranges: SceneRange[]) {
  const map = (r: SceneRange) => ({ ...r, start: toPage(r.start), end: toPage(r.end) });
  const pick = (ids: SceneId[]) => ranges.filter((r) => ids.includes(r.id)).map(map);
  // Band 1 opens with the opening move (page 0 → end of the 1px intro), so one gesture plays the whole move.
  const intro = map(ranges[SCENE_ORDER.indexOf(SCENE.INTRO_SCENE)]);
  const opening: SceneRange = { ...intro, start: 0, height: intro.end, end: intro.end };
  // Journey is not a stop: Route's range starts where Journey starts, so one gesture from Prepare plays both.
  const band1 = pick(BAND_1).filter((r) => r.id !== SCENE.INTRO_SCENE && r.id !== SCENE.FLOCK_SCENE);
  const route = band1.find((r) => r.id === SCENE.REAL_TIME_DETECTION);
  const journey = ranges[SCENE_ORDER.indexOf(SCENE.FLOCK_SCENE)];
  if (route) {
    route.start = toPage(journey.start);
    route.height = route.end - route.start;
  }
  // The wipe (phalanx-ai) is band 2's first range, so one gesture from Route plays the whole transition.
  return [[opening, ...band1, ...pick(BAND_2)]];
}

/** Diagonal wipe progress for a page scroll (0 = Route, 1 = Care teams map fully swept). */
export const wipeProgress = (page: number) => (storyMap.W > 0 ? Math.min(Math.max((page - storyMap.X) / storyMap.W, 0), 1) : 0);
/**
 * Swept share of the frame (shipped terrain/grid/fire `hideRatio = remapEased(phalanx, 0, .5, 0, 1, easeInOutCubic)`;
 * phalanx .5 is exactly W of page, so the same curve over the wipe progress).
 */
export const wipeRatioAt = (page: number) => easeInOutCubic(wipeProgress(page));
/** Swept share now (root Lenis scrolls the window, so scrollY is the smoothed page scroll). */
export const wipeNow = () => (typeof window === "undefined" ? 0 : wipeRatioAt(window.scrollY));
/**
 * Shipped `computeScreenUv` x for a screen point (u, v in 0..1, v up): (uv - .5) / √2 + .5 rotated 225° about the centre
 * reduces to .5 + (v - u) / 2. A point is swept when this is below the ratio.
 */
export const wipeX = (u: number, v: number) => 0.5 + (v - u) / 2;
/** CSS clip-path keeping the unswept part of a full-viewport layer (u + y ≤ 2 - 2·ratio, y down). */
export function wipeClipPath(ratio: number) {
  const c = 2 - 2 * ratio;
  if (c >= 2) return "none";
  const pc = (v: number) => `${(v * 100).toFixed(3)}%`;
  return c >= 1
    ? `polygon(0 0, 100% 0, 100% ${pc(c - 1)}, ${pc(c - 1)} 100%, 0 100%)`
    : `polygon(0 0, ${pc(c)} 0, 0 ${pc(c)})`;
}

/** Opening progress for a page scroll (0 = low wide shot, 1 = hero frame). */
export const openingProgress = (page: number) => (storyMap.P > 0 ? Math.min(Math.max(page / storyMap.P, 0), 1) : 1);
/** Opening progress now (root Lenis scrolls the window, so scrollY is the smoothed page scroll). */
export const openingNow = () => (typeof window === "undefined" ? 0 : storyMap.preroll ? 1 : openingProgress(window.scrollY));

/** Share of the viewport the story stage covers (0 after the story); written on scroll by FixedContainer. */
export const useStage = create<{ cover: number; setCover: (v: number) => void }>()((set, get) => ({
  cover: 1,
  setCover: (v) => {
    if (Math.abs(get().cover - v) > 0.004 || (v === 0) !== (get().cover === 0)) set({ cover: v });
  },
}));
