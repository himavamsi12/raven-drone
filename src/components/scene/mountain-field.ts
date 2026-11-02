/**
 * Raven mountain terrain: the heightfield maths (no three.js, so it runs in `mountain-terrain.worker.ts`).
 * Orchestration, geometries and the detail textures live in `mountain-terrain.ts`; the idea in short:
 *
 *   height = old relief + eroded ridged mountains x (1 - village mask), soft-capped under the drones
 *
 * - Every natural tile gets its own slice of one periodic "super-tile" heightfield, 4 tile columns x 6 ground strips
 *   (the `ravenTileVariant` period), so the joins stay seamless without the old flat rim (2.189) that made every tile
 *   read as a valley.
 * - The old relief (rasterised from the Raven `Land-A`) keeps roads, village terraces and the baked land use lined
 *   up; the ridged field (domain-warped ridged multifractal, periodic gradient noise, 7 octaves) is then carved by
 *   droplet erosion into gullies and spurs (user reference 2026-11-03: the Everest site's high-country frame).
 * - The village mask pins the ground to the old height around every house, village scan and detection anchor, so the
 *   houses stay seated and `RAVEN_DETECTION_Y` / the scan frames stay valid on every slice.
 * - The cap keeps the ground below the measured flight path: drone 1 flies at map y 2.5 (local 62.5 above the tile
 *   base, measured with `?probe=terrain`, 1440x900), the low opening camera at 2.13; the ground stays under local
 *   ~34 (map 1.36), which is also under the mountain lens ceiling (PostFX `MOUNTAIN_TERRAIN_TOP`).
 * - Taller mountains away from the flight path come from the vertex shader (MountainMaterial `liftAt`).
 *
 * Units: tile-local glTF units (the tile group is scaled by TERRAIN_SCALE); x/z in [-200, 200] per tile.
 */

/** Plain mesh arrays (positions xyz, optional index and uv): what the worker receives. */
export type RawMesh = { position: Float32Array; index: Uint32Array | Uint16Array | null; uv: Float32Array };
export type MountainInput = { land: RawMesh; houses: Float32Array; segments: number; wantStats: boolean };
export type MountainSliceArrays = { position: Float32Array; normal: Float32Array; grad: Float32Array; data: Float32Array };
export type MountainResult = {
  /** Procedural detail maps (see computeDetailMaps), generated here so the main thread never builds them. */
  detail: { size: number; albedo: Uint8Array; normal: Uint8Array };
  segments: number;
  uv: Float32Array;
  index: Uint32Array;
  slices: MountainSliceArrays[];
  stats?: Record<string, number>;
};

/** Tile columns (-1..2) and ground strips in one period of the super-tile. */
export const MOUNTAIN_COLS = 4;
export const MOUNTAIN_STRIPS = 6;

export const MOUNTAIN = {
  /** Ridged field amplitude and its zero point (fraction of the normalised field). */
  amplitude: 34,
  zero: 0.34,
  /** Soft cap (local): heights above `capStart` approach `capStart + capRange`. */
  capStart: 27,
  capRange: 7,
  /** Village mask radii (local units): houses, settlement frames, detection anchors. */
  houseRadius: 17,
  anchorRadius: 9,
  /** Domain warp amplitude (local units). */
  warp: 40,
  /** Ridges per tile side in the base octave (3 = ~130 local units apart, several in one view). */
  ridgesPerTile: 3,
  /** 7 octaves: the finest cell is ~2 grid samples, the small ridges and gullies of the Everest relief. */
  octaves: 7,
  /** Droplet erosion: droplets per grid sample (carves drainage gullies into the ridged field). */
  erosionDensity: 0.3,
} as const;

/**
 * Terrain key light: the scene sun's azimuth (SUN_POSITION -40, 100, -30) at a low 17 deg elevation (raking light:
 * user 2026-11-03, "increase the shadows like the Everest site terrain, more dramatic"; was 30), so long cast
 * shadows fill the valleys and every ridge reads (the scene sun is 63 deg up). Shadows are ray-marched with it.
 */
export const SUN_ELEVATION = (17 * Math.PI) / 180;
export const TERRAIN_SUN_DIR: readonly [number, number, number] = (() => {
  const c = Math.cos(SUN_ELEVATION);
  const v = [-0.8 * c, Math.sin(SUN_ELEVATION), -0.6 * c];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l] as const;
})();

