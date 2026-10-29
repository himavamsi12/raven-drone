"use client";

import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import { RENDER_ORDER, resolution } from "@/lib/constants";
import { easeInOutCubic, remapEased } from "@/lib/math";
import { SCENE, scenes } from "@/lib/scenes";
import { useMediaQuery } from "@/lib/use-media-query";
import { computeScreenUv } from "./shaders/screen-uv";

/** Sprite-sheet fire/smoke (shipped class `B`). Left 8 columns = smoke, right 8 = fire. */
class FireMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: /* glsl */ `
uniform sampler2D uFireTexture;
uniform float uTime;
uniform float uSpeed;
uniform float uFramesPerRow;
uniform float uTextureColumns;
uniform float uColumnOffset;
uniform int uOffset;
uniform float uOpacity;
uniform float uHideRatio;
uniform vec2 uResolution;
varying vec2 vUv;

${computeScreenUv}

void main() {
    vec2 screenUv = computeScreenUv();
    float hideMask = screenUv.x < uHideRatio ? 0.0 : 1.0;
    if (hideMask < 0.001) discard;
    float totalFrames = uFramesPerRow * uFramesPerRow;
    float frameIndex = mod(floor(uTime * uSpeed) + float(uOffset), totalFrames);
    float row = floor(frameIndex / uFramesPerRow);
    float col = mod(frameIndex, uFramesPerRow);
    vec2 frameSize = vec2(1.0 / uTextureColumns, 1.0 / uFramesPerRow);
    vec2 frameOffset = vec2((uColumnOffset + col) / uTextureColumns, row / uFramesPerRow);
    vec2 frameUv = vUv * frameSize + frameOffset;
    vec4 color = texture2D(uFireTexture, frameUv);
    gl_FragColor = color;
    gl_FragColor.a *= uOpacity;
}`,
      uniforms: {
        uFireTexture: { value: null },
        uTime: { value: 0 },
        uSpeed: { value: 14 },
        uFramesPerRow: { value: 8 },
        uTextureColumns: { value: 16 },
        uColumnOffset: { value: 0 },
        uOffset: { value: 0 },
        uOpacity: { value: 1 },
        uHideRatio: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
  }
}

type SpriteProps = {
  position: [number, number, number];
  scale: number;
  rotation?: number;
  flipY?: boolean;
  isFire?: boolean;
};

function FireSprite({ position, scale, rotation = 0, flipY = false, isFire = false }: SpriteProps) {
  const material = useMemo(() => new FireMaterial(), []);
  const tex = useTexture(ASSETS.fire, (t) => {
    const x = Array.isArray(t) ? t[0] : t;
    x.flipY = false;
  });
  useEffect(() => {
    material.uniforms.uFireTexture.value = tex;
    material.uniforms.uColumnOffset.value = isFire ? 0 : 8;
    material.uniforms.uOpacity.value = isFire ? 0.35 : 0.4;
  }, [isFire, tex, material]);
  useFrame((state) => {
    const p = scenes()[SCENE.PHALANX_AI].progress;
    material.uniforms.uTime.value = state.clock.getElapsedTime();
    material.uniforms.uResolution.value.copy(resolution);
    material.uniforms.uHideRatio.value = remapEased(p, 0, 0.5, 0, 1, easeInOutCubic) || 0;
  });
  return (
    <mesh
      scale={[scale * (flipY ? -1 : 1), scale, scale]}
      rotation={[-Math.PI / 2, 0, rotation]}
      position={position}
      renderOrder={isFire ? RENDER_ORDER.FIRE : RENDER_ORDER.SMOKE}
      material={material}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

/** Three fire clusters on the city tile (shipped `H`, `q`, `Y`, `Q`). */
export function FireGroups() {
  const ref = useRef<THREE.Group>(null);
  const isMd = useMediaQuery("(min-width: 768px)");
  useFrame(() => {
    const s = scenes();
    const ign = s[SCENE.IGNITION_VERIFIED].progress;
    const ph = s[SCENE.PHALANX_AI].progress;
    if (ref.current) ref.current.visible = ign > (isMd ? 0.5 : 0.01) && ph < 0.5;
  });
  return (
    <group ref={ref}>
      <group rotation={[0, 0.1, 0]} position={[16, 0, -10]}>
        <group>
          <FireSprite position={[0, 0, 0]} scale={48} rotation={0.5} />
          <FireSprite position={[8, 0, 0]} scale={48} rotation={0.5} />
          <FireSprite position={[20.5, 0, -1]} scale={38} rotation={0.38} flipY />
        </group>
        <group position={[4, 0, 12]}>
          <FireSprite isFire position={[0, 0, 0]} scale={24} rotation={0.5} />
          <FireSprite isFire position={[8, 0, 0]} scale={24} rotation={0.5} />
          <FireSprite isFire position={[21, 0, -4]} scale={19} rotation={0.25} flipY />
        </group>
      </group>
      <group rotation={[0, -0.4, 0]} position={[-54, 0, -56]}>
        <FireSprite position={[16, 0, 0]} scale={42} rotation={0.5} />
        <FireSprite position={[25, 0, 2]} scale={42} rotation={1} />
        <FireSprite position={[30, 0, -6]} scale={42} rotation={1} flipY />
        <FireSprite position={[40, 0, -7]} scale={42} rotation={0.5} />
        <group position={[6, 0, 8]}>
          <FireSprite position={[13, 0, 2.5]} scale={21} rotation={0.5} isFire />
          <FireSprite position={[24, 0, 2.2]} scale={21} rotation={0.9} isFire />
          <FireSprite position={[35, 0, -3]} scale={21} rotation={0} flipY isFire />
          <FireSprite position={[40.5, 0, -4.5]} scale={21} rotation={0.6} isFire />
        </group>
      </group>
      <group rotation={[0, 0.35, 0]} position={[-7, 0, -12]}>
        <FireSprite position={[-39, 0, 1.25]} scale={40} flipY rotation={0} />
        <FireSprite isFire position={[-38, 0, 12]} scale={20} flipY />
      </group>
    </group>
  );
}
