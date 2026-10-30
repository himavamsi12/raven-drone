"use client";

import { Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useInView } from "motion/react";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import { RavenModel } from "@/components/scene/Drone";

/**
 * Footer drone below 1024px (the reference shows the last landing frame as a static image there). Raven: the live
 * raven_hexa model at rest in the same spot, front to camera, rotors parked. Renders only while in view.
 */
export function FooterDrone({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "20% 0px 20% 0px" });
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
          {/* Landed: gear on the canvas floor line, front to camera (RavenModel turns the GLB 180°, undo it). */}
          <group position={[0, -0.55, 0]} rotation={[0, Math.PI, 0]}>
            <RavenModel span={2} still />
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}
