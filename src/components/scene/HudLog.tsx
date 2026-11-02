"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { SCENE, useScenes, type SceneId } from "@/lib/scenes";
import { useMediaQuery } from "@/lib/use-media-query";

type Line = { label: ReactNode; scene: SceneId; progress: number };

/**
 * Mission log trigger points from shipped module 76772 (`Xy` / `gc`); Raven wording. Scripted display labels for the
 * illustrated scenario, not backend events or telemetry.
 */
const HEADER: Line[] = [
  { label: "ILLUSTRATIVE DELIVERY", scene: "flock-scene", progress: 0.1 },
  { label: "FROM: REGIONAL HEALTH CENTRE", scene: "flock-scene", progress: 0.15 },
  { label: "DESTINATION: HILL CLINIC", scene: "flock-scene", progress: 0.2 },
  { label: "REQUEST: MEDICAL SUPPLIES", scene: "flock-scene", progress: 0.25 },
  // Route lines start with the scan, once the flank drones have left (user, 2026-11-02; were Route .25-.4).
  { label: "ROUTE VIEW", scene: "flock-scene", progress: 0.86 },
  { label: "TERRAIN AND RIDGES SHOWN", scene: "flock-scene", progress: 0.9 },
  { label: "ROAD ACCESS SHOWN", scene: "flock-scene", progress: 0.94 },
  { label: "VILLAGES IN VIEW", scene: "flock-scene", progress: 0.98 },
];

const BODY: Line[] = [
  { label: <span className="text-yellow">ROUTE VIEW</span>, scene: "phalanx-ai", progress: 0.75 },
  { label: "DESTINATION: HILL CLINIC", scene: "phalanx-ai", progress: 0.8 },
  { label: "SHARED VIEW: CARE TEAMS", scene: "phalanx-ai", progress: 0.85 },
  { label: "HAZARD NOTED ON ROUTE", scene: "phalanx-ai", progress: 0.9 },
  // Review → Network lines removed with those chapters (user, 2026-11-03).
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
                // Lines of the other section leave at once: at the end of the diagonal wipe the clip comes off as the
                // story jumps from Route to Care teams, and a fade let the Route lines flash back (user, 2026-11-03).
                transition={{ duration: inSection ? 0.25 : 0, ease: "easeOut" }}
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
