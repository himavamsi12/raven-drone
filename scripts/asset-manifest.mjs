// Builds research/usavionix/asset-manifest.json from files under public/assets.
// Records source URL, local path, bytes, SHA-256, MIME, dimensions / GLB metadata,
// and flags HTML error pages masquerading as assets.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PUBLIC = join(ROOT, "public");
const ORIGIN = "https://www.usavionix.com";
const BLOB = "https://ty7nrq32jjydkjmd.public.blob.vercel-storage.com";

const MIME = {
  ".glb": "model/gltf-binary",
  ".webp": "image/webp",
  ".png": "image/png",
  ".avif": "image/avif",
  ".exr": "image/x-exr",
  ".json": "application/json",
  ".woff": "font/woff",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
};

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const sourceFor = (local) => {
  if (local === "/assets/models/raven_drone_refined.glb") return "local:glb/raven-refined/refine.py";
  if (local === "/assets/models/raven_quad.glb") return "local:glb/raven-quad/build_raven_quad.py";
  if (local === "/assets/models/drone-lowpoly.glb" || local === "/assets/models/loading-drone.glb") return "local:glb/raven-quad/build_silhouettes.py";
  if (local.startsWith("/assets/images/raven-landing/") || local.startsWith("/assets/images/media/raven-")) return "local:glb/raven-quad/render_media.py";
  if (local === "/assets/models/raven_drone.glb") return "local:glb/raven_drone.glb";
  if (local.startsWith("/assets/sounds/")) return BLOB + local;
  const m = local.match(/^\/assets\/images\/media\/(.+)$/);
  if (m) return `${ORIGIN}/_next/static/media/${m[1]}`;
  return ORIGIN + local;
};

function glbMeta(buf) {
  if (buf.toString("ascii", 0, 4) !== "glTF") return { error: "bad magic" };
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + len));
  return {
    version: buf.readUInt32LE(4),
    nodes: (json.nodes ?? []).map((n) => n.name),
    meshes: (json.meshes ?? []).length,
    materials: (json.materials ?? []).map((m) => m.name),
    animations: (json.animations ?? []).map((a) => a.name),
    extensionsUsed: json.extensionsUsed ?? [],
    externalUris: [...(json.buffers ?? []), ...(json.images ?? [])].map((x) => x.uri).filter(Boolean),
  };
}

function imageSize(buf, ext) {
  try {
    if (ext === ".png") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (ext === ".avif") {
      const i = buf.indexOf("ispe");
      if (i > 0) return { width: buf.readUInt32BE(i + 8), height: buf.readUInt32BE(i + 12) };
    }
    if (ext === ".webp") {
      const kind = buf.toString("ascii", 12, 16);
      if (kind === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      if (kind === "VP8L") {
        const b = buf.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      if (kind === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
  } catch {}
  return null;
}

const files = walk(join(PUBLIC, "assets")).sort();
const entries = files.map((abs) => {
  const buf = readFileSync(abs);
  const local = "/" + relative(PUBLIC, abs).split("\\").join("/");
  const ext = extname(abs).toLowerCase();
  const head = buf.toString("utf8", 0, 64).trimStart().toLowerCase();
  const entry = {
    source: sourceFor(local),
    local: "public" + local,
    bytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
    mime: MIME[ext] ?? "application/octet-stream",
    htmlErrorPage: head.startsWith("<!doctype") || head.startsWith("<html"),
  };
  if (ext === ".glb") entry.glb = glbMeta(buf);
  const size = imageSize(buf, ext);
  if (size) entry.dimensions = size;
  return entry;
});

const out = {
  capturedAt: new Date().toISOString(),
  reference: ORIGIN + "/",
  count: entries.length,
  totalBytes: entries.reduce((a, e) => a + e.bytes, 0),
  htmlErrorPages: entries.filter((e) => e.htmlErrorPage).map((e) => e.local),
  missingDependencies: entries.flatMap((e) => (e.glb?.externalUris ?? []).map((u) => `${e.local} -> ${u}`)),
  entries,
};
mkdirSync(join(ROOT, "research/usavionix"), { recursive: true }); // research/ is not committed
writeFileSync(join(ROOT, "research/usavionix/asset-manifest.json"), JSON.stringify(out, null, 2));
console.log(`${out.count} assets, ${(out.totalBytes / 1e6).toFixed(1)} MB, html-errors: ${out.htmlErrorPages.length}, external deps: ${out.missingDependencies.length}`);
