"use client";

import { useFBO } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SUN_POSITION } from "@/lib/constants";
import { DRONE_SHADOW_LAYER, DRONE_SHADOW_SIZE, droneShadowUniforms } from "./drone-shadow";
import { heroLight } from "./hero-light";
import { sunlight } from "./sunlight";

const DRONES = ["Drone1Group", "Drone2Group", "Drone3Group"];
const UP = new THREE.Vector3(0, 1, 0);
/**
 * Daylight: real sun direction, crisper and darker. Overcast (hero preset, sun off): straight down, softer.
 * soft = penumbra radius in world units (the drone is ~1.4 across); converted to map UV per frame, because the map
 * frames all visible drones and its world size changes (one drone vs the three-drone Connection frame).
 */
const DAY = { strength: 0.9, soft: 0.1 };
const OVERCAST = { strength: 0.85, soft: 0.2 };
/** How far the overcast shadow direction moves from the sun toward straight down. */
const OVERCAST_DOWN = 0.6;

const _box = new THREE.Box3();
const _part = new THREE.Box3();
const _sphere = new THREE.Sphere();
const _dir = new THREE.Vector3();

/** Renders the drones' silhouette from the light each frame (see drone-shadow.ts); before the composer (100). */
export function DroneShadow() {
  const target = useFBO(DRONE_SHADOW_SIZE, DRONE_SHADOW_SIZE, { depthBuffer: true });
  const camera = useMemo(() => {
    const c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
    c.layers.set(DRONE_SHADOW_LAYER);
    // The overcast light points straight down: with the default +Y up, lookAt is degenerate (NaN matrix, no shadow).
    c.up.set(0, 0, -1);
    return c;
  }, []);
  const black = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x000000 }), []);
  const tagged = useRef(new Set<string>());
  const clear = useMemo(() => new THREE.Color(), []);
  // `?shadow=off` disables it (A/B comparisons).
  const [off] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("shadow") === "off");

  useEffect(() => {
    droneShadowUniforms.uDroneShadow.value = target.texture;
    return () => {
      droneShadowUniforms.uDroneShadowStrength.value = 0;
    };
  }, [target]);

  useFrame(({ gl, scene }) => {
    _box.makeEmpty();
    for (const name of DRONES) {
      const group = scene.getObjectByName(name);
      if (!group) continue;
      // Opaque parts only (the rotor blur discs are transparent and would cast solid black discs).
      if (!tagged.current.has(group.uuid)) {
        group.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          if (mats.every((m) => !m.transparent)) mesh.layers.enable(DRONE_SHADOW_LAYER);
        });
        tagged.current.add(group.uuid);
      }
      let visible = true;
      for (let o: THREE.Object3D | null = group; o; o = o.parent) if (!o.visible) visible = false;
      if (visible) _box.union(_part.setFromObject(group));
    }
    const u = droneShadowUniforms;
    if (off || _box.isEmpty()) {
      u.uDroneShadowStrength.value = 0;
      return;
    }
    _box.getBoundingSphere(_sphere);

    const h = heroLight.weight;
    _dir.copy(SUN_POSITION).applyAxisAngle(UP, sunlight.heading).normalize().lerp(UP, OVERCAST_DOWN * h).normalize();
    const half = _sphere.radius * 1.3;
    camera.left = camera.bottom = -half;
    camera.right = camera.top = half;
    camera.position.copy(_sphere.center).addScaledVector(_dir, 30);
    camera.lookAt(_sphere.center);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    u.uDroneShadowMatrix.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    u.uDroneShadowStrength.value = DAY.strength * sunlight.shade * (1 - h) + OVERCAST.strength * h;
    u.uDroneShadowSoft.value = (DAY.soft * (1 - h) + OVERCAST.soft * h) / (2 * half);

    const prevTarget = gl.getRenderTarget();
    const prevAlpha = gl.getClearAlpha();
    gl.getClearColor(clear);
    const prevOverride = scene.overrideMaterial;
    const prevBackground = scene.background;
    scene.overrideMaterial = black;
    scene.background = null;
    gl.setRenderTarget(target);
    gl.setClearColor(0xffffff, 1);
    gl.clear(true, true, false);
    gl.render(scene, camera);
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(clear, prevAlpha);
    scene.overrideMaterial = prevOverride;
    scene.background = prevBackground;
  }, 50);

  return null;
}
