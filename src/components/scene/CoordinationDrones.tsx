"use client";

import { useFrame } from "@react-three/fiber";
import { animate, useMotionValue } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { RENDER_ORDER } from "@/lib/constants";
import { SCENE, scenes, useScenes, type SceneId } from "@/lib/scenes";
import { useMediaQuery } from "@/lib/use-media-query";
import { clayState, landscapeWeight } from "./clay-map";
import { LowPolyDrone, Trail } from "./LowPolyDrone";

const TRAIL = { LENGTH: 40, COLOR: 0xf2f2f2, WIDTH: 2 };
const WAYPOINTS = { COUNT: 16, THRESHOLD: 0.5 };
const STEER = { MAX_SPEED: 2, MAX_FORCE: 0.45, MIN_VELOCITY: 0.001, ROTATION_SMOOTHING: 0.2 };

type Mode = "seek" | "orbit";

/** Fades every mesh/line under `ref` with a 1s linear tween on `visible` (shipped `ea`). */
export function useFadeGroup(ref: RefObject<THREE.Group | null>, visible: boolean) {
  const value = useMotionValue(0);
  useEffect(() => {
    const a = animate(value, visible ? 1 : 0, { duration: 1, ease: "linear" });
    return () => a.stop();
  }, [visible, value]);
  useFrame(() => {
    if (!ref.current) return;
    const v = value.get();
    ref.current.visible = v > 0;
    if (!ref.current.visible) return;
    ref.current.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (!m) return;
      for (const mat of Array.isArray(m) ? m : [m]) {
        mat.opacity = v;
        mat.transparent = true;
      }
    });
  });
}

const useTrail = () => {
  const [points] = useState(() => Array.from({ length: TRAIL.LENGTH }, () => new THREE.Vector3()));
  const [colors] = useState(() =>
    Array.from({ length: TRAIL.LENGTH }, (_, i) => new THREE.Color(TRAIL.COLOR).multiplyScalar((TRAIL.LENGTH - 1 - i) / (TRAIL.LENGTH - 1))),
  );
  const push = useCallback(
    (p: THREE.Vector3) => {
      for (let i = points.length - 1; i > 0; i--) points[i].copy(points[i - 1]);
      points[0].copy(p);
    },
    [points],
  );
  return { points, colors, push };
};

type AgentProps = {
  initialScene?: SceneId;
  modeRef: RefObject<Mode>;
  targetRef: THREE.Vector3;
  offset?: number;
  speed?: number;
  radius?: number;
  direction?: number;
};

