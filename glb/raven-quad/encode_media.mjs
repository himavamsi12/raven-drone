// Encodes glb/raven-quad/media/*.png renders into the site's formats (same sizes/codecs as the jet images they replace).
// Usage: node glb/raven-quad/encode_media.mjs <path-to-sharp> [images|seq]   (sharp ships with @gltf-transform/cli's npx cache)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] ?? 'sharp');
const ONLY = process.argv[3]; // optional: 'images' or 'seq'
const SRC = join(ROOT, 'glb/raven-quad/media');
const MEDIA = join(ROOT, 'public/assets/images/media');
const SEQ = join(ROOT, 'public/assets/images/raven-landing');
mkdirSync(SEQ, { recursive: true });

// Mission cards keep the shipped per-row alpha fade (opaque top -> ~30% bottom) so card copy sits on the dark card.
const fade = JSON.parse(readFileSync(join(ROOT, 'glb/raven-quad/card-alpha.json'), 'utf8')).alpha;
const cardAlpha = (w, h) => {
  const a = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) a.fill(fade[Math.round((y * (fade.length - 1)) / (h - 1))], y * w, (y + 1) * w);
  return a;
};
const jobs = [
  ['card_mountain_villages.png', 'raven-mountain-villages.webp', 1350, 1260, true],
  ['card_winter_access.png', 'raven-winter-access.webp', 1350, 1260, true],
  ['card_remote_health_centres.png', 'raven-remote-health-centres.webp', 1350, 1260, true],
  ['demo_desktop.png', 'raven-demo-desktop.webp', 1015, 644, false],
  ['demo_mobile.png', 'raven-demo-mobile.webp', 827, 400, false],
];
for (const [src, out, w, h, faded] of ONLY === 'seq' ? [] : jobs) {
  let img = sharp(join(SRC, src)).resize(w, h, { fit: 'cover', kernel: 'lanczos3' }).removeAlpha();
  if (faded) img = sharp(await img.toBuffer()).joinChannel(cardAlpha(w, h), { raw: { width: w, height: h, channels: 1 } });
  await img.webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(join(MEDIA, out));
  console.log(out, statSync(join(MEDIA, out)).size);
}
if (ONLY === 'images') process.exit(0);
// 96-frame footer sequence: 1920x1920 AVIF, 4:4:4 with alpha (transparent background) like the shipped frames.
const frames = readdirSync(join(SRC, 'seq')).filter((f) => /^\d{4}\.png$/.test(f)).sort();
if (frames.length !== 96) throw new Error(`expected 96 frames, found ${frames.length}`);
let total = 0;
for (const f of frames) {
  const out = join(SEQ, f.replace('.png', '.avif'));
  await sharp(join(SRC, 'seq', f)).avif({ quality: 62, chromaSubsampling: '4:4:4', effort: 5 }).toFile(out);
  total += statSync(out).size;
}
console.log('sequence', frames.length, 'frames', total, 'bytes');
