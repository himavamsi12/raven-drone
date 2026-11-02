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
import { attachRotorBlur, setRotorBlur, updateRotorBlur } from "./rotor-blur";
import { plateLight } from "./plate-light";
import { HERO_LIGHT, heroLight } from "./hero-light";
import { sunlight } from "./sunlight";

const ENV_INTENSITY = 0.85;
/** Surfaces that flash when a facet lines up with the sun (body carbon, chassis, medical box, blades). */
const GLINT_MATERIALS = /^(REF_Carbon|REF_Plastic_Graphite|MED_Chassis_Charcoal|MED_Box_White|PROP_Blade_DarkGrey)$/;
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

/**
 * Raven adapter: only the visual child changes; shipped flight/camera trackers stay intact.
 * `still` parks the rotors and shows the real blades (studio close-ups), as reduced motion does.
 */
const DRONE_MAP_KEYS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "clearcoatNormalMap"];
/** 8 is the widely supported maximum (three clamps to the GPU limit). */
const DRONE_ANISOTROPY = 8;

export function RavenModel({
  envMap,
  span = 200,
  still = false,
  onObject,
}: {
  envMap?: THREE.Texture;
  span?: number;
  still?: boolean;
  /** Receives this instance's cloned scene once mounted (footer: turret pivot). */
  onObject?: (object: THREE.Object3D) => void;
}) {
  const { scene } = useGLB(ASSETS.raven);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const spin = !reducedMotion && !still;
  const glint = useRef(0);
  const { object, rotors, blur, ownedMaterials, live, envRotation, scale } = useMemo(() => {
    const object = scene.clone(true);
    const rotors = collectRavenRotors(object);
    const ownedMaterials: THREE.Material[] = [];
    const live: LiveMaterial[] = [];
    // One rotation shared by this instance's materials; uniforms read it every render.
    const envRotation = new THREE.Euler();
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.renderOrder = RENDER_ORDER.HERO_DRONE;
      // Self-shadowing: arms, deck and props shade the box and gear (terrain is unlit and never receives).
      child.castShadow = child.receiveShadow = true;
      const copy = (source: THREE.Material) => {
        const material = source.clone();
        // Anisotropic filtering on every map (GLTFLoader leaves 1): the oblique hero/tilt views minified the decals and
        // panel maps into shimmer (user 2026-11-03: "no pixelation should happen with the drone"). Textures are shared
        // between clones, so this only re-uploads them once.
        for (const key of DRONE_MAP_KEYS) {
          const tex = (material as unknown as Record<string, THREE.Texture | null | undefined>)[key];
          if (tex && tex.anisotropy !== DRONE_ANISOTROPY) {
            tex.anisotropy = DRONE_ANISOTROPY;
            tex.needsUpdate = true;
          }
        }
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
    // After the material pass: blur discs keep their own shader and cast no shadow.
    const blur = attachRotorBlur(object, rotors);
    ownedMaterials.push(...blur.materials);
    return { object, rotors, blur, ownedMaterials, live, envRotation, scale: span / Math.max(size.x, size.z) };
  }, [scene, envMap, span]);
  useEffect(() => () => ownedMaterials.forEach((material) => material.dispose()), [ownedMaterials]);
  useEffect(() => onObject?.(object), [object, onObject]);
  // Still rotors (reduced motion, close-ups) show the real blades instead of the blur.
  useEffect(() => setRotorBlur(blur, spin), [blur, spin]);
  useFrame(({ camera, clock }, dt) => {
    if (spin) {
      advanceRavenRotors(rotors, dt);
      updateRotorBlur(blur, clock.getElapsedTime());
    }
    if (!live.length) return;
    // Over the H00 plate, reflect the plate-matched sky and terrain instead of the default sunset HDRI.
    const plateEnv = plateLight.weight > 0.5 ? plateLight.env : null;
    const wantEnv = plateEnv ?? envMap ?? null;
    if (live[0].material.envMap !== wantEnv) for (const { material } of live) material.envMap = wantEnv;
    // Sky/sun reflections follow the travel-driven heading (sunlight.ts) so highlights slide while flying.
    envRotation.set(sunlight.pitch, sunlight.heading, 0);
    // Hero preset (hero-light.ts): HDRI turned to the panel's yaw/tilt/roll.
    const h = heroLight.weight;
    if (h > 0) {
      envRotation.x += (heroLight.envRotation.x - envRotation.x) * h;
      envRotation.y += (heroLight.envRotation.y - envRotation.y) * h;
      envRotation.z += (heroLight.envRotation.z - envRotation.z) * h;
    }
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
      target *= sunlight.strength; // no sun, no glint (hero preset)
    }
    glint.current = damp(glint.current, target, target > glint.current ? 14 : 4, dt);
    // Under cloud the sky still reflects, so environment dims less than direct sun.
    // The plate sky is a softer, broader source than the HDRI's clipped sun: lift its fill a little.
    const env =
      ENV_INTENSITY *
      (0.8 + 0.2 * sunlight.shade) *
      (1 + 0.3 * plateLight.weight) *
      (1 + (HERO_LIGHT.environment.intensity - 1) * h);
    for (const { material, coat, glints } of live) {
      material.envMapIntensity = env + (glints ? 0.45 * glint.current : 0);
      if (glints && material instanceof THREE.MeshPhysicalMaterial) material.clearcoat = coat + 0.35 * glint.current;
    }
  });
  // The hexa faces +Z (front props at +Z); the original rig's nose points -Z. Body centre sits on the tracker origin.
  return <primitive object={object} rotation={[0, Math.PI, 0]} scale={scale} dispose={null} />;
}

export const Drone = forwardRef<THREE.Group, { envMap: THREE.Texture }>(function Drone({ envMap }, ref) {
  const root = useRef<THREE.Group>(null);
  useImperativeHandle(ref, () => root.current!);
  return <group ref={root}><RavenModel envMap={envMap} /></group>;
});

useGLB.preload(ASSETS.raven);
