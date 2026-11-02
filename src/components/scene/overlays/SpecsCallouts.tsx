"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef } from "react";
import { SCENE, useScenes } from "@/lib/scenes";
import { useMediaQuery } from "@/lib/use-media-query";
import { GroundHtml } from "./GroundHtml";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { cameraTilt, TILT_ELEVATION } from "../camera-tilt";

const EASE_OUT_CUBIC = [0.33, 1, 0.68, 1] as const;

/** Visibility gate measured in the bundle: delta-drone > .9 and swarm < .01. */
const useSpecsVisible = () =>
  useScenes((s) => s[SCENE.DELTA_DRONE].progress > 0.9 && s[SCENE.SWARM_SCENE].progress < 0.01);

function Gradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0" />
        <stop offset="50%" stopColor="#fff" stopOpacity="1" />
        <stop offset="100%" stopColor="#fff" stopOpacity="1" />
      </linearGradient>
    </defs>
  );
}

function LeaderPath({ d, gradient, show }: { d: string; gradient: string; show: boolean }) {
  return (
    <motion.path
      d={d}
      stroke={`url(#${gradient})`}
      strokeWidth="1"
      fill="none"
      vectorEffect="non-scaling-stroke"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: show ? 1 : 0, opacity: show ? 1 : 0 }}
      transition={{ duration: show ? 0.8 : 0.15, delay: show ? 0.3 : 0, ease: show ? EASE_OUT_CUBIC : "easeOut" }}
    />
  );
}

function EndSquare({ show, className }: { show: boolean; className: string }) {
  return (
    <motion.div
      className={clsx("absolute size-2 bg-white", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: show ? 0.3 : 0.15, delay: show ? 1.1 : 0, ease: "easeOut" }}
    />
  );
}

/** Mobile/tablet elbow leaders (shipped `ty`, `tw`, `tb`, `tj`). */
function BottomLeft() {
  const md = useMediaQuery("(min-width: 768px)");
  const show = useSpecsVisible();
  return (
    <div className="absolute -top-45.5 -left-1.5 md:-top-58">
      <svg width="182" height={md ? 330 : 280} viewBox={md ? "0 0 182 330" : "0 0 182 280"} fill="none">
        <Gradient id="bottomLeftGradient" />
        <LeaderPath d={md ? "M0.5 329.5V0.499997H181.5" : "M0.5 279.5V0.499997H181.5"} gradient="bottomLeftGradient" show={show} />
      </svg>
      <EndSquare show={show} className="-top-1 -right-1" />
    </div>
  );
}

function BottomRight() {
  const md = useMediaQuery("(min-width: 768px)");
  const show = useSpecsVisible();
  return (
    <div className="absolute -top-31 -left-1.5 md:-top-30">
      <svg width="1" height={md ? 201 : 205} viewBox={md ? "0 0 1 201" : "0 0 1 205"} fill="none">
        <Gradient id="bottomRightGradient" />
        <LeaderPath d={md ? "M0.5 201L0.500009 -3.57628e-06" : "M0.5 205L0.500009 -3.57628e-06"} gradient="bottomRightGradient" show={show} />
      </svg>
      <EndSquare show={show} className="-top-1 -right-1" />
    </div>
  );
}

function TopLeft() {
  const md = useMediaQuery("(min-width: 768px)");
  const show = useSpecsVisible();
  return (
    <div className="absolute -top-11 -left-1.5">
      <svg width={md ? 88 : 136} height={md ? 292 : 224} viewBox={md ? "0 0 88 292" : "0 0 136 224"} fill="none">
        <defs>
          <linearGradient id="topLeftGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="30%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
        </defs>
        <LeaderPath d={md ? "M0.5 0V291H87.5" : "M0.5 0V223H136.5"} gradient="topLeftGradient" show={show} />
      </svg>
      <EndSquare show={show} className="-right-1 -bottom-1" />
    </div>
  );
}

function TopRight() {
  const md = useMediaQuery("(min-width: 768px)");
  const show = useSpecsVisible();
  return (
    <div className="absolute -top-11 -left-1.5">
      <svg width="1" height={md ? 202 : 165} viewBox={md ? "0 0 1 202" : "0 0 1 165"} fill="none">
        <Gradient id="topRightGradient" />
        <LeaderPath d={md ? "M0.5 0L0.500009 202" : "M0.5 0L0.500009 165"} gradient="topRightGradient" show={show} />
      </svg>
      <EndSquare show={show} className="-right-1 -bottom-1" />
    </div>
  );
}

type Side = "top-left" | "top-right" | "bottom-left" | "bottom-right";

