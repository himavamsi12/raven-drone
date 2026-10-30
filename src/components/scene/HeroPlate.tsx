"use client";

import { useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { remap } from "@/lib/math";
import { RENDER_ORDER } from "@/lib/constants";
import { SCENE, scenes } from "@/lib/scenes";
import { buildPlateEnvironment, cameraHeading, plateLight, plateSunDirection } from "./plate-light";

/**
 * Prototype (RAVEN_ENVIRONMENT_FILM_SEEDANCE_PROMPT.md): Seedance environment plates drawn behind the drones, opt-in
 * with `?plate=h00`. Three clips of one continuous flight over the same valley (sources: research/raven-film/):
 *  - hero (H00): time-driven seamless loop while the visitor has not scrolled;
 *  - airframe (S01): the camera tilt from the hero's 33 deg oblique view to straight down, scrubbed by scroll so it
 *    follows the live camera (DELTA_DRONE progress -> measured camera pitch -> clip time); a flow-map drift keeps the
 *    ground moving when scrolling stops;
 *  - connection (S02): straight-down travel past the health centre, played from its first frame when the tilt ends,
 *    then looping a later stretch (no health centre in the loop, so no building repeats).
 * The plate fades back to the live terrain at the end of SWARM_SCENE. Screen-space cover fit, so steering/boost do
 * not move it. The shader adds depth on oblique views (parallax shear, near motion blur, far softness, aerial haze).
 */
export const PLATE = {
  hero: "/assets/video/raven-h00-loop.mp4",
  /** All-intra encode: every frame is a keyframe so scroll seeks are immediate. */
  airframe: "/assets/video/raven-s01-airframe.mp4",
  connection: "/assets/video/raven-s02-connection.mp4",
  /** Blurred hero anchor: the ground hemisphere the drone reflects (plate-light.ts). */
  ground: "/assets/video/raven-h00-ground.png",
};
const AIRFRAME_DURATION = 8;
/** Connection clip: loops [start, end) after its first pass; end of file blends into the start frame (baked). */
const CONNECTION_LOOP = { start: 5.5, end: 12.0417 };

/** Live camera pitch (deg below horizontal) against DELTA_DRONE progress, sampled at 1280x720. */
const PITCH: [number, number][] = [
  [0, 33.4], [0.1, 33.8], [0.2, 36.7], [0.3, 42.4], [0.4, 51.8], [0.5, 63.5],
  [0.6, 74.5], [0.7, 82.3], [0.8, 87.0], [0.9, 89.3], [1, 90],
];
function pitchAt(p: number) {
  for (let i = 1; i < PITCH.length; i++) {
    const [p1, v1] = PITCH[i];
    const [p0, v0] = PITCH[i - 1];
    if (p <= p1) return v0 + ((v1 - v0) * (p - p0)) / (p1 - p0);
  }
  return 90;
}
/** 0 = hero oblique (33.4 deg), 1 = straight down. The airframe clip tilts at an even rate over its 8 s. */
const tiltAt = (p: number) => THREE.MathUtils.clamp((pitchAt(p) - 33.4) / (90 - 33.4), 0, 1);

/** Screen flow of the terrain (deg, x right / y up), measured: hero -146 deg (up-left), overhead -90 deg mapped to up. */
const HERO_FLOW = THREE.MathUtils.degToRad(146);
const OVERHEAD_FLOW = THREE.MathUtils.degToRad(90);
const flowDir = (tilt: number, out: THREE.Vector2) => {
  const a = THREE.MathUtils.lerp(HERO_FLOW, OVERHEAD_FLOW, tilt);
  return out.set(Math.cos(a), Math.sin(a));
};

export function heroPlateEnabled() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("plate") === "h00";
}

function makeVideo(src: string, loop: boolean) {
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.loop = loop;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace; // same decode as the terrain maps
  return { video, texture };
}

type LayerUniforms = { flow: THREE.Vector2; shear: number; drift: number; oblique: number };
const layer = (): LayerUniforms => ({ flow: new THREE.Vector2(), shear: 0, drift: 0, oblique: 0 });

