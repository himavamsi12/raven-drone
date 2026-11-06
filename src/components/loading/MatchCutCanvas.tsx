"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import clsx from "clsx";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import { bootPose } from "@/lib/boot-pose";
import { useGLB } from "@/components/scene/types";

/*
 * The loader's three.js part, its own chunk (load time, 2026-11-06): the loader backdrop and status line render with
 * the page's HTML, and only this silhouette canvas waits for three.js.
 */

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
export default function MatchCutCanvas({ paused = false }: { paused?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (paused) return;
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
  }, [ready, paused]);
  return (
    <div
      ref={box}
      className={clsx("absolute top-0 left-0 transition-opacity duration-700 ease-out", ready ? "opacity-100" : "opacity-0")}
      style={{ width: 0, height: 0 }}
    >
      <Canvas
        className="h-full w-full"
        frameloop={paused ? "never" : "always"}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <MatchCutDrone />
        </Suspense>
      </Canvas>
    </div>
  );
}
