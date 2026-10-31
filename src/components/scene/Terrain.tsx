"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useKeyboardControls, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import {
  RENDER_ORDER,
  resolution,
  TERRAIN_SCALE,
  terrainOffset,
  terrainRamp,
  terrainTravel,
  terrainWrapped,
} from "@/lib/constants";
import { easeInOutCubic, remap, remapEased, wrap } from "@/lib/math";
import { SCENE, scenes, type SceneId } from "@/lib/scenes";
import { isScrollLocked } from "@/lib/scroll-lock";
import { openingNow } from "@/lib/story-map";
import { useMediaQuery } from "@/lib/use-media-query";
import { TerrainMaterial } from "./materials/TerrainMaterial";
import { getNoiseTexture } from "./textures";
import { openingEase } from "./opening";
import { DetectionPoints } from "./DetectionPoints";
import { RAVEN_DETECTION_Y, terrainVariant } from "./raven-terrain";
import { useGLB } from "./types";

/** Distance between tile origins (shipped `X`). */
export const TILE_STEP = 2 * TERRAIN_SCALE * 200 - 0.01;

type FogValues = {
  uFogStart: number;
  uFogEnd: number;
  uFogDensity: number;
  uFogExponent: number;
  uFogBlendFactor: number;
};

/** Fog keyframes per scene (shipped `z`/`k`). */
const FOG: Partial<Record<SceneId, FogValues>> = {
  [SCENE.INTRO_SCENE]: { uFogStart: 12, uFogEnd: 32, uFogDensity: 1, uFogExponent: 1, uFogBlendFactor: 0.5 },
  [SCENE.DELTA_DRONE]: { uFogStart: 12, uFogEnd: 36, uFogDensity: 0, uFogExponent: 1, uFogBlendFactor: 0.5 },
  [SCENE.FLOCK_SCENE]: { uFogStart: 24, uFogEnd: 32, uFogDensity: 1, uFogExponent: 1, uFogBlendFactor: 0.2 },
  [SCENE.THERMAL_IRREGULARITY]: { uFogStart: 36, uFogEnd: 56, uFogDensity: 1, uFogExponent: 1, uFogBlendFactor: 0.2 },
  [SCENE.IGNITION_VERIFIED]: { uFogStart: 36, uFogEnd: 56, uFogDensity: 0, uFogExponent: 1, uFogBlendFactor: 0.2 },
};
const FOG_INTRO_MOBILE: FogValues = { ...FOG[SCENE.INTRO_SCENE]!, uFogStart: 16 };
/**
 * Raven opening: the low shot looks across the ground, so fog thickens to full sky colour before the tiles end
 * (opening tiles reach ~48 units) and the far ridges (OpeningSky) rise out of the haze. Blends out to the scene fog
 * by the hero frame.
 */
const FOG_OPENING: FogValues = { uFogStart: 9, uFogEnd: 40, uFogDensity: 1, uFogExponent: 1.25, uFogBlendFactor: 0 };
const FOG_KEYS = Object.keys(FOG_OPENING) as (keyof FogValues)[];

type FogStep = { scene: SceneId; start?: number; end?: number; from: FogValues; to: FogValues; always?: boolean };

function applyFog(material: TerrainMaterial, steps: FogStep[]) {
  const state = scenes();
  for (const { scene, start = 0, end = 1, from, to, always } of steps) {
    const p = state[scene].progress;
    if (!(p > 0 || always)) continue;
    const u = material.uniforms;
    u.uFogStart.value = remap(p, start, end, from.uFogStart, to.uFogStart);
    u.uFogEnd.value = remap(p, start, end, from.uFogEnd, to.uFogEnd);
    u.uFogDensity.value = remap(p, start, end, from.uFogDensity, to.uFogDensity);
    u.uFogExponent.value = remap(p, start, end, from.uFogExponent, to.uFogExponent);
    u.uFogBlendFactor.value = remap(p, start, end, from.uFogBlendFactor, to.uFogBlendFactor);
  }
}

