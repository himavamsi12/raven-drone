"use client";

import dynamic from "next/dynamic";
import { useInView } from "motion/react";
import { useRef } from "react";
import { ContactButton } from "@/components/ContactButton";
import { ArrowRightIcon } from "@/components/ui/icons";

/** The landing drone behind the copy (ClosingCtaDrone.tsx): its own chunk, fetched when the section is near. */
const CtaDrone = dynamic(() => import("./ClosingCtaDrone"), { ssr: false });

export function ClosingCta() {
  const ref = useRef<HTMLElement>(null);
  // Load time (2026-11-06): within three screens; it then stays, so the landing is ready when the section arrives.
  const near = useInView(ref, { margin: "300% 0px 300% 0px", once: true });
  return (
    <section
      ref={ref}
      id="contact-cta"
      aria-labelledby="contact-cta-h"
      className="cta font-tight z-over-scroll-sequence relative w-full overflow-hidden bg-black text-white"
    >
      {near && <CtaDrone className="absolute inset-0" />}
      {/* Dims the drone so the copy reads (mockup: drone in shadow, copy bright). */}
      <div aria-hidden="true" className="cta-dim pointer-events-none absolute inset-0" />
      <div className="relative flex h-full flex-col items-center justify-center px-5 text-center">
        <h2 id="contact-cta-h" className="cta-h">
          Want your product
          <br />
          explained this clearly?
        </h2>
        <p className="cta-p">We&rsquo;re Sixjuly, a clarity-first design studio.</p>
        <ContactButton
          label="Talk to us"
          trigger={
            <button type="button" className="cta-btn">
              <span>Talk to us</span>
              <span className="cta-btn-arrow" aria-hidden="true">
                <ArrowRightIcon className="size-3.5" />
              </span>
            </button>
          }
        />
      </div>
    </section>
  );
}