/** Seek/orbit steering agent with a trail (shipped `eh`). */
function Agent({ initialScene, modeRef, targetRef, offset = 0, speed = 1, radius = 5, direction = 1 }: AgentProps) {
  const body = useRef<THREE.Group>(null);
  const snap = useRef(false);
  const started = useRef(false);
  const { points, colors, push } = useTrail();
  const waypoints = useRef<THREE.Vector3[]>([]);
  const wpIndex = useRef(0);
  const arrived = useRef(false);
  const lastMode = useRef<Mode>("seek");
  const kin = useRef({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), acceleration: new THREE.Vector3() });
  const tmp = useRef({
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    c: new THREE.Vector3(),
    d: new THREE.Vector3(),
    zero: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, -1),
    up: new THREE.Vector3(0, 1, 0),
    m: new THREE.Matrix4(),
    q: new THREE.Quaternion(),
  });

  const buildWaypoints = useCallback(() => {
    const list: THREE.Vector3[] = [];
    for (let i = 0; i < WAYPOINTS.COUNT; i++) {
      const a = (i / WAYPOINTS.COUNT) * Math.PI * 2;
      list.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    waypoints.current = list;
    let o = offset % 1;
    if (o < 0) o += 1;
    wpIndex.current = Math.floor(o * WAYPOINTS.COUNT);
  }, [radius, offset]);

  const seekForce = (target: THREE.Vector3) => {
    const { a, d, zero } = tmp.current;
    const { position, velocity } = kin.current;
    const desired = a.copy(target).sub(position);
    if (desired.length() === 0) return zero;
    desired.normalize().multiplyScalar(STEER.MAX_SPEED);
    const steer = d.copy(desired).sub(velocity);
    if (steer.length() > STEER.MAX_FORCE) steer.normalize().multiplyScalar(STEER.MAX_FORCE);
    return steer;
  };

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const p = initialScene ? scenes()[initialScene].progress : -1;
    if (!body.current) return;
    const mode = modeRef.current;
    if (lastMode.current !== mode) {
      const prev = lastMode.current;
      lastMode.current = mode;
      if (mode === "orbit" && prev !== "orbit") {
        buildWaypoints();
        arrived.current = true;
      } else if (mode === "seek" && prev !== "seek") {
        kin.current.position.copy(body.current.position);
        kin.current.velocity.set(0, 0, 0);
        kin.current.acceleration.set(0, 0, 0);
        arrived.current = false;
      }
    }
    if (initialScene && p === 0 && !started.current) snap.current = true;
    const k = kin.current;
    if (mode === "seek" || !arrived.current || snap.current) {
      if (snap.current) {
        k.position.copy(targetRef);
        for (const pt of points) pt.copy(k.position);
      } else k.position.lerp(targetRef, speed);
      k.position.y = 0;
      const { a, b, c, forward, q } = tmp.current;
      k.velocity.copy(a.subVectors(targetRef, k.position));
      const dir = b.subVectors(targetRef, k.position);
      dir.y = 0;
      if (dir.lengthSq() > 1e-6) {
        q.setFromUnitVectors(forward, c.copy(dir).normalize());
        body.current.quaternion.copy(q);
      }
      arrived.current = k.position.distanceTo(targetRef) < 0.1;
    } else if (mode === "orbit" && waypoints.current.length > 0) {
      const wp = waypoints.current[wpIndex.current];
      if (wp) {
        k.acceleration.set(0, 0, 0);
        const flat = tmp.current.a.set(wp.x, 0, wp.z);
        if (k.position.distanceTo(flat) < WAYPOINTS.THRESHOLD) {
          wpIndex.current =
            direction > 0
              ? (wpIndex.current + 1) % waypoints.current.length
              : (wpIndex.current - 1 + waypoints.current.length) % waypoints.current.length;
        }
        k.acceleration.add(seekForce(flat).multiplyScalar(speed));
      }
    }
    snap.current = false;
    started.current = true;
    k.velocity.add(k.acceleration);
    if (k.velocity.length() > STEER.MAX_SPEED) k.velocity.normalize().multiplyScalar(STEER.MAX_SPEED);
    k.position.add(tmp.current.c.copy(k.velocity).multiplyScalar(dt));
    k.position.y = 0;
    if (k.velocity.length() > STEER.MIN_VELOCITY) {
      const { b, m, q, up } = tmp.current;
      m.lookAt(k.position, b.copy(k.position).add(k.velocity), up);
      q.setFromRotationMatrix(m);
      body.current.quaternion.slerp(q, STEER.ROTATION_SMOOTHING);
    }
    push(k.position);
    body.current.position.copy(k.position);
  });

  return (
    <group>
      <group ref={body} scale={0.2}>
        <LowPolyDrone />
      </group>
      <Trail points={points} colors={colors} lineWidth={TRAIL.WIDTH} renderOrder={RENDER_ORDER.TRAILS} />
    </group>
  );
}

const onCircle = (c: [number, number, number], deg: number, r: number) => {
  const a = THREE.MathUtils.degToRad(deg);
  return new THREE.Vector3(c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r);
};

const PAIR = [
  { initial: onCircle([0, 0, -1.5], -56, 8.75), target: new THREE.Vector3(0, 0, -1), offset: 0 },
  { initial: onCircle([0, 0, 1.5], -56, 14), target: new THREE.Vector3(0, 0, 1), offset: 0.5 },
];
const SUPPORT = { initial: onCircle([1, 0, 0], 85, 8.75), target: new THREE.Vector3(1, 0, 0), offset: -0.25 };

const nextMode = (mode: Mode, p: number): Mode => (mode === "orbit" && p < 0.75 ? "seek" : mode === "seek" && p === 1 ? "orbit" : mode);

