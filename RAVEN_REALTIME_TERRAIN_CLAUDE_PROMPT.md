# Claude Code implementation prompt — Raven real-time mountain-village terrain

## Objective

Replace Raven's generic real-time ground environment with a convincing cold mountain/alpine-tundra village landscape, authored in Blender and exported as lightweight GLB assets. **Use the original USAvionix terrain architecture already reconstructed in this project.** Preserve the current flying hero, actual camera tracks, terrain travel, keyboard interactions, scene spans and scrolling transitions.

This is an implementation task. Inspect the repository, build a small usable prototype, integrate it into the real existing renderer, verify it, then refine within the measured performance budget. Do not stop after writing a plan or producing an isolated Blender beauty render. Do not replace the website with a new cinematic camera edit.

The failed video approach is not the target architecture. The deliverable is actual browser-rendered landscape geometry and mapped surface detail, with the existing live aircraft above it. No Higgsfield, generated environment video, image-sequence background, frame-seeking controller or new smoothing layer is required.

## 1. Read these first and resolve stale context

Read `AGENTS.md`, `CLAUDE.md`, `RECONSTRUCTION.md`, `src/lib/assets.ts`, and the current terrain/rendering code before editing. Use the working tree's latest instructions. Preserve unrelated changes; this repository may contain ongoing work.

Current facts at brief creation:

- Active aircraft: **black medical hexacopter, six propellers, white medical box**, `public/assets/models/raven_hexa.glb`.
- Aircraft source: `glb/new-drone/Hexa_Medical_Drone_Black.glb`; preparation: `glb/new-drone/prepare_hexa.mjs`, documented in that directory's README.
- The light-gray coaxial quad and the older hexacopter are retained but unused by the main model. Do not reintroduce either by following stale briefs.
- The existing website has an opt-in **`?plate=h00`** video prototype implemented in `HeroPlate.tsx` with light overrides in `plate-light.ts`. It is reference/comparison material, not the new terrain implementation.
- The earlier `glb/raven-story/` Blender valley and its six draft cameras are a material/location study. Do not export that full scene into the browser or substitute its camera edit for production tracks.
- `RAVEN_ENVIRONMENT_FILM_SEEDANCE_PROMPT.md` describes the preceding video experiment. Its reference images remain useful; its video production instructions do not govern this task.
- Product capabilities are unverified. Add no payload, speed, range, temperature-control, certification, operating-region or cold-weather performance claims.

Do not edit/recompress the drone to solve terrain performance. Raven textures must never be resized or lossy-recompressed. Keep the six-rotor contract intact. Use the appropriate hexa preparation workflow only if an unrelated drone issue actually requires it.

## 2. What the original website actually does

These findings were checked against the captured shipped JS, GLB headers, embedded image metadata and the local reconstruction. They describe the captured site version, not a guarantee about a future live deployment.

### Evidence locations

- `research/usavionix/ANALYSIS.md`: original analysis and evidence limitations.
- `research/usavionix/shipped/page-33beb1af07230f28.js`: shipped terrain class `y`, tile component `K`, terrain assembly `J`, tile spacing variable `X`.
- `src/components/scene/Terrain.tsx`: readable reconstructed implementation.
- `src/components/scene/materials/TerrainMaterial.ts`: readable terrain shader.
- `src/lib/constants.ts`: reconstructed shipped module 98127 constants; `TERRAIN_SCALE` / shipped `Br`.
- `src/components/scene/MainScene.tsx`: parent placement and live scene assembly.
- `src/components/scene/ClipSeeker.ts`, `DroneRig.tsx`: camera/aircraft clip seeking and procedural motion.
- `src/components/scene/PostFX.tsx`: actual render path and final grade.
- `research/raven-terrain/original-texture-preview.png`: inspection-only downsample of the original embedded terrain texture. Do not use the downsample as a production texture or publish research material.

Original model-authoring software, original high-resolution source scene and exact texture-production method are **unknown**. The shipped runtime proves the exported representation; it does not prove that the original artist used Blender, a particular terrain generator, satellite imagery or a specific bake workflow.

### Measured asset representation

