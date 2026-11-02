"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { easeInOutCubic } from "@/lib/math";
import { SCENE, scenes } from "@/lib/scenes";
import { CLIMB_STOPS } from "@/lib/story-map";
import { useMediaQuery } from "@/lib/use-media-query";
import { CLAY, CLAY_CENTRE, clayHeight, clayState, type HeightField } from "./clay-map";
import { AltitudeTag, Pin, type AltitudeState } from "./ClayMarkers";
import { LowPolyDrone } from "./LowPolyDrone";

/**
 * One Raven over the clay landscape (user, 2026-11-02): it enters at the bottom left of the Care teams frame, climbs
 * to the terrace village, then flies on to the ridge village ("continue the path of the drone to the next village"),
 * with an altitude indicator beside it.
 *
 * Scroll-driven (user: "the motion of the drone going up the altitude should be interactive with the scroll"): each
 * leg is a slice of Review's range ending at a snap stop (story-map `CLIMB_STOPS`); scrolling back reverses it, and
 * the camera hands back to the shipped track only after the last village. The dashed route (ref `routeMat`) shows
 * the whole path. The indicator is relative (a gauge from the start height to the highest waypoint, an arrow for
 * climbing/descending), no metres: product performance is unspecified (AGENTS.md).
 *
 * Positions are map offsets from the Care teams tile (ClayTerrain's group space); the camera looks toward +z, so
 * screen left is +x and the bottom of the frame is low z.
 */
/**
 * Waypoints with their checkpoint pins (user, 2026-11-02: "add this checkpoints also", the reference's pins: dark
 * "+" disc on a stem standing on the site, mono label beside it). `stem` (px) lifts the disc above the hovering drone.
 * Pins are display-only here (the reference's open a card; ours have no card yet), so they are not buttons.
 */
type Waypoint = { at: THREE.Vector2; clearance: number; name: string; stem: number };
const WAYPOINTS: readonly Waypoint[] = [
  // valley, bottom left of the frame
  { at: new THREE.Vector2(5.4, -3.9), clearance: 0.3, name: "Health centre", stem: 64 },
  // terrace village (Care teams tile cottages + cluster B)
  { at: new THREE.Vector2(0.6, -2.4), clearance: 0.8, name: "Hill clinic", stem: 150 },
  // ridge village (the tile's 7-cottage cluster, local (-121, 59))
  { at: new THREE.Vector2(-4.84, 2.36), clearance: 0.8, name: "Ridge village", stem: 116 },
];
/** Never closer to the ground than this on the way. */
const MIN_CLEARANCE = 0.25;
const SCALE = 0.2;
/** Route line samples per leg and dash period (map units; ref: dashes every 4 of its units, drifting at 0.6/s). */
const ROUTE_PER_LEG = 140;
const ROUTE_N = ROUTE_PER_LEG * (WAYPOINTS.length - 1);
const DASH = 0.09;
/** Vertical speed (map units per unit of leg progress) below which the drone counts as level. */
const LEVEL = 0.15;

/** Dashed route (ref script 0 `routeMat`): drifting dashes toward the destination, 55% duty. */
function createRouteMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: CLAY.ice }, uOpacity: { value: 0.9 } },
    vertexShader: /* glsl */ `
attribute float lineDistance;
varying float vD;
void main() {
    vD = lineDistance;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uOpacity;
varying float vD;
void main() {
    float d = fract(vD / ${DASH.toFixed(3)} - uTime * 0.6);
    if (d > 0.55) discard;
    gl_FragColor = vec4(uColor, uOpacity);
}`,
  });
}

const _up = new THREE.Vector3(0, 1, 0);

