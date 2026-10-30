# Raven valley story — Blender authoring

**Latest user direction:** preserve the current live flying hero and let the story begin on scroll. The active brief is `../../RAVEN_ENVIRONMENT_FILM_SEEDANCE_PROMPT.md`. This Blender scene is a location/material study, not a replacement website camera sequence.

Open **`raven-valley-story-v03.blend`**, select scene `Raven_Valley_Story`, use camera view, and scrub frames 1–600. Six camera-bound timeline markers form a 25-second edit at 24 fps. Frame 450 is the receiving clinic. The original default scene is preserved.

This is an **authored environment first pass**, not a finished photoreal film or integrated website. The current production drone GLB and site files are untouched by this work. No drone is baked into the environment.

## Files

- `01_landscape.py`: separate scene, terrain, initial range, materials, road and light.
- `02_set_dressing.py`: nineteen care buildings/dwellings, foundations, roofs, openings, walls, trees and ground details.
- `03_story_cameras.py`: six initial shot cameras, markers, reference image packing and first save.
- `04_refinement.py`: first render-driven corrections and dense forest placement.
- `05_surface_quality.py`: CC0 scanned maps, connected range, textured fir sprays.
- `06_hero_polish.py`: sky/lighting balance, local grass patches, entrance architecture, range placement.
- `07_handoff.py`: preserved original camera clips, linear draft camera movement, sampled camera matrices and final save.
- `storyboard.json`: actual shot ranges and camera names.
- `camera-samples.json`: 600 sampled world/projection matrices, row storage and coordinate conversion metadata.
- `asset-sources.json`: Poly Haven CC0 source URLs and verified source MD5s for fourteen environment maps.
- `textures/`: downloaded original environment maps; used maps are packed into the blend.
- `qa/`: iterative renders; earlier drafts are retained as evidence, not approved output.

## Rebuild

Scripts use a shared module namespace. Start in a fresh Blender session; create the module from stage 01 using `importlib.util`, store it as `sys.modules['raven_story_build']`, then execute the remaining files in that module's `__dict__` in numeric order. The root path is currently explicit in stage 01. Change it deliberately if relocating the repository.

Do not rerun stages into an already built scene. Stage 01 refuses if `Raven_Valley_Story` already exists. Later stages append/refine rather than being idempotent. Reopen a checkpoint to recover; inspect after a timeout before replaying any stage.

The environment was authored through the live Blender MCP bridge in Blender 5.2.2 LTS. This build's sky enums differ from older examples; the final pass uses an explicit radiance gradient. The bridge's asset-library toggles were off. The CC0 maps were downloaded directly from Poly Haven's public API without changing Blender preferences or enabling a provider.

## Camera handoff

`COL-Legacy_website_cameras_REFERENCE` preserves the imported source camera animation data. It is hidden and does not drive the draft story edit. The six `CAM-*` storyboard cameras are new authoring cameras. Their existence does **not** establish compatibility with the website's inherited tracks.

`camera-samples.json` stores nested matrix rows. Three.js matrix array APIs generally expect column-major storage; convert explicitly. Camera-local axes are −Z forward/+Y up. Convert world axes from Blender `(x,y,z)` to Three `(x,z,-y)` using the supplied conversion matrix. Validate against rendered landmarks, near/far clipping, aspect ratio and crop before integrating.

The six chapter markers make cuts, not smooth camera travel between unrelated shots. The website must keep cut boundaries explicit. No mobile crop is approved.

## Render settings

Saved production starting point: Cycles, 1920×1080, 96 samples, adaptive sampling, denoising, 16-bit RGBA PNG. Z pass is enabled; multilayer EXR depth/mask output must still be configured and validated for the actual composite. No full 600-frame sequence is rendered by default.

For review, lower resolution and samples and render one frame at each shot midpoint: 50, 150, 250, 350, 450, 550. Restore production settings before saving a final master. Do not bake UI, unverified delivery claims, drone shadow, rotor effects or speculative handoff mechanics into the clean plates.

## Known gaps

- Fine reference-level photorealism is not achieved or claimed: architecture remains procedural and needs hero refinement; forest silhouettes and terrain texture repetition need further review.
- Road cut/fill and paths need engineering-aware terrain refinement; some terrace and apron transitions remain schematic.
- Near/far mountain transitions and atmospheric depth need art direction across all shots.
- No people, cargo, physical handoff, winch, animated weather or live aircraft are authored in the environment.
- Full animation render/flicker checks, exact production camera mapping, GLB lighting/shadows/occlusion, mobile composition, web frame encoding and bounded streaming integration remain separate work.
- The saved file is an offline-render authoring scene. Do not export the entire forest directly into the browser.

Detailed next-agent brief: `../../RAVEN_BLENDER_STORY_IMPLEMENTATION.md`.
