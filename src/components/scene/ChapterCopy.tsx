"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentType, ElementType, ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScrollToScene } from "@/components/SmoothScroll";
import { Button } from "@/components/ui/Button";
import { useLoading } from "@/lib/loading";
import { SCENE, useScenes, type SceneId } from "@/lib/scenes";
import { useMediaQuery } from "@/lib/use-media-query";

const ENTER = { opacity: 0, y: 8, color: "#FF2200" };
const SETTLE = { opacity: 1, y: 0, color: "#FFFFFF" };
const EXIT = { opacity: 0, y: -8, color: "#FF2200" };

const HEADING = {
  h1: "text-m-h0 md:text-d-h0 [@media(min-width:48rem)_and_(max-height:37.5rem)]:!text-m-h0 max-w-204 text-shadow-[0px_1px_32px_rgba(0,0,0,0.25)]",
  h2: "text-m-h1 md:text-d-h1 [@media(min-width:48rem)_and_(max-height:37.5rem)]:!text-m-h1 max-w-204 text-shadow-[0px_1px_32px_rgba(0,0,0,0.25)]",
};

/** Animated chapter heading (shipped `t9`). */
function Heading({ children, className, as = "h1", variant = "h1" }: { children: ReactNode; className?: string; as?: "h1" | "h2"; variant?: keyof typeof HEADING }) {
  const Tag = (as === "h1" ? motion.h1 : motion.h2) as ElementType;
  return (
    <AnimatePresence mode="wait" propagate>
      <Tag
        key={as}
        initial={ENTER}
        animate={SETTLE}
        exit={EXIT}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className={clsx(HEADING[variant], className)}
      >
        {children}
      </Tag>
    </AnimatePresence>
  );
}

/** Supporting copy, delayed .2s (shipped `nn`). */
function Support({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <AnimatePresence mode="wait" propagate>
      <motion.p
        initial={ENTER}
        animate={SETTLE}
        exit={EXIT}
        transition={{ duration: 0.4, ease: "easeInOut", delay: 0.2 }}
        className={clsx(
          "text-m-h3 md:text-d-h3 [@media(min-width:48rem)_and_(max-height:37.5rem)]:!text-m-h3 text-pretty text-shadow-[0px_1px_32px_rgba(0,0,0,0.25)]",
          className,
        )}
      >
        {children}
      </motion.p>
    </AnimatePresence>
  );
}

/** CTA, delayed .4s (shipped `no`). */
function Cta(props: { className?: string; onClick?: () => void; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" propagate>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ delay: 0.4, duration: 0.4 }}>
        <Button withArrow {...props} />
      </motion.div>
    </AnimatePresence>
  );
}

/** Full-viewport padded frame (shipped `ne`). */
function Frame({ children, className, innerClassName }: { children: ReactNode; className?: string; innerClassName?: string }) {
  return (
    <div className={clsx("absolute inset-0 flex flex-col pt-18 pr-4 pb-4 pl-4 md:pt-20 md:pr-8 md:pb-10 md:pl-8", className)}>
      <div className={clsx("relative flex size-full flex-col justify-end gap-4 lg:block", innerClassName)}>{children}</div>
    </div>
  );
}

function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "bg-green/20 text-green text-m-body-l w-fit rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-[0px_1px_32px_rgba(0,0,0,0.25)] md:rounded-xl md:px-5 md:py-4 md:text-[1.375rem]/[1.5rem] md:tracking-normal",
        className,
      )}
    >
      {children}
    </span>
  );
}

const SWARM_TRAITS = [
  { title: "Autonomy", description: "Guided routes from health centre to village" },
  { title: "Scalability", description: "Connect more villages as the network grows" },
  { title: "Collaboration", description: "Coordinate deliveries with local care teams" },
  { title: "Coverage", description: "Reach communities beyond the road network" },
];

const bottomLeft = "bottom-0 left-0 lg:absolute lg:mr-70 lg:max-w-133.5";

function Hero() {
  const explore = useScrollToScene(SCENE.DELTA_DRONE);
  return (
    <Frame innerClassName="md:!block">
      <Heading>Delivering care beyond the last road</Heading>
      <div className="absolute right-0 bottom-0 contents w-133.5 flex-col gap-4 md:flex md:gap-6">
        <Support className="lg:max-w-128.5">
          Meet Raven. A medical delivery drone concept connecting remote mountain villages with the medicines and supplies they need.
        </Support>
        <Cta className="w-62.5" onClick={explore}>
          Scroll To Explore
        </Cta>
      </div>
    </Frame>
  );
}

