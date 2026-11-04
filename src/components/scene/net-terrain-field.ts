/**
 * Network terrain field: a straight port of the `net` section's script in asset/html/raven_homepage (3).html ("Mapped
 * to the last ridge"; user 2026-11-03: "take this terrain directly"). Same deterministic gradient noise (seed 1337),
 * ridged/fbm stacks, height function H, plane size and resolution, dot grid, sites and route rule; only the units are
 * the section's own ("scene units ~ 50 m"), NetTerrain.tsx scales the whole thing into the stage. No three.js here:
 * it runs in net-terrain.worker.ts.
 */

const perm = new Uint8Array(512);
const grad: [number, number][] = [];
(() => {
  const p: number[] = [];
  let s = 1337;
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 16; i++) grad.push([Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)]);
})();

function noise(x: number, y: number) {
  let xi = Math.floor(x);
  let yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  xi &= 255;
  yi &= 255;
  const d = (ix: number, iy: number, dx: number, dy: number) => {
    const v = grad[perm[perm[ix] + iy] & 15];
    return v[0] * dx + v[1] * dy;
  };
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = d(xi, yi, xf, yf);
  const b = d(xi + 1, yi, xf - 1, yf);
  const c = d(xi, yi + 1, xf, yf - 1);
  const e = d(xi + 1, yi + 1, xf - 1, yf - 1);
  const ab = a + u * (b - a);
  const ce = c + u * (e - c);
  return (ab + v * (ce - ab)) * 1.41;
}

function ridged(x: number, y: number, o: number) {
  let t = 0;
  let amp = 0.5;
  let f = 1;
  let w = 1;
  for (let i = 0; i < o; i++) {
    let n = 1 - Math.abs(noise(x * f, y * f));
    n *= n * w;
    w = Math.min(1, n * 2);
    t += n * amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return t;
}

function fbm(x: number, y: number, o: number) {
  let t = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < o; i++) {
    t += amp * noise(x * f, y * f);
    amp *= 0.5;
    f *= 2.03;
  }
  return t;
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Terrain height (scene units ~ 50 m): a main massif, a second summit and ridged spurs (section `H`). */
export function netHeight(x: number, z: number) {
  const m1 = Math.exp(-(Math.pow((x + 8) / 80, 2) + Math.pow((z + 24) / 46, 2)));
  const m2 = Math.exp(-(Math.pow((x - 66) / 46, 2) + Math.pow((z + 62) / 36, 2)));
  const r = ridged(x * 0.017 + 3.1, z * 0.017 + 7.7, 7);
  const r2 = ridged(x * 0.045 + 11.3, z * 0.045 - 2.4, 4);
  let h =
    2 + 40 * m1 + 36 * m2 + 44 * r * (0.3 + 0.7 * Math.max(m1, m2)) + 7 * r2 * Math.max(m1, m2) + 2.4 * fbm(x * 0.06, z * 0.06, 3);
  h -= 12 * smooth(30, 110, z);
  return h + 5 * fbm(x * 0.012 + 40, z * 0.012, 4) * smooth(60, 160, z) + 3 * ridged(x * 0.02, z * 0.02 + 9, 4) * smooth(80, 200, z);
}

/** Plane size / segments and its offset toward the camera (section `SX, SZ, NX, NZ`, `translate(0, 0, 150)`). */
export const NET = { SX: 900, SZ: 700, NX: 520, NZ: 400, OZ: 150, DOT_STEP: 2.6 } as const;

/** Sites (section `SITES`): the depot is where the drone hovers; the clinic (the drone's route) and the summit station. */
export const NET_SITES = {
  depot: { x: -92, z: 22 },
  clinic: { x: -14, z: -22 },
  summit: { x: 66, z: -62 },
} as const;

export type NetField = {
  /** Heights of the (NX + 1) x (NZ + 1) plane grid, row-major from the far (-z) edge like PlaneGeometry after rotateX. */
  heights: Float32Array;
  /** Dot grid positions (xyz), 0.25 over the ground. */
  dots: Float32Array;
};

/** Heights for the plane grid and the dot grid (section build loop). */
export function computeNetField(): NetField {
  const { SX, SZ, NX, NZ, OZ, DOT_STEP } = NET;
  const heights = new Float32Array((NX + 1) * (NZ + 1));
  // PlaneGeometry(SX, SZ, NX, NZ) rotated -90 deg about x: row iy runs from z = -SZ/2 (far) to +SZ/2, then + OZ.
  for (let iy = 0; iy <= NZ; iy++) {
    const z = -SZ / 2 + (iy * SZ) / NZ + OZ;
    for (let ix = 0; ix <= NX; ix++) heights[iy * (NX + 1) + ix] = netHeight(-SX / 2 + (ix * SX) / NX, z);
  }
  const dots: number[] = [];
  for (let x = -SX / 2; x <= SX / 2; x += DOT_STEP)
    for (let z = -SZ / 2 + OZ; z <= SZ / 2 + OZ; z += DOT_STEP) dots.push(x, netHeight(x, z) + 0.25, z);
  return { heights, dots: new Float32Array(dots) };
}

/** Height over a site the drone arrives at and leaves from (section units): it hovers there, not on the ground. */
export const NET_SITE_HOVER = 3;

/**
 * Route from a start point (the drone over the depot, net units) to a site: the section's rule (lift 10 + 14 sin,
 * 6 over the highest ground within 3, eased into both ends), N + 1 points. Ends NET_SITE_HOVER over the site.
 */
export function netRoute(start: { x: number; y: number; z: number }, site: { x: number; z: number }, N = 90) {
  const sy = netHeight(site.x, site.z) + NET_SITE_HOVER;
  const pts: [number, number, number][] = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const x = start.x + (site.x - start.x) * t;
    const z = start.z + (site.z - start.z) * t;
    const lift = 10 + 14 * Math.sin(Math.PI * t);
    const ground = Math.max(netHeight(x, z), netHeight(x + 3, z), netHeight(x - 3, z), netHeight(x, z + 3), netHeight(x, z - 3));
    let y = Math.max(ground + 6, start.y + (sy - start.y) * t + lift);
    if (t < 0.06) y = start.y + (y - start.y) * (t / 0.06);
    if (t > 0.94) y = sy + (y - sy) * ((1 - t) / 0.06);
    pts.push([x, y, z]);
  }
  return pts;
}

