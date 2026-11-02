import { create } from "zustand";

/**
 * Loader state (shipped module 86700). The reference drives a worker-rendered
 * OffscreenCanvas loader (chunk 4867, not captured); this keeps the same state
 * machine and timeout fallbacks but renders the loader in the DOM.
 */
type LoadingStore = {
  loadingCanvasLoaded: boolean;
  loadingCanvasHidden: boolean;
  loadingCanvasIsHiding: boolean;
  mainAppLoaded: boolean;
  imageSequenceLoaded: boolean;
  /**
   * Raven mountain terrain: false while its slices are built (worker), so the loader never reveals the old Raven tiles
   * first (user 2026-11-03: "the old terrain is coming and can be seen, then the tundra terrain"). True otherwise.
   */
  terrainReady: boolean;
  degraded: boolean;
  setCanRemoveLoading: () => void;
  setMainAppLoaded: (v: boolean) => void;
  setImageSequenceLoaded: (v: boolean) => void;
};

export const useLoading = create<LoadingStore>()((set) => ({
  loadingCanvasLoaded: false,
  loadingCanvasHidden: false,
  loadingCanvasIsHiding: false,
  mainAppLoaded: false,
  imageSequenceLoaded: false,
  terrainReady: true,
  degraded: false,
  setCanRemoveLoading: () => set({ loadingCanvasIsHiding: true }),
  setMainAppLoaded: (v) => set({ mainAppLoaded: v }),
  setImageSequenceLoaded: (v) => set({ imageSequenceLoaded: v }),
}));
