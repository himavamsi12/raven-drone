"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { computeSceneRanges, SCENE, SCENE_ORDER, SCENE_SPAN, useScenes, type SceneId, type SceneRange } from "@/lib/scenes";
import { clamp, linear } from "@/lib/math";
import { useLoading } from "@/lib/loading";
import { isScrollLocked, LOCK_EVENT } from "@/lib/scroll-lock";
import { useMediaQuery } from "@/lib/use-media-query";

/** Returns a callback that scrolls to the end of `id` over 3s (shipped `w`). */
export function useScrollToScene(id: SceneId) {
  const lenis = useLenis();
  return () => {
    const vh = window.innerHeight;
    const target = SCENE_ORDER.slice(0, SCENE_ORDER.indexOf(id) + 1).reduce(
      (acc, s) => acc + (s === SCENE.INTRO_SCENE ? 1 : (SCENE_SPAN[s] / 100) * vh),
      0,
    );
    lenis?.scrollTo(target, { duration: 3, easing: linear });
  };
}

const findRangeIndex = (scroll: number, ranges: SceneRange[]) => {
  for (let i = 0; i < ranges.length; i++) if (scroll < ranges[i].end) return i;
  return ranges.length - 1;
};

/** Writes per-scene progress into the store on every Lenis scroll tick. */
function useSceneProgressDriver() {
  const lenis = useLenis();
  const ranges = useRef<SceneRange[]>([]);
  const vhRef = useRef(0);

  useEffect(() => {
    if (!lenis) return;
    const measure = () => {
      vhRef.current = window.innerHeight;
      ranges.current = computeSceneRanges(window.innerHeight);
    };
    const update = ({ scroll }: { scroll: number }) => {
      if (isScrollLocked()) return;
      const list = ranges.current;
      const vh = vhRef.current || window.innerHeight;
      const { updateSceneData } = useScenes.getState();
      for (let i = 0; i < list.length; i++) {
        const { id, start, height, end } = list[i];
        const showStart = i === 0 ? start - vh : start;
        const progress = (scroll - start) / height;
        const show = (scroll - showStart) / vh;
        const hide = (scroll - end) / vh;
        let isActive = show > 0 && hide <= 1;
        if (id === SCENE.INTRO_SCENE) isActive = hide <= 1;
        updateSceneData(id, {
          progress: clamp(progress, 0, 1),
          isActive,
          showRatio: clamp(show, 0, 1),
          hideRatio: clamp(hide, 0, 1),
        });
      }
    };
    const current = () => ({ scroll: lenis.actualScroll || lenis.scroll || 0 });
    measure();
    update(current());
    lenis.on("scroll", update);
    const onResize = () => {
      measure();
      update(current());
    };
    const onLock = (e: Event) => {
      if (!(e as CustomEvent).detail?.locked) update(current());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener(LOCK_EVENT, onLock);
    return () => {
      window.removeEventListener(LOCK_EVENT, onLock);
      window.removeEventListener("resize", onResize);
      lenis.off("scroll", update);
    };
  }, [lenis]);
}

/**
 * Chapter snapping (shipped `f` in module 82245): wheel/keys/touch pick the
 * next or previous scene end, then a RAF loop steps toward it at 2px/ms while
 * Lenis velocity is low.
 */
function SceneController() {
  const lenis = useLenis();
  const loadingHidden = useLoading((s) => s.loadingCanvasHidden);
  const isTouchPhone = useMediaQuery("(max-width: 768px) and (pointer: coarse)");

  const scrollbarDrag = useRef(false);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const sb = window.innerWidth - document.documentElement.clientWidth;
      if (sb > 0 && e.clientX >= window.innerWidth - sb) scrollbarDrag.current = true;
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  useSceneProgressDriver();

  const ranges = useRef<SceneRange[]>([]);
  const totalRef = useRef(0);
  const target = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  const touching = useRef(false);
  const navTouch = useRef(false);
  const pendingDir = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const measure = () => {
      ranges.current = computeSceneRanges(window.innerHeight);
      totalRef.current = ranges.current[ranges.current.length - 1]?.end ?? 0;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const pickTarget = useCallback(
    (dir: number) => {
      if (!lenis) return;
      const list = ranges.current;
      const total = totalRef.current;
      const scroll = lenis.scroll;
      if (scroll >= total) {
        target.current = null;
        return;
      }
      const i = findRangeIndex(scroll, list);
      const { start, height, end } = list[i];
      const p = (scroll - start) / height;
      const last = i === list.length - 1;
      if (dir > 0) {
        target.current = p < 0.99 ? end : last ? null : list[i + 1].end;
      } else {
        const prev = i - 1;
        if (prev >= 0) {
          const prevEnd = list[prev].end;
          if (Math.abs(prevEnd - scroll) < 1 && prev > 0) target.current = list[prev - 1].end;
          else if (Math.abs(prevEnd - scroll) < 1) target.current = 0;
          else target.current = prevEnd;
        } else target.current = 0;
      }
    },
    [lenis],
  );

  const request = useCallback(
    (dir: number) => {
      if (isTouchPhone) pendingDir.current = dir;
      else pickTarget(dir);
    },
    [isTouchPhone, pickTarget],
  );

  const run = useCallback(() => {
    if (raf.current !== null || !lenis) return;
    const step = (ts: number) => {
      if (isScrollLocked()) {
        touching.current = false;
        raf.current = null;
        lastTs.current = null;
        return;
      }
      const dt = Math.min(lastTs.current ? ts - lastTs.current : 16, 100);
      lastTs.current = ts;
      const vel = Math.abs(lenis.velocity);
      if (isTouchPhone && !touching.current && pendingDir.current !== null && vel < 2 * dt) {
        pickTarget(pendingDir.current);
        pendingDir.current = null;
      }
      const t = target.current;
      const scroll = lenis.scroll;
      if (t !== null) {
        const delta = t - scroll;
        if (Math.abs(delta) <= 0.05) target.current = null;
        else if (vel < 2 * dt && !scrollbarDrag.current && (!isTouchPhone || !touching.current)) {
          const sign = delta > 0 ? 1 : -1;
          const stepPx = 2 * sign * dt;
          const next = sign > 0 ? Math.min(scroll + stepPx, t) : Math.max(scroll + stepPx, t);
          lenis.scrollTo(next, { immediate: true });
        }
      }
      if (target.current !== null || pendingDir.current !== null) raf.current = requestAnimationFrame(step);
      else {
        raf.current = null;
        lastTs.current = null;
      }
    };
    raf.current = requestAnimationFrame(step);
  }, [lenis, isTouchPhone, pickTarget]);

  useEffect(() => {
    if (!lenis) return;
    const ready = () => useLoading.getState().loadingCanvasHidden && !isScrollLocked();
    const onWheel = (e: WheelEvent) => {
      if (!ready()) return;
      request(e.deltaY > 0 ? 1 : -1);
      run();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!ready()) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        request(e.key === "ArrowDown" ? 1 : -1);
        run();
      }
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (!ready()) return;
      if (e.target instanceof Element && e.target.closest('[data-nav-touch="1"]')) {
        navTouch.current = true;
        return;
      }
      navTouch.current = false;
      touchY = e.touches[0].clientY;
      touching.current = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!ready() || navTouch.current) return;
      request(touchY - e.touches[0].clientY > 0 ? 1 : -1);
    };
    const onTouchEnd = () => {
      if (isScrollLocked()) return;
      if (navTouch.current) {
        navTouch.current = false;
        return;
      }
      touching.current = false;
      if (useLoading.getState().loadingCanvasHidden) run();
    };
    const onMouseUp = () => {
      if (!scrollbarDrag.current) return;
      scrollbarDrag.current = false;
      if (!ready()) return;
      const s = lenis.scroll;
      if (s < totalRef.current) {
        target.current = ranges.current[findRangeIndex(s, ranges.current)].end;
        run();
      }
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("mouseup", onMouseUp);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [lenis, request, run]);

  useEffect(() => {
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = prev;
    };
  }, []);

  // Lock scrolling until the loader is gone, always start at the top.
  useEffect(() => {
    if (!lenis) return;
    target.current = null;
    pendingDir.current = null;
    if (loadingHidden) lenis.start();
    else lenis.stop();
    lenis.scrollTo(0, { immediate: true, force: true });
  }, [lenis, loadingHidden]);

  // On reveal, advance into the first chapter automatically (shipped behavior).
  useEffect(() => {
    if (lenis && loadingHidden) {
      pickTarget(1);
      run();
    }
  }, [lenis, loadingHidden, pickTarget, run]);

  // After a modal/menu unlocks, settle on the nearest scene end.
  useEffect(() => {
    if (!lenis) return;
    const onLock = (e: Event) => {
      if ((e as CustomEvent).detail?.locked || !useLoading.getState().loadingCanvasHidden || isScrollLocked()) return;
      const list = ranges.current;
      if (!list.length) return;
      const s = lenis.scroll;
      if (s >= totalRef.current || s <= 1 || list.some((r) => Math.abs(r.end - s) <= 1)) return;
      if (target.current === null && pendingDir.current === null) target.current = list[findRangeIndex(s, list)].end;
      run();
    };
    window.addEventListener(LOCK_EVENT, onLock);
    return () => window.removeEventListener(LOCK_EVENT, onLock);
  }, [lenis, run]);

  return null;
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis root options={{ lerp: 0.95, syncTouch: true }}>
      <SceneController />
      {children}
    </ReactLenis>
  );
}