| Asset | Verified representation |
|---|---|
| `public/assets/models/terrain.glb` | 2,094,240 bytes; one mesh/node named `Land-A`; one indexed triangle primitive; 9,960 exported vertices; 59,037 indices = **19,679 triangles**; POSITION, NORMAL, TEXCOORD_0; Draco geometry. |
| Embedded terrain appearance | One 4096×4096 RGB WebP named `Textura-WaterFix`, 2,039,448 encoded bytes. The exported material includes `KHR_materials_unlit`. Texture inspection shows rich small-scale geological/vegetation appearance and directional dark/light structure. |
| `public/assets/models/city-terrain.glb` | 438,056 bytes; node `Land-A`, mesh name `Land-city`; 9,960 vertices and 19,679 triangles; no embedded image in this file. It has an authored node rotation that the current geometry-extraction path does not automatically apply. |
| `public/assets/textures/terrain/city.webp` | Separate 4096×4096 RGBA WebP, 573,286 bytes. Its alpha participates in the city overlay blend. |
| `public/assets/models/building.glb` | 11,092 bytes; node `Buildings`; 1,248 exported vertices; 5,508 indices = 1,836 triangles; separate low-cost structure geometry. |

Terrain local bounds from POSITION accessors:

```text
natural: X [-200.023514, 200.000092]
         Y [  -7.675759,  17.327621]
         Z [-200.000092, 200.000076]
city:    X [-200.030060, 200.000061]
         Y [  -7.382751,  13.127834]
         Z [-200.000092, 200.000076]
```

Treat these as metadata measurements, not a completed edge/topology audit. Decode/import the geometry to measure actual shared boundary vertices and normals before rebuilding it.

### The economical illusion

1. **Real relief at modest geometry cost.** The mesh supplies slopes, perspective and ground parallax. Fine visual richness comes largely from the mapped appearance rather than millions of rendered stones or plants.
2. **Repeated shared resources.** `K` receives shared geometries/materials and places ordinary mesh copies on a tile grid. It is not evidence of a massive unique world, terrain streaming engine or an `InstancedMesh` implementation.
3. **Continuous travel and wrapping.** Terrain moves in the frame loop even while the visitor is not scrolling. A modulo offset makes repeated tiles simulate continuous flight.
4. **A controlled special tile.** A city/settlement surface, alpha overlay and separate building mesh create a later destination moment. Not every tile needs a unique village asset or clinic.
5. **Atmospheric concealment and transitions.** Fog, visibility gates, scan treatment, clouds and grading unify the environment and reduce exposed distant detail. They support the illusion; they do not excuse broken seams.
6. **One progress system.** Scroll progress seeks camera clips and changes environment state. It does not replace the scene with an unrelated background movie.

Reproduce that division of labour: **simple convincing geometry + rich reusable texture appearance + a few actual structures + existing motion/fog/scene choreography**.

### Important shader distinction

The normal landscape path samples the base map, optionally blends city RGBA, then applies custom fog. It does not automatically use the GLB's full PBR material or receive the scene sun as a standard lit terrain surface. The alternate diagonal scan path uses normals, noise and stylized grayscale/Fresnel-like treatment. Do not describe that special treatment as physically based daylight on every ordinary ground pixel.

This matters: exporting a beautiful Principled material with roughness, normal and displacement maps will not make those effects appear if `Terrain.tsx` still extracts only `geometry` and `material.map`, then replaces the material with `TerrainMaterial`.

## 3. Non-negotiable experience contract

- At scroll zero, Raven is already airborne. Terrain recedes away from the camera, toward the top of the frame in the current hero view. Verify this on screen; do not reverse it based on a generic forward-flight assumption.
- Idle terrain continues moving. Preserve arrow/A/D steering and Shift behaviour from the current implementation; do not silently remove them.
- First scroll continues that same flight while the narrative becomes more explicit. No hard cut to a ground-level clinic, packing table, takeoff sequence or new aerial panorama.
- Preserve camera GLBs, mobile camera tracks, clip bindings, `ClipSeeker`, drone placement, hero screen occupancy and existing camera-transition timing.
- Preserve `SCENE_ORDER`, spans, 6600dvh spacer, snapping and the single Lenis instance. No GSAP ScrollTrigger scrub or second controller.
- Keep copy and projected annotations in semantic DOM. This task is terrain/visual integration, not a broad content rewrite.
- Preserve currently working later chapter behaviours. Replacing fire/thermal content, adding a handoff or redesigning the narrative is separate scope. Do not silently remove those systems because the new terrain is medical-themed.
- Do not bake the drone, drone shadow, routes, labels, HUD, source logos or unsupported telemetry into the ground texture.

