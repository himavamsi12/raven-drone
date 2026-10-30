"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import clsx from "clsx";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import * as THREE from "three";
import { buildingsRef, thermalState } from "@/lib/constants";
import { SCENE, useScenes } from "@/lib/scenes";
import { useMediaQuery } from "@/lib/use-media-query";

/** Dashed frame border (shipped `tl`). */
const DASHED: CSSProperties = {
  backgroundImage: `
    repeating-linear-gradient(0deg, rgba(255,255,255,0.8), rgba(255,255,255,0.8) 3px, transparent 3px, transparent 5.5px),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.8) 3px, transparent 3px, transparent 5.5px),
    repeating-linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0.8) 3px, transparent 3px, transparent 5.5px),
    repeating-linear-gradient(270deg, rgba(255,255,255,0.8), rgba(255,255,255,0.8) 3px, transparent 3px, transparent 5.5px)`,
  backgroundSize: "1px 100%, 100% 1px, 1px 100%, 100% 1px",
  backgroundPosition: "0 0, 0 0, 100% 0, 0 100%",
};

const v3 = new THREE.Vector3();
const source = new THREE.Vector2();
const target = new THREE.Vector2();
const goal = new THREE.Vector2();
const boxPos = new THREE.Vector2(0.5, 0.5);

type Phase = "intro" | "animating" | "idle";

/**
 * Thermal sensor frame that searches then locks onto the buildings; also feeds
 * the final post-effect's thermal-palette box (shipped `tv`).
 */
