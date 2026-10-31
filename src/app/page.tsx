"use client";

import dynamic from "next/dynamic";
import { Footer, OurTeam } from "@/components/sections/Sections";

const Loader = dynamic(() => import("@/components/loading/Loader").then((m) => m.Loader), { ssr: false });
const FixedContainer = dynamic(() => import("@/components/scene/FixedContainer").then((m) => m.FixedContainer), { ssr: false });
const LandingSequence = dynamic(() => import("@/components/sections/LandingSequence").then((m) => m.LandingSequence), { ssr: false });

export default function Home() {
  return (
    <main className="home-main relative flex w-full flex-col items-center justify-center">
      <Loader />
      {/* Fixed story stage; its scroll bands are the spacers below (lib/story-map.ts). */}
      <FixedContainer />
      {/* Opening (OPENING_VH): the live camera rises from the low wide shot into the hero frame before band 1. */}
      <div id="opening" className="pointer-events-none relative w-full" style={{ height: "300dvh" }} />
      {/* Band 1: intro (1px) + Airframe → Route (5 x 500dvh). It hands straight to band 2 (no scroll-away screen). */}
      <div id="story-band-1" className="pointer-events-none relative w-full" style={{ height: "calc(2500dvh + 1px)" }} />
      {/* Band 2: the diagonal Phalanx wipe from Route into the Care teams map (500dvh), then Review → Network
          (5 x 500dvh + 100dvh zone) + one screen to scroll away. `#care-teams` marks the finished map frame. */}
      <div id="story-band-2" className="pointer-events-none relative w-full" style={{ height: "3200dvh" }}>
        <div id="care-teams" className="absolute top-[500dvh] left-0 h-px w-full" />
      </div>
      <div className="flex w-full flex-col items-center gap-30 pt-30 md:gap-40 md:pt-40 lg:gap-55 lg:pt-55">
        <OurTeam />
        <Footer />
      </div>
      <LandingSequence />
    </main>
  );
}
