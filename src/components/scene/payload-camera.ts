import * as THREE from "three";
import { lerp } from "@/lib/math";

/**
 * Raven payload stage camera (lib/payload.ts; user 2026-11-03: "it will zoom in little towards the drone ... highlight
 * the payload"). Works from the live hero pose (Camera01 at story 1, desktop and mobile tracks alike): spherical
 * coordinates about the payload box, the radius shortened, the elevation lowered so the box reads from the side, a
 * small orbit for parallax, and the aim offset so the box sits beside the callout. `zoom` = 0 leaves the clip pose
 * untouched, so the move starts exactly on the hero frame and plays back the same way.
 */
export const PAYLOAD_CAMERA = {
  /** Distance to the payload box at the end, relative to the hero distance. */
  radius: 0.86,
  /** Elevation above the box at the end (deg; hero ~33). */
  elevation: 21,
  /** Orbit added by the end (deg, positive = camera swings to its right). */
  azimuth: 10,
  /** Where the box sits on screen at the end (NDC, -1..1): left of centre on landscape screens, upper on portrait. */
  screen: new THREE.Vector2(-0.26, 0.02),
  screenPortrait: new THREE.Vector2(0, 0.24),
};

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const _rel = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _off = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, "YXZ");
const _fwd = new THREE.Vector3();
const _aim0 = new THREE.Vector3();
const _aim = new THREE.Vector3();

/**
 * Moves `mover` (holding the clip's hero pose) toward `anchor` (payload box, world) for an eased zoom weight.
 * `fov` is the vertical field of view in degrees, `aspect` the viewport aspect.
 */
export function applyPayloadCamera(mover: THREE.Object3D, anchor: THREE.Vector3, zoom: number, fov: number, aspect: number) {
  if (zoom <= 0) return;
  _rel.copy(mover.position).sub(anchor);
  const r0 = _rel.length();
  if (r0 < 1e-6) return;
  const az0 = Math.atan2(_rel.x, _rel.z);
  const el0 = Math.asin(THREE.MathUtils.clamp(_rel.y / r0, -1, 1));
  const r = r0 * lerp(1, PAYLOAD_CAMERA.radius, zoom);
  const el = lerp(el0, PAYLOAD_CAMERA.elevation * DEG, zoom);
  const az = az0 + PAYLOAD_CAMERA.azimuth * DEG * zoom;
  _eye.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(r).add(anchor);

  // Aim: from the point the hero camera looks at (closest point on its view ray to the box) to the box itself, so the
  // drone stays framed all the way (slerping the orientation on its own let it drift off the narrow portrait frame
  // mid-move). Then turn the camera so the box lands on its screen point (yaw right for a box left of centre).
  _fwd.set(0, 0, -1).applyQuaternion(mover.quaternion);
  _aim0.copy(mover.position).addScaledVector(_fwd, _rel.copy(anchor).sub(mover.position).dot(_fwd));
  _aim.lerpVectors(_aim0, anchor, zoom);
  _m.lookAt(_eye, _aim, UP);
  _q.setFromRotationMatrix(_m);
  const screen = aspect < 1 ? PAYLOAD_CAMERA.screenPortrait : PAYLOAD_CAMERA.screen;
  const tanV = Math.tan((fov / 2) * DEG);
  _euler.set(-Math.atan(screen.y * tanV) * zoom, Math.atan(screen.x * tanV * aspect) * zoom, 0);
  _q.multiply(_off.setFromEuler(_euler));

  // The clip's slight roll (~2 deg) fades out over the first part of the move.
  mover.quaternion.slerp(_q, THREE.MathUtils.smoothstep(zoom, 0, 0.15));
  mover.position.copy(_eye);
}
