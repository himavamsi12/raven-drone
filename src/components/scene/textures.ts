import * as THREE from "three";
import { ASSETS } from "@/lib/assets";

let noise: THREE.Texture | null = null;

/** Shared FX noise texture (shipped `xq` in module 76772), created lazily on the client. */
export function getNoiseTexture() {
  if (noise) return noise;
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  new THREE.TextureLoader().load(ASSETS.noise, (t) => {
    tex.image = t.image;
    tex.needsUpdate = true;
  });
  noise = tex;
  return tex;
}
