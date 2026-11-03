"use client";

export const TEAM_TEXT =
  "Raven is a medical delivery drone concept for remote mountain and cold-climate communities. This site explores the journey, the aircraft and the connection between local care teams.";

/** About section (nav "About" target). Plain DOM on every size since the footer's WebGL sequence was removed. */
export function OurTeam() {
  return (
    <section className="container-md relative flex flex-col items-center gap-8" id="our-team" aria-label="About Raven">
      <p className="md:text-d-body-l text-m-body-l max-w-148.5 px-4 text-center text-pretty" data-type="our-team-description">
        {TEAM_TEXT}
      </p>
      <div
        data-type="our-team-logos"
        className="relative grid grid-cols-2 gap-x-0 gap-y-6 py-6 md:-mx-8 md:flex md:max-w-192 md:flex-wrap md:justify-center md:gap-x-12 md:gap-y-8 md:py-8"
      >
        {["Medical supply routes", "Remote communities", "Local care teams"].map((name) => (
          <span key={name} className="text-m-mono md:text-d-mono uppercase text-white/60">{name}</span>
        ))}
      </div>
    </section>
  );
}
