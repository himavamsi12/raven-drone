/// <reference lib="webworker" />
import { computeMountain, type MountainInput, type MountainResult } from "./mountain-field";

/** Mountain terrain heightfield off the main thread (mountain-terrain.ts `compute`). */
const ctx = self as unknown as { onmessage: ((e: MessageEvent<MountainInput>) => void) | null; postMessage(m: unknown, t?: Transferable[]): void };

ctx.onmessage = async (e) => {
  try {
    const r: MountainResult = await computeMountain(e.data);
    const transfer: Transferable[] = [r.uv.buffer, r.index.buffer, r.detail.albedo.buffer, r.detail.normal.buffer];
    for (const s of r.slices) transfer.push(s.position.buffer, s.normal.buffer, s.grad.buffer, s.data.buffer);
    ctx.postMessage(r, transfer);
  } catch (err) {
    ctx.postMessage({ error: String(err) });
  }
};