## 4. Visual direction — cold mountain villages, not generic noise

### Interpret the references consistently

Use `research/raven-film/references/`:

- R01 village terraces: agricultural steps, stone/timber construction, slate roofs, settlement scale and snowy distant skyline.
- R02 meadow valley: open ground framed by wooded slopes, readable sun/shade, inhabited clearings.
- R03 valley settlements: connected roads, clustered roofs and overlapping valley depth.
- R04 stone houses: modest local architecture, gardens, foundations and irregular paths.
- R05 high-slope village: compact settlement on a green rocky shoulder, narrow paths and restrained wild ground cover.
- R06, R07, R08: convincing bark, foliage, geology, surface response and atmospheric depth only. Exclude their swamp water, algae, jetty and branding.

Working interpretation: **a cold, high-altitude alpine/tundra transition**, with moss/grass, exposed gray rock, sparse higher-slope vegetation, pockets of conifers at lower elevations, and inhabited sheltered terraces. Snow stays mostly on higher ridges and shaded pockets. The supplied village references are not treeless Arctic tundra; retain their architecture and settlement logic. Do not turn the whole ground into featureless white snow, saturated summer lawn or a wetland.

Treat this as a fictional setting. No real place, surveyed road or operating service area is asserted. If a different snow/season direction is explicitly requested later, revise the environment consistently rather than mixing biomes tile by tile.

### What must actually read from the inherited cameras

- Broad slopes, folds, saddles, shallow ravines and a few rock shoulders, with human-scale pockets of houses.
- Roads and paths following contours and connecting actual settlement areas, not arbitrary pale ribbons painted over cliffs.
- Small clusters of houses with roof thickness, readable walls, stone foundations and varied restrained roofs.
- Terraces that follow plausible hillside logic, retaining edges and signs of inhabitation.
- Rock, soil, moss and low vegetation at multiple scales; snow is a secondary elevation cue.
- A modest recognizable care-building/clinic cluster on the designated settlement tile, rather than a hospital repeated on every generic tile.
- Clear visual separation for the black hexacopter and white medical box. Avoid dark drone-on-black forest and blown-out white cargo-on-snow compositions.

Keep the overall relief compatible with the existing airborne camera envelope. A giant mountain that intersects the aircraft or fills the inherited overhead view is not an improvement. The hero is primarily a view over terrain, not an obligation to show a postcard skyline. Add a distant backdrop only if the existing view exposes it and it can share the same camera and fog without new choreography.

## 5. Coordinate and tile compatibility — measure before modelling

Current contracts:

```ts
TERRAIN_SCALE = 0.04;
TILE_STEP = 2 * TERRAIN_SCALE * 200 - 0.01; // 15.99 scene units
tile.position.x = TILE_STEP * column;
tile.position.z = TILE_STEP * row - terrainWrapped.current;
tile.scale.setScalar(TERRAIN_SCALE);
// MainScene terrain parent:
position = [0, -2.5, -8.6];
```

The roughly 400×400 local-unit tile becomes roughly 16×16 scene units. The original natural terrain's height range becomes about −0.307 to +0.693 before the parent translation. These are coordinate relationships, not validated real-world map scale or flight altitude.

Do not model an arbitrary kilometre-scale valley and shrink it until it fits visually. Import the source terrain as a locked sizing guide, inspect its origin/axes/UVs and world placement, then create the replacement within that coordinate contract. Keep the initial peak-height envelope conservative. Sample all existing camera/drone tracks and steering extremes before increasing relief.

Blender is Z-up; exported glTF/Three geometry is Y-up. Validate the **decoded exported positions**, not just the Blender viewport. Avoid an extra 90-degree correction or scale applied twice.

The current renderer extracts `nodes['Land-A'].geometry`; it does not mount the original GLTF scene hierarchy. Export `Land-A` with identity node transforms and correct vertex-space orientation, or deliberately update the adapter to apply transforms exactly once. Audit city and building orientation separately: the city GLB's node rotation and the runtime Buildings group's Y rotation are not interchangeable conventions.