export function ThermalHud({ drone1Ref }: { drone1Ref: RefObject<THREE.Group | null> }) {
  const { size, camera, clock } = useThree();
  const setDone = useScenes((s) => s.setThermalIrregularityAnimationDone);
  const active = useScenes(
    (s) =>
      s[SCENE.THERMAL_IRREGULARITY].isActive &&
      s[SCENE.THERMAL_IRREGULARITY].progress > 0.99 &&
      s[SCENE.IGNITION_VERIFIED].progress < 0.02,
  );
  const md = useMediaQuery("(min-width: 768px)");
  const frame = useRef<HTMLDivElement>(null);
  const lock = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const lineA = useRef<SVGLineElement>(null);
  const lineB = useRef<SVGLineElement>(null);
  const wedge = useRef<SVGPolygonElement>(null);
  const gradient = useRef<SVGLinearGradientElement>(null);
  const timers = useRef<{ intro: ReturnType<typeof setTimeout> | null; anim: ReturnType<typeof setTimeout> | null }>({
    intro: null,
    anim: null,
  });
  const startedAt = useRef(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [firstRun, setFirstRun] = useState(true);

  useEffect(() => {
    if (timers.current.intro) clearTimeout(timers.current.intro);
    if (active) {
      timers.current.intro = setTimeout(() => {
        setPhase(firstRun ? "animating" : "idle");
        startedAt.current = clock.getElapsedTime() + 0.75;
        setFirstRun(false);
      }, 750);
    } else setPhase("intro");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (timers.current.anim) clearTimeout(timers.current.anim);
    if (phase === "animating") {
      timers.current.anim = setTimeout(() => {
        setPhase("idle");
        setDone();
      }, 3500);
    }
  }, [phase, setDone]);

  const locked = phase === "idle" || phase === "animating";

  useFrame((state) => {
    const f = frame.current;
    const l = lock.current;
    if (!svg.current || !lineA.current || !lineB.current || !wedge.current || !gradient.current || !f || !l || !active) {
      thermalState.shouldInvert = THREE.MathUtils.lerp(thermalState.shouldInvert, 0, 0.05);
      thermalState.pos.set(0, 0);
      thermalState.size.set(0, 0);
      return;
    }
    const elapsed = state.clock.getElapsedTime() - startedAt.current;
    const rect = f.getBoundingClientRect();
    if (drone1Ref.current && buildingsRef.current) {
      drone1Ref.current.localToWorld(v3.set(0, 0, -120));
      v3.project(camera);
      source.set(v3.x, v3.y);
      buildingsRef.current.getWorldPosition(v3);
      v3.project(camera);
      target.set(v3.x, v3.y);
      const w = size.width;
      const h = size.height;
      source.set(((source.x + 1) / 2) * w - (md ? 39 : 0), ((-source.y + 1) / 2) * h + (md ? 4 : -4));
      target.set(((target.x + 1) / 2) * w, ((-target.y + 1) / 2) * h);
      const searching = phase === "animating" ? 1 : 0;
      const step = Math.floor(elapsed);
      goal.set(
        target.x + searching * rect.width * 0.5 * Math.sign(Math.sin(step)),
        target.y + searching * rect.height * 0.33 * Math.sign(Math.cos(step)),
      );
      boxPos.lerp(goal, phase === "animating" ? 0.15 : phase === "intro" ? 1 : 0.02);
    }
    f.style.setProperty("transform", `translate(${boxPos.x}px, ${boxPos.y}px)`);
    l.style.setProperty("transform", `translate(${target.x}px, ${target.y}px)`);
    thermalState.pos.set(boxPos.x / size.width, boxPos.y / size.height);
    thermalState.size.set(rect.width / size.width, rect.height / size.height);
    thermalState.shouldInvert = THREE.MathUtils.lerp(thermalState.shouldInvert, locked ? 1 : 0, 0.05);
    thermalState.targetPos.set(target.x / size.width, target.y / size.height);

    const sx = source.x;
    const sy = source.y;
    const left = boxPos.x - rect.width / 2 - 1;
    const top = boxPos.y - rect.height / 2 - 1;
    const right = boxPos.x + rect.width / 2 + 1;
    const bottom = boxPos.y + rect.height / 2 + 1;
    lineA.current.setAttribute("x1", `${sx}`);
    lineA.current.setAttribute("y1", `${sy}`);
    lineA.current.setAttribute("x2", `${left}`);
    lineA.current.setAttribute("y2", `${md ? top : bottom}`);
    lineB.current.setAttribute("x1", `${sx}`);
    lineB.current.setAttribute("y1", `${sy}`);
    lineB.current.setAttribute("x2", `${right}`);
    lineB.current.setAttribute("y2", `${bottom}`);
    wedge.current.setAttribute(
      "points",
      md ? `${sx},${sy} ${left},${top} ${right},${bottom}` : `${sx},${sy} ${left},${bottom} ${right},${bottom}`,
    );
    gradient.current.setAttribute("x1", `${sx}`);
    gradient.current.setAttribute("y1", `${sy}`);
    gradient.current.setAttribute("x2", `${boxPos.x}`);
    gradient.current.setAttribute("y2", `${boxPos.y}`);
  });

  return (
    <Html sprite transform={false} calculatePosition={() => [size.width / 2, size.height / 2, 0]} fullscreen className="pointer-events-none">
      <svg
        ref={svg}
        width={size.width}
        height={size.height}
        className={clsx(
          "pointer-events-none absolute top-0 left-0 transition-opacity duration-150",
          active ? "opacity-100" : "opacity-0 duration-50",
        )}
        aria-hidden="true"
      >
        <defs>
          <linearGradient ref={gradient} id="thermal-wedge-gradient" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="white" stopOpacity={0.5} />
            <stop offset="80%" stopColor="white" stopOpacity={0} />
            <stop offset="100%" stopColor="white" stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon ref={wedge} fill="url(#thermal-wedge-gradient)" />
        <line ref={lineA} stroke="white" strokeWidth={1} strokeDasharray="3 2.5" opacity="0.8" />
        <line ref={lineB} stroke="white" strokeWidth={1} strokeDasharray="3 2.5" opacity="0.8" />
      </svg>
      <div className="absolute top-0 left-0">
        <div ref={frame} className={clsx("relative transition-opacity duration-150", active ? "opacity-100" : "opacity-0 duration-50")}>
          <div
            className={clsx(
              "origin-center -translate-1/2 transition-all duration-1000",
              phase === "animating"
                ? "h-13.5 w-23 delay-200 md:h-34.5 md:w-57"
                : phase === "intro"
                  ? "h-7 w-11.5 md:h-17 md:w-28.5"
                  : firstRun
                    ? "h-27.5 w-45.5 delay-1000 md:h-68.75 md:w-114"
                    : "h-27.5 w-45.5 md:h-68.75 md:w-114",
            )}
          >
            <div className={clsx("relative top-0 left-0 h-full w-full transition-opacity delay-250 duration-350", phase === "intro" ? "opacity-0" : "opacity-100")}>
              <div className={clsx("text-d-mono absolute -top-px -left-px hidden h-5 items-center bg-black/70 px-1 font-mono text-white uppercase opacity-0 transition-opacity delay-500 md:flex", phase !== "intro" && "opacity-100")}>
                Simulated heat view
              </div>
              <div className={clsx("text-d-mono absolute -right-px -bottom-px flex h-5 items-center bg-black/70 px-1 font-mono text-white uppercase opacity-0 transition-opacity delay-500", phase !== "intro" && "opacity-100")}>
                Cool
              </div>
              <div className={clsx("text-d-mono absolute -top-px -right-px flex h-5 items-center bg-black/70 px-1 font-mono text-white uppercase opacity-0 transition-opacity delay-500", phase !== "intro" && "opacity-100")}>
                Hot
              </div>
            </div>
            <div className="absolute -inset-px bg-no-repeat" style={DASHED} />
          </div>
        </div>
        <div
          ref={lock}
          className={clsx(
            "absolute top-0 left-0 transition-opacity duration-750",
            active && phase === "idle" ? "opacity-100" : "opacity-0",
            !active && "duration-50!",
          )}
        >
          <div className="z-1000 -translate-1/2 transition-opacity select-none">
            <div className="outline-red relative h-12 w-20 origin-top-left outline -outline-offset-1 transition-colors select-none" />
            <div className="text-d-mono bg-red absolute -top-3 flex h-3 items-center px-0.5 font-mono whitespace-nowrap text-black uppercase transition-colors">
              Hazard area
            </div>
          </div>
        </div>
      </div>
    </Html>
  );
}
