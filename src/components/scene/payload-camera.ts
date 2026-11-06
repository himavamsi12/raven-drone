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
  /**
   * Portrait screens (user 2026-11-06: "reduce the drone a little here in mobile, it is cutting the sides"): the camera
   * ends further back so the rotor rings stay inside a phone's width.
   */
  radiusPortrait: 1.05,
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
  const r = r0 * lerp(1, aspect < 1 ? PAYLOAD_CAMERA.radiusPortrait : PAYLOAD_CAMERA.radius, zoom);
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

/**
 * Altitude stage side view (lib/payload.ts ALTITUDE_*; user 2026-11-03: "zoom out in the side view of the drone so that
 * we can draw a line from the ground ... show the upcoming terrains which is taller"; then: the drone stays on the left
 * but must move toward the right, toward the taller terrain, and read smaller). Camera on the -x side looking along +x:
 * the ground travels toward -z, so +z is on the right and the drone visibly flies right, toward the ridges
 * MountainMaterial raises there in this stage (uPayloadRiseLift); the ground under the drone along the bottom. The orbit centre moves from the payload box to the middle of the altitude
 * line, the radius grows until drone and ground fill `fill` of the frame height, and the elevation drops late (the
 * camera stays high while it swings round, so it never cuts through a ridge).
 */
export const ALTITUDE_CAMERA = {
  /** Final azimuth (deg, atan2(x, z) of camera minus centre): -90 = on -x, looking along +x. */
  azimuth: -90,
  /** Final elevation (deg). */
  elevation: 15, // looks down enough that the ridges rise behind the drone (user: drone lower, among the terrain)
  elevationPortrait: 15, // steeper sank the ground behind the drone into the fog on phones
  /**
   * Drone height (mast to skids) as a share of the frame height. Framed on the drone alone, so its size stays constant
   * while the ground slides under it (user, 2026-11-03: framing on the drone-to-ground span made the drone resize as
   * the terrain passed; and "make the drone smaller").
   */
  fill: 0.07,
  fillPortrait: 0.05,
  /** Where the drone's centre sits (NDC): left of centre, just above the middle (user: lower, among the ridges). */
  screen: new THREE.Vector2(-0.3, 0.06),
  screenPortrait: new THREE.Vector2(-0.24, 0.16),
};

const _centre = new THREE.Vector3();

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Moves `mover` (holding the finished payload pose) to the side view. `anchor` = payload box (the payload camera's
 * orbit centre), `centre` = the drone's centre without its hover (world), `droneH` = drone height (world). `t` = raw
 * stage weight 0..1.
 */
export function applyAltitudeCamera(
  mover: THREE.Object3D,
  anchor: THREE.Vector3,
  centre: THREE.Vector3,
  droneH: number,
  t: number,
  fov: number,
  aspect: number,
) {
  if (t <= 0) return;
  const eR = THREE.MathUtils.smootherstep(t, 0, 0.85); // radius + centre
  const eAz = THREE.MathUtils.smootherstep(t, 0, 0.8); // swing round
  const eEl = THREE.MathUtils.smootherstep(t, 0.3, 1); // drop late
  _rel.copy(mover.position).sub(anchor);
  const r0 = _rel.length();
  if (r0 < 1e-6) return;
  const az0 = Math.atan2(_rel.x, _rel.z);
  const el0 = Math.asin(THREE.MathUtils.clamp(_rel.y / r0, -1, 1));

  const portrait = aspect < 1;
  const tanV = Math.tan((fov / 2) * DEG);
  const r1 = Math.max(droneH, 0.05) / ((portrait ? ALTITUDE_CAMERA.fillPortrait : ALTITUDE_CAMERA.fill) * 2 * tanV);
  _centre.lerpVectors(anchor, centre, eR);

  const r = lerp(r0, r1, eR);
  const az = az0 + wrapAngle(ALTITUDE_CAMERA.azimuth * DEG - az0) * eAz;
  const el = lerp(el0, (portrait ? ALTITUDE_CAMERA.elevationPortrait : ALTITUDE_CAMERA.elevation) * DEG, eEl);
  _eye.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(r).add(_centre);

  _m.lookAt(_eye, _centre, UP);
  _q.setFromRotationMatrix(_m);
  // Screen offset: from the payload framing (t = 0, identical to applyPayloadCamera's end pose) to the side framing.
  const s0 = portrait ? PAYLOAD_CAMERA.screenPortrait : PAYLOAD_CAMERA.screen;
  const s1 = portrait ? ALTITUDE_CAMERA.screenPortrait : ALTITUDE_CAMERA.screen;
  const sx = lerp(s0.x, s1.x, eR);
  const sy = lerp(s0.y, s1.y, eR);
  _euler.set(-Math.atan(sy * tanV), Math.atan(sx * tanV * aspect), 0);
  _q.multiply(_off.setFromEuler(_euler));
  mover.position.copy(_eye);
  mover.quaternion.copy(_q);
}

/**
 * Route stage view (lib/payload.ts ROUTE_*; user 2026-11-03: the third scroll, the drone smaller in front of the `net`
 * section's terrain): from the finished altitude pose to the section camera's pose (scene/net-terrain.ts `pose`, which
 * is lined up with the altitude angle, so this is mostly a pull-back). The eye moves by the log-distance fraction (an
 * even zoom out, the drone holds its place early on), the orientation slerps on the same ease.
 */
const _eyeA = new THREE.Vector3();
const _qA = new THREE.Quaternion();
export function applyRouteCamera(mover: THREE.Object3D, eye: THREE.Vector3, quat: THREE.Quaternion, target: THREE.Vector3, t: number) {
  if (t <= 0) return;
  const e = THREE.MathUtils.smootherstep(t, 0, 1);
  _eyeA.copy(mover.position);
  _qA.copy(mover.quaternion);
  const dA = Math.max(_eyeA.distanceTo(target), 1e-3);
  const dN = Math.max(eye.distanceTo(target), 1e-3);
  const ratio = dN / dA;
  const f = Math.abs(ratio - 1) < 1e-3 ? e : (Math.pow(ratio, e) - 1) / (ratio - 1);
  mover.position.lerpVectors(_eyeA, eye, f);
  mover.quaternion.copy(_qA).slerp(quat, e);
}
