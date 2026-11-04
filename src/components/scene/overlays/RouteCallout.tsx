"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { ALTITUDE_COPY, ROUTE_COPY, ROUTE_FLIGHT, routeScreen } from "@/lib/payload";

/** Pin geometry from the `net` section's CSS (.pin__btn 44px, .pin__label at 54/13; clinic stem 84px, summit 96px). */
const PIN = { size: 44, labelX: 54, labelY: 13 };
const STEMS = [84, 96];

const ENTER = { opacity: 0, y: 8, color: "#FF2200" };
const SETTLE = { opacity: 1, y: 0, color: "#FFFFFF" };
const EXIT = { opacity: 0, y: -8, color: "#FF2200" };
const YELLOW = "#ffcb47";

const metres = (m: number) => `${Math.round(m).toLocaleString("en-US")} m`;

/** One `net` section pin, its stem's foot on a site (positioned every frame by the parent's loop). */
export function Pin({ name, stem, pinRef, labelRef }: { name: string; stem: number; pinRef: React.RefObject<HTMLDivElement | null>; labelRef: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <div ref={pinRef} className="absolute top-0 left-0 flex flex-col items-center" style={{ width: PIN.size, opacity: 0 }}>
      <span
        aria-hidden="true"
        className="grid place-items-center rounded-full text-white"
        style={{ width: PIN.size, height: PIN.size, border: "1px solid rgba(230, 230, 230, 0.35)", background: "#1e1e1e" }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M7 1.5v11M1.5 7h11" />
        </svg>
      </span>
      <span
        ref={labelRef}
        className="absolute font-mono text-[11px] tracking-[0.08em] whitespace-nowrap uppercase"
        style={{ left: PIN.labelX, top: PIN.labelY, color: "rgba(230, 230, 230, 0.55)" }}
      >
        {name}
      </span>
      <span
        aria-hidden="true"
        className="block w-px"
        style={{ height: stem, background: "linear-gradient(rgba(230, 230, 230, 0.55), rgba(230, 230, 230, 0.15))" }}
      />
    </div>
  );
}

/**
 * Mountain stage callout (lib/payload.ts ROUTE_*; user 2026-11-03): the altitude where the section had its heading (top
 * left, clear sky), counting up from 0 m with the drone's climb along the route (routeScreen.alt; user: "we should not
 * show 5000m in the starting itself"), and the `net` section's two pins (Ridge Clinic, Summit Station) on their sites,
 * each coming in as its leg of the connected route arrives (routeScreen.draw / draw2). Display only: the section's pins opened an info card, which
 * was removed. Screen readers get the final figure.
 */
export function RouteCallout() {
  const layer = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const pins = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const labels = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)];

  useEffect(() => {
    let raf = 0;
    let shownText = "";
    const tick = () => {
      const r = routeScreen;
      if (layer.current) layer.current.style.visibility = r.ok ? "visible" : "hidden";
      const text = metres(r.alt * ROUTE_FLIGHT.topM);
      if (counter.current && text !== shownText) counter.current.textContent = shownText = text;
      const sites: [number, number, boolean][] = [
        [r.vx, r.vy, r.ok],
        [r.v2x, r.v2y, r.ok2],
      ];
      // Each pin comes in as its leg of the connected route arrives (clinic: leg 1, summit station: leg 2).
      sites.forEach(([x, y, ok], i) => {
        const shown = Math.min(Math.max(((i === 0 ? r.draw : r.draw2) - 0.8) / 0.2, 0), 1);
        const pin = pins[i].current;
        if (pin) {
          // Section: translate(x, y) translate(-50%, -100%), the stem's foot on the site.
          pin.style.transform = `translate3d(${(x - PIN.size / 2).toFixed(1)}px, ${(y - PIN.size - STEMS[i]).toFixed(1)}px, 0)`;
          pin.style.opacity = (ok ? shown : 0).toFixed(3);
        }
        // Label right of the ring (section), or left of it where the screen ends (phones).
        const label = labels[i].current;
        if (label) {
          const w = label.offsetWidth;
          const right = x - PIN.size / 2 + PIN.labelX + w <= window.innerWidth - 12;
          label.style.left = right ? `${PIN.labelX}px` : `${PIN.size - PIN.labelX - w}px`;
        }
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute top-[calc(var(--nav-height)+clamp(28px,4vw,64px))] left-[clamp(20px,3.3vw,54px)] max-w-[min(420px,calc(100vw-40px))]">
        <motion.p
          className="text-m-mono md:text-d-mono mb-2 font-mono uppercase"
          style={{ color: YELLOW }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: "easeInOut", delay: 0.3 }}
        >
          {ALTITUDE_COPY.kicker}
        </motion.p>
        <motion.h2
          className="text-m-h0 md:text-d-h0 leading-none font-semibold tracking-[-0.04em] whitespace-nowrap tabular-nums"
          initial={ENTER}
          animate={SETTLE}
          exit={EXIT}
          transition={{ duration: 0.4, ease: "easeInOut", delay: 0.4 }}
          aria-label={ALTITUDE_COPY.value}
        >
          <span ref={counter} aria-hidden="true">
            {metres(0)}
          </span>
        </motion.h2>
        <motion.p
          className="text-m-body-l md:text-d-body-l mt-3 text-pretty"
          initial={ENTER}
          animate={{ ...SETTLE, color: "rgba(255,255,255,0.82)" }}
          exit={EXIT}
          transition={{ duration: 0.4, ease: "easeInOut", delay: 0.6 }}
        >
          {ALTITUDE_COPY.body}
        </motion.p>
      </div>
      <div ref={layer} className="pointer-events-none absolute inset-0" style={{ visibility: "hidden" }}>
        <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0">
          <Pin name={ROUTE_COPY.destination} stem={STEMS[0]} pinRef={pins[0]} labelRef={labels[0]} />
          <Pin name={ROUTE_COPY.second} stem={STEMS[1]} pinRef={pins[1]} labelRef={labels[1]} />
        </motion.div>
      </div>
    </div>
  );
}
