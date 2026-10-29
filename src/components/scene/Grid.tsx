"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import { RENDER_ORDER, TERRAIN_SCALE, terrainOffset } from "@/lib/constants";
import { easeInOutCubic, remapEased } from "@/lib/math";
import { SCENE, scenes } from "@/lib/scenes";
import { computeScreenUv, gridFunctions } from "./shaders/screen-uv";
import { useGLB } from "./types";

const TILE = 2 * TERRAIN_SCALE * 200;

function createGridMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec2 vUv;
void main() {
    vUv = uv;
    vPosition = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
}`,
    fragmentShader: /* glsl */ `
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uDpr;
uniform float uHideRatio;
uniform float uGridDensity;
uniform float uOffsetZ;
uniform float uDotSize;
uniform float uDotOpacity;
uniform float uLateralFade;

${computeScreenUv}
${gridFunctions}

float getDot(in vec2 gridUV, float size) {
    vec2 rounded = round(gridUV);
    vec2 distToIntersection = abs(gridUV - rounded);
    float dist = length(distToIntersection);
    vec2 ddx = dFdx(gridUV);
    vec2 ddy = dFdy(gridUV);
    vec2 uvDeriv = vec2(length(vec2(ddx.x, ddy.x)), length(vec2(ddx.y, ddy.y)));
    float maxDeriv = max(uvDeriv.x, uvDeriv.y);
    float dotAA = max(maxDeriv * 2.0, 0.01);
    return 1.0 - smoothstep(size - dotAA, size + dotAA, dist);
}

float computeFadeMultiplier(vec2 n) {
    float leftFade = smoothstep(0.0, uLateralFade, n.x);
    float rightFade = 1.0 - smoothstep(1.0 - uLateralFade, 1.0, n.x);
    float aspect = uResolution.y / uResolution.x;
    float vFade = uLateralFade / aspect;
    float bottomFade = smoothstep(0.0, vFade, n.y);
    float topFade = 1.0 - smoothstep(1.0 - vFade, 1.0, n.y);
    return min(min(leftFade, rightFade), min(topFade, bottomFade));
}

vec3 applyBorderHighlight(vec3 color, vec2 screenUv, float fadeMultiplier) {
    float border = 1.0 / uResolution.x;
    if (screenUv.x < uHideRatio + border && screenUv.x > uHideRatio - border) {
        color += vec3(0.1) * fadeMultiplier;
    }
    return color;
}

void main() {
    if (uHideRatio <= 0.001) discard;
    vec2 screenUv = computeScreenUv();
    float scanr = screenUv.x < uHideRatio ? 1.0 : 0.0;
    if (scanr < 0.5) discard;
    vec2 screenUvNormalized = gl_FragCoord.xy / uResolution;
    float fadeMultiplier = computeFadeMultiplier(screenUvNormalized);
    vec2 gridUV = uGridDensity * vec2(vWorldPosition.x, vWorldPosition.z + uOffsetZ);
    float lineWidth = mix(0.001, 0.05, scanr);
    vec2 grid2 = getGrid(gridUV, vec2(lineWidth));
    float grid = max(grid2.x, grid2.y);
    float dot = getDot(gridUV, uDotSize) * uDotOpacity;
    vec3 color = vec3(1.0) * grid * fadeMultiplier + vec3(1.0) * dot * fadeMultiplier;
    color = applyBorderHighlight(color, screenUv, fadeMultiplier);
    float alpha = max(color.r * 0.01, dot * 0.8 * fadeMultiplier);
    color = vec3(fadeMultiplier);
    gl_FragColor = vec4(color, alpha);
}`,
    transparent: true,
    uniforms: {
      uResolution: { value: new THREE.Vector2() },
      uDpr: { value: 1 },
      uHideRatio: { value: 0 },
      uGridDensity: { value: 4 },
      uOffsetZ: { value: 0 },
      uDotSize: { value: 0.05 },
      uDotOpacity: { value: 0.1 },
      uLateralFade: { value: 0.025 },
    },
  });
}

type GridProps = {
  forceActive?: boolean;
  position?: [number, number, number];
  scale?: number;
  isCity?: boolean;
};

/** Tactical dot grid revealed by the Phalanx scan (shipped `et`). */
export function TacticalGrid({ forceActive, position = [0, 0, 0], scale = 1, isCity = false }: GridProps) {
  const grid = useGLB(ASSETS.grid);
  const gridCity = useGLB(ASSETS.gridCity);
  const geometry = (isCity ? gridCity : grid).nodes.Plane?.geometry;
  const { size, viewport } = useThree();
  const mesh = useRef<THREE.Mesh>(null);
  const [material] = useState(createGridMaterial);

  useEffect(() => {
    if (!mesh.current) return;
    mesh.current.scale.setScalar(TERRAIN_SCALE);
    mesh.current.position.set(position[0], 1.2, position[2]);
  }, [position]);

  useFrame(() => {
    const ph = scenes()[SCENE.PHALANX_AI].progress;
    const ratio = forceActive ? 1 : remapEased(ph, 0, 0.5, 0, 1, easeInOutCubic);
    material.uniforms.uResolution.value.set(size.width * viewport.dpr, size.height * viewport.dpr);
    material.uniforms.uDpr.value = viewport.dpr;
    material.uniforms.uHideRatio.value = ratio;
    material.uniforms.uGridDensity.value = 3;
    // Shipped expression `(RW && !force) || 0` evaluates to a boolean; kept as 1/0.
    material.uniforms.uOffsetZ.value = terrainOffset.current && !forceActive ? 1 : 0;
  });

  if (!geometry) return null;
  return (
    <group scale={scale} rotation={[0, isCity ? Math.PI : 0, 0]}>
      <mesh ref={mesh} frustumCulled={false} renderOrder={RENDER_ORDER.TERRAIN + 1} geometry={geometry} material={material} />
    </group>
  );
}

/** Three grids that appear once ignition is verified (shipped `en`). */
export function GridRow({ offset = 0, isCity = false }: { offset?: number; isCity?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = scenes()[SCENE.IGNITION_VERIFIED].progress > 0.99;
  });
  return (
    <group ref={ref} position={[0, 0, offset]}>
      <TacticalGrid isCity={isCity} />
      <TacticalGrid position={[TILE, 0, 0]} isCity={isCity} />
      <TacticalGrid position={[-TILE, 0, 0]} isCity={isCity} />
    </group>
  );
}

useGLB.preload(ASSETS.grid);
useGLB.preload(ASSETS.gridCity);