function Callout({
  title,
  description,
  className,
  desktopSide = "left",
  mobileSide = "top-left",
  staggerIndex = 0,
}: {
  title: string;
  description: string;
  className?: string;
  desktopSide?: "left" | "right";
  mobileSide?: Side;
  staggerIndex?: number;
}) {
  const show = useSpecsVisible();
  const dotDelay = show ? 0.1 * staggerIndex : 0;
  const lineDelay = show ? 0.25 + 0.1 * staggerIndex : 0;
  const headDelay = show ? 0.5 + 0.1 * staggerIndex : 0;
  const bodyDelay = show ? 0.75 + 0.1 * staggerIndex : 0;
  const headT = useMemo(() => ({ duration: 0.4, delay: headDelay, ease: "easeInOut" as const }), [headDelay]);
  const bodyT = useMemo(() => ({ duration: 0.4, delay: bodyDelay, ease: "easeInOut" as const }), [bodyDelay]);
  const exitT = { duration: 0.25, delay: 0, ease: "easeOut" as const };
  const right = desktopSide === "right";

  return (
    <div
      className={clsx(
        "relative flex size-64 w-[calc(min(50vw,_832px)-64px)] items-center lg:h-auto",
        (mobileSide === "top-left" || mobileSide === "bottom-left") && "-translate-x-44 lg:translate-x-0",
        (mobileSide === "top-right" || mobileSide === "bottom-right") && "translate-x-1.5 lg:translate-x-0",
        !right && "lg:-translate-x-[calc(min(50vw,_832px)-64px)]! lg:flex-row-reverse",
        className,
      )}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: show ? 1 : 0 }}
        transition={{ duration: show ? 0.5 : 0.3, delay: dotDelay, ease: "easeOut" }}
        className="hidden size-1 bg-white lg:block"
      />
      <motion.span
        initial={{ scaleX: 0 }}
        animate={{ scaleX: show ? 1 : 0 }}
        transition={{ duration: show ? 0.5 : 0.3, delay: lineDelay, ease: EASE_OUT_CUBIC }}
        style={{ transformOrigin: right ? "left" : "right" }}
        className={clsx(
          "hidden h-px w-full lg:block",
          right ? "bg-gradient-to-r from-white via-white to-transparent" : "bg-gradient-to-l from-white via-white to-transparent",
        )}
      />
      <div className="text [text-shadow:0_1px_14px_rgba(0,0,0,0.55)]">
        <AnimatePresence>
          {show && (
            <motion.h3
              key="heading"
              initial={{ opacity: 0, y: 8, color: "#FF2200" }}
              animate={{ opacity: 1, y: 0, color: "#FFFFFF" }}
              exit={{ opacity: 0, transition: exitT }}
              transition={headT}
              className={clsx("text-m-h3 lg:text-d-h3 absolute -top-11 w-42 lg:-top-11 lg:w-98", right ? "lg:right-0" : "lg:left-0")}
            >
              <span className="block w-38 lg:w-full">{title}</span>
            </motion.h3>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {show && (
            <motion.p
              key="paragraph"
              initial={{ opacity: 0, y: 8, color: "#FF2200" }}
              animate={{ opacity: 1, y: 0, color: "#FFFFFF" }}
              exit={{ opacity: 0, transition: exitT }}
              transition={bodyT}
              className={clsx("text-m-body-l lg:text-d-body-l absolute top-0 w-42 lg:top-4 lg:w-98", right ? "lg:right-0" : "lg:left-0")}
            >
              <span className="block w-40 lg:w-full">{description}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="contents lg:hidden">
        {mobileSide === "top-left" && <TopLeft />}
        {mobileSide === "bottom-left" && <BottomLeft />}
        {mobileSide === "bottom-right" && <BottomRight />}
        {mobileSide === "top-right" && <TopRight />}
      </div>
    </div>
  );
}

/** Four 3D-anchored spec callouts (shipped `tS`). Anchors live in drone-root space. */
export function SpecsCallouts() {
  const lg = useMediaQuery("(min-width: 1024px)");
  const md = useMediaQuery("(min-width: 768px)");
  // The anchors lie along world z under the drone. Seen from the oblique Airframe camera (camera-tilt.ts) that
  // spacing is foreshortened by sin(elevation): stretch it back so the four lines keep their top-view spacing.
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current) return;
    const stretch = 1 / Math.sin(TILT_ELEVATION) - 1;
    group.current.scale.z = 1 + stretch * cameraTilt.weight;
  });
  return (
    <group ref={group}>
      <GroundHtml transform={false} position={[0, 0, (lg ? -0.55 : md ? -1 : -1.25) - 0.025]}>
        <Callout
          title="Medical cargo"
          description="A case beneath the aircraft puts the delivery at the centre of the design."
          desktopSide="right"
          mobileSide="top-right"
          staggerIndex={1}
        />
      </GroundHtml>
      <GroundHtml transform={false} position={[0, 0, (lg ? -0.2 : md ? -1 : -1.25) - 0.025]}>
        <Callout
          title="Six rotors"
          description="Six arms carry propellers that spin in alternating directions."
          desktopSide="left"
          mobileSide="top-left"
          className="md:w-[calc(min(50vw,832px)-208px-64px)]!"
          staggerIndex={2}
        />
      </GroundHtml>
      <GroundHtml transform={false} position={[0, 0, (lg ? 0.15 : md ? 1 : 1.25) - 0.025]}>
        <Callout
          title="Remote clinics"
          description="The intended connection is between a health centre and the communities around it."
          desktopSide="right"
          mobileSide="bottom-left"
          staggerIndex={3}
        />
      </GroundHtml>
      <GroundHtml transform={false} position={[0, 0, lg ? 0.5 : md ? 1 : 1.25]}>
        <Callout
          title="Care teams"
          description="The journey ends with people receiving the supplies they need."
          desktopSide="left"
          staggerIndex={4}
          mobileSide="bottom-right"
        />
      </GroundHtml>
    </group>
  );
}
