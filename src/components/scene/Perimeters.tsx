"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import clsx from "clsx";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { easeInOutCubic, remapEased } from "@/lib/math";
import { SCENE, useScenes } from "@/lib/scenes";
import { useMediaQuery } from "@/lib/use-media-query";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon, InfoIcon, NavigationArrowIcon, WarningIcon } from "@/components/ui/icons";
import { GroundHtml } from "./overlays/GroundHtml";

/** Hand-drawn zone outlines (shipped `eM`). */
const SHAPES = {
  center: {
    size: { width: 438, height: 342 },
    statusClassName: "left-22 top-17",
    path: "m408.562 139.339 4.539 11.57 6.602-2.48 3.301 6.199 2.476 2.479-1.238 20.247-5.777 1.24-9.903 10.33-2.888 12.81-3.302 4.132-2.063 9.091-5.777 4.958-.412 9.504.412 7.025-1.237 6.611 2.475 5.785c-.962 3.719-2.888 11.322-2.888 11.984 0 .661.275 3.581.413 4.958.412 1.928.907 6.694-.413 10.331-1.321 3.636-9.903 13.085-14.03 17.355-.962-.551-3.878-.496-7.84 4.132-4.951 5.785-23.52 11.983-30.122 15.702-6.602 3.719-37.137-7.438-52.817-9.504l-20.198-20.248L227.75 315l-75.375 27-24-3.375-16.91-19.125-4.126-2.892H93.7216C75.5657 308.343 78.4541 297.6 67.313 283.55c-11.1411-13.222-16.0928-23.553-23.5202-30.991-7.4274-7.438-14.0296-7.438-21.8696-19.421-7.8401-11.983 2.4758-14.875 2.4758-21.9 0-7.025-19.80616-14.049-12.7917-25.619 9.9032-11.57 1.6509-12.81-7.01446-21.488-10.31587-12.396 1.23791-26.445 8.66536-31.817 4.9516-10.744 18.1559-13.636 19.8065-23.553 1.6505-9.9174 6.6021-11.9835 9.4906-14.0496C45.4437 92.6454 49.25 84 56.1722 79.0093 59.9311 76.2992 63.0744 74.2038 65 72h116.25c6.19-2.4793 2.25-5.25 10.679-8.2796 10.321-3.7097 11.141-9.0908 21.044-18.1815 9.904-9.0907 35.9 10.3304 51.992 10.7436 12.875.3306 19.394-10.3304 21.045-15.7021l8.253-8.6776c1.65-2.3415 5.446-7.5205 7.427-9.5039.825-.8264 10.316-2.0661 13.617-5.785 4.621-11.23941 10.728-12.12093 13.204-11.15677.55 0 2.641-.33057 6.602-1.65285 4.952-1.65286 3.301 0 9.491 0 6.19 0 4.539 1.65285 10.728 0 6.19-1.65286 8.253.82642 11.967 1.65285 3.714.82643 5.364-4.95851 13.617-3.30565 11.554 3.30571 18.156-6.19822 35.074 0 13.534 4.95857 17.193 13.91152 17.33 17.76822 1.238 1.6529 3.714 8.0164 3.714 20.2475 0 15.2889 3.714 12.3964-5.777 20.6607-9.49 8.2643-1.65 18.5947 0 27.2722 1.651 8.6775 4.127 4.9585 5.777 14.8759 1.321 7.933-9.078 22.864-14.442 29.338l-14.03 7.025Z",
  },
  "top-left": {
    size: { width: 180, height: 143 },
    statusClassName: "right-0 -top-6.5",
    path: "M72.125 0h107.25v18l-3 5.625V27l-3 3.75v7.875L170 47.25l-.75 7.125-5.625 16.125L169.25 82l-5.625 18-8.625 2.5-6 3.5-2 5-8.5 1-2 5.5-3 12L92 134l-5.5 7-7 1.5-11-4.5-16.5-5-15-6.5-13.5-6-11-10-2.5-9L8 94l-5.25-4.5-2.750-7 2.750-6.375L3 71l-1.5-5 .5-6 6-2.5 4.5-4 3-5L18 44l5-2.5 6-1 5-5 1.375-8.875L34 19.5l5-5.5 8-4.5 4-6 12.5-2L72.125 0Z",
  },
  "bottom-left": {
    size: { width: 189, height: 158 },
    statusClassName: "left-7 -top-6.5",
    path: "M114.875 0H20.75v18l3 5.625V27l3 3.75v7.875l3.375 8.625.75 7.125L23 73.125 9.125 83.25H2.75L.5 88.875l4.5 10.5 1.5 6.375L20.75 112l15.75 9.5 14 22.5L85 158l25.5-7.5H126l13-4 13.5 11.5 9.5-2 6.5-4.5 5.5-7 6.875-4.5 5.125-2.5-7-6.5-3-12.5 3-6 5.25-11.5 4.25-12v-7l-4.25-5.875-1.875-5.625-6.75-10.125v-9l.375-6.75-4.5-4.125H164l-4.125-2.625-4.125-4.5-4.125-6.75-9.375-4.5-10.125-1.5-4.5-13.125-12.75-7.5Z",
  },
  "top-right": {
    size: { width: 185, height: 166 },
    statusClassName: "left-7 -top-6.5",
    path: "M114.625 0H20.5v18l3 5.625V27l3 3.75v7.875l3.375 8.625.75 7.125L39.25 64.5l-4.125 6.375-12.375 2.25L8.875 83.25H2.5L.25 88.875l4.5 10.5 1.5 6.375 22.5-3.375L44.5 103.5l19.5 8.625L83.125 124.5l69.375 40.875 4.5-7.875-.75-4.5 3-9 6.375-4.5 9.375-5.25 5.625-10.125-1.875-5.25V112.5l6-6.75V90l-1.875-4.875 1.125-9-1.875-5.625-6.75-10.125v-9l.375-6.75-4.5-4.125h-7.5l-4.125-2.625-4.125-4.5-4.125-6.75-9.375-4.5-10.125-1.5-4.5-13.125-12.75-7.5Z",
  },
  "bottom-right": {
    size: { width: 150, height: 195 },
    statusClassName: "left-3.5 -top-6.5",
    path: "m132 31.5-18.5-7L98 17l-16.5-6.5L66 0H10l-.75 5.625V9l-.75 5-2 4.5 2 12-2 4.5 2 8L5 50l-3 8.5-2 11V77l2 6 6 8.5 2.5 11L33 124l3.5 8 5 7.5 3 4.5-.5 4.5.5 3L50 155l2.5 5.5 3.5 6 5.5-.5 3.5 1.5h5.5L73 173l5.5 3 3 3 8.5 3.5 7.5-1.5 4 9.5L112 195l8-4.5 8-8 5-1.5 2.5-7 10-1 2-4-1-3.5 3-3.5-4-8.5 1-5.5 2.5-5-6-4.5-3.5-7-4-3 8.5-5.5 2.5-5.5 1-7-3.5-1-4.5-5.5-2-6 .75-4-2.75-2.5L134 89l-3.5-2.5 1-7.5-1-4.5L133 72v-4.875L134 57l-2-10-1.5-8.375L132 31.5Z",
  },
} as const;

