#!/bin/sh
# Raven terrain: compress the raw Blender export once, at the end (textures WebP q80 via sharp, Draco 14/10/12).
# Usage (repo root): sh glb/raven-terrain/encode.sh <build_dir>   -> <build_dir>/raven-terrain.glb
set -e
D=${1:-glb/raven-terrain/build}
npx --yes @gltf-transform/cli@4.2.1 webp "$D/raven-terrain-raw.glb" "$D/raven-terrain-webp.glb" --quality 80 --effort 100
npx --yes @gltf-transform/cli@4.2.1 draco "$D/raven-terrain-webp.glb" "$D/raven-terrain.glb" \
  --quantize-position 14 --quantize-normal 10 --quantize-texcoord 12
ls -l "$D/raven-terrain.glb"
