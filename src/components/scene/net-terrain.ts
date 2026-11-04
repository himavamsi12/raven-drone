import * as THREE from "three";
import { RENDER_ORDER } from "@/lib/constants";
import { computeNetField, NET, NET_SITES, netArcRoute, netHeight, netRoute, type NetField } from "./net-terrain-field";
import { CLAY_FRONT, payloadClayUniforms } from "./materials/TerrainMaterial";

/**
 * Route stage terrain (lib/payload.ts ROUTE_*; user 2026-11-03: "take this terrain directly", the `net` section of
 * asset/html/raven_homepage (3).html, "Mapped to the last ridge"): the section's terrain mesh, contour shading, dot
 * grid, hover glow and idle sway, ported 1:1 (net-terrain-field.ts has the height maths) and dropped into the stage
 * around the hero drone. Its text, legend, info card, the depot and summit pins are left out (one checkpoint, user).
 *
 * Placement: the whole section world is scaled by NET_VIEW.scale and pivots on the drone, which hovers over the
 * section's depot site; it is turned (`setYaw`) so the section camera looks the way the payload camera does, so the
 * mountain stage is a pull-back. It is the ground from the payload stage on: the clay front sweeps it in (far ->
 * near, shared CLAY_FRONT; the clay tiles are cut beyond the front), close up it fogs like the clay view, and as the
 * camera pulls back its own fog takes over, so the massif behind the drone comes out of the haze. The sway and the
 * pointer tilt (mountain stage only) turn it about the drone, so the route start stays on it.
 */
export const NET_VIEW = {
  /** World units per section unit (the section's ~50 m units): sets how small the drone reads against the massif. */
  scale: 0.3,
  /** Drone height over the depot ground (section units). */
  hover: 9,
  /** Section yaw until `setYaw` (from the payload camera) runs. */
  yaw: 0,
  /** Section camera (fov 30): eye, look-at, and the distance factor per aspect (section `resize`). */
  eye: new THREE.Vector3(0, 165, 320),
  target: new THREE.Vector3(0, 62, -20),
  fov: 30,
  /**
   * Portrait: both camera points slide this far along the section's x (toward the depot), so the drone over the depot
   * and the clinic both fit the narrow frame (the section's own phone framing left the depot off screen).
   */
  portraitShiftX: -50,
};

/** Layer of the coarse hover proxy (raycast only, never rendered). */
const PROXY_LAYER = 7;
const PROXY_STEP = 4;
const FOG = new THREE.Color("#0e0e0e");

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _e = new THREE.Vector3();
const _t = new THREE.Vector3();
const _p = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _tiltAxis = new THREE.Vector3();
const _tiltQ = new THREE.Quaternion();

/**
 * GLSL shared by the section's terrain and dots: the payload clay front (TerrainMaterial CLAY_FRONT, same distance from
 * the camera; nothing of the section is drawn nearer than it, the tiles are cut beyond it) and the fog blend.
 */
const NET_FRONT = /* glsl */ `
float netFront(float camDist){
  float front = mix(${CLAY_FRONT.far.toFixed(1)}, ${CLAY_FRONT.near.toFixed(1)}, uPayloadClay);
  if (camDist < front) discard;
  return exp(-pow((camDist - front) / 0.6, 2.0)) * (1.0 - smoothstep(0.85, 1.0, uPayloadClay));
}
float netFog(float camDist, float sectionDist){
  return mix(smoothstep(uPayloadFog.x, uPayloadFog.y, camDist), smoothstep(300.0, 700.0, sectionDist), uSection);
}`;

async function field(): Promise<NetField> {
  if (typeof Worker !== "undefined") {
    try {
      const worker = new Worker(new URL("./net-terrain.worker.ts", import.meta.url));
      return await new Promise<NetField>((resolve, reject) => {
        worker.onmessage = (e: MessageEvent<NetField | { error: string }>) => {
          worker.terminate();
          if ("error" in e.data) reject(new Error(e.data.error));
          else resolve(e.data);
        };
        worker.onerror = (e) => {
          worker.terminate();
          reject(e);
        };
        worker.postMessage(null);
      });
    } catch (err) {
      console.warn("Network terrain worker unavailable, computing inline.", err);
    }
  }
  return computeNetField();
}

