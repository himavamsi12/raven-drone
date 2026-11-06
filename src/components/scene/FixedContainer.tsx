"use client";

import { KeyboardControls, PerformanceMonitor, type KeyboardControlsEntry } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useLenis } from "lenis/react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLoading } from "@/lib/loading";
import { payloadRange, speedRange } from "@/lib/payload";
import { canvasDpr, initialSceneFactor, sceneDprFor, useRenderScale } from "@/lib/render-scale";
import { remap } from "@/lib/math";
import { SCENE, useMouse, useScenes } from "@/lib/scenes";
import { measureStoryMap, stageTop, storyMap, useStage, wipeClipPath, wipeProgress, wipeRatioAt } from "@/lib/story-map";
import { ChapterCopy } from "./ChapterCopy";
import { HudLog } from "./HudLog";
import { MainScene } from "./MainScene";
import { sharedMountainSlices, mountainTerrainEnabled } from "./mountain-terrain";
import { terrainVariant } from "./raven-terrain";
import { useGLB } from "./types";
import { ASSETS } from "@/lib/assets";

const KEYS: KeyboardControlsEntry<string>[] = [
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  // Shipped "hold Shift to boost" (terrain travel x6) is off (user 2026-11-05: pressing Shift raced the background):
  // the name stays so the scene's `getKeys().shift` reads keep compiling, it is just never pressed.
  { name: "shift", keys: [] },
];

/**
 * Render resolution (user 2026-11-03: "no pixelation should happen with the drone"; again: still pixelated on larger
 * screens). See lib/render-scale.ts: the canvas runs at the screen's own density (max 2) and the drones are rendered
 * on their own at 2x with MSAA (PostFX); only the scene behind them (terrain, sky, lens) adapts to the GPU, between 1x
 * and native, starting at 1.5. Settles after 3 flip-flops on the lower of the last two levels.
 * Replaces drei AdaptiveDpr, whose `pixelated` mode upscaled with hard nearest-neighbour pixels.
 */
