# Raven — medical delivery drone concept site

A scroll-driven WebGL site for **Raven**, a concept medical delivery drone for remote mountain villages and cold-climate communities. It is built with Next.js 15, React Three Fiber, three.js and Lenis.

The site began as a study reconstruction of a third-party homepage's scroll and camera choreography. The Raven aircraft, silhouettes, mission imagery and footer sequence are original Blender work in `glb/raven-quad/`. Some terrain, camera-path, sound and texture assets still come from that reference. Raven is a concept: no flight performance, payload, range or certification is claimed.

## Run

```bash
npm install
npm run dev        # http://localhost:3100
npm run build
npm run typecheck
node scripts/check-raven-rotors.mjs   # eight coaxial rotor pivots
```

## Layout

| Path | What |
|---|---|
| `src/` | Next.js app, scene graph (`src/components/scene`), sections, loader |
| `public/assets/` | Models (Draco GLB), textures, images and sounds served by the site |
| `glb/raven-quad/` | Blender sources and scripts: model build, QA renders, export, silhouettes, site imagery |
| `AGENTS.md` / `CLAUDE.md` | Context and rules for coding agents |
| `RECONSTRUCTION.md` | Change log, verification and known discrepancies |

Third-party reference material is not committed; it stays on the author's machine: captured pages and bundles, and the product videos and photos used as modelling references.
