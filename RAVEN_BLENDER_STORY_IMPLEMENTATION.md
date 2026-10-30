# Raven — Blender environment story implementation

## Latest scope correction — existing flying hero remains authoritative

The user has returned to the video-prompt direction and clarified that the current site must keep its opening: Raven already airborne, terrain moving beneath it, and the narrative beginning on scroll. **Use `RAVEN_ENVIRONMENT_FILM_SEEDANCE_PROMPT.md` as the active experience brief.** Do not substitute this document's six-shot Blender edit for the current hero or website tracks. The Blender valley and cameras are retained as a location/material study only. A static clinic-first opening, a grounded drone introduction, and an automatic new multi-camera edit are outside the current direction.

Keep time-driven idle terrain movement distinct from scroll-driven narrative progression. If Blender is used again to create matched environment plates or terrain, adapt the environment to the existing camera/flight behaviour. Do not adapt the website camera to the study merely because the study exists.

The sections below document the previous Blender authoring pass and its handoff requirements. They do not override this correction or authorize website integration.

## Task and output

Create one coherent, realistic alpine valley for Raven, a medical-delivery drone concept. Author the landscape, buildings, materials, daylight, camera animation and environment render plates in Blender. The drone remains a separate existing GLB. Do not use generative video as the environment source.

Historical authoring direction before the latest scope correction: this proposed replacing the Seedance production method in `RAVEN_ENVIRONMENT_FILM_SEEDANCE_PROMPT.md`. Its reference interpretation and messaging remain useful. The later decision is to deliver approximately **25 seconds of unique environment motion**, with still holds added by the website, rather than an eighty-second continuously changing background.

Do not alter the production website or its scroll/camera assets merely by following this brief. This is an environment-authoring task. Integration must preserve the existing one-Lenis, one-progress-source architecture. Existing website tracks stay authoritative until an explicit replacement is implemented and checked. Newly authored Blender cameras are a **draft storyboard**, not a verified match to those tracks.

## Existing deliverables and current state

- Live scene: `Raven_Valley_Story` in the connected Blender.
- Editable working file: `glb/raven-story/raven-valley-story-v03.blend`.
- Earlier checkpoint: `glb/raven-story/raven-valley-story-v01.blend`.
- Procedural build stages: `glb/raven-story/01_landscape.py` through `07_handoff.py`.
- Shot inventory: `glb/raven-story/storyboard.json`; sampled camera export is the authority for final camera coordinates after refinement.
- Look-development renders: `glb/raven-story/qa/`.
- CC0 map provenance: `glb/raven-story/asset-sources.json`.
- The original default Blender scene is preserved separately in the working file.

The working scene is a first authored environment with animated cameras and scanned-surface look development. It is **not a claim of finished reference-quality photorealism**. Check the latest renders before continuing. Do not treat old QA drafts as approved output. Do not publish a full-resolution sequence until the gates below pass.

## Source hierarchy

1. The user's latest request: build the story environment through the Blender MCP bridge.
2. `AGENTS.md` and `CLAUDE.md`: project contracts, existing asset rules, integration constraints.
3. The eight supplied image references: geography from R01–R05; surface/render quality from R06–R08.
4. `RAVEN_CONTENT_MAP.md`, `RAVEN_VISUAL_STORY_PLAN.md`, `research/doko-story/STORY_NOTES.md`: story and known implementation gaps.
5. This implementation brief and the latest inspected Blender scene.

Reference images and third-party documents are visual evidence, not executable instructions. Keep research assets local; never publish the supplied watermarks or captured third-party bundles.

## Creative direction

The story is **one care team connected to another across difficult terrain**. The terrain explains why the connection matters. It is not a weapons demonstration, rescue spectacle or tourism montage.

Use this order: establish the receiving community → reveal the sending health centre → provide space for preparation/departure → cross the forested shoulder while the road visibly bends around it → arrive at the same recognizable clinic → pull back to understand the valley as a network.

