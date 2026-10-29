"use client";

import clsx from "clsx";
import { LayoutGroup, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ContactButton } from "@/components/ContactButton";
import { Modal } from "@/components/ui/Modal";
import { LANDING_SEQUENCE } from "@/lib/assets";
import { useMediaQuery } from "@/lib/use-media-query";
import { Globe } from "./Globe";
import { HeroLogo } from "./HeroLogo";

const USE_CASES = [
  {
    title: "Mountain Villages",
    description:
      "A medical delivery concept connecting mountain villages with essential supplies when long journeys make routine care difficult.",
    image: "/assets/images/media/raven-mountain-villages.webp",
  },
  {
    title: "Winter Access",
    description:
      "Explore routes to cold-climate communities where snow and disrupted road access can separate people from nearby health centres.",
    image: "/assets/images/media/raven-winter-access.webp",
  },
  {
    title: "Remote Health Centres",
    description:
      "Connect regional medical hubs with remote health workers through a coordinated supply delivery concept.",
    image: "/assets/images/media/raven-remote-health-centres.webp",
  },
];

/** Expanding mission cards (shipped module 88572). */
export function UseCases() {
  const [expanded, setExpanded] = useState(0);
  const grid = useRef<HTMLDivElement>(null);
  const [maxWidth, setMaxWidth] = useState(0);
  const lg = useMediaQuery("(min-width: 1024px)");
  useEffect(() => {
    const on = () => grid.current && setMaxWidth(grid.current.clientWidth / 2 - 12 - 40 - 40);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return (
    <section className="-mt-4 w-full md:-mt-8" aria-labelledby="missions-title">
      <div className="container-md mx-auto flex w-full flex-col gap-4 md:gap-6">
        <h2 id="missions-title" className="text-m-h2 md:text-d-h2 text-balance">
          One purpose. Care within reach.
        </h2>
        <LayoutGroup>
          <motion.div ref={grid} layout className="grid w-full grid-cols-1 gap-4 md:gap-6 lg:grid-cols-4">
            {USE_CASES.map((c, i) => {
              const open = expanded === i;
              return (
                <motion.div
                  key={c.title}
                  layout
                  className={clsx(
                    "-outline-offset group relative h-90 overflow-hidden rounded-2xl outline outline-white/15 lg:h-157.5 lg:cursor-pointer",
                    open ? "lg:col-span-2" : "lg:col-span-1",
                  )}
                  onClick={lg ? () => setExpanded(i) : undefined}
                  onKeyDown={(e) => {
                    if (lg && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      setExpanded(i);
                    }
                  }}
                  role={lg ? "button" : undefined}
                  tabIndex={lg ? 0 : undefined}
                  aria-expanded={lg ? open : undefined}
                >
                  <motion.div
                    layout
                    className={clsx(
                      "absolute top-1/2 left-1/2 aspect-[358/360] h-full w-full -translate-x-1/2 -translate-y-1/2 scale-105 transition-opacity lg:aspect-[675/630] lg:w-auto lg:group-hover:opacity-90",
                      open && "opacity-100!",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image} alt={c.title} className="absolute inset-0 h-full w-full object-cover" />
                  </motion.div>
                  <motion.div
                    layout
                    className="absolute right-4 bottom-4 left-4 flex flex-col gap-4 lg:right-auto lg:bottom-10 lg:left-10 lg:w-[var(--max-available-width)]!"
                    animate={{ opacity: open || !lg ? 1 : 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    style={{ "--max-available-width": `${maxWidth}px` } as React.CSSProperties}
                  >
                    <p className="text-m-h3 md:text-d-h3">{c.title}</p>
                    <p className="text-m-body-l md:text-d-body-l text-pretty text-white/80">{c.description}</p>
                  </motion.div>
                </motion.div>
              );
            })}
          </motion.div>
        </LayoutGroup>
      </div>
    </section>
  );
}

export function Coverage() {
  return (
    <section className="relative w-full overflow-hidden">
      <div className="flex w-full flex-col items-center justify-center">
        <div className="container-md relative -mt-[12vw] flex w-full flex-col items-center justify-center lg:-mt-0 lg:aspect-[2/1]">
          <Globe />
          <div className="relative z-10 flex flex-col gap-4 md:gap-6 lg:absolute lg:top-0 lg:left-10 lg:z-10 lg:w-120 lg:items-start">
            <h2 className="text-m-h2 md:text-d-h2">
              Connecting care across mountain valleys, tundra settlements and the communities beyond the last road.
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Demo() {
  return (
    <section className="w-full">
      <div className="container-md mx-auto -mt-12 flex flex-col items-center gap-2 lg:-mt-16 lg:flex-row lg:justify-between lg:gap-12 xl:-mt-24">
        <div className="relative flex h-92 w-full items-center justify-center lg:aspect-690/644 lg:h-auto lg:max-w-185 lg:flex-1">
          <div className="absolute -inset-4 lg:static lg:inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/images/media/raven-demo-mobile.webp" alt="" className="absolute top-0 left-0 h-full object-cover lg:hidden" />
            <div className="absolute top-0 left-1/2 hidden aspect-1015/644 h-full -translate-x-1/2 lg:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/images/media/raven-demo-desktop.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-right" />
              <div className="pointer-events-none absolute top-0 left-0 hidden h-full w-64 bg-gradient-to-r from-black via-transparent to-transparent lg:block" />
              <div className="pointer-events-none absolute top-0 right-0 hidden h-full w-64 bg-gradient-to-l from-black via-transparent to-transparent lg:block" />
            </div>
          </div>
        </div>
        <div className="relative z-10 flex max-w-lg flex-col gap-6 lg:w-136 lg:max-w-none lg:gap-12">
          <div className="flex flex-col gap-4 lg:gap-6">
            <p className="text-m-h2 md:text-d-h2">Explore a medical delivery route</p>
            <p className="text-m-h3 md:text-d-h3 text-pretty text-white/80">
              Explore the Raven concept for remote medical logistics. This local prototype illustrates the experience; flight capabilities and service availability are not yet defined.
            </p>
          </div>
          <ContactButton label="Discuss a Route" withArrow />
        </div>
      </div>
    </section>
  );
}

export const TEAM_TEXT =
  "Raven is a medical delivery concept focused on a simple goal: helping essential care reach people in remote mountain and cold-climate communities.";

/** On lg+ the WebGL landing sequence draws this text/logos; the DOM copy stays for a11y. */
export function OurTeam() {
  return (
    <section className="container-md relative flex flex-col items-center gap-8 lg:invisible" id="our-team" aria-label="Our team">
      <p className="md:text-d-body-l text-m-body-l max-w-148.5 px-4 text-center text-pretty" data-type="our-team-description">
        {TEAM_TEXT}
      </p>
      <div
        data-type="our-team-logos"
        className="relative grid lg:visible grid-cols-2 gap-x-0 gap-y-6 py-6 md:-mx-8 md:flex md:max-w-192 md:flex-wrap md:justify-center md:gap-x-12 md:gap-y-8 md:py-8"
      >
        {["Medical supply routes", "Remote communities", "Local care teams"].map((name) => (
          <span key={name} className="text-m-mono md:text-d-mono uppercase text-white/60">{name}</span>
        ))}
      </div>
    </section>
  );
}

const PRIVACY = [
  "Raven is a design concept, and this site is a demonstration of it.",
  "The site does not ask for an account, run analytics, or set tracking cookies. The contact form only checks your entries in the browser; nothing you type is sent or stored.",
  "Like any website, the hosting provider may keep standard technical request logs (such as IP address and time of request) to deliver and protect the site.",
];

const TERMS = [
  "This site presents Raven, a medical delivery drone concept. It is not an offer of any product or service.",
  "Raven has no stated flight performance, payload, range, weather rating or certification, and nothing on this site should be read as one.",
  "Imagery and animation are illustrations of the concept and are provided as-is.",
];

const linkCls ="text-d-cta cursor-pointer underline decoration-1 underline-offset-2 hover:no-underline";

export function Footer() {
  return (
    <footer id="footer" className="relative flex h-[calc(100vh-var(--nav-height))] w-full flex-col items-center justify-between px-4 md:px-12">
      {/* Below lg the final sequence frame is a static image (reference behavior). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LANDING_SEQUENCE[95]}
        alt=""
        width={1920}
        height={1920}
        loading="lazy"
        className="absolute bottom-0 left-1/2 aspect-square h-full w-auto origin-bottom -translate-x-1/2 object-cover md:h-19/20 lg:hidden"
      />
      <HeroLogo className="mt-5 w-full md:mt-8 lg:invisible" />
      <div className="z-over-scroll-sequence flex w-full flex-col items-center justify-between gap-12 pb-8 md:flex-row md:items-end">
        <div className="flex max-w-94 flex-col items-center gap-5 text-center md:items-start md:text-left">
          <p className="text-d-h3 text-white">Bring care closer.</p>
          <ContactButton label="Contact Us" withArrow className="w-full md:w-auto" />
        </div>
        <div className="flex flex-col items-center gap-6 whitespace-nowrap md:contents">
          <p className="text-d-cta order-last text-white/20 md:order-none md:hidden lg:block">Raven · Local concept · {new Date().getFullYear()}</p>
          <div className="flex items-center gap-6 whitespace-nowrap md:gap-6.5">
            <Modal
              title="Privacy Policy"
              trigger={
                <button type="button" className={linkCls}>
                  Privacy Policy
                </button>
              }
            >
              {PRIVACY.map((p, i) => (
                <p key={i} className={clsx("whitespace-normal", i > 0 && "mt-5")}>
                  {p}
                </p>
              ))}
            </Modal>
            <Modal
              title="Terms of Use"
              trigger={
                <button type="button" className={linkCls}>
                  Terms of Use
                </button>
              }
            >
              {TERMS.map((p, i) => (
                <p key={i} className={clsx("whitespace-normal", i > 0 && "mt-5")}>
                  {p}
                </p>
              ))}
            </Modal>
          </div>
        </div>
      </div>
    </footer>
  );
}