type ShapeName = keyof typeof SHAPES;
type Status = { variant: "danger" | "warning" | "safe"; text: string };

const STATUS_STYLE = {
  danger: { variant: "danger" as const, icon: WarningIcon },
  warning: { variant: "warning" as const, icon: InfoIcon },
  safe: { variant: "success" as const, icon: CheckIcon },
};

function Zone({ name, className, status, badge = false, hidden }: { name: ShapeName; className?: string; status?: Status; badge?: boolean; hidden?: boolean }) {
  const { size, path, statusClassName } = SHAPES[name];
  return (
    <div className={clsx("pointer-events-none relative scale-300 scale-3d transition-opacity duration-500", hidden ? "opacity-0" : "opacity-100", className)}>
      <svg fill="none" viewBox={`-1 -1 ${size.width + 2} ${size.height + 2}`} aria-hidden="true">
        <path d={path} fill="#fff" fillOpacity={badge ? ".05" : "0"} stroke="#fff" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeOpacity={badge ? "1" : ".25"} />
      </svg>
      {status && badge && (
        <div className={clsx("!absolute transition-opacity duration-500 ease-in-out", statusClassName, hidden ? "opacity-0" : "opacity-100")}>
          <Badge variant={STATUS_STYLE[status.variant].variant} icon={STATUS_STYLE[status.variant].icon}>
            {status.text}
          </Badge>
        </div>
      )}
    </div>
  );
}

