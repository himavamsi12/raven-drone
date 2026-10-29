"use client";

import { Html } from "@react-three/drei";
import type { ReactNode } from "react";

/** Html laid flat on the ground plane (shipped `ej`). */
export function GroundHtml({
  position,
  children,
  sprite,
  transform = true,
  zIndexRange = [100, 200],
}: {
  position: [number, number, number];
  children: ReactNode;
  sprite?: boolean;
  transform?: boolean;
  zIndexRange?: [number, number];
}) {
  return (
    <Html
      transform={transform}
      sprite={sprite}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={0.45}
      position={position}
      zIndexRange={zIndexRange}
    >
      {children}
    </Html>
  );
}
