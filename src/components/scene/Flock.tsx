"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import Delaunator from "delaunator";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import { RENDER_ORDER, TERRAIN_SCALE, resolution } from "@/lib/constants";
import { randRange, remap } from "@/lib/math";
import { SCENE, scenes } from "@/lib/scenes";
import { useMediaQuery } from "@/lib/use-media-query";
import { TacticalGrid } from "./Grid";
import { ScanlineMaterial } from "./LowPolyDrone";
import { TerrainMaterial } from "./materials/TerrainMaterial";
import { getNoiseTexture } from "./textures";
import { useGLB } from "./types";

/** Flat grayscale terrain + always-on grid behind the flock (shipped `tz`). */
function FlockGround() {
  const terrain = useGLB(ASSETS.terrain);
  const land = terrain.nodes["Land-A"];
  const [material] = useState(() => {
    const m = new TerrainMaterial(getNoiseTexture());
    m.uniforms.uResolution.value = resolution;
    m.uniforms.uBaseTexture.value = (land.material as THREE.MeshStandardMaterial).map;
    m.uniforms.uBgColor.value.setHex(0x0f0f0f);
    return m;
  });
  return (
    <group scale={2 * TERRAIN_SCALE}>
      <group position={[0, -1, 0]}>
        <TacticalGrid forceActive scale={1 / TERRAIN_SCALE} position={[0, 1, 0]} />
      </group>
      <mesh
        frustumCulled={false}
        onBeforeRender={() => {
          material.uniforms.uHideRatio.value = 1;
        }}
        renderOrder={RENDER_ORDER.TERRAIN}
        geometry={land.geometry}
        material={material}
      />
    </group>
  );
}

function useDevicePixelRatio() {
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    setDpr(window.devicePixelRatio || 1);
    const m = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const on = () => setDpr(window.devicePixelRatio || 1);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return dpr;
}

/** Journey (the flock network map) is removed from the page (story-map.ts); kept in code, never shown. */
const JOURNEY_SHOWN = false;

/** Screen-space dashed Delaunay mesh between flock members (shipped `tk`). */
function FlockLinks({ rects, lines, count, maxEdges }: { rects: RefObject<(SVGRectElement | null)[]>; lines: RefObject<(SVGLineElement | null)[]>; count: number; maxEdges: number }) {
  const size = useThree((s) => s.size);
  const dpr = useDevicePixelRatio();
  const svg = useRef<SVGSVGElement>(null);
  useFrame(() => {
    const s = scenes();
    const flock = s[SCENE.FLOCK_SCENE].progress;
    const det = s[SCENE.REAL_TIME_DETECTION].progress;
    const fadeIn = remap(flock, 0.9, 1, 0, 1);
    const fadeOut = remap(det, 0, 0.1, 1, 0);
    if (!svg.current) return;
    // Journey removed (user, 2026-11-02): the dashed network overlay is DOM, not part of the flock render pass, so it
    // has to be switched off here too or it still fades in during the Prepare -> Route move.
    const v = JOURNEY_SHOWN ? (det > 0.001 ? fadeOut : fadeIn) : 0;
    if (v < 0.01) {
      svg.current.style.opacity = "0";
      svg.current.style.display = "none";
    } else {
      svg.current.style.opacity = `${0.8 * v}`;
      svg.current.style.display = "block";
    }
  });
  return (
    <Html fullscreen className="pointer-events-none" position={[0, -5, 8]}>
      <svg width={size.width} height={size.height} className="pointer-events-none absolute top-0 left-0" ref={svg} aria-hidden="true">
        {Array.from({ length: maxEdges }, (_, i) => (
          <line
            key={i}
            ref={(el) => {
              lines.current[i] = el;
            }}
            stroke="white"
            strokeWidth={dpr === 1 ? 2 : 1}
            strokeDasharray="3 2.5"
          />
        ))}
        {Array.from({ length: count }, (_, i) => (
          <rect
            key={i}
            ref={(el) => {
              rects.current[i] = el;
            }}
            width={4}
            height={4}
            fill="white"
          />
        ))}
      </svg>
    </Html>
  );
}

