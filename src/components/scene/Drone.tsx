"use client";

import { useFrame } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import { DRONE_LAYER, RENDER_ORDER } from "@/lib/constants";
import { payloadLook } from "@/lib/payload";
import { damp } from "@/lib/math";
import { useMediaQuery } from "@/lib/use-media-query";
import { useGLB } from "./types";
import { collectRavenRotors, advanceRavenRotors } from "./raven-rotors";
import { attachRotorBlur, rotorBlurVector, setRotorBlur, updateRotorBlur } from "./rotor-blur";
import { plateLight } from "./plate-light";
import { HERO_LIGHT, heroLight } from "./hero-light";
import { sunlight } from "./sunlight";

const ENV_INTENSITY = 0.85;
/** Surfaces that flash when a facet lines up with the sun (body carbon, chassis, medical box, blades). */
const GLINT_MATERIALS = /^(REF_Carbon|REF_Plastic_Graphite|MED_Chassis_Charcoal|MED_Box_White|PROP_Blade_DarkGrey)$/;
/** Shell facet normals in model space (top plateau, shoulders, nose/tail rakes; glTF Y up). */
const FACETS = [
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0.6, 0.8, 0),
  new THREE.Vector3(-0.6, 0.8, 0),
  new THREE.Vector3(0, 0.75, 0.66),
  new THREE.Vector3(0, 0.75, -0.66),
].map((v) => v.normalize());
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _h = new THREE.Vector3();

type LiveMaterial = { material: THREE.MeshStandardMaterial; coat: number; glints: boolean };

/**
 * Raven adapter: only the visual child changes; shipped flight/camera trackers stay intact.
 * Reduced motion parks the rotors and shows the real blades.
 */
const DRONE_MAP_KEYS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "clearcoatNormalMap"];
/** 8 is the widely supported maximum (three clamps to the GPU limit). */
const DRONE_ANISOTROPY = 8;

/** Model size across its widest axis, in tracker units. */
const SPAN = 200;

/**
 * Raven payload stage (lib/payload.ts, user 2026-11-03: "change the drone into vectorise", after the reference's flock
 * drones): flat light-grey facets with white outlines on the black clay view. It replaces the lit colour in the drone's
 * own materials (no second model), sweeping top -> bottom with a thin scan line, so the same airframe changes form.
 * The medical box (`MED_Box*` materials) turns the yellow token when the payload is highlighted.
 */
const PAYLOAD_MATERIALS = /^MED_Box/;
const VECTOR_LOOK = {
  light: new THREE.Color("#e6e8eb"),
  dark: new THREE.Color("#4a4f55"),
  payload: new THREE.Color("#ffcb47"), // yellow token
  line: new THREE.Color("#ffffff"),
  scan: new THREE.Color("#bff4ff"),
};
/** Outline crease angle (deg): silhouette-defining edges only, not the tessellation of round parts. */
const EDGE_ANGLE = 32;
/** Outlines per source geometry (clones share geometry, so the three drones share these). */
const edgeCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();

type VectorUniforms = {
  uVector: { value: number };
  uHighlight: { value: number };
  uVecMinY: { value: number };
  uVecSpanY: { value: number };
};

const VECTOR_COMMON = /* glsl */ `
uniform float uVector;
uniform float uHighlight;
uniform float uVecMinY;
uniform float uVecSpanY;
uniform float uIsPayload;
uniform vec3 uVecLight;
uniform vec3 uVecDark;
uniform vec3 uVecPayload;
uniform vec3 uVecScan;
varying float vVecY;
// 1 above the sweep front (vector form), 0 below; the front runs from the top of the airframe to the bottom.
float vecFront() { return mix(1.08, -0.08, smoothstep(0.0, 1.0, uVector)); }
float vecMask(float h) { float f = vecFront(); return smoothstep(f - 0.035, f + 0.035, h); }
float vecScan(float h) { return exp(-pow((h - vecFront()) / 0.012, 2.0)) * step(0.001, uVector) * (1.0 - step(0.999, uVector)); }
`;

