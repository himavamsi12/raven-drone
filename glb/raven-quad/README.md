# Raven coaxial quad — heavy-duty medical cargo variant

Built from `RAVEN_DRONE_BLENDER_BRIEF.md`, then revised on user request (2026-10-30). The revision has four arms, each with an upper and a lower counter-rotating two-blade propeller (eight props in total), and a heavier structure that follows the user-supplied heavy-lift references. This overrides the brief's single-propeller rule; the mast removal still applies. New geometry, authored procedurally in Blender 5.2.2; no reference or earlier Raven mesh is reused.
Preserved untouched: `../raven_drone.glb`, `../raven-refined/*`, `public/assets/models/raven_drone_refined.glb`, camera/drone animation GLBs.

| File | What |
|---|---|
| `build_raven_quad.py` | Builds the model, bakes the tiling PBR maps to `textures/`, saves `raven-quad.blend`. |
| `qa_render.py` | Adds the `RQ_Studio` collection (softboxes and QA cameras, never exported), saves it into the .blend, and renders `qa/`. |
| `export_glb.py` | Exports only the `Raven_Root` hierarchy to `raven-quad-textured.glb`: uncompressed, embedded PNG maps, extras. |
| `public/assets/models/raven_quad.glb` | Site asset: the textured GLB with all 20 maps re-encoded as lossless WebP at full resolution (verified pixel-identical to the source PNGs, max difference 0), then Draco geometry compression applied once. Materials are unchanged. 16,816,144 bytes. |

## Rebuild (from repository root)

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender
$B --background --factory-startup --python glb/raven-quad/build_raven_quad.py
$B --background glb/raven-quad/raven-quad.blend --python glb/raven-quad/qa_render.py -- --samples 64
$B --background glb/raven-quad/raven-quad.blend --python glb/raven-quad/export_glb.py
# Textures: lossless WebP only (same pixels, no resize). Geometry: Draco last, once. High quantization keeps
# custom normals and the 1.5 mm carbon-weave UVs exact (default 12-bit UVs would shift the weave).
npx --yes @gltf-transform/cli@4.2.1 webp glb/raven-quad/raven-quad-textured.glb /tmp/rq-ll.glb --lossless --effort 100
npx --yes @gltf-transform/cli@4.2.1 draco /tmp/rq-ll.glb public/assets/models/raven_quad.glb \
  --quantize-position 16 --quantize-normal 12 --quantize-texcoord 16
