"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { SKY_COLOR } from "@/lib/constants";
import { makeHash, pnoise } from "./mountain-field";
import { TERRAIN_SUN } from "./mountain-terrain";

/**
 * Far mountain ranges for the mountain terrain's opening shot (`?terrain=mountain`; user 2026-11-03: "fix this far
 * away mountain ranges as well", after the Everest site's high-country frame). They replace OpeningSky's two flat
 * ridge-silhouette rings and the Blender land panorama, which read as smooth blue cut-outs next to the eroded,
 * snow-shaded near terrain.
 *
 * A real 3D band of relief around the world origin (radius 55..200, beyond the opening tiles at ~48), so ranges
 * overlap, catch the light and cast form like the near ground:
 * - height: domain-warped ridged multifractal (6 octaves) under an envelope that rises with distance (foothills near,
 *   the big snow massifs far) and drops back to the base at the outer edge, so the band never ends in a wall;
 * - per vertex: snow (above a distance-dependent snowline, on gentler faces, streaking down steep ones) and rock tone;
 * - fragment: the terrain sun (TERRAIN_SUN), cool sky fill, blue-grey shaded snow, then aerial perspective: haze
 *   thickens with distance and fills the valleys (base fog), toward the sky's horizon colour.
 * Writes depth so the ranges occlude each other; drawn before the terrain (the tiles stay in front). Lives inside
 * OpeningSky's group, so it hides with it once the camera reaches the hero frame.
 */
const R0 = 55;
const R1 = 200;
const RADIAL = 64;
const ANGULAR = 900;
const BASE_Y = -8;

const vertex = /* glsl */ `
attribute float aSnow;
attribute float aTone;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vSnow;
varying float vTone;
void main() {
  vSnow = aSnow;
  vTone = aTone;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const fragment = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uHaze;
uniform vec3 uRockDark;
uniform vec3 uRockLight;
uniform vec3 uSnow;
uniform vec3 uSnowShade;
uniform float uBaseY;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vSnow;
varying float vTone;
void main() {
  vec3 n = normalize(vNormalW);
  float sun = clamp(dot(n, uSun), 0.0, 1.0);
  vec3 rock = mix(uRockDark, uRockLight, vTone);
  vec3 snow = mix(uSnowShade, uSnow, smoothstep(0.0, 0.55, sun));
  vec3 alb = mix(rock, snow, vSnow);
  // Same raking light as the near terrain: warm sun, low cool fill.
  vec3 sky = vec3(0.48, 0.56, 0.74) * (0.24 + 0.2 * clamp(n.y, 0.0, 1.0));
  vec3 col = alb * (vec3(1.0, 0.9, 0.74) * sun * 2.2 + sky);
  col = mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, 0.8);
  // Aerial perspective toward the horizon colour, plus valley haze low in the band.
  float d = length(vWorld - cameraPosition);
  float haze = 0.12 + 0.88 * (1.0 - exp(-d / 230.0));
  // Valley haze: a long soft ramp (a short one drew a straight band along the ranges' foot).
  // It reaches up to where the farthest opening tiles' fogged skyline sits (their fog ends at the same sky colour),
  // so that jagged edge melts into haze instead of standing out against the darker foot of the ranges.
  float valley = 1.0 - smoothstep(uBaseY + 4.0, uBaseY + 30.0, vWorld.y);
  haze = max(haze, valley * valley * (3.0 - 2.0 * valley));
  gl_FragColor = vec4(mix(col, uHaze, clamp(haze, 0.0, 1.0)), 1.0);
}`;

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

function buildRanges() {
  const h = makeHash(5150);
  const w = makeHash(6061);
  const P = 4096; // periods large enough to be non-repeating over the band
  const noise = (hash: typeof h, x: number, z: number) => pnoise(hash, x, z, P, P);
  const ridged = (x: number, z: number) => {
    let sum = 0, weight = 1, amp = 1, norm = 0;
    for (let o = 0; o < 6; o++) {
      const f = 1 << o;
      let r = 1 - Math.abs(noise(h, x * f + o * 31.7, z * f + o * 17.3));
      r *= r;
      r *= weight;
      weight = Math.min(Math.max(r * 2, 0), 1);
      sum += r * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
  const nv = RADIAL + 1;
  const count = ANGULAR * nv;
  const position = new Float32Array(count * 3);
  const snowLine = new Float32Array(count);
  const tone = new Float32Array(count);
  for (let a = 0; a < ANGULAR; a++) {
    const ang = (a / ANGULAR) * Math.PI * 2;
    const sx = Math.sin(ang), cz = Math.cos(ang);
    for (let r = 0; r < nv; r++) {
      const t = r / RADIAL;
      const radius = R0 + (R1 - R0) * t;
      const x = sx * radius, z = cz * radius;
      // Envelope: foothills near, high massifs far, back down at the outer edge.
      // Calm foothills near (grazing view: high frequencies alias into a comb), broad massifs far.
      const env =
        smoothstep(R0, R0 + 30, radius) * (3 + 36 * smoothstep(85, 180, radius)) * (1 - smoothstep(R1 - 24, R1, radius));
      const m = 0.5 + 0.5 * noise(w, x / 120, z / 120);
      const massif = 0.25 + 1.1 * m * m;
      const fx = x / 80 + 1.2 * noise(w, x / 150 + 5, z / 150);
      const fz = z / 80 + 1.2 * noise(w, x / 150, z / 150 + 9);
      const y = BASE_Y + env * massif * Math.pow(ridged(fx, fz), 1.5);
      const k = a * nv + r;
      position.set([x, y, z], k * 3);
      snowLine[k] = BASE_Y + 7 + 7 * smoothstep(80, 180, radius) + 3 * noise(h, x / 14, z / 14);
      tone[k] = 0.5 + 0.5 * noise(w, x / 6, z / 6);
    }
  }
  // Angular index wraps to column 0, so the normals are continuous all the way round.
  const index: number[] = [];
  for (let a = 0; a < ANGULAR; a++) {
    const a2 = (a + 1) % ANGULAR;
    for (let r = 0; r < RADIAL; r++) {
      const p = a * nv + r, q = a2 * nv + r;
      index.push(p, q, p + 1, p + 1, q, q + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  const normal = g.attributes.normal as THREE.BufferAttribute;
  const snow = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const y = position[k * 3 + 1];
    const up = normal.getY(k);
    const flat = smoothstep(0.45, 0.72, up);
    // Steep faces keep streaks of snow in their gullies (angular hash bands, broken by the tone noise).
    const steep = (1 - flat) * smoothstep(0.55, 0.85, tone[k]) * 0.75;
    snow[k] = smoothstep(snowLine[k] - 1.5, snowLine[k] + 1.5, y) * Math.max(flat, steep);
  }
  g.setAttribute("aSnow", new THREE.BufferAttribute(snow, 1));
  g.setAttribute("aTone", new THREE.BufferAttribute(tone, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R1 + 60);
  return g;
}

export function MountainRanges() {
  const [geometry, material] = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uSun: { value: TERRAIN_SUN.clone() },
        uHaze: { value: SKY_COLOR },
        uRockDark: { value: new THREE.Color("#4a4846") },
        uRockLight: { value: new THREE.Color("#8e8982") },
        uSnow: { value: new THREE.Color("#f1f4f8") },
        uSnowShade: { value: new THREE.Color("#8d9db3") },
        uBaseY: { value: BASE_Y },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      depthWrite: true,
      depthTest: true,
    });
    return [buildRanges(), m] as const;
  }, []);
  return <mesh geometry={geometry} material={material} renderOrder={-2} frustumCulled={false} />;
}