/** Patches a cloned drone material with the vector form (per-instance uniforms, per-material payload flag). */
function vectorise(material: THREE.MeshStandardMaterial, u: VectorUniforms) {
  const isPayload = PAYLOAD_MATERIALS.test(material.name) ? 1 : 0;
  // Faces sit a hair behind their outlines (no z-fighting with the edge lines); invisible otherwise.
  material.polygonOffset = true;
  material.polygonOffsetFactor = 1;
  material.polygonOffsetUnits = 1;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, {
      uIsPayload: { value: isPayload },
      uVecLight: { value: VECTOR_LOOK.light },
      uVecDark: { value: VECTOR_LOOK.dark },
      uVecPayload: { value: VECTOR_LOOK.payload },
      uVecScan: { value: VECTOR_LOOK.scan },
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vVecY;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvVecY = (modelMatrix * vec4(transformed, 1.0)).y;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${VECTOR_COMMON}`).replace(
      "#include <tonemapping_fragment>",
      /* glsl */ `
if (uVector > 0.0) {
  // Facet normal from the surface itself: flat low-poly shading whatever the mesh's smooth normals.
  vec3 fN = normalize(cross(dFdx(-vViewPosition), dFdy(-vViewPosition)));
  if (dot(fN, vViewPosition) < 0.0) fN = -fN;
  float lam = clamp(dot(fN, normalize(vec3(-0.35, 0.75, 0.55))), 0.0, 1.0);
  float rim = pow(1.0 - clamp(dot(fN, normalize(vViewPosition)), 0.0, 1.0), 3.0);
  vec3 vcol = mix(uVecDark, uVecLight, lam) + uVecLight * rim * 0.12;
  vcol = mix(vcol, uVecPayload * (0.5 + 0.65 * lam) + uVecPayload * rim * 0.3, uIsPayload * uHighlight);
  float h = clamp((vVecY - uVecMinY) / max(uVecSpanY, 1e-4), 0.0, 1.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vcol, vecMask(h)) + uVecScan * vecScan(h) * 1.4;
}
#include <tonemapping_fragment>`,
    );
  };
  material.customProgramCacheKey = () => "raven-vector";
}

/** Outline material for one instance (white; yellow on the payload box when highlighted). */
function edgeMaterial(u: VectorUniforms, payload: boolean) {
  return new THREE.ShaderMaterial({
    name: payload ? "RavenVectorEdgePayload" : "RavenVectorEdge",
    uniforms: {
      ...u,
      uIsPayload: { value: payload ? 1 : 0 },
      uVecLight: { value: VECTOR_LOOK.line },
      uVecDark: { value: VECTOR_LOOK.dark },
      uVecPayload: { value: VECTOR_LOOK.payload },
      uVecScan: { value: VECTOR_LOOK.scan },
    },
    vertexShader: /* glsl */ `
varying float vVecY;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vVecY = w.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
${VECTOR_COMMON}
void main() {
  float h = clamp((vVecY - uVecMinY) / max(uVecSpanY, 1e-4), 0.0, 1.0);
  float a = vecMask(h) * 0.9;
  if (a <= 0.002) discard;
  vec3 c = mix(uVecLight, uVecPayload * 1.15, uIsPayload * uHighlight);
  gl_FragColor = vec4(c, a);
}`,
    transparent: true,
    depthWrite: false,
  });
}

