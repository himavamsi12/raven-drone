"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { PAYLOAD_COPY, payloadScreen } from "@/lib/payload";

const ENTER = { opacity: 0, y: 8, color: "#FF2200" };
const SETTLE = { opacity: 1, y: 0, color: "#FFFFFF" };
const EXIT = { opacity: 0, y: -8, color: "#FF2200" };
const YELLOW = "#ffcb47"; // yellow token (the payload box highlight, Drone.tsx VECTOR_LOOK)

/** Label column (px): width of the text block and its gap to the right edge / to the end of the line. */
const LABEL = { width: 340, gutter: 48, gap: 14 };
/** Leader line (px): diagonal rise from the box, and the drop below it on portrait screens. */
const LEAD = { diag: 110, diagSmall: 64, drop: 120 };

/**
 * Payload callout (lib/payload.ts, user 2026-11-03: "highlight the payload ... we can carry upto 15 to 25 kg"). A marker
 * on the medical box (its screen point from DroneRig, every frame) and a leader line to the figure, in the site's spec
 * callout language (thin drawn line, end square, mono kicker). Landscape: the line rises from the box and runs right
 * to a label in the clear right-hand column (the zoomed drone fills the centre); portrait: straight down to a label
 * under the box.
 */
export function PayloadCallout() {
  const marker = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const end = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const { x, y, ok } = payloadScreen;
      const portrait = W <= H;
      let ex: number;
      let ey: number;
      if (portrait) {
        ex = x;
        ey = y + LEAD.drop;
      } else {
        const diag = W >= 768 ? LEAD.diag : LEAD.diagSmall;
        ey = y - diag;
        // Right column, but never closer to the box than the diagonal plus a short run.
        ex = Math.max(W - LABEL.gutter - LABEL.width - LABEL.gap, x + diag + 40);
      }
      const d = portrait ? `M${x} ${y} L${ex} ${ey}` : `M${x} ${y} L${x + (y - ey)} ${ey} L${ex} ${ey}`;
      path.current?.setAttribute("d", d);
      const show = ok ? "visible" : "hidden";
      if (marker.current) {
        marker.current.style.visibility = show;
        marker.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
      if (end.current) {
        end.current.style.visibility = show;
        end.current.style.transform = `translate3d(${(ex - 4).toFixed(1)}px, ${(ey - 4).toFixed(1)}px, 0)`;
      }
      if (label.current) {
        label.current.style.visibility = show;
        label.current.style.transform = portrait
          ? `translate3d(calc(${ex.toFixed(1)}px - 50%), ${(ey + LABEL.gap).toFixed(1)}px, 0)`
          : `translate3d(${(ex + LABEL.gap).toFixed(1)}px, calc(${ey.toFixed(1)}px - 0.55em), 0)`;
        label.current.style.textAlign = portrait ? "center" : "left";
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg aria-hidden="true" className="absolute inset-0 size-full overflow-visible" fill="none">
        <motion.path
          ref={path}
          stroke={YELLOW}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          exit={{ pathLength: 0, opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeInOut", delay: 0.1 }}
        />
      </svg>
      {/* Marker on the box: ring + dot. */}
      <div ref={marker} className="absolute top-0 left-0" style={{ visibility: "hidden" }}>
        <motion.span
          aria-hidden="true"
          className="absolute -top-2.5 -left-2.5 size-5 rounded-full border"
          style={{ borderColor: YELLOW, boxShadow: `0 0 18px ${YELLOW}66` }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
        <span aria-hidden="true" className="absolute -top-0.75 -left-0.75 size-1.5 rounded-full" style={{ background: YELLOW }} />
      </div>
      <motion.span
        ref={end}
        aria-hidden="true"
        className="absolute top-0 left-0 size-2"
        style={{ background: YELLOW, visibility: "hidden" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, delay: 0.6 }}
      />
      <div ref={label} className="absolute top-0 left-0" style={{ width: `min(${LABEL.width}px, 84vw)`, visibility: "hidden" }}>
        <motion.p
          className="text-m-mono md:text-d-mono mb-2 font-mono uppercase text-shadow-[0px_1px_24px_rgba(0,0,0,0.45)]"
          style={{ color: YELLOW }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: "easeInOut", delay: 0.45 }}
        >
          {PAYLOAD_COPY.kicker}
        </motion.p>
        <motion.h2
          className="text-m-h0 md:text-d-h0 leading-none font-semibold tracking-[-0.04em] whitespace-nowrap text-shadow-[0px_1px_24px_rgba(0,0,0,0.45)]"
          initial={ENTER}
          animate={SETTLE}
          exit={EXIT}
          transition={{ duration: 0.4, ease: "easeInOut", delay: 0.55 }}
        >
          {PAYLOAD_COPY.value}
        </motion.h2>
        <motion.p
          className="text-m-body-l md:text-d-body-l mt-3 text-pretty text-shadow-[0px_1px_24px_rgba(0,0,0,0.45)]"
          initial={ENTER}
          animate={{ ...SETTLE, color: "rgba(255,255,255,0.82)" }}
          exit={EXIT}
          transition={{ duration: 0.4, ease: "easeInOut", delay: 0.75 }}
        >
          {PAYLOAD_COPY.body}
        </motion.p>
      </div>
    </div>
  );
}
