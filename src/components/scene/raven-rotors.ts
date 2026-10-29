import * as THREE from "three";

export type RavenRotor = { object: THREE.Object3D; direction: number };

/** Coaxial-quad contract: four arms x upper/lower pivots, exact names only
 *  (GLTFLoader also creates Propeller_* material submeshes that must never spin on their own). */
export const RAVEN_ROTOR_NAMES = ["Front_Left", "Front_Right", "Rear_Left", "Rear_Right"].flatMap((station) => [
  `Rotor_${station}_Upper`,
  `Rotor_${station}_Lower`,
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

export function advanceRavenRotors(rotors: RavenRotor[], dt: number) {
  for (const { object, direction } of rotors) {
    object.rotateY(Math.min(dt, 0.05) * 45 * direction);
  }
}
