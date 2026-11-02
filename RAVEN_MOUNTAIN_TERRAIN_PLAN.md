# Raven mountain terrain plan (tundra / high-mountain look, after everest.suraj.work)

Status (2026-11-03): phases 0-2 implemented and the default homepage terrain (`?terrain=v09` = old look) (see AGENTS.md "Mountain terrain");
phases 3-5 open. Defaults taken for D1 (low corridor), D2 (procedural first), D3 (clay map unchanged), D6 (city tile
unchanged); D4 and D5 still needed.
Reference study: `research/everest/ANALYSIS.md` (local only).

## 1. Requirements as understood

| # | Requirement | Keep / change |
|---|---|---|
| R1 | Keep the overall landscape: endless tiles, camera tracks, scroll, transitions, story beats, clay map in band 2 | keep |
| R2 | The ground should read as a cold **hilly / mountain region (tundra, high Himalaya)**, not a green valley | change relief |
| R3 | Form mountains like the Everest site: ridges, steep rock faces, scree, snow on high and flat ground | change relief + material |
| R4 | Texture, material and shading should feel like Everest: rock on slopes, altitude snow, desaturated cool palette, cloud shadows, haze | change material |
| R5 | Keep trees, plus moss, grass and patches of ground cover | keep, restyle |
| R6 | Keep villages and make them prominent: they are the delivery destinations | keep, restyle, place deliberately |

## 2. Can it be done directly in Three.js?

**Yes.** Everest proves the whole look is runtime Three.js: a heightfield turned into an indexed grid, a patched
MeshStandardMaterial, procedural textures, and instanced trees and rocks. It uses no Blender asset. Every piece maps onto
our stack (R3F, our own ShaderMaterial, InstancedMesh). Blender stays optional, only for nicer house models or offline
texture bakes.

What is different for us, and shapes the plan:

1. **The tiles repeat and wrap.** Everest is one fixed 43 km map. Our ground is the same tile repeated 15-30 times
   while the camera travels. Mountains therefore need edges that line up across tiles (periodic), and enough variety
   that the same peak does not come back every row.
2. **The flat rim is the main "valley" cause.** Every tile has the same flat rim (2.189 local, edge band < 22 units)
   so tiles can join. Hills rise from that ring and fall back to it on every tile. Periodic heights remove the rim
   without breaking the joins.
3. **There is a height ceiling under the flight path.** The drones and camera follow fixed shipped tracks, and the
   lens effect only treats ground below world y −1.55 (about 23.7 local units) as terrain. The relief directly under
   the drone corridor cannot grow much. Mountain height has to go where the camera doesn't fly: the side columns,
   further ahead, and the horizon. Under the path, the mountain feel comes from steepness, rock, snow and shading,
   which is exactly what Everest's shader does.
4. **Our look is baked, not lit.** The current ground is a Cycles render baked into the texture (golden sun, trees
   painted in), shown by `TerrainMaterial` with fog and the scan wipe and no real lighting. The Everest feel needs a
   lit material at runtime. This is the biggest visual change, and it is what R4 asks for.
5. **The camera mostly looks down at 40° or steeper.** Snow on flats, dark rock on steep faces, sharp ridge lines and
   long cast shadows will sell "mountain" far more than raw height. They are also cheap.

## 3. Approach (recommended)

Keep the tile system, the travel and every scene. Replace three things on the **natural** tiles: the relief, the
material and the scatter. The city tile stays as it is for now. Do it all in TypeScript and GLSL, deterministic and
seeded, so there is no Windows/Blender round trip for the ground.

### 3.1 Relief: a periodic "super-tile" heightfield
- One heightfield that wraps in both directions and spans **4 columns × 6 rows** of tiles, matching the existing
  variant period (`VARIANT_LAYOUT`). Each tile takes its own slice, so no tile repeats within 6 rows.
- Generator, in order:
  1. ridged multifractal noise on a torus (periodic) with domain warping, which gives sharp crests and V valleys
  2. a short thermal + hydraulic erosion pass (gullies, scree fans), run offline by a Node script and shipped as a
     height `.bin` or 16-bit PNG, so load time stays low
  3. height shaping per column: a capped corridor under the drone path, and tall peaks in the outer columns
  4. flattened terraces at the village sites (§3.4)
- Mesh: the same tile footprint and planar UVs as now. Resolution about 257² on desktop and 129² on mobile, with
  normals computed from the heightfield, not the mesh, so seams stay smooth.
- Backdrop (optional, recommended): a fixed, non-tiling distant snow range for the horizon. Either the existing
  `OpeningSky` ridge rings with new profiles, or a real DEM ring (AWS Terrain Tiles, decoded the Everest way). Because
  it sits at infinity, it doesn't have to tile.

### 3.2 Material: `MountainMaterial` (Everest-style, on our shader)
A new ShaderMaterial for natural tiles. It keeps our existing chunks: fog, the panorama fade, the scan wipe and grid
mode, drone shadow and ground dim, so the transitions behave as now. Layers, blended by slope, altitude, curvature
and noise:

| Layer | Where | Look |
|---|---|---|
| Grass / alpine meadow | low, gentle slopes | muted olive/straw, not saturated green |
| Moss / tundra heath | mid altitude, moist hollows (concave) | dark olive, rust, ochre patches |
| Scree / gravel | below cliffs, fans | grey-brown, fine triplanar detail |
| Rock | steep faces (Everest uses `_up` 0.86 → 0.985) | dark grey-warm, triplanar at 2 scales, strata normals |
| Snow | high and flat, with a noisy snowline; wind-ripple normals | cool white, lower roughness, slight blue rim |

