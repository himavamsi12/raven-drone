import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TERRAIN_SCALE } from "@/lib/constants";
import { easeInOutCubic, remapEased } from "@/lib/math";
import { SCENE, type SceneData, type SceneId } from "@/lib/scenes";
import { CLIMB_SHARE } from "@/lib/story-map";

/**
 * Raven clay landscape (user, 2026-11-02), after the "net" section of `asset/html/raven_homepage.html` (inline
 * script 0): a grey clay relief with a draped dot grid and a cursor glow, seen from a low camera (its contour lines
 * were dropped at the user's request).
 * It replaces the shipped dark 2D map of band 2: while the map would show (the Phalanx scan has swept the screen),
 * the terrain tiles hide and `ClayTerrain` draws one dense mesh of the same Raven tiles instead.
 *
 * Care teams opens on the landscape view (user: "not this top-down view only ... directly show this view"): one
 * mountain raised out of our real relief around the village hill (its ridges are the tile's own), seen low. Over early Review the
 * camera hands back to the shipped track and the relief settles to the real tile heights, so the drones, overlays
 * and responders of the later chapters keep their shipped heights.
 *
 * Coordinates: "map" space = the terrain parent group in MainScene (world minus (0, -2.5, -8.6)). Heights are in
 * map units; "local" = tile-local glTF units (map / TERRAIN_SCALE). Values marked "ref" are the reference's.
 */
export const CLAY = {
  low: new THREE.Color("#262626"), // ref uLow
  high: new THREE.Color("#8e8e8e"), // ref uHigh
  ice: new THREE.Color("#e4e4e4"), // ref uIce
  bg: new THREE.Color("#0e0e0e"), // ref FOG
  house: new THREE.Color("#a9a9a9"),
  /** Light for the overhead views (screen up = +z, screen left = +x): upper left. */
  light: new THREE.Vector3(0.62, 0.48, 0.62).normalize(),
  /** Tile-local height band mapped low -> high (Raven relief is -7.7..17.3). */
  heightLow: -7,
  heightHigh: 20,
  /** Shading normal exaggeration for the flat map (the tiles' shader used 2x); 1 on the lifted landscape. */
  relief: 2.6,
  houseScale: 1.3,
  /** Draped dot grid, dots per map unit. */
  dotDensity: 3,
  /** Cursor glow radius (map units). */
  glow: 1.15,
  /** Radial fade to the background around the Care teams tile (map units): map view, landscape view. */
  fade: [7.5, 15, 8, 19],
} as const;

/** Distance between tile origins (Terrain `TILE_STEP`). */
export const TILE_STEP = 2 * TERRAIN_SCALE * 200 - 0.01;
/** Care teams tile origin in map space: tile row 3 after the thermal ramp (`terrainWrapped` = 16). */
export const CLAY_CENTRE = new THREE.Vector2(0, 3 * TILE_STEP - 2 * TERRAIN_SCALE * 200);

export const LANDSCAPE = {
  /** Mountain centre relative to the Care teams tile (map x/z); the camera looks toward +z. */
  offset: new THREE.Vector2(-0.5, 2.1),
  /** Mountain footprint: Gaussian radii (map x/z). Outside it the ground keeps its real (low) relief. */
  radius: new THREE.Vector2(5.5, 3.8),
  /**
   * The mountain is our own terrain (user, 2026-11-02: "just the landscape structure of the hill/mountain, not the
   * whole"): inside the footprint the real Raven relief is raised by `rise` and its (smoothed) hills and valleys
   * stretched `stretch` x about the tile rim (2.189 local), so its ridges are the tile's ridges. No noise, no texture.
   */
  rise: 2.4,
  stretch: 5.5,
  rim: 2.189,
  /** Village shelves: the stretch eases off around these map offsets (Care teams tile (0, -2) and (10, -60)). */
  shelves: [new THREE.Vector2(0, -0.08), new THREE.Vector2(0.4, -2.4)],
  shelfRadius: 1.3,
  /**
   * Lower village terrace (user, 2026-11-02: "put this village house a bit more higher altitude"): the foothill
   * village (Care teams tile cottages + cluster B) stands on a flat-topped rise partway up the mountain. Map offset,
   * radius and height (map units); profile exp(-r^4) keeps the top flat and the edges soft.
   */
  terrace: { centre: new THREE.Vector2(0.45, -2.45), radius: 1.9, height: 1.1 },
  /** Camera: elevation above the horizon, distance, aim height above the tile base (map units). */
  elevation: THREE.MathUtils.degToRad(12),
  distance: 28,
  aimHeight: 1.9,
  /**
   * Camera heading (radians). Fixed: the diagonal wipe reveals a capture taken at phalanx .5, so any drift after it
   * showed a second framing once the page settled (user, 2026-11-02: "extra frame when the diagonal cut transition is
   * coming"; was a -0.16 -> 0.04 drift over phalanx .5 -> 1).
   */
  yaw: 0.04,
  /** Light from the camera side and screen left (ref light (-0.55, .7, .35) for a camera looking -z). */
  light: new THREE.Vector3(0.55, 0.7, -0.4).normalize(),
  /** Hand-back to the shipped Review track: analysis progress range, after the climb (story-map CLIMB_SHARE). */
  handFrom: CLIMB_SHARE + 0.02,
  handTo: 0.75,
} as const;

