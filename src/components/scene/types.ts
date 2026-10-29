import { useGLTF } from "@react-three/drei";
import type * as THREE from "three";
import { DRACO_PATH } from "@/lib/assets";

export type GLTFResult = {
  nodes: Record<string, THREE.Mesh & THREE.Object3D>;
  materials: Record<string, THREE.MeshStandardMaterial>;
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

/** useGLTF with the locally served Draco decoder (no CDN hotlinking). */
export const useGLB = (url: string) => useGLTF(url, DRACO_PATH) as unknown as GLTFResult;
useGLB.preload = (url: string) => useGLTF.preload(url, DRACO_PATH);
