# Raven real-time terrain (Blender source)

Brief: `RAVEN_REALTIME_TERRAIN_CLAUDE_PROMPT.md`. Status: **v03 look-dev natural tile live in the site** (default terrain;
`?terrain=original` shows the shipped tile). Settlement/clinic tile not built yet.

### v03 (2026-10-31): leaf-card tree crowns

`07_masters.py`: broadleaf crowns built from the Blend Swap 5671 leaf card (crown blob at 0.6 fills gaps, 46 clumps of
3 outward-facing cards, 30% translucent leaves); `11_appearance_bake.py` raises transparent bounces to 16. Built on the
Windows workstation (`C:\Users\india\Documents\raven-terrain\build-scripts`, `build\build_and_encode.cmd`, 304 s with
OptiX). Its `encode.cmd` fails in sharp/libvips ("colourspace: parameter space not set"): copy
`build\raven-terrain-raw.glb` to `glb/raven-terrain/build/` and run `encode.sh` and the checker on the Mac.
Shipped: 2,677,716 bytes, sha256 `f0285fcb0e8fbfe9158699b8af1928af66c004c73d706a5e90b655e895b5e664`, checker PASS,
same geometry and detection heights as v02; base map ~9% darker than v02.

## Rebuild and check (Mac, from the repo root)

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b --factory-startup --python glb/raven-terrain/build_all.py -- glb/raven-terrain/build   # ~8 min at 4096 on M3 (Metal)
sh glb/raven-terrain/encode.sh glb/raven-terrain/build                                        # WebP q80 + Draco 14/10/12
$B -b --factory-startup --python glb/raven-terrain/check_terrain.py -- glb/raven-terrain/build/raven-terrain.glb
cp glb/raven-terrain/build/raven-terrain.glb public/assets/models/raven-terrain.glb             # only after PASS
```

`build_all.py` runs 01-11 in one namespace (`RAVEN_TERRAIN_RES`, default 4096) and writes `raven-terrain-v02.blend`
and `textures/*.png` here (the 4K PNGs and the .blend exceed 100 MB and are gitignored; rebuild them).
Geometry, masks, scatter and house placement are deterministic; the baked maps differ only by Cycles noise.
If the relief changes, copy the checker's `DETECTION_GROUND_Y` line into `src/components/scene/raven-terrain.ts`.

### v02 look-dev (2026-10-30, user reference: golden-hour aerial of green karst hills)

Authored first in team-blender on the Windows workstation (`raven-terrain-v02-lookdev.blend`, scripts there), then
ported here. Structure (01/02 geometry, roads, terraces, houses, tile contract) is unchanged.

6. `06_eco.py` - forest / limestone / bush / dry-crest masks from the source heights (slope, curvature, sun facing,
   periodic noise); outcrops kept off roads, terraces (14-unit dilation) and the tile rim.
7. `07_masters.py` - 3 broadleaf crowns, 1 fir, 2 bushes, 3 limestone rocks (per-instance colour variation).
8. `08_scatter.py` - ~53k trees, ~2k bushes, ~0.5k rocks per tile (seeded jittered grid, GN instancer).
9. `09_lookdev_material.py` - golden meadow with tufts, forest floor, cracked limestone with lichen, asphalt core +
   dirt shoulders/spurs, terraces. Periodic (4D torus noise).
10. `10_lighting.py` - warm sun 20 deg up on the scene sun's azimuth + physical sky; no haze/clouds/grade in the bake.
11. `11_appearance_bake.py` - orthographic straight-down render spanning exactly the tile (= the planar-UV base map,
   texel for texel), 3x3 neighbours at 400 spacing for continuous shadows/crowns, houses cast shadows but are hidden
   from the camera. `fix_edges` then equalises opposite edges; build_all re-packs from the saved file (packed bytes
   are not refreshed by pixel edits - the first attempt shipped the unfixed edges).
Encoding: Blender's own WebP export broke edge continuity at 4K (0.029 vs 0.015 interior); sharp WebP q80 keeps it
(0.012) at 2.47 MB, so Blender exports PNG/no-Draco and `encode.sh` compresses once.

## Measured contract (decoded shipped `terrain.glb`)

| Item | Value |
|---|---|
| `Land-A` | 9,960 verts, 19,679 tris, identity node, planar UV u=(x+200)/400, v=(y+200)/400 (Blender axes) |
| Edges | **every boundary vertex at z = 2.189** (Blender Z = glTF Y). Opposite edges have different vertex counts but are flat, so seams close |
| Rim ramp | flat to full relief within ~15 local units |
| Relief | z -7.68..17.33, median slope (1 - n.z) 0.074 |
| `city-terrain.glb` | node `Land-A` carries a 180 deg rotation about glTF Y; the runtime uses geometry only, so it is ignored |
| `building.glb` | 80 islands, 2-6 local units across, 0.1-0.4 tall |
| Original texture | 4096 WebP, stored sRGB luma p5/50/95 = 0.105/0.265/0.621; opposite edges differ by 0.067 mean |
| Camera envelope | all 12 camera clips sampled: Z 3.9..22.0; Camera01 sees rows 0-1 (~12x12 scene units); Camera05/06 reach row 4 |
| Runtime placement | terrain parent glTF (0,-2.5,-8.6) = Blender (0,8.6,-2.5); tile = (15.99 col, 0, 15.99 row - wrapped), scale 0.04 |
| Scene sun | `SUN_POSITION` glTF (-40,100,-30) = Blender (-40,30,100) |
| Detection anchors | the 34 `DetectionPoints` anchors sit on the shipped ground (within ~0.3 local units) |

## What the scripts build

1. `01_terrain.py` - 161x161 source grid (51,200 tris). Ridged + folded relief scaled to the original envelope
   (median slope 0.080), a valley road whose ends meet at the same x and tangent on y = +-200 (continues across rows
   as the terrain travels), three elliptical terraced pockets on shoulders, contour spur roads, flat 2.189 rim.
2. `02_village.py` - 24 houses (624 tris): stone plinth sunk below the lowest footprint corner, timber walls, gable
   slate roofs with overhang, a few restrained metal roofs. Long axis follows the contour; none within 37 units of an edge.
3. `03_surface.py` - mask image (roads, terrace fields, riser walls, plot variants) from the actual mesh heights and
   `M_RT_Alpine`: meadow, scree, rock (by measured slope), conifer crowns, soft summit snow (kept darker than the white
   cargo box), terrace plots, gravel, fine grain. All noise is sampled on a flat 4D torus built from UV, so colour is
   periodic across tile edges.
4. `04_bake.py` - Cycles DIFFUSE (colour x direct + indirect) to 2048. Sun azimuth = scene sun, elevation ~35 deg.
   8 neighbour copies at 400 spacing during the bake so shadows continue across edges; `fix_edges` makes opposite
   edge texels identical (the runtime 399.75 overlap is coplanar and darkened the outer texel when used in the bake).
5. `05_runtime_export.py` - `Land-A`: decimate collapse to 20,000 tris / 10,321 verts with the 640 boundary
   vertices locked, planar UVs re-projected after decimation (collapse had shifted them ~10 texels). `Houses`:
   smart-UV atlas, 1024 diffuse bake. GLB: +Y up, identity nodes, Draco 14/10/12, WebP q90, no cameras/lights.

## Shipped asset `public/assets/models/raven-terrain.glb` (v02, checker: PASS)

| | |
|---|---|
| File | 2,468,236 bytes (shipped terrain.glb: 2,094,240), sha256 `76a1d82404d0dc1dcf0eed7a9e6652a9e47e2170dfa1240d83542856f350515a` |
| Nodes | `Land-A`, `Houses`; identity TRS (geometry identical to v01) |
| `Land-A` | 10,321 verts, 20,000 tris, X/Z +-200, Y -7.56..17.0, rim 2.182812 on all 4 edges (161 verts each) |
| `Houses` | 1,296 verts, 624 tris, 24 houses seated |
| Images | `raven-natural-bake-4096` WebP q80 (look-dev appearance), `raven-houses-bake-1k` WebP q80 (golden light) |
| UVs / edges | planar UV error 0.31 texel; opposite edges 0.0123 / 0.0138 vs adjacent interior columns 0.0153 |
| Detection anchors | `RAVEN_DETECTION_Y` unchanged (same geometry) |

v01 (snow/grain pass, 873,544 bytes) is superseded.

## Site integration (see RECONSTRUCTION.md)

`Terrain.tsx` keeps the shipped tile machinery. Natural tiles take `Land-A` and the Raven map; each natural tile also
mounts `Houses` under its own moving group with a third `TerrainMaterial` (same fog and scan); the city tile keeps
the shipped geometry, base map and overlay. `DetectionPoints` take `RAVEN_DETECTION_Y`. `?terrain=original` and
`?plate=h00` use the shipped natural tile.

## Known gaps

- No settlement/clinic tile; the city tile (thermal/ignition) is still the shipped one, so its texture style differs
  from the Raven tiles beside it. The Raven rim (2.1828 decoded) sits 0.006 local units (0.00025 scene units) below the
  shipped city tile's rim where they meet.
- The original 4K map still loads (city tile base map); the Raven tile adds 874 KB.
- Ground is softer than the shipped 4K texture at the closest framing (end of DELTA_DRONE overhead).
- Houses use flat procedural colours (no plank/slate texture); no trees as geometry (conifers are baked crowns).
  The `glb/raven-story` trees (15.6k-tri trunks + 2.7k-tri alpha crowns) would need low-poly conversion first.
- Bake sun is 35 deg vs the scene sun's 63 deg (same azimuth), chosen for readable relief.
