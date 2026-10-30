"use client";

import { Environment, Lightformer, PerspectiveCamera, View } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useLenis } from "lenis/react";
import { useInView } from "motion/react";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { RavenModel } from "@/components/scene/Drone";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Raven homepage "parts" section (asset/html/raven_homepage.html `.parts`): a sticky horizontal track that vertical
 * scroll drives sideways, one close-up per card. The reference used studio photos of another airframe; here every card
 * is a live view of our own raven_hexa model (drei View: one canvas, one scissored render per card).
 */

/** RavenModel span 2 scales the GLB so its widest plan dimension (LED pods, 1.935) is 2 units, then turns it 180° on Y. */
const S = 2 / 1.935;
const world = (x: number, y: number, z: number) => new THREE.Vector3(-x * S, y * S, -z * S);

type Shot = { title: string; tags: [string, string]; alt: string; target: THREE.Vector3; dir: THREE.Vector3; dist: number; fov: number };

/** Part centres are the GLB node bounds (model space); the view direction points from the part to the camera. */
const SHOTS: Shot[] = [
  {
    title: "Six rotors",
    tags: ["Propulsion", "Alternating spin"],
    alt: "Front-left rotor and motor pod of the Raven hexacopter model",
    target: world(0.425, 0.3, 0.736),
    dir: new THREE.Vector3(-0.55, 0.5, -0.67),
    dist: 0.72,
    fov: 30,
  },
  {
    title: "Medical case",
    tags: ["Payload", "Under the body"],
    alt: "White medical case with a red cross slung beneath the Raven model",
    target: world(0, -0.15, 0.004),
    dir: new THREE.Vector3(0.5, 0.08, -0.86),
    dist: 1.15,
    fov: 30,
  },
  {
    title: "EO/IR turret",
    tags: ["Sensing", "Nose gimbal"],
    alt: "Electro-optical and infrared turret at the nose of the Raven model",
    target: world(0, 0.026, 0.265),
    dir: new THREE.Vector3(0.38, -0.12, -0.92),
    dist: 0.56,
    fov: 30,
  },
  {
    title: "LiDAR and thermal pods",
    tags: ["Perception", "Twin pods"],
    alt: "LiDAR and thermal pods either side of the turret, seen from below",
    target: world(0, 0.07, 0.25),
    dir: new THREE.Vector3(-0.12, -0.42, -0.9),
    dist: 0.62,
    fov: 30,
  },
  {
    title: "Arms and landing gear",
    tags: ["Structure", "Carbon arms"],
    alt: "Carbon arms and landing gear of the Raven model from a low three-quarter angle",
    target: world(0, 0.02, 0),
    dir: new THREE.Vector3(0.76, -0.2, -0.62),
    dist: 2.35,
    fov: 30,
  },
];
for (const s of SHOTS) s.dir.normalize();

const _up = new THREE.Vector3(0, 1, 0);
const _o = new THREE.Vector3();

/** Card camera: aims at the part and turns with the card's place on screen (the reference's image drift). */
function ShotCamera({ shot, card }: { shot: Shot; card: RefObject<HTMLElement | null> }) {
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  useFrame(({ clock }) => {
    const c = cam.current;
    if (!c) return;
    let yaw = 0;
    if (!reducedMotion) {
      const r = card.current?.getBoundingClientRect();
      const across = r ? (r.left + r.width / 2 - window.innerWidth / 2) / window.innerWidth : 0; // -1..1 across the screen
      yaw = -0.16 * across + 0.035 * Math.sin(clock.getElapsedTime() * 0.25);
    }
    _o.copy(shot.dir).applyAxisAngle(_up, yaw).multiplyScalar(shot.dist);
    c.position.copy(shot.target).add(_o);
    c.lookAt(shot.target);
  });
  return <PerspectiveCamera makeDefault ref={cam} fov={shot.fov} near={0.02} far={20} />;
}