function fogSteps(isMd: boolean): FogStep[] {
  const intro = isMd ? FOG[SCENE.INTRO_SCENE]! : FOG_INTRO_MOBILE;
  return [
    { scene: SCENE.INTRO_SCENE, from: intro, to: intro, always: true },
    { scene: SCENE.DELTA_DRONE, from: intro, to: FOG[SCENE.DELTA_DRONE]! },
    { scene: SCENE.FLOCK_SCENE, start: 0.5, end: 1, from: FOG[SCENE.DELTA_DRONE]!, to: FOG[SCENE.FLOCK_SCENE]! },
    { scene: SCENE.THERMAL_IRREGULARITY, from: FOG[SCENE.FLOCK_SCENE]!, to: FOG[SCENE.THERMAL_IRREGULARITY]! },
    { scene: SCENE.IGNITION_VERIFIED, from: FOG[SCENE.THERMAL_IRREGULARITY]!, to: FOG[SCENE.IGNITION_VERIFIED]! },
  ];
}

function Buildings({ material }: { material: THREE.Material }) {
  const { nodes } = useGLB(ASSETS.building);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = (scenes()[SCENE.IGNITION_VERIFIED]?.progress ?? 0) < 0.25;
  });
  return (
    <group dispose={null}>
      <mesh ref={ref} rotation={[0, Math.PI, 0]} geometry={nodes.Buildings.geometry} material={material} />
    </group>
  );
}

type TileProps = {
  position: [number, number];
  geometries: [THREE.BufferGeometry, THREE.BufferGeometry];
  material: THREE.Material;
  isCity?: boolean;
  withPoints?: boolean;
  desktopOnly?: boolean;
  /** Raven natural tile: its village rides the same moving tile group (not drawn on the city tile). */
  houses?: { geometry: THREE.BufferGeometry; material: THREE.Material };
  detectionY?: readonly number[];
};

/** One terrain tile (shipped `K`); slides in -z by the wrapped travel offset. */
function Tile({ position: [col, row], geometries, material, isCity, withPoints, desktopOnly, houses, detectionY }: TileProps) {
  const is2xl = useMediaQuery("(min-width: 1536px)");
  const ref = useRef<THREE.Group>(null);
  const z = TILE_STEP * row;
  const x = TILE_STEP * col;
  useEffect(() => {
    if (!ref.current) return;
    ref.current.scale.setScalar(TERRAIN_SCALE);
    ref.current.position.x = x;
    ref.current.position.z = z;
  }, [x, z]);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.z = z - (terrainWrapped.current || 0);
    if (desktopOnly) ref.current.visible = is2xl;
  });
  return (
    <group ref={ref}>
      <mesh frustumCulled={false} renderOrder={RENDER_ORDER.TERRAIN} geometry={geometries[isCity ? 1 : 0]} material={material} />
      {houses && !isCity && (
        <mesh frustumCulled={false} renderOrder={RENDER_ORDER.TERRAIN} geometry={houses.geometry} material={houses.material} />
      )}
      {isCity && (
        <Buildings material={material} />
      )}
      {withPoints && <DetectionPoints groundY={detectionY} />}
    </group>
  );
}

