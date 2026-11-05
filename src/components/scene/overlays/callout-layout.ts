/**
 * Shared placement for the stage callouts (payload, altitude, speed). User mockup 2026-11-05: a right-aligned block on
 * the right edge, vertically centred, "/ " before the mono kicker, headline smaller than the d-h0 hero size.
 * Phones: the same right-aligned block under the nav bar (the centre of the screen is the drone / terrain).
 */
export const CALLOUT_BOX =
  "absolute right-[clamp(20px,4.6vw,72px)] top-[calc(var(--nav-height)+20px)] md:top-1/2 md:-translate-y-1/2 flex flex-col items-end text-right max-w-[min(380px,calc(100vw-40px))]";
export const CALLOUT_H = "text-[40px] md:text-[clamp(44px,4vw,64px)] leading-none font-semibold tracking-[-0.04em] whitespace-nowrap tabular-nums";
export const CALLOUT_BODY = "text-m-body-l md:text-d-body-l mt-3 text-pretty max-w-[300px]";
export const kickerText = (k: string) => `/ ${k}`;
