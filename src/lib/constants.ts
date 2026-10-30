import { createRef } from "react";
import * as THREE from "three";

/** Shared mutable refs + constants recovered from shipped module 98127. */

/** Terrain tile scale (`Br`). */
export const TERRAIN_SCALE = 0.04;
/** Mesh y used by the engine scene-copy hook (`OA`). */
export const ENGINE_COPY_Y = 0;

/** Rendered terrain travel offset, after the thermal "ramp" correction (`RW`). */
export const terrainOffset = createRef<number>() as React.RefObject<number>;
terrainOffset.current = 0;
/** Wrapped offset applied to tile positions (`sG`). */
export const terrainWrapped = createRef<number>() as React.RefObject<number>;
terrainWrapped.current = 0;
/** Free-running travel accumulator (`p$`). */
export const terrainTravel = createRef<number>() as React.RefObject<number>;
terrainTravel.current = 0;
/** Distance still to travel to reach the city tile during thermal scene (`IO`). */
export const terrainRamp = createRef<number>() as React.RefObject<number>;
terrainRamp.current = 0;
/** Unused counter kept for parity (`Fc`). */
export const terrainAux = createRef<number>() as React.RefObject<number>;
terrainAux.current = 1;

/** Drawing-buffer resolution in device pixels (`PM`). */
export const resolution = new THREE.Vector2();

/** Sun position / direction (`q7`, `m5`). */
export const SUN_POSITION = new THREE.Vector3(-40, 100, -30);
export const SUN_DIRECTION = SUN_POSITION.clone().normalize();

export const RENDER_ORDER = {
  TERRAIN: 0,
  TRAILS: 1,
  POWER_STATION: 2,
  HERO_DRONE: 3,
  HERO_DRONE_NUMBER: 4,
  HERO_DRONE_ENGINE: 5,
  CLOUDS: 6,
  SPRITES: 6,
} as const;

export const BG_COLOR = new THREE.Color().setHex(0x000000);
export const SKY_COLOR = new THREE.Color().setHex(0xc9e0f7);
