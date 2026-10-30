# AGENTS.md — Raven medical delivery drone site (built on a USAvionix homepage reconstruction)

Context for coding agents (Codex, Claude Code, others). Read this before editing.

## Current direction — Raven (user update)

The user has repurposed this project as **Raven**, a medical delivery drone concept for remote mountain villages and cold-climate/tundra communities. This overrides the original brand/copy fidelity goal. Preserve existing camera tracks, scene spans, scrolling, and transitions. The original `glb/raven_drone.glb` is preserved. Hero/swarm/globe now use `public/assets/models/raven_hexa.glb`, the user-supplied black hexacopter medical drone (`glb/new-drone/Hexa_Medical_Drone_Black.glb`, v2 from 2026-10-30: 6 props, white medical box, EO/IR turret, LiDAR and thermal pods; v1 kept as `Hexa_Medical_Drone_Black_v1.glb`), prepared by `glb/new-drone/prepare_hexa.mjs`. The previous light-gray coaxial quad (`raven_quad.glb`, `glb/raven-quad/`) is kept but unused; the silhouettes, loader drone and site renders still show the quad. The earlier dark hexacopter (`raven_drone_refined.glb`, `glb/raven-refined/`) is kept but unused. Product performance is unspecified: do not invent payload, range, speed, certification, or cold-weather ratings. Every jet silhouette and jet render is now a Raven drone: loader, sync flock, Raven Ops drones, mission-card images, demo image and the 96-frame footer landing sequence (`glb/raven-quad/render_media.py`).

## What this project is

Started as a faithful reconstruction of https://www.usavionix.com/ (captured 2026-10-29); the user then turned it
into **Raven**. Scroll choreography, camera tracks, terrain and several mirrored assets still come from the reference.
Not affiliated with USAvionix.

- Deployment (user decision 2026-10-30): private GitHub repo + public Vercel production. The page stays `noindex`.
  Third-party reference material stays local and is gitignored/vercelignored: `research/` (captured bundles/HTML),
  `asset/` (DJI videos), and the unused mirrored jet/brand assets listed in `.gitignore`. Do not re-add them.
- Never hotlink reference assets. Everything is served from `public/`.
- Contact form has **no backend** on purpose: it validates, then says nothing was sent. Never fake success,
  never submit to the real site.

## Commands

```bash
npm install
npm run dev              # http://localhost:3100 (preview config: .claude/launch.json, name "drone-site")
npm run build            # production build — must pass
npm run typecheck        # tsc --noEmit — must pass
npm run assets:manifest  # regenerates research/usavionix/asset-manifest.json
```

Local production builds use `.next-production/`; development uses `.next/` so checks do not corrupt a running preview.
On Vercel (`VERCEL` env set) the build uses the default `.next/`.
Git: private GitHub repo `bishwamandal/raven-drone-site`. Production: https://raven-drone-site.vercel.app (Vercel project
`raven-drone-site`, connected to the repo: every push to `main` builds and deploys to production). Manual deploy from the working
copy: `vercel deploy --prod --yes`.
`.vercelignore` keeps `glb/` sources and local-only material out of the upload.

## Stack (installed versions)

Next.js 15.5 (App Router, `src/`), React 19, three 0.176, @react-three/fiber 9.8, @react-three/drei 10.7,
postprocessing 6.39, lenis 1.3, zustand 5, motion 12 (`motion/react`), delaunator 5, Tailwind 4 (CSS `@theme`),
Geist + Geist Mono via the `geist` package, clsx. Path alias `@/*` → `src/*`.

## Source of truth

