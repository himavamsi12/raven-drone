"use client";

import { useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { RENDER_ORDER, TERRAIN_SCALE } from "@/lib/constants";
import { SCENE, scenes } from "@/lib/scenes";

const SIZE = 100 * TERRAIN_SCALE * 24;
const LAYERS = [{ height: -0.5 }, { height: -1 }];

const vertexShader = /* glsl */ `
varying vec3 vViewNormal;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;
void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    vViewNormal = normalMatrix * normal;
    vUv = uv;
    vPosition = position;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vViewPosition = -viewPosition.xyz;
    vNormal = normal;
}`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uCloudSpeed;
uniform float uCloudScale;
uniform float uCloudDensity;
uniform vec3 uSunPosition;
uniform vec3 uSkyColor;
uniform vec3 uCloudColor;
uniform float uOffset;
uniform float uFade;
uniform float uZoom;
uniform float uIndex;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 157.0 + 113.0 * p.z;
  return mix(
    mix(mix(hash(vec3(n + 0.0)), hash(vec3(n + 1.0)), f.x),
        mix(hash(vec3(n + 157.0)), hash(vec3(n + 158.0)), f.x), f.y),
    mix(mix(hash(vec3(n + 113.0)), hash(vec3(n + 114.0)), f.x),
        mix(hash(vec3(n + 270.0)), hash(vec3(n + 271.0)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float f = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 3; i++) {
    f += amplitude * noise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return f;
}

void main() {
  vec3 windDir = normalize(vec3(0., 1., 0.));
  vec3 pos = vPosition * uCloudScale * uZoom;
  pos -= windDir * (uTime + uOffset) * .4;
  pos.z += uTime * uCloudSpeed;
  float cloud = fbm(pos + uOffset);
  cloud = smoothstep(uCloudDensity - 0.2, uCloudDensity + 0.2, cloud);
  float depth = fbm(pos * 0.5 + vec3(0.0, (uTime + uOffset) * 0.02, 0.0));
  cloud *= depth;
  vec3 sunDir = normalize(uSunPosition);
  float lightDot = max(dot(vNormal, sunDir), 0.0);
  float lightIntensity = lightDot * 0.5 + 0.5;
  vec3 finalColor = mix(uSkyColor, uCloudColor, cloud);
  finalColor *= lightIntensity;
  float scatter = pow(1.0 - abs(vUv.y), 2.0) * 0.3;
  finalColor += scatter;
  float alpha = cloud * uFade;
  gl_FragColor = vec4(finalColor, alpha * 0.3 - uIndex * 0.01);
}`;

/** Low cloud layers that fade out with ignition-verified (shipped `g`). */
export const Clouds = memo(function Clouds() {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(SIZE, 1.25 * SIZE), []);
  const materials = useMemo(
    () =>
      LAYERS.map((_, i) => {
        const index = i + 3;
        const total = LAYERS.length + 3;
        return new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uCloudSpeed: { value: 0.0075 * index },
            uCloudScale: { value: 0.1 + 0.2 * index },
            uCloudDensity: { value: 0.1 + (total - index) * 0.25 },
            uCloudColor: { value: new THREE.Color(1, 1, 1) },
            uSunPosition: { value: new THREE.Vector3(1, 0.5, 0) },
            uSkyColor: { value: new THREE.Color(0.3, 0.6, 1) },
            uOffset: { value: 1000 * Math.random() },
            uFade: { value: 0 },
            uZoom: { value: 1 },
            uIndex: { value: index },
          },
          vertexShader,
          fragmentShader,
          transparent: true,
          // Raven: keep the depth buffer for the ground (terrain lens reads it); the layers are see-through.
          depthWrite: false,
        });
      }),
    [],
  );
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const ign = scenes()[SCENE.IGNITION_VERIFIED].progress;
    meshes.current.forEach((m, i) => {
      if (!m) return;
      materials[i].uniforms.uTime.value = 4.5 * t + i - LAYERS.length / 2;
      materials[i].uniforms.uFade.value = 1 - ign;
    });
  });
  return (
    <>
      {LAYERS.map((l, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          renderOrder={RENDER_ORDER.CLOUDS}
          position={[0, l.height, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={materials[i]}
          geometry={geometry}
        />
      ))}
    </>
  );
});
