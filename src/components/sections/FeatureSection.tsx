"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { FEATURES, SECTION_BODY, SECTION_HEADING } from "@/lib/features";

/** Hexa mark from the card's bottom-right corner (Figma 128:820 "Union"). */
function HexaMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 35 39" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.057 0C18.8243 5.44254e-05 20.257 1.43272 20.257 3.2C20.257 4.69101 19.2371 5.94353 17.857 6.29883V14.4668C19.0173 14.6615 20.0363 15.2722 20.7554 16.1406L27.8289 12.0563C27.4467 10.6835 28.0221 9.17394 29.3132 8.42852C30.8438 7.5449 32.8011 8.06948 33.6847 9.6C34.5683 11.1305 34.0437 13.0874 32.5132 13.9711C31.2219 14.7167 29.627 14.46 28.6293 13.4422L21.5562 17.5262C21.7502 18.0474 21.857 18.6112 21.857 19.2C21.857 19.7887 21.7501 20.3523 21.5562 20.8734L28.6293 24.9574C29.627 23.9398 31.222 23.6834 32.5132 24.4289C34.0437 25.3126 34.5683 27.2695 33.6847 28.8C32.8011 30.3305 30.8438 30.8547 29.3132 29.9711C28.0221 29.2256 27.4466 27.7161 27.8289 26.3434L20.7554 22.259C20.0363 23.1275 19.0174 23.7381 17.857 23.9328V32.1008C19.2371 32.456 20.257 33.709 20.257 35.2C20.257 36.9673 18.8243 38.3999 17.057 38.4C15.2897 38.4 13.857 36.9673 13.857 35.2C13.857 33.7089 14.8768 32.456 16.257 32.1008V23.9328C15.0965 23.7381 14.0774 23.1276 13.3582 22.259L6.28434 26.3434C6.66674 27.7162 6.09163 29.2256 4.80035 29.9711C3.26982 30.8547 1.31292 30.3305 0.429258 28.8C-0.454365 27.2695 0.0699456 25.3126 1.60035 24.4289C2.8916 23.6834 4.48659 23.9399 5.48434 24.9574L12.557 20.8738C12.3631 20.3526 12.257 19.7887 12.257 19.2C12.257 18.6111 12.363 18.0471 12.557 17.5258L5.48434 13.4422C4.48661 14.4599 2.89168 14.7166 1.60035 13.9711C0.0699493 13.0874 -0.454364 11.1305 0.429258 9.6C1.31292 8.06949 3.26983 7.54527 4.80035 8.42891C6.09151 9.17436 6.66653 10.6835 6.28434 12.0563L13.3582 16.1406C14.0774 15.2721 15.0966 14.6615 16.257 14.4668V6.29922C14.8768 5.94402 13.857 4.69111 13.857 3.2C13.857 1.43269 15.2897 0 17.057 0ZM17.057 33.2C15.9524 33.2 15.057 34.0954 15.057 35.2C15.057 36.3046 15.9524 37.2 17.057 37.2C18.1615 37.1999 19.057 36.3045 19.057 35.2C19.057 34.0955 18.1615 33.2001 17.057 33.2ZM4.93238 26.2C4.38008 25.2435 3.15691 24.9157 2.20035 25.468C1.24386 26.0203 0.916095 27.2435 1.46832 28.2C2.02059 29.1566 3.24378 29.4843 4.20035 28.932C5.15694 28.3797 5.48467 27.1566 4.93238 26.2ZM31.9132 25.468C30.9567 24.9157 29.7335 25.2434 29.1812 26.2C28.629 27.1566 28.9567 28.3797 29.9132 28.932C30.8698 29.4843 32.093 29.1566 32.6453 28.2C33.1976 27.2434 32.8698 26.0203 31.9132 25.468ZM4.20035 9.46797C3.24378 8.91575 2.02059 9.24344 1.46832 10.2C0.91609 11.1565 1.24386 12.3797 2.20035 12.932C3.15692 13.4843 4.38008 13.1565 4.93238 12.2C5.48467 11.2434 5.15694 10.0203 4.20035 9.46797ZM32.6453 10.2C32.093 9.24343 30.8698 8.91569 29.9132 9.46797C28.9567 10.0203 28.6289 11.2434 29.1812 12.2C29.7335 13.1566 30.9567 13.4843 31.9132 12.932C32.8698 12.3797 33.1976 11.1566 32.6453 10.2ZM17.057 1.2C15.9524 1.2 15.057 2.09543 15.057 3.2C15.057 4.30457 15.9524 5.2 17.057 5.2C18.1615 5.19995 19.057 4.30454 19.057 3.2C19.057 2.09546 18.1615 1.20005 17.057 1.2Z"
      />
    </svg>
  );
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Section 03 (Figma 128:804 / 128:830 / 128:857, 1920 x 1207): a pinned screen that slides up over the 3D stage,
 * then one feature per scroll stop (the stops are chapter snaps in story-map.ts `pageBands`, one gesture each).
 * `#features-band` is (n) screens tall: the pinned screen stays while the page moves (n - 1) screens, and the active
 * feature is the nearest stop. Image: cross-fade with a slow settle; card: copy leaves toward the scroll direction and
 * the next one comes in from the other side; the left indicator grows into the active bar.
 * Desktop sizes are the frame's own, in `--u` = one frame pixel (fits the frame to the viewport width or height).
 */