/** Studio light: large soft key overhead, cool rim strips, warm kicker (no HDRI download). */
function Studio() {
  return (
    <>
      <color attach="background" args={["#0d0e10"]} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[6, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#cfe9f5" position={[-4, 1.2, -2]} rotation={[0, Math.PI / 2.6, 0]} scale={[0.6, 5, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#cfe9f5" position={[4, 1, 2]} rotation={[0, -Math.PI / 2.4, 0]} scale={[0.5, 5, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#ffd8b0" position={[0, -2, -4]} scale={[5, 1, 1]} />
      </Environment>
      <directionalLight position={[-2.5, 4, -2]} intensity={1.6} />
      <ambientLight intensity={0.08} />
    </>
  );
}

/**
 * Views turn off R3F's auto render; clear the shared canvas first so moving cards leave no trails. Reset the clear
 * colour to transparent: a view's scene background leaves its opaque colour as the clear state, and this canvas is
 * fixed over the page (an opaque clear would hide the story stage above the section).
 */
function ClearPass() {
  useFrame(({ gl }) => {
    gl.setScissorTest(false);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, false);
  }, 0);
  return null;
}

function Card({ shot, index, total }: { shot: Shot; index: number; total: number }) {
  const card = useRef<HTMLElement>(null);
  return (
    <figure
      ref={card}
      className="relative m-0 aspect-[2/1] max-h-[78svh] w-[min(68vw,73.75rem)] flex-none overflow-hidden max-[760px]:aspect-[4/5] max-[760px]:w-[86vw] max-[760px]:snap-center"
    >
      <View className="absolute inset-0" index={index + 1}>
        <Studio />
        <ShotCamera shot={shot} card={card} />
        <Suspense fallback={null}>
          <RavenModel span={2} still />
        </Suspense>
      </View>
      <span className="sr-only" role="img" aria-label={shot.alt} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(20deg,rgba(6,7,8,0.72)_0%,rgba(6,7,8,0.15)_38%,rgba(6,7,8,0)_60%)]"
      />
      <figcaption className="absolute bottom-[clamp(1.125rem,2.4vw,2.125rem)] left-[clamp(1.125rem,2.4vw,2.25rem)] z-1 grid max-w-[min(28.75rem,80%)] gap-3">
        <h3 className="m-0 text-[clamp(1.375rem,2.2vw,2.25rem)] leading-[0.92] font-semibold tracking-[-0.04em] uppercase">{shot.title}</h3>
        <div className="flex flex-wrap gap-2">
          {shot.tags.map((t) => (
            <span key={t} className="border border-white/30 bg-white/5 px-[9px] py-1.5 font-mono text-[0.65625rem] leading-none tracking-[0.08em] text-white/85 uppercase">
              {t}
            </span>
          ))}
        </div>
        <span className="sr-only">
          Part {index + 1} of {total}
        </span>
      </figcaption>
    </figure>
  );
}

