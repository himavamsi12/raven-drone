/**
 * Section 05 "Use cases" (user mockup 2026-11-05): kicker, heading, one line, then three photo cards with a mono title
 * and a caption. Static DOM below Section 04. Photos: the user's originals (raven-drone-site/src/usecases, 1088 x 1120 =
 * 2x the mockup's 544 x 560 card), JPEG q86 in public/assets/use-cases/.
 */
const USE_CASES = [
  {
    id: "healthcare",
    title: "Healthcare",
    body: "Vaccines, blood and essential medicines, delivered cold-chain intact.",
    src: "/assets/use-cases/healthcare.jpg",
    alt: "Raven hexacopter carrying a white medical box over misty hills at sunset",
  },
  {
    id: "disaster-relief",
    title: "Disaster relief",
    body: "Rapid resupply into flood zones and cut-off communities.",
    src: "/assets/use-cases/disaster-relief.jpg",
    alt: "Rescue workers guiding a drone lowering a medical kit beside a flooded village",
  },
  {
    id: "industrial",
    title: "Industrial",
    body: "Spares and critical parts, flown to offshore and remote sites.",
    src: "/assets/use-cases/industrial.jpg",
    alt: "Drone lowering a cargo crate onto a ship's helideck at sea",
  },
] as const;

export function UseCases() {
  return (
    <section
      id="use-cases"
      aria-labelledby="use-cases-h"
      className="uc font-tight z-over-scroll-sequence relative w-full bg-[#060606] text-white"
    >
      <div className="uc-inner">
        <p className="uc-kicker font-dm uppercase">/ Use cases</p>
        <h2 id="use-cases-h" className="uc-h">
          Built for the missions roads can&rsquo;t reach.
        </h2>
        <p className="uc-p">One platform. Multiple critical delivery scenarios.</p>

        <ul className="uc-grid">
          {USE_CASES.map((c) => (
            <li key={c.id} className="uc-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.src} alt={c.alt} loading="lazy" decoding="async" className="uc-img" />
              <h3 className="uc-title font-dm uppercase">{c.title}</h3>
              <p className="uc-body">{c.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
