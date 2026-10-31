"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SKY_COLOR } from "@/lib/constants";
import { openingNow } from "@/lib/story-map";
import { sunlight } from "./sunlight";

/**
 * Raven opening sky (not in the shipped bundle). The shipped story never looks at the horizon, so the page only
 * clears to SKY_COLOR. The low opening shot does: a sky dome (SKY_COLOR at and below the horizon, deeper blue
 * overhead, sun glow, drifting high cloud) and two rings of far ridges fading into the same haze as the terrain fog.
 * Neither writes depth (the terrain lens treats them as sky). Both hide once the camera reaches the hero frame,
 * where they are out of frame anyway (the hero view tops out 23 deg below the horizon).
 */
const DOME_RADIUS = 300;
/** Ridge rings around the world origin: [radius, base Y, peak height, haze 0..1, seed]. */
const RIDGES: [number, number, number, number, number][] = [
  [130, -6, 15, 0.72, 1.7],
  [78, -4.5, 9, 0.52, 4.1],
];
const SEGMENTS = 384;

const domeVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const domeFragment = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uSun;
uniform float uTime;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 1.0, h), 0.6));
  float s = max(dot(d, uSun), 0.0);
  col += vec3(1.0, 0.93, 0.8) * (0.18 * pow(s, 6.0) + 0.5 * pow(s, 400.0)) * smoothstep(-0.02, 0.06, d.y);
  // High cloud on a plane above the camera; thins toward the horizon so it never draws a line there.
  vec2 uv = d.xz / max(d.y, 0.06) * 0.9 + vec2(uTime * 0.004, uTime * 0.0015);
  float c = smoothstep(0.52, 0.82, fbm(uv)) * smoothstep(0.03, 0.3, d.y);
  col = mix(col, mix(vec3(1.0), uHorizon, 0.25), 0.75 * c);
  gl_FragColor = vec4(col, 1.0);
}`;

const ridgeVertex = /* glsl */ `
attribute float aT;
varying float vT;
varying float vA;
void main() {
  vT = aT;
  vA = atan(position.x, position.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const ridgeFragment = /* glsl */ `
uniform vec3 uHaze;
uniform vec3 uRock;
uniform vec3 uLit;
uniform float uHazeAmount;
varying float vT;
varying float vA;
void main() {
  // Vertical streaks (gullies) and a lit upper band; aerial perspective thickens toward the base.
  float gully = 0.5 + 0.5 * sin(vA * 420.0 + 3.0 * sin(vA * 37.0)) * sin(vA * 173.0);
  vec3 col = mix(uRock, uLit, smoothstep(0.35, 1.0, vT) * (0.55 + 0.45 * gully));
  float haze = mix(1.0, uHazeAmount, smoothstep(0.0, 0.75, vT));
  gl_FragColor = vec4(mix(col, uHaze, haze), 1.0);
}`;

/** Ridge silhouette height (0..1) at angle a: integer harmonics keep the ring seamless. */
function ridge(a: number, seed: number) {
  let h = 0;
  let w = 0;
  for (const [k, amp] of [[3, 1], [5, 0.7], [8, 0.5], [13, 0.32], [21, 0.2], [34, 0.12], [55, 0.07]] as const) {
    h += amp * (1 - Math.abs(Math.sin(k * a * 0.5 + seed * k))); // ridged
    w += amp;
  }
  return Math.pow(h / w, 1.6);
}

function ridgeGeometry(radius: number, baseY: number, peak: number, seed: number) {
  const pos: number[] = [];
  const t: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const x = Math.sin(a) * radius;
    const z = Math.cos(a) * radius;
    pos.push(x, baseY, z, x, baseY + 1.5 + peak * ridge(a, seed), z);
    t.push(0, 1);
    if (i < SEGMENTS) {
      const j = 2 * i;
      index.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aT", new THREE.Float32BufferAttribute(t, 1));
  g.setIndex(index);
  return g;
}

export function OpeningSky() {
  const group = useRef<THREE.Group>(null);
  const dome = useRef<THREE.Mesh>(null);
  const [domeGeometry, domeMaterial] = useMemo(() => {
    const g = new THREE.SphereGeometry(DOME_RADIUS, 48, 24);
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uHorizon: { value: SKY_COLOR },
        uZenith: { value: new THREE.Color("#6f9fdc") },
        uSun: { value: new THREE.Vector3() },
        uTime: { value: 0 },
      },
      vertexShader: domeVertex,
      fragmentShader: domeFragment,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    return [g, m];
  }, []);
  const ridges = useMemo(
    () =>
      RIDGES.map(([radius, baseY, peak, haze, seed]) => ({
        geometry: ridgeGeometry(radius, baseY, peak, seed),
        material: new THREE.ShaderMaterial({
          uniforms: {
            uHaze: { value: SKY_COLOR },
            uRock: { value: new THREE.Color("#4d5e6e") },
            uLit: { value: new THREE.Color("#8d9a9c") },
            uHazeAmount: { value: haze },
          },
          vertexShader: ridgeVertex,
          fragmentShader: ridgeFragment,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      })),
    [],
  );

  useFrame((state) => {
    const on = openingNow() < 1;
    if (group.current) group.current.visible = on;
    if (!on || !dome.current) return;
    dome.current.position.copy(state.camera.getWorldPosition(dome.current.position));
    domeMaterial.uniforms.uSun.value.copy(sunlight.direction);
    domeMaterial.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  // Far ring first (painter's order), all before the terrain (render order 0 draws over them).
  return (
    <group ref={group}>
      <mesh ref={dome} geometry={domeGeometry} material={domeMaterial} renderOrder={-3} frustumCulled={false} />
      {ridges.map((r, i) => (
        <mesh key={i} geometry={r.geometry} material={r.material} renderOrder={-2 + i * 0.5} frustumCulled={false} />
      ))}
    </group>
  );
}