### Seam contract

For the first prototype, preserve the imported boundary strip while reshaping the interior. Build a 3×3 test arrangement using **the actual 15.99 runtime spacing**. Inspect both axes, corners, normals, texture continuity and the small intentional overlap. Do not test only at a mathematically ideal 400-unit spacing in Blender.

Opposite edges must meet after placement: compatible heights, tangents/normals, texture colour, snow/vegetation density and roads. Roads that cross an edge must have corresponding endpoints, direction and grade on the neighbour. Keep distinctive houses and clinic courtyards out of the boundary strip.

Any simplification or Draco step can move edge vertices. Protect seam vertices and compare the final decoded asset numerically and visually. Quantization precision is chosen from seam/error measurements, not copied blindly from an unrelated model.

## 6. Proposed asset architecture

Keep the first implementation small:

| Asset | Role |
|---|---|
| Natural mountain tile | `Land-A` ground, sparse inconspicuous generic habitation, reusable mapped detail. Fits the original tile footprint. |
| Settlement terrain tile | Same boundary contract and compatible travel phase, with terraced ground and a village/clinic layout at the designated destination. |
| Village structure mesh | Actual low-cost buildings/retaining features needed for oblique and overhead reading; merged or instanced sensibly with a small shared atlas. |
| Baked terrain/village textures | Rich geology, low vegetation, roof/wall detail, local AO and restrained fixed-light appearance appropriate to the runtime shader. |

Suggested source directory: `glb/raven-terrain/`. Suggested new runtime paths: `public/assets/models/raven-terrain.glb`, `raven-village-terrain.glb`, `raven-village-buildings.glb`, plus a clearly named terrain texture directory. Reconcile names with surrounding code; do not overwrite original reference assets.

Keep source `.blend`, deterministic build/bake/export scripts, asset manifest and QA output. Ship only approved runtime files from `public/`; `glb/` is excluded from Vercel upload.

### Geometry versus baked detail

Use real geometry for features that change silhouette, parallax or occlusion: slopes, embankments, house walls/roofs, a few rocks and retaining walls. Bake fine gravel, grass, small fissures, roof grain and subtle dirt into textures. Do not export hundreds of thousands of individual grass blades or the earlier valley's thousands of trees.

Actual buildings matter in oblique views. A convincing top-down roof painted onto a plane fails when Camera01 tilts. Conversely, distant plants do not need detailed branch geometry when their projected size is only a few pixels. Make those decisions from the actual camera footprint.

Use a few house archetypes, believable local dimensions and restrained variation. Merge static structures by material or use supported instancing. Share atlas/material resources. Do not create hundreds of React mesh components per repeated tile for decorative details.

## 7. Blender workflow

### A. Establish the contract and blockout

1. Record current asset metadata, hashes, triangle counts, texture sizes, transforms and baseline browser captures.
2. Import original natural/city tiles into a separate guide collection; preserve them unchanged.
3. Reproduce the runtime parent placement and scale in a preview setup. Import/reference the real camera tracks; do not use the six study cameras as substitutes.
4. Build one natural tile with seams protected. Use broad geographic forms first, then a few settlement pockets and contour roads.
5. Verify the simple export inside the existing site before investing in high-detail baking. Check initial oblique hero, Camera01 overhead and mobile.

### B. High-resolution source and low-resolution runtime

Maintain separate high-detail bake and runtime-export collections. Use terrain erosion/strata, geometry or procedural materials for source detail. Export only the simplified mesh and chosen structural details. Apply/simplify modifiers on export copies, protecting boundaries and silhouette. Blender procedural nodes are source authoring tools; they do not transfer as arbitrary GLSL through glTF.

Do not globally alter every image/material in the open Blender file. Operate on named terrain collections and explicit image lists so the protected aircraft asset cannot be resized, reassigned or recompressed accidentally. Preserve the user's existing Blender work and save new filenames/checkpoints.

### C. Bake to the actual runtime material model

The baseline renderer is texture-led/unlit. Start with an appropriate **appearance bake** for the terrain, with consistent local shading and colour, rather than assuming a conventional PBR albedo-only texture will look rich through the current shader. Do not claim that this is how the original texture was made; it is our compatible reconstruction strategy.

