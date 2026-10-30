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
  /** Homepage hero (asset/html/raven_homepage.html `.headline`): two uppercase lines, tight leading. */
  hero: "text-[clamp(2.125rem,11.5vw,3.75rem)] sm:text-[clamp(2.5rem,4.7vw,4.875rem)] leading-[0.9] font-semibold tracking-[-0.045em] uppercase text-shadow-[0px_1px_24px_rgba(0,0,0,0.45)]",
  h1: "text-m-h0 md:text-d-h0 [@media(min-width:48rem)_and_(max-height:37.5rem)]:!text-m-h0 max-w-204 text-shadow-[0px_1px_24px_rgba(0,0,0,0.45)]",
  h2: "text-m-h1 md:text-d-h1 [@media(min-width:48rem)_and_(max-height:37.5rem)]:!text-m-h1 max-w-204 text-shadow-[0px_1px_24px_rgba(0,0,0,0.45)]",
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
          "text-m-h3 md:text-d-h3 [@media(min-width:48rem)_and_(max-height:37.5rem)]:!text-m-h3 text-pretty text-shadow-[0px_1px_24px_rgba(0,0,0,0.45)]",
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

/** Full-viewport padded frame (shipped `ne`), clear of the homepage bar. */
function Frame({ children, className, innerClassName }: { children: ReactNode; className?: string; innerClassName?: string }) {
  return (
    <div className={clsx("absolute inset-0 flex flex-col pt-[calc(var(--nav-height)+1rem)] pr-4 pb-4 pl-4 md:pt-[calc(var(--nav-height)+1.5rem)] md:pr-8 md:pb-10 md:pl-8", className)}>
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

/** Raven: the four parts of one delivery replace the shipped trait list (same rows/layout). */
const SWARM_TRAITS = [
  { title: "Sender", description: "A regional health centre" },
  { title: "Cargo", description: "Medicines in a secured case" },
  { title: "Route", description: "Over the ridge, not the road" },
  { title: "Receiver", description: "Health workers at the clinic" },
];

const bottomLeft = "bottom-0 left-0 lg:absolute lg:mr-70 lg:max-w-133.5";

/** Homepage CTA (asset/html/raven_homepage.html `.cta`): square outline, frosted, small caps; delayed .4s like `Cta`. */
function SquareCta({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" propagate>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ delay: 0.4, duration: 0.4 }}>
        <button
          type="button"
          onClick={onClick}
          className="pointer-events-auto inline-flex cursor-pointer items-center gap-3 border border-[#f4f3ef] bg-black/25 px-[1.375rem] py-3.5 text-[clamp(0.6875rem,0.82vw,0.8125rem)] leading-none font-medium tracking-[0.04em] text-[#f4f3ef] uppercase backdrop-blur-[6px] transition-colors duration-200 hover:bg-black/45 focus-visible:bg-black/45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
        >
          {children}
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="size-3.5">
            <path d="M2 7h10M8 3l4 4-4 4" />
          </svg>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

/** Hero in the homepage composition: headline bottom-left, supporting copy + CTA bottom-right on one baseline. */
function Hero() {
  const explore = useScrollToScene(SCENE.DELTA_DRONE);
  return (
    <Frame innerClassName="!flex flex-col justify-end">
      <div className="flex flex-col items-start justify-between gap-5 px-1 sm:flex-row sm:items-end sm:gap-8 md:px-[clamp(0rem,1.1vw,1.375rem)]">
        <div>
          <p className="text-m-mono md:text-d-mono mb-3 font-mono text-white/70 uppercase text-shadow-[0px_1px_24px_rgba(0,0,0,0.45)] md:mb-4">
            Illustrative medical delivery
          </p>
          <Heading variant="hero" className="sm:whitespace-nowrap">
            <span className="block">The road goes around.</span>
            <span className="block">Raven goes over.</span>
          </Heading>
        </div>
        <div className="flex max-w-90 min-w-0 flex-col items-start gap-[clamp(0.875rem,1.4vw,1.375rem)]">
          <Support className="!text-[clamp(0.8125rem,0.95vw,0.97rem)] !leading-[1.4] !font-normal !tracking-[-0.01em] text-white/90">
            When a hill clinic runs short of medicines, the journey matters. Raven explores a direct air link from a regional health centre to the
            village waiting for supplies.
          </Support>
          <SquareCta onClick={explore}>Follow the delivery</SquareCta>
        </div>
      </div>
    </Frame>
  );
}

function Swarm() {
  const short = useMediaQuery("(max-width: 768px), (max-height: 600px)");
  return (
    <Frame innerClassName="[@media(min-width:48rem)_and_(min-height:37.5rem)]:!block">
      <Heading as="h2" variant="h2">
        {short ? "Health centre to hill clinic." : "From a health centre to a hill clinic."}
      </Heading>
      <div className="right-0 bottom-0 contents w-168.75 flex-col gap-4 [@media(min-width:48rem)_and_(min-height:37.5rem)]:absolute [@media(min-width:48rem)_and_(min-height:37.5rem)]:flex [@media(min-width:48rem)_and_(min-height:37.5rem)]:gap-6">
        <Support className="[@media(min-width:48rem)_and_(max-height:37.5rem)]:max-w-xl">
          One supply request gives the journey a purpose. Raven&apos;s wider network begins with the connection between a care team and the village it
          serves.
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
        <Heading as="h2" variant="h2" className="text-balance">
          Start with what the clinic needs.
        </Heading>
        <div className="flex flex-col gap-4 md:gap-6 lg:max-w-204">
          <Support>
            In this illustrative journey, a care team prepares the supplies and reviews the destination before dispatch.
          </Support>
          <Cta className="w-62.5" onClick={start}>
            Explore the route
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

type Window = { startScene: SceneId; startSceneProgress: number; endScene?: SceneId; endSceneProgress?: number };

/** Chapter copy + time windows, verbatim order from shipped `nl`. */
const CHAPTERS: { component: ComponentType; timeWindow: Window }[] = [
  { component: Hero, timeWindow: { startScene: SCENE.INTRO_SCENE, startSceneProgress: 0, endScene: SCENE.DELTA_DRONE, endSceneProgress: 0.075 } },
  { component: Swarm, timeWindow: { startScene: SCENE.SWARM_SCENE, startSceneProgress: 0.75, endScene: SCENE.MISSION_PRESET, endSceneProgress: 0.075 } },
  { component: Mission, timeWindow: { startScene: SCENE.MISSION_PRESET, startSceneProgress: 0.75, endScene: SCENE.FLOCK_SCENE, endSceneProgress: 0.01 } },
  {
    component: simple(
      "Keep the delivery in view.",
      "The aircraft is one part of the journey. The sender, the receiving clinic and the route between them matter just as much.",
    ),
    timeWindow: { startScene: SCENE.FLOCK_SCENE, startSceneProgress: 0.75, endScene: SCENE.REAL_TIME_DETECTION, endSceneProgress: 0.01 },
  },
  {
    component: simple("Read the route ahead.", "The route view introduces the terrain, road access and obstacles between the health centre and the clinic."),
    timeWindow: { startScene: SCENE.REAL_TIME_DETECTION, startSceneProgress: 0.5, endScene: SCENE.THERMAL_IRREGULARITY, endSceneProgress: 0.075 },
  },
  {
    component: simple(
      "Keep the care team informed.",
      "A useful delivery view brings the destination and route status together, so the people arranging supplies share the same picture.",
    ),
    timeWindow: { startScene: SCENE.PHALANX_AI, startSceneProgress: 0.8, endScene: SCENE.ANALYSIS_EVALUATION, endSceneProgress: 0.075 },
  },
  {
    component: simple(
      "Reconsider the approach.",
      "When access changes, the delivery plan must change with it. The next step in this scenario is a review of the route.",
    ),
    timeWindow: { startScene: SCENE.ANALYSIS_EVALUATION, startSceneProgress: 0.75, endScene: SCENE.INTEGRATED_NOTIFICATIONS, endSceneProgress: 0.075 },
  },
  {
    component: simple(
      "The clinic needs an update.",
      "If a delivery is delayed, the people waiting for it need to know. Clear updates belong to the journey, not just to the aircraft.",
    ),
    timeWindow: { startScene: SCENE.INTEGRATED_NOTIFICATIONS, startSceneProgress: 0.9, endScene: SCENE.INTERDRONE_COORDINATION, endSceneProgress: 0.075 },
  },
  {
    component: simple(
      "Coordinate the next supply run.",
      "The wider concept connects several requests with the care teams arranging them. Extra aircraft are support, not the story's main event.",
    ),
    timeWindow: { startScene: SCENE.INTERDRONE_COORDINATION, startSceneProgress: 0.75, endScene: SCENE.EXTRA_SUPPORT, endSceneProgress: 0.075 },
  },
  {
    component: simple(
      "Support the places still waiting.",
      "A second Raven enters the illustration as access is reviewed. The goal remains the same: getting supplies to the intended clinic.",
    ),
    timeWindow: { startScene: SCENE.EXTRA_SUPPORT, startSceneProgress: 0.75, endScene: SCENE.ZONE_STABILIZED, endSceneProgress: 0.075 },
  },
  {
    component: simple(
      <>
        Prepare for the next step.
        <br />
        <Pill className="mt-2 inline-block md:mt-4">Scenario update</Pill>
      </>,
      "The illustrated response settles. The delivery outcome still depends on a suitable approach and a confirmed handoff.",
    ),
    timeWindow: { startScene: SCENE.ZONE_STABILIZED, startSceneProgress: 0.9, endScene: SCENE.MULTI_THREAT_RESPONSE, endSceneProgress: 0.075 },
  },
  {
    component: simple(
      "One journey. A wider connection.",
      "Start with one clinic and one supply request. Then consider how a regional health centre could support more remote communities.",
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
