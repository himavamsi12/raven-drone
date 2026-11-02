"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import { SCENE, useScenes } from "@/lib/scenes";
import { wipeNow, wipeX } from "@/lib/story-map";

/**
 * A label goes with the ground under it when the diagonal wipe sweeps past. The anchor is clamped to the screen: a
 * label anchored just off screen (its box still visible) was never counted as swept and stayed after the cut (user,
 * 2026-11-03). Once the wipe has covered the frame every label is swept.
 */
function sweptByWipe(ndc: { x: number; y: number }) {
  const ratio = wipeNow();
  if (ratio >= 0.995) return true;
  const u = Math.min(Math.max((ndc.x + 1) / 2, 0), 1);
  const v = Math.min(Math.max((ndc.y + 1) / 2, 0), 1);
  return wipeX(u, v) < ratio;
}
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Scripted "real-time detection" boxes (shipped `D`/`O`/`U`). Presentation content, not live inference; Raven drops
 * the shipped jittering confidence percentage and keeps the literal object labels. On the Raven tile the boxes are
 * replaced by village scan frames (`villages`); the shipped boxes remain for `?terrain=original`.
 */
const POINTS: { position: [number, number, number]; label: string; index: number }[] = [
  { position: [-182.2743, 1.6271, -195.5112], label: "road block", index: 0 },
  { position: [-32.062, -4.5895, -123.1434], label: "power line", index: 1 },
  { position: [-6.3289, -3.3269, -171.9805], label: "car", index: 2 },
  { position: [68.3493, -3.8836, -126.7537], label: "person", index: 3 },
  { position: [179.2427, 1.7371, -173.0501], label: "antenna", index: 4 },
  { position: [125.5761, 6.6586, -57.8208], label: "motorcycle", index: 5 },
  { position: [64.5723, 1.5844, -64.839], label: "road obstruction", index: 6 },
  { position: [-99.9169, -1.358, -159.1456], label: "campfire", index: 7 },
  { position: [-69.8519, -4.3915, -79.9549], label: "road block", index: 8 },
  { position: [-176.3916, 10.6163, -36.679], label: "power line", index: 9 },
  { position: [-50.4171, -4.447, 17.2192], label: "car", index: 10 },
  { position: [9.4389, -5.0822, -7.9998], label: "person", index: 11 },
  { position: [-99.0042, -2.6531, 51.2302], label: "antenna", index: 12 },
  { position: [141.9201, -2.6072, 12.8108], label: "motorcycle", index: 13 },
  { position: [136.9131, 3.4896, 94.4187], label: "road obstruction", index: 14 },
  { position: [72.1303, 1.1859, 47.9911], label: "campfire", index: 15 },
  { position: [44.0578, -5.6776, 84.1614], label: "road block", index: 16 },
  { position: [-40.6997, -1.181, 83.6216], label: "power line", index: 17 },
  { position: [-95.2252, -5.5451, 123.0311], label: "car", index: 18 },
  { position: [-155.1492, -4.2668, 84.7013], label: "person", index: 19 },
  { position: [-4.1252, -6.6624, -42.9317], label: "antenna", index: 20 },
  { position: [-111.9607, 8.2428, -10.3134], label: "motorcycle", index: 21 },
  { position: [-155.1492, 1.454, -106.4079], label: "road obstruction", index: 22 },
  { position: [9.7148, -4.8298, -93.9014], label: "campfire", index: 23 },
  { position: [87.2463, 2.4024, -181.9878], label: "road block", index: 24 },
  { position: [144.4711, 10.5542, -104.2485], label: "power line", index: 25 },
  { position: [185.6602, 4.1709, -44.7009], label: "car", index: 26 },
  { position: [192.0777, 4.1295, 41.4001], label: "person", index: 27 },
  { position: [193.0582, 3.4502, 117.6326], label: "antenna", index: 28 },
  { position: [-159.2784, -1.715, 153.1709], label: "motorcycle", index: 29 },
  { position: [138.819, -5.3897, 174.1206], label: "road obstruction", index: 30 },
  { position: [68.0067, 7.0513, 145.6838], label: "campfire", index: 31 },
  { position: [-37.8814, 2.0358, 197.5583], label: "road block", index: 32 },
  { position: [-1.83, -5.087, 139.2268], label: "power line", index: 33 },
];

const LG = { x: 0.33, y: 0.7 };
const MD = { x: 0.65, y: 0.5 };
const SM = { x: 0.99, y: 0.5 };
const projected = new THREE.Vector3();

