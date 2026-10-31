import { create } from "zustand";

/** Scene ids and order, recovered from shipped module 36745. */
export const SCENE = {
  INTRO_SCENE: "intro-scene",
  DELTA_DRONE: "delta-drone",
  SWARM_SCENE: "swarm-scene",
  MISSION_PRESET: "mission-preset",
  FLOCK_SCENE: "flock-scene",
  REAL_TIME_DETECTION: "real-time-detection",
  THERMAL_IRREGULARITY: "thermal-irregularity",
  IGNITION_VERIFIED: "ignition-verified",
  PHALANX_AI: "phalanx-ai",
  ANALYSIS_EVALUATION: "analysis-evaluation",
  INTEGRATED_NOTIFICATIONS: "integrated-notifications",
  INTERDRONE_COORDINATION: "interdrone-coordination",
  EXTRA_SUPPORT: "extra-support",
  ZONE_STABILIZED: "zone-stabilized",
  MULTI_THREAT_RESPONSE: "multi-threat-response",
} as const;

export type SceneId = (typeof SCENE)[keyof typeof SCENE];

/** Configured spans in vh (intro-scene is treated as 1px by the scroll model). */
export const SCENE_SPAN: Record<SceneId, number> = {
  "intro-scene": 100,
  "delta-drone": 500,
  "swarm-scene": 500,
  "mission-preset": 500,
  "flock-scene": 500,
  "real-time-detection": 500,
  "thermal-irregularity": 500,
  "ignition-verified": 500,
  "phalanx-ai": 500,
  "analysis-evaluation": 500,
  "integrated-notifications": 500,
  "interdrone-coordination": 500,
  "extra-support": 500,
  "zone-stabilized": 100,
  "multi-threat-response": 500,
};

export const SCENE_ORDER: SceneId[] = [
  "intro-scene",
  "delta-drone",
  "swarm-scene",
  "mission-preset",
  "flock-scene",
  "real-time-detection",
  "thermal-irregularity",
  "ignition-verified",
  "phalanx-ai",
  "analysis-evaluation",
  "integrated-notifications",
  "interdrone-coordination",
  "extra-support",
  "zone-stabilized",
  "multi-threat-response",
];

export type SceneData = {
  isActive: boolean;
  progress: number;
  showRatio: number;
  hideRatio: number;
};

export type SceneRange = { id: SceneId; start: number; height: number; end: number };

/** Pixel ranges of every scene for a viewport height, in story scroll (Raven: see story-map.ts for page scroll). */
export function computeSceneRanges(vh: number): SceneRange[] {
  let cursor = 0;
  return SCENE_ORDER.map((id) => {
    const start = cursor;
    const height = id === SCENE.INTRO_SCENE ? 1 : (SCENE_SPAN[id] / 100) * vh;
    cursor += height;
    return { id, start, height, end: cursor };
  });
}

/**
 * Per-scene state for a story scroll position (shipped scroll controller 82245). Written into the store on every
 * scroll tick; PostFX also uses it to render the Care teams map off screen for the diagonal wipe.
 */
export function sceneDataAt(scroll: number, ranges: SceneRange[], vh: number): Record<SceneId, SceneData> {
  const out = {} as Record<SceneId, SceneData>;
  for (let i = 0; i < ranges.length; i++) {
    const { id, start, height, end } = ranges[i];
    const showStart = i === 0 ? start - vh : start;
    const progress = (scroll - start) / height;
    const show = (scroll - showStart) / vh;
    const hide = (scroll - end) / vh;
    let isActive = show > 0 && hide <= 1;
    if (id === SCENE.INTRO_SCENE) isActive = hide <= 1;
    out[id] = { progress: clamp01(progress), isActive, showRatio: clamp01(show), hideRatio: clamp01(hide) };
  }
  return out;
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Story scroll offset at the end of a scene (chapter navigation converts it with story-map `toPage`). */
export function sceneEndOffset(id: SceneId, vh: number) {
  return computeSceneRanges(vh)[SCENE_ORDER.indexOf(id)].end;
}

type SceneStore = Record<SceneId, SceneData> & {
  updateSceneData: (id: SceneId, data: SceneData) => void;
};

const blank: SceneData = { isActive: false, progress: 0, showRatio: 0, hideRatio: 0 };

export const useScenes = create<SceneStore>()((set, get) => ({
  ...(Object.fromEntries(SCENE_ORDER.map((id) => [id, { ...blank }])) as Record<
    SceneId,
    SceneData
  >),
  updateSceneData: (id, data) => {
    const prev = get()[id];
    if (
      prev.progress !== data.progress ||
      prev.isActive !== data.isActive ||
      prev.showRatio !== data.showRatio ||
      prev.hideRatio !== data.hideRatio
    ) {
      set({ [id]: data } as Partial<SceneStore>);
    }
  },
}));

/** Read scene state without subscribing; for frame loops. */
export const scenes = () => useScenes.getState();

export const useMouse = create<{ x: number; y: number; updateMouse: (x: number, y: number) => void }>()(
  (set) => ({ x: 0, y: 0, updateMouse: (x, y) => set({ x, y }) }),
);