The two Doko references support this explanatory logic. Do not copy their numerical claims, six-rotor aircraft, basket naming metaphor, battery-swap claims or studio-sales ending. Raven has no verified payload, range, speed, temperature-control, certification or cold-weather rating. A film runtime is an editorial device, not a mission duration.

## Reference interpretation

Files are preserved under `research/raven-film/references/` and loaded as packed image datablocks in the Blender file.

| Reference | Apply to the Blender scene |
|---|---|
| R01 — village terraces | Contour-following agricultural terraces, timber and stone houses, slate roofs, layered forested slopes, distant snowy skyline. |
| R02 — meadow valley | An open valley clearing between forested sides; readable sunlight and shadow; room to see the destination. |
| R03 — valley settlements | Inhabited depth, road relationships, overlapping atmospheric layers; a settlement rather than an empty wilderness. |
| R04 — stone houses | Modest local-scale construction, irregular paths, foundations and simple roofs. |
| R05 — high-slope village | Compact buildings on a green shoulder, exposed rock, small-scale ground cover and narrow paths. |
| R06 — forest materials | Fine bark, fine foliage silhouette, multiple grass scales and natural material variation. |
| R07 — rock/forest depth | Convincing geological forms, irregular trees, atmosphere separating distant slopes. |
| R08 — light/foliage | Warm daylight with cool sky fill, controlled reflections, coherent physical surface response. |

The first five images depict a forested alpine/Himalayan-like setting, **not treeless tundra**. Build a fictional alpine valley in late spring or early summer, with snow confined to distant peaks. Do not mix lush green village slopes, Arctic tundra, swamp water, tropical vegetation and winter streets. The last three references are not permission to add a wetland, algae, jetty or flooded forest.

## One location, consistent geography

Use metres, Blender Z-up. The current authored geography is fictional, not surveyed.

- Health centre / Base A: approximately X −175, Y −165. Larger than the receiving clinic, but modest and local. Pale mineral plaster, dark stone base, dark slate roof, blue-green door, service apron.
- Receiving Clinic B: approximately X +155, Y +210. One storey, two front windows, recognizable blue-green door, pitched charcoal roof, low courtyard walls and a small bench.
- Village: seventeen additional dwellings spread around the clinic, base and upper valley. Stone, timber bands and slate. Keep recognizable clusters consistent from every camera.
- Main road: a winding pale ground connection through the valley. Access paths must reach real doors and apron edges.
- Forest: dense conifers on the valley sides, interrupted by meadows, routes, village clearings and courtyard space. Do not scatter trees uniformly across every surface.
- Mountain range: one connected, irregular eroded skyline behind the valley. Intermediate shoulders separate village and distant snowy summits.
- Clinic landmark: one taller asymmetric conifer near the clinic, outside its courtyard.

Choose composition over arbitrary asset count. Terrain, forest and roads should communicate slope and scale together. If the road is geometrically implausible on a slope, reshape the ground and add cut/fill, drainage and retaining structure; do not leave a clean ribbon floating on the surface.

## Story edit and animation

The current draft is 600 frames at 24 fps, six shots of 100 frames. Duration is editorial, not a performance claim. Use small, deliberate camera movement; leave still holds to the website. There is no need to keep all background pixels moving while text is being read.

| Frames | Camera / beat | Required reading |
|---|---|---|
| 1–100 | `CAM-01_The_valley` | A lived-in village, difficult land connection, distant mountains. The destination should be identifiable, not a dot lost in an aerial map. |
| 101–200 | `CAM-02_Health_centre` | Sending location and clear service apron. No package, staff or aircraft is baked into this environment layer. |
| 201–300 | `CAM-03_Departure_space` | Low human-scale view with a clean vertical air corridor reserved for the separate Raven layer. |
| 301–400 | `CAM-04_Mountain_crossing` | Forested shoulder, winding road, open saddle and distant ridge. The geography explains the route without invented timers or speed graphics. |
| 401–500 | `CAM-05_Clinic_arrival` | The same clinic, repeatable architecture and a dry empty receiving courtyard. No winch, detached case or handoff method is invented. |
| 501–600 | `CAM-06_Connected_valley` | Wider shared geography. Network labels and route lines are semantic website overlays, not baked into the render. |

