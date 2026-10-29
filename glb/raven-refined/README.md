# Raven material refinement

Original: `../raven_drone.glb` (untouched).

`raven-refined.blend` is an editable Blender 5.2.2 studio scene with packed PBR texture maps. Studio lights/camera are QA-only and are excluded from the GLB. `raven-refined.png` is the inspected Cycles render. `refine.py` rebuilds the materials, full-surface cubic UVs and cargo labels, and saves an uncompressed, textured source GLB. It uses Blender's bundled numpy; no generated/third-party textures or external references are needed.

From repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python glb/raven-refined/refine.py
npx --yes @gltf-transform/cli@4.2.1 webp glb/raven-refined/raven-textured.glb glb/raven-refined/raven-webp.glb --quality 85
npx --yes @gltf-transform/cli@4.2.1 draco glb/raven-refined/raven-webp.glb public/assets/models/raven_drone_refined.glb
node scripts/check-raven-rotors.mjs
npm run assets:manifest
npm run typecheck
npm run build
```

Apply Draco last, once. All 18 final images are embedded; the web GLB is 930,840 bytes. The source/working GLBs remain uncompressed for reauthoring and motion regression tests.

Preserve the six named Rotor_Front/Mid/Rear_Left/Right assembly pivots and CW/CCW metadata. Multi-material children are not independent rotor pivots. The site animates only the six assemblies. No camera tracks or flight animation clips were changed.
