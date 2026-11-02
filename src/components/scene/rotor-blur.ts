import * as THREE from "three";
import { RENDER_ORDER } from "@/lib/constants";
import type { RavenRotor } from "./raven-rotors";
import { sunlight } from "./sunlight";

/**
 * Motion-blurred props. At flight rpm a 60 Hz frame cannot show the blades: spinning the meshes faster only aliases
 * (wagon-wheel: slow, frozen or backwards). Like a camera exposure, each rotor instead shows a translucent disc while
 * its `PROP_*` blade/tip meshes are hidden (the hub stays). What makes the disc read as separate fast blades:
 *  - two smeared blade images with a crisp leading edge and a long trailing tail, swept at a controlled visible rate
 *    in the rotor's own spin direction (never wagon-wheels);
 *  - sun flash: every disc point is shaded as a pitched, twisted blade lit by the live sun (sunlight.ts) and seen
 *    from the camera, so the glint sits where real props flash, shifts as the aircraft banks, and pulses as each blade
 *    image sweeps through it;
 *  - the painted yellow tips leave a faint ring.
 */
const BLADE_MATERIAL = /^PROP_/;
/**
 * Visible sweep of the blade images (rad/s). Real rpm is far above what 60 Hz can show. 26 since 2026-11-03 (user:
 * "increase the speed of the rotors"; was 13): 0.43 rad per frame at 60 Hz, under half the two-blade period (PI), so
 * the sweep never strobes or appears to run backwards.
 */
const IMAGE_SPEED = 26;
const _box = new THREE.Box3();
const _inverse = new THREE.Matrix4();
const _local = new THREE.Matrix4();

const time = { value: 0 };
let geometry: THREE.CircleGeometry | null = null;

const vertexShader = /* glsl */ `
varying vec2 vDisc;
varying vec3 vWorld;
varying vec3 vAxis;
varying vec3 vCentre;
void main() {
  vDisc = position.xz; // unit disc in the prop plane
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vAxis = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
  vCentre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uDirection; // +1 CCW / -1 CW about the shaft, viewed from above
uniform float uPhase;
uniform float uSpeed; // per-rotor multiplier on the sweep speed
uniform vec3 uSun;        // towards the sun, world space
uniform float uShade;     // 1 clear sun, ~0.7 under cloud
varying vec2 vDisc;
varying vec3 vWorld;
varying vec3 vAxis;
varying vec3 vCentre;
const float PI = 3.14159265;

float band(float a, float b, float x) { return smoothstep(a, b, x); }

void main() {
  float r = length(vDisc);
  if (r > 1.0) discard;
  float span = band(0.07, 0.15, r) * (1.0 - band(0.95, 1.0, r));
  float chord = 1.0 - 0.45 * r; // blades narrow toward the tip: less smear per area

  // Two blade images. Angle measured along the direction of travel; lead = how far a point is behind a blade.
  float ang = atan(-vDisc.y, vDisc.x) * uDirection;
  float sweep = uTime * ${IMAGE_SPEED.toFixed(1)} * uSpeed + uPhase;
  float lead = mod(sweep - ang, PI); // 0 at a blade, grows behind it (two blades: period PI)
  // Crisp front, long tail; the tail is longer at the faster sweep (2.4, was 3.4) so the speed reads as motion blur.
  float image = exp(-lead * 2.4) * band(0.0, 0.05, lead) + exp(-(PI - lead) * 16.0);
  float presence = clamp(image, 0.0, 1.0);

  // Sun flash. A twisted, cambered blade offers surface normals tilted 0.15-0.75 rad against its travel somewhere
  // along its length; the flash appears at the azimuths where one of them mirrors the sun into the camera, so it
  // reads as a streak along the blade (oblique views) or a narrow sector (from above), never a uniform sheen.
  vec3 radial = normalize(vWorld - vCentre - vAxis * dot(vWorld - vCentre, vAxis));
  vec3 travel = normalize(cross(vAxis, radial)) * uDirection;
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 h = normalize(normalize(uSun) + v);
  if (dot(h, vAxis) < 0.0) h = -h; // seen from below: mirror about the disc
  float tilt = atan(-dot(h, travel), dot(h, vAxis));
  float pitch = clamp(tilt, 0.15, 0.75);
  vec3 n = vAxis * cos(pitch) - travel * sin(pitch);
  float err = max(acos(clamp(dot(n, h), -1.0, 1.0)) - 0.05, 0.0);
  float glint = exp(-err * err * 320.0) * 3.2 * uShade;
  glint *= band(0.18, 0.4, r) * (1.0 - band(0.86, 0.95, r)); // along the blade, not on hub or tip paint
  glint *= 0.05 + 0.95 * presence;                             // the light rides on each blade as it sweeps through

  // Blur body: dark carbon smear, denser where a blade image is.
  float smear = span * chord * (0.09 + 0.5 * presence);
  vec3 col = vec3(0.012, 0.013, 0.015);
  // Painted tips leave a faint warm ring.
  float tip = band(0.88, 0.92, r) * (1.0 - band(0.96, 1.0, r)) * (0.1 + 0.12 * presence);
  col = mix(col, vec3(0.8, 0.5, 0.03), tip / max(smear + tip, 1e-4));

  vec3 sun = vec3(1.0, 0.96, 0.88);
  float alpha = clamp(smear + tip + glint * 0.6, 0.0, 1.0);
  vec3 lit = (col * (smear + tip) + sun * glint) / max(alpha, 1e-4);
  gl_FragColor = vec4(min(lit, vec3(4.0)), alpha);
}`;

