import type Lenis from "lenis";

/** Ref-counted Lenis lock (shipped module 86620). */
let lockCount = 0;
let stopCount = 0;

export const LOCK_EVENT = "lenis-lock-change";
export const isScrollLocked = () => lockCount > 0;

const emit = () =>
  window.dispatchEvent(new CustomEvent(LOCK_EVENT, { detail: { locked: isScrollLocked() } }));

export function lockScroll(lenis: Lenis | undefined, opts?: { keepScroll?: boolean }) {
  if (!lenis) return;
  lockCount += 1;
  if (!opts?.keepScroll && ++stopCount === 1) lenis.stop();
  emit();
}

export function unlockScroll(lenis: Lenis | undefined, opts?: { keepScroll?: boolean }) {
  if (!lenis) return;
  lockCount = Math.max(0, lockCount - 1);
  if (!opts?.keepScroll) {
    stopCount = Math.max(0, stopCount - 1);
    if (stopCount === 0) lenis.start();
  }
  emit();
}