/** DetectionPoints anchors (tile-local x, z), same order as `POINTS` there (copied from glb/raven-terrain/check_terrain.py). */
const ANCHORS_XZ: readonly (readonly [number, number])[] = [
  [-182.2743, -195.5112], [-32.062, -123.1434], [-6.3289, -171.9805], [68.3493, -126.7537], [179.2427, -173.0501],
  [125.5761, -57.8208], [64.5723, -64.839], [-99.9169, -159.1456], [-69.8519, -79.9549], [-176.3916, -36.679],
  [-50.4171, 17.2192], [9.4389, -7.9998], [-99.0042, 51.2302], [141.9201, 12.8108], [136.9131, 94.4187],
  [72.1303, 47.9911], [44.0578, 84.1614], [-40.6997, 83.6216], [-95.2252, 123.0311], [-155.1492, 84.7013],
  [-4.1252, -42.9317], [-111.9607, -10.3134], [-155.1492, -106.4079], [9.7148, -93.9014], [87.2463, -181.9878],
  [144.4711, -104.2485], [185.6602, -44.7009], [192.0777, 41.4001], [193.0582, 117.6326], [-159.2784, 153.1709],
  [138.819, 174.1206], [68.0067, 145.6838], [-37.8814, 197.5583], [-1.83, 139.2268],
];

/** DetectionPoints SETTLEMENTS footprints (centre x, z, half size x, z): the village scan frames. */
const SETTLEMENTS_XZ: readonly (readonly [number, number, number, number])[] = [
  [35.6, -67.2, 11.3, 16.9],
  [-120.3, 61.0, 9.1, 16.3],
  [96.4, 116.1, 7.75, 13.4],
  [-57.3, -159.9, 2.45, 2.6],
  [-71.1, -119.9, 2.1, 2.3],
  [-2.1, 150.0, 1.55, 1.85],
];

const TILE = 400;
const HALF = 200;

// ---------------------------------------------------------------------------------------------------------------
// Periodic gradient noise

export function makeHash(seed: number) {
  const perm = new Uint16Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256);
  const gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = rnd() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  return { perm, gx, gy };
}

export type Hash = ReturnType<typeof makeHash>;

/** Gradient noise in [-1, 1]-ish, periodic with integer periods px, py (cells). */
export function pnoise(h: Hash, x: number, y: number, px: number, py: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ix0 = ((x0 % px) + px) % px;
  const iy0 = ((y0 % py) + py) % py;
  const ix1 = (ix0 + 1) % px;
  const iy1 = (iy0 + 1) % py;
  const { perm, gx, gy } = h;
  const g = (ix: number, iy: number, dx: number, dy: number) => {
    const k = perm[perm[ix & 255] + (iy & 255)];
    return gx[k] * dx + gy[k] * dy;
  };
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = g(ix0, iy0, fx, fy);
  const b = g(ix1, iy0, fx - 1, fy);
  const c = g(ix0, iy1, fx, fy - 1);
  const d = g(ix1, iy1, fx - 1, fy - 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.414;
}

// ---------------------------------------------------------------------------------------------------------------
// Old relief and village mask (one tile, periodic)

/** Rasterise a tile mesh (x/z in [-200, 200]) into an (n+1)^2 height grid at spacing 400/n. */
function rasterHeights(mesh: RawMesh, n: number) {
  const P = mesh.position;
  const index = mesh.index;
  const grid = new Float32Array((n + 1) * (n + 1)).fill(NaN);
  const step = TILE / n;
  const tri = (ia: number, ib: number, ic: number) => {
    const ax = (P[ia * 3] + HALF) / step, az = (P[ia * 3 + 2] + HALF) / step, ay = P[ia * 3 + 1];
    const bx = (P[ib * 3] + HALF) / step, bz = (P[ib * 3 + 2] + HALF) / step, by = P[ib * 3 + 1];
    const cx = (P[ic * 3] + HALF) / step, cz = (P[ic * 3 + 2] + HALF) / step, cy = P[ic * 3 + 1];
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-12) return;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const x1 = Math.min(n, Math.ceil(Math.max(ax, bx, cx)));
    const z0 = Math.max(0, Math.floor(Math.min(az, bz, cz)));
    const z1 = Math.min(n, Math.ceil(Math.max(az, bz, cz)));
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
        grid[z * (n + 1) + x] = l1 * ay + l2 * by + l3 * cy;
      }
  };
  if (index) for (let i = 0; i < index.length; i += 3) tri(index[i], index[i + 1], index[i + 2]);
  else for (let i = 0; i < P.length / 3; i += 3) tri(i, i + 1, i + 2);
  // Fill any missed sample from its neighbours (degenerate slivers), then make the edges exactly periodic.
  for (let pass = 0; pass < 4; pass++)
    for (let z = 0; z <= n; z++)
      for (let x = 0; x <= n; x++) {
        const k = z * (n + 1) + x;
        if (!Number.isNaN(grid[k])) continue;
        let s = 0, c = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, zz = z + dz;
          if (xx < 0 || zz < 0 || xx > n || zz > n) continue;
          const v = grid[zz * (n + 1) + xx];
          if (!Number.isNaN(v)) (s += v), c++;
        }
        if (c) grid[k] = s / c;
      }
  for (let i = 0; i <= n; i++) {
    grid[i * (n + 1) + n] = grid[i * (n + 1)];
    grid[n * (n + 1) + i] = grid[i];
  }
  return grid;
}