| Path | What |
|---|---|
| `prompt.md` | Original task brief (requirements, constraints). |
| `research/usavionix/ANALYSIS.md` | Reference analysis: assets, design tokens, scene spans, timings (local only, not in git). |
| `research/usavionix/shipped/` | Minified bundles + 5 GLBs from the live site. Research input, not runnable. |
| `research/usavionix/home.html` | Captured homepage HTML (structure, classes, spacer height). |
| `research/usavionix/asset-manifest.json` | 132 local assets: source URL, bytes, SHA-256, MIME, dims, GLB nodes/clips. |
| `RECONSTRUCTION.md` | Architecture table, verification done, **known discrepancy list**. Update it when behavior changes. |
| `glb/raven_drone.glb` | User-supplied Raven cargo drone, now used by the main flight rig and globe. Preserve the source file. |

Key shipped modules (in `page-33beb1af07230f28.js` unless noted): `7370` main scene, `36745` scene store
(2245 chunk), `82245` scroll controller, `41480`/`98894`/`8743` post FX, `73560` landing sequence,
`48847` globe, `88572` mission cards, `72781` navbar (layout chunk), `66741`/`98317` modal/form (8866 chunk),
`76772` mission-log data (5720 chunk), `25621` asset paths. When unsure about a value, read the bundle
— do not invent numbers.

## Architecture

```
src/app/layout.tsx          fonts, <SmoothScroll>, <Navbar>
src/app/page.tsx            Loader, FixedContainer (sticky stage), 6600dvh spacer, sections, LandingSequence
src/lib/
  scenes.ts                 SCENE ids, SCENE_SPAN (vh), SCENE_ORDER, computeSceneRanges, zustand store
  constants.ts              shared mutable refs (terrain travel, thermal box state), RENDER_ORDER, sun, colors
  math.ts                   remap / remapEased / damp / wrap / easeInOutCubic (ported helpers)
  assets.ts                 asset paths, LANDING_SEQUENCE (96 frames), DRACO_PATH=/draco/
  loading.ts                loader state machine store
  scroll-lock.ts            ref-counted Lenis lock + "lenis-lock-change" event
src/components/
  SmoothScroll.tsx          ONE Lenis instance (lerp .95, syncTouch) + scene progress writer + scene-end snapping
  Navbar.tsx                logo, chapter ticks (150ms fade → .75s scroll → restore), Contact, menu <dialog>
  ui/ Modal (native <dialog>), Button (exact CTA classes), Badge, icons
  ContactForm / ContactButton
  loading/Loader.tsx        boot splash + loading-delta canvas + status line
  scene/
    FixedContainer.tsx      Canvas (dpr [1,1.5], no AA, no depth buffer), KeyboardControls, ChapterCopy, HudLog
    MainScene.tsx           assembly, flock FBO portal, hero audio, sets mainAppLoaded
    PostFX.tsx              composer: RenderPass → flock mix → SMAA (inferred) → FinalEffect (grade/grain/vignette/thermal)
    DroneRig.tsx            camera + 3 drones, ClipSeeker per tracker, hover/steer/boost, shake, wind, engine scene copy
    ClipSeeker.ts           deterministic GLB clip seeking (time = duration*progress - 1e-6)
    Drone.tsx               PBR drone (5 nodes), engine flame shader, hull number via RenderTexture
    Terrain.tsx             endless tiles, fog keyframes per scene, Phalanx scan wipe, city tile
    Grid, Clouds, Fire, DetectionPoints, Flock, Perimeters, CoordinationDrones, LowPolyDrone, PowerStation
    ChapterCopy.tsx         chapter copy + time windows (exact text)
    HudLog.tsx              scripted mission log
    overlays/               SpecsCallouts, SwarmTags, ThermalHud, GroundHtml
    materials/              TerrainMaterial, WindMaterial
    shaders/screen-uv.ts    shared GLSL (diagonal scan wipe, grid AA)
  sections/                 Sections (cards, coverage, demo, team, footer), Globe, LandingSequence, HeroLogo, logo-data
public/assets/              mirrored reference assets (same paths as live site); images/media = _next/static/media
public/draco/               Draco decoder copied from three/examples (do not CDN)
scripts/asset-manifest.mjs  manifest generator
```

