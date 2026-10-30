"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import clsx from "clsx";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type * as THREE from "three";
import { SCENE, useScenes } from "@/lib/scenes";
import { useMediaQuery } from "@/lib/use-media-query";

/** Characters fade in a shuffled order over the stagger window (shipped `ti`). */
export function ShuffledText({
  text,
  baseDelay,
  staggerAmount = 0.2,
  shouldAnimate,
}: {
  text: string;
  baseDelay: number;
  staggerAmount?: number;
  shouldAnimate: boolean;
}) {
  const delays = useMemo(() => {
    const chars = text.split("");
    const order = chars.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const step = staggerAmount / chars.length;
    return order.map((o) => baseDelay + o * step);
  }, [text, baseDelay, staggerAmount]);
  return (
    <>
      {text.split("").map((c, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: shouldAnimate ? 1 : 0 }}
          transition={{ duration: 0.25, delay: shouldAnimate ? delays[i] : 0, ease: "linear" }}
          style={{ display: c === " " ? "inline" : "inline-block" }}
        >
          {c === " " ? " " : c}
        </motion.span>
      ))}
    </>
  );
}

function Tag({ text, staggerIndex }: { text: string; staggerIndex: number }) {
  const show = useScenes((s) => s[SCENE.SWARM_SCENE].progress > 0.9 && s[SCENE.MISSION_PRESET].progress < 0.1);
  const delay = 0.15 * staggerIndex;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: 0.5, delay: show ? delay : 0, ease: "easeOut" }}
      className="text-d-mono bg-white px-1 py-0.5 font-mono whitespace-nowrap text-black"
    >
      <ShuffledText text={text} baseDelay={delay} staggerAmount={0.2} shouldAnimate={show} />
    </motion.div>
  );
}

type Props = {
  mainRef: RefObject<THREE.Group | null>;
  drone2Ref: RefObject<THREE.Group | null>;
  drone3Ref: RefObject<THREE.Group | null>;
};

/** Aircraft tags (shipped DSA011/012/013, Raven names) + dashed links between them (shipped `ts`). Desktop/tablet only. */
export function SwarmTags({ mainRef, drone2Ref, drone3Ref }: Props) {
  const size = useThree((s) => s.size);
  const md = useMediaQuery("(min-width: 768px)");
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!md) return setEnabled(false);
    const id = setTimeout(() => setEnabled(true), 20);
    return () => clearTimeout(id);
  }, [md]);

  const a1 = useRef<THREE.Group>(null);
  const a2 = useRef<THREE.Group>(null);
  const a3 = useRef<THREE.Group>(null);
  const show = useScenes((s) => s[SCENE.SWARM_SCENE].progress > 0.9 && s[SCENE.MISSION_PRESET].progress < 0.001);
  const tag1 = useRef<HTMLDivElement>(null);
  const tag2 = useRef<HTMLDivElement>(null);
  const tag3 = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const line1 = useRef<SVGLineElement>(null);
  const line2 = useRef<SVGLineElement>(null);

  useFrame(() => {
    const pairs: [RefObject<THREE.Group | null>, RefObject<THREE.Group | null>][] = [
      [mainRef, a1],
      [drone2Ref, a2],
      [drone3Ref, a3],
    ];
    for (const [src, dst] of pairs) {
      if (src.current && dst.current) {
        src.current.getWorldPosition(dst.current.position);
        dst.current.visible = src.current.visible;
      }
    }
    if (!svg.current || !line1.current || !line2.current || !tag1.current || !tag2.current || !tag3.current || !show) return;
    const c = svg.current.getBoundingClientRect();
    const b2 = tag2.current.getBoundingClientRect();
    const b1 = tag1.current.getBoundingClientRect();
    const b3 = tag3.current.getBoundingClientRect();
    line1.current.setAttribute("x1", `${b2.right - c.left - 1}`);
    line1.current.setAttribute("y1", `${b2.top - c.top + 1}`);
    line1.current.setAttribute("x2", `${b1.left - c.left + 1}`);
    line1.current.setAttribute("y2", `${b1.top - c.top + 1}`);
    line2.current.setAttribute("x1", `${b1.right - c.left - 1}`);
    line2.current.setAttribute("y1", `${b1.bottom - c.top - 1}`);
    line2.current.setAttribute("x2", `${b3.left - c.left + 1}`);
    line2.current.setAttribute("y2", `${b3.top - c.top + 1}`);
  });

  if (!enabled) return null;
  return (
    <>
      <Html fullscreen className="pointer-events-none">
        <svg
          ref={svg}
          width={size.width}
          height={size.height}
          className={clsx(
            "pointer-events-none absolute top-0 left-0 overflow-visible transition-opacity",
            show ? "opacity-100" : "opacity-0",
          )}
          aria-hidden="true"
        >
          <line ref={line1} stroke="white" strokeWidth={1} strokeDasharray="3 2.5" opacity="0.8" />
          <line ref={line2} stroke="white" strokeWidth={1} strokeDasharray="3 2.5" opacity="0.8" />
        </svg>
      </Html>
      <group ref={a1}>
        <Html center>
          <div ref={tag1} className="inline-block">
            <Tag text="RAVEN-01" staggerIndex={0} />
          </div>
        </Html>
      </group>
      <group ref={a2}>
        <Html center>
          <div ref={tag2} className="inline-block">
            <Tag text="RAVEN-02" staggerIndex={1} />
          </div>
        </Html>
      </group>
      <group ref={a3}>
        <Html center>
          <div ref={tag3} className="inline-block">
            <Tag text="RAVEN-03" staggerIndex={2} />
          </div>
        </Html>
      </group>
    </>
  );
}
