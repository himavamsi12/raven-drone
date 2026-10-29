import clsx from "clsx";
import { useId } from "react";

/** Raven wordmark: same boxes as the shipped wordmark (module 72549) so footer layout and WebGL outline line up. */
export const WORDMARK = "RAVEN";
export const WORDMARK_BOXES = { desktop: [1632, 249], mobile: [357, 58] } as const;
/** Geist cap height is ~0.7em; caps fill the box height with the baseline on the bottom edge. */
export const WORDMARK_CAP = 0.7;

/** Inner-stroke wordmark with fading gradient (shipped module 72549 styling; Raven type replaces the USAvionix paths). */
function Outline({ box, strokeWidth, type, className }: { box: readonly [number, number]; strokeWidth: string; type: string; className?: string }) {
  const grad = useId();
  const mask = useId();
  const [w, h] = box;
  const text = {
    x: 0,
    y: h,
    fontSize: h / WORDMARK_CAP,
    fontWeight: 600,
    textLength: w,
    lengthAdjust: "spacing" as const,
    style: { fontFamily: "var(--font-geist-sans)" },
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${w} ${h}`} fill="none" className={className} data-type={type} role="img" aria-label="Raven">
      <mask id={mask} fill="#fff">
        <text {...text}>{WORDMARK}</text>
      </mask>
      <text {...text} mask={`url(#${mask})`} stroke={`url(#${grad})`} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke">
        {WORDMARK}
      </text>
      <defs>
        <linearGradient id={grad} x1="816" y1="0" x2="816" y2="248.827" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E2E2E2" stopOpacity=".6" />
          <stop offset=".9" stopColor="#E2E2E2" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function HeroLogo({ className }: { className?: string }) {
  return (
    <>
      <Outline box={WORDMARK_BOXES.desktop} strokeWidth="3" type="hero-logo-desktop" className={clsx("hidden md:block", className)} />
      <Outline box={WORDMARK_BOXES.mobile} strokeWidth="2" type="hero-logo-mobile" className={clsx("block md:hidden", className)} />
    </>
  );
}
