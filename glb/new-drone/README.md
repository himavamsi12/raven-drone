# Raven hexacopter (site drone)

| File | What |
|---|---|
| `Hexa_Medical_Drone_Black.glb` | User-supplied source v2 (black, 2026-10-30): 86,456 tris, 11 JPEG PBR maps, EO/IR turret, LiDAR and thermal pods. Used on the site. Same prop/nav-light node names as v1. |
| `Hexa_Medical_Drone_Black_v1.glb`, `raven-hexa-prepared_v1.glb`, `raven_hexa_v1-web.glb` | Previous drone (36,508 tris, one PNG), its prepared copy and its 186,780-byte web asset. Not used. |
| `Hexa_Medical_Drone_White.glb` | User-supplied white variant. Not used. |
| `prepare_hexa.mjs` | Strips the six `KHR_lights_punctual` nav lights, renames the props to `Rotor_<Front|Mid|Rear>_<Left|Right>` with `spin_direction` extras taken from the source's prop clips (then drops the clips), and centres the model on the prop ring / bounding-box middle. Geometry and materials untouched. |
| `raven-hexa-prepared.glb` | Output of `prepare_hexa.mjs`, uncompressed. Source for the rotor regression. |

Build the site asset (textures never resized or re-encoded lossily; Draco last, once):

```bash
node glb/new-drone/prepare_hexa.mjs ~/.npm/_npx/9ae6225218f85c19/node_modules glb/new-drone/Hexa_Medical_Drone_Black.glb glb/new-drone/raven-hexa-prepared.glb
npx --yes @gltf-transform/cli@4.2.1 draco glb/new-drone/raven-hexa-prepared.glb public/assets/models/raven_hexa.glb \
  --quantize-position 16 --quantize-normal 12 --quantize-texcoord 16
node scripts/check-raven-rotors.mjs
```

The first argument is any `node_modules` folder holding `@gltf-transform/core` and `@gltf-transform/extensions`.
v2 result: 1,995,084 bytes; the 11 JPEG maps are byte-identical to the source. Lossless WebP of those JPEG-decoded
pixels was 6.59 MB, so it is skipped (v1 used `webp --lossless --effort 100` on its single PNG: 186,780 bytes).
Rotor hubs after recentring: X/Z unchanged from v1, Y 0.3385 (v1 0.3485: the new underslung pods move the bounds).
