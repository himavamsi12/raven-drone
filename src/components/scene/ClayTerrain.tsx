"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import { RENDER_ORDER, TERRAIN_SCALE } from "@/lib/constants";
import { scenes } from "@/lib/scenes";
import {
  baseHeight,
  CLAY,
  CLAY_CENTRE,
  clayHeight,
  clayOn,
  clayState,
  clayUniforms,
  createGroundMaterial,
  createHouseGeometry,
  createHouseMaterial,
  heightField,
  LANDSCAPE,
  landscapeWeight,
  liftedHeight,
  RAVEN_COTTAGES,
  TILE_STEP,
  VILLAGE,
  type HeightField,
} from "./clay-map";
import { ClayFlight } from "./ClayFlight";
import { useGLB } from "./types";

/** Mesh half-size around the mountain (map units) and grid segments; spacing ~0.05 at the centre, ~0.35 at the rim. */
const HALF = 30;
const SEGMENTS = 360;
/** Grid warp x(u) = A u + B u³ (u in -1..1): dense where the camera looks, coarse toward the fade. */
const WARP_A = 10;
const WARP_B = HALF - WARP_A;

function buildGround(field: HeightField) {
  const n = SEGMENTS + 1;
  const cx = CLAY_CENTRE.x + LANDSCAPE.offset.x;
  const cz = CLAY_CENTRE.y + LANDSCAPE.offset.y;
  const warp = (u: number) => WARP_A * u + WARP_B * u * u * u;
  const base = new Float32Array(n * n * 3);
  const lifted = new Float32Array(n * n * 3);
  const extra = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = cz + warp((j / SEGMENTS) * 2 - 1);
    for (let i = 0; i < n; i++) {
      const x = cx + warp((i / SEGMENTS) * 2 - 1);
      const k = j * n + i;
      const y = baseHeight(field, x, z);
      const ly = liftedHeight(field, y, x, z);
      base.set([x, y, z], k * 3);
      lifted.set([x, ly, z], k * 3);
      extra[k] = ly - y;
    }
  }
  const index = new Uint32Array(SEGMENTS * SEGMENTS * 6);
  let o = 0;
  for (let j = 0; j < SEGMENTS; j++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      index.set([a, c, b, b, c, d], o);
      o += 6;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.setAttribute("position", new THREE.BufferAttribute(lifted, 3));
  geometry.computeVertexNormals();
  const liftNormal = geometry.getAttribute("normal").clone();
  geometry.setAttribute("position", new THREE.BufferAttribute(base, 3));
  geometry.computeVertexNormals();
  geometry.setAttribute("aLiftNormal", liftNormal);
  geometry.setAttribute("aLift", new THREE.BufferAttribute(extra, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

type House = { x: number; z: number; yaw: number; scale: number; y0: number; y1: number };

const hash = (x: number, z: number) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Raven cottages of the tiles near the map plus the Care teams village, with real and lifted ground heights. */
function buildHouses(field: HeightField): House[] {
  const out: House[] = [];
  const add = (x: number, z: number, yaw: number, scale: number) => {
    const y0 = baseHeight(field, x, z);
    out.push({ x, z, yaw, scale, y0, y1: liftedHeight(field, y0, x, z) });
  };
  for (let col = -2; col <= 2; col++) {
    for (let row = -2; row <= 2; row++) {
      const ox = CLAY_CENTRE.x + col * TILE_STEP;
      const oz = CLAY_CENTRE.y + row * TILE_STEP;
      for (const [lx, lz] of RAVEN_COTTAGES) {
        const x = ox + lx * TERRAIN_SCALE;
        const z = oz + lz * TERRAIN_SCALE;
        if (Math.hypot(x - CLAY_CENTRE.x, z - CLAY_CENTRE.y) > 24) continue;
        add(x, z, hash(lx, lz) * Math.PI, 0.95 + 0.2 * hash(lz, lx));
      }
    }
  }
  for (const [lx, lz, yaw, scale] of VILLAGE) {
    add(CLAY_CENTRE.x + lx * TERRAIN_SCALE, CLAY_CENTRE.y + lz * TERRAIN_SCALE, yaw, scale);
  }
  return out;
}

/**
 * Clay landscape of band 2 (clay-map.ts): one dense mesh of the Raven tiles (shown instead of the terrain tiles
 * while the map is on), the clay houses, the landscape lift and the cursor glow. Mounted in MainScene's terrain
 * parent group (map space). The pointer is tracked on the window (the copy layers sit above the canvas; mouse and
 * pen only) and its ray is marched against `clayHeight`, the CPU mirror of the mesh, so the glow lands on the
 * surface as drawn.
 */
export function ClayTerrain() {
  const raven = useGLB(ASSETS.ravenTerrain);
  const land = (raven.nodes["Land-A"] as THREE.Mesh).geometry;
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null);
  const houseMesh = useRef<THREE.InstancedMesh>(null);
  const field = useMemo(() => heightField(land), [land]);
  const ground = useMemo(() => buildGround(field), [field]);
  const houses = useMemo(() => buildHouses(field), [field]);
  const groundMaterial = useMemo(createGroundMaterial, []);
  const houseGeometry = useMemo(createHouseGeometry, []);
  const houseMaterial = useMemo(createHouseMaterial, []);
  const pointer = useRef({ ndc: new THREE.Vector2(), active: false });
  const placed = useRef(-1);
  const tmp = useMemo(
    () => ({
      ray: new THREE.Ray(),
      raycaster: new THREE.Raycaster(),
      inv: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      v: new THREE.Vector3(),
    }),
    [],
  );

  useEffect(() => {
    clayState.enabled = true;
    return () => {
      clayState.enabled = false;
      clayState.on = false;
      clayState.weight = 0;
    };
  }, []);

  useEffect(
    () => () => {
      ground.dispose();
      groundMaterial.dispose();
      houseGeometry.dispose();
      houseMaterial.dispose();
    },
    [ground, groundMaterial, houseGeometry, houseMaterial],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = gl.domElement.getBoundingClientRect();
      pointer.current.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      pointer.current.active = true;
    };
    const leave = () => void (pointer.current.active = false);
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
    };
  }, [gl]);

  useLayoutEffect(() => {
    placed.current = -1; // re-place the houses on the next frame
  }, [houses]);

  useFrame(({ camera }, dt) => {
    const g = group.current;
    if (!g) return;
    const s = scenes();
    const on = clayOn(s);
    const weight = landscapeWeight(s);
    clayState.on = on;
    clayState.weight = weight;
    g.visible = on;

    const u = clayUniforms;
    g.updateWorldMatrix(true, false);
    clayState.centreWorld.set(CLAY_CENTRE.x, 0, CLAY_CENTRE.y).applyMatrix4(g.matrixWorld);
    u.uClayCentre.value.set(clayState.centreWorld.x, clayState.centreWorld.z);
    u.uClayLift.value = weight;
    u.uClayLight.value.copy(CLAY.light).lerp(LANDSCAPE.light, weight).normalize();

    // houses ride the ground between real and lifted heights
    const mesh = houseMesh.current;
    if (mesh && Math.abs(placed.current - weight) > 1e-4) {
      houses.forEach((h, i) => {
        const y = h.y0 + weight * (h.y1 - h.y0);
        const sc = TERRAIN_SCALE * h.scale * CLAY.houseScale;
        tmp.m.compose(tmp.p.set(h.x, y, h.z), tmp.q.setFromAxisAngle(tmp.v.set(0, 1, 0), h.yaw), tmp.s.setScalar(sc));
        mesh.setMatrixAt(i, tmp.m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      placed.current = weight;
    }

    // cursor glow: march the ray (in map space) to the first point under the surface, then bisect
    let target = 0;
    if (on && pointer.current.active) {
      tmp.raycaster.setFromCamera(pointer.current.ndc, camera);
      tmp.inv.copy(g.matrixWorld).invert();
      tmp.ray.copy(tmp.raycaster.ray).applyMatrix4(tmp.inv);
      const { origin, direction } = tmp.ray;
      const under = (t: number) => {
        tmp.p.copy(origin).addScaledVector(direction, t);
        return tmp.p.y < clayHeight(field, tmp.p.x, tmp.p.z, weight);
      };
      let prev = 0;
      for (let t = 0.5; t < 80; t += 0.1) {
        if (under(t)) {
          let lo = prev;
          let hi = t;
          for (let k = 0; k < 10; k++) {
            const mid = (lo + hi) / 2;
            if (under(mid)) hi = mid;
            else lo = mid;
          }
          tmp.p.copy(origin).addScaledVector(direction, hi).applyMatrix4(g.matrixWorld);
          u.uClayMouse.value.copy(tmp.p);
          target = 1;
          break;
        }
        prev = t;
      }
    }
    u.uClayMouseOn.value += (target - u.uClayMouseOn.value) * (1 - Math.exp(-7.5 * dt));
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={ground} material={groundMaterial} frustumCulled={false} renderOrder={RENDER_ORDER.TERRAIN} />
      <instancedMesh
        ref={houseMesh}
        args={[houseGeometry, houseMaterial, houses.length]}
        frustumCulled={false}
        renderOrder={RENDER_ORDER.TERRAIN}
      />
      <ClayFlight field={field} />
    </group>
  );
}