export function HeroPlate() {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const ground = useTexture(PLATE.ground, (t) => {
    const tex = Array.isArray(t) ? t[0] : t;
    tex.colorSpace = THREE.SRGBColorSpace;
  });
  const envTarget = useRef<THREE.WebGLRenderTarget | null>(null);
  const heading = useRef<THREE.Vector3 | null>(null);
  const frames = useRef(0);
  const connectionStarted = useRef(false);

  const { clips, material } = useMemo(() => {
    const clips = {
      hero: makeVideo(PLATE.hero, true),
      airframe: makeVideo(PLATE.airframe, false),
      connection: makeVideo(PLATE.connection, false),
    };
    const a = layer();
    const b = layer();
    const material = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      // Stay in the opaque list so render order keeps it under the (opaque) drone; custom blending still fades it.
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        mapA: { value: clips.hero.texture },
        mapB: { value: clips.airframe.texture },
        mixAB: { value: 0 },
        opacity: { value: 1 },
        cover: { value: new THREE.Vector2(1, 1) },
        time: { value: 0 },
        flowA: { value: a.flow },
        flowB: { value: b.flow },
        // x shear, y drift, z oblique
        paramsA: { value: new THREE.Vector3() },
        paramsB: { value: new THREE.Vector3() },
      },
      vertexShader: /* glsl */ `
        uniform vec2 cover;
        varying vec2 vUv;
        varying vec2 vScreen;
        void main() {
          // 0.92: margin so the parallax shear and drift never sample past the frame edge.
          vUv = (uv - 0.5) * cover * 0.92 + 0.5;
          vScreen = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D mapA, mapB;
        uniform float mixAB, opacity, time;
        uniform vec2 flowA, flowB;
        uniform vec3 paramsA, paramsB;
        varying vec2 vUv;
        varying vec2 vScreen;

        const float ASPECT = 16.0 / 9.0;
        const float PHASE = 2.4;

        vec3 tap(sampler2D map, vec2 uv) { return texture2D(map, clamp(uv, 0.001, 0.999)).rgb; }

        vec3 shade(sampler2D map, vec2 uv, float near, float far, vec2 dir) {
          // Directional motion blur along the travel, longer for nearer (faster) ground.
          float len = mix(0.0008, 0.0038, near * near);
          vec3 c = vec3(0.0);
          for (int i = 0; i < 12; i++) c += tap(map, uv + dir * len * (float(i) / 11.0 - 0.5));
          c /= 12.0;
          // Distance softness: a light disc blur toward the far ground (atmospheric depth, not tilt-shift).
          float r = 0.0016 * far * far;
          vec3 soft = c;
          for (int i = 0; i < 8; i++) {
            float a = 6.2831853 * float(i) / 8.0;
            soft += tap(map, uv + vec2(cos(a), sin(a) * ASPECT) * r);
          }
          return mix(c, soft / 9.0, far);
        }

        // One clip. params: x = parallax shear (oblique only), y = drift speed (width/s, scrubbed clip only),
        // z = how oblique the view is (1 hero, 0 straight down): depth cues fade out toward the vertical view.
        vec3 plate(sampler2D map, vec2 flow, vec3 params) {
          float far = smoothstep(0.15, 1.0, vScreen.y) * params.z;
          float near = mix(0.5, 1.0 - far, params.z);
          vec2 dir = vec2(flow.x, flow.y * ASPECT);
          // Shear (near ground faster) and drift (keeps a scrubbed frame moving) would grow forever, so they run as two
          // flow-map phases half a period apart, each faded out as it resets.
          float speed = params.x * (0.5 - vScreen.y) + params.y;
          float s0 = fract(time / PHASE);
          float s1 = fract(time / PHASE + 0.5);
          float w0 = 1.0 - abs(2.0 * s0 - 1.0);
          vec3 c = mix(shade(map, vUv - dir * speed * (s1 - 0.5) * PHASE, near, far, dir),
                       shade(map, vUv - dir * speed * (s0 - 0.5) * PHASE, near, far, dir), w0);
          // Deepen the plate so the hero cloud layer on top does not wash it out.
          c = pow(c, vec3(1.3)) * 0.9;
          // Aerial perspective: far ground loses contrast and shifts toward cool haze.
          c = mix(c, vec3(0.32, 0.38, 0.44), 0.28 * far * far);
          // Near ground keeps a touch more contrast and warmth.
          return mix(c, c * vec3(1.04, 1.02, 0.97) * 1.05, near * 0.5 * params.z);
        }

        void main() {
          vec3 c = mixAB <= 0.0 ? plate(mapA, flowA, paramsA)
                 : mixAB >= 1.0 ? plate(mapB, flowB, paramsB)
                 : mix(plate(mapA, flowA, paramsA), plate(mapB, flowB, paramsB), mixAB);
          gl_FragColor = vec4(c, opacity);
        }`,
    });
    return { clips, material };
  }, []);

  useEffect(() => {
    clips.hero.video.play().catch(() => {});
    clips.airframe.video.pause();
    return () => {
      for (const { video, texture } of Object.values(clips)) {
        video.pause();
        video.removeAttribute("src");
        video.load();
        texture.dispose();
      }
      material.dispose();
      plateLight.weight = 0;
      plateLight.env = null;
      envTarget.current?.dispose();
    };
  }, [clips, material]);

  useEffect(() => {
    // 16:9 sources, cover-fit to the canvas.
    const screen = width / height;
    const src = 16 / 9;
    material.uniforms.cover.value.set(screen < src ? screen / src : 1, screen < src ? 1 : src / screen);
  }, [width, height, material]);

  useFrame((state) => {
    const s = scenes();
    const p = s[SCENE.DELTA_DRONE].progress;
    const q = s[SCENE.SWARM_SCENE].progress;
    const u = material.uniforms;
    const { hero, airframe, connection } = clips;

    // Hand-offs: hero loop -> airframe tilt as scrolling begins (camera barely moves before p 0.1);
    // airframe end frame -> connection first frame once straight down; back to live terrain at the end of the swarm.
    const toAirframe = remap(p, 0.02, 0.08, 0, 1);
    const toConnection = remap(p, 0.9, 0.96, 0, 1);
    const o = 1 - remap(q, 0.88, 1, 0, 1);
    const tilt = tiltAt(p);

    // Airframe clip time follows the camera pitch (scroll), not the clock.
    const target = Math.min(tilt * AIRFRAME_DURATION, AIRFRAME_DURATION - 1 / 24);
    if (!airframe.video.seeking && Math.abs(airframe.video.currentTime - target) > 1 / 48) airframe.video.currentTime = target;

    // Connection starts from its first frame when the tilt completes, then loops its later stretch.
    if (toConnection > 0 && !connectionStarted.current) {
      connectionStarted.current = true;
      connection.video.currentTime = 0;
      connection.video.play().catch(() => {});
    } else if (p < 0.85 && connectionStarted.current) {
      connectionStarted.current = false;
      connection.video.pause();
    }
    if (connection.video.currentTime >= CONNECTION_LOOP.end - 0.03 || connection.video.ended) {
      connection.video.currentTime = CONNECTION_LOOP.start;
      connection.video.play().catch(() => {});
    }
    // Only decode the hero loop while it can be seen.
    if (toAirframe >= 1 && !hero.video.paused) hero.video.pause();
    else if (toAirframe < 1 && hero.video.paused) hero.video.play().catch(() => {});

    if (toConnection > 0) {
      u.mapA.value = airframe.texture;
      u.mapB.value = connection.texture;
      u.mixAB.value = toConnection;
      flowDir(tilt, u.flowA.value);
      flowDir(1, u.flowB.value);
      u.paramsA.value.set(0.025 * (1 - tilt), 0.012, 1 - tilt);
      u.paramsB.value.set(0, 0, 0);
    } else {
      u.mapA.value = hero.texture;
      u.mapB.value = airframe.texture;
      u.mixAB.value = toAirframe;
      flowDir(0, u.flowA.value);
      flowDir(tilt, u.flowB.value);
      u.paramsA.value.set(0.025, 0, 1);
      u.paramsB.value.set(0.025 * (1 - tilt), 0.012, 1 - tilt);
    }
    u.opacity.value = o;
    u.time.value = state.clock.getElapsedTime();
    material.visible = o > 0.001;

    // Plate-matched light: sun fixed to the hero camera's heading (kept once the camera looks straight down),
    // environment built once the hero camera has settled.
    if (!heading.current && ++frames.current > 30) heading.current = cameraHeading(state.camera, new THREE.Vector3());
    if (heading.current) {
      plateSunDirection(heading.current, plateLight.sunDirection);
      if (!envTarget.current) {
        envTarget.current = buildPlateEnvironment(state.gl, heading.current, ground, plateLight.sunDirection);
        plateLight.env = envTarget.current.texture;
      }
    }
    plateLight.weight = plateLight.env ? o : 0;
  });

  // Above terrain/trails/power station, below the hero drone (no depth buffer: render order decides).
  return (
    <mesh frustumCulled={false} renderOrder={RENDER_ORDER.HERO_DRONE - 0.5} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
