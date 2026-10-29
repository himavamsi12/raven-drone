"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { SCENE, useScenes, type SceneId } from "@/lib/scenes";
import { useMediaQuery } from "@/lib/use-media-query";

type Line = { label: ReactNode; scene: SceneId; progress: number };

/** Mission log lines + trigger points (shipped module 76772 `Xy` / `gc`). Scripted demo content. */
const HEADER: Line[] = [
  { label: "BOOT SEQUENCE…", scene: "flock-scene", progress: 0.1 },
  { label: "THERMAL / LIDAR / RGB / IR [ONLINE]", scene: "flock-scene", progress: 0.15 },
  { label: "AI: 2 AGENTS / DUAL GPU [ACTIVE]", scene: "flock-scene", progress: 0.2 },
  { label: "LINK: PHALANX SYSTEM [ESTABLISHED]", scene: "flock-scene", progress: 0.25 },
  { label: "SCAN MODE: ACTIVE", scene: "real-time-detection", progress: 0.25 },
  { label: "COORD: [37.4419°N / 119.8772°W]", scene: "real-time-detection", progress: 0.3 },
  { label: "ALT 1,240M | SPEED 74 KM/H", scene: "real-time-detection", progress: 0.35 },
  { label: "32 CAR / 4 TRUCK / 1 PERSON / 2 UAV", scene: "real-time-detection", progress: 0.4 },
  { label: "ALERT: THERMAL ANOMALY", scene: "thermal-irregularity", progress: 0.45 },
  { label: "COORD: [37.4478°N / 119.8732°W]", scene: "thermal-irregularity", progress: 0.5 },
  { label: "TARGET ZONE LOCKED", scene: "thermal-irregularity", progress: 0.55 },
  { label: "EMERGENCY AGENCIES NOTIFIED", scene: "thermal-irregularity", progress: 0.6 },
  { label: "ALERT: THERMAL ANOMALY", scene: "ignition-verified", progress: 0.15 },
  { label: "COORD: [37.4478°N / 119.8732°W]", scene: "ignition-verified", progress: 0.2 },
  { label: "SIG INTENSITY: 87%", scene: "ignition-verified", progress: 0.25 },
  { label: "CLASSIFICATION: POTENTIAL THREAT", scene: "ignition-verified", progress: 0.3 },
];

const BODY: Line[] = [
  { label: <span className="text-yellow">SURVEY AREA</span>, scene: "phalanx-ai", progress: 0.75 },
  { label: "COORD: [37.4478°N / 119.8732°W]", scene: "phalanx-ai", progress: 0.8 },
  { label: "SIG INTENSITY: 87%", scene: "phalanx-ai", progress: 0.85 },
  { label: "alert: POTENTIAL THREATs", scene: "phalanx-ai", progress: 0.9 },
  { label: "2 DRONES ASSIGNED TO TARGET AREA", scene: "analysis-evaluation", progress: 0.1 },
  {
    label: (
      <>
        <span className="text-red">2 WILDFIRES</span> + <span className="text-red">1 ROADBLOCK</span> DETECTED{" "}
      </>
    ),
    scene: "analysis-evaluation",
    progress: 0.95,
  },
  { label: "AUTHORITIES CONTACTED", scene: "integrated-notifications", progress: 0.1 },
  {
    label: (
      <>
        AREA STATUS: <span className="text-green">SECURED</span>
      </>
    ),
    scene: "integrated-notifications",
    progress: 0.95,
  },
  { label: "sensitive area ESTABLISHED", scene: "extra-support", progress: 0.05 },
  { label: "COORD: [37.4478°N / 119.8732°W]", scene: "extra-support", progress: 0.1 },
  { label: "DRONE ASSIGNED TO TARGET AREA", scene: "extra-support", progress: 0.3 },
  { label: "CONFIRMED ON LOCATION", scene: "extra-support", progress: 0.75 },
  {
    label: (
      <>
        <span className="text-red">WILDFIRE</span> NEAR ELECTRICAL STATION
      </>
    ),
    scene: "extra-support",
    progress: 0.85,
  },
  {
    label: (
      <>
        <span className="text-green">FIREFIGHTER</span> UNITS ALERTED
      </>
    ),
    scene: "zone-stabilized",
    progress: 0.99,
  },
  { label: "RISK LEVEL: REDUCED", scene: "zone-stabilized", progress: 0.994 },
  {
    label: (
      <>
        AREA STATUS: <span className="text-green">SECURED</span>
      </>
    ),
    scene: "zone-stabilized",
    progress: 0.998,
  },
];

const ALL = [...HEADER.map((l) => ({ ...l, section: "header" as const })), ...BODY.map((l) => ({ ...l, section: "body" as const }))];

/** Scrolling mission log, newest four lines visible (shipped `nd`). */
export function HudLog() {
  const md = useMediaQuery("(min-width: 768px)");
  const [section, headerCount, bodyCount] = useScenes(
    useShallow((s) => {
      let sec: "none" | "header" | "body" = "none";
      let h = 0;
      let b = 0;
      if (s[SCENE.PHALANX_AI].progress < 0.5 && s[SCENE.DELTA_DRONE].progress > 0) {
        sec = "header";
        h = HEADER.filter((l) => s[l.scene].progress > l.progress).length;
      }
      if (s[SCENE.PHALANX_AI].progress > 0.15 && s[SCENE.MULTI_THREAT_RESPONSE].progress < 0.8) {
        sec = "body";
        b = BODY.filter((l) => s[l.scene].progress > l.progress).length;
      }
      return [sec, h, b] as const;
    }),
  );
  const cursor = section === "header" ? headerCount : HEADER.length + bodyCount;
  const last = useRef(0);
  if (section !== "none" && (section === "header" ? headerCount : bodyCount) > 0) last.current = cursor;
  const gap = md ? 8 : 4;
  const scrolled = Math.max(0, last.current - 4);

  return (
    <div
      aria-live="polite"
      className={clsx(
        "z-navbar absolute top-18 left-4 items-end justify-end opacity-0 md:top-22 md:left-8 md:min-w-sm md:pl-0 lg:top-auto lg:right-8 lg:bottom-10 lg:left-auto lg:flex",
        section !== "none" && "opacity-100",
      )}
    >
      <div className="relative overflow-hidden" style={{ height: 64 + 3 * gap }}>
        <motion.div
          className="flex flex-col gap-1 md:gap-2 lg:items-end lg:text-right"
          animate={{ y: -(scrolled * (16 + gap)) }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {ALL.map((line, i) => {
            const isHeader = line.section === "header";
            const local = isHeader ? i : i - HEADER.length;
            const inSection = line.section === section;
            const count = isHeader ? headerCount : bodyCount;
            const slot = local - Math.max(0, count - 4);
            let opacity = 0;
            if (inSection && local < count && slot >= 0 && slot < 4) opacity = count <= 2 ? 1 : slot < 2 ? 0.5 + 0.25 * slot : 1;
            return (
              <motion.p
                key={i}
                animate={{ opacity }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="text-d-mono relative origin-center font-mono whitespace-nowrap uppercase"
                style={{ height: 16 }}
              >
                {line.label}
              </motion.p>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
