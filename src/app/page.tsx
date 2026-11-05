"use client";

import dynamic from "next/dynamic";
import { CapabilityVideos } from "@/components/sections/CapabilityVideos";
import { FeatureSection } from "@/components/sections/FeatureSection";
import { UseCases } from "@/components/sections/UseCases";
import { ClosingCta } from "@/components/sections/ClosingCta";

const Loader = dynamic(() => import("@/components/loading/Loader").then((m) => m.Loader), { ssr: false });
const FixedContainer = dynamic(() => import("@/components/scene/FixedContainer").then((m) => m.FixedContainer), { ssr: false });

/**
 * Raven payload page (user, 2026-11-03: "only these three things we are going to show"): opening -> hero -> payload
 * stage (real terrain to clay, drone to vector form, payload callout) -> mountain stage (the `net` section terrain, route line to the top, altitude). The fixed stage covers the whole page; the
 * spacers below are its scroll (lib/story-map.ts, lib/payload.ts).
 */
export default function Home() {
  return (
    <main className="home-main relative flex w-full flex-col items-center justify-center">
      <Loader />
      <FixedContainer />
      {/* Opening (OPENING_VH): the live camera rises from the low wide shot into the hero frame. */}
      <div id="opening" className="pointer-events-none relative w-full" style={{ height: "300dvh" }} />
      {/* Payload stage (PAYLOAD_VH): 1px intro + 200dvh; `#payload` marks the finished payload frame. */}
      <div id="payload-band" className="pointer-events-none relative w-full" style={{ height: "calc(200dvh + 1px)" }}>
        <div id="payload" className="absolute left-0 h-0 w-full" style={{ top: "calc(200dvh + 1px)" }} />
      </div>
      {/* Mountain stage (ROUTE_VH): pull-back to the section terrain, route line; `#route` marks its end frame. Then the
          climb (CLIMB_VH, two scroll stops up to Ridge Clinic, altitude counting with it). */}
      <div id="route-band" className="pointer-events-none relative w-full" style={{ height: "400dvh" }}>
        <div id="route" className="absolute left-0 h-0 w-full" style={{ top: "200dvh" }} />
      </div>
      {/* Speed stage (SPEED_VH): drone POV along the valley leg, speed / distance / time; `#speed` marks its end frame. */}
      <div id="speed-band" className="pointer-events-none relative w-full" style={{ height: "200dvh" }}>
        <div id="speed" className="absolute left-0 h-0 w-full" style={{ top: "200dvh" }} />
      </div>
      {/* One screen: the speed frame stays on screen while Section 03 slides up over it. */}
      <div className="pointer-events-none relative w-full" style={{ height: "100dvh" }} />
      {/* Section 03 (Figma 128:804/830/857): pinned, one feature per scroll stop; the stage hides once it is covered. */}
      <FeatureSection />
      {/* Section 04 (Figma 100:622): capability videos, played one after another. */}
      <CapabilityVideos />
      {/* Section 05 (user mockup 2026-11-05): use cases, three photo cards. */}
      <UseCases />
      {/* Closing CTA (user mockup 2026-11-05): the landing drone from tundra-terrain behind the contact call. */}
      <ClosingCta />
    </main>
  );
}