const nearest = (x: number, z: number, pts: { x: number; z: number }[]) => {
  if (pts.length === 0) return Infinity;
  let best = Infinity;
  for (const p of pts) {
    const dx = x - p.x;
    const dz = z - p.z;
    best = Math.min(best, Math.sqrt(dx * dx + dz * dz));
  }
  return best;
};

/** Best-candidate (Mitchell) sampling for well-spread starting positions (shipped `tB`). */
const spreadPoints = (n: number, [x0, x1]: number[], [z0, z1]: number[], candidates = 32) => {
  const pts = [{ x: (x0 + x1) / 2, z: (z0 + z1) / 2 }];
  for (let i = 1; i < n; i++) {
    let best: { x: number; z: number } | null = null;
    let bestD = -1;
    for (let c = 0; c < candidates; c++) {
      const x = randRange(x0, x1);
      const z = randRange(z0, z1);
      const d = nearest(x, z, pts);
      if (d > bestD) {
        bestD = d;
        best = { x, z };
      }
    }
    if (best) pts.push(best);
  }
  return pts;
};

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const pos = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);
const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
const UP = new THREE.Vector3(0, 1, 0);

/** Separating flock of instanced low-poly Raven drones (shipped `tZ`). */
function FlockSwarm({ camera, isMobile, isTablet }: { camera: THREE.Camera; isMobile: boolean; isTablet: boolean }) {
  const count = isMobile ? 24 : isTablet ? 32 : 64;
  const maxEdges = count < 3 ? 0 : 3 * count - 6;
  const bodies = useRef<THREE.InstancedMesh>(null);
  const outlines = useRef<THREE.InstancedMesh>(null);
  const rects = useRef<(SVGRectElement | null)[]>([]);
  const lines = useRef<(SVGLineElement | null)[]>([]);
  const group = useRef<THREE.Group>(null);
  const screen = useRef(new Float64Array(2 * count));
  const proj = useRef(new THREE.Vector3());
  const linkRange = isMobile || isTablet ? 26 : 20;
  const xRange = isMobile ? [-30, 30] : isTablet ? [-40, 40] : [-48, 48];
  const zRange = isMobile ? [-60, 60] : [-78, 78];
  const { nodes } = useGLB(ASSETS.droneLowpoly);
  const geometry = nodes.mainBody.geometry;
  // Drone arms/rotor discs need a normal-inflated hull; uniform 1.15 scaling (fine for the compact jet) would offset them.
  const outlineGeometry = nodes.outlineHull.geometry;
  const material = useMemo(() => new ScanlineMaterial(new THREE.Color("#8a8a8a")), []);
  const outlineMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "white", side: THREE.BackSide }), []);
  const agents = useMemo(() => {
    const start = spreadPoints(count, xRange, zRange, 32);
    return start.map((p, i) => {
      const a = randRange(23 * i) * Math.PI * 2;
      return { position: new THREE.Vector3(p.x, 0, p.z), velocity: new THREE.Vector3(2 * Math.cos(a), 0, 2 * Math.sin(a)) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  const running = useRef(false);

  useEffect(() => {
    if (group.current) group.current.visible = false;
  }, []);

  useFrame((state, dt) => {
    const s = scenes();
    const flock = s[SCENE.FLOCK_SCENE];
    const det = s[SCENE.REAL_TIME_DETECTION];
    const on = JOURNEY_SHOWN && flock.isActive && flock.progress > 0.75 && det.progress < 0.25;
    if (group.current && group.current.visible !== on) group.current.visible = on;
    running.current = on;
    material.setTime(state.clock.getElapsedTime());
    if (!running.current) return;
    const root = state.previousRoot?.getState();
    const { width, height } = (root ?? state).size;
    const P = screen.current;
    for (let i = 0; i < count; i++) {
      const a = agents[i];
      let fx = 0;
      let fz = 0;
      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const b = agents[j];
        const dx = a.position.x - b.position.x;
        const dz = a.position.z - b.position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 0 && d2 < 256) {
          const d = Math.sqrt(d2);
          const k = 256 / d2;
          fx += (dx / d) * k;
          fz += (dz / d) * k;
        }
      }
      a.velocity.x += fx * dt;
      a.velocity.z += fz * dt;
      const sp = Math.hypot(a.velocity.x, a.velocity.z);
      if (sp > 0) {
        a.velocity.x = (a.velocity.x / sp) * 2;
        a.velocity.z = (a.velocity.z / sp) * 2;
      }
      a.position.x += a.velocity.x * dt;
      a.position.z += a.velocity.z * dt;
      if (a.position.x < xRange[0]) a.position.x = xRange[1] - (xRange[0] - a.position.x);
      else if (a.position.x > xRange[1]) a.position.x = xRange[0] + (a.position.x - xRange[1]);
      if (a.position.z < zRange[0]) a.position.z = zRange[1] - (zRange[0] - a.position.z);
      else if (a.position.z > zRange[1]) a.position.z = zRange[0] + (a.position.z - zRange[1]);
      pos.set(a.position.x, 0, a.position.z);
      q.setFromAxisAngle(UP, Math.atan2(a.velocity.x, a.velocity.z) + Math.PI).multiply(FLIP);
      m4.compose(pos, q, ONE);
      bodies.current?.setMatrixAt(i, m4);
      m4.compose(pos, q, ONE);
      outlines.current?.setMatrixAt(i, m4);
      proj.current.copy(pos).multiplyScalar(0.1);
      proj.current.y -= 4;
      proj.current.z -= 8;
      proj.current.project(camera);
      const sx = (0.5 * proj.current.x + 0.5) * width;
      const sy = (-(0.5 * proj.current.y) + 0.5) * height;
      P[2 * i] = sx;
      P[2 * i + 1] = sy;
      rects.current[i]?.setAttribute("x", String(sx - 2));
      rects.current[i]?.setAttribute("y", String(sy - 2));
    }
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    if (outlines.current) outlines.current.instanceMatrix.needsUpdate = true;

    const edges: [number, number][] = [];
    if (P.length >= 6) {
      const tri = new Delaunator(P).triangles;
      const seen = new Set<string>();
      for (let t = 0; t < tri.length; t += 3) {
        for (const [u, v] of [
          [tri[t], tri[t + 1]],
          [tri[t + 1], tri[t + 2]],
          [tri[t + 2], tri[t]],
        ]) {
          const key = u < v ? `${u}-${v}` : `${v}-${u}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const dx = agents[u].position.x - agents[v].position.x;
          const dz = agents[u].position.z - agents[v].position.z;
          if (dx * dx + dz * dz <= linkRange * linkRange) edges.push([u, v]);
        }
      }
    }
    edges.forEach(([u, v], i) => {
      const el = lines.current[i];
      if (!el) return;
      const shown = el.style.display !== "none";
      el.setAttribute("x1", String(P[2 * u]));
      el.setAttribute("y1", String(P[2 * u + 1]));
      el.setAttribute("x2", String(P[2 * v]));
      el.setAttribute("y2", String(P[2 * v + 1]));
      if (!shown) {
        el.style.display = "";
        el.style.opacity = "0";
        el.style.transition = "opacity 0.3s ease-in-out";
        requestAnimationFrame(() => {
          el.style.opacity = "1";
        });
      } else el.style.opacity = "1";
    });
    for (let i = edges.length; i < maxEdges; i++) {
      const el = lines.current[i];
      if (!el || el.style.display === "none") continue;
      if (parseFloat(el.style.opacity || "1") > 0) {
        el.style.transition = "opacity 0.3s ease-in-out";
        el.style.opacity = "0";
        setTimeout(() => {
          if (el.style.opacity === "0") el.style.display = "none";
        }, 300);
      } else el.style.display = "none";
    }
  });

  return (
    <group ref={group} position={[0, -5, -8]}>
      <group scale={0.1} position={[0, 1, 0]}>
        <instancedMesh ref={outlines} args={[outlineGeometry, outlineMaterial, count]} frustumCulled={false} />
        <instancedMesh ref={bodies} args={[geometry, material, count]} frustumCulled={false} />
      </group>
      <FlockGround />
      <FlockLinks rects={rects} lines={lines} count={count} maxEdges={maxEdges} />
    </group>
  );
}

/** Flock scene; rendered offscreen and mixed in by the post pass (shipped `t$`). */
export function Flock({ camera }: { camera: THREE.Camera }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  return <FlockSwarm key={isMobile ? "mobile" : isTablet ? "tablet" : "desktop"} camera={camera} isMobile={isMobile} isTablet={isTablet} />;
}