export class NetTerrain {
  /** Pivot on the drone: sway/tilt rotation and the scale. */
  readonly root = new THREE.Group();
  /** The section world, offset so its depot hover point sits on the pivot. */
  readonly inner = new THREE.Group();
  ready = false;
  /** Depot hover point and the two checkpoint sites (section units): the clinic (the drone's route), the summit. */
  readonly start: THREE.Vector3;
  readonly site: THREE.Vector3;
  readonly site2: THREE.Vector3;
  /**
   * The connected route (user: drone -> first checkpoint, then on from it to the second), evenly spaced samples in
   * section units: leg 1 drone -> clinic (the section's rule, over the massif), leg 2 clinic -> summit station (one
   * smooth arc, netArcRoute; user: simple like the altitude path). Leg 2 starts where leg 1 ends, over the clinic.
   */
  route: Float32Array = new Float32Array(0);
  route2: Float32Array = new Float32Array(0);
  /** Running maximum of leg 1's height (section units), for the altitude counter. */
  routePeak: Float32Array = new Float32Array(0);
  /** Leg 2 length (section units) and the arc length at each of its samples. */
  length2 = 0;
  arc2: Float32Array = new Float32Array(0);

  private readonly shared = {
    uMouse: { value: new THREE.Vector3(9999, 0, 9999) },
    uMouseOn: { value: 0 },
    uTime: { value: 0 },
    uFog: { value: FOG },
    uIce: { value: new THREE.Color("#e4e4e4") },
    /** Fade in from the background (route stage). */
    uReveal: { value: 0 },
    /** World units per section-camera unit: fog and dot sizes keep the section's distances. */
    uDistScale: { value: 1 },
    /** Close clay fog (payload view, shared with the tiles) -> the section's own fog, by the mountain stage weight. */
    uSection: { value: 0 },
    uPayloadFog: payloadClayUniforms.uPayloadFog,
    uPayloadClay: payloadClayUniforms.uPayloadClay,
  };
  private readonly px = { value: 1 };
  private proxy: THREE.Mesh | null = null;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly ray = new THREE.Raycaster();
  private pointer: { x: number; y: number } | null = null;
  private moved = false;
  private yaw = 0;
  private yawBase = NET_VIEW.yaw;
  private tilt = 0;
  private tiltTarget = 0;
  private hoverOn = 0;
  private hoverTarget = 0;
  private elapsed = 0;
  private alive = true;
  private readonly onPointer = (e: PointerEvent) => {
    this.pointer = { x: e.clientX, y: e.clientY };
    this.moved = true;
  };
  private readonly onLeave = () => {
    this.pointer = null;
    this.moved = true;
  };

  constructor(points = 140) {
    this.root.name = "NetTerrain";
    this.root.add(this.inner);
    this.root.visible = false;
    const d = NET_SITES.depot;
    this.start = new THREE.Vector3(d.x, netHeight(d.x, d.z) + NET_VIEW.hover, d.z);
    const c = NET_SITES.clinic;
    this.site = new THREE.Vector3(c.x, netHeight(c.x, c.z), c.z);
    const m = NET_SITES.summit;
    this.site2 = new THREE.Vector3(m.x, netHeight(m.x, m.z), m.z);
    this.inner.position.copy(this.start).multiplyScalar(-1);
    this.root.scale.setScalar(NET_VIEW.scale);
    this.ray.layers.set(PROXY_LAYER);
    // Routes, resampled evenly for the ribbons: leg 1 by the section's rule, leg 2 through the valleys.
    const sample = (pts: [number, number, number][]) => {
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      return new Float32Array(curve.getSpacedPoints(points).flatMap((p) => [p.x, p.y, p.z]));
    };
    this.route = sample(netRoute(this.start, this.site));
    this.route2 = sample(netArcRoute(this.site, this.site2));
    // Leg 2 begins exactly at leg 1's end (both hover over the clinic).
    for (let c = 0; c < 3; c++) this.route2[c] = this.route[points * 3 + c];
    this.arc2 = new Float32Array(points + 1);
    for (let i = 1; i <= points; i++) {
      const r = this.route2;
      this.arc2[i] = this.arc2[i - 1] + Math.hypot(r[i * 3] - r[i * 3 - 3], r[i * 3 + 1] - r[i * 3 - 2], r[i * 3 + 2] - r[i * 3 - 1]);
    }
    this.length2 = this.arc2[points];
    this.routePeak = new Float32Array(points + 1);
    let peak = -Infinity;
    for (let i = 0; i <= points; i++) this.routePeak[i] = peak = Math.max(peak, this.route[i * 3 + 1]);
    if (typeof window !== "undefined") {
      window.addEventListener("pointermove", this.onPointer, { passive: true });
      document.documentElement.addEventListener("pointerleave", this.onLeave);
    }
    field()
      .then((f) => this.alive && this.build(f))
      .catch((err) => console.error("Network terrain build failed.", err));
  }

