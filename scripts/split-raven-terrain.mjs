#!/usr/bin/env node
/**
 * Progressive Raven terrain (load-time, 2026-11-05): splits public/assets/models/raven-terrain.glb into
 *   - raven-terrain-lite.glb      same JSON/geometry/houses map, the 4K land map swapped for a 512 preview (~70 KB)
 *   - textures/terrain/raven-natural-a.webp   the 4K land map, byte-identical to the one inside the GLB
 *   - textures/terrain/raven-natural-a-2k.webp a 2048 step between the two
 * The page reveals on the lite GLB and swaps the 4K map in as soon as it arrives (Terrain.tsx), so the final ground
 * is the same bytes as before; only the first seconds on a slow connection use the preview.
 * Re-run after every rebuild of raven-terrain.glb:  node scripts/split-raven-terrain.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { readGlb, writeGlb } from "./lib/glb.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "public/assets/models/raven-terrain.glb");
const OUT_GLB = path.join(ROOT, "public/assets/models/raven-terrain-lite.glb");
const OUT_MAP = path.join(ROOT, "public/assets/textures/terrain/raven-natural-a.webp");
/** Middle tier (2026-11-06): shown between the GLB's 1024 preview and the 4K original. */
const OUT_MAP_2K = path.join(ROOT, "public/assets/textures/terrain/raven-natural-a-2k.webp");
/** First-frame preview (512 since 2026-11-06: the 2K step or the 4K map always follows). */
const PREVIEW = 512;

const { json, view } = readGlb(SRC);

// The land map: the image used by the Land-A material's baseColorTexture.
const landMesh = json.nodes.find((n) => n.name === "Land-A");
const landMat = json.materials[json.meshes[landMesh.mesh].primitives[0].material];
const tex = json.textures[landMat.pbrMetallicRoughness.baseColorTexture.index];
const imageIndex = tex.extensions?.EXT_texture_webp?.source ?? tex.source;
const image = json.images[imageIndex];
const full = view(image.bufferView);
const meta = await sharp(full).metadata();
if (meta.width !== 4096) throw new Error(`expected the 4K land map, got ${meta.width}`);

fs.writeFileSync(OUT_MAP, full);
const mid = await sharp(full).resize(2048, 2048, { kernel: "lanczos3" }).webp({ quality: 80, effort: 6 }).toBuffer();
fs.writeFileSync(OUT_MAP_2K, mid);
const preview = await sharp(full).resize(PREVIEW, PREVIEW, { kernel: "lanczos3" }).webp({ quality: 80, effort: 6 }).toBuffer();

json.extras = { ...(json.extras ?? {}), ravenLandMap: { preview: PREVIEW, full: "/assets/textures/terrain/raven-natural-a.webp" } };
writeGlb(OUT_GLB, json, view, new Map([[image.bufferView, preview]]));
console.log(
  `${path.relative(ROOT, OUT_GLB)} ${(fs.statSync(OUT_GLB).size / 1024) | 0} KB, ${path.relative(ROOT, OUT_MAP)} ${(full.length / 1024) | 0} KB (byte-identical), 2K step ${(mid.length / 1024) | 0} KB`,
);
