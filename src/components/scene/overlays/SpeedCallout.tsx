"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { ROUTE_COPY, ROUTE_SUMMIT_IMAGE, routeScreen, SPEED_COPY, SPEED_FIGURES, speedScreen } from "@/lib/payload";
import { clinicOpenAt, ClinicPin, placeClinicPin, useClinicPinRefs } from "./RouteCallout";
import { CALLOUT_BOX, CALLOUT_H, kickerText } from "./callout-layout";

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
  const summit = useClinicPinRefs();
  const clinic = useClinicPinRefs();

  useEffect(() => {
    let raf = 0;
    const last = { s: "", d: "", t: "" };
    const tick = () => {
      const r = speedScreen;
      const sTxt = `${Math.round(r.kmh)}`;
      const dTxt = (Math.max(0, r.total - r.left) / 1000).toFixed(1); // distance flown from Ridge Clinic
      const tTxt = eta(r.left);
      if (speed.current && sTxt !== last.s) speed.current.textContent = last.s = sTxt;
      if (dist.current && dTxt !== last.d) dist.current.textContent = last.d = dTxt;
      if (time.current && tTxt !== last.t) time.current.textContent = last.t = tTxt;
      // Summit Station: its pin opens into its card as the drone arrives at the end of leg 2.
      placeClinicPin(summit, r.vx, r.vy, SUMMIT_STEM, r.ok ? 1 : 0, clinicOpenAt(r.fly));
      // The clinic pin stays where the altitude frame left it (same view).
      const c = routeScreen;
      // Its card (open since the drone arrived) folds back into the pin as the drone leaves for Summit Station.
      placeClinicPin(clinic, c.vx, c.vy, CLINIC_STEM, c.ok ? 1 : 0, clinicOpenAt(c.fly) * (1 - Math.min(r.fly / 0.06, 1)));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  const mono = "font-mono text-m-mono md:text-d-mono uppercase";
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className={CALLOUT_BOX}>
        <motion.p
          className={`${mono} mb-2`}
          style={{ color: GREEN }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: "easeInOut", delay: 0.2 }}
        >
          {kickerText(SPEED_COPY.kicker)}
        </motion.p>
        <motion.h2
          className={CALLOUT_H}
          initial={ENTER}
          animate={SETTLE}
          exit={EXIT}
          transition={{ duration: 0.4, ease: "easeInOut", delay: 0.3 }}
          aria-label={km(speedScreen.total)}
        >
          {/* User 2026-11-05: the big figure counts the distance flown from 0 again, like the altitude did. */}
          <span ref={dist} aria-hidden="true">
            0.0
          </span>
          <span aria-hidden="true"> km</span>
        </motion.h2>
        <motion.dl
          className="mt-4 flex justify-end gap-8 text-right"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: "easeInOut", delay: 0.45 }}
        >
          <div>
            <dt className={`${mono} text-white/55`}>Speed</dt>
            <dd className="text-m-h3 md:text-d-h3 mt-1 font-medium tabular-nums">
              <span ref={speed}>0</span> km/h
            </dd>
          </div>
          <div>
            <dt className={`${mono} text-white/55`}>Time to {ROUTE_COPY.second}</dt>
            <dd className="text-m-h3 md:text-d-h3 mt-1 font-medium tabular-nums">
              <span ref={time}>{eta(speedScreen.total)}</span>
            </dd>
          </div>
        </motion.dl>
      </div>
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
        <ClinicPin stem={CLINIC_STEM} refs={clinic} />
        <ClinicPin stem={SUMMIT_STEM} refs={summit} name={ROUTE_COPY.second} image={ROUTE_SUMMIT_IMAGE} />
      </motion.div>
    </div>
  );
}