function Swarm() {
  const short = useMediaQuery("(max-width: 768px), (max-height: 600px)");
  return (
    <Frame innerClassName="[@media(min-width:48rem)_and_(min-height:37.5rem)]:!block">
      <Heading as="h2" variant="h2">
        {short ? "The Raven Network" : "A connected network of care"}
      </Heading>
      <div className="right-0 bottom-0 contents w-168.75 flex-col gap-4 [@media(min-width:48rem)_and_(min-height:37.5rem)]:absolute [@media(min-width:48rem)_and_(min-height:37.5rem)]:flex [@media(min-width:48rem)_and_(min-height:37.5rem)]:gap-6">
        <Support className="[@media(min-width:48rem)_and_(max-height:37.5rem)]:max-w-xl">
          A coordinated delivery concept linking regional health centres with isolated villages across mountain valleys and cold, remote terrain.
        </Support>
        <AnimatePresence mode="wait" propagate>
          <motion.div initial={ENTER} animate={SETTLE} exit={EXIT} transition={{ duration: 0.4, ease: "easeInOut", delay: 0.4 }}>
            {SWARM_TRAITS.map((t) => (
              <div key={t.title} className="relative flex py-2 after:absolute after:inset-0 after:border-t after:border-white/40">
                <p className="text-m-body-l md:text-d-body-l [@media(min-width:48rem)_and_(max-height:37.5rem)]:!text-m-body-l w-29.5 text-white md:w-35.5">{t.title}</p>
                <p className="text-m-body-l md:text-d-body-l [@media(min-width:48rem)_and_(max-height:37.5rem)]:!text-m-body-l flex-1 text-white/80">{t.description}</p>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </Frame>
  );
}

function Mission() {
  const start = useScrollToScene(SCENE.FLOCK_SCENE);
  return (
    <Frame innerClassName="md:!block">
      <div className="contents w-full flex-wrap justify-between gap-4 md:flex">
        <Heading as="h2" variant="h2" className="whitespace-nowrap">
          Plan the delivery
        </Heading>
        <div className="flex flex-col gap-4 md:gap-6 lg:max-w-204">
          <Support>
            Plan a medical supply route from a regional health centre to a remote village, accounting for terrain, access and changing weather.
          </Support>
          <Cta className="w-62.5" onClick={start}>
            Explore the Route
          </Cta>
        </div>
      </div>
    </Frame>
  );
}

const simple = (title: ReactNode | null, body: string, bodyClass = bottomLeft) =>
  function Chapter() {
    return (
      <Frame>
        {title !== null && (
          <Heading as="h2" variant="h2">
            {title}
          </Heading>
        )}
        <Support className={bodyClass}>{body}</Support>
      </Frame>
    );
  };

function Thermal() {
  const done = useScenes((s) => s.thermalIrregularityAnimationState);
  return (
    <Frame>
      <Heading as="h2" variant="h2">
        <span>Route hazard</span>
        <br />
        <span className="inline-flex items-center gap-2 md:gap-4">
          detected <Pill className={clsx("opacity-0 transition-opacity duration-500", done === "done" && "opacity-100")}>M-1 Success</Pill>
        </span>
      </Heading>
      <Support className={bottomLeft}>
        A simulated heat and smoke alert flags a hazard along the route so the care team can review delivery access.
      </Support>
    </Frame>
  );
}

type Window = { startScene: SceneId; startSceneProgress: number; endScene?: SceneId; endSceneProgress?: number };

/** Chapter copy + time windows, verbatim order from shipped `nl`. */
const CHAPTERS: { component: ComponentType; timeWindow: Window }[] = [
  { component: Hero, timeWindow: { startScene: SCENE.INTRO_SCENE, startSceneProgress: 0, endScene: SCENE.DELTA_DRONE, endSceneProgress: 0.075 } },
  { component: Swarm, timeWindow: { startScene: SCENE.SWARM_SCENE, startSceneProgress: 0.75, endScene: SCENE.MISSION_PRESET, endSceneProgress: 0.075 } },
  { component: Mission, timeWindow: { startScene: SCENE.MISSION_PRESET, startSceneProgress: 0.75, endScene: SCENE.FLOCK_SCENE, endSceneProgress: 0.01 } },
  {
    component: simple(null, "Raven deliveries share route updates to help care teams coordinate supplies across remote communities."),
    timeWindow: { startScene: SCENE.FLOCK_SCENE, startSceneProgress: 0.75, endScene: SCENE.REAL_TIME_DETECTION, endSceneProgress: 0.01 },
  },
  {
    component: simple("Route awareness", "Route awareness and classification of tens of thousands of objects across the battlespace."),
    timeWindow: { startScene: SCENE.REAL_TIME_DETECTION, startSceneProgress: 0.5, endScene: SCENE.THERMAL_IRREGULARITY, endSceneProgress: 0.075 },
  },
  { component: Thermal, timeWindow: { startScene: SCENE.THERMAL_IRREGULARITY, startSceneProgress: 0.9, endScene: SCENE.IGNITION_VERIFIED, endSceneProgress: 0.075 } },
  {
    component: simple("Hazard confirmed", "The route simulation confirms a fire near the planned delivery area and flags the need for review."),
    timeWindow: { startScene: SCENE.IGNITION_VERIFIED, startSceneProgress: 0.75, endScene: SCENE.PHALANX_AI, endSceneProgress: 0.075 },
  },
  {
    component: simple("Raven Operations", "A delivery coordination concept bringing route status, village requests and care-team updates into one view."),
    timeWindow: { startScene: SCENE.PHALANX_AI, startSceneProgress: 0.8, endScene: SCENE.ANALYSIS_EVALUATION, endSceneProgress: 0.075 },
  },
  {
    component: simple("Analysis & evaluation", "Review the simulated hazard and surrounding access routes before proceeding with the medical delivery."),
    timeWindow: { startScene: SCENE.ANALYSIS_EVALUATION, startSceneProgress: 0.75, endScene: SCENE.INTEGRATED_NOTIFICATIONS, endSceneProgress: 0.075 },
  },
  {
    component: simple("Integrated notifications", "Keep health workers and local response teams informed about delivery progress and route hazards."),
    timeWindow: { startScene: SCENE.INTEGRATED_NOTIFICATIONS, startSceneProgress: 0.9, endScene: SCENE.INTERDRONE_COORDINATION, endSceneProgress: 0.075 },
  },
  {
    component: simple("Inter-drone coordination", "Coordinate supply runs between nearby health centres and villages as delivery needs change."),
    timeWindow: { startScene: SCENE.INTERDRONE_COORDINATION, startSceneProgress: 0.75, endScene: SCENE.EXTRA_SUPPORT, endSceneProgress: 0.075 },
  },
  {
    component: simple(null, "A second Raven joins the simulated route to support communities whose normal supply access is disrupted."),
    timeWindow: { startScene: SCENE.EXTRA_SUPPORT, startSceneProgress: 0.75, endScene: SCENE.ZONE_STABILIZED, endSceneProgress: 0.075 },
  },
  {
    component: simple(
      <span className="inline-flex items-center gap-2 whitespace-nowrap md:gap-4">
        Access restored <Pill>M-2 Completed</Pill>
      </span>,
      "Local teams review the route status and prepare to receive the next medical supply delivery.",
    ),
    timeWindow: { startScene: SCENE.ZONE_STABILIZED, startSceneProgress: 0.9, endScene: SCENE.MULTI_THREAT_RESPONSE, endSceneProgress: 0.075 },
  },
  {
    component: simple(
      "Care across communities",
      "A connected medical delivery network for mountain villages, tundra settlements and communities far from reliable road access.",
      "bottom-0 left-0 lg:absolute lg:mr-70 lg:max-w-204",
    ),
    timeWindow: { startScene: SCENE.MULTI_THREAT_RESPONSE, startSceneProgress: 0.9 },
  },
];

/** Picks the first chapter whose window contains the current progress (shipped `nc`). */
export function ChapterCopy() {
  const index = useScenes(
    useShallow((s) =>
      CHAPTERS.findIndex(
        ({ timeWindow: w }) =>
          s[w.startScene].progress >= w.startSceneProgress &&
          (!w.endScene || !w.endSceneProgress || s[w.endScene].progress < w.endSceneProgress),
      ),
    ),
  );
  const hidden = useLoading((s) => s.loadingCanvasHidden);
  const Active = index >= 0 ? CHAPTERS[index].component : null;
  return (
    <div className={clsx("z-navbar absolute inset-0 h-dvh w-full justify-center md:flex", Active ? "opacity-100" : "opacity-0")}>
      <AnimatePresence mode="wait">{hidden && Active && <Active key={index} />}</AnimatePresence>
    </div>
  );
}
