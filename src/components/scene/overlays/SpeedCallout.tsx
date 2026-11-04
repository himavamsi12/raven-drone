"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { ROUTE_COPY, routeScreen, SPEED_COPY, SPEED_FIGURES, speedScreen } from "@/lib/payload";
import { Pin } from "./RouteCallout";

const ENTER = { opacity: 0, y: 8, color: "#FF2200" };
const SETTLE = { opacity: 1, y: 0, color: "#FFFFFF" };
const EXIT = { opacity: 0, y: -8, color: "#FF2200" };
const YELLOW = "#ffcb47";
const GREEN = "#4ade80"; // leg 2, DroneRig ROUTE_GREEN (the kicker)
const CLINIC_STEM = 84;
const SUMMIT_STEM = 96;

const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
/** Time for `m` metres at the cruise speed, m:ss. */
const eta = (m: number) => {
  const s = Math.max(0, Math.round(m / (SPEED_FIGURES.kmh / 3.6)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Speed stage HUD (lib/payload.ts SPEED_*; user 2026-11-03: the same view as the altitude frame, leg 2 in green;
 * the speed toward the second checkpoint and the time). Top left, like the altitude callout: the speed
 * counting up as the drone accelerates (to the ~79 km/h implied by the user's `net` section figures), the distance
 * left along leg 2 (its measured length at the section's 50 m per unit) and the time to arrival at cruise speed, both
 * counting down; both checkpoint pins. No marks on the line itself (user). Positions and values come
 * from DroneRig every frame (`speedScreen`). Screen readers get the totals.
 */
export function SpeedCallout() {
  const speed = useRef<HTMLSpanElement>(null);
  const dist = useRef<HTMLSpanElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const pin1 = useRef<HTMLDivElement>(null);
  const label1 = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const last = { s: "", d: "", t: "" };
    const tick = () => {
      const r = speedScreen;
      const sTxt = `${Math.round(r.kmh)}`;
      const dTxt = km(r.left);
      const tTxt = eta(r.left);
      if (speed.current && sTxt !== last.s) speed.current.textContent = last.s = sTxt;
      if (dist.current && dTxt !== last.d) dist.current.textContent = last.d = dTxt;
      if (time.current && tTxt !== last.t) time.current.textContent = last.t = tTxt;
      if (pin.current) {
        pin.current.style.transform = `translate3d(${(r.vx - 22).toFixed(1)}px, ${(r.vy - 44 - SUMMIT_STEM).toFixed(1)}px, 0)`;
        pin.current.style.opacity = r.ok ? "1" : "0";
      }
      if (label.current) {
        const w = label.current.offsetWidth;
        label.current.style.left = r.vx - 22 + 54 + w <= window.innerWidth - 12 ? "54px" : `${44 - 54 - w}px`;
      }
      // The clinic pin stays where the altitude frame left it (same view).
      const c = routeScreen;
      if (pin1.current) {
        pin1.current.style.transform = `translate3d(${(c.vx - 22).toFixed(1)}px, ${(c.vy - 44 - CLINIC_STEM).toFixed(1)}px, 0)`;
        pin1.current.style.opacity = c.ok ? "1" : "0";
      }
      if (label1.current) {
        const w = label1.current.offsetWidth;
        label1.current.style.left = c.vx - 22 + 54 + w <= window.innerWidth - 12 ? "54px" : `${44 - 54 - w}px`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  const mono = "font-mono text-m-mono md:text-d-mono uppercase";
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute top-[calc(var(--nav-height)+clamp(28px,4vw,64px))] left-[clamp(20px,3.3vw,54px)] max-w-[min(460px,calc(100vw-40px))]">
        <motion.p
          className={`${mono} mb-2`}
          style={{ color: GREEN }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: "easeInOut", delay: 0.2 }}
        >
          {SPEED_COPY.kicker}
        </motion.p>
        <motion.h2
          className="text-m-h0 md:text-d-h0 leading-none font-semibold tracking-[-0.04em] whitespace-nowrap tabular-nums"
          initial={ENTER}
          animate={SETTLE}
          exit={EXIT}
          transition={{ duration: 0.4, ease: "easeInOut", delay: 0.3 }}
          aria-label={`${SPEED_FIGURES.kmh} km/h`}
        >
          <span ref={speed} aria-hidden="true">
            0
          </span>
          <span aria-hidden="true"> km/h</span>
        </motion.h2>
        <motion.dl
          className="mt-4 flex gap-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: "easeInOut", delay: 0.45 }}
        >
          <div>
            <dt className={`${mono} text-white/55`}>{SPEED_COPY.to}</dt>
            <dd className="text-m-h3 md:text-d-h3 mt-1 font-medium tabular-nums">
              <span ref={dist}>{km(speedScreen.total)}</span>
            </dd>
          </div>
          <div>
            <dt className={`${mono} text-white/55`}>Time</dt>
            <dd className="text-m-h3 md:text-d-h3 mt-1 font-medium tabular-nums">
              <span ref={time}>{eta(speedScreen.total)}</span>
            </dd>
          </div>
        </motion.dl>
      </div>
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
        <Pin name={ROUTE_COPY.destination} stem={CLINIC_STEM} pinRef={pin1} labelRef={label1} />
        <Pin name={ROUTE_COPY.second} stem={SUMMIT_STEM} pinRef={pin} labelRef={label} />
      </motion.div>
    </div>
  );
}
