import * as THREE from "three";

/**
 * Light matched to the H00 environment plate (HeroPlate). Written by HeroPlate, read by MainScene (sun) and
 * RavenModel (environment). `weight` follows the plate's opacity: 1 = plate fully visible, 0 = live terrain.
 *
 * Measured from the plate (research/raven-film/h00/anchor-v1.png): shading runs along the screen vertical with lit
 * faces turned away from the camera, so the sun is high beyond the frame and a little left (late morning). Lit
 * ground reads warm, shadows cool green (blue sky fill plus forest bounce). The site's default environment is a
 * low-sun sunset HDRI over brown rock, which is what made the drone look pasted on.
 */
export const plateLight = {
  weight: 0,
  env: null as THREE.Texture | null,
  /** World direction towards the plate's sun. */
  sunDirection: new THREE.Vector3(0, 1, 0),
  /** Warm late-morning key, ~5200 K. */
  sunColor: new THREE.Color(1.0, 0.94, 0.85),
};

/** Sun placement relative to the hero camera: degrees left of the view heading, and elevation. */
export const PLATE_SUN = { azimuthLeft: 22, elevation: 48 };

/** Horizontal heading of a camera (unit XZ vector). Undefined when it looks straight down. */
export function cameraHeading(camera: THREE.Camera, out: THREE.Vector3) {
  const d = camera.getWorldDirection(out);
  if (Math.abs(d.y) > 0.97) return null;
  return d.setY(0).normalize();
}

/** World-space sun direction from a horizontal heading (the hero camera's; it stays fixed into the overhead view). */
export function plateSunDirection(forward: THREE.Vector3, out: THREE.Vector3) {
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const az = THREE.MathUtils.degToRad(PLATE_SUN.azimuthLeft);
  const el = THREE.MathUtils.degToRad(PLATE_SUN.elevation);
  return out
    .copy(forward)
    .multiplyScalar(Math.cos(az) * Math.cos(el))
    .addScaledVector(right, -Math.sin(az) * Math.cos(el))
    .setY(Math.sin(el))
    .normalize();
}

/**
 * Prefiltered environment for the plate: hazy daylight sky with the sun disc, and the plate's own terrain as the
 * ground hemisphere (oriented to the camera so the drone's underside reflects the valley it flies over).
 */
export function buildPlateEnvironment(
  gl: THREE.WebGLRenderer,
  heading: THREE.Vector3,
  ground: THREE.Texture,
  sun: THREE.Vector3,
) {
  const forward = heading.clone();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      ground: { value: ground },
      sun: { value: sun.clone() },
      forward: { value: forward },
      right: { value: right },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D ground;
      uniform vec3 sun, forward, right;
      varying vec3 vDir;
      // Linear radiance. Haze measured from the plate's far strip; sky is a pale, hazy late-morning blue.
      const vec3 HAZE = vec3(0.30, 0.36, 0.38);
      const vec3 ZENITH = vec3(0.10, 0.19, 0.38);
      const vec3 SUN = vec3(1.0, 0.94, 0.85);
      void main() {
        vec3 d = normalize(vDir);
        vec3 c;
        if (d.y >= 0.0) {
          c = mix(HAZE, ZENITH, pow(d.y, 0.55));
        } else {
          // Ground seen from altitude: project onto the ground plane in camera-heading axes.
          vec2 p = vec2(dot(d, right), dot(d, forward)) / max(-d.y, 0.08);
          vec2 uv = clamp(p * 0.28 + 0.5, 0.0, 1.0);
          vec3 g = texture2D(ground, uv).rgb;
          // Terrain lit by the same sun + sky (the plate already holds that light): keep its level.
          c = mix(HAZE * 0.9, g * 1.1, smoothstep(0.0, 0.22, -d.y));
        }
        float mu = max(dot(d, sun), 0.0);
        c += SUN * (0.35 * pow(mu, 8.0) + 1.2 * pow(mu, 96.0)); // aureole
        c += SUN * 80.0 * smoothstep(0.99985, 0.99995, mu);    // disc (~0.6 deg)
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const scene = new THREE.Scene();
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), material);
  scene.add(sphere);
  const pmrem = new THREE.PMREMGenerator(gl);
  const target = pmrem.fromScene(scene, 0, 0.1, 100);
  pmrem.dispose();
  sphere.geometry.dispose();
  material.dispose();
  return target;
}