/**
 * Leg 2 (user, 2026-11-03: first "very simple, not too many ups and downs, like the altitude pathway", then "the green
 * pathway feels old, try randomization, some curves"): a climb out of the clinic, a cruise and a descent into the
 * summit station, on an organic line; then "near to the terrain surface like the yellow pathway"). Sideways it
 * meanders (two long sine waves with seeded random phases, held to zero at both sites); in height it hugs the ground
 * `clear` above it, smoothed. Same seed, same
 * line on every load (the HUD distance stays fixed). N + 1 points.
 */
export const NET_LEG2_SEED = 7;
export function netArcRoute(a: { x: number; z: number }, b: { x: number; z: number }, clear = 6, N = 160) {
  let h = NET_LEG2_SEED;
  const rand = () => (h = (h * 16807) % 2147483647) / 2147483647;
  const ph1 = rand() * Math.PI * 2;
  const ph2 = rand() * Math.PI * 2;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const px = -dz / len; // sideways (horizontal normal)
  const pz = dx / len;
  const ya = netHeight(a.x, a.z) + NET_SITE_HOVER;
  const yb = netHeight(b.x, b.z) + NET_SITE_HOVER;
  const ease = (e0: number, e1: number, x: number) => {
    const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return t * t * t * (t * (6 * t - 15) + 10);
  };
  // Sideways meander (section units): ~12% of the leg at most, zero at both ends.
  const side = (t: number) =>
    len * 0.12 * Math.sin(Math.PI * t) * (0.65 * Math.sin(Math.PI * 2 * 1.1 * t + ph1) + 0.35 * Math.sin(Math.PI * 2 * 2.3 * t + ph2));
  const at = (t: number) => {
    const o = side(t);
    return [a.x + dx * t + px * o, a.z + dz * t + pz * o] as const;
  };
  const ground = (t: number) => {
    const [x, z] = at(t);
    return Math.max(netHeight(x, z), netHeight(x + 3, z), netHeight(x - 3, z), netHeight(x, z + 3), netHeight(x, z - 3));
  };
  // Height (user: "make the green pathway near to the terrain surface, like the yellow pathway"): `clear` over the
  // highest ground within 3 of the meandering line, like the section's routes, smoothed so it flows over the ridges
  // (never under 2 above the ground), eased from / to the hover points over the sites.
  const floor: number[] = [];
  for (let k = 0; k <= N; k++) floor.push(ground(k / N));
  let ys = floor.map((g) => g + clear);
  for (let pass = 0; pass < 24; pass++) {
    const sm = ys.slice();
    for (let k = 1; k < N; k++) sm[k] = Math.max((ys[k - 1] + 2 * ys[k] + ys[k + 1]) / 4, floor[k] + 2);
    ys = sm;
  }
  const pts: [number, number, number][] = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const [x, z] = at(t);
    let y = ys[k];
    y = ya + (y - ya) * ease(0, 0.08, t); // lift off the clinic
    y = yb + (y - yb) * ease(1, 0.92, t); // settle onto the summit station
    pts.push([x, y, z]);
  }
  return pts;
}
