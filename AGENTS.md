# AGENTS.md — Raven medical delivery drone site (built on a USAvionix homepage reconstruction)

Context for coding agents (Codex, Claude Code, others). Read this before editing.

## Current direction — Raven (user update)

The user has repurposed this project as **Raven**, a medical delivery drone concept for remote mountain villages and cold-climate/tundra communities. This overrides the original brand/copy fidelity goal. Preserve existing camera tracks, scene spans, scrolling, and transitions. Hero/swarm/footer use `public/assets/models/raven_hexa.glb`, the user-supplied black hexacopter medical drone (`glb/new-drone/Hexa_Medical_Drone_Black.glb`, v2 from 2026-10-30: 6 props, white medical box, EO/IR turret, LiDAR and thermal pods; v1 kept as `Hexa_Medical_Drone_Black_v1.glb`), prepared by `glb/new-drone/prepare_hexa.mjs`. The light-gray coaxial quad sources (`glb/raven-quad/`) are kept because `build_silhouettes.py` there builds the flock/ops silhouettes (still the quad); the loader and boot SVG show the hexa since 2026-10-31. The original `raven_drone.glb`, the earlier dark hexacopter (`glb/raven-refined/`) and the Blender story scene (`glb/raven-story/`) were removed in the 2026-10-31 cleanup (recoverable from git history). Product performance is unspecified: do not invent payload, range, speed, certification, or cold-weather ratings. Every jet silhouette is now a Raven drone (loader, sync flock, Raven Ops drones); the footer shows the live hexa.

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
| `research/usavionix/public-mirror/` | Mirrored reference assets the site no longer serves (jet GLBs, brand, landing frames, media); moved out of `public/` 2026-10-31. `build_silhouettes.py` reads `loading-delta.glb` from here. |
| `RECONSTRUCTION.md` | Architecture table, verification done, **known discrepancy list**. Update it when behavior changes. |

Key shipped modules (in `page-33beb1af07230f28.js` unless noted): `7370` main scene, `36745` scene store
(2245 chunk), `82245` scroll controller, `41480`/`98894`/`8743` post FX, `73560` landing sequence,
`48847` globe, `88572` mission cards, `72781` navbar (layout chunk), `66741`/`98317` modal/form (8866 chunk),
`76772` mission-log data (5720 chunk), `25621` asset paths. When unsure about a value, read the bundle
— do not invent numbers.

## Architecture

```
src/app/layout.tsx          fonts, <SmoothScroll>, <Navbar>
src/app/page.tsx            Loader, FixedContainer (fixed stage), opening, story band 1 + band 2 spacers (contiguous), team, footer, LandingSequence
src/lib/
  scenes.ts                 SCENE ids, SCENE_SPAN (vh), SCENE_ORDER, computeSceneRanges, zustand store
  constants.ts              shared mutable refs (terrain travel), RENDER_ORDER, sun, colors
  math.ts                   remap / remapEased / damp / wrap / easeInOutCubic (ported helpers)
  assets.ts                 asset paths, DRACO_PATH=/draco/
  loading.ts                loader state machine store
  scroll-lock.ts            ref-counted Lenis lock + "lenis-lock-change" event
src/components/
  SmoothScroll.tsx          ONE Lenis instance (lerp .95, syncTouch) + scene progress writer + scene-end snapping
  Navbar.tsx                logo, chapter ticks (150ms fade → .75s scroll → restore), Contact, menu <dialog>
  ui/ Modal (native <dialog>), Button (exact CTA classes), Badge, icons
  ContactForm / ContactButton
  loading/Loader.tsx        boot splash + loading-drone canvas + status line
  scene/
    FixedContainer.tsx      Canvas (dpr [1,1.5], no AA, no depth buffer), KeyboardControls, ChapterCopy, HudLog
    MainScene.tsx           assembly, flock FBO portal, hero audio, sets mainAppLoaded
    PostFX.tsx              composer: RenderPass → flock mix → SMAA (inferred) → FinalEffect (grade/grain/vignette)
    DroneRig.tsx            camera + 3 drones, ClipSeeker per tracker, hover/steer, shake, engine scene copy
    ClipSeeker.ts           deterministic GLB clip seeking (time = duration*progress - 1e-6)
    Drone.tsx               PBR drone (5 nodes), engine flame shader, hull number via RenderTexture
    Terrain.tsx             endless tiles, fog keyframes per scene, Phalanx scan wipe, city tile
    Grid, Clouds, DetectionPoints, Flock, Perimeters, CoordinationDrones, LowPolyDrone, PowerStation
    ChapterCopy.tsx         chapter copy + time windows (exact text)
    HudLog.tsx              scripted mission log
    overlays/               SpecsCallouts, SwarmTags, GroundHtml
    materials/              TerrainMaterial
    shaders/screen-uv.ts    shared GLSL (diagonal scan wipe, grid AA)
  sections/                 Sections (team, footer), FooterDrone, LandingSequence, HeroLogo
public/assets/              mirrored reference assets (same paths as live site); images/media = _next/static/media
public/draco/               Draco decoder copied from three/examples (do not CDN)
scripts/asset-manifest.mjs  manifest generator
```

