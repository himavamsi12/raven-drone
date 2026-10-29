/** Helpers recovered from shipped module 81672 / 32288 / 79213. */

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

const norm = (a: number, b: number, v: number) => clamp((v - a) / (b - a), 0, 1);

/** Clamped linear remap: v in [inMin,inMax] -> [outMin,outMax]. */
export const remap = (v: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
  outMin + norm(inMin, inMax, v) * (outMax - outMin);

/** Clamped remap with easing applied to the normalized value. */
export const remapEased = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  ease?: (t: number) => number,
) => {
  let t = norm(inMin, inMax, v);
  if (ease) t = ease(t);
  return outMin + t * (outMax - outMin);
};

export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const randRange = (min = 0, max = 1) => Math.random() * (max - min) + min;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Wraps v into [min, max). */
export const wrap = (v: number, min: number, max: number) => {
  v -= min;
  max -= min;
  return (v < 0 ? (max - (Math.abs(v) % max)) % max : v % max) + min;
};

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const linear = (t: number) => t;

/** Frame-rate independent exponential damping (maath `damp`). */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));