/** Three response drones orbiting the multi-threat sites (shipped `eg`). */
function ResponseDrones() {
  const md = useMediaQuery("(min-width: 768px)");
  const visible = useScenes((s) => s[SCENE.MULTI_THREAT_RESPONSE].progress > 0.9);
  const g1 = useRef<THREE.Group>(null);
  const g2 = useRef<THREE.Group>(null);
  const g3 = useRef<THREE.Group>(null);
  useFadeGroup(g1, visible);
  useFadeGroup(g2, visible);
  useFadeGroup(g3, visible);
  const m1 = useRef<Mode>("orbit");
  const m2 = useRef<Mode>("orbit");
  const m3 = useRef<Mode>("orbit");
  const t1 = useRef(new THREE.Vector3());
  const t2 = useRef(new THREE.Vector3());
  const t3 = useRef(new THREE.Vector3());
  return (
    <>
      <group position={[-7, 0.8, -0.35]} ref={g1}>
        <Agent modeRef={m1} targetRef={t1.current} offset={0} speed={0.1} radius={1} direction={-1} />
      </group>
      <group position={md ? [-6.5, 0.8, 2.9] : [1.5, 0.8, -3.6]} ref={g2}>
        <Agent modeRef={m2} targetRef={t2.current} offset={0.25} speed={0.1} radius={1} direction={1} />
      </group>
      <group position={md ? [7.75, 0.8, 3.5] : [-1.75, 0.8, -3]} ref={g3}>
        <Agent modeRef={m3} targetRef={t3.current} offset={0.5} speed={0.1} radius={1} direction={1} />
      </group>
    </>
  );
}

/** Analysis pair + extra-support drone (shipped `eb`). */
export const CoordinationDrones = memo(function CoordinationDrones() {
  const phalanxOn = useScenes((s) => s[SCENE.PHALANX_AI].progress > 0);
  const coordOn = useScenes((s) => s[SCENE.INTERDRONE_COORDINATION].progress > 0);
  const pairGroup = useRef<THREE.Group>(null);
  const supportGroup = useRef<THREE.Group>(null);
  // Raven clay landscape: the pair stays out of the mountain view (one Raven climbs there instead, ClayFlight) and
  // fades in once the relief has settled in Review.
  const landscape = useScenes((s) => clayState.enabled && landscapeWeight(s) > 0.05);
  useFadeGroup(pairGroup, phalanxOn && !landscape);
  useFadeGroup(supportGroup, coordOn);
  const pairTargets = useMemo(() => PAIR.map((p) => p.initial.clone()), []);
  const supportTarget = useMemo(() => SUPPORT.initial.clone(), []);
  const pairMode = useRef<Mode>("orbit");
  const supportMode = useRef<Mode>("orbit");

  useFrame(() => {
    const s = scenes();
    const analysis = s[SCENE.ANALYSIS_EVALUATION].progress;
    const support = s[SCENE.EXTRA_SUPPORT].progress;
    PAIR.forEach((p, i) => pairTargets[i].copy(p.initial).lerp(p.target, analysis));
    supportTarget.copy(SUPPORT.initial).lerp(SUPPORT.target, support);
    pairMode.current = nextMode(pairMode.current, analysis);
    supportMode.current = nextMode(supportMode.current, support);
  });

  return (
    <>
      <group position={[0, 0.8, 1.25]} ref={pairGroup}>
        {PAIR.map((p, i) => (
          <Agent
            key={i}
            targetRef={pairTargets[i]}
            modeRef={pairMode}
            speed={0.1}
            radius={1.5}
            offset={p.offset}
            initialScene={SCENE.ANALYSIS_EVALUATION}
          />
        ))}
      </group>
      <group position={[5.35, 0.8, 0]} ref={supportGroup}>
        <Agent
          targetRef={supportTarget}
          modeRef={supportMode}
          speed={0.1}
          radius={1}
          direction={-1}
          offset={0}
          initialScene={SCENE.EXTRA_SUPPORT}
        />
      </group>
      <ResponseDrones />
    </>
  );
});
