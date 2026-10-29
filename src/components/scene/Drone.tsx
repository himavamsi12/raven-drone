"use client";

import { useFrame } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import { RENDER_ORDER } from "@/lib/constants";
import { damp } from "@/lib/math";
import { useMediaQuery } from "@/lib/use-media-query";
import { useGLB } from "./types";
import { collectRavenRotors, advanceRavenRotors } from "./raven-rotors";
import { sunlight } from "./sunlight";

const ENV_INTENSITY = 0.85;
/** Surfaces that flash when a facet lines up with the sun (satin shell, coated carbon, blades). */
const GLINT_MATERIALS = /^MAT_Raven_(Shell_CoolGray|Carbon_Tube|Propeller|PropTip)$/;
/** Shell facet normals in model space (top plateau, shoulders, nose/tail rakes; glTF Y up). */
const FACETS = [
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0.6, 0.8, 0),
  new THREE.Vector3(-0.6, 0.8, 0),
  new THREE.Vector3(0, 0.75, 0.66),
  new THREE.Vector3(0, 0.75, -0.66),
].map((v) => v.normalize());
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _h = new THREE.Vector3();

type LiveMaterial = { material: THREE.MeshStandardMaterial; coat: number; glints: boolean };

/** Raven adapter: only the visual child changes; shipped flight/camera trackers stay intact. */
export function RavenModel({ envMap, span = 200 }: { envMap?: THREE.Texture; span?: number }) {
  const { scene } = useGLB(ASSETS.raven);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const glint = useRef(0);
  const { object, rotors, ownedMaterials, live, envRotation, scale } = useMemo(() => {
    const object = scene.clone(true);
    const rotors = collectRavenRotors(object);
    const ownedMaterials: THREE.Material[] = [];
    const live: LiveMaterial[] = [];
    // One rotation shared by this instance's materials; uniforms read it every render.
    const envRotation = new THREE.Euler();
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.renderOrder = RENDER_ORDER.HERO_DRONE;
      const copy = (source: THREE.Material) => {
        const material = source.clone();
        if (material instanceof THREE.MeshStandardMaterial && envMap) {
          material.envMap = envMap;
          material.envMapIntensity = ENV_INTENSITY;
          material.envMapRotation = envRotation;
          const coat = material instanceof THREE.MeshPhysicalMaterial ? material.clearcoat : 0;
          live.push({ material, coat, glints: GLINT_MATERIALS.test(material.name) });
        }
        ownedMaterials.push(material);
        return material;
      };
      child.material = Array.isArray(child.material) ? child.material.map(copy) : copy(child.material);
    });
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    return { object, rotors, ownedMaterials, live, envRotation, scale: span / Math.max(size.x, size.z) };
  }, [scene, envMap, span]);
  useEffect(() => () => ownedMaterials.forEach((material) => material.dispose()), [ownedMaterials]);
  useFrame(({ camera }, dt) => {
    if (!reducedMotion) advanceRavenRotors(rotors, dt);
    if (!live.length) return;
    // Sky/sun reflections follow the travel-driven heading (sunlight.ts) so highlights slide while flying.
    envRotation.set(sunlight.pitch, sunlight.heading, 0);
    // Sun glint: brief flare when a shell facet's half-vector (sun, camera) lines up as the aircraft banks.
    let target = 0;
    if (!reducedMotion) {
      object.getWorldQuaternion(_q);
      object.getWorldPosition(_p);
      _h.copy(camera.position).sub(_p).normalize().add(sunlight.direction).normalize();
      let align = 0;
      for (const facet of FACETS) align = Math.max(align, _n.copy(facet).applyQuaternion(_q).dot(_h));
      target = smoothstep(Math.cos(0.3), Math.cos(0.1), align); // ramps in from 17° to 6° off-mirror
      target *= sunlight.shade > 0.85 ? 1 : 0.3; // no strong glints under cloud
    }
    glint.current = damp(glint.current, target, target > glint.current ? 14 : 4, dt);
    // Under cloud the sky still reflects, so environment dims less than direct sun.
    const env = ENV_INTENSITY * (0.8 + 0.2 * sunlight.shade);
    for (const { material, coat, glints } of live) {
      material.envMapIntensity = env + (glints ? 0.45 * glint.current : 0);
      if (glints && material instanceof THREE.MeshPhysicalMaterial) material.clearcoat = coat + 0.35 * glint.current;
    }
  });
  // Raven faces +Z; the original rig's nose points -Z. Keep rotor deck at the tracker origin.
  return <primitive object={object} rotation={[0, Math.PI, 0]} scale={scale} dispose={null} />;
}

export const Drone = forwardRef<THREE.Group, { envMap: THREE.Texture }>(function Drone({ envMap }, ref) {
  const root = useRef<THREE.Group>(null);
  useImperativeHandle(ref, () => root.current!);
  return <group ref={root}><RavenModel envMap={envMap} /></group>;
});

useGLB.preload(ASSETS.raven);