export type RotorBlur = { blades: THREE.Object3D[]; discs: THREE.Mesh[]; materials: THREE.ShaderMaterial[] };

/**
 * Adds one blur disc per rotor, sized to the measured blade tips. The disc hangs off the rotor's parent at the
 * pivot's rest transform, so the real (aliasing) rotor spin never turns it; the shader animates the blade images.
 */
export function attachRotorBlur(root: THREE.Object3D, rotors: RavenRotor[]): RotorBlur {
  const disc0 = (geometry ??= new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2)); // prop plane (shaft = local +Y)
  const blades: THREE.Object3D[] = [];
  const discs: THREE.Mesh[] = [];
  const materials: THREE.ShaderMaterial[] = [];
  root.updateMatrixWorld(true);
  rotors.forEach(({ object: pivot, direction }, i) => {
    let radius = 0;
    let plane = 0;
    _inverse.copy(pivot.matrixWorld).invert();
    pivot.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const names = (Array.isArray(child.material) ? child.material : [child.material]).map((m) => m.name);
      if (!names.some((n) => BLADE_MATERIAL.test(n))) return;
      blades.push(child);
      child.geometry.computeBoundingBox();
      _box.copy(child.geometry.boundingBox!).applyMatrix4(_local.multiplyMatrices(_inverse, child.matrixWorld));
      radius = Math.max(radius, -_box.min.x, _box.max.x, -_box.min.z, _box.max.z);
      plane = (_box.min.y + _box.max.y) / 2;
    });
    if (radius === 0 || !pivot.parent) return;
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: time,
        uSun: { value: sunlight.direction },
        uShade: { value: 1 },
        uDirection: { value: direction },
        // Random per rotor and per drone instance (user, 2026-11-02: the three drones flashed in step): own phase and
        // a sweep speed within +-15%, so no two rotors or drones line up for long.
        uPhase: { value: i * 1.9 + Math.random() * Math.PI * 2 },
        uSpeed: { value: 0.85 + Math.random() * 0.3 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const anchor = new THREE.Group();
    anchor.name = `${pivot.name}_blur`;
    anchor.position.copy(pivot.position);
    anchor.quaternion.copy(pivot.quaternion);
    anchor.scale.copy(pivot.scale);
    const disc = new THREE.Mesh(disc0, material);
    disc.scale.setScalar(radius);
    disc.position.y = plane;
    disc.renderOrder = RENDER_ORDER.HERO_DRONE;
    disc.frustumCulled = false;
    anchor.add(disc);
    pivot.parent.add(anchor);
    discs.push(disc);
    materials.push(material);
  });
  return { blades, discs, materials };
}

/** Spinning: discs on, blades off. Still (reduced motion): the real blades. */
export function setRotorBlur({ blades, discs }: RotorBlur, spinning: boolean) {
  for (const blade of blades) blade.visible = !spinning;
  for (const disc of discs) disc.visible = spinning;
}

/** Per frame: shared sweep clock (idempotent across instances) and the passing-cloud shade. */
export function updateRotorBlur({ materials }: RotorBlur, elapsed: number) {
  time.value = elapsed;
  for (const m of materials) m.uniforms.uShade.value = sunlight.shade * sunlight.strength;
}