/** Clay map shown: where the Phalanx scan has swept (same expression as the tiles' `uHideRatio` > .5). */
export function clayOn(s: Record<SceneId, SceneData>) {
  return remapEased(s[SCENE.PHALANX_AI].progress, 0, 0.5, 0, 1, easeInOutCubic) > 0.5;
}

/** 0..1 weight of the landscape view: on from the live Care teams map, off by mid-Review. */
export function landscapeWeight(s: Record<SceneId, SceneData>) {
  if (!clayOn(s)) return 0;
  return 1 - THREE.MathUtils.smootherstep(s[SCENE.ANALYSIS_EVALUATION].progress, LANDSCAPE.handFrom, LANDSCAPE.handTo);
}

/** Frame state shared with DroneRig / CoordinationDrones / PostFX / Terrain (written by ClayTerrain). */
export const clayState = { enabled: false, on: false, weight: 0, centreWorld: new THREE.Vector3() };

// ---------- heights ----------

/**
 * Tile-local height grid of the Raven land geometry (rasterised once), plus a smoothed copy (`smooth`): the mountain
 * stretches only the smoothed forms, so its tops stay rounded like our hills instead of turning the mesh's small
 * bumps and facets into spikes (user, 2026-11-02: "the tip of the hills looks very sharp").
 */
export type HeightField = { n: number; step: number; h: Float32Array; smooth: Float32Array };

/** Box blur radius (cells of 2 local units) and passes for `smooth`: ~Gaussian sigma 2.8 cells = 5.6 local units. */
const SMOOTH_RADIUS = 3;
const SMOOTH_PASSES = 2;

/** Separable periodic box blur (the tile repeats, so its edges wrap). */
function blurField(src: Float32Array, n: number) {
  const m = n - 1; // first and last rows/columns are the same rim samples
  let a = Float32Array.from(src);
  let b = new Float32Array(src.length);
  const w = 2 * SMOOTH_RADIUS + 1;
  for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
    for (let horizontal = 0; horizontal < 2; horizontal++) {
      for (let line = 0; line < n; line++) {
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (let k = -SMOOTH_RADIUS; k <= SMOOTH_RADIUS; k++) {
            const t = (((i + k) % m) + m) % m;
            sum += horizontal ? a[line * n + t] : a[t * n + line];
          }
          b[horizontal ? line * n + i : i * n + line] = sum / w;
        }
      }
      [a, b] = [b, a];
    }
  }
  return a;
}

export function heightField(geometry: THREE.BufferGeometry, n = 201): HeightField {
  const step = 400 / (n - 1);
  const h = new Float32Array(n * n).fill(2.189); // rim height where no triangle covers a sample
  const pos = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index ? index.count : pos.count;
  const v = (k: number) => (index ? index.getX(k) : k);
  for (let t = 0; t < count; t += 3) {
    const a = v(t);
    const b = v(t + 1);
    const c = v(t + 2);
    const ax = pos.getX(a), az = pos.getZ(a), bx = pos.getX(b), bz = pos.getZ(b), cx = pos.getX(c), cz = pos.getZ(c);
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-9) continue;
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) + 200) / step));
    const i1 = Math.min(n - 1, Math.floor((Math.max(ax, bx, cx) + 200) / step));
    const j0 = Math.max(0, Math.ceil((Math.min(az, bz, cz) + 200) / step));
    const j1 = Math.min(n - 1, Math.floor((Math.max(az, bz, cz) + 200) / step));
    for (let j = j0; j <= j1; j++) {
      const z = j * step - 200;
      for (let i = i0; i <= i1; i++) {
        const x = i * step - 200;
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        h[j * n + i] = l1 * pos.getY(a) + l2 * pos.getY(b) + l3 * pos.getY(c);
      }
    }
  }
  return { n, step, h, smooth: blurField(h, n) };
}

