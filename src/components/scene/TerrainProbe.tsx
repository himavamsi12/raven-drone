"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/**
 * Opt-in measurement hook (`?probe=terrain`) for the mountain terrain height budget: exposes the camera and the three
 * drones in terrain-parent ("map") space on `window.__terrainProbe()`. Mounted inside the terrain parent group, so
 * `worldToLocal` on the parent gives map coordinates. No effect unless the query is present.
 */
export function probeEnabled() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("probe") === "terrain";
}

type Sample = { camera: number[]; forward: number[]; fov: number; aspect: number; drones: (number[] | null)[] };

export function TerrainProbe() {
  const scene = useThree((s) => s.scene);
  const anchor = useRef<THREE.Group>(null);
  const last = useRef<Sample | null>(null);
  useFrame(({ camera }) => {
    const parent = anchor.current?.parent;
    if (!parent) return;
    const v = new THREE.Vector3();
    const toMap = (o: THREE.Object3D) => parent.worldToLocal(o.getWorldPosition(v.set(0, 0, 0))).toArray();
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const inv = new THREE.Matrix3().setFromMatrix4(parent.matrixWorld).invert();
    const persp = camera as THREE.PerspectiveCamera;
    last.current = {
      camera: toMap(camera),
      forward: fwd.applyMatrix3(inv).normalize().toArray(),
      fov: persp.fov,
      aspect: persp.aspect,
      drones: ["Drone1Group", "Drone2Group", "Drone3Group"].map((n) => {
        const o = scene.getObjectByName(n);
        return o && o.visible ? toMap(o) : null;
      }),
    };
    (window as unknown as { __terrainProbe?: () => Sample | null }).__terrainProbe = () => last.current;
  });
  return <group ref={anchor} />;
}
