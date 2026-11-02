"use client";

import { PerspectiveCamera, useKeyboardControls } from "@react-three/drei";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { CopyPass } from "postprocessing";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { ASSETS } from "@/lib/assets";
import { ENGINE_COPY_Y, RENDER_ORDER } from "@/lib/constants";
import { useLoading } from "@/lib/loading";
import { damp, lerp, remap } from "@/lib/math";
import { SCENE, scenes, useMouse } from "@/lib/scenes";
import { isScrollLocked } from "@/lib/scroll-lock";
import { openingNow } from "@/lib/story-map";
import { useMediaQuery } from "@/lib/use-media-query";
import { CAMERA_BINDINGS, ClipSeeker, DRONE1_BINDINGS, DRONE2_BINDINGS, DRONE3_BINDINGS } from "./ClipSeeker";
import { Drone } from "./Drone";
import { applyOpening } from "./opening";
import { SpecsCallouts } from "./overlays/SpecsCallouts";
import { applyCameraTilt, cameraTilt } from "./camera-tilt";
import { SwarmTags } from "./overlays/SwarmTags";
import { useGLB } from "./types";

/** Camera shake intensity per scene (shipped `tM`). */
const SHAKE = {
  [SCENE.INTRO_SCENE]: 0.001,
  [SCENE.REAL_TIME_DETECTION]: 0.002,
  [SCENE.THERMAL_IRREGULARITY]: 0.0015,
};

/** Micro camera shake, independent of scroll-driven motion (shipped `tP`). */
function CameraShake({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const amount = useRef(0);
  const [, getKeys] = useKeyboardControls();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const { shift } = getKeys() as { shift: boolean };
    const s = scenes();
    const intro = s[SCENE.INTRO_SCENE];
    const det = s[SCENE.REAL_TIME_DETECTION];
    const thermal = s[SCENE.THERMAL_IRREGULARITY];
    const target = intro.isActive
      ? (SHAKE[SCENE.INTRO_SCENE] + (shift && !isScrollLocked() ? 0.001 : 0)) * intro.progress
      : det.isActive
        ? SHAKE[SCENE.REAL_TIME_DETECTION] * det.progress
        : thermal.isActive
          ? SHAKE[SCENE.THERMAL_IRREGULARITY] * thermal.progress
          : 0;
    amount.current = lerp(amount.current, target, 0.05);
    const u = amount.current;
    const t = clock.getElapsedTime();
    const x = Math.sin(3 * t * 8) * u + Math.sin(2.2 * t * 8 + 1) * u * 0.5;
    const y = Math.cos(2.7 * t * 8) * u + Math.cos(1.8 * t * 8 + 2) * u * 0.5;
    const z = Math.sin(1.6 * t * 8 + 3) * u * 0.3;
    const rz = Math.sin(2.3 * t * 8) * u * 0.4;
    const rx = Math.cos(1.7 * t * 8) * u * 0.3;
    ref.current.position.set(x, y, z);
    ref.current.rotation.set(rx, ref.current.rotation.y, rz);
  });
  return <group ref={ref}>{children}</group>;
}

type Pose = { position: THREE.Vector3; rotation: THREE.Vector3 };
/** Hero lens (shipped `<PerspectiveCamera fov={20}>`); the Raven opening widens it before the hero frame. */
const HERO_FOV = 20;
/** Raven (user, 2026-10-31): all three drones 1.2x the shipped scale in every scene. */
const DRONE_SCALE = 1.2;
/**
 * Extra size for the hero drone when the camera looks straight down on it (Airframe top view, Connection ...; user,
 * 2026-11-02: the product reads too small there). Same top-view blend as the background blur (PostFX): camera
 * -dir.y 0.75 -> 0.95, eased over ~0.4 s, so it grows smoothly through the tilt. The spec callouts are fixed world
 * points near the drone centre, so they still point into the larger airframe.
 */
const TOP_VIEW_SCALE = 1.35;
const _topDir = new THREE.Vector3();
const _zoomCam = new THREE.Vector3();
const _zoomDrone = new THREE.Vector3();
/**
 * Hero drone scale / camera distance at the Prepare frame (scale 0.0075 x 1.2 x 1.35 at 17.24) and the Route frame
 * (0.0075 x 1.2 at 14.7), desktop tracks (measured 1440×900, fov 20; the ratio does not depend on the viewport).
 */