function sampleField({ n, step }: HeightField, h: Float32Array, x: number, z: number) {
  const fx = THREE.MathUtils.clamp((x + 200) / step, 0, n - 1.001);
  const fz = THREE.MathUtils.clamp((z + 200) / step, 0, n - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const w = fz - j;
  const k = j * n + i;
  return (h[k] * (1 - u) + h[k + 1] * u) * (1 - w) + (h[k + n] * (1 - u) + h[k + n + 1] * u) * w;
}

/** Wrap a map offset from a tile origin into one tile, in tile-local units. */
const toLocal = (d: number) => (d - TILE_STEP * Math.round(d / TILE_STEP)) / TERRAIN_SCALE;

/** Real Raven ground at map (x, z): every tile is the Raven tile (map units). */
export function baseHeight(field: HeightField, x: number, z: number) {
  return TERRAIN_SCALE * sampleField(field, field.h, toLocal(x - CLAY_CENTRE.x), toLocal(z - CLAY_CENTRE.y));
}

/**
 * Landscape-view height at map (x, z), given the real ground `base` there (map units): base + rise + the smoothed
 * relief stretched (fine detail stays at 1x) + the lower village terrace.
 */
export function liftedHeight(field: HeightField, base: number, x: number, z: number) {
  const dx = (x - CLAY_CENTRE.x - LANDSCAPE.offset.x) / LANDSCAPE.radius.x;
  const dz = (z - CLAY_CENTRE.y - LANDSCAPE.offset.y) / LANDSCAPE.radius.y;
  const f = Math.exp(-(dx * dx + dz * dz));
  const { terrace } = LANDSCAPE;
  const tx = (x - CLAY_CENTRE.x - terrace.centre.x) / terrace.radius;
  const tz = (z - CLAY_CENTRE.y - terrace.centre.y) / terrace.radius;
  const tr = tx * tx + tz * tz;
  const lift = terrace.height * Math.exp(-tr * tr);
  if (f < 1e-4) return base + lift;
  let shelf = 0;
  for (const s of LANDSCAPE.shelves) {
    const sx = (x - CLAY_CENTRE.x - s.x) / LANDSCAPE.shelfRadius;
    const sz = (z - CLAY_CENTRE.y - s.y) / LANDSCAPE.shelfRadius;
    shelf = Math.max(shelf, Math.exp(-(sx * sx + sz * sz)));
  }
  const rim = LANDSCAPE.rim * TERRAIN_SCALE;
  const smooth = TERRAIN_SCALE * sampleField(field, field.smooth, toLocal(x - CLAY_CENTRE.x), toLocal(z - CLAY_CENTRE.y));
  const stretch = (LANDSCAPE.stretch - 1) * f * (1 - 0.7 * shelf);
  return base + LANDSCAPE.rise * f + (smooth - rim) * stretch + lift;
}

/** Ground at map (x, z) for a landscape weight (CPU mirror of the clay mesh's vertex shader). */
export function clayHeight(field: HeightField, x: number, z: number, weight: number) {
  const base = baseHeight(field, x, z);
  return weight > 0 ? base + weight * (liftedHeight(field, base, x, z) - base) : base;
}

// ---------- shaders ----------

/** Shared uniform instances (ground + houses). Written by ClayTerrain each frame. */
export const clayUniforms = {
  uClayMouse: { value: new THREE.Vector3(9999, 0, 9999) },
  uClayMouseOn: { value: 0 },
  uClayCentre: { value: new THREE.Vector2(0, 0) },
  uClayLift: { value: 0 },
  uClayLow: { value: CLAY.low },
  uClayHigh: { value: CLAY.high },
  uClayIce: { value: CLAY.ice },
  uClayBg: { value: CLAY.bg },
  uClayLight: { value: CLAY.light.clone() },
};

const clayCommon = /* glsl */ `
uniform vec3 uClayMouse;
uniform float uClayMouseOn;
uniform vec2 uClayCentre;
uniform float uClayLift;
uniform vec3 uClayLow;
uniform vec3 uClayHigh;
uniform vec3 uClayIce;
uniform vec3 uClayBg;
uniform vec3 uClayLight;

float clayGlow(vec3 worldPos, float radius) {
    vec2 d = worldPos.xz - uClayMouse.xz;
    return exp(-dot(d, d) / (radius * radius)) * uClayMouseOn;
}

vec3 clayFade(vec3 col, vec3 worldPos) {
    float r = distance(worldPos.xz, uClayCentre);
    float a = mix(${CLAY.fade[0].toFixed(2)}, ${CLAY.fade[2].toFixed(2)}, uClayLift);
    float b = mix(${CLAY.fade[1].toFixed(2)}, ${CLAY.fade[3].toFixed(2)}, uClayLift);
    return mix(col, uClayBg, smoothstep(a, b, r));
}`;

/** Clay ground: lifted between the real (`position`) and landscape (`+ aLift`) heights, ref shading. */
export function createGroundMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...clayUniforms },
    vertexShader: /* glsl */ `
uniform float uClayLift;
attribute float aLift;
attribute vec3 aLiftNormal;
varying vec3 vW;
varying vec3 vN;
varying float vLocalY;
void main() {
    vec3 p = position;
    p.y += aLift * uClayLift;
    vec3 n = normalize(mix(normal, aLiftNormal, uClayLift));
    vec4 w = modelMatrix * vec4(p, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * n);
    vLocalY = p.y / ${TERRAIN_SCALE.toFixed(4)};
    gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
${clayCommon}
varying vec3 vW;
varying vec3 vN;
varying float vLocalY;


void main() {
    float k = mix(${CLAY.relief.toFixed(2)}, 1.0, uClayLift);
    vec3 n = normalize(vec3(vN.x * k, vN.y, vN.z * k));
    float diff = max(dot(n, uClayLight), 0.0);
    float slope = 1.0 - n.y;
    float h = vLocalY;
    vec3 base = mix(uClayLow, uClayHigh, smoothstep(${CLAY.heightLow.toFixed(1)}, ${CLAY.heightHigh.toFixed(1)} + 60.0 * uClayLift, h));
    base *= 0.78 + 0.22 * smoothstep(0.15, 0.6, slope);
    vec3 col = base * (0.16 + 0.9 * diff) + uClayIce * 0.015;

    // No contour lines (user, 2026-11-02: "this flows are not required"): the cursor glow lifts the clay and dots.
    float glow = clayGlow(vW, ${CLAY.glow.toFixed(2)});
    col += uClayIce * glow * 0.06;

    // ref: regular dot grid draped over the surface
    // round on screen: the offset to the nearest grid point measured in pixels per axis; fades out where the grid
    // gets denser than a few pixels (grazing views)
    vec2 g = vW.xz * ${CLAY.dotDensity.toFixed(1)};
    vec2 fw = max(fwidth(g), vec2(1e-4));
    float rpx = length((g - floor(g + 0.5)) / fw);
    float dotMask = (1.0 - smoothstep(0.8, 1.5, rpx)) * (1.0 - smoothstep(0.12, 0.3, max(fw.x, fw.y)));
    float dotGlow = clayGlow(vW, ${(CLAY.glow * 0.8).toFixed(2)});
    col = mix(col, mix(uClayIce * 0.75, uClayIce, dotGlow), dotMask * (0.42 + 0.58 * dotGlow) * 0.75);

    gl_FragColor = vec4(clayFade(col, vW), 1.0);
}`,
  });
}