export function RavenModel({ envMap }: { envMap?: THREE.Texture }) {
  const { scene } = useGLB(ASSETS.raven);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const spin = !reducedMotion;
  const glint = useRef(0);
  const { object, rotors, blur, ownedMaterials, live, envRotation, vector, edges, yRange, scale } = useMemo(() => {
    const object = scene.clone(true);
    const rotors = collectRavenRotors(object);
    const ownedMaterials: THREE.Material[] = [];
    const live: LiveMaterial[] = [];
    // One rotation shared by this instance's materials; uniforms read it every render.
    const envRotation = new THREE.Euler();
    const vector: VectorUniforms = { uVector: { value: 0 }, uHighlight: { value: 0 }, uVecMinY: { value: 0 }, uVecSpanY: { value: 1 } };
    const edgeMats = [edgeMaterial(vector, false), edgeMaterial(vector, true)];
    const edges: THREE.LineSegments[] = [];
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.renderOrder = RENDER_ORDER.HERO_DRONE;
      // Self-shadowing: arms, deck and props shade the box and gear (terrain is unlit and never receives).
      child.castShadow = child.receiveShadow = true;
      const copy = (source: THREE.Material) => {
        const material = source.clone();
        // Anisotropic filtering on every map (GLTFLoader leaves 1): the oblique hero/tilt views minified the decals and
        // panel maps into shimmer (user 2026-11-03: "no pixelation should happen with the drone"). Textures are shared
        // between clones, so this only re-uploads them once.
        for (const key of DRONE_MAP_KEYS) {
          const tex = (material as unknown as Record<string, THREE.Texture | null | undefined>)[key];
          if (tex && tex.anisotropy !== DRONE_ANISOTROPY) {
            tex.anisotropy = DRONE_ANISOTROPY;
            tex.needsUpdate = true;
          }
        }
        if (material instanceof THREE.MeshStandardMaterial && envMap) {
          material.envMap = envMap;
          material.envMapIntensity = ENV_INTENSITY;
          material.envMapRotation = envRotation;
          const coat = material instanceof THREE.MeshPhysicalMaterial ? material.clearcoat : 0;
          live.push({ material, coat, glints: GLINT_MATERIALS.test(material.name) });
        }
        if (material instanceof THREE.MeshStandardMaterial) vectorise(material, vector);
        ownedMaterials.push(material);
        return material;
      };
      child.material = Array.isArray(child.material) ? child.material.map(copy) : copy(child.material);
      // Vector outlines: only on the drone layer (the bodies are drawn there, PostFX), shown during the payload stage.
      let edge = edgeCache.get(child.geometry);
      if (!edge) edgeCache.set(child.geometry, (edge = new THREE.EdgesGeometry(child.geometry, EDGE_ANGLE)));
      const names = (Array.isArray(child.material) ? child.material : [child.material]).map((m) => m.name);
      const lines = new THREE.LineSegments(edge, edgeMats[names.some((n) => PAYLOAD_MATERIALS.test(n)) ? 1 : 0]);
      lines.layers.set(DRONE_LAYER);
      lines.renderOrder = RENDER_ORDER.HERO_DRONE + 1;
      lines.visible = false;
      lines.name = `${child.name}_vector`;
      lines.userData.parent = child;
      edges.push(lines);
    });
    // Added after the traverse (adding children while traversing would visit them).
    for (const lines of edges) lines.userData.parent?.add(lines);
    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    ownedMaterials.push(...edgeMats);
    // After the material pass: blur discs keep their own shader and cast no shadow.
    const blur = attachRotorBlur(object, rotors);
    ownedMaterials.push(...blur.materials);
    const yRange = [bounds.min.y, bounds.max.y] as const; // model units (glTF Y up; the 180 deg yaw keeps Y)
    return { object, rotors, blur, ownedMaterials, live, envRotation, vector, edges, yRange, scale: SPAN / Math.max(size.x, size.z) };
  }, [scene, envMap]);
  useEffect(() => () => ownedMaterials.forEach((material) => material.dispose()), [ownedMaterials]);
  // Still rotors (reduced motion) show the real blades instead of the blur.
  useEffect(() => setRotorBlur(blur, spin), [blur, spin]);
  useFrame(({ camera, clock }, dt) => {
    // Payload stage: vector sweep over this instance's world height (airframe top -> bottom), payload highlight.
    const look = payloadLook();
    vector.uVector.value = look.vector;
    vector.uHighlight.value = look.highlight;
    rotorBlurVector.value = look.vector;
    const showEdges = look.vector > 0;
    if (showEdges) {
      object.getWorldPosition(_p);
      const s = object.getWorldScale(_n).y;
      vector.uVecMinY.value = _p.y + yRange[0] * s;
      vector.uVecSpanY.value = (yRange[1] - yRange[0]) * s;
    }
    if (edges[0] && edges[0].visible !== showEdges) for (const e of edges) e.visible = showEdges;
    if (spin) {
      advanceRavenRotors(rotors, dt);
      updateRotorBlur(blur, clock.getElapsedTime());
    }
    if (!live.length) return;
    // Over the H00 plate, reflect the plate-matched sky and terrain instead of the default sunset HDRI.
    const plateEnv = plateLight.weight > 0.5 ? plateLight.env : null;
    const wantEnv = plateEnv ?? envMap ?? null;
    if (live[0].material.envMap !== wantEnv) for (const { material } of live) material.envMap = wantEnv;
    // Sky/sun reflections follow the travel-driven heading (sunlight.ts) so highlights slide while flying.
    envRotation.set(sunlight.pitch, sunlight.heading, 0);
    // Hero preset (hero-light.ts): HDRI turned to the panel's yaw/tilt/roll.
    const h = heroLight.weight;
    if (h > 0) {
      envRotation.x += (heroLight.envRotation.x - envRotation.x) * h;
      envRotation.y += (heroLight.envRotation.y - envRotation.y) * h;
      envRotation.z += (heroLight.envRotation.z - envRotation.z) * h;
    }
    // Sun glint: brief flare when a shell facet's half-vector (sun, camera) lines up as the aircraft banks.
    let target = 0;
    if (!reducedMotion) {
      object.getWorldQuaternion(_q);
      object.getWorldPosition(_p);
      _h.copy(camera.position).sub(_p).normalize().add(sunlight.direction).normalize();
      let align = 0;
      for (const facet of FACETS) align = Math.max(align, _n.copy(facet).applyQuaternion(_q).dot(_h));
      target = smoothstep(Math.cos(0.3), Math.cos(0.1), align); // ramps in from 17° to 6° off-mirror
      target *= sunlight.shade > 0.85 ? 1 : 0.3; // no strong glints under cloud
      target *= sunlight.strength; // no sun, no glint (hero preset)
    }
    glint.current = damp(glint.current, target, target > glint.current ? 14 : 4, dt);
    // Under cloud the sky still reflects, so environment dims less than direct sun.
    // The plate sky is a softer, broader source than the HDRI's clipped sun: lift its fill a little.
    const env =
      ENV_INTENSITY *
      (0.8 + 0.2 * sunlight.shade) *
      (1 + 0.3 * plateLight.weight) *
      (1 + (HERO_LIGHT.environment.intensity - 1) * h);
    for (const { material, coat, glints } of live) {
      material.envMapIntensity = env + (glints ? 0.45 * glint.current : 0);
      if (glints && material instanceof THREE.MeshPhysicalMaterial) material.clearcoat = coat + 0.35 * glint.current;
    }
  });
  // The hexa faces +Z (front props at +Z); the original rig's nose points -Z. Body centre sits on the tracker origin.
  return <primitive object={object} rotation={[0, Math.PI, 0]} scale={scale} dispose={null} />;
}

export const Drone = forwardRef<THREE.Group, { envMap: THREE.Texture }>(function Drone({ envMap }, ref) {
  const root = useRef<THREE.Group>(null);
  useImperativeHandle(ref, () => root.current!);
  return <group ref={root}><RavenModel envMap={envMap} /></group>;
});

useGLB.preload(ASSETS.raven);