export function FeatureSection() {
  const band = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);
  const activeRef = useRef(0);

  useEffect(() => {
    const update = () => {
      const el = band.current;
      if (!el) return;
      const vh = window.innerHeight;
      const k = Math.min(Math.max(Math.round(-el.getBoundingClientRect().top / vh), 0), FEATURES.length - 1);
      if (k !== activeRef.current) {
        setDir(k > activeRef.current ? 1 : -1);
        activeRef.current = k;
        setActive(k);
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const feature = FEATURES[active];

  return (
    <div
      ref={band}
      id="features-band"
      className="z-over-scroll-sequence relative w-full"
      style={{ height: `${FEATURES.length * 100}dvh` }}
    >
      <section
        id="features"
        aria-label="Raven features"
        className="feature-stage font-tight sticky top-0 h-dvh w-full overflow-hidden bg-[#060606] text-white"
      >
        {/* Images (each with its frame's radial vignette baked in), stacked and cross-faded. */}
        {FEATURES.map((f, i) => (
          <img
            key={f.id}
            src={f.image}
            alt={i === active ? f.alt : ""}
            aria-hidden={i !== active}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-[72%_50%] md:object-center"
            style={{
              opacity: i === active ? 1 : 0,
              transform: `scale(${i === active ? 1 : 1.06})`,
              transition: `opacity 0.9s ${i === active ? "0.1s" : "0s"} ease-in-out, transform 1.6s cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          />
        ))}

        <div className="feature-layout absolute inset-0">
          <div className="feature-heading">
            <h2 className="feature-h">{SECTION_HEADING}</h2>
            <p className="feature-p">{SECTION_BODY}</p>
          </div>

          <div className="feature-card bg-[#242424]">
            <div className="relative">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.div
                  key={feature.id}
                  custom={dir}
                  variants={{
                    enter: (d: number) => ({ opacity: 0, y: 24 * d }),
                    center: { opacity: 1, y: 0 },
                    exit: (d: number) => ({ opacity: 0, y: -24 * d }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.55, ease: EASE }}
                  className="feature-copy"
                >
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-body">{feature.body}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="feature-foot">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.ul
                  key={feature.id}
                  custom={dir}
                  variants={{
                    enter: (d: number) => ({ opacity: 0, y: 12 * d }),
                    center: { opacity: 1, y: 0 },
                    exit: (d: number) => ({ opacity: 0, y: -12 * d }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
                  className="feature-tags"
                >
                  {feature.tags.map((t) => (
                    <li key={t} className="feature-tag font-dm bg-white/30 uppercase">
                      {t}
                    </li>
                  ))}
                </motion.ul>
              </AnimatePresence>
              <HexaMark className="feature-mark" />
            </div>
          </div>

          {/* Indicator (Figma "Frame 27"): 6px squares, the active one a 45px yellow bar. */}
          <ol className="feature-dots" aria-label={`Feature ${active + 1} of ${FEATURES.length}`}>
            {FEATURES.map((f, i) => (
              <li key={f.id} className="feature-dot" data-active={i === active ? "" : undefined} />
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