/** One clay house in tile-local units: walls with a plinth below the ground, gable roof, ridge along x. */
export function createHouseGeometry() {
  const w = 4.2;
  const d = 3;
  const wall = 2.5;
  const ridge = 1.7;
  const over = 0.3;
  const base = -4; // plinth reaches into the stretched slopes
  const walls = new THREE.BoxGeometry(w, wall - base, d).translate(0, (wall + base) / 2, 0);
  const hw = w / 2 + over;
  const hd = d / 2 + over;
  const t = wall + ridge;
  // prettier-ignore
  const p = [
    -hw, wall, hd, hw, wall, hd, hw, t, 0,
    -hw, wall, hd, hw, t, 0, -hw, t, 0,
    hw, wall, -hd, -hw, wall, -hd, -hw, t, 0,
    hw, wall, -hd, -hw, t, 0, hw, t, 0,
    w / 2, wall, d / 2, w / 2, wall, -d / 2, w / 2, t - 0.1, 0,
    -w / 2, wall, -d / 2, -w / 2, wall, d / 2, -w / 2, t - 0.1, 0,
  ];
  const roof = new THREE.BufferGeometry();
  roof.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  roof.computeVertexNormals();
  const body = walls.toNonIndexed();
  body.deleteAttribute("uv"); // mergeGeometries needs identical attribute sets
  const merged = mergeGeometries([body, roof], false)!;
  walls.dispose();
  body.dispose();
  roof.dispose();
  return merged;
}

