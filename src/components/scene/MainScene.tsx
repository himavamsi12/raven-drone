"use client";

import { useFBO, useKeyboardControls, useTexture } from "@react-three/drei";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import { resolution, SUN_POSITION, TERRAIN_SCALE, terrainOffset } from "@/lib/constants";
import { useLoading } from "@/lib/loading";
import { SCENE, scenes } from "@/lib/scenes";
import { isScrollLocked } from "@/lib/scroll-lock";
import { useMediaQuery } from "@/lib/use-media-query";
import { Clouds } from "./Clouds";
import { CoordinationDrones } from "./CoordinationDrones";
import { DroneRig } from "./DroneRig";
import { Flock } from "./Flock";
import { GridRow } from "./Grid";
import { HeroPlate, heroPlateEnabled } from "./HeroPlate";
import { OpeningSky } from "./OpeningSky";
import { Perimeters } from "./Perimeters";
import { PowerStation } from "./PowerStation";
import { usePostFX } from "./PostFX";
import { plateLight } from "./plate-light";
import { sunlight, updateSunlight } from "./sunlight";
import { Terrain } from "./Terrain";

const TILE = 2 * TERRAIN_SCALE * 200;
/** Sun shadow camera hugs the hero drone (refit every few frames: swarm/mission rescale it). */
const SHADOW_REFIT_FRAMES = 15;
const _box = new THREE.Box3();
const _sphere = new THREE.Sphere();

const SOUNDS = {
  engine: "/assets/sounds/delta-jet.mp3",
  jetWind: "/assets/sounds/jet-wind.mp3",
  windLeft: "/assets/sounds/jet-wind-left.mp3",
  windRight: "/assets/sounds/jet-wind-right.mp3",
} as const;
const GAIN = { engine: 0.54, jetWind: 0.67, windLeft: 0.67, windRight: 0.65 };
type SoundKey = keyof typeof SOUNDS;

/** Keyboard-triggered engine/wind audio in the hero (shipped `t5`). Starts only on user keypress. */
function HeroAudio() {
  const [, getKeys] = useKeyboardControls();
  const ctx = useRef<AudioContext | null>(null);
  const nodes = useRef<Partial<Record<SoundKey, { gain: GainNode; source: AudioBufferSourceNode }>>>({});
  const levels = useRef<Record<SoundKey, number>>({ engine: 0, jetWind: 0, windLeft: 0, windRight: 0 });
  const started = useRef(false);
  useEffect(
    () => () => {
      Object.values(nodes.current).forEach((n) => n?.source.stop());
      ctx.current?.close();
    },
    [],
  );
  useFrame(() => {
    const { shift, left, right } = getKeys() as { shift: boolean; left: boolean; right: boolean };
    const idle = scenes()[SCENE.DELTA_DRONE].progress < 0.001 && !isScrollLocked();
    const want: Record<SoundKey, boolean> = {
      engine: shift && idle,
      jetWind: shift && idle,
      windLeft: left && idle,
      windRight: right && idle,
    };
    if (!started.current && (want.engine || want.windLeft || want.windRight)) {
      started.current = true;
      const ac = new AudioContext();
      ctx.current = ac;
      (Object.keys(SOUNDS) as SoundKey[]).forEach((k) => {
        fetch(SOUNDS[k])
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
          .then((b) => ac.decodeAudioData(b))
          .then((buf) => {
            const gain = ac.createGain();
            gain.gain.value = 0;
            gain.connect(ac.destination);
            const source = ac.createBufferSource();
            source.buffer = buf;
            source.loop = true;
            source.connect(gain);
            source.start();
            nodes.current[k] = { gain, source };
          })
          .catch(() => {});
      });
    }
    (Object.keys(SOUNDS) as SoundKey[]).forEach((k) => {
      const l = levels.current;
      if (want[k]) l[k] += (1 - l[k]) * 0.05;
      else {
        l[k] += (0 - l[k]) * 0.18;
        if (l[k] < 0.01) l[k] = 0;
      }
      const n = nodes.current[k];
      if (n) {
        n.gain.gain.value = l[k] * GAIN[k];
        if (k === "engine") n.source.playbackRate.value = 0.85 + 0.4 * l[k];
      }
    });
  });
  return null;
}

