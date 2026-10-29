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
  degraded: false,
  setCanRemoveLoading: () => set({ loadingCanvasIsHiding: true }),
  setMainAppLoaded: (v) => set({ mainAppLoaded: v }),
  setImageSequenceLoaded: (v) => set({ imageSequenceLoaded: v }),
}));
