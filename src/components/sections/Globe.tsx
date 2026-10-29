"use client";

import { RavenModel } from "@/components/scene/Drone";

import { AdaptiveDpr, Html, PerspectiveCamera, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { motion, useInView } from "motion/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ASSETS } from "@/lib/assets";
import { useMediaQuery } from "@/lib/use-media-query";
import { Badge } from "@/components/ui/Badge";
import { Trail } from "@/components/scene/LowPolyDrone";
import { getNoiseTexture } from "@/components/scene/textures";
import { useGLB } from "@/components/scene/types";
import { gridFunctions } from "@/components/scene/shaders/screen-uv";

const CYAN = "#7aebff";
const LABELS = ["Power Restored", "Flood Area Secured", "Evacuation Supported", "Missing Person Found", "Road Block Cleared", "Wildfire Contained"];
const grid = (lon: number, lat: number) => ({ phi: (1 - lat / 25) * Math.PI, theta: (lon / 40) * 2 * Math.PI });
const SPOTS = [grid(8, 15), grid(14, 20), grid(12, 17), grid(31, 18), grid(40, 18), grid(38, 20)];

/** Sphere shading with normal map, noise holes and lat/long dot grid (shipped class `Q`). */
function createSphereMaterial(normalMap: THREE.Texture) {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
varying vec2 vUv;
varying vec3 vViewNormal;
varying vec3 vPosition;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
void main() {
    vUv = uv;
    vPosition = position;
    vViewNormal = normalMatrix * normalize(vec3(2.0 * normal.x, 1.0 * normal.y, 2.0 * normal.z));
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}`,
    fragmentShader: /* glsl */ `
varying vec2 vUv;
varying vec3 vViewNormal;
varying vec3 vViewPosition;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
uniform sampler2D uNoiseTexture;
uniform sampler2D uNormalMap;
uniform float uNormalScale;
uniform float uNormalIntensity;
uniform vec2 uNormalMapRepeat;
uniform float uLightingIntensity;
uniform float uFresnelPower;
uniform float uNoiseInfluence;
uniform float uNoiseFrequency;
uniform float uLightingMix;
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
const float PI = 3.14159265359;

vec3 inverseTransformDirection(in vec3 dir, in mat4 matrix) { return normalize((vec4(dir, 0.0) * matrix).xyz); }

vec3 sampleNormalMapPolarBlend(vec2 uv) {
    vec2 repeatedUv = uv * uNormalMapRepeat;
    vec3 uvSample = texture2D(uNormalMap, repeatedUv).xyz * 2.0 - 1.0;
    vec3 objectNormal = normalize(vPosition);
    vec2 xzUv = objectNormal.xz * uNormalMapRepeat * 0.5 + 0.5;
    vec3 xzSample = texture2D(uNormalMap, xzUv).xyz * 2.0 - 1.0;
    float polarBlend = smoothstep(0.8, 0.9, uv.y);
    return mix(uvSample, xzSample, polarBlend);
}

vec3 perturbNormal(vec3 worldNormal, vec3 worldPosition, vec2 uv) {
    vec3 mapN = sampleNormalMapPolarBlend(uv);
    mapN.xy *= uNormalScale;
    vec3 dp1 = dFdx(worldPosition);
    vec3 dp2 = dFdy(worldPosition);
    vec2 duv1 = dFdx(uv);
    vec2 duv2 = dFdy(uv);
    vec3 dp2perp = cross(dp2, worldNormal);
    vec3 dp1perp = cross(worldNormal, dp1);
    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
    float invmax = inversesqrt(max(dot(T, T), dot(B, B)));
    mat3 TBN = mat3(T * invmax, B * invmax, worldNormal);
    vec3 perturbedNormal = normalize(TBN * mapN);
    return normalize(mix(worldNormal, perturbedNormal, uNormalIntensity));
}

${gridFunctions}

float getDot(in vec2 gridUV, float size) {
    vec2 rounded = round(gridUV);
    vec2 distToIntersection = abs(gridUV - rounded);
    vec2 ddx = dFdx(gridUV);
    vec2 ddy = dFdy(gridUV);
    float scaleX = length(vec2(ddx.x, ddy.x));
    float scaleY = length(vec2(ddx.y, ddy.y));
    float aspect = scaleX / max(scaleY, 0.0001);
    vec2 correctedDist = distToIntersection * vec2(1.0, aspect);
    float dist = length(correctedDist);
    float maxDeriv = max(scaleX, scaleY);
    float dotAA = max(maxDeriv * 2.0, 0.01);
    return 1.0 - smoothstep(size - dotAA, size + dotAA, dist);
}

float computeGridMask() {
    vec2 gridUV = vUv * vec2(40., 25.);
    float colat = vUv.y * PI;
    float scaleFactor = max(sin(colat), 0.15);
    vec2 lineWidth = vec2(0.02 / scaleFactor, 0.02);
    lineWidth = min(lineWidth, vec2(0.49));
    vec2 grid2 = getGrid(gridUV, lineWidth);
    float grid = max(grid2.x, grid2.y);
    float dotSize = min(0.0175 / scaleFactor, 0.49);
    float d = getDot(gridUV, dotSize);
    return max(0.25 * grid, 0.75 * d);
}

vec3 modifyNormalWithNoise(vec3 n) {
    vec4 s1 = texture2D(uNoiseTexture, n.xz * uNoiseFrequency);
    vec4 s2 = texture2D(uNoiseTexture, n.xy * uNoiseFrequency);
    float noiseMask = mix(s1.r, s2.r, abs(n.y));
    float noiseHoleMask = smoothstep(0.0, 1.0, noiseMask);
    float noiseMixFactor = mix(1.0, noiseHoleMask, uNoiseInfluence);
    vec3 modifiedNormal = mix(normalize(mix(n, -n, 1.0 - noiseHoleMask)), n, noiseMixFactor);
    return normalize(modifiedNormal);
}

vec3 computeFresnelLighting(vec3 modifiedNormal, vec3 viewDir, vec3 lightDir) {
    float vertexNdL = max(0.0, dot(modifiedNormal, lightDir));
    float vertexNdV = max(dot(modifiedNormal, viewDir), 0.0);
    float fresnel = pow(1.0 - vertexNdV, uFresnelPower);
    vec3 litColor = vec3(4.0) * pow(vertexNdL, 8.0);
    litColor += 2. * uLightColor * pow(vertexNdL, 40.0) * pow(1.0 - vertexNdV, 40.0);
    litColor = pow(litColor, vec3(4.)) * 0.05;
    litColor += vec3(1.0) * uLightColor * fresnel * pow(vertexNdL, 4.0);
    litColor = pow(litColor, vec3(0.8)) * 2.;
    litColor += uLightColor * pow(vertexNdL, 2.0) * 1.25;
    litColor += uLightColor * pow(vertexNdL, 4.0) * 0.5;
    litColor += vec3(1.) * uLightingIntensity;
    return litColor;
}

vec3 applyFresnelLightingToColor(vec3 baseColor) {
    vec3 n = perturbNormal(normalize(vWorldNormal), vWorldPosition, vUv);
    vec3 modifiedNormal = modifyNormalWithNoise(n);
    vec3 viewDir = inverseTransformDirection(normalize(vViewPosition), viewMatrix);
    vec3 lightDir = normalize(uLightDirection);
    vec3 litColor = computeFresnelLighting(modifiedNormal, viewDir, lightDir);
    float NdL = max(0.0, dot(modifiedNormal, lightDir));
    float lightFacingIntensity = 0.3 + 0.7 * NdL;
    litColor = pow(litColor, vec3(lightFacingIntensity * 1.5));
    litColor *= lightFacingIntensity;
    return mix(baseColor, baseColor * litColor, uLightingMix);
}

void main() {
    vec3 N = perturbNormal(normalize(vWorldNormal), vWorldPosition, vUv);
    float gridMask = computeGridMask();
    vec3 color = applyFresnelLightingToColor(vec3(1.0 / 255.0));
    vec3 lightDir = normalize(uLightDirection);
    float diffuse = dot(N, lightDir);
    color += gridMask * (diffuse * 0.75 + 0.5) * 0.5;
    gl_FragColor = vec4(color, 1.0);
}`,
    uniforms: {
      uNoiseTexture: { value: getNoiseTexture() },
      uNormalMap: { value: normalMap },
      uNormalScale: { value: 1 },
      uNormalIntensity: { value: 0.95 },
      uNormalMapRepeat: { value: new THREE.Vector2(1, 1.15) },
      uLightingIntensity: { value: 3.5 },
      uFresnelPower: { value: 5 },
      uNoiseInfluence: { value: 0.6 },
      uNoiseFrequency: { value: 128 },
      uLightingMix: { value: 0.8 },
      uLightDirection: { value: new THREE.Vector3(-3, 0, 3).normalize() },
      uLightColor: { value: new THREE.Color("#ffffff") },
    },
  });
}

function Earth({ onPointerDown }: { onPointerDown: (e: ThreeEvent<PointerEvent>) => void }) {
  const normal = useTexture(ASSETS.earthNormal, (t) => {
    const x = Array.isArray(t) ? t[0] : t;
    x.wrapS = x.wrapT = THREE.RepeatWrapping;
  });
  const outline = useTexture(ASSETS.earthOutline, (t) => {
    const x = Array.isArray(t) ? t[0] : t;
    x.colorSpace = THREE.SRGBColorSpace;
  });
  const sphere = useMemo(() => createSphereMaterial(normal as THREE.Texture), [normal]);
  const uniforms = useMemo(() => ({ map: { value: outline }, opacity: { value: 1 } }), [outline]);
  return (
    <>
      <mesh scale={0.99} renderOrder={100} onPointerDown={onPointerDown} material={sphere}>
        <sphereGeometry args={[1, 80, 80]} />
      </mesh>
      <mesh scale={1} renderOrder={100} onPointerDown={onPointerDown}>
        <sphereGeometry args={[1, 80, 80]} />
        <shaderMaterial
          transparent
          uniforms={uniforms}
          vertexShader="varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
          fragmentShader={`uniform sampler2D map; uniform float opacity; varying vec2 vUv;
void main(){ vec2 uv = vUv; if (uv.y < 0.32) { uv.y = 0.0; } else { uv.y = (uv.y - 0.32) / 0.68; }
vec4 texColor = texture2D(map, uv); texColor.a = texColor.a * 1.35; gl_FragColor = texColor; }`}
        />
      </mesh>
    </>
  );
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();

/** Mission marker that shows only when facing the camera (shipped `E`). */
function Marker({ position, extended, label }: { position: [number, number, number]; extended: [number, number, number]; label: string }) {
  const ref = useRef<THREE.Group>(null);
  const stem = useRef<THREE.Group>(null);
  const [visible, setVisible] = useState(true);
  const last = useRef(true);
  const v = useRef(1);
  const { length, quaternion } = useMemo(() => {
    const d = new THREE.Vector3(extended[0] - position[0], extended[1] - position[1], extended[2] - position[2]);
    const len = d.length();
    d.normalize();
    return { length: len, quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d) };
  }, [position, extended]);
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, length, 0)]);
    g.setAttribute("color", new THREE.Float32BufferAttribute([0, 0, 0, ...new THREE.Color(CYAN).toArray()], 3));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true }));
  }, [length]);
  useFrame(({ camera }) => {
    if (!ref.current) return;
    ref.current.getWorldPosition(tmpC);
    tmpA.set(extended[0] - position[0], extended[1] - position[1], extended[2] - position[2]).transformDirection(ref.current.matrixWorld).normalize();
    tmpB.copy(camera.position).sub(tmpC).normalize();
    const facing = tmpA.dot(tmpB) > 0.5;
    if (facing !== last.current) {
      last.current = facing;
      setVisible(facing);
    }
    v.current = THREE.MathUtils.lerp(v.current, facing ? 1 : 0, 0.05);
    if (stem.current) stem.current.scale.y = v.current;
    (line.material as THREE.LineBasicMaterial).opacity = v.current;
  });
  return (
    <group ref={ref}>
      <group position={extended}>
        <Html zIndexRange={[100, 200]} className="pointer-events-none select-none" center>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: visible ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 1000, damping: 100, mass: 1 }}
            className="pointer-events-none translate-x-1 -translate-y-3 whitespace-nowrap select-none md:-translate-y-5"
          >
            <Badge variant="success" className="text-m-mono! md:text-d-mono! pointer-events-none bg-transparent select-none">
              {label}
            </Badge>
          </motion.div>
        </Html>
      </group>
      <group position={position}>
        <Html zIndexRange={[100, 200]} className="pointer-events-none relative select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.75 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="pointer-events-none relative whitespace-nowrap select-none"
          >
            <div className="bg-green shadow-green/20 relative size-1 translate-[-50%] animate-pulse rounded-full shadow-[0_0_4px_4px] select-none" />
          </motion.div>
        </Html>
      </group>
      <group ref={stem} position={position} quaternion={quaternion}>
        <primitive object={line} />
      </group>
    </group>
  );
}

function Markers() {
  const dots = useMemo(
    () =>
      SPOTS.map(({ phi, theta }, i) => {
        const p: [number, number, number] = [Math.sin(phi) * Math.cos(theta) * 0.99, 0.99 * Math.cos(phi), Math.sin(phi) * Math.sin(theta) * 0.99];
        const n = new THREE.Vector3(...p).normalize().multiplyScalar(0.15);
        return { position: p, extended: [p[0] + n.x, p[1] + n.y, p[2] + n.z] as [number, number, number], label: LABELS[i] };
      }),
    [],
  );
  return (
    <group>
      {dots.map((d, i) => (
        <Marker key={i} {...d} />
      ))}
    </group>
  );
}

const ORBITS: [number, number, number][] = [0, -Math.PI / 2, -Math.PI / 4, Math.PI / 4].flatMap((y) =>
  [2, 4, 6, 8, 10].map((k) => [0, y, (k * Math.PI) / 12] as [number, number, number]),
);
const START = Math.PI / 6;

/** A drone flying random great-circle passes with a trail (shipped `B`). */
function Orbiter({ radius, rotation }: { radius: number; rotation: [number, number, number] }) {
  const body = useRef<THREE.Group>(null);
  const trailGroup = useRef<THREE.Group>(null);
  const [points] = useState(() => Array.from({ length: 32 }, () => new THREE.Vector3()));
  const colors = useMemo(() => Array.from({ length: 32 }, (_, i) => new THREE.Color(0xf2f2f2).multiplyScalar((31 - i) / 31)), []);
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return new THREE.CatmullRomCurve3(pts, true);
  }, [radius]);
  const st = useRef({ start: 0, flying: true, endedAt: 0, rest: 10 + 20 * Math.random(), speed: 0.5 + 0.5 * Math.random(), delay: 30 * Math.random(), t: 0 });
  const m = useMemo(() => new THREE.Matrix4(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const ahead = useMemo(() => new THREE.Vector3(), []);
  const w = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const s = st.current;
    if (!body.current) return;
    s.t += Math.min(dt, 0.1);
    if (s.start === 0) s.start = s.t + s.delay;
    const period = (2 * Math.PI) / s.speed;
    const e = s.t - s.start;
    const show = (v: boolean) => {
      body.current!.visible = v;
      if (trailGroup.current) trailGroup.current.visible = v;
    };
    if (e < 0) return show(false);
    if (s.flying) {
      show(true);
      if (e >= period) {
        s.flying = false;
        s.endedAt = s.t;
        s.rest = 10 + 20 * Math.random();
        return show(false);
      }
      const u = (e / period + START) % 1;
      const p = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      ahead.copy(p).add(tan);
      m.lookAt(p, ahead, up);
      body.current.position.copy(p);
      body.current.quaternion.setFromRotationMatrix(m);
      if (p.distanceToSquared(points[0]) < 0.0125 * 0.0125) return;
      for (let i = points.length - 1; i > 0; i--) points[i].copy(w.copy(points[i - 1]));
      points[0].copy(p);
    } else {
      show(false);
      if (s.t - s.endedAt >= s.rest) {
        s.flying = true;
        s.start = s.t;
        s.speed = 0.5 + 0.5 * Math.random();
        s.delay = 30 * Math.random();
        for (const pt of points) pt.set(0, 0, 0);
      }
    }
  });
  return (
    <group rotation={rotation}>
      <group scale={0.035} ref={body}>
        <group rotation={[0, 0, Math.PI / 2]}>
          <RavenModel span={2} />
        </group>
      </group>
      <group ref={trailGroup}>
        <Trail points={points} colors={colors} lineWidth={0.8} renderOrder={6} />
      </group>
    </group>
  );
}

function Orbiters() {
  const lg = useMediaQuery("(min-width: 1024px)");
  return (
    <group>
      {ORBITS.filter((_, i) => lg || i % 5 === 0 || i % 5 === 1).map((r, i) => (
        <Orbiter key={i} radius={1.04} rotation={r} />
      ))}
      <ambientLight intensity={1} />
    </group>
  );
}

function GlobeScene({ inView }: { inView: boolean }) {
  const group = useRef<THREE.Group>(null);
  const lg = useMediaQuery("(min-width: 1024px)");
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const smooth = useRef(0);
  const target = useRef(0);
  const blueNoise = useTexture(ASSETS.blueNoise);
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const gl = useThree((s) => s.gl);
  const fade = useMemo(
    () => ({
      uBgColor: { value: new THREE.Color(0).convertLinearToSRGB() },
      uBlueNoiseTexture: { value: blueNoise },
      uStrength: { value: lg ? 0.5 : 0.75 },
    }),
    [lg, blueNoise],
  );

  useFrame(({ gl, scene, camera }) => {
    if (!inView) return;
    target.current += 0.0015 * Number(!dragging.current);
    smooth.current = 0.97 * smooth.current + 0.03 * target.current;
    if (group.current) group.current.rotation.y = smooth.current;
    gl.clear();
    gl.render(scene, camera);
  }, 100);

  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      target.current += 0.005 * (e.clientX - last.current.x);
      last.current = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      dragging.current = false;
      if (e.pointerId !== undefined && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const look = () => camera.current?.lookAt(0, lg ? 0.3 : 0.4, 0);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    window.addEventListener("resize", look);
    look();
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      window.removeEventListener("resize", look);
    };
  }, [gl, lg]);

  return (
    <>
      <PerspectiveCamera makeDefault ref={camera} position={[0, lg ? 0.2 : 0.3, lg ? 1.9 : 2]} fov={lg ? 64 : 68} />
      <group ref={group} rotation={[Math.PI / 4.5, 0, 0]}>
        <Earth
          onPointerDown={(e) => {
            dragging.current = true;
            const pe = e.nativeEvent;
            if (pe?.pointerId !== undefined) gl.domElement.setPointerCapture(pe.pointerId);
            last.current = { x: e.clientX ?? 0, y: e.clientY ?? 0 };
          }}
        />
        <Markers />
        <Orbiters />
        <mesh renderOrder={100}>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            depthTest={false}
            uniforms={fade}
            vertexShader="varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.x, position.y, 0.0, 1.0); }"
            fragmentShader={`varying vec2 vUv; uniform vec3 uBgColor; uniform sampler2D uBlueNoiseTexture; uniform float uStrength;
void main(){ vec2 s = vec2(textureSize(uBlueNoiseTexture, 0)); vec4 b = texture2D(uBlueNoiseTexture, gl_FragCoord.xy / s);
gl_FragColor = vec4(uBgColor, smoothstep(uStrength, 1.0, 1.0 - vUv.y) + b.x / 255.0); }`}
          />
        </mesh>
      </group>
    </>
  );
}

/** Rotating, draggable coverage globe (shipped module 48847). Renders only while in view. */
export function Globe() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false });
  return (
    <div ref={ref} className="top-0 right-0 aspect-square w-full overflow-visible select-none lg:absolute lg:right-10 lg:h-full lg:w-auto" draggable={false}>
      <div className="absolute -inset-4 aspect-square -translate-y-8 lg:-inset-32">
        <div className="top-0 -right-48 bottom-0 -left-48 contents lg:absolute lg:block">
          <Canvas gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }} dpr={[1, 1.5]} frameloop={inView ? "always" : "never"} aria-label="Interactive globe of mission coverage">
            <AdaptiveDpr pixelated />
            <Suspense fallback={null}>
              <GlobeScene inView={inView} />
            </Suspense>
          </Canvas>
        </div>
      </div>
    </div>
  );
}
