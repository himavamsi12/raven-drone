import * as THREE from "three";

export type RavenRotor = { object: THREE.Object3D; direction: number };

/** Hexacopter contract (glb/new-drone/prepare_hexa.mjs): six prop pivots, exact names only
 *  (GLTFLoader also creates per-material submeshes under each pivot that must never spin on their own). */
export const RAVEN_ROTOR_NAMES = ["Front", "Mid", "Rear"].flatMap((station) => [
  `Rotor_${station}_Left`,
  `Rotor_${station}_Right`,
]);

export function collectRavenRotors(root: THREE.Object3D): RavenRotor[] {
  const rotors: RavenRotor[] = [];
  root.traverse((object) => {
    if (RAVEN_ROTOR_NAMES.includes(object.name)) {
      // CW viewed from above is a negative turn about the shaft (+Y after glTF conversion).
      rotors.push({ object, direction: object.userData.spin_direction === "CW" ? -1 : 1 });
    }
  });
  return rotors;
}

/** ~24 rev/s. Blades are drawn as blur discs while spinning (rotor-blur.ts), so the rate sets the ghost shimmer only. */
const ROTOR_SPEED = 150;

export function advanceRavenRotors(rotors: RavenRotor[], dt: number) {
  for (const { object, direction } of rotors) {
    object.rotateY(Math.min(dt, 0.05) * ROTOR_SPEED * direction);
  }
}