### Scroll / progress model (do not break)

- Scene order + spans: intro 100vh (counts as **1px**), then 12 × 500vh, zone-stabilized 100vh, multi-threat 500vh.
  Spacer = `calc(6600dvh + 1px + var(--nav-height))`. Scene end = sum of spans up to that scene.
- Per scene: `progress=(scroll-start)/height`, `showRatio`, `hideRatio`, `isActive`, clamped 0–1, written on every
  Lenis scroll event. Everything reads `useScenes.getState()` in frame loops (no React state per frame).
- One progress source, one Lenis. Do not add GSAP ScrollTrigger scrub or a second smoothing layer.
- Snapping: wheel/arrow/touch picks next/prev scene end; RAF steps 2px/ms while Lenis velocity is low.
- Camera mapping: delta→Camera01 (always), swarm→Camera02, mission→03, flock→04-02, thermal→05, ignition→06,
  analysis→07, interdrone→08, multi-threat→09. Drones: 01-01 (last frame), 02-01/02-02/02-03, 03-01/03-02.
  Mobile tracks (`*-mobile.glb`) below 768px. GLTFLoader renames `Drone.001` → `Drone001`.
- Overlay gates from the bundle, e.g. specs callouts: delta > .9 && swarm < .01; hero copy exits at delta .075.

### Rendering notes

- A `useFrame(..., 1)` exists, so R3F auto-render is off; the composer renders at priority 100.
- Clear color: sky `#c9e0f7`, black after ignition > .99. Final grade fades to black with multi-threat hideRatio.
- Custom ShaderMaterials output raw values: textures sampled there must not be sRGB-decoded unless the source did
  (landing frames use `NoColorSpace`).
- Landing sequence (≥1024px only) keeps ONE GPU texture and swaps image per frame; mapping 0–.45→0–.1,
  .45–.7→.1–.3, .7–1→.3–1, smoothed .25; base0 only. Below 1024px: static frame 0096 in the footer.

## Design tokens (from shipped CSS, in `globals.css @theme`)

bg `#0f0f0f`; red `#f66`; yellow `#ffcb47`; **green token is cyan `#7aebff`**; transition flash `#FF2200`.
Type: d-h0 80/76 600 -.04em; d-h1 76/80; d-h2 50/52 -.03em; d-h3 29/32 500 -.01em; d-body-l 19/24;
d-mono 12/16 .06em; m-h0 43/38.7; m-h1 34/36; m-h2 30/32; m-h3 19/20; m-body-l 14/16; m-mono 11/16.
Nav 56px, inset 32px desktop / 16px narrow. CTA rounded-full white/25 → hover white/30, 20×12px padding.
z: scroll-sequence 550, over-scroll-sequence 575, navbar 600, menu 700, modal 800.
Text motion: enter opacity0 y+8 #FF2200 → white, exit y-8 #FF2200, .4s easeInOut; support +.2s, CTA +.4s.

## Rules for changes

- Fidelity first: port from the bundle; cite the shipped module/var in a short comment like existing code.
- Match surrounding style: refs in hot paths, `scenes()` reads in `useFrame`, zustand selectors for threshold booleans.
- Keep text in semantic DOM; keep dialogs keyboard-accessible (Escape, focus return, scroll lock via `lockScroll`).
- Don't claim "exact" without side-by-side evidence at identical viewport + scrollY. Record new gaps in
  `RECONSTRUCTION.md`.
- After changes: `npm run typecheck`, `npm run build`, then visual check in browser.

## Verification tips

- Jump to a state: `window.scrollTo(0, Y)`. At vh=900: delta end 4501, swarm 9001, mission 13501, flock 18001,
  detection 22501, thermal 27001, ignition 31501, phalanx 36001, … zone end 54901, page height ~64663.
