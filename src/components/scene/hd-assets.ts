import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { whenQuiet } from "@/lib/quiet";

export { whenQuiet };

/**
 * Progressive full-quality assets (load time, 2026-11-06, user: "use low textures first, then replace them with the
 * full ones"). The first frame uses previews (drone maps 256, terrain land map 512); the full-quality maps load here
 * one task at a time after the scene is up, most visible first:
 *   0 drone maps (pixel-identical to raven_hexa.glb's, every link) ->
 *   slow links (user 2026-11-06: "drone full + ground 2K"): 1 terrain 2K, then stop;
 *   fast links: 2 terrain 4K land map -> 3 tree-variant maps (as before).
 * The queue stays paused until `startHd()` (MainScene's first frame), so nothing here competes with the reveal.
 */
export const HD_PRIORITY = { drone: 0, terrainStep: 1, terrain: 2, variants: 3 } as const;

type Task = { priority: number; run: () => Promise<void>; done: () => void };
const pending: Task[] = [];
let started = false;
let running = false;
const finished = new Map<number, number>(); // priority -> tasks finished
const queued = new Map<number, number>(); // priority -> tasks queued
const waiters: { max: number; resolve: () => void }[] = [];

function settled(max: number) {
  for (const [p, n] of queued) if (p <= max && (finished.get(p) ?? 0) < n) return false;
  return true;
}

function notify() {
  for (let i = waiters.length - 1; i >= 0; i--) {
    if (settled(waiters[i].max)) {
      waiters[i].resolve();
      waiters.splice(i, 1);
    }
  }
}

async function pump() {
  if (!started || running) return;
  running = true;
  while (pending.length) {
    pending.sort((a, b) => a.priority - b.priority);
    const task = pending.shift()!;
    try {
      await task.run();
    } catch (err) {
      console.warn("Full-quality asset failed; keeping the preview.", err);
    }
    finished.set(task.priority, (finished.get(task.priority) ?? 0) + 1);
    performance.mark(`raven-hd-${task.priority}`); // load-time checks: when each full-quality step landed
    task.done();
    notify();
  }
  running = false;
}

/** Queue a full-quality download; resolves once it ran (failures keep the preview and still resolve). */
export function queueHd(priority: number, run: () => Promise<void>): Promise<void> {
  queued.set(priority, (queued.get(priority) ?? 0) + 1);
  return new Promise<void>((done) => {
    pending.push({ priority, run, done });
    // Collect the tasks queued in the same commit before picking the first.
    setTimeout(pump, 0);
  });
}

/** Opens the queue (the scene has rendered its first frame). */
export function startHd() {
  if (started) return;
  started = true;
  setTimeout(pump, 0);
}

/** Resolves when every task queued so far up to `max` priority has run. */
export function hdSettled(max: number): Promise<void> {
  if (settled(max)) return Promise.resolve();
  return new Promise((resolve) => waiters.push({ max, resolve }));
}

// ---------------------------------------------------------------------------------------------------------------
// GLB maps: the lite GLB's images carry `extras.full` (scripts/split-raven-hexa.mjs).

const upgrades = new WeakMap<object, Promise<void>>();

type Decoded = ImageBitmap | HTMLImageElement;

async function decode(url: string, likeBitmap: boolean): Promise<Decoded> {
  if (likeBitmap) {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    // Same options as three's ImageBitmapLoader (used by GLTFLoader), so orientation, alpha and colour match exactly.
    return createImageBitmap(await res.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  }
  return new THREE.ImageLoader().setCrossOrigin("anonymous").loadAsync(url);
}

/**
 * Swaps every preview map of a lite GLB for its original. The new image goes into the texture's shared `Source`, so
 * clones (KHR_texture_transform copies, cloned materials of every drone instance, other canvases) all update, and
 * sampler, transform, colour space and anisotropy stay as they are.
 */
export function upgradeGltfMaps(gltf: GLTF, priority: number = HD_PRIORITY.drone): Promise<void> {
  let upgrade = upgrades.get(gltf);
  if (upgrade) return upgrade;
  upgrade = queueHd(priority, async () => {
    const json = gltf.parser.json as {
      textures?: { source?: number; extensions?: Record<string, { source?: number }> }[];
      images?: { extras?: { full?: string } }[];
    };
    const groups = new Map<THREE.Source, { url: string; textures: Set<THREE.Texture> }>();
    const textures = new Set<THREE.Texture>();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        for (const v of Object.values(m)) if ((v as THREE.Texture)?.isTexture) textures.add(v as THREE.Texture);
    });
    for (const tex of textures) {
      const ref = gltf.parser.associations.get(tex) as { textures?: number } | undefined;
      if (ref?.textures === undefined) continue;
      const def = json.textures?.[ref.textures];
      const imageIndex = def?.extensions?.EXT_texture_webp?.source ?? def?.source;
      const url = imageIndex === undefined ? undefined : json.images?.[imageIndex]?.extras?.full;
      if (!url) continue;
      const group = groups.get(tex.source) ?? { url, textures: new Set() };
      group.textures.add(tex);
      groups.set(tex.source, group);
    }
    // Sharing Source: every texture object pointing at it must bump its version to re-upload.
    const allTextures = (source: THREE.Source) => [...textures].filter((t) => t.source === source);
    // Download and decode everything first, then swap all maps together in one quiet frame.
    const decoded = await Promise.all(
      [...groups].map(async ([source, { url }]) => {
        const old = source.data as Decoded | undefined;
        return { source, old, image: await decode(url, typeof ImageBitmap !== "undefined" && old instanceof ImageBitmap) };
      }),
    );
    await whenQuiet();
    for (const { source, old, image } of decoded) {
      source.data = image;
      // The GPU copy was allocated at the preview size (immutable texStorage): drop it so three re-creates it at the
      // original's size, instead of a sub-image upload that overflows it (GL_INVALID_VALUE, preview kept).
      for (const tex of allTextures(source)) {
        tex.dispose();
        tex.needsUpdate = true;
      }
      if (typeof ImageBitmap !== "undefined" && old instanceof ImageBitmap) old.close();
    }
  });
  upgrades.set(gltf, upgrade);
  return upgrade;
}