/** Endless terrain (shipped `J`). */
export function Terrain() {
  const terrain = useGLB(ASSETS.terrain);
  const city = useGLB(ASSETS.cityTerrain);
  const raven = useGLB(ASSETS.ravenTerrain);
  // Canvas children render on the client only, so the query string is readable on first render.
  const [variant] = useState(terrainVariant);
  const isRaven = variant === "raven";
  const [, getKeys] = useKeyboardControls();
  const dpr = useThree((s) => s.viewport.dpr);
  const isMd = useMediaQuery("(min-width: 768px)");
  const boost = useRef(1);
  const appear = useRef(0);
  const wasThermal = useRef(false);

  const land = terrain.nodes["Land-A"] as THREE.Mesh;
  const cityLand = city.nodes["Land-A"] as THREE.Mesh;
  const ravenLand = raven.nodes["Land-A"] as THREE.Mesh;
  const ravenHouses = raven.nodes.Houses as THREE.Mesh;
  const naturalLand = isRaven ? ravenLand : land;
  const geometries = useMemo(
    () => [naturalLand.geometry, cityLand.geometry] as [THREE.BufferGeometry, THREE.BufferGeometry],
    [naturalLand, cityLand],
  );
  // The city tile keeps the shipped base map under its overlay; natural tiles take the Raven bake when active.
  const baseMap = (land.material as THREE.MeshStandardMaterial).map;
  const naturalMap = (naturalLand.material as THREE.MeshStandardMaterial).map;
  const housesMap = (ravenHouses.material as THREE.MeshStandardMaterial).map;

  const cityTex = useTexture(ASSETS.cityTexture, (t) => {
    const tex = Array.isArray(t) ? t[0] : t;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.anisotropy = 4;
  });

  const [natural] = useState(() => new TerrainMaterial(getNoiseTexture()));
  const [urban] = useState(() => new TerrainMaterial(getNoiseTexture()));
  // Same fog/scan treatment as the ground so houses never sit crisp over hazy terrain.
  const [village] = useState(() => new TerrainMaterial(getNoiseTexture()));
  const materials = useMemo(() => [natural, urban, village], [natural, urban, village]);
  const houses = useMemo(
    () => (isRaven ? { geometry: ravenHouses.geometry, material: village } : undefined),
    [isRaven, ravenHouses, village],
  );

  useEffect(() => {
    for (const map of [baseMap, naturalMap, housesMap]) if (map) map.anisotropy = 4;
    for (const m of materials) {
      m.uniforms.uResolution.value = resolution;
      m.uniforms.uCityTexture.value = cityTex;
      m.uniforms.uBgColor.value.set(0x000000);
    }
    natural.uniforms.uBaseTexture.value = naturalMap;
    urban.uniforms.uBaseTexture.value = baseMap;
    village.uniforms.uBaseTexture.value = housesMap;
  }, [baseMap, naturalMap, housesMap, cityTex, materials, natural, urban, village]);

  useEffect(() => {
    for (const m of materials) m.uniforms.uDpr.value = dpr;
  }, [dpr, materials]);

  const groupA = useRef<THREE.Group>(null);
  const groupB = useRef<THREE.Group>(null);
  const groupCity = useRef<THREE.Group>(null);
  const groupWide = useRef<THREE.Group>(null);
  const groupAfter = useRef<THREE.Group>(null);
  const groupOpening = useRef<THREE.Group>(null);
  const steps = useMemo(() => fogSteps(isMd), [isMd]);

  useFrame((_, dt) => {
    const state = scenes();
    const delta = state[SCENE.DELTA_DRONE];
    const detection = state[SCENE.REAL_TIME_DETECTION];
    const thermal = state[SCENE.THERMAL_IRREGULARITY];
    const phalanx = state[SCENE.PHALANX_AI];
    const { shift } = getKeys() as { shift: boolean };
    const heroIdle = delta.progress < 0.001 && !isScrollLocked();
    boost.current += ((shift && heroIdle ? 6 : 1) - boost.current) * (shift ? 0.05 : 0.025);

    const speed =
      (0.25 + 0.2 * delta.progress + 0.2 * detection.progress) *
      (1 - remapEased(thermal.progress, 0, 0.75, 0, 1, easeInOutCubic)) *
      boost.current;

    const inThermal = thermal.showRatio > 0;
    if (inThermal !== wasThermal.current) {
      terrainRamp.current = inThermal ? 2 * TILE_STEP - wrap(terrainTravel.current, 0, TILE_STEP) : 0;
    }
    wasThermal.current = inThermal;

    if (inThermal) {
      terrainOffset.current = terrainTravel.current + thermal.progress * (terrainRamp.current || 0);
    } else {
      terrainTravel.current += 2 * dt * dpr * speed;
      terrainOffset.current = terrainTravel.current;
    }
    terrainWrapped.current =
      thermal.progress === 1 ? 2 * TERRAIN_SCALE * 200 : wrap(terrainOffset.current, 0, TILE_STEP);

    appear.current = Math.min(Math.max(appear.current + 0.3 * dt, 0), 1);

    let nearCity = false;
    if (terrainRamp.current > 0) {
      const travelled = terrainOffset.current - terrainTravel.current;
      nearCity = terrainRamp.current - travelled <= 200 * TERRAIN_SCALE;
    }
    const scan = remapEased(phalanx.progress, 0, 0.5, 0, 1, easeInOutCubic);
    natural.uniforms.uHideRatio.value = scan;
    urban.uniforms.uHideRatio.value = scan;
    village.uniforms.uHideRatio.value = scan;
    urban.uniforms.uisCity.value = nearCity;

    const tp = thermal.progress;
    const ignitionDone = state[SCENE.IGNITION_VERIFIED].progress > 0.9;
    const multi = state[SCENE.MULTI_THREAT_RESPONSE].progress;
    const approachingCity = tp > 0.5;
    if (groupB.current) groupB.current.visible = !ignitionDone;
    if (groupA.current) groupA.current.visible = !(tp > 0.99);
    if (groupCity.current) groupCity.current.visible = approachingCity;
    if (groupAfter.current) groupAfter.current.visible = approachingCity && !ignitionDone;
    if (groupWide.current) groupWide.current.visible = (approachingCity && !ignitionDone) || multi > 0.75;

    applyFog(natural, steps);
    applyFog(urban, steps);
    applyFog(village, steps);

    const opening = openingNow();
    if (groupOpening.current) groupOpening.current.visible = opening < 1;
    const w = 1 - openingEase(opening);
    if (w > 0) {
      for (const m of materials) {
        for (const k of FOG_KEYS) m.uniforms[k].value += (FOG_OPENING[k] - m.uniforms[k].value) * w;
      }
    }
  });

  const detectionY = isRaven ? RAVEN_DETECTION_Y : undefined;
  const tile = (pos: [number, number], extra: Partial<TileProps> = {}) => (
    <Tile
      key={pos.join(",")}
      position={pos}
      geometries={geometries}
      material={natural}
      houses={houses}
      detectionY={detectionY}
      {...extra}
    />
  );

  return (
    <>
      <group ref={groupA}>
        {tile([-1, 0], { desktopOnly: true })}
        {tile([0, 0], { withPoints: true })}
        {tile([1, 0])}
        {tile([-1, 1])}
        {tile([0, 1], { withPoints: true })}
        {tile([1, 1])}
      </group>
      <group ref={groupB}>
        {tile([-1, 2])}
        {tile([0, 2], { withPoints: true })}
        {tile([1, 2])}
      </group>
      <group ref={groupCity}>
        {tile([-1, 3])}
        {tile([0, 3], { material: urban, isCity: true })}
        {tile([1, 3])}
      </group>
      <group ref={groupWide}>
        {tile([-1, 4], { desktopOnly: true })}
        {tile([0, 4])}
        {tile([1, 4])}
      </group>
      {/* Raven opening: ground ahead of and beside the low wide shot (hidden from the hero frame on). */}
      <group ref={groupOpening}>
        {[-1, -2, -3].flatMap((row) => [-1, 0, 1, 2].map((col) => tile([col, row])))}
        {tile([2, 0])}
        {tile([2, 1])}
        {tile([2, 2])}
      </group>
      <group ref={groupAfter}>
        {tile([2, 3], { desktopOnly: true })}
        {tile([2, 4], { desktopOnly: true })}
        {tile([0, 5], { desktopOnly: true })}
        {tile([-1, 5], { desktopOnly: true })}
      </group>
    </>
  );
}

useGLB.preload(ASSETS.terrain);
useGLB.preload(ASSETS.cityTerrain);
useGLB.preload(ASSETS.ravenTerrain);
useGLB.preload(ASSETS.building);