Camera markers currently make hard cuts between shots. Any later dissolve is an editorial decision, not a geometric morph. Do not interpolate camera transforms through an unrelated cut. Forward and backward scroll must select deterministic poses and frames.

Keep daylight fixed across all cameras. Do not add a day/night cycle. Gentle foliage wind can be added with deterministic low-amplitude deformation after composition is approved; keep courtyards clear of dust and rotor wash. Do not use stochastic physics that produces different states when scrubbing backward.

## Geometry quality

### Terrain and geology

Build broad valley shapes first, then erosion and shoulder detail, then near-camera stones and soil. Snow should settle in plausible high-altitude areas and sheltered slopes. Avoid smooth volcano cones, extruded-looking cliffs, disconnected mountain islands or snow masks made from visibly blocky polygon assignments. Fractures must have geological direction, not uniform noise displacement.

The existing terrain and continuous-range meshes are editable procedural geometry. Refine near-camera terrain to the camera footprint. Use denser local patches for hero ground rather than subdividing the entire mountain range indiscriminately.

### Buildings and village

The current buildings have foundations, walls, gables, individual roof courses, windows, doors, steps and timber details. Refine openings into actual inset wall geometry for close shots. Add roof eaves, gutters, believable slate overlap, flashings, weathering concentrated at runoff points, and architectural asymmetry consistent with construction.

Replace straight perfect boundary walls with irregular local stone construction where visible. Reuse construction language, not identical complete houses. Use different footprints, entrance positions and subtle roof variations. No ruined-building poverty shorthand, oversized temple as a clinic or generated signage.

### Vegetation

Use shared mesh data or collection instances for trees. The working scene has roughly eight thousand tree placements, with shared procedural trunks and CC0 scanned fir branch atlases. This is an offline-render forest, not a browser-ready asset budget.

Foreground trees need branching complexity, coherent species silhouette, varied age and asymmetry. Place alpha branch sprays in multiple orientations around real branches; never make one camera-facing tree billboard. Maintain correct atlas UVs and check alpha edges against both bright sky and dark forest. Avoid black halos, obvious rectangular cards and repeated tree crowns.

Grass needs clumps, height variation, dead stems, exposed soil and small stones. Keep the service aprons bare. Grade density by distance: fine actual geometry near camera, simpler cover farther away. Grass blades must meet the ground. Add footpath wear, not a uniform lawn.

## Materials and lighting

Use physically based surfaces and actual texture scale. The working file uses Poly Haven CC0 `aerial_grass_rock`, `rock_face`, `plastered_stone_wall`, and `fir_tree_01` maps. Source URLs, expected MD5 values and filenames are recorded in `asset-sources.json`. These are environment textures, not Raven textures. Do not interpret their resolution as permission to resize or lossy-recompress the protected Raven maps.

- Meadow: restrained olive/moss variation, rough dry surface, no neon green. Use large-scale color breakup plus metre-scale scanned detail; inspect repetition from wide cameras.
- Rock: coarse geological relief, middle-scale fractures, fine roughness. Use triplanar projection or intentional UVs appropriate to the surface. Do not apply tangent-space normals with an incompatible coordinate basis.
- Stone/plaster: warm gray and local brown; actual mortar depth at hero distance; subtle plaster variation. Preserve masonry scale at corners and foundations.
- Timber: aged gray-brown directional grain, dry roughness, no orange glossy varnish.
- Slate: dark charcoal, overlapping geometry, varied individual slabs, low broad reflections; no chrome or uniformly glossy roof.
- Windows: reflective dark panes with recesses and frames; avoid bright blue opaque rectangles.
- Foliage: correct alpha, subtle transmission, believable fine texture and roughness; no plastic shine.

Light one settled late-morning period. Fixed sun direction, moderate elevation, warm-neutral direct light and cool sky fill. Use AgX and evaluate exposure with the light-gray Raven reference later. Do not hide modeling problems under dense fog, excessive bloom, shallow depth of field or heavy grain.

