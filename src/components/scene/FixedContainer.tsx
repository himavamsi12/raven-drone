"use client";

import { AdaptiveDpr, KeyboardControls, type KeyboardControlsEntry } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useLenis } from "lenis/react";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { useLoading } from "@/lib/loading";
import { remap } from "@/lib/math";
import { SCENE, useMouse, useScenes } from "@/lib/scenes";
import { measureStoryMap, stageTop, storyMap, useStage, wipeClipPath, wipeProgress, wipeRatioAt } from "@/lib/story-map";
import { ChapterCopy } from "./ChapterCopy";
import { HudLog } from "./HudLog";
import { MainScene } from "./MainScene";

const KEYS: KeyboardControlsEntry<string>[] = [
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "shift", keys: ["ShiftLeft"] },
];

/** WebGL canvas shown once the loader has the boot splash up (shipped `t8`). */
function SceneCanvas() {
  const loaded = useLoading((s) => s.loadingCanvasLoaded);
  const hiding = useLoading((s) => s.loadingCanvasIsHiding);
  if (!loaded) return null;
  return (
    // Shown: inherit the stage's visibility (not `visible`, which overrode the hidden stage after the story, so the
    // canvas kept showing its last frame behind the sections; the shipped story ended on black, Raven's on the landscape).
    <div className={hiding ? "absolute inset-0 touch-auto!" : "invisible absolute inset-0 touch-auto!"}>
      <Canvas
        camera={{ position: [0, 5, 0], fov: 60 }}
        dpr={[1, 1.5]}
        shadows="soft" // drone self-shadowing only (sun shadow camera is fitted to the hero drone in MainScene)
        gl={{ powerPreference: "high-performance", antialias: false, stencil: false, depth: false, outputColorSpace: THREE.SRGBColorSpace }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 1)}
      >
        <AdaptiveDpr pixelated />
        <KeyboardControls map={KEYS}>
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
