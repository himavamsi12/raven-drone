"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import { RENDER_ORDER, resolution, SUN_DIRECTION } from "@/lib/constants";
import { damp, easeInOutCubic, remapEased } from "@/lib/math";
import { SCENE, scenes } from "@/lib/scenes";
import { useGLB } from "./types";

/** Yellow/red/cyan status power station (shipped class `e2` + component `e8`). */
function createPowerStationMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
varying vec3 vViewNormal;
varying vec2 vUv;
varying vec3 vModelPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;
void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    vViewNormal = normalMatrix * normal;
    vUv = uv;
    vModelPosition = position;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vViewPosition = -viewPosition.xyz;
    vNormal = normal;
}`,
    fragmentShader: /* glsl */ `
varying vec3 vViewNormal;
varying vec2 vUv;
varying vec3 vModelPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;
uniform vec2 uResolution;
uniform float uDpr;
uniform vec3 uColor;
uniform vec3 uRed;
uniform vec3 uBlue;
uniform float uRedMixer;
uniform float uBlueMixer;
uniform vec3 uSunDirection;
uniform float uAlpha;
uniform float uTime;
vec3 inverseTransformDirection(in vec3 dir, in mat4 matrix) {
    return normalize((vec4(dir, 0.0) * matrix).xyz);
}
void main() {
    float fresnel = pow(1.0 - dot(normalize(vViewPosition), normalize(vViewNormal)), 5.0);
    float scan = vModelPosition.z * 7.0;
    scan -= uTime * 4.0;
    scan = fract(scan);
    scan = smoothstep(0.45, 0.55, scan);
    scan = 1.0 - scan;
    float scanline = scan * 0.1;
    vec3 N = inverseTransformDirection(normalize(vViewNormal), viewMatrix);
    vec3 L = uSunDirection;
    float NdL = max(0.0, dot(N, L));
    vec3 col = mix(uColor, uRed, uRedMixer);
    col = mix(col, uBlue, uBlueMixer);
    vec3 color = col * (0.3 + 0.7 * NdL);
    color += fresnel * 2.;
    color -= scanline * 0.2;
    gl_FragColor = vec4(color, uAlpha);
}`,
    uniforms: {
      uResolution: { value: new THREE.Vector2() },
      uDpr: { value: 1 },
      uHideRatio: { value: 0 },
      uColor: { value: new THREE.Color("#FFCB47") },
      uRed: { value: new THREE.Color("#FF6666") },
      uBlue: { value: new THREE.Color("#7AEBFF") },
      uRedMixer: { value: 0 },
      uBlueMixer: { value: 0 },
      uAlpha: { value: 1 },
      uSunDirection: { value: SUN_DIRECTION },
      uTime: { value: 0 },
    },
    depthWrite: true,
    depthTest: true,
    toneMapped: false,
    transparent: true,
  });
}

export function PowerStation() {
  const { nodes } = useGLB(ASSETS.powerStation);
  const material = useMemo(createPowerStationMaterial, []);
  const red = useRef(0);
  const blue = useRef(0);
  useFrame(({ clock }, dt) => {
    const s = scenes();
    const support = s[SCENE.EXTRA_SUPPORT];
    const multi = s[SCENE.MULTI_THREAT_RESPONSE];
    material.uniforms.uResolution.value = resolution;
    material.uniforms.uTime.value = clock.getElapsedTime();
    red.current = damp(red.current, support.progress > 0.75 ? 1 : 0, 2, dt);
    blue.current = damp(blue.current, s[SCENE.ZONE_STABILIZED].progress > 0.99 ? 1 : 0, 2, dt);
    material.uniforms.uRedMixer.value = red.current;
    material.uniforms.uBlueMixer.value = blue.current;
    material.uniforms.uAlpha.value =
      multi.progress > 0
        ? remapEased(multi.progress, 0, 0.25, 1, 0, easeInOutCubic)
        : remapEased(support.progress, 0, 0.5, 0, 1, easeInOutCubic);
  });
  return (
    <group position={[4.81, 0.55, -0.56]} scale={0.14} rotation={[0, (Math.PI / 4) * 5, 0]}>
      <mesh geometry={nodes["e-plant"].geometry} renderOrder={RENDER_ORDER.POWER_STATION} material={material} />
    </group>
  );
}

useGLB.preload(ASSETS.powerStation);