/** Zone drawn twice: badge layer + offset ghost layer on md+ (shipped `eE`). */
function Perimeter({ position, ...props }: { position: [number, number, number]; name: ShapeName; className?: string; status?: Status; hidden?: boolean }) {
  const md = useMediaQuery("(min-width: 768px)");
  return (
    <group position={position} scale={0.33}>
      <GroundHtml position={[0, 0, 0]}>
        <Zone {...props} badge />
      </GroundHtml>
      {md && (
        <GroundHtml position={[0, -0.33, 0]}>
          <Zone {...props} />
        </GroundHtml>
      )}
    </group>
  );
}

const DOT = {
  neutral: { text: "text-neutral-50", glow: "bg-neutral-50", ring: "border-neutral-50/15 from-neutral-50/0 to-neutral-50/50 bg-neutral", core: "bg-neutral-50 shadow-neutral-50" },
  green: { text: "text-green", glow: "bg-green", ring: "border-green/55 bg-green/50", core: "bg-green shadow-green" },
  yellow: { text: "text-yellow", glow: "bg-yellow", ring: "border-yellow/55 bg-yellow/50", core: "bg-yellow shadow-yellow" },
  red: { text: "text-red", glow: "bg-red", ring: "border-red/55 bg-red/50", core: "bg-red shadow-red" },
};
type DotVariant = keyof typeof DOT;

/** Rippling focus point (shipped `e_`, `eU`, `ez`). */
function FocusDot({ variant, position, hidden }: { variant: DotVariant; position: [number, number, number]; hidden?: boolean }) {
  const v = DOT[variant];
  return (
    <GroundHtml position={position} transform zIndexRange={[200, 300]}>
      <div className={clsx("relative transition-colors duration-500 opacity-0 transition-opacity", v.text, !hidden && "opacity-100")}>
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={clsx(
              "animate-ripple border-px pointer-events-none absolute top-1/2 left-1/2 size-16 origin-center -translate-x-1/2 -translate-y-1/2 rounded-full border-1 from-50% to-100% transition-all duration-500",
              v.ring,
            )}
            style={{ animationDelay: `${-1.5 * i}s` }}
          />
        ))}
        <div className={clsx("absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-radial from-50% to-100% shadow-[0px_0px_4px_var(--tw-shadow-color)] transition-all duration-500", v.core)} />
        <div className={clsx("absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-xl transition-colors duration-500", v.glow)} />
      </div>
    </GroundHtml>
  );
}

/** Samples 10 points of an SVG path into a ground-plane curve (shipped `eG`). */
function curveFromPath(d: string, viewBox: string) {
  try {
    const m = viewBox.match(/(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (!m) return null;
    const w = parseFloat(m[3]);
    const h = parseFloat(m[4]);
    const ratio = h / w;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    const len = path.getTotalLength();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 10; i++) {
      const p = path.getPointAtLength((i / 9) * len);
      pts.push(new THREE.Vector3((p.x / w) * 0.5 * (ratio > 1 ? 1 : 1 / ratio), 0, (p.y / h) * 0.5 * (ratio < 1 ? 1 : ratio)));
    }
    return new THREE.CatmullRomCurve3(pts, false);
  } catch {
    return null;
  }
}

/** Responder unit moving along its approach curve (shipped `eH`). */
function Responder({ position, className, progress, pathData, viewBox, label }: { position: [number, number, number]; className?: string; progress: number; pathData: string; viewBox: string; label: string }) {
  const ref = useRef<THREE.Group>(null);
  const curve = useRef<THREE.CatmullRomCurve3 | null>(null);
  const active = useScenes((s) => s[SCENE.INTEGRATED_NOTIFICATIONS].isActive);
  useEffect(() => {
    curve.current = curveFromPath(pathData, viewBox);
    return () => {
      curve.current = null;
    };
  }, [pathData, viewBox]);
  useFrame(() => {
    if (!active || !ref.current || !curve.current) return;
    const p = curve.current.getPointAt(progress);
    const n = curve.current.getPointAt(Math.min(progress + 0.02, 1));
    const dx = n.x - p.x;
    const dz = n.z - p.z;
    if (Math.sqrt(dx * dx + dz * dz) < 1e-4) {
      ref.current.position.copy(p);
      return;
    }
    ref.current.position.copy(p);
    ref.current.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(dz, dx));
  });
  return (
    <group position={position} scale={1.25}>
      <group ref={ref}>
        <GroundHtml position={[0, 0, 0]} zIndexRange={[200, 300]}>
          <NavigationArrowIcon className={clsx("text-green absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rotate-135 drop-shadow-[0px_0px_8px_rgba(122,235,255,0.5)] transition-opacity", className)} />
        </GroundHtml>
        <Html transform={false} zIndexRange={[200, 300]} className="translate-y-[calc(-100%-1.5rem)]">
          <div className={clsx("relative min-h-12 transition-opacity md:min-h-18 lg:min-h-25", className)}>
            <div className="from-green absolute top-0 left-0 h-full w-0.5 bg-gradient-to-b to-transparent" />
            <span className="text-green text-d-mono relative ml-2 inline-block -translate-y-2 font-mono whitespace-nowrap uppercase">{label}</span>
          </div>
        </Html>
      </group>
    </group>
  );
}