Keep fixed world-light direction consistent across all tiles and building maps. Do not bake huge shadows from objects that are absent, duplicated elsewhere or expected to move. Do not bake view-dependent specular highlights, heavy fog, vignette or colour grading into every asset; the scene already supplies those treatments.

Use UV layout and bake margins deliberately. Terrain and vertical building faces cannot all consume the same atlas pixels unless their intended texture content agrees. Keep a separate structure atlas when that is clearer and cheaper. Check roof, wall, plinth and road scale at final browser size. Pad atlas islands and test mip levels to prevent bright seams.

If terrain colour is overly flat through the baseline path, correct the bake first. If limited normal/light modulation is still justified, extend the terrain shader narrowly while retaining its existing fog, scan and scene gates. Do not substitute a generic MeshStandardMaterial and lose the reconstructed effects. Avoid multiplying baked light by another full lighting term.

### D. Export, decode and inspect

Export only intended static runtime geometry, supported mapped materials/attributes and necessary names. No cameras, light rigs, simulations or high-resolution source objects in the terrain GLBs. Preserve POSITION/NORMAL/TEXCOORD_0 and stable mesh/node identification. Apply required Blender transforms before export, then verify the resulting glTF basis.

Use the installed local Draco decoder and an explicit compression pipeline. Compress once at the end; inspect the final decoded seam/UV result. Keep source exports for comparison. Texture format, image colour-space handling and alpha usage must match the actual loader/shader, not merely a generic exporter preset.

## 8. Runtime integration — preserve the original mechanics

### Motion and scene state

Keep `Terrain.tsx`'s movement machinery and refs: `terrainTravel`, `terrainOffset`, `terrainWrapped`, `terrainRamp`. Normal travel accumulates with `dt`; later thermal/city positioning uses progress and a ramp. Preserve the existing DPR-dependent behaviour as baseline; correcting that behaviour is not part of this asset substitution.

Keep `Tile` placement, group visibility, `desktopOnly` gates and scene-specific fog. The current renderer uses shared resources and explicitly disables terrain frustum culling. Do not change culling policy or add dynamic LOD churn without demonstrating a measured benefit and checking for popping.

### Building attachment and destinations

Village structures must live under the same moving tile transform as their terrain. Use the same coordinate system, origin, scale and travel offset. A house should never stay fixed while its foundation moves away beneath it.

The current `Buildings` group also supplies `buildingsRef` for later targeting. Preserve/replace that anchor intentionally and check detection/thermal/overlay alignment. Replacing geometry without updating a derived anchor can make HUD or fire point at empty ground.

Treat the main clinic/health centre as a designated story landmark, analogous to the original special settlement tile. Do not repeat a clearly recognizable hospital on every generic hero tile. Idle flight cannot guarantee a one-time landmark by elapsed time alone, because visitors can wait indefinitely before scrolling.

### Repetition and phase consistency

First get one seamless base tile working with sparse generic houses. Avoid a large distinctive central village on every copy. Reduce visible repetition with broad texture composition, subtle non-landmark details, controlled sightlines and existing fog—not random per-frame changes.

Be careful adding A/B/C variants: the existing system wraps by **one tile period**. Assigning a different variant to each fixed row can make geometry or houses change instantly at the modulo reset. Deterministic seeds alone do not solve that. A future variant system needs a logically consistent tile sequence/ring index and repeat period, with scene ramps and anchors checked. Defer that expansion until the compatible single-tile prototype passes. Do not random-rotate or mirror a tile whose roads, lighting or seams are not symmetric.

### Materials, colour and depth

The existing code uses custom ShaderMaterial output and a final grade. Audit texture encoding through the complete path: image format, loader colour space, shader sampling and composer output. Do not blindly mark a map sRGB or add gamma conversion because that is conventional for a different material. Test a known swatch and compare before/after renders to avoid double conversion.

Keep fog and scan effects consistent on new structures so houses do not float crisply over hazy ground. If buildings use a separate atlas, parameterize/share an appropriate terrain-compatible material per map; do not make every house allocate a unique material instance.

