"use client";

import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";

/**
 * WebGL markers for the clay landscape (user, 2026-11-03: "the extra [frame] during the diagonal transition is still
 * coming"). The diagonal wipe shows a capture of the landscape rendered off screen (PostFX preroll); DOM overlays
 * cannot be in it, so the checkpoint pins and the drone's altitude tag appeared only after the cut. Drawn in WebGL
 * they are in the capture and the cut lands on the exact live frame. Same look as the earlier DOM versions (ref pins:
 * dark "+" disc on a stem, mono label).
 *
 * Sizes are in CSS pixels: `PixelBillboard` faces the camera and scales its children so 1 unit = 1 screen px at its
 * own depth. Drawn last, without depth test, like screen overlays.
 */
const ORDER = 900;
const FONT = ASSETS.geistMono;
const LABEL_PX = 12;
const TRACKING = 0.12;

function overlayMaterial(color: THREE.ColorRepresentation, opacity: number) {
  return new THREE.MeshBasicMaterial({ color, opacity, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
}

const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();

/** Faces the camera; 1 unit = 1 CSS pixel at the group's depth. */
export function PixelBillboard({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const height = useThree((s) => s.size.height);
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g?.parent) return;
    const cam = camera as THREE.PerspectiveCamera;
    g.parent.updateWorldMatrix(true, false);
    // face the camera: world camera rotation expressed in the parent's frame
    g.parent.getWorldQuaternion(_q).invert();
    cam.getWorldQuaternion(g.quaternion).premultiply(_q);
    const depth = g.getWorldPosition(_p).sub(cam.getWorldPosition(_c)).dot(cam.getWorldDirection(_d));
    g.scale.setScalar(Math.max(depth, 1e-3) * (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / height);
  });
  return <group ref={ref}>{children}</group>;
}

function Label({ text, x, y, opacity }: { text: string; x: number; y: number; opacity: number }) {
  return (
    <Text
      font={FONT}
      fontSize={LABEL_PX}
      letterSpacing={TRACKING}
      anchorX="left"
      anchorY="middle"
      position={[x, y, 0]}
      renderOrder={ORDER + 2}
    >
      {text}
      <meshBasicMaterial color="white" opacity={opacity} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </Text>
  );
}

/** Checkpoint pin standing on its site: stem, dark disc with "+", label to the right. */
export function Pin({ name, stem }: { name: string; stem: number }) {
  const m = useMemo(
    () => ({
      stem: overlayMaterial("white", 0.5),
      disc: overlayMaterial("#161616", 0.9),
      ring: overlayMaterial("white", 0.3),
      plus: overlayMaterial("white", 1),
    }),
    [],
  );
  const r = 18;
  const cy = stem + r;
  return (
    <PixelBillboard>
      <mesh position={[0, stem / 2, 0]} material={m.stem} renderOrder={ORDER}>
        <planeGeometry args={[1, stem]} />
      </mesh>
      <mesh position={[0, cy, 0]} material={m.disc} renderOrder={ORDER + 1}>
        <circleGeometry args={[r, 48]} />
      </mesh>
      <mesh position={[0, cy, 0]} material={m.ring} renderOrder={ORDER + 2}>
        <ringGeometry args={[r - 1, r, 48]} />
      </mesh>
      <mesh position={[0, cy, 0]} material={m.plus} renderOrder={ORDER + 2}>
        <planeGeometry args={[12, 1.5]} />
      </mesh>
      <mesh position={[0, cy, 0]} material={m.plus} renderOrder={ORDER + 2}>
        <planeGeometry args={[1.5, 12]} />
      </mesh>
      <Label text={name.toUpperCase()} x={r + 12} y={cy} opacity={0.7} />
    </PixelBillboard>
  );
}

/** Live values for the altitude tag, written by ClayFlight each frame. */
export type AltitudeState = { climb: number; dir: -1 | 0 | 1; status: string };

type TroikaText = THREE.Mesh & { text: string; sync: () => void };

/** Altitude tag beside the drone: relative gauge, direction arrow, status line. */
export function AltitudeTag({ state }: { state: AltitudeState }) {
  const fill = useRef<THREE.Mesh>(null);
  const arrow = useRef<THREE.Mesh>(null);
  const status = useRef<TroikaText>(null);
  const shown = useRef("");
  const m = useMemo(() => ({ frame: overlayMaterial("white", 0.4), fill: overlayMaterial("white", 1) }), []);
  const arrowGeometry = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-4, -3);
    s.lineTo(4, -3);
    s.lineTo(0, 4);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  const gx = 28; // gauge left edge (px right of the drone centre)
  const gw = 6;
  const gh = 40;
  const tx = gx + gw + 10;

  useFrame(() => {
    if (fill.current) {
      const k = Math.max(state.climb, 0.001);
      fill.current.scale.y = k;
      fill.current.position.y = -gh / 2 + (gh * k) / 2;
    }
    if (arrow.current) {
      arrow.current.visible = state.dir !== 0;
      arrow.current.rotation.z = state.dir < 0 ? Math.PI : 0;
    }
    const t = status.current;
    if (t && shown.current !== state.status) {
      shown.current = state.status;
      t.text = state.status;
      t.sync();
    }
  });

  return (
    <PixelBillboard>
      {/* gauge frame (four 1px edges) and fill */}
      <mesh position={[gx + gw / 2, gh / 2, 0]} material={m.frame} renderOrder={ORDER}>
        <planeGeometry args={[gw, 1]} />
      </mesh>
      <mesh position={[gx + gw / 2, -gh / 2, 0]} material={m.frame} renderOrder={ORDER}>
        <planeGeometry args={[gw, 1]} />
      </mesh>
      <mesh position={[gx, 0, 0]} material={m.frame} renderOrder={ORDER}>
        <planeGeometry args={[1, gh]} />
      </mesh>
      <mesh position={[gx + gw, 0, 0]} material={m.frame} renderOrder={ORDER}>
        <planeGeometry args={[1, gh]} />
      </mesh>
      <mesh ref={fill} position={[gx + gw / 2, -gh / 2, 0]} material={m.fill} renderOrder={ORDER + 1}>
        <planeGeometry args={[gw - 2, gh - 2]} />
      </mesh>
      <Label text="ALTITUDE" x={tx} y={8} opacity={0.6} />
      <mesh ref={arrow} position={[tx + 4, -8, 0]} geometry={arrowGeometry} material={m.fill} renderOrder={ORDER + 2} />
      <Text
        ref={status as never}
        font={FONT}
        fontSize={LABEL_PX}
        letterSpacing={TRACKING}
        anchorX="left"
        anchorY="middle"
        position={[tx + 14, -8, 0]}
        renderOrder={ORDER + 2}
      >
        {"READY"}
        <meshBasicMaterial color="white" transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </Text>
    </PixelBillboard>
  );
}
