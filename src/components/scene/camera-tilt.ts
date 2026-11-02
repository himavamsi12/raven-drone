import * as THREE from "three";

/**
 * Oblique camera for the overhead chapters (user, 2026-11-02: Airframe and Connection should look like the Route
 * angle, from behind and above the drone, not straight down; then: the hero -> Airframe move must be seamless).
 *
 * The shipped clips are kept. After they are applied, the camera's elevation above the hero drone is capped with a
 * smooth ceiling: below TILT_START it is the clip's own (the hero sits at ~33 deg, untouched); above it the excess
 * eases out toward TILT_ELEVATION (C1 continuous, never pitches back). Distance and orbit direction stay the clip's,
 * and the pose is rebuilt on that orbit (no straight-line blend, which cut inside the orbit and bumped the pitch).
 * The cap stays on through Prepare and fades out during the Journey map transition (gate from DroneRig).
 * `cameraTilt.weight` (0 -> 1 as the clip goes from TILT_START to ~75 deg) drives the drone-focus effects (size,
 * blur, shadow) along the same curve.
 */
export const TILT_START = THREE.MathUtils.degToRad(35);
export const TILT_ELEVATION = THREE.MathUtils.degToRad(40);
const FOCUS_END = THREE.MathUtils.degToRad(75);
export const cameraTilt = { weight: 0 };

const UP = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _h = new THREE.Vector3();
const _target = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _level = new THREE.Vector3();
const _cross = new THREE.Vector3();
const _newFwd = new THREE.Vector3();
const _newUp = new THREE.Vector3();

/** Clip elevation -> capped elevation: identity below TILT_START, then an exponential ease to TILT_ELEVATION. */
function capElevation(el: number) {
  if (el <= TILT_START) return el;
  const room = TILT_ELEVATION - TILT_START;
  return TILT_START + room * (1 - Math.exp(-(el - TILT_START) / room));
}

/** mover: the camera mover (world-space group) already holding the clip pose. drone: hero drone world position. */
export function applyCameraTilt(mover: THREE.Object3D, drone: THREE.Vector3, gate: number) {
  _fwd.set(0, 0, -1).applyQuaternion(mover.quaternion);
  const clipEl = Math.asin(THREE.MathUtils.clamp(-_fwd.y, -1, 1));
  const focus = THREE.MathUtils.smoothstep(clipEl, TILT_START, FOCUS_END);
  cameraTilt.weight = focus * gate;
  if (clipEl <= TILT_START || gate <= 0.0001) return;

  // Aim point: closest point on the view ray to the drone; orbit radius = clip distance to it.
  _target.copy(drone).sub(mover.position);
  const t = Math.max(_target.dot(_fwd), 0.1);
  _target.copy(mover.position).addScaledVector(_fwd, t);
  const r = t;
  // Orbit direction: the clip's own view heading, so the rebuilt pose equals the clip pose where the cap starts (the
  // clip has slight roll: mixing in screen-up there made the camera jump sideways, user: "still a jitter"). Only as the
  // view nears straight down, where the heading vanishes, does screen-up take over (weight sin(el)^12: 0.001 at 35
  // deg, 1 at 90).
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(mover.quaternion);
  const k = Math.pow(Math.sin(clipEl), 12);
  _h.set(_fwd.x + up.x * k, 0, _fwd.z + up.z * k);
  if (_h.lengthSq() < 1e-8) return;
  _h.normalize();

  const el = clipEl + (capElevation(clipEl) - clipEl) * gate;
  _eye.copy(_target).addScaledVector(_h, -r * Math.cos(el)).addScaledVector(UP, r * Math.sin(el));

  // Keep the clip's roll (~2 deg in Camera01): a level look-at snapped it away in one frame where the cap engaged
  // (2.2 deg rotation step, user: "still a jitter"). Roll = signed angle from the level up to the clip's up about the
  // view axis; it is re-applied about the new view axis. Near straight down the level up is undefined, but there the
  // heading already comes from the clip's screen-up, so the roll fades out with the same weight k.
  _level.copy(UP).addScaledVector(_fwd, -_fwd.dot(UP));
  let roll = 0;
  if (_level.lengthSq() > 1e-6) {
    _level.normalize();
    roll = Math.atan2(_cross.crossVectors(_level, up).dot(_fwd), _level.dot(up)) * (1 - k);
  }
  _newFwd.copy(_target).sub(_eye).normalize();
  _newUp.copy(UP).addScaledVector(_newFwd, -_newFwd.dot(UP)).normalize().applyAxisAngle(_newFwd, roll);
  _m.lookAt(_eye, _target, _newUp);
  mover.position.copy(_eye);
  mover.quaternion.setFromRotationMatrix(_m);
}
