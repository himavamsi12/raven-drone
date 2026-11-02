"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { RENDER_ORDER, terrainOffset } from "@/lib/constants";
import { SCENE, scenes } from "@/lib/scenes";

/**
 * Low cloud wisps between the drone and the ground (Raven, user 2026-11-02): thin, broken, streaky stratus that
 * scrolls with the terrain (same travel, plus a slow wind) so it has natural parallax. When a wisp passes under the
 * dark drone the silhouette reads against white. Only in the overhead shots: fades in as the camera looks straight
 * down (Airframe, Connection ...), off in the hero/opening, from the Care teams map on and after ignition.
 */
const HEIGHT = -1.25; // drones fly near y 0, the ground is at about -2.4
const SIZE = 60;

const vertexShader = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uTravel;
uniform float uStrength;
varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

void main() {
  // World-fixed like the ground (content at z + travel), streaks stretched across the flight line, slow wind in x.
  vec2 p = vec2(vWorld.x, vWorld.z + uTravel);
  vec2 q = vec2(p.x * 0.2 + uTime * 0.015, p.y * 0.55);
  float n = fbm(q);
  float d = fbm(q * 3.1 + 7.3);
  float cover = smoothstep(0.5, 0.7, 0.75 * n + 0.25 * d); // broken: roughly a quarter of the sky
  // Fade with distance from the camera so the layer never reads as a sheet toward the horizon.
  float fade = 1.0 - smoothstep(8.0, 18.0, length(vWorld - cameraPosition));
  vec3 col = mix(vec3(0.78, 0.83, 0.89), vec3(0.97, 0.98, 0.99), smoothstep(0.45, 0.8, d));
  gl_FragColor = vec4(col, cover * fade * uStrength * 0.6);
}`;

const _dir = new THREE.Vector3();

export function CloudWisps() {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uTravel: { value: 0 }, uStrength: { value: 0 } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false, // the terrain lens reads the ground's depth
      }),
    [],
  );

  useFrame(({ camera, clock }) => {
    const m = mesh.current;
    if (!m) return;
    const state = scenes();
    camera.getWorldDirection(_dir);
    const overhead = THREE.MathUtils.smoothstep(-_dir.y, 0.6, 0.85); // hero looks 33 deg down: off
    const notMap = 1 - THREE.MathUtils.smoothstep(state[SCENE.PHALANX_AI].progress, 0, 0.02);
    const notIgnited = 1 - state[SCENE.IGNITION_VERIFIED].progress;
    const strength = overhead * notMap * notIgnited;
    m.visible = strength > 0.001;
    if (!m.visible) return;
    m.position.set(camera.position.x, HEIGHT, camera.position.z);
    material.uniforms.uStrength.value = strength;
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uTravel.value = terrainOffset.current ?? 0;
  });

  return (
    <mesh ref={mesh} renderOrder={RENDER_ORDER.CLOUDS} rotation={[-Math.PI / 2, 0, 0]} material={material} frustumCulled={false}>
      <planeGeometry args={[SIZE, SIZE]} />
    </mesh>
  );
}