  private build({ heights, dots }: NetField) {
    const { SX, SZ, NX, NZ, OZ } = NET;
    const geo = new THREE.PlaneGeometry(SX, SZ, NX, NZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, OZ); // extend mostly toward the camera; far edge stays hidden in the fog
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heights[i]);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const terrainMat = new THREE.ShaderMaterial({
      name: "RavenNetTerrain",
      uniforms: {
        uLow: { value: new THREE.Color("#262626") },
        uHigh: { value: new THREE.Color("#8e8e8e") },
        uLight: { value: new THREE.Vector3(-0.55, 0.7, 0.35).normalize() },
        ...this.shared,
      },
      // Section shaders; positions/normals in section units (vL), the world position only for the fog distance.
      vertexShader: /* glsl */ `
varying vec3 vL; varying vec3 vN; varying vec3 vW;
void main(){ vL = position; vN = normal; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz;
 gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */ `
uniform vec3 uLow, uHigh, uLight, uMouse, uFog, uIce; uniform float uMouseOn, uTime, uReveal, uDistScale;
uniform float uSection, uPayloadClay; uniform vec2 uPayloadFog;
varying vec3 vL; varying vec3 vN; varying vec3 vW;
${NET_FRONT}
void main(){
 float camDist = distance(cameraPosition, vW);
 float front = netFront(camDist);
 vec3 n = normalize(vN); float h = vL.y;
 float diff = max(dot(n, uLight), 0.0); float slope = 1.0 - n.y;
 vec3 base = mix(uLow, uHigh, smoothstep(-6.0, 80.0, h));
 base *= 0.78 + 0.22*smoothstep(0.15, 0.6, slope);
 vec3 col = base*(0.26 + 1.1*diff) + uIce*0.015;
 float f = h/4.0; float fw = max(fwidth(f), 1e-4);
 float line = 1.0 - min(abs(fract(f - 0.5) - 0.5)/(fw*1.2), 1.0);
 float f5 = h/20.0; float fw5 = max(fwidth(f5), 1e-4);
 float major = 1.0 - min(abs(fract(f5 - 0.5) - 0.5)/(fw5*1.6), 1.0);
 float md = distance(vL.xz, uMouse.xz); float glow = exp(-md*md/1400.0)*uMouseOn;
 col += uIce*(line*(0.035 + 0.6*glow) + major*(0.09 + 0.6*glow));
 col += uIce*glow*0.035;
 float dist = camDist/uDistScale;
 col = mix(col, uFog, netFog(camDist, dist));
 col += uIce*front*0.22; // the clay front's scan line, continued on this side
 gl_FragColor = vec4(mix(uFog, col, uReveal), 1.0);
}`,
    });
    const terrain = new THREE.Mesh(geo, terrainMat);
    terrain.renderOrder = RENDER_ORDER.TERRAIN;
    this.inner.add(terrain);

    // Dotted map: a regular 50 m grid draped over the surface.
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.BufferAttribute(dots, 3));
    const dotMat = new THREE.ShaderMaterial({
      name: "RavenNetDots",
      transparent: true,
      depthWrite: false,
      uniforms: { uPx: this.px, ...this.shared },
      vertexShader: /* glsl */ `
uniform float uPx, uDistScale; varying vec3 vL; varying vec3 vW;
void main(){ vL = position; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix*w;
 gl_PointSize = uPx*clamp(330.0/(-mv.z/uDistScale), 0.9, 3.2); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `
uniform vec3 uMouse, uIce, uFog; uniform float uMouseOn, uReveal, uDistScale, uSection, uPayloadClay; uniform vec2 uPayloadFog;
varying vec3 vL; varying vec3 vW;
${NET_FRONT}
void main(){ vec2 c = gl_PointCoord - 0.5; float r = dot(c,c); if (r > 0.25) discard;
 float camDist = distance(cameraPosition, vW); netFront(camDist);
 float md = distance(vL.xz, uMouse.xz); float glow = exp(-md*md/900.0)*uMouseOn;
 float dist = camDist/uDistScale;
 float a = (0.42 + 0.58*glow)*(1.0 - mix(smoothstep(uPayloadFog.x, uPayloadFog.y, camDist), smoothstep(320.0, 700.0, dist), uSection))*uReveal;
 gl_FragColor = vec4(mix(uIce*0.75, uIce, glow), a*smoothstep(0.25, 0.05, r)); }`,
    });
    const points = new THREE.Points(dotGeo, dotMat);
    points.renderOrder = RENDER_ORDER.TERRAIN + 1;
    points.frustumCulled = false;
    this.inner.add(points);

    // Coarse copy for the hover raycast (the section raycast its full 416k-triangle mesh).
    const pg = new THREE.PlaneGeometry(SX, SZ, NX / PROXY_STEP, NZ / PROXY_STEP);
    pg.rotateX(-Math.PI / 2);
    pg.translate(0, 0, OZ);
    const pp = pg.attributes.position as THREE.BufferAttribute;
    for (let iy = 0; iy <= NZ / PROXY_STEP; iy++)
      for (let ix = 0; ix <= NX / PROXY_STEP; ix++)
        pp.setY(iy * (NX / PROXY_STEP + 1) + ix, heights[iy * PROXY_STEP * (NX + 1) + ix * PROXY_STEP]);
    pg.computeBoundingSphere();
    const proxy = new THREE.Mesh(pg, new THREE.MeshBasicMaterial());
    proxy.layers.set(PROXY_LAYER);
    this.inner.add(proxy);
    this.proxy = proxy;

    this.disposables.push(geo, terrainMat, dotGeo, dotMat, pg, proxy.material as THREE.Material);
    this.ready = true;
  }

