"use client";

import { AdaptiveDpr, KeyboardControls, type KeyboardControlsEntry } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useLenis } from "lenis/react";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { useLoading } from "@/lib/loading";
import { remap } from "@/lib/math";
import { SCENE, useMouse, useScenes } from "@/lib/scenes";
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
    <div className={hiding ? "visible absolute inset-0 touch-auto!" : "invisible absolute inset-0 touch-auto!"}>
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

/** Sticky full-viewport stage inside the 6600dvh scroll track (shipped `np`). */
export function FixedContainer() {
  const ref = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    const update = () => {
      const multi = useScenes.getState()[SCENE.MULTI_THREAT_RESPONSE];
      if (ref.current) ref.current.style.opacity = String(remap(multi.hideRatio, 0, 0.8, 1, 0));
    };
    update();
    lenis?.on("scroll", update);
    return () => lenis?.off("scroll", update);
  }, [lenis]);

  useEffect(() => {
    const onMove = (e: PointerEvent) =>
      useMouse.getState().updateMouse((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div ref={ref} className="pointer-events-none sticky top-0 left-0 -mt-14 flex h-dvh w-full justify-center">
      <div id="scene-container" className="relative flex h-dvh w-full flex-col items-center justify-center">
        <SceneCanvas />
        <ChapterCopy />
        <HudLog />
      </div>
    </div>
  );
}