/** Flock scene rendered into an FBO through a portal (shipped `tK.Y`). */
function FlockPortal({ target, enabled }: { target: THREE.WebGLRenderTarget; enabled: boolean }) {
  const camera = useThree((s) => s.camera);
  const [portalScene] = useState(() => new THREE.Scene());
  useFrame(({ gl }) => {
    if (!enabled) return;
    const prev = gl.getRenderTarget();
    const prevAuto = gl.autoClear;
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(portalScene, camera);
    gl.setRenderTarget(prev);
    gl.autoClear = prevAuto;
  });
  return <>{createPortal(<Flock camera={camera} />, portalScene)}</>;
}

/** Everything inside the sticky canvas (shipped `t4`). */
export function MainScene() {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const dpr = useThree((s) => s.viewport.dpr);
  const announced = useRef(false);
  const flockOn = useRef(false);
  const [renderFlock, setRenderFlock] = useState(false);
  const [plate, setPlate] = useState(false);
  useEffect(() => setPlate(heroPlateEnabled()), []);

  useTexture(ASSETS.blueNoise, (t) => {
    const tex = Array.isArray(t) ? t[0] : t;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
  });

  useEffect(() => {
    resolution.set(width * dpr, height * dpr);
  }, [width, height, dpr]);

  const flockTarget = useFBO(width * dpr, height * dpr);
  usePostFX(flockTarget);

  const sunRef = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const heroDrone = useRef<THREE.Object3D | null>(null);
  const shadowFit = useRef({ frame: 0, centre: new THREE.Vector3(), radius: 1 });
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const sunDistance = SUN_POSITION.length();

  useFrame(({ clock }) => {
    // Raven daylight: travel-driven sun sway + passing cloud shade (see sunlight.ts).
    updateSunlight(terrainOffset.current ?? 0, clock.getElapsedTime(), reducedMotion);
    // Over the H00 plate the light is the plate's: fixed sun (no sway, no cloud dips), warm key.
    const w = plateLight.weight;
    if (w > 0) {
      sunlight.direction.lerp(plateLight.sunDirection, w).normalize();
      sunlight.heading *= 1 - w;
      sunlight.pitch *= 1 - w;
      sunlight.shade += (1 - sunlight.shade) * w;
    }
    const sun = sunRef.current;
    if (sun) {
      sun.intensity = 4 * sunlight.shade;
      sun.color.setRGB(1, 1, 1).lerp(plateLight.sunColor, w);
      // Same parallel sun, but placed just above the hero drone so a tight shadow frustum gives crisp
      // self-shadowing (arms and deck onto the medical box and gear).
      heroDrone.current ??= scene.getObjectByName("Drone1Group") ?? null;
      const fit = shadowFit.current;
      if (heroDrone.current && fit.frame++ % SHADOW_REFIT_FRAMES === 0) {
        _box.setFromObject(heroDrone.current).getBoundingSphere(_sphere);
        if (_sphere.radius > 0) fit.radius = _sphere.radius;
        const cam = sun.shadow.camera;
        cam.left = cam.bottom = -1.05 * fit.radius;
        cam.right = cam.top = 1.05 * fit.radius;
        cam.near = 2 * fit.radius;
        cam.far = 6 * fit.radius;
        cam.updateProjectionMatrix();
        sun.shadow.normalBias = 0.006 * fit.radius;
      }
      if (heroDrone.current) {
        heroDrone.current.getWorldPosition(fit.centre);
        sun.target.position.copy(fit.centre);
        sun.position.copy(sunlight.direction).multiplyScalar(4 * fit.radius).add(fit.centre);
      } else {
        sun.position.copy(sunlight.direction).multiplyScalar(sunDistance);
      }
      sun.target.updateMatrixWorld();
    }
    if (!announced.current) {
      announced.current = true;
      setTimeout(() => useLoading.getState().setMainAppLoaded(true), 25);
    }
    const on = scenes()[SCENE.FLOCK_SCENE].progress > 0.75;
    if (on !== flockOn.current) {
      flockOn.current = on;
      setRenderFlock(on);
    }
  }, 0);

  return (
    <>
      <HeroAudio />
      <DroneRig />
      {plate && <HeroPlate />}
      <OpeningSky />
      <group position={[0, -2.5, -8.6]}>
        <Terrain />
        <GridRow offset={2 * TILE} isCity />
        <group position={[0, 0, 2 * TILE + 0.15]} rotation={[0, Math.PI, 0]}>
          <Perimeters />
          <CoordinationDrones />
          <PowerStation />
        </group>
      </group>
      <Clouds />
      <directionalLight
        ref={sunRef}
        args={[0xffffff, 4]}
        position={SUN_POSITION}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      />
      <FlockPortal target={flockTarget} enabled={renderFlock} />
    </>
  );
}