export function Parts() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const travel = useRef(0);
  const [current, setCurrent] = useState(0);
  const narrow = useMediaQuery("(max-width: 760px)");
  const inView = useInView(section, { margin: "25% 0px 25% 0px" });

  const update = useCallback(() => {
    const sec = section.current;
    const tr = track.current;
    if (!sec || !tr) return;
    let p: number;
    if (!narrow) {
      const r = sec.getBoundingClientRect();
      p = Math.min(1, Math.max(0, -r.top / Math.max(1, sec.offsetHeight - window.innerHeight)));
      tr.style.transform = `translate3d(${(-p * travel.current).toFixed(1)}px,0,0)`;
    } else {
      p = tr.scrollLeft / Math.max(1, tr.scrollWidth - tr.clientWidth);
    }
    if (bar.current) bar.current.style.width = `${(p * 100).toFixed(1)}%`;
    let best = 0;
    let bestD = Infinity;
    tr.querySelectorAll("figure").forEach((f, i) => {
      const b = f.getBoundingClientRect();
      const d = Math.abs(b.left + b.width / 2 - window.innerWidth / 2);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setCurrent(best);
  }, [narrow]);

  // One scroll source (Lenis): the section is as tall as the track's sideways travel plus one screen.
  useLenis(update);
  useLayoutEffect(() => {
    const layout = () => {
      const sec = section.current;
      const tr = track.current;
      if (!sec || !tr) return;
      if (narrow) {
        sec.style.height = "";
        tr.style.transform = "";
        travel.current = 0;
      } else {
        travel.current = Math.max(0, tr.scrollWidth - window.innerWidth);
        sec.style.height = `${travel.current + window.innerHeight}px`;
      }
      update();
    };
    layout();
    window.addEventListener("resize", layout);
    return () => window.removeEventListener("resize", layout);
  }, [narrow, update]);
  useEffect(() => {
    const tr = track.current;
    if (!narrow || !tr) return;
    tr.addEventListener("scroll", update, { passive: true });
    return () => tr.removeEventListener("scroll", update);
  }, [narrow, update]);

  return (
    <section
      ref={section}
      id="parts"
      aria-labelledby="parts-title"
      className="relative isolate w-full border-t border-white/10 bg-[#0a0b0d] max-[760px]:py-14"
    >
      {inView && (
        <Canvas
          className="inset-0 z-0"
          style={{ position: "fixed", pointerEvents: "none" }} // R3F sets the wrapper style inline
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
          aria-hidden="true"
        >
          <ClearPass />
          <View.Port />
        </Canvas>
      )}
      <div className="sticky top-0 flex h-svh items-center overflow-hidden max-[760px]:static max-[760px]:block max-[760px]:h-auto">
        <div
          ref={track}
          className="relative z-10 flex items-center gap-[clamp(1rem,2.2vw,2.25rem)] px-[clamp(1.25rem,3.3vw,3.375rem)] will-change-transform max-[760px]:snap-x max-[760px]:snap-mandatory max-[760px]:overflow-x-auto max-[760px]:pb-2 max-[760px]:[scrollbar-width:none]"
        >
          <div className="grid w-[min(30vw,26.25rem)] flex-none gap-[clamp(0.875rem,1.6vw,1.5rem)] max-[760px]:w-[78vw] max-[760px]:snap-start">
            <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-[#cfe9f5]/60 uppercase">/ Concept airframe</span>
            <h2 id="parts-title" className="m-0 text-[clamp(2.125rem,4vw,4rem)] leading-[0.9] font-semibold tracking-[-0.045em] uppercase">
              <span className="block">The airframe</span>
              <span className="block">up close</span>
            </h2>
            <p className="m-0 max-w-[34ch] text-[clamp(0.875rem,1.05vw,1.03rem)] leading-[1.45] text-white/80">
              Raven&apos;s concept hexacopter: six rotors, a medical case beneath the body and a sensor head at the nose. Live views of the 3D
              model, not a certified specification.
            </p>
          </div>
          {SHOTS.map((s, i) => (
            <Card key={s.title} shot={s} index={i} total={SHOTS.length} />
          ))}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[clamp(1.25rem,3.3vw,3.375rem)] bottom-[clamp(1.125rem,2.4vw,2.125rem)] left-[clamp(1.25rem,3.3vw,3.375rem)] z-10 flex items-center gap-4 max-[760px]:static max-[760px]:mt-4"
        >
          <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-[#cfe9f5]/60 uppercase">
            <b className="font-medium text-white">{String(current + 1).padStart(2, "0")}</b> / {String(SHOTS.length).padStart(2, "0")}
          </span>
          <span className="relative h-px flex-1 bg-[#cfe9f5]/15">
            <i ref={bar} className="absolute inset-y-0 left-0 w-0 bg-[#cfe9f5]/70" />
          </span>
        </div>
      </div>
    </section>
  );
}