- Lighting: real sun (Lambert or GGX) driven by `sunlight.ts`, plus sky ambient. Baked-in light is gone.
- Atmosphere, as on Everest: moving cloud shadows, ~0.86 desaturation, distance haze, colour and detail faded with
  distance.
- Textures:
  - Option A (recommended): CC0 Poly Haven 1K sets for rock, moss and grass (diffuse + normal, lossless WebP).
  - Option B: Everest-style procedural textures built at load (Worley rock, blob noise, micro normals). Zero download,
    but a more synthetic look.
- A macro map (AO, curvature, flow) is computed once from the heightfield and drives the masks, like Everest's
  photo-derived masks.

### 3.3 Trees, moss, grass
- **Trees**: instanced low-poly conifers (2-3 shapes, 2 LODs), in clumps the way Everest does it. They only grow in a
  valley band and thin out to a treeline. They lean to the sides of the corridor so they don't hide villages. Colour
  varies per instance.
- **Krummholz/shrubs**: small dark instanced blobs near the treeline.
- **Boulders**: jittered icosahedra on scree and moraine, coloured from the layer underneath.
- **Moss and grass**: material layers (§3.2), not geometry. Optional sparse grass cards only right below the low
  opening shot.
- Instances are built per super-tile slice and shared by the wrapped tiles, so the count stays bounded
  (target < 60k instances on desktop, < 15k on mobile).

### 3.4 Villages (delivery destinations)
- **Placement**: villages are chosen first and the terrain is shaped around them. Each village sits on a flattened
  terrace or shelf with stepped field terraces around it, joined by footpaths and switchbacks, painted into the
  material from a path mask.
  - The story villages are fixed: the Route/health-centre start, the Hill clinic and the Ridge village. They keep
    their story positions.
  - Other villages are spread across the super-tile.
- **Houses**: a small procedural kit in Three.js (stone walls, gable or flat roofs in Himalayan blue/red/green tin,
  prayer-flag lines optional). It is instanced and merged per village, and casts shadows on the ground.
  The 24 existing cottage proxies can be the first version. A later version can use a Blender-modelled kit.
- **Readability from altitude**: warm windows or roof colours contrast against the cool ground, so villages read as
  destinations.

### 3.5 Integration (everything that reads the terrain)
- `DetectionPoints` heights: re-sample from the new heightfield. `RAVEN_DETECTION_Y` becomes computed, not hard-coded.
- Clay map (band 2) samples the tile heights. Decide whether it takes the new relief (§5, D3).
- Drone shadow, terrain lens `TERRAIN_TOP`, cloud wisps, opening fog and panorama blend: re-check each against the
  new heights.
- Toggles: `?terrain=v09` keeps today's baked tile for side-by-side checks. `?terrain=original` stays.
- Quality tiers: mesh resolution, instance counts and texture layers scale on mobile.

## 4. Phases (each one ends with typecheck, build and agent-browser screenshots at the AGENTS.md scroll positions)

| Phase | Work | Result to review |
|---|---|---|
| 0 | Measure camera and drone clearance over the ground for every scene (sample the camera tracks), giving a height-budget map per tile column. Capture baseline screenshots. | Height budget, baseline set |
| 1 | Relief prototype: periodic super-tile heightfield, no rim, grey clay-lit shading only | Mountain shapes approved before any colour work |
| 2 | `MountainMaterial`: rock, snow, scree, moss, grass layers, sun lighting, cloud shadows, haze | Everest-feel look approved |
| 3 | Villages: terraces, paths, house kit, story-village positions | Villages read from altitude |
| 4 | Trees, shrubs, boulders | Final ground |
| 5 | Horizon range, integration fixes (detection points, clay map, lens, opening), perf tiers, docs (`RECONSTRUCTION.md`, AGENTS.md) | Shippable |

Phases 1-2 are the main risk and decide the look. Stop for approval after each.

## 5. Decisions needed from the user

- **D1 Height under the drone path:** keep the corridor low and put the tall mountains at the sides and horizon
  (recommended), or also raise the camera tracks? The second changes the shipped choreography, which R1 says to keep.
- **D2 Textures:** CC0 Poly Haven sets (recommended, better close-up) or fully procedural like Everest (no download)?
- **D3 Clay map, band 2:** give it the new mountain relief too, or leave it exactly as it is now?
- **D4 Village style:** Himalayan (stone walls, coloured tin roofs, terraces, prayer flags) or Nordic/Arctic tundra
  (timber, red/ochre walls, no terraces)? The brief mentions both. The village style decides the house kit.
- **D5 Real geography:** shape the horizon (or the clay mountain) from a real DEM, or keep everything fictional? The
  ground under the path stays fictional because it has to tile.
- **D6 City tile:** leave it as it is (recommended for now), or include it in the restyle?

## 6. Risks

- Repetition: a 4×6 super-tile still repeats every 6 rows. If needed, add a second super-tile or vary per wrap.
- Performance: a lit multi-layer triplanar shader on 15-30 tiles plus instances. Mitigations: distance-faded
  detail, mobile tier, merged instances. Everest runs a heavier shader on ~1.1 M vertices.
- Look change: moving from a baked golden render to a live cold palette changes the mood of band 1 (intended per R4).
  `?terrain=v09` keeps the old look available for comparison.
- Licence: the current Cottage_FREE licence for a public GLB is unconfirmed. A procedural house kit removes that risk.
