"use client";

import { AdaptiveDpr, Environment, Lightformer, Text, useFBO, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import clsx from "clsx";
import { useLenis } from "lenis/react";
import { KawaseBlurPass, KernelSize } from "postprocessing";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RavenModel } from "@/components/scene/Drone";
import { ASSETS } from "@/lib/assets";
import { useLoading } from "@/lib/loading";
import { useMouse } from "@/lib/scenes";
import { clamp, remap, smoothstep } from "@/lib/math";
import { useMediaQuery } from "@/lib/use-media-query";
import { FLIGHT, FloatBob, landingPose, landingProgress, PointerLean, turretPivot, type LandingPose } from "./drone-flight";
import { TEAM_TEXT } from "./Sections";
import { WORDMARK, WORDMARK_BOXES, WORDMARK_CAP } from "./HeroLogo";

/**
 * Last drone y-offset of the shipped landing frames in a 1920px frame (module 90999, frame 96): the pad. The shipped
 * scroll-stepped descent along those frames was replaced by the Raven flight model (drone-flight.ts, 2026-11-01).
 */
const FRAME_Y_LANDED = 1587;

type Progress = {
  progress: React.RefObject<number>;
  total: React.RefObject<number>;
  team: React.RefObject<number>;
};

/** Footer-region scroll progress (shipped module 68363). */
function useLandingProgress(): Progress {
  const lenis = useLenis();
  const progress = useRef(0);
  const total = useRef(0);
  const team = useRef(0);
  useEffect(() => {
    if (!lenis) return;
    const on = () => {
      const footerH = document.getElementById("footer")?.offsetHeight ?? 1;
      team.current = document.getElementById("our-team")?.offsetHeight ?? 1;
      total.current = footerH + team.current + 220;
      const start = (lenis.limit ?? 0) - total.current;
      progress.current = clamp(((lenis.scroll ?? 0) - start) / total.current, 0, 1);
    };
    on();
    lenis.on("scroll", on);
    window.addEventListener("resize", on);
    return () => {
      lenis.off("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [lenis]);
  return { progress, total, team };
}

const CAPSULE_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uBlurredScene;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
float sdUnevenCapsule(vec2 p, float r1, float r2, float h) {
    p.x = abs(p.x);
    float b = (r1 - r2) / h;
    float a = sqrt(1.0 - b * b);
    float k = dot(p, vec2(-b, a));
    if (k < 0.0) return length(p) - r1;
    if (k > a * h) return length(p - vec2(0.0, h)) - r2;
    return dot(p, vec2(a, b)) - r1;
}
void main() {
    vec2 screenUv = gl_FragCoord.xy / uResolution;
    float d = sdUnevenCapsule(vec2(1.0 + 0.025 * sin(64.0 * uTime), 0.5 + 0.01 * sin(32.0 * uTime)) * (vUv - 0.5), uOpacity * 0.1 + 0.1, uOpacity * 0.1 + 0.5, uOpacity * 0.1 + 0.4);
    float alpha = smoothstep(0., -0.1, d);
    float distortion = sin(3.14 * mod(d, 0.05) * 40.0 - 90.0 * uTime) * 0.5 + 0.5;
    vec4 blurredScene = texture2D(uBlurredScene, screenUv + 0.001 * distortion);
    vec3 sceneColor = pow(blurredScene.rgb, vec3(2.2));
    gl_FragColor.rgb = uColor * 0.5 * pow(vUv.y, 4.0) + (0.5 + 0.5 * uColor) * sceneColor;
    gl_FragColor.a = alpha * smoothstep(0.0, 0.1, uOpacity);
}`;

/** Drone centre offset in a frame (measured on frame 96) and its landed place inside the frame, as a share of the frame. */
const FRAME_DRONE_Y = -284;
const _e = new THREE.Euler();
/** Share of the pointer drift/lift kept toward the footer copy (lower left). */
const COPY_SIDE_DAMP = 0.4;
const PAD_Y = 0.5 - (FRAME_Y_LANDED + FRAME_DRONE_Y) / 1920;
/** Drone size as a fraction of the frame (the 96 renders showed it ~0.8 frame wide). */
const DRONE_SCALE = 0.36;
/** Base nose dip: enough that the spinning rotor discs read from the front instead of edge-on. */
const DRONE_PITCH = 0.3;

/** Studio-ish light for the landing drone: soft key overhead, cool rims (pixel-space scene, so directions only). */
function LandingLight() {
  return (
    <>
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 4, 1]} rotation={[Math.PI / 2, 0, 0]} scale={[6, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#cfe9f5" position={[-4, 1, 2]} rotation={[0, Math.PI / 2.6, 0]} scale={[0.6, 5, 1]} />
        <Lightformer form="rect" intensity={1} color="#cfe9f5" position={[4, 1, 2]} rotation={[0, -Math.PI / 2.4, 0]} scale={[0.5, 5, 1]} />
      </Environment>
      <directionalLight position={[-0.4, 1, 0.8]} intensity={1.4} />
      <ambientLight intensity={0.1} />
    </>
  );
}

/**
 * Landing drone + capsule (shipped `y` in module 73560). Raven: the 96 pre-rendered frames (old quad) are replaced by
 * the live raven_hexa model. The frame travel (scroll) still places the pad; the drone's flight onto it follows the
 * drone.riotters.com character (drone-flight.ts): a timed banked glide-in and vertical let-down, a slow float, and a
 * lean / landed tilt that follows the pointer.
 */
function Sequence({ p, active }: { p: Progress; active: boolean }) {
  const frame = useRef<THREE.Group>(null);
  const drone = useRef<THREE.Group>(null);
  const capsuleAnchor = useRef<THREE.Mesh>(null);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const dpr = useThree((s) => s.viewport.dpr);
  const size = 0.95 * height;
  const hover = useRef<THREE.Group>(null);
  const turret = useRef<THREE.Group | null>(null);
  const flight = useRef({ playing: false, t: 0 });
  const floatBob = useRef(new FloatBob());
  const lean = useRef(new PointerLean());
  const pose = useRef<LandingPose>({ height: 0, scale: 1, yaw: 0, pitch: 0, roll: 0 });
  const onObject = useCallback((object: THREE.Object3D) => {
    turret.current = turretPivot(object);
  }, []);
  // The canvas stops rendering once the footer region has scrolled away: reset there, so the landing plays again.
  useEffect(() => {
    if (!active) flight.current.playing = false;
  }, [active]);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // The loader waits for the footer sequence; the model is already cached by the main scene.
  useEffect(() => {
    const t = setTimeout(() => useLoading.getState().setImageSequenceLoaded(true), 25);
    return () => clearTimeout(t);
  }, []);
  const capsuleUniforms = useMemo(
    () => ({
      uBlurredScene: { value: null as THREE.Texture | null },
      uResolution: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#ffffff") },
      uOpacity: { value: 0 },
    }),
    [],
  );
  const blur = useMemo(() => new KawaseBlurPass({ kernelSize: KernelSize.SMALL }), []);
  const blurred = useFBO(1, 1, { minFilter: THREE.LinearFilter });
  useEffect(() => () => blur.dispose(), [blur]);

  useFrame(({ gl, scene, camera, clock }, dt) => {
    if (!frame.current || !drone.current || !capsuleAnchor.current) return;
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    const c = p.progress.current;
    capsuleAnchor.current.position.x = 0.5 * width;
    const travel = height - size;
    frame.current.position.y = remap(c, 0.75, 1, 0, -travel) - 0.5 * size + 0.05 * height + 20;
    frame.current.position.x = 0.5 * width;
    // Raven flight (drone-flight.ts, after drone.riotters.com): the pad is the last FRAME_Y position inside the scrolling
    // frame; the landing itself plays in time once the footer is 30% visible and replays after it has left the view.
    drone.current.position.y = PAD_Y * size;
    const footer = document.getElementById("footer")?.getBoundingClientRect();
    const seen = footer && footer.height > 0 ? (Math.min(footer.bottom, height) - Math.max(footer.top, 0)) / footer.height : 0;
    const f = flight.current;
    if (!f.playing && seen >= FLIGHT.playVisible) {
      f.playing = true;
      f.t = 0;
      floatBob.current.reset();
      lean.current.reset();
    } else if (f.playing && seen <= 0) f.playing = false;
    const motion = hover.current;
    if (motion) {
      const unit = DRONE_SCALE * size; // px per model unit; the drone is 2 units (one drone width) across
      if (reducedMotion) {
        motion.visible = true;
        motion.position.set(0, 0, 0);
        motion.quaternion.identity();
        motion.scale.setScalar(1);
      } else {
        motion.visible = f.playing;
        if (f.playing) f.t += Math.min(dt, 1 / 20);
        const n = landingProgress(f.t);
        // Start above the top of the screen: pad height on screen + the drone's own half height, in drone widths.
        const padTop = -(frame.current.position.y + drone.current.position.y);
        landingPose(n, (padTop + 0.6 * unit) / (2 * unit), pose.current);
        const { x, y } = useMouse.getState();
        lean.current.update(dt, x, -y, n);
        const bob = floatBob.current.update(dt);
        // The footer copy and CTA sit lower left: drift and lift toward them are damped so the drone never slides over
        // the text the pointer is heading for (Raven layout adaptation; right and up keep the reference range).
        const sx = lean.current.shift.x < 0 ? COPY_SIDE_DAMP * lean.current.shift.x : lean.current.shift.x;
        const sy = lean.current.shift.y < 0 ? COPY_SIDE_DAMP * lean.current.shift.y : lean.current.shift.y;
        motion.position.set(2 * sx, 2 * (pose.current.height + bob + sy), 0);
        motion.scale.setScalar(pose.current.scale);
        _e.set(pose.current.pitch, pose.current.yaw, pose.current.roll, "YXZ");
        motion.quaternion.setFromEuler(_e).premultiply(lean.current.offset);
        const head = turret.current;
        if (head) head.rotation.set(lean.current.head.pitch, lean.current.head.yaw, 0, "YXZ");
      }
    }
    capsuleUniforms.uBlurredScene.value = blurred.texture;
    capsuleUniforms.uResolution.value.set(width * dpr, height * dpr);
    capsuleUniforms.uTime.value += dt;
    // Downwash shimmer under the drone while it glides in (was the jet capsule on the shipped descent).
    const glide = flight.current.playing && !reducedMotion ? 1 - smoothstep(0.35, FLIGHT.approachEnd, landingProgress(flight.current.t)) : 0;
    capsuleAnchor.current.position.y = frame.current.position.y + drone.current.position.y + (hover.current?.position.y ?? 0) * DRONE_SCALE * size - 0.05 * size;
    capsuleUniforms.uOpacity.value = glide * 0.15;
  });

  return (
    <group>
      <mesh ref={capsuleAnchor} renderOrder={1} scale={size}>
        <mesh
          renderOrder={1}
          onBeforeRender={(gl) => {
            const t = gl.getRenderTarget();
            if (!t) return;
            gl.setRenderTarget(null);
            const w = Math.floor(0.5 * t.width);
            const h = Math.floor(0.5 * t.height);
            blurred.setSize(w, h);
            blur.setSize(w, h);
            blur.render(gl, t, blurred);
            gl.setRenderTarget(t);
          }}
        >
          <planeGeometry args={[0.075, 0.15]} />
          <shaderMaterial
            transparent
            uniforms={capsuleUniforms}
            vertexShader="varying vec2 vUv; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vUv = uv; }"
            fragmentShader={CAPSULE_FRAG}
          />
        </mesh>
      </mesh>
      <group ref={frame}>
        <group ref={drone} scale={DRONE_SCALE * size}>
          {/* `hover`: landing flight, float and pointer lean (camera-space offsets). Inside: front to camera, nose dipped
              so the deck and rotor discs read. */}
          <group ref={hover}>
            <group rotation={[DRONE_PITCH, Math.PI, 0]}>
              <RavenModel span={2} onObject={onObject} />
            </group>
          </group>
        </group>
      </group>
      <LandingLight />
    </group>
  );
}

/** Top background fade (shipped `R`). */
function TopFade({ p }: { p: Progress }) {
  const [u] = useState(() => ({ uBgColor: { value: new THREE.Color(0x000000) }, uOpacity: { value: 0 } }));
  useFrame(() => {
    u.uOpacity.value = remap(p.progress.current, 0.33, 0.5, 1, 0) * remap(p.progress.current, 0, 0.33, 0, 1);
  });
  return (
    <mesh renderOrder={100}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        depthTest={false}
        uniforms={u}
        vertexShader="varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.x, position.y, 0.0, 1.0); }"
        fragmentShader="varying vec2 vUv; uniform vec3 uBgColor; uniform float uOpacity; void main(){ gl_FragColor.rgb = uBgColor; gl_FragColor.a = uOpacity * smoothstep(0.7, 1.0, vUv.y); }"
      />
    </mesh>
  );
}

/** Warm ground glow that rises with the landing (shipped `N`). */
function GroundGlow({ p }: { p: Progress }) {
  const ref = useRef<THREE.Mesh>(null);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const noise = useTexture(ASSETS.blueNoise);
  const [u] = useState(() => ({
    uOpacity: { value: 0 },
    uColor: { value: new THREE.Color("#ffffff") },
    uBlueNoiseTexture: { value: null as THREE.Texture | null },
    uHeat: { value: 0 },
  }));
  useFrame(() => {
    if (!ref.current) return;
    const c = p.progress.current;
    u.uOpacity.value = remap(c, 0.925, 1, 0, 1);
    u.uBlueNoiseTexture.value = noise as THREE.Texture;
    ref.current.position.set(0.5 * width, remap(c, 0, 1, -(2 * height), -(0.9 * height)) + 0.07 * height, 0);
    ref.current.rotation.set(-Math.PI / 1.8, 0, Math.PI / 2.5);
    ref.current.scale.setScalar(600);
    u.uHeat.value = remap(c, 0.95, 1, 1, 0);
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        transparent
        uniforms={u}
        vertexShader="varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader={`varying vec2 vUv; uniform float uOpacity; uniform vec3 uColor; uniform sampler2D uBlueNoiseTexture; uniform float uHeat;
void main() {
  vec2 s = vec2(textureSize(uBlueNoiseTexture, 0));
  vec4 b = texture2D(uBlueNoiseTexture, gl_FragCoord.xy / s);
  float dist = length(vec2(3.0, 2.0) * (vUv - 0.5));
  float circle = smoothstep(0.9, 0.0, dist);
  float circleHeat = smoothstep(0.2, 0.0, dist);
  float circleLight = smoothstep(0.3, 0.0, dist);
  vec3 heat = uHeat * (0.03 * vec3(1.0, 0.3, 0.3) * circleHeat + 0.01 * vec3(0.0, 1.0, 1.0) * circleLight);
  gl_FragColor = vec4(0.05 * uColor + 0.25 * heat, uOpacity * circle + b.x / 255.0);
}`}
      />
    </mesh>
  );
}

function useRect(selector: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const on = () => setRect(document.querySelector(selector)?.getBoundingClientRect() ?? null);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [selector]);
  return rect;
}

/**
 * Raven wordmark alpha, laid out like the SVG wordmark (caps on the baseline, letters spread to the box width).
 * Replaces the shipped logo-desktop.webp (USAvionix) that module 38219 outlines.
 */
function useWordmarkTexture() {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    let cancelled = false;
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-sans").trim() || "sans-serif";
    const [w, h] = WORDMARK_BOXES.desktop;
    const scale = 2;
    const font = `600 ${(h / WORDMARK_CAP) * scale}px ${family}`;
    document.fonts.load(font, WORDMARK).then(() => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.font = font;
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "alphabetic";
      const glyphs = [...WORDMARK].map((c) => ({ c, w: ctx.measureText(c).width }));
      const gap = (canvas.width - glyphs.reduce((t, g) => t + g.w, 0)) / (glyphs.length - 1);
      let x = 0;
      for (const g of glyphs) {
        ctx.fillText(g.c, x, canvas.height);
        x += g.w + gap;
      }
      const t = new THREE.CanvasTexture(canvas);
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      setTex(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
}

/** Outlined wordmark (shipped module 38219), drawn from the Raven wordmark texture. */
function HeroLogoOutline({ p }: { p: Progress }) {
  const ref = useRef<THREE.Mesh>(null);
  const box = useRect("[data-type='hero-logo-desktop']");
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const tex = useWordmarkTexture();
  const [u] = useState(() => ({ uLogoTexture: { value: null as THREE.Texture | null }, uColor: { value: new THREE.Color("#fff") }, uMeshSize: { value: new THREE.Vector2(1, 1) } }));
  useFrame(() => {
    if (!ref.current || !box) return;
    ref.current.position.set(
      box.left + 0.5 * box.width,
      -window.innerHeight + remap(p.progress.current, 0, 1, 0, p.total.current) - p.team.current - 220 - 32 - 0.5 * box.height,
      0,
    );
    ref.current.scale.set(box.width, box.height, 1);
    u.uLogoTexture.value = tex as THREE.Texture;
    u.uMeshSize.value.set(box.width, box.height);
    void width;
    void height;
  });
  if (!box || !tex) return null;
  return (
    <mesh ref={ref}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        transparent
        uniforms={u}
        vertexShader="varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader={`varying vec2 vUv; uniform sampler2D uLogoTexture; uniform vec3 uColor; uniform vec2 uMeshSize;
float a(vec2 s){ return texture2D(uLogoTexture, clamp(s, 0.0, 1.0)).a; }
void main(){
  vec2 uv = vUv;
  if (texture2D(uLogoTexture, uv).a <= 0.5) { gl_FragColor = vec4(uColor, 0.0); return; }
  vec2 st = vec2(1.0) / uMeshSize; float k = 2.0; float m = 1.0;
  m = min(m, a(uv + vec2(k * st.x, 0.0))); m = min(m, a(uv + vec2(-k * st.x, 0.0)));
  m = min(m, a(uv + vec2(0.0, k * st.y))); m = min(m, a(uv + vec2(0.0, -k * st.y)));
  vec2 dg = vec2(k * st.x, k * st.y) * 0.707;
  m = min(m, a(uv + dg)); m = min(m, a(uv + vec2(-dg.x, dg.y))); m = min(m, a(uv + vec2(dg.x, -dg.y))); m = min(m, a(uv - dg));
  float outlineAlpha = smoothstep(0.2, 0.8, 1.0 - m);
  float g = vUv.y >= 0.1 ? mix(0.0, 0.6, (vUv.y - 0.1) / 0.9) : 0.0;
  gl_FragColor = vec4(uColor, outlineAlpha * g * 0.5);
}`}
      />
    </mesh>
  );
}

/** Team statement drawn as SDF text (shipped module 80465). */
function TeamText({ p }: { p: Progress }) {
  const ref = useRef<THREE.Mesh>(null);
  const width = useThree((s) => s.size.width);
  const desc = useRect("[data-type='our-team-description']");
  useFrame(() => {
    if (!ref.current || !desc) return;
    ref.current.position.x = 0.5 * width;
    ref.current.position.y = -window.innerHeight + remap(p.progress.current, 0, 1, 0, p.total.current) - 0.5 * desc.height;
  });
  return (
    <Text
      ref={ref}
      font={ASSETS.geistSemiBold}
      color="white"
      anchorX="center"
      anchorY="middle"
      textAlign="center"
      fontSize={19}
      lineHeight={1.263}
      letterSpacing={0}
      overflowWrap="break-word"
      maxWidth={Math.min(550, 0.9 * width)}
    >
      {TEAM_TEXT}
    </Text>
  );
}

/** Pixel-space camera: 1 unit = 1 CSS px, origin top-left (shipped `D`). */
function PixelCamera() {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  useFrame(({ camera }) => {
    const c = camera as THREE.PerspectiveCamera;
    c.position.set(width / 2, -height / 2, height / (2 * Math.tan((c.fov * Math.PI) / 360)));
    c.aspect = width / height;
    c.far = 2 * c.position.z;
    c.near = c.far / 1000;
    c.updateProjectionMatrix();
  });
  return null;
}

/**
 * Fixed WebGL landing/footer presentation for >=1024px (shipped module 73560).
 * Smaller layouts show a resting live drone in the footer (FooterDrone) instead.
 */
export function LandingSequence() {
  const mainLoaded = useLoading((s) => s.mainAppLoaded);
  const lg = useMediaQuery("(min-width: 1024px)");
  const lenis = useLenis();
  const p = useLandingProgress();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!lg && mainLoaded) setTimeout(() => useLoading.getState().setImageSequenceLoaded(true), 25);
  }, [lg, mainLoaded]);

  useEffect(() => {
    if (!lenis) return;
    const on = () => setActive(p.progress.current !== 0);
    on();
    lenis.on("scroll", on);
    return () => lenis.off("scroll", on);
  }, [lenis, p.progress]);

  if (!mainLoaded || !lg) return null;
  return (
    <div className={clsx("z-scroll-sequence pointer-events-none invisible fixed inset-0 flex w-full items-end justify-center", active && "visible")} aria-hidden="true">
      <div className="absolute inset-0">
        <Canvas
          className="pointer-events-none!"
          dpr={[1, 1.5]}
          gl={{ powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, antialias: true, stencil: false }} // depth: live 3D drone
          frameloop={active ? "always" : "never"}
        >
          <AdaptiveDpr pixelated />
          <PixelCamera />
          <Suspense fallback={null}>
            <Sequence p={p} active={active} />
            <TopFade p={p} />
            <GroundGlow p={p} />
            <HeroLogoOutline p={p} />
            <TeamText p={p} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