- Same vh on reference and local gives identical scrollY ↔ scene mapping (verified).
- Built-in preview pane throttles RAF between tool calls: wait a few seconds before screenshots; FPS dips there are
  harness artifacts (recovers to 60fps).

## Raven drone asset / rotor contract

- `RavenModel` loads `raven_hexa.glb` (1.99 MB, 86k tris): the source's 11 JPEG maps kept byte-identical (lossless WebP of them was 6.6 MB, so they are not re-encoded) + Draco geometry; `KHR_texture_transform` is required. User rule: never resize or lossy-recompress Raven textures; keep source bytes or lossless WebP, whichever is smaller, and Draco. Draco quantization 16/12/16 (position/normal/texcoord). Sun-glint materials are matched by name in `Drone.tsx` (`GLINT_MATERIALS`).
- Live daylight (`scene/sunlight.ts`, written by `MainScene`, read by `RavenModel`): travel-driven sun/env heading sway, cloud shade on the directional light, facet sun glints. Reduced motion disables it. While the environment plate shows, `scene/plate-light.ts` takes over (see Open work). Rebuild the hexa from `glb/new-drone/README.md` (`prepare_hexa.mjs`, textures unchanged, Draco last, once); never edit the GLB by hand.
- Rotor selection lives in `scene/raven-rotors.ts`: the exact six names in `RAVEN_ROTOR_NAMES` (`Rotor_<Front|Mid|Rear>_<Left|Right>`), never a `Rotor_` prefix match. Pivots sit on the prop hubs (spin about local +Y) with `spin_direction` extras read from the source's own prop clips: FL/MR/RL CW, FR/ML/RR CCW (alternating round the ring). The nav point lights in the source are stripped. Spin rate 150 rad/s (`ROTOR_SPEED`); while spinning, `scene/rotor-blur.ts` hides the `PROP_*` blade/tip meshes and shows one blur-disc shader per pivot (sized to the measured tips; hub stays visible), because faster mesh rotation only aliases at 60 Hz. The disc draws two swept blade images (13 rad/s visible sweep, per-rotor phase, real spin direction) and a sun flash computed from the live `sunlight.direction` against twisted/cambered blade normals (0.15-0.75 rad), so flashes ride on individual blades: streaks in the oblique hero, narrow sectors from above. Reduced motion: still rotors, real blades, no discs.
- `node scripts/check-raven-rotors.mjs` verifies pivots, positions, directions, child transforms, clone independence and web-asset parity.
- Hexa build commands: `glb/new-drone/README.md`. The unused quad's Blender build/QA/export commands and discrepancy list: `glb/raven-quad/README.md`. The earlier hexacopter pass: `glb/raven-refined/README.md`.

## Open work (see RECONSTRUCTION.md for full list)