  /**
   * Section camera pose in the stage (no sway), seen through our lens: the section's eye/target mapped into the world,
   * the eye moved back so `fov` frames what the section's fov 30 did. Call after `place`.
   */
  pose(fov: number, aspect: number, eye: THREE.Vector3, quat: THREE.Quaternion) {
    const far = aspect < 1 ? 1.65 : aspect < 1.4 ? 1.25 : 1; // section `resize`
    const s = NET_VIEW.scale;
    const base = new THREE.Quaternion().setFromAxisAngle(UP, this.yawBase);
    const map = (v: THREE.Vector3, out: THREE.Vector3) => out.copy(v).sub(this.start).multiplyScalar(s).applyQuaternion(base).add(this.root.position);
    const shift = aspect < 1 ? NET_VIEW.portraitShiftX : 0;
    map(_p.copy(NET_VIEW.target).setX(NET_VIEW.target.x + shift), _t);
    map(_p.set(NET_VIEW.eye.x + shift, NET_VIEW.eye.y * far, NET_VIEW.eye.z * far), _e);
    const k = Math.tan((NET_VIEW.fov / 2) * DEG) / Math.tan((fov / 2) * DEG);
    eye.copy(_e).sub(_t).multiplyScalar(k).add(_t);
    _m.lookAt(eye, _t, UP);
    quat.setFromRotationMatrix(_m);
    this.shared.uDistScale.value = s * k;
    return eye.distanceTo(_t);
  }

  /** Puts the section under the drone (`pivot` = drone centre without its hover). */
  place(pivot: THREE.Vector3) {
    this.root.position.copy(pivot);
  }

  /**
   * Turns the section so its camera looks along `forward` (horizontal part; the payload camera's), so the mountain
   * stage's pull-back keeps the payload view's direction. Section forward is -z.
   */
  setYaw(forward: THREE.Vector3) {
    if (forward.x * forward.x + forward.z * forward.z < 1e-6) return;
    this.yawBase = Math.atan2(-forward.x, -forward.z);
  }