function Responders() {
  const show = useScenes((s) => s[SCENE.INTEGRATED_NOTIFICATIONS].progress > 0 && s[SCENE.INTEGRATED_NOTIFICATIONS].progress < 0.99);
  const progress = useScenes((s) => remapEased(s[SCENE.INTEGRATED_NOTIFICATIONS].progress, 0.25, 0.99, 0, 1, easeInOutCubic));
  const cls = show ? "opacity-100" : "opacity-0";
  return (
    <>
      <Responder position={[-3, 0, 2]} progress={progress} pathData="M0.489136 97.9961C6.48914 69.6628 39.3891 10.4961 122.989 0.496094" viewBox="0 0 124 99" className={cls} label="Police" />
      <Responder position={[0.25, 0, -2.25]} progress={progress} pathData="M63.4999 0.398438C42.6665 16.2318 2.09988 60.8984 0.499878 142.898" viewBox="0 0 64 143" className={cls} label="Firefighters" />
      <Responder position={[2.9, 0, -1]} progress={progress} pathData="M177.622 0.263672C160.788 27.4303 92.5217 68.0637 0.121704 91.2637" viewBox="0 0 179 92" className={cls} label="Ambulance" />
      <Responder position={[2.35, 0, 1.5]} progress={progress} pathData="M146.607 101.488C144.773 68.6549 128.507 28.4883 0.106567 0.488281" viewBox="0 0 148 102" className={cls} label="Emergency Services" />
    </>
  );
}

const MULTI_STATES: Record<"perimeter_1" | "perimeter_2" | "perimeter_3", { perimeter: { status: Status; hidden?: boolean }; focusAreas: DotVariant }>[] = [
  {
    perimeter_1: { perimeter: { status: { variant: "danger", text: "Hazard Area" }, hidden: true }, focusAreas: "red" },
    perimeter_2: { perimeter: { status: { variant: "danger", text: "Active Zone" }, hidden: true }, focusAreas: "red" },
    perimeter_3: { perimeter: { status: { variant: "danger", text: "Alert Area" }, hidden: true }, focusAreas: "red" },
  },
  {
    perimeter_1: { perimeter: { status: { variant: "danger", text: "Hazard Area" } }, focusAreas: "red" },
    perimeter_2: { perimeter: { status: { variant: "danger", text: "Active Zone" } }, focusAreas: "red" },
    perimeter_3: { perimeter: { status: { variant: "danger", text: "Alert Area" } }, focusAreas: "red" },
  },
  {
    perimeter_1: { perimeter: { status: { variant: "safe", text: "Zone Stabilized" } }, focusAreas: "green" },
    perimeter_2: { perimeter: { status: { variant: "safe", text: "Zone Stabilized" } }, focusAreas: "green" },
    perimeter_3: { perimeter: { status: { variant: "safe", text: "Area Contained" } }, focusAreas: "green" },
  },
];

