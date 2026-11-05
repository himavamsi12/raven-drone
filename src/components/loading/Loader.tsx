"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import clsx from "clsx";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import { useLoading } from "@/lib/loading";
import { bootPose } from "@/lib/boot-pose";
import { useGLB } from "@/components/scene/types";

/** Silhouette tone on the loader background (the earlier boot silhouette's #2d302e). */
const SILHOUETTE = "#2b2e31";

/** The live Raven model as a flat silhouette, placed and seen exactly like the main scene's hero drone (bootPose). */
function MatchCutDrone() {
  const { scene } = useGLB(ASSETS.raven);
  const camera = useThree((s) => s.camera);
  const object = useMemo(() => {
    const c = scene.clone(true);
    const material = new THREE.MeshBasicMaterial({ color: SILHOUETTE });
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = material;
    });
    c.matrixAutoUpdate = false;
    return c;
  }, [scene]);
  // Still, like an image (user 2026-11-05: "currently it is shaking"): the pose is taken once, from the first frame
  // the main scene publishes, and again only after a resize; the live hover and camera shake are not followed.
  const frozen = useRef(false);
  useEffect(() => {
    const onResize = () => void (frozen.current = false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useFrame(() => {
    if (!bootPose.ready || frozen.current) return;
    frozen.current = true;
    object.matrix.copy(bootPose.model);
    object.matrixWorldNeedsUpdate = true;
    camera.matrixAutoUpdate = false;
    camera.matrix.copy(bootPose.camera);
    camera.matrixWorld.copy(bootPose.camera);
    camera.matrixWorldInverse.copy(bootPose.camera).invert();
    camera.projectionMatrix.copy(bootPose.projection);
    camera.projectionMatrixInverse.copy(bootPose.projection).invert();
  });
  return <primitive object={object} dispose={null} />;
}

/**
 * Loader match cut (lib/boot-pose.ts; user 2026-11-05): a canvas laid exactly over the main canvas, drawing the Raven
 * silhouette through the main camera, so when the loader fades the silhouette becomes the lit drone in place. Shows
 * once the main scene publishes its first hero frame (fades in).
 */
function MatchCutCanvas() {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = box.current;
      if (el && bootPose.ready) {
        const { x, y, w, h } = bootPose.rect;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        if (!ready) setReady(true);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [ready]);
  return (
    <div
      ref={box}
      className={clsx("absolute top-0 left-0 transition-opacity duration-700 ease-out", ready ? "opacity-100" : "opacity-0")}
      style={{ width: 0, height: 0 }}
    >
      <Canvas className="h-full w-full" gl={{ alpha: true, antialias: true, powerPreference: "low-power" }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <MatchCutDrone />
        </Suspense>
      </Canvas>
    </div>
  );
}

const STATUS = {
  initializing: { label: "Initializing", progress: 0.18 },
  loading: { label: "Loading assets", progress: 0.52 },
  calibrating: { label: "Preparing scene", progress: 0.84 },
  ready: { label: "Ready", progress: 1 },
  degraded: { label: "Slow connection", progress: 0.52 },
};

/** Status line + progress hairline (shipped module 58905). */
function LoadingStatus() {
  const loaded = useLoading((s) => s.loadingCanvasLoaded);
  const main = useLoading((s) => s.mainAppLoaded);
  // "Preparing scene" until the mountain terrain is built (it was the footer sequence until the footer was removed).
  const terrain = useLoading((s) => s.terrainReady);
  const hiding = useLoading((s) => s.loadingCanvasIsHiding);
  const hidden = useLoading((s) => s.loadingCanvasHidden);
  const degraded = useLoading((s) => s.degraded);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 700);
    return () => clearTimeout(id);
  }, []);
  const status = hiding
    ? STATUS.ready
    : degraded
      ? STATUS.degraded
      : loaded
        ? main
          ? terrain
            ? STATUS.ready
            : STATUS.calibrating
          : STATUS.loading
        : STATUS.initializing;
  const max = useRef(0);
  max.current = Math.max(max.current, status.progress);
  if (hidden) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "pointer-events-none fixed inset-x-0 bottom-[max(12vh,5.5rem)] z-[950] flex flex-col items-center gap-3 transition-opacity duration-700 ease-out",
        visible && !hiding ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="h-px w-24 overflow-hidden bg-white/10">
        <div className="h-full bg-white/40 transition-[width] duration-700 ease-out" style={{ width: `${100 * max.current}%` }} />
      </div>
      <p className="font-mono text-[0.625rem] tracking-[0.28em] text-white/35 uppercase">{status.label}</p>
    </div>
  );
}

/**
 * Loader orchestration (shipped modules 86700 + 60745). The reference reports
 * "loading-canvas-loaded/hidden" from a worker-rendered OffscreenCanvas; here the
 * DOM splash stands in and the reveal follows the same state transitions and
 * fallback timers (12s loaded, 20s degraded, 3s hide).
 */
export function Loader() {
  const loaded = useLoading((s) => s.loadingCanvasLoaded);
  const hidden = useLoading((s) => s.loadingCanvasHidden);
  const hiding = useLoading((s) => s.loadingCanvasIsHiding);
  const main = useLoading((s) => s.mainAppLoaded);
  const terrain = useLoading((s) => s.terrainReady);
  // Boot splash first, then the loading canvas takes over (12s fallback in the reference).
  useEffect(() => {
    const id = setTimeout(() => useLoading.setState({ loadingCanvasLoaded: true }), 600);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (main && terrain) useLoading.getState().setCanRemoveLoading();
  }, [main, terrain]);

  useEffect(() => {
    if (!loaded || hiding) return;
    const id = setTimeout(() => {
      useLoading.setState({ degraded: true });
      useLoading.getState().setCanRemoveLoading();
    }, 20000);
    return () => clearTimeout(id);
  }, [loaded, hiding]);

  useEffect(() => {
    if (!hiding || hidden) return;
    const id = setTimeout(() => useLoading.setState({ loadingCanvasHidden: true }), 900);
    return () => clearTimeout(id);
  }, [hiding, hidden]);

  return (
    <>
      {/* Stand-in for the reference's worker-rendered loading canvas (chunk 4867, not captured). */}
      {!hidden && loaded && (
        <div
          aria-hidden="true"
          className={clsx("pointer-events-none fixed inset-0 z-[890] transition-opacity duration-700 ease-out", hiding ? "opacity-0" : "opacity-100")}
          style={{ background: "radial-gradient(120% 120% at 50% 45%, #0d1014 0%, #06070a 45%, #000 80%)" }}
        >
          <MatchCutCanvas />
        </div>
      )}
      {!hidden && (
        <div
          aria-hidden="true"
          className={clsx(
            "pointer-events-none fixed inset-0 z-[900] flex items-center justify-center transition-opacity duration-500 ease-out",
            loaded ? "opacity-0" : "opacity-100",
          )}
          style={{ background: "radial-gradient(120% 120% at 50% 45%, #0d1014 0%, #06070a 45%, #000 80%)" }}
        />
      )}
      <LoadingStatus />
    </>
  );
}