node scripts/check-raven-rotors.mjs
```

For a live preview over Blender MCP, exec the build script with `RQ_ROOT=<repo>` and `RQ_FAST=True`. It adds or replaces only the scene `Raven_Quad`, uses 256 px maps and does not save.

## Silhouettes (loader, sync, Raven Ops)

`build_silhouettes.py` (headless, about 90 s) replaces the shipped delta-jet silhouettes. Outputs go to `silhouettes/`, then into `public/assets/models/` with Draco (geometry only, `--quantize-position 16 --quantize-normal 12`).

- **`drone-lowpoly.glb`** (17.7 KB, 1,436 tris) is used by the sync flock (`Flock.tsx`) and by the Raven Ops, coordination and response drones (`LowPolyDrone`).
  - It keeps the jet's contract: node `mainBody` turned 180° about Z, and after that turn the nose is -Z, up is +Y, and the span is ±1.28.
  - It is a simplified coaxial quad: body, packs, case, skids, arms, pods, and solid upper/lower rotor discs. The user chose the discs over a crossed-blade variant.
  - A second node, `outlineHull`, is the same parts inflated 0.045 m along their normals. The flock's uniform 1.15× outline scale only worked for the compact jet; on a drone it pushes the outlines off the arms and discs.
- **`loading-drone.glb`** (118 KB, 14.8k tris) is used by the 3D loader in `Loader.tsx`. It is the real Raven decimated, with blades staggered, in the jet's world frame and scaled 0.718 to match the jet's on-screen footprint.
- **The boot SVG** (`src/components/loading/boot-shape.ts`) is traced from a mask render through the loader's exact desktop camera. The same tracer run on `loading-delta.glb` reproduces the shipped jet path (perimeter 3626.8 against the shipped 3614 dash total, same 1320×666 box). The drone path uses viewBox 1137×769 at h 38.39vh, translated -0.67vh / -2.1vh, so the splash sits exactly over the 3D loader. Holes use the evenodd rule, and the highlight dash is 10% of the perimeter, as shipped.
- The original `delta-lowpoly.glb`, `loading-delta.glb` and `delta-pbr.glb` remain on local disk, but are gitignored and not deployed.

## Site imagery (mission cards, demo, footer landing sequence)

`render_media.py` renders the jet photos' replacements in Cycles. The model is appended from `raven-quad.blend`, and landscapes are procedural numpy height fields, so no third-party imagery is used.

- **Mission cards** (`cards`, 1350×1260):
  - *Mountain Villages*: alpine valley, pine forest patches and a village.
  - *Winter Access*: snowy foggy valley, road and lit houses.
  - *Remote Health Centres*: dusk tundra, a lit health centre with a landing pad, and a settlement.
  - The drone flies in the foreground with motion-blurred rotors.
- **Demo** (`demo`): the drone over a dark terrain with a draped topographic grid.
  - Desktop is 1015×644, with the drone right of centre, because the page shows the image's right part.
  - Mobile is 827×400, with the drone in the left half, because mobile shows the left part.
- **Footer sequence** (`seq`, 96 × 1920², transparent film): the drone descends from above the frame and settles low and centred. The bottom-centre of its case follows the shipped `FRAME_Y` path frame by frame, solved by bisection through the camera, so the existing glow capsule stays attached. As with the shipped frames, the background is transparent: the footer alpha-blends the frames over the page and the capsule.
- **Encoding:** `node glb/raven-quad/encode_media.mjs <path-to-sharp> [images|seq]` writes WebP q86 for the cards and demo, and AVIF 4:4:4 with alpha for the 96 frames in `public/assets/images/raven-landing/`. The cards get the shipped per-row alpha fade (opaque top easing to about 30% at the bottom, stored in `card-alpha.json`), so the card copy reads as before. sharp ships in the `@gltf-transform/cli` npx cache. Raw PNGs in `media/` are gitignored.

## Conventions and layout

The build uses Blender metres with Z up, front along -Y and left along +X. The glTF export is Y-up, which puts the front along +Z, and the site keeps its existing 180° adapter.

`Raven_Root` sits at the arm/rotor-deck centre. The hierarchy:

- `Body_Shell` (shell, chassis plate, pierced side rails, arm hinge mounts), `Battery_Deck`, `Front_Optics` (nose bezels and a compact downward sensor block), `Cargo_Case` and `Landing_Frame`.
- One `Arm_<station>` per station, holding:
  - `Motor_Static_<station>`: a textured pod with a smooth upper and lower motor ring;
  - `Rotor_<station>_Upper` at Y +0.235 and `Rotor_<station>_Lower` at Y -0.175. Both are empty pivots on the same shaft axis with identity rest rotation. Each carries `Propeller_<station>_<level>`: the rotating bell, hub and two blades. The lower bell is mirrored to face the pod.

| Element | Value |
|---|---|
| Motor axes | X ±0.76, Y ±0.63 |
| Propeller radius | 0.40 m, wider chord than v1 |
| Rotor-tip footprint | about 2.32 m |
| Body | 0.58 × 0.90 × 0.23 m, plus a 0.03 m chassis core |
| Carbon tube | 62 mm, with root hinge clamp, folding joint and finned module |
| Motor pod | 186 mm diameter |
| Cargo case | 0.48 × 0.46 × 0.36 m |
| Landing tubes | 31 mm, skid base 0.64 m below root |

These are visual values, not engineering data. The model has 67,106 triangles.

Spin direction, viewed from above, is stored in the pivot extras as `spin_direction`, together with `raven_rotor: true`. Each lower prop turns opposite its upper prop:

| Station | Upper | Lower |
|---|---|---|
| Front_Left | CW | CCW |
| Front_Right | CCW | CW |
| Rear_Left | CCW | CW |
| Rear_Right | CW | CCW |

Blade pitch handedness follows each prop's own direction, so both props push air downward.

## Materials

The 13 brief materials plus LED red/green and label ink are created from the sRGB targets, converted to linear in Python. For example, the shell exports baseColor `0.366, 0.371, 0.413`, which is #A3A4AC.

Procedural height fields are baked with numpy into tiling maps:

- base colour (sRGB);
- tangent normal (Non-Color, wired through a Normal Map node);
- ORM (R = 1, G = roughness, B = metallic).

Map sizes and physical scale per surface:

| Surface | Map size | Physical tile | Feature size |
|---|---|---|---|
| Shell micrograin | 2K | 0.25 m | — |
| Cargo-case pebble | 2K | 0.12 m | ~0.55 mm |
| Motor-pod pebble | 1K | 40 mm | ~0.30 mm |
| Carbon 2×2 twill | 1K | 24 mm | 1.5 mm cells |
| Deck, case side and frame grain | 1K | — | — |

Carbon tubes use cylindrical UVs with the seam on the underside. The other surfaces use physical-scale box UVs.

## Validation done

- Ten QA Cycles views in `qa/`, covering front three-quarter, top ortho, side ortho, front, arm/motor and cargo close-ups, plus white, gray, roughness and camera-normal diagnostics. The views show:
  - four X arms;
  - no mast, stump or ring;
  - a continuous top with a 1.5 mm service-panel seam;
  - case clearance;
  - dark parts that stay dark on a white background;
  - no flipped normals.
- `node scripts/check-raven-rotors.mjs` loads the textured GLB through GLTFLoader and passes. It checks that:
  - there are exactly eight pivots (four shafts × upper/lower) and no `Mid` objects;
  - each pivot is at its expected shaft position and height, with a 4 CW / 4 CCW split and counter-rotating pairs;
  - propeller bounds stay centred on the shaft before and after spin;
  - only the pivots change, and clones are independent.
- The same script confirms the Draco/WebP web asset keeps identical pivot names, extras and children.
- On the site, the hero, the specs top-down and the swarm load the coaxial quad with no console errors (v2 browser check at desktop size only). The specs callout now reads "Coaxial Quad Architecture". `npm run typecheck`, `npm run build` and `npm run assets:manifest` pass.

## Known discrepancies (honest list)

1. **Original interpretation, not a replica.** The reference shell has more sculpted multi-plane surfacing and corner lens pods. Raven uses a lofted shell with a raked nose, belt line, shoulder facets and a flat service plateau, plus two recessed bezels with two lenses each. The hinges and fold joints are visual cues only; nothing folds.
   - **Coaxial props depart from the brief.** The user asked for coaxial props, overriding the brief's single-prop rule. No mast and no GNSS pucks were added, because the brief bans top sensors. Thrust, redundancy and payload are not claimed.
2. **Motor pods are simplified.** The reference pods carry finned side modules. Here the finned electronics module sits on the arm next to the pod.
3. **Maps tile rather than bake per object.** They are not unique 2K atlases, and no ambient occlusion is baked (the R channel is 1). The shell has no base-colour map, because its albedo is intentionally flat.
4. **The site asset is still large (16.8 MB).** At the user's request, textures are never resized or lossy-compressed. Lossless WebP cut the size from 29.3 MB while keeping every pixel identical. Loading is still slower than the earlier 0.93 MB hexacopter (local dev: 16.3 MB transfer in about 0.5 s; real networks are slower).
5. **Two exporter limits.** The exporter wrote no `KHR_materials_ior`, so the shell coat IOR of 1.46 reaches three.js as the default 1.5. The lens tint ships as `KHR_materials_specular`, with no thin film.
6. **Fine detail is only visible up close.** The carbon weave and pebble grain read only in close Blender views. At site camera distances they average out through mipmapping.
7. **Rotor motion has no render.** It is verified by script, and there is no turntable or motion-blur render. In the browser, spinning blades read as thin lines, as before.
8. **Exposure was adjusted.** The QA renders use AgX at -1.5 EV under bright softboxes, so the browser's tone mapping shows a lighter shell. Material values were not changed to compensate.
9. **Specs callout anchors were not moved.** They keep the earlier ground positions; only the copy changed. Camera tracks, spans and scroll timing are unchanged.
10. **No performance or certification claims.** No payload, range, speed, certification or cold-weather rating is stated or implied. The markings are only "RAVEN / MEDICAL SUPPLY" in pale-gray ink on the case side panels.
