"use client";

import { motion } from "motion/react";
import { PAYLOAD_COPY } from "@/lib/payload";
import { CALLOUT_BODY, CALLOUT_BOX, CALLOUT_H, kickerText } from "./callout-layout";

const ENTER = { opacity: 0, y: 8, color: "#FF2200" };
const SETTLE = { opacity: 1, y: 0, color: "#FFFFFF" };
const EXIT = { opacity: 0, y: -8, color: "#FF2200" };
const YELLOW = "#ffcb47"; // yellow token (the payload box highlight, Drone.tsx VECTOR_LOOK)
const SHADOW = "text-shadow-[0px_1px_24px_rgba(0,0,0,0.45)]";

/**
 * Payload callout (lib/payload.ts, user 2026-11-03: "highlight the payload ... we can carry upto 15 to 25 kg"). User
 * mockup 2026-11-05: the figure sits in the right-hand block shared by all stage callouts (callout-layout.ts); the box
 * itself is the yellow highlight, so the earlier marker ring and leader line from the box were dropped.
 */
export function PayloadCallout() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className={CALLOUT_BOX}>
        <motion.p
          className={`text-m-mono md:text-d-mono mb-2 font-mono uppercase ${SHADOW}`}
          style={{ color: YELLOW }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.15 }}
        >
          {kickerText(PAYLOAD_COPY.kicker)}
        </motion.p>
        <motion.h2
          className={`${CALLOUT_H} ${SHADOW}`}
          initial={ENTER}
          animate={SETTLE}
          exit={EXIT}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.2 }}
        >
          {PAYLOAD_COPY.value}
        </motion.h2>
        <motion.p
          className={`${CALLOUT_BODY} ${SHADOW}`}
          initial={ENTER}
          animate={{ ...SETTLE, color: "rgba(255,255,255,0.82)" }}
          exit={EXIT}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.3 }}
        >
          {PAYLOAD_COPY.body}
        </motion.p>
      </div>
    </div>
  );
}
