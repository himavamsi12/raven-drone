"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
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

type Props = { mainRef: RefObject<THREE.Group | null> };

/**
 * Aircraft tag (shipped DSA011/012/013 tags + dashed links, `ts`). Raven: only the hero drone flies (user,
 * 2026-11-02), so one tag, RAVEN-01, and no links. Desktop/tablet only.
 */
export function SwarmTags({ mainRef }: Props) {
  const md = useMediaQuery("(min-width: 768px)");
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!md) return setEnabled(false);
    const id = setTimeout(() => setEnabled(true), 20);
    return () => clearTimeout(id);
  }, [md]);

  const anchor = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!mainRef.current || !anchor.current) return;
    mainRef.current.getWorldPosition(anchor.current.position);
    anchor.current.visible = mainRef.current.visible;
  });

  if (!enabled) return null;
  return (
    <group ref={anchor}>
      <Html center>
        <div className="inline-block">
          <Tag text="RAVEN-01" staggerIndex={0} />
        </div>
      </Html>
    </group>
  );
}
