"use client";

import clsx from "clsx";
import { ContactButton } from "@/components/ContactButton";
import { Modal } from "@/components/ui/Modal";
import dynamic from "next/dynamic";
import { CONCEPT_NOTICE, USE_CASE_CTA } from "@/lib/copy";
import { HeroLogo } from "./HeroLogo";

const FooterDrone = dynamic(() => import("./FooterDrone").then((m) => m.FooterDrone), { ssr: false });

export const TEAM_TEXT =
  "Raven is a medical delivery drone concept for remote mountain and cold-climate communities. This site explores the journey, the aircraft and the connection between local care teams.";

/** On lg+ the WebGL landing sequence draws this text/logos; the DOM copy stays for a11y. */
export function OurTeam() {
  return (
    <section className="container-md relative flex flex-col items-center gap-8 lg:invisible" id="our-team" aria-label="About Raven">
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
      {/* Below lg the reference shows the final landing frame; Raven shows the live hexacopter at rest there. */}
      <FooterDrone className="absolute bottom-0 left-1/2 aspect-square h-full max-w-none -translate-x-1/2 md:h-19/20 lg:hidden" />
      <HeroLogo className="mt-5 w-full md:mt-8 lg:invisible" />
      <div className="z-over-scroll-sequence flex w-full flex-col items-center justify-between gap-12 pb-8 md:flex-row md:items-end">
        <div className="flex max-w-94 flex-col items-center gap-5 text-center md:items-start md:text-left">
          <p className="text-d-h3 text-white">Start with a place that needs the connection.</p>
          <p className="text-d-body-s hidden text-white/50 md:block">{CONCEPT_NOTICE}</p>
          <ContactButton label={USE_CASE_CTA} withArrow className="w-full md:w-62.5" />
        </div>
        <div className="flex flex-col items-center gap-6 whitespace-nowrap md:contents">
          <p className="text-d-cta hidden text-white/20 lg:block">Raven · Local concept · {new Date().getFullYear()}</p>
          <p className="text-m-body-l order-last max-w-80 text-center whitespace-normal text-white/60 md:hidden">{CONCEPT_NOTICE}</p>
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