function DetectionBox({ position, label, show }: { position: [number, number, number]; label: string; show: boolean }) {
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isMd = useMediaQuery("(min-width: 768px)");
  const camera = useThree((s) => s.camera);
  const anchor = useRef<THREE.Group>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const jitterClock = useRef(Math.random());
  const last = useRef({ x: 0, y: 0 });
  const transition = useRef("350ms");
  const opacity = useRef("0");
  const zone = isLg ? LG : isMd ? MD : SM;

  useFrame((_, dt) => {
    if (!anchor.current || !wrapper.current || !box.current) return;
    if (!show) {
      if (opacity.current !== "0") {
        wrapper.current.style.opacity = "0";
        opacity.current = "0";
      }
      return;
    }
    anchor.current.getWorldPosition(projected);
    projected.project(camera);
    const swept = sweptByWipe(projected);
    const visible = show && !swept && (Math.abs(projected.x) > zone.x || Math.abs(projected.y) > zone.y);
    const dx = projected.x - last.current.x;
    const dy = projected.y - last.current.y;
    last.current.x = projected.x;
    last.current.y = projected.y;
    const dur = (dx * dx + dy * dy > 0.25 || swept) && !visible ? "0s" : "350ms";
    if (transition.current !== dur) {
      wrapper.current.style.transitionDuration = dur;
      transition.current = dur;
    }
    const op = visible ? "1" : "0";
    if (opacity.current !== op) {
      wrapper.current.style.opacity = op;
      opacity.current = op;
    }
    jitterClock.current += dt;
    if (jitterClock.current >= 0.1) {
      jitterClock.current = 0;
      box.current.style.transform = `scale(${0.9 + 0.1 * Math.random()}, ${0.9 + 0.1 * Math.random()})`;
    }
  });

  return (
    <group ref={anchor} position={position}>
      <Html zIndexRange={[1, 2]}>
        <div ref={wrapper} className="relative opacity-0 transition-opacity select-none" aria-hidden="true">
          <div ref={box} className="outline-yellow relative size-12 origin-top-left outline -outline-offset-1 transition-all select-none" />
          <div className="text-m-mono bg-yellow absolute -top-3 h-3 px-0.5 font-mono leading-[0.75rem] whitespace-nowrap text-black uppercase transition-colors">
            {label}
          </div>
        </div>
      </Html>
    </group>
  );
}

/**
 * Raven tile settlements (user, 2026-11-02: scan the villages instead of labelling road objects). Centres, footprint
 * (tile-local units, x by z) and lowest ground y were measured from the `Houses` mesh of raven-terrain.glb v09
 * (23 houses: three clustered villages, three lone farmsteads). Labels are descriptive only: no counts, distances or
 * confirmations (RAVEN_CONTENT_MAP rules).
 */
const SETTLEMENTS: { centre: [number, number, number]; size: [number, number]; top: number; name: string }[] = [
  { centre: [35.6, 3.41, -67.2], size: [22.6, 33.8], top: 7.7, name: "Hill village" },
  { centre: [-120.3, 1.95, 61.0], size: [18.2, 32.6], top: 6.5, name: "Ridge village" },
  { centre: [96.4, 4.68, 116.1], size: [15.5, 26.8], top: 8.2, name: "Valley village" },
  { centre: [-57.3, 2.26, -159.9], size: [4.9, 5.2], top: 4.7, name: "Farmstead" },
  { centre: [-71.1, 2.86, -119.9], size: [4.2, 4.6], top: 5.2, name: "Farmstead" },
  { centre: [-2.1, -4.07, 150.0], size: [3.1, 3.7], top: -1.5, name: "Farmstead" },
];
/** Frame margin around the footprint (tile units) and the smallest frame on screen (px). */
const MARGIN = 6;
const MIN_PX = 28;
/** Frame tops above this (px from the canvas top) would sit under the nav bar: hidden. */
const NAV_CLEAR = 110;
const _corner = new THREE.Vector3();

