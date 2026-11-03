"use client";

import dynamic from "next/dynamic";
import { OurTeam } from "@/components/sections/Sections";

const Loader = dynamic(() => import("@/components/loading/Loader").then((m) => m.Loader), { ssr: false });
const FixedContainer = dynamic(() => import("@/components/scene/FixedContainer").then((m) => m.FixedContainer), { ssr: false });

export default function Home() {
  return (
    <main className="home-main relative flex w-full flex-col items-center justify-center">
      <Loader />
      {/* Fixed story stage; its scroll bands are the spacers below (lib/story-map.ts). */}
      <FixedContainer />
      {/* Opening (OPENING_VH): the live camera rises from the low wide shot into the hero frame before band 1. */}
      <div id="opening" className="pointer-events-none relative w-full" style={{ height: "300dvh" }} />
      {/* Band 1: intro (1px) + Airframe → Route (5 x 500dvh). It hands straight to band 2 (no scroll-away screen). */}
      <div id="story-band-1" className="pointer-events-none relative w-full" style={{ height: "calc(2150dvh + 1px)" }} />
      {/* Band 2: the diagonal Phalanx wipe from Route into the Care teams landscape (500dvh), the drone's flight to
          both villages (250dvh, story-map CLIMB_STOPS) + one screen to scroll away. `#care-teams` marks the finished
          landscape frame. */}
      <div id="story-band-2" className="pointer-events-none relative w-full" style={{ height: "850dvh" }}>
        <div id="care-teams" className="absolute top-[500dvh] left-0 h-px w-full" />
      </div>
      {/* Footer and its landing sequence removed (user, 2026-11-03): the page ends with the team section. */}
      <div className="flex w-full flex-col items-center py-30 md:py-40 lg:py-55">
        <OurTeam />
      </div>
    </main>
  );
}