### Scroll / progress model (do not break)

- Opening (user, 2026-11-01; replaced the pad takeoff film): page [0, P] (`#opening`, `OPENING_VH` 300) flies the
  live camera from a low wide shot under the hovering drone (sky dome + far ridges, `scene/OpeningSky.tsx`) into the
  Camera01 hero pose in one move (`scene/opening.ts`: dolly zoom fov 75 → 20, barrel pass in PostFX, extra ground
  tiles + fog in Terrain), story held at 0. At P everything opening-only is off and the hero frame is unchanged. The hero
  copy shows from the first opening frame and leaves at delta .075, as before (user). Band 1 opens with an opening range (page 0 → P+1): one
  gesture plays it over `OPENING_MS` (5 s), reverse returns to the low shot; no auto-advance on reveal.
- Homepage layout (user decisions 2026-10-30/11-01): the shipped story runs in two contiguous page bands
  (`lib/story-map.ts`). Band 1 = intro → real-time-detection (Route). Band 2 starts right after it, at the START of
  phalanx-ai, and runs phalanx → multi-threat. The `#parts` section was removed (2026-11-01). Thermal and ignition are
  skipped. The bands are joined by the shipped diagonal Phalanx wipe with the Route still live: over the first half of
  phalanx's page range (`storyMap.W`) the story holds on Route (terrain travel and drone hover keep running) and PostFX
  `DiagonalWipeEffect` lays the Care teams map (phalanx .5) over the swept side (`wipeRatioAt` = shipped
  `remapEased(phalanx, 0, .5, 0, 1, easeInOutCubic)`, same `computeScreenUv` edge + 0.1 border). That map is static in
  the shipped scene, so it is rendered once off screen (PostFX `Preroll`: store set silently with
  `sceneDataAt(mapStory())`, final pass off, `CopyPass` capture, store restored; again after a resize) and at X + W
  the story switches to the identical live map. Chapter copy + HUD are clipped by `wipeClipPath`; Route labels hide
  where `wipeX` < ratio. Scene
  ranges and every scene component stay in story coordinates; `toStory`/`toPage` convert page scroll, `stageTop` keeps
  the fixed stage covering through both bands and scrolls it away after band 2, `useStage.cover` gates PostFX and the
  bar background. Snapping is one band from the opening to the end of the story; after it the page is free.
- Scene spans unchanged (intro 1px, 12 × 500vh, zone 100vh, multi 500vh, in story px). Spacers: band 1
  `calc(2500dvh + 1px)` (story to Route), band 2 `3200dvh` (phalanx → multi + one screen, `#care-teams` anchor at
  500dvh = finished map frame, target of the Network links).
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
- Footer drone flight (user, 2026-11-01, after drone.riotters.com; `sections/drone-flight.ts`): the live `raven_hexa`
  lands on the pad (last shipped FRAME_Y position, frame travel still scroll-driven) with a timed 4 s ease-out-cubic
  landing once `#footer` is 30% visible (banked glide-in from above the screen: roll -31°, yaw 21°, pitch -12°, size
  0.19 → 1, then a vertical let-down), a 0.3 Hz float (1/35 drone width), and pointer response (flight lean while
  airborne, landed tilt + drift + EO/IR turret head after 47% of the landing). Replays after the footer has left the
  view. Desktop (≥1024px) in `LandingSequence` (copy-side drift/lift damped ×0.4 so the drone keeps clear of the CTA);
  below 1024px the same flight in `FooterDrone`. Reduced motion: parked on the pad, rotors still. No GSAP: per-frame
  maths in the existing R3F loops, like the reference. Canvas has a depth buffer.

## Design tokens (from shipped CSS, in `globals.css @theme`)

bg `#0f0f0f`; red `#f66`; yellow `#ffcb47`; **green token is cyan `#7aebff`**; transition flash `#FF2200`.
Type: d-h0 80/76 600 -.04em; d-h1 76/80; d-h2 50/52 -.03em; d-h3 29/32 500 -.01em; d-body-l 19/24;
d-mono 12/16 .06em; m-h0 43/38.7; m-h1 34/36; m-h2 30/32; m-h3 19/20; m-body-l 14/16; m-mono 11/16.
Nav: homepage bar, `--nav-height` clamp(56px, 5.4vw, 82px) (the stage offset and spacer use the variable). Shipped CTA rounded-full white/25 → hover white/30, 20×12px padding; the hero uses the homepage square CTA.
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

