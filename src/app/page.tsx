"use client";

import dynamic from "next/dynamic";
import { Coverage, Demo, Footer, OurTeam, UseCases } from "@/components/sections/Sections";

const Loader = dynamic(() => import("@/components/loading/Loader").then((m) => m.Loader), { ssr: false });
const FixedContainer = dynamic(() => import("@/components/scene/FixedContainer").then((m) => m.FixedContainer), { ssr: false });
const LandingSequence = dynamic(() => import("@/components/sections/LandingSequence").then((m) => m.LandingSequence), { ssr: false });

export default function Home() {
  return (
    <main className="home-main relative flex w-full flex-col items-center justify-center">
      <Loader />
      <div className="relative flex w-full flex-col">
        <FixedContainer />
        {/* Scroll track: 15 scene spans (intro = 1px) + nav height, as shipped. */}
        <div className="pointer-events-none relative w-full" style={{ height: "calc(6600dvh + 1px + var(--nav-height))" }} />
      </div>
      <div className="flex w-full flex-col items-center gap-30 pt-30 md:gap-40 md:pt-40 lg:gap-55 lg:pt-55">
        <UseCases />
        <Coverage />
        <Demo />
        <OurTeam />
        <Footer />
      </div>
      <LandingSequence />
    </main>
  );
}
