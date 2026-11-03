"use client";

import dynamic from "next/dynamic";

const Loader = dynamic(() => import("@/components/loading/Loader").then((m) => m.Loader), { ssr: false });
const FixedContainer = dynamic(() => import("@/components/scene/FixedContainer").then((m) => m.FixedContainer), { ssr: false });

/**
 * Raven payload page (user, 2026-11-03: "only these three things we are going to show"): opening -> hero -> payload
 * stage (real terrain to clay, drone to vector form, payload callout). The fixed stage covers the whole page; the
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
      {/* One screen: the payload frame is the last scroll position (page height - viewport). */}
      <div className="pointer-events-none relative w-full" style={{ height: "100dvh" }} />
    </main>
  );
}
