# Raven — medical delivery drone concept site

A scroll-driven WebGL site for **Raven**, a concept medical delivery drone for remote mountain villages and cold-climate communities. It is built with Next.js 15, React Three Fiber, three.js and Lenis.

The site began as a study reconstruction of a third-party homepage's scroll and camera choreography. The Raven aircraft, silhouettes and mission imagery are original Blender work in `glb/`. Some terrain, camera-path, sound and texture assets still come from that reference. Raven is a concept: no flight performance, payload, range or certification is claimed.

## Live links

| Branch | Link | Deploys |
|---|---|---|
| `tundra-terrain` (this branch) | https://raven-tundra-terrain.vercel.app | Separate Vercel project `raven-tundra-terrain`, deployed from the CLI (not on push) |
| `main` | https://raven-drone-site.vercel.app | Vercel project `raven-drone-site`, every push to `main` |

## This branch: `tundra-terrain`

- Mountain/tundra terrain built in the browser from the Raven tile (worker heightfield, ridged noise, erosion), with an Everest-style sky, far ranges and low warm terrain lighting.
- No drone pixelation on any screen: the drones render in their own antialiased layer at the screen's full density and are composited over the scene, which adapts its resolution to the GPU (`src/lib/render-scale.ts`, `src/components/scene/PostFX.tsx`).
- No footer: the page ends with the About section.

Details and measurements: `RECONSTRUCTION.md`.

## Run

```bash
npm install
npm run dev        # http://localhost:3100
npm run build
npm run typecheck
node scripts/check-raven-rotors.mjs   # six hexacopter rotor pivots
```

## Layout

| Path | What |
|---|---|
| `src/` | Next.js app, scene graph (`src/components/scene`), sections, loader |
| `public/assets/` | Models (Draco GLB), textures, images and sounds served by the site |
| `glb/new-drone/` | Hexacopter source and web build (`prepare_hexa.mjs`) |
| `glb/raven-quad/` | Earlier quad sources; builds the loader and flock silhouettes |
| `glb/raven-terrain/`, `glb/raven-sky/` | Terrain tile and opening sky build scripts |
| `AGENTS.md` / `CLAUDE.md` | Context and rules for coding agents |
| `RECONSTRUCTION.md` | Change log, verification and known discrepancies |

Third-party reference material is not committed; it stays on the author's machine: captured pages and bundles, and the product videos and photos used as modelling references.