export function ClayFlight({ field }: { field: HeightField }) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const pins = useRef<(THREE.Group | null)[]>([]);
  const altitude = useMemo<AltitudeState>(() => ({ climb: 0, dir: 1, status: "READY" }), []);
  const routeW = useRef(-1);
  const route = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ROUTE_N * 3), 3));
    geometry.setAttribute("lineDistance", new THREE.BufferAttribute(new Float32Array(ROUTE_N), 1));
    const line = new THREE.Line(geometry, createRouteMaterial());
    line.frustumCulled = false;
    return line;
  }, []);
  useEffect(
    () => () => {
      route.geometry.dispose();
      (route.material as THREE.Material).dispose();
    },
    [route],
  );
  const tmp = useMemo(
    () => ({
      p: new THREE.Vector3(),
      ahead: new THREE.Vector3(),
      prev: new THREE.Vector3(),
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
    }),
    [],
  );

  const ground = (x: number, z: number, w: number) => clayHeight(field, CLAY_CENTRE.x + x, CLAY_CENTRE.y + z, w);
  const height = (i: number, w: number) => ground(WAYPOINTS[i].at.x, WAYPOINTS[i].at.y, w) + WAYPOINTS[i].clearance;

  /**
   * Position on leg `leg` (waypoint leg -> leg + 1) at progress t (0..1) for landscape weight w, into `out` (map
   * space). `alongPath`: t is the position along the path itself (no easing), for sampling the route line.
   */
  const pose = (leg: number, t: number, w: number, out: THREE.Vector3, alongPath = false) => {
    const c = THREE.MathUtils.clamp(t, 0, 1);
    const e = alongPath ? c : easeInOutCubic(c);
    const a = WAYPOINTS[leg].at;
    const b = WAYPOINTS[leg + 1].at;
    const x = THREE.MathUtils.lerp(a.x, b.x, e);
    const z = THREE.MathUtils.lerp(a.y, b.y, e);
    const y = Math.max(THREE.MathUtils.lerp(height(leg, w), height(leg + 1, w), THREE.MathUtils.smootherstep(e, 0, 0.85)), ground(x, z, w) + MIN_CLEARANCE);
    return out.set(CLAY_CENTRE.x + x, y, CLAY_CENTRE.y + z);
  };

  /** Scroll position (Review progress) -> leg and progress on it. */
  const legAt = (analysis: number) => {
    let from = 0;
    for (let i = 0; i < CLIMB_STOPS.length; i++) {
      const to = CLIMB_STOPS[i];
      if (analysis < to || i === CLIMB_STOPS.length - 1) return { leg: i, t: THREE.MathUtils.clamp((analysis - from) / (to - from), 0, 1) };
      from = to;
    }
    return { leg: 0, t: 0 };
  };

  useFrame(({ clock: c }, dt) => {
    const g = group.current;
    const b = body.current;
    if (!g || !b) return;
    const w = clayState.weight;
    const analysis = scenes()[SCENE.ANALYSIS_EVALUATION].progress;
    // Everything here is WebGL (ClayMarkers), so the wipe's map capture (preroll) holds the same frame as the live map.
    const visible = clayState.on && w > 0.5;
    g.visible = visible;
    if (!visible) return;

    // route: the whole flight path, re-sampled when the relief height changes
    if (Math.abs(routeW.current - w) > 1e-3) {
      routeW.current = w;
      const pos = route.geometry.getAttribute("position") as THREE.BufferAttribute;
      const dist = route.geometry.getAttribute("lineDistance") as THREE.BufferAttribute;
      let total = 0;
      for (let i = 0; i < ROUTE_N; i++) {
        const leg = Math.floor(i / ROUTE_PER_LEG);
        pose(leg, (i % ROUTE_PER_LEG) / (ROUTE_PER_LEG - 1), w, tmp.ahead, true);
        if (i > 0) total += tmp.ahead.distanceTo(tmp.prev);
        pos.setXYZ(i, tmp.ahead.x, tmp.ahead.y, tmp.ahead.z);
        dist.setX(i, total);
        tmp.prev.copy(tmp.ahead);
      }
      pos.needsUpdate = true;
      dist.needsUpdate = true;
      // checkpoint pins stand on the ground under each waypoint
      WAYPOINTS.forEach((wp, i) => {
        pins.current[i]?.position.set(CLAY_CENTRE.x + wp.at.x, ground(wp.at.x, wp.at.y, w), CLAY_CENTRE.y + wp.at.y);
      });
    }
    (route.material as THREE.ShaderMaterial).uniforms.uTime.value = reducedMotion ? 0 : c.elapsedTime;

    // scroll position through the village stops
    const { leg, t } = legAt(analysis);
    pose(leg, t, w, tmp.p);
    const atStop = t <= 0 || t >= 1;
    const atVillage = (t >= 1) || (t <= 0 && leg > 0);
    const y = tmp.p.y;
    if (atVillage && !reducedMotion) tmp.p.y += 0.04 * Math.sin(c.elapsedTime * 1.6); // hover
    b.position.copy(tmp.p);

    // face along the leg (model forward is local -z); at a stop, toward the next leg
    const headLeg = t >= 1 && leg < WAYPOINTS.length - 2 ? leg + 1 : leg;
    const from = WAYPOINTS[headLeg].at;
    const to = WAYPOINTS[headLeg + 1].at;
    tmp.ahead.set(tmp.p.x + (to.x - from.x), tmp.p.y, tmp.p.z + (to.y - from.y));
    tmp.m.lookAt(tmp.p, tmp.ahead, _up);
    tmp.q.setFromRotationMatrix(tmp.m);
    b.quaternion.slerp(tmp.q, 1 - Math.exp(-dt * 6));

    // indicator: gauge from the start height to the highest waypoint, arrow from the vertical speed
    const y0 = height(0, w);
    let yTop = y0;
    for (let i = 1; i < WAYPOINTS.length; i++) yTop = Math.max(yTop, height(i, w));
    altitude.climb = THREE.MathUtils.clamp((y - y0) / Math.max(yTop - y0, 1e-3), 0, 1);
    const slope = (pose(leg, Math.min(t + 0.02, 1), w, tmp.ahead).y - pose(leg, Math.max(t - 0.02, 0), w, tmp.prev).y) / 0.04;
    if (leg === 0 && t <= 0) {
      altitude.status = "READY";
      altitude.dir = 1;
    } else if (atStop) {
      altitude.status = leg === WAYPOINTS.length - 2 && t >= 1 ? "HOLDING ABOVE RIDGE VILLAGE" : "HOLDING ABOVE VILLAGE";
      altitude.dir = 0;
    } else {
      altitude.dir = slope > LEVEL ? 1 : slope < -LEVEL ? -1 : 0;
      altitude.status = altitude.dir > 0 ? "CLIMBING" : altitude.dir < 0 ? "DESCENDING" : "LEVEL";
    }
  });

  return (
    <group ref={group} visible={false}>
      <primitive object={route} />
      {WAYPOINTS.map((wp, i) => (
        <group key={wp.name} ref={(el) => void (pins.current[i] = el)}>
          <Pin name={wp.name} stem={wp.stem} />
        </group>
      ))}
      <group ref={body}>
        <group scale={SCALE}>
          <LowPolyDrone />
        </group>
        <AltitudeTag state={altitude} />
      </group>
    </group>
  );
}