`FixedContainer` requests a context with `depth:false`, but the postprocessing composer renders through its own targets. **Inspect the active render-target depth configuration** before asserting that the entire scene has no depth testing. Prove terrain/building self-occlusion with a diagnostic view. Setting `depthWrite=true` alone does not establish a usable depth buffer. Preserve compositing order and avoid a global depth/render-order rewrite as an unexamined fix.

The current directional-light shadows are fitted to the drone; unlit terrain is not a general shadow receiver. Bake stable local environment occlusion and use compatible structure shading. Do not promise automatic drone contact shadows on the ground. Dynamic terrain shadowing is a separate cost/architecture decision.

### The video experiment

Implement a distinct opt-in terrain comparison route/query flag or follow the repository's established preview pattern. Define clear mutual exclusion: the real-time terrain candidate and `HeroPlate` should not both supply the background in the same test. Do not silently redefine the existing `?plate=h00` flag or delete its media/source evidence.

When testing the real-time candidate, ensure `plateLight.weight` is zero and plate-derived reflection/light state has been cleaned up. Keep intentional drone sunlight behaviour. A stale video-light override can make a correct new terrain look mismatched.

After the candidate passes, wire it into the normal site path while retaining a practical original-terrain comparison/fallback. No production deploy or git push is authorized by this prompt.

## 9. Performance budget and acceptance measurements

Start near the original complexity rather than the offline valley study:

- Natural tile around the original **20k triangle scale**, with additional silhouette/structure cost justified by visible benefit. This is a starting target, not a universal hard limit.
- One shared natural texture set, one settlement appearance set and a small shared structure atlas. Share GPU texture objects; do not clone identical textures per tile.
- Begin with 2K ground look development; use 4K only where actual camera views require it and memory allows. Environment texture decisions do not relax the drone's lossless/no-resize rules.
- Keep initial encoded terrain/structure downloads in the low-single-digit MB range if achievable at acceptable quality; report the actual result rather than claiming a guaranteed budget.
- Aim for a few draw calls per visible tile, not dozens/hundreds of separately materialized details. Count both submitted geometry and instance count across all visible copies.
- No runtime displacement subdivision, large volumetric simulation, thousands of alpha trees, per-frame rebuilding, texture rebaking or repeated material compilation.

The source natural GLB is about 2.09 MB mostly because its compressed 4K texture is about 2.04 MB. That is network size, not GPU memory. A 4096² RGBA8 texture is about **64 MiB before mipmaps**, about **85 MiB with a complete mip chain**, if uploaded in that uncompressed representation. Browser/GPU formats vary; measure actual usage/format and avoid assuming WebP's encoded size is its GPU footprint.

The same tile may be drawn many times: shared mesh buffers save resource duplication, but repeated draw calls/triangles still cost work. Benchmark the busy chapter as well as the opening.

Record cold-load bytes, asset/decode timing, render calls/triangles, texture count/estimated residency, frame-time distribution, memory after repeated wraps and a complete forward/backward traversal. Use the existing scene and active hexa model as baseline on the same device/viewports. Aim to retain smooth desktop interaction and usable mobile behaviour; do not claim 60 fps without measurements. Treat in-app background RAF throttling as a harness limitation, not product evidence.

## 10. Verification plan

### Automated asset checks that address real risks

Add a focused terrain validation script that decodes the **final exported assets** and reports required names, identity transforms or explicit adapter transforms, bounds, triangle/material/image counts, UV availability, missing texture references and edge mismatch tolerances. Test adjacent tiles and the natural/settlement transition. Verify structure bounds against their intended terrain sampling/foundation points. This is justified because seams and coordinate errors are otherwise easy to miss.

Do not add tests that merely assert the spelling of implementation constants. Protect the exported asset contract and meaningful continuity properties.

### Visual states

At minimum inspect:

1. Initial hero idle long enough for **two complete terrain wraps**; compare terrain at both sides of the wrap boundary.
2. Steering left/right and Shift movement at the hero.
3. Camera01 at beginning, middle and end; oblique walls and overhead roofs both read.
4. SWARM and MISSION views: no background/material conflict with the other aircraft.
5. Destination tile arrival, detection anchors, thermal/ignition, scan and post-scan state; no gaps introduced by different geometry.
6. Full forward and reverse chapter travel, including rapid direction changes and resize.
7. Representative viewports: 1440×900, 821×1109, 390×844; also check the 768 and 1536 breakpoint changes.
8. Reduced-motion behaviour and keyboard access remain as implemented; no new moving-content controls interfere with navigation.