const APPARENT_PREPARE = (0.0075 * 1.2 * 1.35) / 17.24;
const APPARENT_ROUTE = (0.0075 * 1.2) / 14.7;
const _tiltDrone = new THREE.Vector3();
const _poseA = new THREE.Object3D();
const _poseB = new THREE.Object3D();
const _offA = new THREE.Vector3();
const _offB = new THREE.Vector3();
const _swing = new THREE.Quaternion();
const _partial = new THREE.Quaternion();

const pose = (): Pose => ({ position: new THREE.Vector3(), rotation: new THREE.Vector3() });

/** Procedural idle hover offsets (shipped `tO`). */
function hover(t: number, offset: number, amp: number, out: Pose) {
  const o = t + offset;
  const y = (0.02 * Math.sin(0.4 * o) + 0.01 * Math.sin(1.1 * o) + 0.005 * Math.sin(2.7 * o)) * amp;
  const z = 10 * Math.sin(0.5 * o) * amp;
  const roll =
    (0.015 * Math.sin(0.35 * o) + 0.008 * Math.sin(1.2 * o) + 0.003 * Math.sin(2.9 * o)) * 3 +
    0.007 * Math.sin(20 * o) * Math.sin(0.4 * o) * 0.25;
  const x = -(5 * (0.015 * Math.sin(0.35 * o) + 0.008 * Math.sin(1.2 * o) + 0.003 * Math.sin(2.9 * o)));
  out.position.set(x, y, z);
  out.rotation.set(0, 0, roll);
}