/** Village mask on an (n+1)^2 tile grid, periodic over the tile (1 = keep the old ground). */
function villageMask(houses: Float32Array, n: number) {
  const mask = new Float32Array((n + 1) * (n + 1));
  const step = TILE / n;
  const splat = (cx: number, cz: number, hx: number, hz: number, r: number) => {
    // Rounded box of half size (hx, hz) with a soft border r; also splatted one tile over in every direction.
    for (const ox of [-TILE, 0, TILE])
      for (const oz of [-TILE, 0, TILE]) {
        const x0 = Math.max(0, Math.floor((cx + ox - hx - r + HALF) / step));
        const x1 = Math.min(n, Math.ceil((cx + ox + hx + r + HALF) / step));
        const z0 = Math.max(0, Math.floor((cz + oz - hz - r + HALF) / step));
        const z1 = Math.min(n, Math.ceil((cz + oz + hz + r + HALF) / step));
        for (let z = z0; z <= z1; z++)
          for (let x = x0; x <= x1; x++) {
            const dx = Math.max(Math.abs(x * step - HALF - cx - ox) - hx, 0);
            const dz = Math.max(Math.abs(z * step - HALF - cz - oz) - hz, 0);
            const t = Math.min(Math.hypot(dx, dz) / r, 1);
            const w = 1 - t * t * (3 - 2 * t);
            const k = z * (n + 1) + x;
            if (w > mask[k]) mask[k] = w;
          }
      }
  };
  const seen = new Set<string>();
  for (let i = 0; i < houses.length; i += 3) {
    const x = houses[i], z = houses[i + 2];
    const key = `${Math.round(x / 3)},${Math.round(z / 3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    splat(x, z, 2, 2, MOUNTAIN.houseRadius);
  }
  for (const [cx, cz, hx, hz] of SETTLEMENTS_XZ) splat(cx, cz, hx, hz, MOUNTAIN.houseRadius);
  for (const [x, z] of ANCHORS_XZ) splat(x, z, 1.5, 1.5, MOUNTAIN.anchorRadius);
  return mask;
}

// ---------------------------------------------------------------------------------------------------------------
// Ridged super-tile field

/**
 * Normalised ridged field (0..~1) on the super-tile grid: `nx` x `nz` samples, periodic (4 x 6 tiles).
 * Sample (i, j) is at super-tile local x = i * step - 200, z = j * step - 200 (tile column 0, strip 0 at the origin).
 */
async function ridgedField(nx: number, nz: number, yieldEvery: () => Promise<void>) {
  const h = makeHash(7331);
  const w = makeHash(2027);
  const m = makeHash(911);
  const out = new Float32Array(nx * nz);
  // Cells per period for the base octave.
  const bx = MOUNTAIN_COLS * MOUNTAIN.ridgesPerTile;
  const bz = MOUNTAIN_STRIPS * MOUNTAIN.ridgesPerTile;
  const warpCells = TILE; // warp amplitude in super-tile units
  for (let j = 0; j < nz; j++) {
    if ((j & 15) === 0) await yieldEvery();
    const v = j / nz;
    for (let i = 0; i < nx; i++) {
      const u = i / nx;
      // Domain warp (two low octaves), periodic.
      const wx = pnoise(w, u * bx, v * bz, bx, bz) + 0.5 * pnoise(w, u * bx * 2 + 17, v * bz * 2, bx * 2, bz * 2);
      const wz = pnoise(w, u * bx + 41, v * bz + 9, bx, bz) + 0.5 * pnoise(w, u * bx * 2, v * bz * 2 + 23, bx * 2, bz * 2);
      const uu = u + (wx * MOUNTAIN.warp) / (warpCells * MOUNTAIN_COLS);
      const vv = v + (wz * MOUNTAIN.warp) / (warpCells * MOUNTAIN_STRIPS);
      // Ridged multifractal (Musgrave): offset 1, gain 2, lacunarity 2.
      let sum = 0;
      let weight = 1;
      let amp = 1;
      let norm = 0;
      for (let o = 0; o < MOUNTAIN.octaves; o++) {
        const f = 1 << o;
        const cx = bx * f;
        const cz = bz * f;
        const n = pnoise(h, uu * cx + o * 13.1, vv * cz + o * 7.7, cx, cz);
        let r = 1 - Math.abs(n);
        r *= r;
        r *= weight;
        weight = Math.min(Math.max(r * 2, 0), 1);
        sum += r * amp;
        norm += amp;
        amp *= 0.5;
      }
      // Massif modulation: some tiles are higher ranges than others (two cells across the super-tile in x).
      const massif = 0.55 + 0.6 * (0.5 + 0.5 * pnoise(m, u * 4, v * 6, 4, 6));
      out[j * nx + i] = (sum / norm) * massif;
    }
  }
  return out;
}

/**
 * Droplet hydraulic erosion on a periodic height grid (after S. Lague's Unity port of the classic particle model):
 * each droplet runs downhill with inertia, picks up sediment where it speeds up and drops it where it slows or
 * climbs. `cell` = grid spacing in local units (parameters are per cell). Mutates `map`.
 */
async function erode(map: Float32Array, nx: number, nz: number, droplets: number, cell: number, pause: () => Promise<void>) {
  const inertia = 0.05;
  const capacityK = 4;
  const minCapacity = 0.01;
  const depositK = 0.3;
  const erodeK = 0.3;
  const evaporate = 0.02;
  const gravity = 4;
  const maxSteps = 36;
  const radius = 2;
  // Height units per cell: the model expects slopes of order 0..1 per cell.
  const scale = 1 / cell;
  const inv = cell; // scale^-1
  // Brush as flat arrays (offsets and weights); the hot loop below allocates nothing (load-time pass, 2026-11-03).
  const bdx: number[] = [], bdz: number[] = [], bw: number[] = [];
  let wsum = 0;
  for (let dz = -radius; dz <= radius; dz++)
    for (let dx = -radius; dx <= radius; dx++) {
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      bdx.push(dx);
      bdz.push(dz);
      bw.push(radius - d);
      wsum += radius - d;
    }
  const bn = bw.length;
  const BW = Float32Array.from(bw, (w) => w / wsum);
  let seed = 1234567;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  // Positions stay wrapped into [0, nx) x [0, nz), so a neighbour index needs one compare, not a modulo.
  const wrapX = (x: number) => (x < 0 ? x + nx : x >= nx ? x - nx : x);
  const wrapZ = (z: number) => (z < 0 ? z + nz : z >= nz ? z - nz : z);
  let sh = 0, sgx = 0, sgz = 0; // results of sample()
  const sample = (x: number, z: number) => {
    const i = Math.floor(x), j = Math.floor(z);
    const u = x - i, v = z - j;
    const i1 = i + 1 === nx ? 0 : i + 1;
    const r0 = j * nx, r1 = (j + 1 === nz ? 0 : j + 1) * nx;
    const a = map[r0 + i] * scale, b = map[r0 + i1] * scale;
    const c = map[r1 + i] * scale, d = map[r1 + i1] * scale;
    sh = a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    sgx = (b - a) * (1 - v) + (d - c) * v;
    sgz = (c - a) * (1 - u) + (d - b) * u;
  };
  for (let n = 0; n < droplets; n++) {
    if ((n & 8191) === 0) await pause();
    let x = rnd() * nx, z = rnd() * nz;
    let dx = 0, dz = 0, speed = 1, water = 1, sediment = 0;
    for (let s = 0; s < maxSteps; s++) {
      const i = Math.floor(x), j = Math.floor(z);
      const u = x - i, v = z - j;
      sample(x, z);
      const h0 = sh;
      dx = dx * inertia - sgx * (1 - inertia);
      dz = dz * inertia - sgz * (1 - inertia);
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) break;
      dx /= len;
      dz /= len;
      const nxp = wrapX(x + dx), nzp = wrapZ(z + dz);
      sample(nxp, nzp);
      const dh = sh - h0;
      const capacity = Math.max(-dh * speed * water * capacityK, minCapacity);
      if (sediment > capacity || dh > 0) {
        const amount = dh > 0 ? Math.min(dh, sediment) : (sediment - capacity) * depositK;
        sediment -= amount;
        const a = amount * inv;
        const i1 = i + 1 === nx ? 0 : i + 1;
        const r0 = j * nx, r1 = (j + 1 === nz ? 0 : j + 1) * nx;
        map[r0 + i] += a * (1 - u) * (1 - v);
        map[r0 + i1] += a * u * (1 - v);
        map[r1 + i] += a * (1 - u) * v;
        map[r1 + i1] += a * u * v;
      } else {
        const amount = Math.min((capacity - sediment) * erodeK, -dh);
        const a = amount * inv;
        for (let k = 0; k < bn; k++) {
          let bi = i + bdx[k], bj = j + bdz[k];
          if (bi < 0) bi += nx;
          else if (bi >= nx) bi -= nx;
          if (bj < 0) bj += nz;
          else if (bj >= nz) bj -= nz;
          map[bj * nx + bi] -= a * BW[k];
        }
        sediment += amount;
      }
      speed = Math.sqrt(Math.max(0, speed * speed - dh * gravity));
      water *= 1 - evaporate;
      x = nxp;
      z = nzp;
    }
  }
}

function softCap(y: number) {
  const { capStart: a, capRange: r } = MOUNTAIN;
  return y <= a ? y : a + r * Math.tanh((y - a) / r);
}

/**
 * Compute the 24 slices from the Raven tile (`land`) and its house vertices: the vertex attributes of each slice plus
 * the shared UVs and index. `segments` per tile side (160 = 2.5 local spacing on desktop). Runs in the mountain
 * worker (`yieldNow` is then a no-op); inline it yields to the frame loop between chunks.
 */
export async function computeMountain(
  input: MountainInput,
  yieldNow: () => Promise<void> = async () => {},
): Promise<MountainResult> {
  const { land, houses, segments, wantStats } = input;
  const t0 = performance.now();
  let busy = 0; // CPU time spent here, excluding the yields
  let mark = t0;
  const pause = async () => {
    busy += performance.now() - mark;
    await yieldNow();
    mark = performance.now();
  };
  const n = segments;
  const step = TILE / n;
  const old = rasterHeights(land, n);
  const mask = villageMask(houses, n);
  await pause();

  const NX = MOUNTAIN_COLS * n;
  const NZ = MOUNTAIN_STRIPS * n;
  const ridge = await ridgedField(NX, NZ, pause);
  // Mountain field in local units, then hydraulic erosion (periodic) so slopes break into gullies and spurs.
  const field = new Float32Array(NX * NZ);
  for (let k = 0; k < field.length; k++) field[k] = MOUNTAIN.amplitude * (ridge[k] - MOUNTAIN.zero);
  await erode(field, NX, NZ, Math.round(NX * NZ * MOUNTAIN.erosionDensity), step, pause);

  // Global height grid (periodic NX x NZ): old relief and mask repeat every tile. M = the added mountain part, which
  // the material scales up away from the flight path (houses sit where M = 0, so they never float).
  const H = new Float32Array(NX * NZ);
  const M = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const k = (j % n) * (n + 1) + (i % n);
      const y = softCap(old[k] + field[j * NX + i] * (1 - mask[k]));
      H[j * NX + i] = y;
      M[j * NX + i] = y - old[k];
    }
  await pause();

  // Concavity / ambient occlusion from a periodic box blur (radius ~10 local units).
  const blur = new Float32Array(NX * NZ);
  const tmp = new Float32Array(NX * NZ);
  const R = Math.max(2, Math.round(10 / step));
  const wrapI = (i: number) => ((i % NX) + NX) % NX;
  const wrapJ = (j: number) => ((j % NZ) + NZ) % NZ;
  for (let j = 0; j < NZ; j++) {
    let acc = 0;
    for (let i = -R; i <= R; i++) acc += H[j * NX + wrapI(i)];
    for (let i = 0; i < NX; i++) {
      tmp[j * NX + i] = acc / (2 * R + 1);
      acc += H[j * NX + wrapI(i + R + 1)] - H[j * NX + wrapI(i - R)];
    }
  }
  for (let i = 0; i < NX; i++) {
    let acc = 0;
    for (let j = -R; j <= R; j++) acc += tmp[wrapJ(j) * NX + i];
    for (let j = 0; j < NZ; j++) {
      blur[j * NX + i] = acc / (2 * R + 1);
      acc += tmp[wrapJ(j + R + 1) * NX + i] - tmp[wrapJ(j - R) * NX + i];
    }
  }
  await pause();

  const at = (arr: Float32Array, i: number, j: number) => arr[wrapJ(j) * NX + wrapI(i)];

  // Cast shadows from the terrain sun: march toward it over the periodic grid (up to 260 local units: a 17 deg sun
  // throws a ridge's shadow ~3x its height), soft edge.
  const shadow = new Float32Array(NX * NZ);
  {
    const [sx, , sz] = TERRAIN_SUN_DIR;
    const dx = sx / Math.hypot(sx, sz);
    const dz = sz / Math.hypot(sx, sz);
    const rise = Math.tan(SUN_ELEVATION) * step; // per sample step along the ray
    const steps = Math.ceil(260 / step);
    // Ray offsets precomputed once (same rounding as before); wrap by compare, not modulo (~64M lookups).
    const oi = new Int32Array(steps + 1), oj = new Int32Array(steps + 1);
    for (let t = 1; t <= steps; t++) (oi[t] = Math.round(dx * t)), (oj[t] = Math.round(dz * t));
    for (let j = 0; j < NZ; j++) {
      if ((j & 31) === 0) await pause();
      for (let i = 0; i < NX; i++) {
        const h0 = H[j * NX + i];
        let occ = 0;
        for (let t = 1; t <= steps; t++) {
          let ii = (i + oi[t]) % NX, jj = (j + oj[t]) % NZ;
          if (ii < 0) ii += NX;
          if (jj < 0) jj += NZ;
          const over = H[jj * NX + ii] - (h0 + rise * t);
          if (over > occ) {
            occ = over;
            if (occ > 2.5) break;
          }
        }
        shadow[j * NX + i] = Math.min(occ / 2.5, 1);
      }
    }
  }

  // Debug readout (dev builds or `?probe=terrain`): height spread for tuning the snow/tree lines, build cost.
  let stats: Record<string, number> | undefined;
  if (wantStats) {
    let lo = Infinity,
      hi = -Infinity,
      sum = 0;
    const sorted = Float32Array.from(H).sort();
    for (let k = 0; k < H.length; k++) (lo = Math.min(lo, H[k])), (hi = Math.max(hi, H[k])), (sum += H[k]);
    stats = {
      min: lo,
      max: hi,
      mean: sum / H.length,
      p50: sorted[Math.floor(H.length * 0.5)],
      p90: sorted[Math.floor(H.length * 0.9)],
      p98: sorted[Math.floor(H.length * 0.98)],
      shadowed: shadow.reduce((a, v) => a + (v > 0.5 ? 1 : 0), 0) / shadow.length,
    };
  }

  // Shared topology and UVs (planar, same mapping as the source tile so the baked map lines up).
  const uvFit = planarUvFit(land);
  const vcount = (n + 1) * (n + 1);
  const uv = new Float32Array(vcount * 2);
  for (let b = 0; b <= n; b++)
    for (let a = 0; a <= n; a++) {
      const k = b * (n + 1) + a;
      uv[k * 2] = uvFit.u0 + uvFit.ux * (a * step - HALF);
      uv[k * 2 + 1] = uvFit.v0 + uvFit.vz * (b * step - HALF);
    }
  const index = new Uint32Array(n * n * 6);
  let o = 0;
  for (let b = 0; b < n; b++)
    for (let a = 0; a < n; a++) {
      const p = b * (n + 1) + a;
      const q = p + 1;
      const r = p + n + 1;
      index.set([p, r, q, q, r, r + 1], o);
      o += 6;
    }

  const slices: MountainSliceArrays[] = []; // index c * MOUNTAIN_STRIPS + s
  for (let c = 0; c < MOUNTAIN_COLS; c++) {
    for (let s = 0; s < MOUNTAIN_STRIPS; s++) {
      const position = new Float32Array(vcount * 3);
      const normal = new Float32Array(vcount * 3);
      const grad = new Float32Array(vcount * 4);
      const data = new Float32Array(vcount * 4);
      for (let b = 0; b <= n; b++)
        for (let a = 0; a <= n; a++) {
          const i = c * n + a;
          const j = s * n + b;
          const k = b * (n + 1) + a;
          const y = at(H, i, j);
          const gx = (at(H, i + 1, j) - at(H, i - 1, j)) / (2 * step);
          const gz = (at(H, i, j + 1) - at(H, i, j - 1)) / (2 * step);
          position[k * 3] = a * step - HALF;
          position[k * 3 + 1] = y;
          position[k * 3 + 2] = b * step - HALF;
          const inv = 1 / Math.hypot(gx, 1, gz);
          normal[k * 3] = -gx * inv;
          normal[k * 3 + 1] = inv;
          normal[k * 3 + 2] = -gz * inv;
          grad[k * 4] = gx;
          grad[k * 4 + 1] = gz;
          grad[k * 4 + 2] = (at(M, i + 1, j) - at(M, i - 1, j)) / (2 * step);
          grad[k * 4 + 3] = (at(M, i, j + 1) - at(M, i, j - 1)) / (2 * step);
          // x: concavity (+ = hollow, local units), y: village mask (keeps fields and terraces in the material),
          // z: mountain part of the height (scaled by the material's distance lift),
          // w: cast shadow from the terrain sun (1 = shadowed).
          data[k * 4] = at(blur, i, j) - y;
          data[k * 4 + 1] = mask[k];
          data[k * 4 + 2] = at(M, i, j);
          data[k * 4 + 3] = at(shadow, i, j);
        }
      slices.push({ position, normal, grad, data });
    }
    await pause();
  }
  busy += performance.now() - mark;
  if (stats) Object.assign(stats, { cpuMs: Math.round(busy), wallMs: Math.round(performance.now() - t0), segments: n });
  const detail = computeDetailMaps(512);
  return { detail, segments: n, uv, index, slices, stats };
}

/** Fit the source tile's planar UV mapping u = u0 + ux * x, v = v0 + vz * z (glTF convention). */
function planarUvFit(land: RawMesh) {
  const P = land.position;
  const uv = land.uv;
  let iMinX = 0, iMaxX = 0, iMinZ = 0, iMaxZ = 0;
  for (let i = 1; i < P.length / 3; i++) {
    if (P[i * 3] < P[iMinX * 3]) iMinX = i;
    if (P[i * 3] > P[iMaxX * 3]) iMaxX = i;
    if (P[i * 3 + 2] < P[iMinZ * 3 + 2]) iMinZ = i;
    if (P[i * 3 + 2] > P[iMaxZ * 3 + 2]) iMaxZ = i;
  }
  const ux = (uv[iMaxX * 2] - uv[iMinX * 2]) / (P[iMaxX * 3] - P[iMinX * 3]);
  const vz = (uv[iMaxZ * 2 + 1] - uv[iMinZ * 2 + 1]) / (P[iMaxZ * 3 + 2] - P[iMinZ * 3 + 2]);
  return { ux, u0: uv[iMinX * 2] - ux * P[iMinX * 3], vz, v0: uv[iMinZ * 2 + 1] - vz * P[iMinZ * 3 + 2] };
}

/**
 * Tileable 512^2 detail maps (256 read soft at the drone camera's distance; clarity pass 2026-11-03) (Everest site style: seeded procedural textures instead of downloads), generated once.
 * albedo: r = rock tone (strata + faint cells + fBm), g = heath/moss patches, b = snow wind ripples, a = soft blobs.
 * normal: rg = rock relief normal (strata ledges, joints), ba = micro relief normal (grit, tussocks); tangent-space
 * x/y encoded 0..1, applied triplanar in MountainMaterial (Everest: `_rkF`/`_rkB` rock and `_m1/_m2` micro normals).
 */
export function computeDetailMaps(S = 512) {
  const h = makeHash(4242);
  const albedo = new Uint8Array(S * S * 4);
  const rockH = new Float32Array(S * S);
  const microH = new Float32Array(S * S);
  const CELLS = 12;
  let seed = 99;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const fp = Array.from({ length: CELLS * CELLS }, () => [rnd(), rnd()]);
  const fbm = (u: number, v: number, base: number, oct: number, off: number) => {
    let sum = 0, a = 0.5, nrm = 0;
    for (let o = 0; o < oct; o++) {
      const c = base << o;
      sum += a * pnoise(h, u * c + off, v * c + off * 0.7, c, c);
      nrm += a;
      a *= 0.5;
    }
    return sum / nrm;
  };
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const gx = u * CELLS, gy = v * CELLS;
      const ix = Math.floor(gx), iy = Math.floor(gy);
      let d1 = 9, d2 = 9;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const cx = (ix + ox + CELLS) % CELLS, cy = (iy + oy + CELLS) % CELLS;
          const p = fp[cy * CELLS + cx];
          const dx = ix + ox + p[0] - gx, dy = iy + oy + p[1] - gy;
          const d = dx * dx + dy * dy;
          if (d < d1) (d2 = d1), (d1 = d);
          else if (d < d2) d2 = d;
        }
      const crack = Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) * 3.2);
      // Strata: layered noise stretched along u (the side projections map v to world height -> horizontal bands).
      let strata = 0, sa = 0.5, sn = 0;
      for (let o = 0; o < 4; o++) {
        const cu = 2 << o, cv = 8 << o;
        strata += sa * pnoise(h, u * cu + 5.3 * o, v * cv + 2.1 * o, cu, cv);
        sn += sa;
        sa *= 0.55;
      }
      strata = 0.5 + 0.5 * (strata / sn);
      const grain = 0.5 + 0.5 * fbm(u, v, 8, 3, 3.1);
      const rock = 0.62 * strata + 0.18 * (0.6 + 0.4 * Math.pow(crack, 0.5)) + 0.2 * grain;
      const heath = 0.5 + 0.5 * fbm(u, v, 3, 4, 11.3);
      const ripple = 0.5 + 0.5 * pnoise(h, u * 48 + 2 * fbm(u, v, 2, 2, 5.5), v * 6, 48, 6);
      const blob = 0.5 + 0.5 * fbm(u, v, 2, 3, 21.7);
      // Relief heights for the normal map: ledges (quantised strata) broken by joints; micro = fine grit.
      const ledge = Math.floor(strata * 7) / 7 + 0.35 * (strata * 7 - Math.floor(strata * 7)) / 7;
      rockH[y * S + x] = 0.7 * ledge + 0.2 * Math.pow(crack, 0.5) + 0.1 * grain;
      microH[y * S + x] = 0.6 * (0.5 + 0.5 * fbm(u, v, 16, 4, 31.9)) + 0.4 * (0.5 + 0.5 * fbm(u, v, 48, 2, 7.3));
      const k = (y * S + x) * 4;
      albedo[k] = Math.round(Math.min(1, Math.max(0, rock)) * 255);
      albedo[k + 1] = Math.round(Math.min(1, Math.max(0, heath)) * 255);
      albedo[k + 2] = Math.round(Math.min(1, Math.max(0, ripple)) * 255);
      albedo[k + 3] = Math.round(Math.min(1, Math.max(0, blob)) * 255);
    }
  const normal = new Uint8Array(S * S * 4);
  const enc = (v: number) => Math.round(Math.min(1, Math.max(0, v * 0.5 + 0.5)) * 255);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const xp = (x + 1) % S, xm = (x + S - 1) % S, yp = (y + 1) % S, ym = (y + S - 1) % S;
      // Slope scales are per texel: doubled for 512 (same relief as the 256 version), micro relief 1.25x crisper.
      const rx = (rockH[y * S + xp] - rockH[y * S + xm]) * 18;
      const ry = (rockH[yp * S + x] - rockH[ym * S + x]) * 18;
      const mx = (microH[y * S + xp] - microH[y * S + xm]) * 35;
      const my = (microH[yp * S + x] - microH[ym * S + x]) * 35;
      const ri = 1 / Math.hypot(rx, ry, 1);
      const mi = 1 / Math.hypot(mx, my, 1);
      const k = (y * S + x) * 4;
      normal[k] = enc(-rx * ri);
      normal[k + 1] = enc(-ry * ri);
      normal[k + 2] = enc(-mx * mi);
      normal[k + 3] = enc(-my * mi);
    }
  return { size: S, albedo, normal };
}
