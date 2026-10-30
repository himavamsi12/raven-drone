"use client";

import dynamic from "next/dynamic";
import { Footer, OurTeam } from "@/components/sections/Sections";

const Loader = dynamic(() => import("@/components/loading/Loader").then((m) => m.Loader), { ssr: false });
const FixedContainer = dynamic(() => import("@/components/scene/FixedContainer").then((m) => m.FixedContainer), { ssr: false });
const Parts = dynamic(() => import("@/components/sections/Parts").then((m) => m.Parts), { ssr: false });
const LandingSequence = dynamic(() => import("@/components/sections/LandingSequence").then((m) => m.LandingSequence), { ssr: false });

export default function Home() {
  return (
    <main className="home-main relative flex w-full flex-col items-center justify-center">
      <Loader />
      {/* Fixed story stage; its scroll bands are the two spacers below (lib/story-map.ts). */}
      <FixedContainer />
      {/* Band 1: intro (1px) + Airframe → Route (5 x 500dvh) + one screen for the stage to scroll away. */}
      <div id="story-band-1" className="pointer-events-none relative w-full" style={{ height: "calc(2600dvh + 1px)" }} />
      {/* Raven homepage layout (asset/html/raven_homepage.html): parts track between the story bands. */}
      <Parts />
      {/* Band 2: opens on the Care teams frame, then Review → Network (5 x 500dvh + 100dvh zone) + one screen to scroll away. */}
      <div id="story-band-2" className="pointer-events-none relative w-full" style={{ height: "2700dvh" }} />
      <div className="flex w-full flex-col items-center gap-30 pt-30 md:gap-40 md:pt-40 lg:gap-55 lg:pt-55">
        <OurTeam />
        <Footer />
      </div>
      <LandingSequence />
    </main>
  );
}
