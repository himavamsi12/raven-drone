"use client";

import { Environment, Lightformer, PerspectiveCamera, Preload } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useInView } from "motion/react";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ContactButton } from "@/components/ContactButton";
import { RavenModel } from "@/components/scene/Drone";
import { ArrowRightIcon } from "@/components/ui/icons";
import { useMouse } from "@/lib/scenes";
import { useMediaQuery } from "@/lib/use-media-query";
import { FloatBob, landingPose, landingProgress, PointerLean, type LandingPose } from "./drone-flight";

/**
 * Closing CTA (user mockup 2026-11-05): the hexa, front on, large and dimmed behind "Want your product explained this
 * clearly?". The drone's entrance is the footer landing of the tundra-terrain branch (FooterDrone + drone-flight.ts,
 * removed there in 7b9d467): a banked glide-in and let-down once the section is 30% in view, then a slow float that
 * leans with the pointer. Leaving the view resets it so it plays again. Reduced motion: parked, no flight.
 */

/** Glide start above the rest pose, in drone widths. */
const START_HEIGHT = 1.1; // was 1.45 (user 2026-11-05: the drone arrived late)
/** RavenModel is SPAN (200) units across; the flight model works in drone widths of 2. */
const MODEL_SCALE = 0.01;
const _e = new THREE.Euler();

function Flight({ playing }: { playing: boolean }) {
  const motion = useRef<THREE.Group>(null);
  const t = useRef(0);
  const floatBob = useRef(new FloatBob());
  const lean = useRef(new PointerLean());
  const pose = useRef<LandingPose>({ height: 0, scale: 1, yaw: 0, pitch: 0, roll: 0 });
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

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
  });

  return (
    <group ref={motion}>
      {/* Front to camera: RavenModel turns the GLB 180 deg, undo it. */}
      <group rotation={[0, Math.PI, 0]} scale={MODEL_SCALE}>
        <RavenModel realLook />
      </group>
    </group>
  );
}

/**
 * Mockup framing: front on from ~20 deg above (top plate visible), the airframe about 55% of the width, hub a little
 * above the copy. On narrow screens the camera backs off so the arms stay in frame.
 */
const VIEW = { fov: 30, fill: 0.55, elevation: 0.3, minDist: 4.2, target: 0.05 };
function CtaCamera() {
  const aspect = useThree((s) => s.size.width / Math.max(s.size.height, 1));
  const tanH = Math.tan(((VIEW.fov / 2) * Math.PI) / 180) * aspect;
  const dist = Math.max(VIEW.minDist, 2 / (VIEW.fill * 2 * tanH));
  return (
    <PerspectiveCamera
      makeDefault
      fov={VIEW.fov}
      position={[0, dist * Math.sin(VIEW.elevation), dist * Math.cos(VIEW.elevation)]}
      onUpdate={(c) => c.lookAt(0, VIEW.target, 0)}
    />
  );
}

function CtaDrone({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // User 2026-11-05 ("the drone is not coming immediately"): render a full screen ahead so the canvas, model and
  // shaders are ready before the section arrives, and start the landing as soon as the section's top is on screen
  // (was 30% visible).
  const inView = useInView(ref, { margin: "100% 0px 100% 0px" });
  const seen = useInView(ref, { amount: 0.05 });
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (seen) setPlaying(true);
    else if (!inView) setPlaying(false);
  }, [seen, inView]);
  return (
    <div ref={ref} className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        frameloop={inView ? "always" : "never"}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <CtaCamera />
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2} position={[0, 4, 1]} rotation={[Math.PI / 2, 0, 0]} scale={[6, 4, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#cfe9f5" position={[-4, 1, 2]} rotation={[0, Math.PI / 2.6, 0]} scale={[0.6, 5, 1]} />
          <Lightformer form="rect" intensity={1} color="#cfe9f5" position={[4, 1, 2]} rotation={[0, -Math.PI / 2.4, 0]} scale={[0.5, 5, 1]} />
        </Environment>
        <directionalLight position={[-0.4, 1, 0.8]} intensity={2.2} />
        <ambientLight intensity={0.25} />
        <Suspense fallback={null}>
          <Flight playing={playing} />
          {/* Compile the drone's materials up front, not on its first visible frame. */}
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}

export function ClosingCta() {
  return (
    <section
      id="contact-cta"
      aria-labelledby="contact-cta-h"
      className="cta font-tight z-over-scroll-sequence relative w-full overflow-hidden bg-black text-white"
    >
      <CtaDrone className="absolute inset-0" />
      {/* Dims the drone so the copy reads (mockup: drone in shadow, copy bright). */}
      <div aria-hidden="true" className="cta-dim pointer-events-none absolute inset-0" />
      <div className="relative flex h-full flex-col items-center justify-center px-5 text-center">
        <h2 id="contact-cta-h" className="cta-h">
          Want your product
          <br />
          explained this clearly?
        </h2>
        <p className="cta-p">We&rsquo;re Sixjuly, a clarity-first design studio.</p>
        <ContactButton
          label="Talk to us"
          trigger={
            <button type="button" className="cta-btn">
              <span>Talk to us</span>
              <span className="cta-btn-arrow" aria-hidden="true">
                <ArrowRightIcon className="size-3.5" />
              </span>
            </button>
          }
        />
      </div>
    </section>
  );
}