- Jump to a state: `window.scrollTo(0, Y)`. At vh=900 (1440 wide, page scroll): opening low shot 0, hero frame 2701,
  delta end 7201, swarm 11701, mission 16201, flock 20701, Route 25201 (= band 2 start, wipe 25201 → 27451),
  Care teams frame 29701, analysis end 34201, notifications 38701, interdrone 43201, extra 47701, zone 48601, multi end
  53101, page height ~55447. Test snapping with real wheel events (agent-browser `mouse wheel`, not `scroll`).
- Up to the story end, same vh on reference and local gives identical scrollY ↔ scene mapping (verified before the
  homepage change; the later shipped chapters are no longer on the page).
- Built-in preview pane throttles RAF between tool calls: wait a few seconds before screenshots; FPS dips there are
  harness artifacts (recovers to 60fps).

## Raven drone asset / rotor contract

- `RavenModel` loads `raven_hexa.glb` (1.99 MB, 86k tris): the source's 11 JPEG maps kept byte-identical (lossless WebP of them was 6.6 MB, so they are not re-encoded) + Draco geometry; `KHR_texture_transform` is required. User rule: never resize or lossy-recompress Raven textures; keep source bytes or lossless WebP, whichever is smaller, and Draco. Draco quantization 16/12/16 (position/normal/texcoord). Sun-glint materials are matched by name in `Drone.tsx` (`GLINT_MATERIALS`).
- Live daylight (`scene/sunlight.ts`, written by `MainScene`, read by `RavenModel`): travel-driven sun/env heading sway, cloud shade on the directional light, facet sun glints. Reduced motion disables it. While the environment plate shows, `scene/plate-light.ts` takes over (see Open work). Rebuild the hexa from `glb/new-drone/README.md` (`prepare_hexa.mjs`, textures unchanged, Draco last, once); never edit the GLB by hand.
- Rotor selection lives in `scene/raven-rotors.ts`: the exact six names in `RAVEN_ROTOR_NAMES` (`Rotor_<Front|Mid|Rear>_<Left|Right>`), never a `Rotor_` prefix match. Pivots sit on the prop hubs (spin about local +Y) with `spin_direction` extras read from the source's own prop clips: FL/MR/RL CW, FR/ML/RR CCW (alternating round the ring). The nav point lights in the source are stripped. Spin rate 150 rad/s (`ROTOR_SPEED`); while spinning, `scene/rotor-blur.ts` hides the `PROP_*` blade/tip meshes and shows one blur-disc shader per pivot (sized to the measured tips; hub stays visible), because faster mesh rotation only aliases at 60 Hz. The disc draws two swept blade images (13 rad/s visible sweep, per-rotor phase, real spin direction) and a sun flash computed from the live `sunlight.direction` against twisted/cambered blade normals (0.15-0.75 rad), so flashes ride on individual blades: streaks in the oblique hero, narrow sectors from above. Reduced motion: still rotors, real blades, no discs.
- `node scripts/check-raven-rotors.mjs` verifies pivots, positions, directions, child transforms, clone independence and web-asset parity.
- Hexa build commands: `glb/new-drone/README.md`. The quad's Blender build/QA/export commands (silhouette source): `glb/raven-quad/README.md`.

## Open work (see RECONSTRUCTION.md for full list)

- Homepage layout (2026-10-30): hero composition and bar follow `asset/html/raven_homepage.html` (local only); its
  map section was replaced by story band 2 (user). The reference's specs (prop size, km/h, AGL, kg, ETA, altitudes)
  were not carried over. The `#parts` live close-up track was removed on 2026-11-01 (user); the diagonal wipe now
  joins the bands. The fire sprites, thermal HUD/palette box and the thermal/fire copy and HUD lines were deleted (2026-10-31); the thermal and ignition scenes still exist in story coordinates because later scenes read their progress.

