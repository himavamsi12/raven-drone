import * as THREE from "three";
import { computeMountain, MOUNTAIN_COLS, MOUNTAIN_STRIPS, TERRAIN_SUN_DIR } from "./mountain-field";
import type { MountainInput, MountainResult } from "./mountain-field";

/**
 * Raven mountain terrain (user, 2026-11-03, after everest.suraj.work; plan: RAVEN_MOUNTAIN_TERRAIN_PLAN.md).
 * Default on the homepage since 2026-11-03 (user: "host this site in this link", localhost:3100/); `?terrain=v09`
 * shows the previous baked Raven tiles, `?terrain=original` the shipped tile. The heightfield maths is in `mountain-field.ts` and runs
 * in a worker (`mountain-terrain.worker.ts`, ~1-1.5 s of CPU with erosion); this module turns its arrays into the 24
 * slice geometries and owns the procedural detail textures.
 */

export { MOUNTAIN, MOUNTAIN_COLS, MOUNTAIN_STRIPS } from "./mountain-field";

/** On unless `?terrain=v09` (callers also require the Raven variant: not `?terrain=original` / `?plate=h00`). */
export function mountainTerrainEnabled() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("terrain") !== "v09";
}

/** Terrain key light (see mountain-field `TERRAIN_SUN_DIR`). */
export const TERRAIN_SUN = new THREE.Vector3(...TERRAIN_SUN_DIR);

export type MountainSlices = THREE.BufferGeometry[][]; // [col mod 4][strip mod 6]

/** Slice for a tile column (-1..2) and ground strip (row + wraps travelled). */
export function mountainSlice(slices: MountainSlices, col: number, strip: number) {
  const c = ((col % MOUNTAIN_COLS) + MOUNTAIN_COLS) % MOUNTAIN_COLS;
  const s = ((strip % MOUNTAIN_STRIPS) + MOUNTAIN_STRIPS) % MOUNTAIN_STRIPS;
  return slices[c][s];
}

function debugStats() {
  if (typeof window === "undefined") return false;
  return process.env.NODE_ENV !== "production" || new URLSearchParams(window.location.search).get("probe") === "terrain";
}

function rawMesh(geometry: THREE.BufferGeometry, withUv: boolean) {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const position = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) position.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);
  const uvAttr = geometry.attributes.uv as THREE.BufferAttribute | undefined;
  const uv = new Float32Array(withUv && uvAttr ? uvAttr.count * 2 : 0);
  if (withUv && uvAttr) for (let i = 0; i < uvAttr.count; i++) uv.set([uvAttr.getX(i), uvAttr.getY(i)], i * 2);
  const index = geometry.index ? Uint32Array.from(geometry.index.array as ArrayLike<number>) : null;
  return { position, index, uv };
}

/** Run the field computation in the worker; inline (yielding between chunks) if workers are unavailable. */
async function compute(input: MountainInput): Promise<MountainResult> {
  if (typeof Worker !== "undefined") {
    try {
      const worker = new Worker(new URL("./mountain-terrain.worker.ts", import.meta.url));
      return await new Promise<MountainResult>((resolve, reject) => {
        worker.onmessage = (e: MessageEvent<MountainResult | { error: string }>) => {
          worker.terminate();
          if ("error" in e.data) reject(new Error(e.data.error));
          else resolve(e.data);
        };
        worker.onerror = (e) => {
          worker.terminate();
          reject(e);
        };
        worker.postMessage(input, [input.land.position.buffer, input.houses.buffer]);
      });
    } catch (err) {
      console.warn("Mountain terrain worker unavailable, computing inline.", err);
      // The transfer may have detached the inputs: the caller rebuilds them for the inline run.
      throw err;
    }
  }
  return computeMountain(input, () => new Promise<void>((r) => setTimeout(r, 0)));
}

/** Build the 24 slice geometries from the Raven tile (`land`) and its houses. */
export async function buildMountainSlices(
  land: THREE.BufferGeometry,
  houses: THREE.BufferGeometry,
  segments: number,
): Promise<MountainSlices> {
  const input = () => ({ land: rawMesh(land, true), houses: rawMesh(houses, false).position, segments, wantStats: debugStats() });
  let result: MountainResult;
  try {
    result = await compute(input());
  } catch {
    result = await computeMountain(input(), () => new Promise<void>((r) => setTimeout(r, 0)));
  }
  if (result.stats) (window as unknown as { __mountainStats?: object }).__mountainStats = result.stats;
  setDetailMaps(result.detail);
  const uvAttr = new THREE.BufferAttribute(result.uv, 2);
  const indexAttr = new THREE.BufferAttribute(result.index, 1);
  const slices: MountainSlices = [];
  for (let c = 0; c < MOUNTAIN_COLS; c++) {
    const column: THREE.BufferGeometry[] = [];
    for (let s = 0; s < MOUNTAIN_STRIPS; s++) {
      const a = result.slices[c * MOUNTAIN_STRIPS + s];
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(a.position, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(a.normal, 3));
      g.setAttribute("uv", uvAttr);
      g.setAttribute("aGrad", new THREE.BufferAttribute(a.grad, 4));
      g.setAttribute("aData", new THREE.BufferAttribute(a.data, 4));
      g.setIndex(indexAttr);
      // Covers the tile (corners at 283) and the material's horizon lift (mountain part up to ~3.5x): frustum culling.
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 50, 0), 340);
      column.push(g);
    }
    slices.push(column);
  }
  return slices;
}

// ---------------------------------------------------------------------------------------------------------------
// Detail texture (rock / heath / snow / macro), generated once, tileable, mipmapped

let detailMaps: { albedo: THREE.DataTexture; normal: THREE.DataTexture } | null = null;

/**
 * Shared detail-map uniforms of every MountainMaterial (filled when the worker's maps arrive; the materials are only
 * shown once the slices of the same run are in, so they never sample the empty state).
 */
export const mountainDetailUniforms = {
  uDetail: { value: null as THREE.Texture | null },
  uDetailN: { value: null as THREE.Texture | null },
};

function dataTexture(data: Uint8Array, size: number) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function setDetailMaps(d: MountainResult["detail"]) {
  if (detailMaps) return;
  detailMaps = { albedo: dataTexture(d.albedo, d.size), normal: dataTexture(d.normal, d.size) };
  mountainDetailUniforms.uDetail.value = detailMaps.albedo;
  mountainDetailUniforms.uDetailN.value = detailMaps.normal;
}