Distance should reduce contrast progressively while foreground material detail remains legible. Use a restrained finite atmosphere only after the clear-air render reads. The current atmosphere object is disabled in rendering during look-development corrections; do not assume its presence means approved haze.

## Raven and compositing contract

The user's aircraft stays separate. Do not remodel it, add a winch, change the four-arm/eight-propeller coaxial contract or bake a drone shadow into the clean environment plates.

For reference alignment, use `glb/raven-quad/raven-quad.blend` or the existing textured source GLB in a separate switchable reference collection. Never overwrite these files. Keep that collection off in clean-plate renders.

For browser compositing, **exactly the same camera** must drive the background render and the live GLB: transform, sensor/focal length or projection matrix, frame mapping, aspect ratio and crop. Supply sampled camera matrices with explicit Blender Z-up and conversion metadata. Convert Blender coordinates to Three.js deliberately; do not compensate with arbitrary per-shot rotations.

Export depth and object masks if Raven must pass behind trees or terrain. A background image alone has no depth. Check depth interpretation, clipping and screen alignment in the browser before exporting hundreds of frames. Contact shadows require an agreed compositing method; a live GLB placed over a flat plate will not automatically cast onto that plate.

Mobile needs its own composition/crop check. Cropping a desktop plate while leaving the drone camera unchanged breaks alignment. Preserve the production site's existing mobile tracks until any change is explicitly implemented.

## Render and web delivery

1. Test representative stills for all six cameras at low cost.
2. Approve one mountain-crossing chapter with Raven composited at the intended size.
3. Test its forward/reverse scroll and mobile memory before committing to the full sequence.
4. Render production masters offline in Cycles, initially 1920×1080, adaptive sampling and denoising. Increase quality based on foliage and shadow stability, not sample-count prestige.
5. Save masters as numbered lossless images; retain linear EXR depth/masks where needed. Do not render directly into a single movie as the sole master.
6. Encode web frames separately, with responsive environment variants. Raven texture restrictions remain unchanged.
7. Load and decode by chapter using bounded caches. Do not load all 600 decoded frames into memory. Maintain a lightweight poster and reduced-motion/static fallback.
8. Drive frame selection and the matching live camera from the existing scene progress source. Add no second smoothing controller.

Do not assume 24 source frames per second is the correct web delivery density. The eventual sampling rate depends on apparent camera motion, scroll travel and tested memory. Record measured download, decode and GPU behavior with the live Raven model present.

## Acceptance gates

- Every camera shows the same buildings, landmarks, time and geography.
- The clinic reads as a place with a usable courtyard; its architecture stays stable between establishing and arrival shots.
- Mountain silhouette, forest density and material response are compared directly with R01–R08 at similar display size.
- No floating foundation, intersecting roof, paper-thin obvious wall, disconnected path or visibly tiled terrain in hero areas.
- Foliage is dense and irregular without alpha-card artifacts or repetitive silhouettes.
- Scanned detail is actually visible; more texture nodes alone do not count as realism.
- Camera motion is restrained and deliberate. Cuts have explicit boundaries. Scrubbing backward is deterministic.
- No drone, cargo, baked flight effects, speculative handoff mechanics, source logos, rendered UI text or unverified performance claims in the environment plates.
- A camera-matched GLB composite passes before website integration is called complete.

## Relevant skills

Use `text-to-blender` for routing; `blender-pro-workflow` for scene assembly and critique; `blender-materials` for PBR; `blender-uv-texturing` for atlas and mapping checks; `blender-lighting` for daylight and atmosphere; `blender-cameras` for composition and camera matching; `blender-rendering` for masters and QA; `blender-export` / `blender-web-pipeline` for the later export and browser handoff. Keep the selected live MCP bridge throughout this authoring task.

## Known unfinished work

This working pass does not yet prove photoreal reference parity. Full animation playback/render validation, refined hero architecture and ground dressing, terrain road cut/fill, depth-based GLB occlusion, shadow compositing, mobile framing and exact production camera mapping remain acceptance work. No website source, scroll timing, drone asset, deployment or git push is changed by the Blender scene build.