/** Multi-threat response zones (shipped `eV`). */
function MultiThreatZones() {
  const md = useMediaQuery("(min-width: 768px)");
  const engaged = useScenes((s) => s[SCENE.MULTI_THREAT_RESPONSE].progress > 0.5);
  const resolved = useScenes((s) => s[SCENE.MULTI_THREAT_RESPONSE].progress > 0.9);
  const { perimeter_1: a, perimeter_2: b, perimeter_3: c } = MULTI_STATES[resolved ? 2 : engaged ? 1 : 0];
  return (
    <>
      <Perimeter name="top-left" className="w-[240px]" {...a.perimeter} position={[-7.04, 0, -0.92]} />
      <FocusDot variant={a.focusAreas} position={[-7.09, 0, -1.04]} hidden={!engaged} />
      <group position={md ? [0, 0, 0] : [8, 0, -6.5]}>
        <Perimeter name="bottom-left" className="w-[250px]" {...b.perimeter} position={[-6.545, 0, 2.51]} />
        <FocusDot variant={b.focusAreas} position={[-6.575, 0, 2.46]} hidden={!engaged} />
      </group>
      <group position={md ? [0, 0, 0] : [-9.5, 0, -6.5]}>
        <Perimeter name="bottom-right" className="w-[200px]" {...c.perimeter} position={[8, 0, 3.05]} />
        <FocusDot variant={c.focusAreas} position={[7.69, 0, 2.26]} hidden={!engaged} />
        <FocusDot variant={c.focusAreas} position={[8.15, 0, 3.3]} hidden={!engaged} />
      </group>
    </>
  );
}

const SURVEY: { status: Status; hidden?: boolean }[] = [
  { status: { variant: "warning", text: "Survey Area" }, hidden: true },
  { status: { variant: "warning", text: "Survey Area" } },
  { status: { variant: "danger", text: "Active Threats" } },
  { status: { variant: "safe", text: "Services on site" } },
];
const SENSITIVE: { status: Status; hidden?: boolean }[] = [
  { status: { variant: "warning", text: "Sensitive Area" }, hidden: true },
  { status: { variant: "warning", text: "Sensitive Area" } },
  { status: { variant: "danger", text: "Alert Area" } },
  { status: { variant: "safe", text: "Area Secured" } },
];

/** Phalanx/analysis/notification zones on the city tile (shipped `e1`). */
export function Perimeters() {
  const dotsOn = useScenes((s) => s[SCENE.PHALANX_AI].progress > 0.5);
  const surveyOn = useScenes((s) => s[SCENE.PHALANX_AI].progress > 0.75);
  const analysed = useScenes((s) => s[SCENE.ANALYSIS_EVALUATION].progress === 1);
  const notified = useScenes((s) => s[SCENE.INTEGRATED_NOTIFICATIONS].progress > 0.99);
  const coordDots = useScenes((s) => s[SCENE.INTERDRONE_COORDINATION].progress > 0.1);
  const coordZone = useScenes((s) => s[SCENE.INTERDRONE_COORDINATION].progress > 0.25);
  const supportOn = useScenes((s) => s[SCENE.EXTRA_SUPPORT].progress > 0.75);
  const stabilized = useScenes((s) => s[SCENE.ZONE_STABILIZED].progress > 0.99);
  const centerVariant: DotVariant = notified ? "green" : analysed ? "red" : "yellow";
  return (
    <>
      <Perimeter name="center" className="w-[581px]" {...SURVEY[notified ? 3 : analysed ? 2 : surveyOn ? 1 : 0]} position={[-0.0475, 0, 0.56]} />
      <FocusDot variant={centerVariant} position={[1.6, 0.01, -0.35]} hidden={!dotsOn} />
      <FocusDot variant={centerVariant} position={[-1.15, 0.01, 0.2]} hidden={!dotsOn} />
      <FocusDot variant={centerVariant} position={[1.1, 0.01, 1.7]} hidden={!dotsOn} />
      <Perimeter name="top-right" className="w-[245px]" {...SENSITIVE[stabilized ? 3 : supportOn ? 2 : coordZone ? 1 : 0]} position={[5.28, 0, -0.53]} />
      <FocusDot variant={stabilized ? "green" : supportOn ? "red" : "yellow"} position={[5.4, 0.01, -0.72]} hidden={!coordDots} />
      <Responders />
      <MultiThreatZones />
    </>
  );
}
