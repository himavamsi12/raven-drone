/// <reference lib="webworker" />
import { computeNetField } from "./net-terrain-field";

/** Network terrain heights off the main thread (NetTerrain.tsx). */
const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage(m: unknown, t?: Transferable[]): void };

ctx.onmessage = () => {
  try {
    const f = computeNetField();
    ctx.postMessage(f, [f.heights.buffer, f.dots.buffer]);
  } catch (err) {
    ctx.postMessage({ error: String(err) });
  }
};
