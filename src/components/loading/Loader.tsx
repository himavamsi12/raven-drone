"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import clsx from "clsx";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import { useLoading } from "@/lib/loading";
import { remap } from "@/lib/math";
import { useGLB } from "@/components/scene/types";
import { BOOT_LENGTH, BOOT_SHAPE, BOOT_VIEWBOX } from "./boot-shape";

const [BOOT_W, BOOT_H] = BOOT_VIEWBOX;
const PERIMETER = Math.round(BOOT_LENGTH);
const DASH = Math.round(BOOT_LENGTH * 0.1);

/** Boot silhouette with traveling highlight (shipped `a` in module 60745; Raven drone outline). */
function BootShape({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${BOOT_W} ${BOOT_H}`} className={className} aria-hidden="true">
      <defs>
        <path id="ds-shape" d={BOOT_SHAPE} fillRule="evenodd" clipRule="evenodd" />
        <clipPath id="ds-clip">
          <use href="#ds-shape" clipRule="evenodd" />
        </clipPath>
        <filter id="ds-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.28" numOctaves="1" stitchTiles="stitch" result="noise" />
          <feColorMatrix in="noise" type="saturate" values="0" />
        </filter>
      </defs>
      <g clipPath="url(#ds-clip)">
        <rect width={BOOT_W} height={BOOT_H} fill="currentColor" />
        <rect width={BOOT_W} height={BOOT_H} filter="url(#ds-grain)" opacity="0.04" />
      </g>
      <use href="#ds-shape" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="2" />
      <use href="#ds-shape" fill="none" stroke="#eaf2ff" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" strokeDasharray={`${DASH} ${PERIMETER - DASH}`}>
        <animate attributeName="stroke-dashoffset" values={`${PERIMETER};0`} dur="4s" repeatCount="indefinite" calcMode="linear" />
      </use>
    </svg>
  );
}

/** Loader silhouette (Raven hexacopter; same placement/material as the shipped delta). */
function LoadingDrone({ width }: { width: number }) {
  const { scene } = useGLB(ASSETS.loadingDrone);
  const object = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: "#2d302e" });
    });
    return c;
  }, [scene]);
  const scale = 0.75 * (width >= 768 ? 1 : remap(width, 390, 768, 1, 1.35));
  return <primitive object={object} position={[-0.005623, 0.00259, 0.022765]} rotation={[-3.141362, 2e-6, -3.130472]} scale={scale} />;
}

/** Mobile boot visual: the drone silhouette in a demand-driven canvas. */
function LoadingCanvas({ width, className }: { width: number; className?: string }) {
  const md = width >= 768;
  return (
    <Canvas className={className} gl={{ alpha: true, antialias: true, powerPreference: "low-power" }} dpr={[1, 2]} frameloop="demand">
      <PerspectiveCamera
        makeDefault
        fov={20}
        position={md ? [-3.152446, 3.910685, 5.033364] : [-6.075572, 7.260972, 9.217436]}
        rotation={md ? [-0.660528, -0.459299, -0.311193] : [-0.70083, -0.454, -0.328852]}
      />
      <Suspense fallback={null}>
        <LoadingDrone width={width} />
      </Suspense>
    </Canvas>
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
  const [width, setWidth] = useState(1280);

  useEffect(() => {
    const on = () => setWidth(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

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
          className={clsx(
            "pointer-events-none fixed inset-0 z-[890] transition-opacity duration-700 ease-out",
            hiding ? "opacity-0" : "opacity-100",
          )}
          style={{ background: "radial-gradient(120% 120% at 50% 45%, #0d1014 0%, #06070a 45%, #000 80%)" }}
        >
          <LoadingCanvas width={width} className="h-full w-full opacity-40" />
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
        >
          <BootShape className="relative h-[40.19vh] w-auto translate-x-[0.77vh] -translate-y-[1.1vh] animate-[pulse_4s_ease-in-out_infinite] text-[#2d302e]/40 max-md:hidden" />
          {width < 768 && (
            <div className="absolute inset-0 animate-[pulse_4s_ease-in-out_infinite]">
              <LoadingCanvas width={width} className="h-full w-full opacity-40" />
            </div>
          )}
        </div>
      )}
      <LoadingStatus />
    </>
  );
}
