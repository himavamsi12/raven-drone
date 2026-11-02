# Raven opening panorama (Blender source)

`01_opening_panorama.py` builds and renders the far-landscape layer drawn over the procedural opening sky
(`src/components/scene/OpeningSky.tsx`) and used as the opening fog colour (`TerrainMaterial` `uPanoMix`).
Default = land mode (transparent sky, no clouds): the user kept the procedural sky and clouds after seeing the full
Blender sky (`full` mode still renders it).
User request 2026-11-02: the opening showed an empty haze band between the last terrain tile and two flat ridge
rings; reference = deep blue sky, cumulus/cirrus, layered blue ridges, snow massifs, valley fog (local only).

Built on the Windows workstation (RTX 3060, OptiX), headless, from scratch (`--factory-startup`):

```
blender.exe -b --factory-startup --python 01_opening_panorama.py -- C:\Users\india\Documents\raven-sky\out [preview] [full]
```

- Output: `raven-opening-land.png` (8192x785 RGBA, equirectangular, latitude -22.5..12, image centre = heading 0 =
  three -Z, heading grows toward +X; 159 s) + `raven-opening-panorama.blend` + `sky-env.exr` (pass-1 sky, haze colour).
  `full`: `raven-opening-panorama.png` 8192x2560 to latitude 90 with cloud decks (501 s, not used).
- Site file: `public/assets/textures/environment/raven-opening-land.webp`, sharp WebP q80 alpha q90 effort 6.
- Measured opening camera (1440x900, scroll 0): world (-2.2, -0.37, 1.5), ~2 units above the ground, heading 56 deg,
  pitch +8, fov 75. The horizon leaves the frame by scroll 1800 with the camera below y 2.5, so the panorama sits at
  infinity (dome centred on the camera).
- Conventions found the hard way (Blender 5.2): Sky Texture `sun_rotation` = heading clockwise from +Y; the scattering
  sky models disable the node's `Vector` input (haze colour comes from the pass-1 EXR via an Environment Texture);
  `ShaderNodeMix` RGBA sockets must be addressed by identifier (`A_Color`, `B_Color`, `Factor_Float`).
- Look: MULTIPLE_SCATTERING sky (sun heading -53 = scene sun, elevation 38, aerosol 0.7), exposure set so the sky 60 deg
  up at heading 56 has linear blue 0.5 (Standard view), sun disc intensity 0.25 (direct light only), three flat
  cloud decks with emission, terrain = rolling hills + ranged noise + 5 ridgelines (170-1400 units) + 7 massifs
  (two in view at headings 34 and 71), haze toward the sky 6 deg above the horizon, valley-fog volume slab.
- Far ranges off (user, 2026-11-02: "not required"): `FAR_RANGES = False` skips the massifs and the 850/1400
  ridgelines and flattens the ranged relief beyond ~600 units. Land render 164 s; site WebP 527,244 bytes.
- Flatter land (user, 2026-11-02): `LAND_FLATTEN = 0.45` scales the ridgeline elevations and the ranged relief (max
  height 45 -> 14.5 units), so the site's far ridge rings rise behind a low plain. Land render 258 s; WebP 681,530 bytes.
- Horizon fix + cloud banks (user, 2026-11-02): land haze now goes to the site horizon colour (`SITE_HORIZON` =
  SKY_COLOR / render exposure) instead of the Blender sky 6 deg up, which clipped to a flat white band; the fog volume
  is soft separate banks at the ridge-ring feet (tops 6..30 units by noise, coverage x breakup noise, from 300 units,
  `FOG_DENSITY` 0.1, `FOG_GLOW` 6). Land render 246 s; WebP 364,864 bytes.
- Gaps (with FAR_RANGES on): snow on the near massif is close to clipping; mid hills have no visible tree texture (reference has dark
  forest); clouds are flat decks (no volume) and static.
