"use client";

import { Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useInView } from "motion/react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RavenModel } from "@/components/scene/Drone";
import { useMouse } from "@/lib/scenes";
import { useMediaQuery } from "@/lib/use-media-query";
import { FloatBob, landingPose, landingProgress, PointerLean, turretPivot, type LandingPose } from "./drone-flight";

/** Glide start above the pad, in drone widths: just above the top of this canvas's view at the pad's depth. */
const START_HEIGHT = 1.45;
const _e = new THREE.Euler();

/**
 * The drone's flight onto the pad (drone-flight.ts, after drone.riotters.com): timed banked glide-in and let-down once
 * the footer is 30% in view, then a slow float with the landed tilt. Reduced motion: parked on the pad.
 */
function Flight({ playing }: { playing: boolean }) {
  const motion = useRef<THREE.Group>(null);
  const turret = useRef<THREE.Group | null>(null);
  const t = useRef(0);
  const floatBob = useRef(new FloatBob());
  const lean = useRef(new PointerLean());
  const pose = useRef<LandingPose>({ height: 0, scale: 1, yaw: 0, pitch: 0, roll: 0 });
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const onObject = useCallback((object: THREE.Object3D) => {
    turret.current = turretPivot(object);
  }, []);

  useEffect(() => {
    if (!playing) return;
    t.current = 0;
    floatBob.current.reset();
    lean.current.reset();
  }, [playing]);

  useFrame((_, dt) => {
    const m = motion.current;
    if (!m) return;
    if (reducedMotion) {
      m.visible = true;
      m.position.set(0, 0, 0);
      m.quaternion.identity();
      m.scale.setScalar(1);
      return;
    }
    m.visible = playing;
    if (!playing) return;
    t.current += Math.min(dt, 1 / 20);
    const n = landingProgress(t.current);
    landingPose(n, START_HEIGHT, pose.current);
    const { x, y } = useMouse.getState();
    lean.current.update(dt, x, -y, n);
    const bob = floatBob.current.update(dt);
    m.position.set(2 * lean.current.shift.x, 2 * (pose.current.height + bob + lean.current.shift.y), 0);
    m.scale.setScalar(pose.current.scale);
    _e.set(pose.current.pitch, pose.current.yaw, pose.current.roll, "YXZ");
    m.quaternion.setFromEuler(_e).premultiply(lean.current.offset);
    if (turret.current) turret.current.rotation.set(lean.current.head.pitch, lean.current.head.yaw, 0, "YXZ");
  });

  return (
    <group position={[0, -0.55, 0]}>
      <group ref={motion}>
        {/* Front to camera (RavenModel turns the GLB 180°, undo it); gear on the canvas floor line when landed. */}
        <group rotation={[0, Math.PI, 0]}>
          <RavenModel span={2} onObject={onObject} />
        </group>
      </group>
    </group>
  );
}

/**
 * Footer drone below 1024px (the shipped site shows the last landing frame as a static image there). Raven: the live
 * raven_hexa flies in and settles on the same spot. Renders only while in view.
 */
export function FooterDrone({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "20% 0px 20% 0px" });
  // Reference trigger: 30% visible starts the landing; leaving the view resets it so it plays again next time.
  const seen = useInView(ref, { amount: 0.3 });
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (seen) setPlaying(true);
    else if (!inView) setPlaying(false);
  }, [seen, inView]);
  return (
    <div ref={ref} className={className} aria-hidden="true">
      <Canvas dpr={[1, 1.5]} frameloop={inView ? "always" : "never"} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <PerspectiveCamera makeDefault position={[0, 1.6, 10]} fov={30} onUpdate={(c) => c.lookAt(0, -1.1, 0)} />
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2} position={[0, 4, 1]} rotation={[Math.PI / 2, 0, 0]} scale={[6, 4, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#cfe9f5" position={[-4, 1, 2]} rotation={[0, Math.PI / 2.6, 0]} scale={[0.6, 5, 1]} />
          <Lightformer form="rect" intensity={1} color="#cfe9f5" position={[4, 1, 2]} rotation={[0, -Math.PI / 2.4, 0]} scale={[0.5, 5, 1]} />
        </Environment>
        <directionalLight position={[-0.4, 1, 0.8]} intensity={1.4} />
        <ambientLight intensity={0.1} />
        <Suspense fallback={null}>
          <Flight playing={playing} />
        </Suspense>
      </Canvas>
    </div>
  );
}