- Raven follow-up: all jet imagery is replaced (silhouettes, mission cards, demo, footer sequence). The footer wordmark is "RAVEN" (Geist text: SVG on mobile/tablet, canvas texture for the desktop WebGL outline). The third-party team-logos texture, the USAvionix legal copy and the Notes link were removed. Preserve current camera/scroll choreography.
- Story/content Phase 1 is done (copy only, 2026-10-30): one illustrative health-centre → hill-clinic delivery across chapters, HUD, scene labels, nav, menu and sections. Inventory and claim status: `RAVEN_CONTENT_MAP.md`. Chapter/HUD text lives beside its timing (`ChapterCopy.tsx`, `HudLog.tsx`); repeated notice/CTA copy lives in `src/lib/copy.ts`. Keep labels display-only: no fake confirmations ("delivered", "clinic notified", "cold chain maintained"), no numbers (temperature, confidence, speed).
- Story Phase 2 (visual, plan only): `RAVEN_VISUAL_STORY_PLAN.md`. The fire/thermal detour is the main replacement candidate; preparation, launch, handoff and return are not animated yet. Product decisions D1–D5 in that file are open.
- Quad site-imagery renders (`glb/raven-quad/render_media.py` + `encode_media.mjs`: cards, demo, 96 landing frames) are no longer used by the page; their outputs were deleted in the 2026-10-31 cleanup.
- Raven terrain (default since 2026-10-30; v09 since 2026-11-01: the Windows look-dev file v08 baked as-is, i.e. v05 grass/cliff, v06 Poly Haven `aerial_grass_rock` lawns, v08 BlenderKit moss forest floor, and 24 Cottage_FREE cottages as 16-tri web proxies baked from the detailed model; 4K WebP q80, 2.85 MB; built on the Windows workstation by `glb/raven-terrain/12_v09_webport.py`, encoded on the Mac because Windows sharp fails. The v09 ground material lives only in that .blend, not in 09_lookdev_material.py; the Cottage_FREE (TurboSquid) licence is unconfirmed for a public GLB): natural tiles use `public/assets/models/raven-terrain.glb` (`Land-A` + `Houses`, v03 built by `glb/raven-terrain/build_all.py` then `encode.sh`, validated by `glb/raven-terrain/check_terrain.py`; rebuild/check commands in `glb/raven-terrain/README.md`). Same footprint, flat 2.189 rim and planar-UV contract as the shipped tile; houses ride each natural tile with their own `TerrainMaterial` (fog/scan). The city tile is still the shipped one (settlement/clinic tile not built). `DetectionPoints` heights come from `RAVEN_DETECTION_Y` in `scene/raven-terrain.ts` (re-sample with the checker if the relief changes). `?terrain=original` and `?plate=h00` use the shipped natural tile.
- Environment plate prototype (opt-in `?plate=h00`, `scene/HeroPlate.tsx`): three Seedance clips of one flight behind the drones. Hero loop `raven-h00-loop.mp4` (time-driven); Airframe tilt `raven-s01-airframe.mp4` (all-intra, scrubbed: DELTA_DRONE progress -> measured camera pitch -> clip time, flow-map drift when idle); Connection `raven-s02-connection.mp4` (straight down past the health centre, plays from frame 0 when the tilt ends, then loops 5.5-12.04 s so the building never repeats). Fades to live terrain at the end of SWARM_SCENE; shader adds parallax, motion blur and haze on oblique views. The live terrain moves away from the camera (it retreats ahead of the drone): prompts must say the ground recedes toward the top of the frame. While it shows, `scene/plate-light.ts` swaps the drone to plate-matched light (high late-morning sun beyond the frame, hazy sky, the plate's own terrain as reflected ground) instead of the sunset `env.exr`. The sun casts soft shadows (2048 PCF) on the drones only: its shadow camera is refitted around `Drone1Group` in `MainScene`; terrain is unlit and never receives. Brief: `RAVEN_ENVIRONMENT_FILM_SEEDANCE_PROMPT.md`; sources in `research/raven-film/h00/` (local only).
- Terrain lens (`scene/TerrainLensEffect.ts`, first EffectPass after the RenderPass in `PostFX.tsx`): depth-reconstructed motion blur (terrain travel + camera reprojection, 1/30 s shutter) and thin-lens DoF focused on `Drone1Group`, applied only below world y -1.55 so drones stay sharp. Exaggerated for a high-speed look (travel streak x`SPEED_GAIN` 3, cap 16 px; `COC_INF_PX` 5, disc cap 16 px): tune those constants in `PostFX.tsx`. Anything drawn after the terrain must not write depth (the clouds did, which hid the ground from the lens). `?lens=off` disables it. If drones ever fly lower or the terrain parent moves, re-check `TERRAIN_TOP`.
- Silhouette assets: `drone-lowpoly.glb` (nodes `mainBody` + `outlineHull`, jet axis contract) and `loading-drone.glb`; the boot SVG is traced to sit over the 3D loader. Rebuild with `glb/raven-quad/build_silhouettes.py` (see its README section).

1. Footer heat-distortion / jet-beam (module 85508) not ported.
2. Confirm WebGL outlined wordmark (module 38219) visible in footer in a foreground browser.
3. Loader is a stand-in for the worker OffscreenCanvas (chunk 4867 not captured).
4. 821×1109 capture set and upward-travel checks for every chapter not done; no image-diff tooling yet.
5. Phosphor icons are stand-ins; menu links are `#`.