function VillageScan({ settlement, show, index }: { settlement: (typeof SETTLEMENTS)[number]; show: boolean; index: number }) {
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isMd = useMediaQuery("(min-width: 768px)");
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const anchor = useRef<THREE.Group>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const opacity = useRef("0");
  const zone = isLg ? LG : isMd ? MD : SM;
  const [hx, hz] = [settlement.size[0] / 2 + MARGIN, settlement.size[1] / 2 + MARGIN];
  const lift = settlement.top - settlement.centre[1];

  useFrame(() => {
    const a = anchor.current;
    const w = wrapper.current;
    const f = frame.current;
    if (!a || !w || !f) return;
    a.getWorldPosition(projected);
    projected.project(camera);
    const swept = sweptByWipe(projected);
    let visible = show && projected.z < 1 && !swept && (Math.abs(projected.x) > zone.x || Math.abs(projected.y) > zone.y);
    if (visible) {
      // Screen rectangle of the footprint box (ground to roof height), placed relative to the anchor's point.
      const ax = (projected.x + 1) * 0.5 * size.width;
      const ay = (1 - projected.y) * 0.5 * size.height;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const sx of [-hx, hx]) for (const sz of [-hz, hz]) for (const sy of [0, lift]) {
        a.localToWorld(_corner.set(sx, sy, sz)).project(camera);
        const px = (_corner.x + 1) * 0.5 * size.width;
        const py = (1 - _corner.y) * 0.5 * size.height;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      const wpx = Math.max(x1 - x0, MIN_PX);
      const hpx = Math.max(y1 - y0, MIN_PX);
      const top = (y0 + y1) / 2 - hpx / 2; // absolute px from the canvas top
      // Keep frames (and their tag above) out from under the nav bar.
      visible = top > NAV_CLEAR;
      if (visible) {
        f.style.transform = `translate(${(x0 + x1) / 2 - ax - wpx / 2}px, ${top - ay}px)`;
        f.style.width = `${wpx}px`;
        f.style.height = `${hpx}px`;
      }
    }
    const op = visible ? "1" : "0";
    if (opacity.current !== op) {
      // Swept by the diagonal wipe: leave at once, as the ground under it does (the 500 ms fade trailed the cut).
      w.style.transitionDuration = swept ? "0s" : "";
      w.style.opacity = op;
      opacity.current = op;
    }
  });

  return (
    <group ref={anchor} position={settlement.centre}>
      <Html zIndexRange={[1, 2]}>
        <div ref={wrapper} className="relative opacity-0 transition-opacity duration-500 select-none" aria-hidden="true">
          <div ref={frame} className="village-scan absolute top-0 left-0" style={{ animationDelay: `${-index * 0.7}s` }}>
            <span className="village-scan-corner top-0 left-0 border-t border-l" />
            <span className="village-scan-corner top-0 right-0 border-t border-r" />
            <span className="village-scan-corner bottom-0 left-0 border-b border-l" />
            <span className="village-scan-corner right-0 bottom-0 border-r border-b" />
            <span className="village-scan-line" />
            <div className="absolute -top-4.5 left-0 flex items-stretch whitespace-nowrap font-mono text-m-mono leading-[0.75rem] uppercase">
              <span className="bg-yellow px-0.5 text-black">{settlement.name}</span>
              <span className="village-scan-status border-yellow text-yellow ml-px border px-0.5">Scanning</span>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

/** `groundY`: per-point tile-local height for a replacement ground mesh (POINTS order); defaults to the shipped y. */
export function DetectionPoints({ groundY, villages }: { groundY?: readonly number[]; villages?: boolean }) {
  const isSm = useMediaQuery("(max-width: 767px)");
  const isMdOnly = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  // Raven (user, 2026-11-02): the scan starts as soon as the flank drones have left the screen (Journey .85; they are
  // off screen by ~.7), not at Route .5. Route's own range keeps it on; band 2 (Route inactive) and thermal turn it off.
  const show = useScenes(
    useShallow((s) => {
      const det = s[SCENE.REAL_TIME_DETECTION];
      const inRoute = det.isActive || (s[SCENE.FLOCK_SCENE].progress > 0.85 && det.progress === 0);
      return inRoute && !s[SCENE.THERMAL_IRREGULARITY].isActive;
    }),
  );
  const limit = isSm ? 60 : isMdOnly ? 70 : 200;
  if (villages)
    return (
      <group dispose={null}>
        {SETTLEMENTS.filter((v) => Math.abs(v.centre[0]) < limit).map((v, i) => (
          <VillageScan key={i} settlement={v} show={show} index={i} />
        ))}
      </group>
    );
  return (
    <group dispose={null}>
      <group>
        {POINTS.filter((p) => Math.abs(p.position[0]) < limit).map((p, i) => (
          <DetectionBox
            key={i}
            position={groundY ? [p.position[0], groundY[p.index], p.position[2]] : p.position}
            label={p.label}
            show={show}
          />
        ))}
      </group>
    </group>
  );
}