function useSceneResolution() {
  const [canvas] = useState(canvasDpr);
  const [factor] = useState(() => initialSceneFactor(canvas));
  const setSceneDpr = useRenderScale((s) => s.setSceneDpr);
  const lastStep = useRef(0);
  const declined = useRef(false);
  const pending = useRef<number | null>(null);
  // User 2026-11-05 ("the mountain is jumping"): a density change re-renders the whole scene sharper or softer, which
  // reads as a jump. Changes wait while the mountain views are on screen (payload frame -> Summit Station) and apply
  // on leaving them; after a first step down the density no longer climbs back up (no up/down pops).
  const apply = useCallback(
    (dpr: number) => {
      const y = window.scrollY;
      const a = payloadRange.Q + payloadRange.T;
      const b = speedRange.Q + speedRange.T;
      if (payloadRange.T > 0 && speedRange.T > 0 && y >= a - 2 && y <= b + 2) {
        pending.current = dpr;
        return;
      }
      pending.current = null;
      setSceneDpr(dpr);
    },
    [setSceneDpr],
  );
  useEffect(() => {
    const onScroll = () => {
      if (pending.current !== null) apply(pending.current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [apply]);
  const set = (dpr: number) => {
    const cur = useRenderScale.getState().sceneDpr;
    if (dpr < cur) declined.current = true;
    else if (dpr > cur && declined.current) return;
    apply(dpr);
  };
  return {
    canvas,
    factor,
    onIncline: () => void (lastStep.current = 1),
    onDecline: () => void (lastStep.current = -1),
    onChange: ({ factor: f }: { factor: number }) => set(sceneDprFor(f, canvas)),
    // A flip-flop ending on a climb leaves the level that just failed: step back down to the one that held.
    onFallback: ({ factor: f }: { factor: number }) => set(sceneDprFor(lastStep.current > 0 ? f - 0.1 : f, canvas)),
  };
}

/**
 * Load time (2026-11-05): starts the mountain terrain build (worker) as soon as the small Raven tile GLB is in, in its
 * own Suspense boundary, so it runs while the drone and the rest of the first frame are still downloading.
 */
function MountainPrebuild() {
  const raven = useGLB(ASSETS.ravenTerrain);
  useEffect(() => {
    if (terrainVariant() !== "raven" || !mountainTerrainEnabled()) return;
    const land = raven.nodes["Land-A"] as THREE.Mesh;
    const houses = raven.nodes.Houses as THREE.Mesh;
    sharedMountainSlices(land.geometry, houses.geometry).catch(() => {}); // Terrain reports failures
  }, [raven]);
  return null;
}

/** WebGL canvas shown once the loader has the boot splash up (shipped `t8`). */
function SceneCanvas() {
  const loaded = useLoading((s) => s.loadingCanvasLoaded);
  const scale = useSceneResolution();
  const hiding = useLoading((s) => s.loadingCanvasIsHiding);
  if (!loaded) return null;
  return (
    // Shown: inherit the stage's visibility (not `visible`, which overrode the hidden stage after the story, so the
    // canvas kept showing its last frame behind the sections; the shipped story ended on black, Raven's on the landscape).
    <div className={hiding ? "absolute inset-0 touch-auto!" : "invisible absolute inset-0 touch-auto!"}>
      <Canvas
        camera={{ position: [0, 5, 0], fov: 60 }}
        dpr={scale.canvas}
        shadows="soft" // drone self-shadowing only (sun shadow camera is fitted to the hero drone in MainScene)
        gl={{ powerPreference: "high-performance", antialias: false, stencil: false, depth: false, outputColorSpace: THREE.SRGBColorSpace }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 1)}
      >
        <PerformanceMonitor
          flipflops={3}
          factor={scale.factor}
          onIncline={scale.onIncline}
          onDecline={scale.onDecline}
          onChange={scale.onChange}
          onFallback={scale.onFallback}
        />
        <KeyboardControls map={KEYS}>
          <Suspense fallback={null}>
            <MountainPrebuild />
          </Suspense>
          <Suspense fallback={null}>
            <MainScene />
          </Suspense>
        </KeyboardControls>
      </Canvas>
    </div>
  );
}

/**
 * Full-viewport story stage (shipped `np`, a sticky child of the 6600dvh track). Raven: the story runs in two page
 * bands joined by the diagonal wipe (story-map.ts), so the stage is fixed and covers both; it scrolls away after band 2,
 * exactly as a sticky stage would.
 */
export function FixedContainer() {
  const ref = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = stageTop(lenis?.actualScroll ?? window.scrollY);
      el.style.visibility = top === null ? "hidden" : "visible";
      el.style.transform = `translate3d(0,${(top ?? 0).toFixed(1)}px,0)`;
      useStage.getState().setCover(top === null ? 0 : Math.max(0, 1 - Math.abs(top) / (storyMap.vh || window.innerHeight)));
      const multi = useScenes.getState()[SCENE.MULTI_THREAT_RESPONSE];
      el.style.opacity = String(remap(multi.hideRatio, 0, 0.8, 1, 0));
      // Diagonal transition: Route copy and HUD are swept by the same edge as the frame (PostFX DiagonalWipeEffect).
      const page = lenis?.actualScroll ?? window.scrollY;
      const t = wipeProgress(page);
      // After the wipe the layer stays fully clipped for a short stretch (Care teams copy and HUD start later, at
      // phalanx .75): unclipping right at the switch showed the Route HUD for the frame before React swapped it.
      const settling = t >= 1 && page < storyMap.X + 1.4 * storyMap.W;
      if (overlay.current) overlay.current.style.clipPath = settling ? wipeClipPath(1) : t > 0 && t < 1 ? wipeClipPath(wipeRatioAt(page)) : "";
    };
    const onResize = () => {
      measureStoryMap();
      update();
    };
    measureStoryMap();
    update();
    lenis?.on("scroll", update);
    window.addEventListener("resize", onResize);
    return () => {
      lenis?.off("scroll", update);
      window.removeEventListener("resize", onResize);
    };
  }, [lenis]);

  useEffect(() => {
    const onMove = (e: PointerEvent) =>
      useMouse.getState().updateMouse((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div ref={ref} className="pointer-events-none fixed top-0 left-0 flex h-dvh w-full justify-center will-change-transform">
      <div id="scene-container" className="relative flex h-dvh w-full flex-col items-center justify-center">
        <SceneCanvas />
        {/* Chapter copy + HUD share one full-stage layer so the diagonal wipe can clip them together. */}
        <div ref={overlay} className="absolute inset-0">
          <ChapterCopy />
          <HudLog />
        </div>
      </div>
    </div>
  );
}