/** Camera + three drones driven by the shipped GLB clips (shipped `tU` + `tN`). */
export function DroneRig() {
  const isMd = useMediaQuery("(min-width: 768px)");
  const size = useThree((s) => s.size);
  const cam = useGLB(ASSETS.cameraAnimations);
  const camMobile = useGLB(ASSETS.cameraAnimationsMobile);
  const drones = useGLB(ASSETS.droneAnimations);
  const dronesMobile = useGLB(ASSETS.droneAnimationsMobile);
  const [, getKeys] = useKeyboardControls();

  const env = useLoader(EXRLoader, ASSETS.env, (loader) => loader.setDataType(THREE.HalfFloatType));
  env.mapping = THREE.EquirectangularReflectionMapping;

  const sceneCopy = useMemo(() => new CopyPass(), []);
  useEffect(() => () => sceneCopy.dispose(), [sceneCopy]);

  // Trackers: GLTFLoader sanitizes "Drone.001" -> "Drone001" (PropertyBinding.sanitizeNodeName).
  const seekers = useMemo(() => {
    const find = (root: THREE.Object3D, name: string) => root.getObjectByName(name) ?? null;
    const make = (root: THREE.Object3D, name: string, clips: THREE.AnimationClip[], b: typeof CAMERA_BINDINGS) => {
      const node = find(root, name);
      return node ? new ClipSeeker(node, clips, b) : null;
    };
    return {
      desktop: {
        camera: make(cam.scene, "Camera", cam.animations, CAMERA_BINDINGS),
        d1: make(drones.scene, "Drone", drones.animations, DRONE1_BINDINGS),
        d2: make(drones.scene, "Drone001", drones.animations, DRONE2_BINDINGS),
        d3: make(drones.scene, "Drone002", drones.animations, DRONE3_BINDINGS),
      },
      mobile: {
        camera: make(camMobile.scene, "Camera-mobile", camMobile.animations, CAMERA_BINDINGS),
        d1: make(dronesMobile.scene, "Drone-mobile", dronesMobile.animations, DRONE1_BINDINGS),
        d2: make(dronesMobile.scene, "Drone001-mobile", dronesMobile.animations, DRONE2_BINDINGS),
        d3: make(dronesMobile.scene, "Drone002-mobile", dronesMobile.animations, DRONE3_BINDINGS),
      },
    };
  }, [cam, camMobile, drones, dronesMobile]);

  useEffect(
    () => () => {
      for (const set of [seekers.desktop, seekers.mobile]) for (const s of Object.values(set)) s?.dispose();
    },
    [seekers],
  );

  const cameraMover = useRef<THREE.Group>(null);
  const cameraDolly = useRef<THREE.Group>(null);
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const droneRoot = useRef<THREE.Group>(null);
  const mover1 = useRef<THREE.Group>(null);
  const topView = useRef(0);
  /** Journey progress eased in time, drives the Prepare -> Route camera move and drone size (see the clip frame). */
  const transitionF = useRef(0);
  const mover2 = useRef<THREE.Group>(null);
  const mover3 = useRef<THREE.Group>(null);
  const drone1 = useRef<THREE.Group>(null);
  const drone2 = useRef<THREE.Group>(null);
  const drone3 = useRef<THREE.Group>(null);

  const mouseRoll = useRef(0);
  const swarmX = useRef(0);
  const swarmZ = useRef(0);
  const steer = useRef(0);
  const steerVel = useRef(0);
  const bank = useRef(0);
  const settle = useRef(0);
  const flankEase = useRef(0);
  const flankScale = useRef(1);
  const reveal = useRef(0);
  const lastPos = useRef(new THREE.Vector3());
  const lateralSpeed = useRef(0);
  const tmpA = useRef(new THREE.Vector3());
  const tmpB = useRef(new THREE.Vector3());
  const first = useRef(true);
  const poses = useRef([pose(), pose(), pose()]);

  // Clip seeking runs before the procedural pass, mirroring the shipped order 1..15.
  useFrame((_, dt) => {
    const set = isMd ? seekers.desktop : seekers.mobile;
    if (mover1.current) set.d1?.apply(mover1.current);
    if (cameraMover.current) set.camera?.apply(cameraMover.current);
    // Raven opening: fly from the low wide shot into the clip's hero pose (scene/opening.ts). The wide lens would show
    // the flank drones (off frame from the hero shot on), so they stay hidden until it lands (user, 2026-11-01).
    const opening = openingNow();
    if (cameraMover.current && camera.current) applyOpening(cameraMover.current, camera.current, opening, HERO_FOV);
    // Oblique view instead of straight down in Airframe and Connection (camera-tilt.ts).
    if (cameraMover.current && drone1.current) {
      const sc = scenes();
      // Oblique through Airframe, Connection and Prepare (user: no top-down angle at all); hands off to the Journey
      // network map during its transition (FLOCK_SCENE 0.4 -> 0.75, before the flock pass mixes in).
      const f = sc[SCENE.FLOCK_SCENE].progress;
      const gate = opening >= 1 ? 1 - THREE.MathUtils.smoothstep(f, 0.4, 0.75) : 0;
      drone1.current.updateWorldMatrix(true, false);
      applyCameraTilt(cameraMover.current, drone1.current.getWorldPosition(_tiltDrone), gate);
      // Prepare -> Route (Journey range, now a transition): one eased camera move between the two fixed end poses
      // instead of the clip in between. The clip pitched 40 -> 51 -> 31 deg and the drone drifted past centre and
      // back while the tilt handed off ("awkward motion", user 2026-11-02). A = tilted Camera03 end (Prepare frame),
      // B = Camera04-02 end (Route holds it). Distance lerps, the direction about the drone and the orientation slerp,
      // eased with smootherstep (C2: starts and lands at rest), so pitch, distance and framing each move one way.
      // The wheel's first frames move the page in a burst (246, 94, 37 px, shipped Lenis lerp .95), so the move is
      // driven by Journey progress eased over ~0.1 s: the camera absorbs the burst, scroll speed is unchanged.
      // Large jumps (nav ticks, scrollTo) snap.
      const tf = transitionF.current;
      transitionF.current = Math.abs(f - tf) > 0.5 ? f : tf + (f - tf) * (1 - Math.exp(-dt / 0.1));
      const fs = transitionF.current;
      if (opening >= 1 && fs > 0.0001 && fs < 0.9999 && set.camera?.sample("Camera03", 1, _poseA.position, _poseA.quaternion)
        && set.camera.sample("Camera04-02", 1, _poseB.position, _poseB.quaternion)) {
        applyCameraTilt(_poseA, _tiltDrone, 1);
        const e = THREE.MathUtils.smootherstep(fs, 0, 1);
        _offA.copy(_poseA.position).sub(_tiltDrone);
        _offB.copy(_poseB.position).sub(_tiltDrone);
        const r = THREE.MathUtils.lerp(_offA.length(), _offB.length(), e);
        _swing.setFromUnitVectors(_offA.normalize(), _offB.normalize());
        _partial.identity().slerp(_swing, e);
        cameraMover.current.position.copy(_offA.applyQuaternion(_partial).multiplyScalar(r)).add(_tiltDrone);
        cameraMover.current.quaternion.copy(_poseA.quaternion).slerp(_poseB.quaternion, e);
        cameraTilt.weight = 1 - e; // drone-focus effects (blur, size, shadow) follow the same curve
      }
    }
    if (mover2.current && set.d2?.apply(mover2.current)) mover2.current.visible = opening >= 1;
    if (mover3.current && set.d3?.apply(mover3.current)) mover3.current.visible = opening >= 1;
  }, 1);

  useFrame((state, dt) => {
    const t = state.clock.getElapsedTime();
    const { x: mouseX } = useMouse.getState();
    const s = scenes();
    const flock = s[SCENE.FLOCK_SCENE].progress;
    const swarm = s[SCENE.SWARM_SCENE].progress;
    const delta = s[SCENE.DELTA_DRONE].progress;
    const mission = s[SCENE.MISSION_PRESET].progress;
    const thermal = s[SCENE.THERMAL_IRREGULARITY].progress;
    const detection = s[SCENE.REAL_TIME_DETECTION].progress;

    flankEase.current = damp(flankEase.current, mission > 0.01 ? 0 : 1, 2, dt);
    flankScale.current = damp(flankScale.current, mission > 0.01 ? 0 : 1, 2, dt);
    if (!drone1.current || !drone2.current || !drone3.current) return;

    mouseRoll.current = damp(mouseRoll.current, 0.25 * mouseX * delta * (1 - swarm), 2, dt);
    const [p1, p2, p3] = poses.current;
    hover(t, 0, 0.75, p1);
    hover(t, 1.7, 3, p2);
    hover(t, 3.4, 3, p3);

    const mobileScale = remap(window.innerWidth, 390, 768, 1, 1.35);
    const mobileLift = remap(window.innerHeight, 390, 1080, 1, 2);
    const mobileSwarmZ = remap(swarm, 0, 1, 0, 0.5) * remap(mission, 0, 1, 0.5, 0);
    if (droneRoot.current) {
      droneRoot.current.position.set(0, 0, isMd ? 0 : mobileSwarmZ * mobileLift);
      droneRoot.current.scale.setScalar(isMd ? 1 : mobileScale);
    }
    swarmX.current = remap(swarm, 0, 1, 0, 24) * remap(mission, 0, 0.75, 1, 0);
    swarmZ.current = remap(swarm, 0, 1, 0, 24) * remap(mission, 0, 0.75, 1, 0);

    settle.current = damp(settle.current, delta > 0.01 && swarm === 0 ? 0 : 1, 1, dt);

    const { left, right } = getKeys() as { left: boolean; right: boolean };
    const heroIdle = delta < 0.001 && !isScrollLocked();
    if (heroIdle) {
      const force = 100 * (Number(left) - Number(right)) - 1.25 * steer.current;
      steerVel.current = damp(steerVel.current, force, 1.5, dt);
      steer.current = THREE.MathUtils.clamp(steer.current + steerVel.current * dt, -200, 200);
    } else {
      steer.current = damp(steer.current, 0, 2, dt);
      steerVel.current = damp(steerVel.current, 0, 1, dt);
    }

    reveal.current = damp(reveal.current, Number(useLoading.getState().loadingCanvasHidden), 3, dt);
    drone1.current.position.set(
      (p1.position.x + (isMd ? swarmX.current : 0) + steer.current) * reveal.current,
      p1.position.y * reveal.current,
      (p1.position.z * settle.current + (isMd ? swarmZ.current : 0)) * reveal.current,
    );

    const pos = tmpA.current.copy(drone1.current.position);
    if (first.current || dt > 0.1) {
      lastPos.current.copy(pos);
      lateralSpeed.current = 0;
      first.current = false;
    } else {
      const d = tmpB.current.copy(pos).sub(lastPos.current);
      lateralSpeed.current = (d.length() / dt) * Math.sign(d.x);
      lastPos.current.copy(pos);
    }

    const inset = remap(size.width, 768, 1280, -64, 0);
    const k = flankScale.current;
    const e = flankEase.current;
    drone2.current.position.set(
      (p2.position.x * k + 100) * e + (isMd ? inset : 0),
      p2.position.y * k,
      p2.position.z * k,
    );
    drone3.current.position.set(
      (p3.position.x * k - 100) * e - (isMd ? inset : 0),
      p3.position.y * k,
      (p3.position.z * k - 100) * e,
    );

    bank.current = damp(bank.current, heroIdle ? -(0.002 * lateralSpeed.current) : 0, 3, dt);
    drone1.current.rotation.set(
      p1.rotation.x,
      p1.rotation.y - (isMd ? 0.3 * thermal : 0),
      p1.rotation.z + mouseRoll.current + bank.current,
    );
    drone2.current.rotation.set(p2.rotation.x, p2.rotation.y, p2.rotation.z);
    drone3.current.rotation.set(p3.rotation.x, p3.rotation.y, p3.rotation.z);

    if (cameraDolly.current) {
      // Shipped push-in (flock .85 -> 1) and pull-back (Route 0 -> .45) were hidden by the Journey map transition.
      // Journey is removed, so they read as a zoom in then out (user, 2026-11-02): no dolly.
      cameraDolly.current.position.z = 0;
    }
    if (camera.current) {
      camera.current.getWorldDirection(_topDir);
      const target = Math.max(THREE.MathUtils.smoothstep(-_topDir.y, 0.75, 0.95), cameraTilt.weight);
      topView.current += (target - topView.current) * (1 - Math.exp(-dt / 0.4));
    }
    if (mover1.current) {
      const sc = remap(swarm, 0, 0.5, 0.0075, 0.0085) - 0.001 * mission;
      const top = 1 + (TOP_VIEW_SCALE - 1) * topView.current;
      let scale = (isMd ? sc : 0.0075) * DRONE_SCALE * top;
      // Prepare -> Route (Journey range, desktop track): hold the drone's apparent size (scale / camera distance) on
      // an even path from the Prepare frame to the Route frame. Measured at 1440×900: the clip camera moves in
      // (17.2 -> 13.7) while the top-view enlargement fades out, which read as a zoom in, then out (user, 2026-11-02).
      const fs = transitionF.current; // same eased progress as the camera move
      if (isMd && camera.current && fs > 0) {
        const dist = camera.current.getWorldPosition(_zoomCam).distanceTo(drone1.current.getWorldPosition(_zoomDrone));
        const a = THREE.MathUtils.lerp(APPARENT_PREPARE, APPARENT_ROUTE, THREE.MathUtils.smootherstep(fs, 0, 1));
        const held = a * dist;
        scale += (held - scale) * THREE.MathUtils.smoothstep(fs, 0, 0.08);
      }
      mover1.current.scale.setScalar(scale);
    }
  });

  return (
    <>
      <group ref={cameraMover}>
        <group ref={cameraDolly}>
          <CameraShake>
            <PerspectiveCamera ref={camera} makeDefault fov={HERO_FOV} />
          </CameraShake>
        </group>
      </group>
      <mesh
        scale={0}
        position={[0, ENGINE_COPY_Y, 0]}
        frustumCulled={false}
        renderOrder={RENDER_ORDER.HERO_DRONE_ENGINE}
        onBeforeRender={(gl) => {
          const target = gl.getRenderTarget();
          if (!target) return;
          gl.setRenderTarget(null);
          sceneCopy.setSize(Math.floor(target.width), Math.floor(target.height));
          sceneCopy.render(gl, target, null);
          gl.setRenderTarget(target);
        }}
      >
        <planeGeometry args={[0.001, 0.001]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
      <group ref={droneRoot}>
        <group ref={mover1} scale={0.0075 * DRONE_SCALE}>
          <group ref={drone1} name="Drone1Group">
            <Drone envMap={env} />
          </group>
        </group>
        <group ref={mover2} scale={(isMd ? 0.007 : 0.004) * DRONE_SCALE} visible={false}>
          <group ref={drone2} name="Drone2Group">
            <Drone envMap={env} />
          </group>
        </group>
        <group ref={mover3} scale={(isMd ? 0.007 : 0.0025) * DRONE_SCALE} visible={false}>
          <group ref={drone3} name="Drone3Group">
            <Drone envMap={env} />
          </group>
        </group>
      </group>
      <SwarmTags mainRef={drone1} drone2Ref={drone2} drone3Ref={drone3} />
      <SpecsCallouts />
    </>
  );
}

useGLB.preload(ASSETS.raven);
useGLB.preload(ASSETS.cameraAnimations);
useGLB.preload(ASSETS.cameraAnimationsMobile);
useGLB.preload(ASSETS.droneAnimations);
useGLB.preload(ASSETS.droneAnimationsMobile);