Use `agent-browser`/the approved foreground preview tooling as instructed by the repository. For performance, use an unthrottled foreground or headless browser. Capture baseline and candidate at identical viewport, scroll position **and terrain travel phase**; matching scrollY alone is insufficient for time-driven terrain. An opt-in debug capture hook may freeze/set the terrain phase, but must not change production timing.

Run `npm run typecheck`, `npm run build`, `node scripts/check-raven-rotors.mjs`, then browser verification after implementation. These checks are for the future implementation, not a requirement to build the app merely to read this prompt.

## 11. Work order and deliverables

Proceed in this sequence without turning each reversible step into a permission request:

1. **Audit:** short measured contract/baseline report; inspect original assets and current renderer; identify protected files and unrelated edits.
2. **Prototype:** one size/axis/seam-compatible natural tile with a few believable houses, baked appearance and a browser preview under the unchanged hero.
3. **Prove continuity:** idle wraps, Camera01, mobile, travel direction, structure attachment and resource/performance checks. Correct failures before adding detail.
4. **Refine:** improve geological forms, village architecture and texture scale based on browser comparisons with the references. A Blender beauty render alone is not acceptance.
5. **Destination:** compatible settlement terrain, actual clinic structure, anchor continuity and later-scene shader behaviour.
6. **Integrate:** make the tested real-time assets the normal environment path, keeping the failed plate experiment isolated and a practical fallback/comparison path.
7. **Verify and document:** update `RECONSTRUCTION.md`, AGENTS Open work where behaviour changes, and a `glb/raven-terrain/README.md` with deterministic rebuild/bake/export/check commands and known gaps.

Expected files include editable Blender source, reproducible scripts, source/license manifest, final GLBs and environment maps in `public/`, a focused asset validator, minimal scene adapter changes, measured performance/capture evidence, and a precise known-discrepancy list.

Do not install paid asset generators, activate new subscriptions, alter unrelated account settings or deploy/push the site. Use existing tools and licensed local/CC0 assets with provenance. Report an actual unavailable dependency and continue unaffected work; do not invent tooling or claim a bake/export succeeded without inspecting its output.

## 12. Relevant skills and how to use them

Use only skills available in the working environment; these names are guidance, not proof they are installed:

| Skill | Purpose |
|---|---|
| `text-to-blender` / `blender-mcp` | Inspect the live scene safely and target named collections; use the selected bridge for live previews. |
| `blender-pro-workflow` | Blockout → existing-camera check → surface/bake → refinement → export → browser QA. |
| `blender-materials` | Physically coherent high-detail source surfaces and restrained colour/roughness. |
| `blender-uv-texturing` | Intentional terrain/structure UVs, baking, atlas padding and exported-map checks. |
| `blender-lighting` | Consistent bake lighting and local AO; avoid doubling light in the runtime path. |
| `blender-cameras` | Reference the real website cameras and coordinate basis; do not replace them with new cinematic tracks. |
| `blender-rendering` | Bake/QA previews, not a replacement rendered-video architecture. |
| `blender-export` / `blender-web-pipeline` | Scoped low-cost GLB export, supported material mapping, Draco and decoded output inspection. |
| `reverse-engineer-anything` | Resolve uncertainties against the captured shipped assets/code, with evidence limits stated. |
| `agent-browser` | Actual hero/scroll/viewport comparison and browser verification. |
| `fixing-motion-performance` / `web-animation-design` | Preserve frame-loop and scroll architecture; measure jank without adding a second controller. |

Generic skill examples may resize all images, replace materials wholesale or recommend unrelated compression defaults. **Project rules and this task's scoped asset contracts take precedence.** Never run a global image-resize loop in a scene containing Raven.

## Final implementation instruction

Build the new mountain-village terrain **to fit the existing website**, using the original site's economical repeating-mesh/texture approach. Keep Raven flying in the current hero, keep the ground moving away beneath it, and let the existing scroll reveal the story. The success criterion is a convincing, seamless, performant environment in the real site—not a standalone film, giant Blender scene or attractive screenshot from a different camera.