  /**
   * Per frame: fade, idle sway (section `frame`: yaw sin(t * .12) * .12), pointer tilt and the hover glow (raycast on
   * the coarse proxy when the pointer moved). `dpr` = scene render density (dot size).
   */
  update(dt: number, on: boolean, section: number, camera: THREE.Camera, dpr: number, reducedMotion: boolean) {
    on = on && this.ready;
    this.root.visible = on;
    this.shared.uReveal.value = 1;
    this.shared.uSection.value = section;
    this.px.value = dpr;
    if (!on) {
      this.hoverOn = this.hoverTarget = 0;
      return;
    }
    const step = Math.min(dt, 0.05);
    if (!reducedMotion) this.elapsed += step;
    this.shared.uTime.value = this.elapsed;
    // Sway and tilt belong to the section view: none under the close payload camera (the ground would swim).
    const idle = reducedMotion ? 0 : Math.sin(this.elapsed * 0.12) * 0.12 * section;
    const k = 1 - Math.pow(1 - 0.06, step * 60); // the section's per-frame 0.06 at 60 fps
    this.yaw += (idle - this.yaw) * k;
    this.tilt += (this.tiltTarget - this.tilt) * k;
    this.hoverOn += (this.hoverTarget - this.hoverOn) * (1 - Math.pow(1 - 0.12, step * 60));
    this.shared.uMouseOn.value = this.hoverOn;
    // Section: world.rotation (tilt about the screen's horizontal axis, yaw). Here the screen's horizontal axis is
    // world z (the side view looks along +x), so the tilt is a z rotation applied after the yaw.
    // Section: world.rotation.set(tilt, yaw); its tilt axis is the screen's horizontal, here the camera's right.
    this.root.rotation.set(0, this.yawBase + this.yaw, 0);
    _tiltAxis.set(Math.cos(this.yawBase), 0, -Math.sin(this.yawBase)); // section +x in the world
    this.root.quaternion.premultiply(_tiltQ.setFromAxisAngle(_tiltAxis, this.tilt * section));
    this.root.updateMatrixWorld(true);

    if (this.moved && this.proxy) {
      this.moved = false;
      if (this.pointer && section > 0.5) {
        _ndc.set((this.pointer.x / window.innerWidth) * 2 - 1, -(this.pointer.y / window.innerHeight) * 2 + 1);
        this.tiltTarget = _ndc.y * 0.05;
        this.ray.setFromCamera(_ndc, camera);
        const hit = this.ray.intersectObject(this.proxy)[0];
        if (hit) {
          this.shared.uMouse.value.copy(this.inner.worldToLocal(hit.point));
          this.hoverTarget = 1;
        } else this.hoverTarget = 0;
      } else {
        this.hoverTarget = 0;
        this.tiltTarget = 0;
      }
    }
  }

  /**
   * Point on the flown route at arc fraction `s` (section units, into `out`), its horizontal heading (`dir`) and the
   * altitude fraction reached so far (0 at the drone's start, 1 at the route's highest point).
   */
  along(s: number, out: THREE.Vector3, dir: THREE.Vector3) {
    const { i, t } = this.sampleAt(this.route, s, out, dir);
    const r = this.route;
    const n = r.length / 3 - 1;
    const y0 = r[1];
    const top = this.routePeak[n];
    const reached = this.routePeak[i] + (this.routePeak[i + 1] - this.routePeak[i]) * t;
    return top > y0 ? (reached - y0) / (top - y0) : 1;
  }

  /** Point on leg 2 at arc fraction `s` (into `out`) and its heading over the next stretch (`dir`, horizontal). */
  along2(s: number, out: THREE.Vector3, dir: THREE.Vector3) {
    this.sampleAt(this.route2, s, out, dir);
    this.sampleAt(this.route2, Math.min(s + 0.06, 1), _p, _e); // look a little ahead for a steady heading
    if (s < 0.999) dir.set(_p.x - out.x, 0, _p.z - out.z);
    return out;
  }

  private sampleAt(r: Float32Array, s: number, out: THREE.Vector3, dir: THREE.Vector3) {
    const n = r.length / 3 - 1;
    const f = Math.min(Math.max(s, 0), 1) * n;
    const i = Math.min(Math.floor(f), n - 1);
    const t = f - i;
    out.set(r[i * 3] + (r[i * 3 + 3] - r[i * 3]) * t, r[i * 3 + 1] + (r[i * 3 + 4] - r[i * 3 + 1]) * t, r[i * 3 + 2] + (r[i * 3 + 5] - r[i * 3 + 2]) * t);
    dir.set(r[i * 3 + 3] - r[i * 3], 0, r[i * 3 + 5] - r[i * 3 + 2]);
    return { i, t };
  }

  /** Section direction -> world direction (current sway included). */
  dirToWorld(v: THREE.Vector3, out: THREE.Vector3) {
    return out.copy(v).transformDirection(this.inner.matrixWorld);
  }

  /** Section point -> world (current sway included). */
  toWorld(v: THREE.Vector3, out: THREE.Vector3) {
    return out.copy(v).applyMatrix4(this.inner.matrixWorld);
  }

  dispose() {
    this.alive = false;
    for (const d of this.disposables) d.dispose();
    if (typeof window !== "undefined") {
      window.removeEventListener("pointermove", this.onPointer);
      document.documentElement.removeEventListener("pointerleave", this.onLeave);
    }
  }
}
