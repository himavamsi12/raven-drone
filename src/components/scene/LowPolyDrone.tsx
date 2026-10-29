"use client";

import { Outlines } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { ASSETS } from "@/lib/assets";
import { useGLB } from "./types";

/** Scanline material for the low-poly tactical drones (shipped class `ec`). */
export class ScanlineMaterial extends THREE.ShaderMaterial {
  constructor(color: THREE.Color) {
    super({
      vertexShader: /* glsl */ `
varying vec3 vViewNormal;
varying vec2 vUv;
varying vec3 vModelPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;
void main() {
    vec3 pos = position;
    vec3 transformedNormal = normal;
    #ifdef USE_INSTANCING
      mat4 instanceModelMatrix = instanceMatrix;
      pos = (instanceModelMatrix * vec4(pos, 1.0)).xyz;
      transformedNormal = mat3(instanceModelMatrix) * normal;
    #endif
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #ifdef USE_INSTANCING
      vViewNormal = normalMatrix * mat3(instanceModelMatrix) * normal;
      vWorldPosition = (modelMatrix * instanceModelMatrix * vec4(position, 1.0)).xyz;
    #else
      vViewNormal = normalMatrix * normal;
      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
    #endif
    vUv = uv;
    vModelPosition = position;
    vViewPosition = -mvPosition.xyz;
    vNormal = transformedNormal;
}`,
      fragmentShader: /* glsl */ `
varying vec3 vViewNormal;
varying vec2 vUv;
varying vec3 vModelPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;
uniform vec3 uColor;
uniform float uTime;
void main() {
    float scan = vModelPosition.z * 7.0;
    scan -= uTime * 8.0;
    scan = fract(scan);
    scan = smoothstep(0.45, 0.55, scan);
    scan = 1.0 - scan;
    float scanline = scan * 0.15;
    vec3 center = vec3(0., 0., -1.);
    float dist = distance(vModelPosition, center) * 0.8;
    vec3 finalColor = uColor - scanline;
    finalColor += dist * 0.45;
    gl_FragColor = vec4(finalColor, 1.);
}`,
      uniforms: { uColor: { value: color }, uTime: { value: 0 } },
    });
  }
  setTime(t: number) {
    this.uniforms.uTime.value = t;
  }
}

/** Low-poly Raven silhouette with white screen-space outline (shipped `eu`; mesh swapped from the delta jet). */
export function LowPolyDrone() {
  const { nodes } = useGLB(ASSETS.droneLowpoly);
  const material = useMemo(() => new ScanlineMaterial(new THREE.Color("#8a8a8a")), []);
  useFrame(({ clock }) => material.setTime(clock.getElapsedTime()));
  return (
    <group dispose={null}>
      <mesh geometry={nodes.mainBody.geometry} material={material} rotation={[0, 0, Math.PI]}>
        <Outlines screenspace angle={Math.PI} polygonOffset polygonOffsetFactor={24} color="white" thickness={0.075} />
      </mesh>
    </group>
  );
}

/**
 * Fading fat-line trail with per-vertex colors (shipped module 52644). Points are
 * shared Vector3 instances mutated by the owner every frame.
 */
export function Trail({
  points,
  colors,
  lineWidth,
  renderOrder,
}: {
  points: THREE.Vector3[];
  colors: THREE.Color[];
  lineWidth: number;
  renderOrder?: number;
}) {
  const size = useThree((s) => s.size);
  const { line, geometry, material, buffer } = useMemo(() => {
    const geometry = new LineGeometry();
    const buffer = new Float32Array(points.length * 3);
    geometry.setPositions(buffer);
    geometry.setColors(colors.flatMap((c) => c.toArray()));
    const material = new LineMaterial({ color: 0xffffff, linewidth: lineWidth, vertexColors: true, worldUnits: false });
    const line = new Line2(geometry, material);
    line.frustumCulled = false;
    return { line, geometry, material, buffer };
  }, [points, colors, lineWidth]);
  useEffect(() => {
    material.resolution.set(size.width, size.height);
  }, [material, size]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(() => {
    for (let i = 0; i < points.length; i++) {
      buffer[3 * i] = points[i].x;
      buffer[3 * i + 1] = points[i].y;
      buffer[3 * i + 2] = points[i].z;
    }
    geometry.setPositions(buffer);
  });
  return <primitive object={line} renderOrder={renderOrder} />;
}

useGLB.preload(ASSETS.droneLowpoly);