- Raven follow-up: all jet imagery is replaced (silhouettes, mission cards, demo, footer sequence). The footer wordmark is "RAVEN" (Geist text: SVG on mobile/tablet, canvas texture for the desktop WebGL outline). The third-party team-logos texture, the USAvionix legal copy and the Notes link were removed. Preserve current camera/scroll choreography.
- Story/content Phase 1 is done (copy only, 2026-10-30): one illustrative health-centre → hill-clinic delivery across chapters, HUD, scene labels, nav, menu and sections. Inventory and claim status: `RAVEN_CONTENT_MAP.md`. Chapter/HUD text lives beside its timing (`ChapterCopy.tsx`, `HudLog.tsx`); repeated notice/CTA copy lives in `src/lib/copy.ts`. Keep labels display-only: no fake confirmations ("delivered", "clinic notified", "cold chain maintained"), no numbers (temperature, confidence, speed).
- Story Phase 2 (visual, plan only): `RAVEN_VISUAL_STORY_PLAN.md`. The fire/thermal detour is the main replacement candidate; preparation, launch, handoff and return are not animated yet. Product decisions D1–D5 in that file are open.
- Site imagery renders: `glb/raven-quad/render_media.py` (Cycles; cards/demo/seq modes) then `node glb/raven-quad/encode_media.mjs <sharp>`; outputs `public/assets/images/media/raven-*.webp` and `public/assets/images/raven-landing/####.avif` (case bottom follows the shipped `FRAME_Y` path).
- Raven terrain (default since 2026-10-30; v02 look-dev map: baked trees/rock/golden light, 4K WebP q80, 2.47 MB): natural tiles use `public/assets/models/raven-terrain.glb` (`Land-A` + `Houses`, built by `glb/raven-terrain/build_all.py` then `encode.sh`, validated by `glb/raven-terrain/check_terrain.py`; rebuild/check commands in `glb/raven-terrain/README.md`). Same footprint, flat 2.189 rim and planar-UV contract as the shipped tile; houses ride each natural tile with their own `TerrainMaterial` (fog/scan). The city tile is still the shipped one (settlement/clinic tile not built). `DetectionPoints` heights come from `RAVEN_DETECTION_Y` in `scene/raven-terrain.ts` (re-sample with the checker if the relief changes). `?terrain=original` and `?plate=h00` use the shipped natural tile.
- Environment plate prototype (opt-in `?plate=h00`, `scene/HeroPlate.tsx`): three Seedance clips of one flight behind the drones. Hero loop `raven-h00-loop.mp4` (time-driven); Airframe tilt `raven-s01-airframe.mp4` (all-intra, scrubbed: DELTA_DRONE progress -> measured camera pitch -> clip time, flow-map drift when idle); Connection `raven-s02-connection.mp4` (straight down past the health centre, plays from frame 0 when the tilt ends, then loops 5.5-12.04 s so the building never repeats). Fades to live terrain at the end of SWARM_SCENE; shader adds parallax, motion blur and haze on oblique views. The live terrain moves away from the camera (it retreats ahead of the drone): prompts must say the ground recedes toward the top of the frame. While it shows, `scene/plate-light.ts` swaps the drone to plate-matched light (high late-morning sun beyond the frame, hazy sky, the plate's own terrain as reflected ground) instead of the sunset `env.exr`. The sun casts soft shadows (2048 PCF) on the drones only: its shadow camera is refitted around `Drone1Group` in `MainScene`; terrain is unlit and never receives. Brief: `RAVEN_ENVIRONMENT_FILM_SEEDANCE_PROMPT.md`; sources in `research/raven-film/h00/` (local only).
- Terrain lens (`scene/TerrainLensEffect.ts`, first EffectPass after the RenderPass in `PostFX.tsx`): depth-reconstructed motion blur (terrain travel + camera reprojection, 1/30 s shutter) and thin-lens DoF focused on `Drone1Group`, applied only below world y -1.55 so drones stay sharp. Exaggerated for a high-speed look (travel streak x`SPEED_GAIN` 3, cap 16 px; `COC_INF_PX` 5, disc cap 16 px): tune those constants in `PostFX.tsx`. Anything drawn after the terrain must not write depth (the clouds did, which hid the ground from the lens). `?lens=off` disables it. If drones ever fly lower or the terrain parent moves, re-check `TERRAIN_TOP`.
- Silhouette assets: `drone-lowpoly.glb` (nodes `mainBody` + `outlineHull`, jet axis contract) and `loading-drone.glb`; the boot SVG is traced to sit over the 3D loader. Rebuild with `glb/raven-quad/build_silhouettes.py` (see its README section).

1. Footer heat-distortion / jet-beam (module 85508) not ported.
2. Confirm WebGL outlined wordmark (module 38219) visible in footer in a foreground browser.
3. Loader is a stand-in for the worker OffscreenCanvas (chunk 4867 not captured).
4. 821×1109 capture set and upward-travel checks for every chapter not done; no image-diff tooling yet.
5. Phosphor icons are stand-ins; globe orbiters lack hull numbers; menu links are `#`.
