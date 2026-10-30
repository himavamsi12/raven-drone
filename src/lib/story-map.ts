import { create } from "zustand";
import { computeSceneRanges, SCENE, SCENE_ORDER, type SceneId, type SceneRange } from "./scenes";

/**
 * Raven homepage: the shipped scroll story is split into two page bands with regular sections between them.
 *   band 1: intro → real-time-detection (Route)       page [0, E1]           story [0, E1]
 *   gap:    #parts (scroll-driven horizontal track)     page (E1 + vh, X)      story held
 *   band 2: end of phalanx-ai (Care teams frame) → multi-threat    page [X, X + L2]    story [S2, S2 + L2]
 * Skipped while the stage is off screen: thermal, ignition (fire) and the phalanx satellite/city transition. Band 2
 * opens on the finished "Keep the care team informed" map (user choice, 2026-10-30): story jumps E1 ↔ S2 = end of
 * phalanx-ai. Scene ranges, progress and every component keep working in story coordinates; only the scroll ↔ story
 * conversion knows about the bands.
 */
export const BAND_1_END: SceneId = SCENE.REAL_TIME_DETECTION;
/** Band 2 starts at the END of this scene (its last frame is the opening frame). */
export const BAND_2_OPEN: SceneId = SCENE.PHALANX_AI;
export const BAND_1 = SCENE_ORDER.slice(0, SCENE_ORDER.indexOf(BAND_1_END) + 1);
export const BAND_2 = SCENE_ORDER.slice(SCENE_ORDER.indexOf(BAND_2_OPEN) + 1);
/** Spacer heights in vh: story span + one screen for the stage to scroll away (matches page.tsx). */
export const BAND_1_VH = 2600; // 1px intro + 5 × 500 + 100
export const BAND_2_VH = 2700; // 5 × 500 + 100 (zone) + 100

export const storyMap = { vh: 0, E1: 0, S2: 0, L2: 0, X: 0 };

/** Re-measure from the layout (band 2 spacer position depends on the sections above it). */
export function measureStoryMap() {
  const vh = window.innerHeight;
  const ranges = computeSceneRanges(vh);
  const end = (id: SceneId) => ranges[SCENE_ORDER.indexOf(id)].end;
  storyMap.vh = vh;
  storyMap.E1 = end(BAND_1_END);
  storyMap.S2 = end(BAND_2_OPEN);
  storyMap.L2 = ranges[ranges.length - 1].end - storyMap.S2;
  const band2 = document.getElementById("story-band-2");
  storyMap.X = band2 ? band2.getBoundingClientRect().top + window.scrollY : storyMap.E1 + vh;
  return ranges;
}

/** Page scroll → story scroll. In the gap the story holds at the band edge nearest the stage that is on screen. */
export function toStory(page: number) {
  const { vh, E1, S2, X } = storyMap;
  if (page <= E1) return page;
  if (page < X - vh) return E1;
  if (page < X) return S2;
  return S2 + (page - X);
}

/** Story scroll → page scroll (skipped scenes clamp to the nearest band edge). */
export function toPage(story: number) {
  const { E1, S2, X } = storyMap;
  if (story <= E1) return story;
  if (story < S2) return story - E1 < S2 - story ? E1 : X;
  return X + (story - S2);
}

/**
 * Stage offset for the fixed story stage: it scrolls away after each band like the shipped sticky stage, and slides
 * back in from below before band 2. Returns the stage top in px (0 = covering the viewport) or null when off screen.
 */
export function stageTop(page: number): number | null {
  const { vh, E1, X, L2 } = storyMap;
  if (page <= E1) return 0;
  if (page < E1 + vh) return -(page - E1);
  if (page <= X - vh) return null;
  if (page < X) return X - page;
  if (page <= X + L2) return 0;
  if (page < X + L2 + vh) return -(page - X - L2);
  return null;
}

/** Story scene ranges grouped into page-space bands (for chapter snapping). */
export function pageBands(ranges: SceneRange[]) {
  const map = (r: SceneRange) => ({ ...r, start: toPage(r.start), end: toPage(r.end) });
  const pick = (ids: SceneId[]) => ranges.filter((r) => ids.includes(r.id)).map(map);
  return [pick(BAND_1), pick(BAND_2)];
}

/** Share of the viewport the story stage covers (0 between bands); written on scroll by FixedContainer. */
export const useStage = create<{ cover: number; setCover: (v: number) => void }>()((set, get) => ({
  cover: 1,
  setCover: (v) => {
    if (Math.abs(get().cover - v) > 0.004 || (v === 0) !== (get().cover === 0)) set({ cover: v });
  },
}));