/** Instanced clay houses: lighter clay, same light, glow and fade as the ground. */
export function createHouseMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...clayUniforms, uHouse: { value: CLAY.house } },
    vertexShader: /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vec4 w = m * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(m) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
${clayCommon}
uniform vec3 uHouse;
varying vec3 vN;
varying vec3 vW;
void main() {
    vec3 n = normalize(vN);
    float diff = max(dot(n, uClayLight), 0.0);
    vec3 col = uHouse * (0.3 + 0.95 * diff);
    col = mix(col, uClayIce, clayGlow(vW, ${CLAY.glow.toFixed(2)}) * 0.25);
    gl_FragColor = vec4(clayFade(col, vW), 1.0);
}`,
  });
}

// ---------- village ----------

/**
 * Cottage centres of the Raven tile (`Houses` in raven-terrain.glb, tile-local x/z, measured from the decoded asset
 * in Blender); every tile carries them.
 */
// prettier-ignore
export const RAVEN_COTTAGES: readonly (readonly [number, number])[] = [
  [-57.2, -160.2], [-71.0, -120.3], [-2.1, 149.7], [94.3, 127.9], [90.4, 104.8], [100.9, 118.2], [97.5, 109.9],
  [94.1, 119.9], [-121.2, 75.7], [-124.8, 47.4], [-127.5, 67.0], [-117.1, 47.4], [-113.7, 55.9], [-119.9, 66.2],
  [-122.4, 56.8], [43.6, -81.0], [34.2, -53.0], [44.8, -66.1], [26.3, -61.8], [38.8, -57.8], [42.4, -74.3],
  [32.9, -81.4], [34.7, -63.2], [32.4, -73.6],
];

/**
 * Village of the Care teams tile (tile-local x/z, yaw, scale). The two analysis drones circle overlay points
 * (0, 0.25) and (0, 2.25) (CoordinationDrones PAIR) = tile (0, -1.75) and (0, -51.75): cluster A rings the first
 * (centre left open), cluster B runs from the second to the tile's own cottages. The clinic is the larger building.
 */
// prettier-ignore
export const VILLAGE: readonly (readonly [number, number, number, number])[] = [
  [-13, -5, 0.35, 1.15], [-9, 7, 1.85, 1.1], [12, -9, 0.2, 1.2], [15, 4, 1.95, 1.05], [5, 12, 0.5, 1.15],
  [-5, -15, 1.7, 1.1], [8, -18, 0.25, 1.0], [-18, 9, 1.4, 1.05], [-2, 9, 0.1, 1.8], [20, -14, 1.75, 1.0],
  [-11, -45, 0.4, 1.1], [-15, -58, 1.65, 1.15], [10, -43, 0.15, 1.05], [13, -61, 1.9, 1.1], [-4, -67, 0.6, 1.15],
  [19, -51, 1.5, 1.0], [-21, -50, 0.3, 1.05],
];

// ---------- camera ----------

const _aim = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Blend the camera mover (holding the shipped clip pose) toward the landscape pose by `clayState.weight`.
 * `aspect` widens the shot on narrow screens (ref: x1.25 below 1.4, x1.65
 * below 1).
 */
export function applyLandscapeCamera(mover: THREE.Object3D, aspect: number) {
  const w = clayState.weight;
  if (w <= 0) return;
  const c = clayState.centreWorld;
  const yaw = LANDSCAPE.yaw;
  const far = aspect < 1 ? 1.65 : aspect < 1.4 ? 1.25 : 1;
  const d = LANDSCAPE.distance * far;
  const cosE = Math.cos(LANDSCAPE.elevation);
  _aim.set(c.x + LANDSCAPE.offset.x, c.y + LANDSCAPE.aimHeight, c.z + LANDSCAPE.offset.y - 1);
  _eye.set(-Math.sin(yaw) * d * cosE, d * Math.sin(LANDSCAPE.elevation), -Math.cos(yaw) * d * cosE).add(_aim);
  _m.lookAt(_eye, _aim, UP);
  _q.setFromRotationMatrix(_m);
  mover.position.lerp(_eye, w);
  mover.quaternion.slerp(_q, w);
}
