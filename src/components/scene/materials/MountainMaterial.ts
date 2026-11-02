import * as THREE from "three";
import { mountainDetailUniforms, TERRAIN_SUN } from "../mountain-terrain";
import { TerrainMaterial } from "./TerrainMaterial";

/**
 * Raven mountain ground (`?terrain=mountain`, mountain-terrain.ts). Same shader as TerrainMaterial (fog, opening
 * panorama, diagonal-wipe scan grid, drone shadow, ground dim; every uniform the frame loop writes), with:
 *
 * - vertex: the relief's mountain part (`aData.z`) is scaled up away from the flight path (`liftAt`, map space), so
 *   peaks rise in the far side columns and ahead while the corridor under the drones keeps its measured budget.
 *   Normals come from the stored gradients (`aGrad`), not the mesh, so tile joins stay smooth.
 * - fragment: the baked Raven map becomes land-use data (forest / lawn / rock / road, read from blurred mips, like the
 *   Everest site reads its satellite photo) and is recoloured as cold high country: tundra grass, moss, heath and
 *   lichen; forest only below a treeline; scree and triplanar rock on steep ground; snow above a noisy snowline,
 *   deeper on shaded slopes. Lit by the scene sun (wrap diffuse + sky fill + concavity occlusion), drifting cloud
 *   shadows, 0.86 desaturation (Everest), then the shipped fog.
 * - surface roughness (user reference 2026-11-03, the Everest site's high-country frame): procedural rock and micro
 *   normal maps applied triplanar on top of the eroded mesh normal (Everest `_rkF`/`_rkB` + `_m1`/`_m2`), faded with
 *   distance; a grey-brown palette with little green; snow on high and gentle ground with blue-grey shading and
 *   streaks down the steep faces; soft cool light.
 */
const srgb = (hex: string) => new THREE.Color(hex); // ColorManagement converts sRGB hex to the working (linear) space

const PALETTE = {
  uGrass: srgb("#7b7560"), // alpine turf, grey-olive
  uGrassDry: srgb("#8c8169"), // dry tundra / moraine soil, grey-brown
  uMoss: srgb("#5a5b42"), // moss in hollows
  uHeath: srgb("#6c5a4a"), // dwarf heath, muted rust
  uLichen: srgb("#9a8f78"), // lichen on stones, pale ochre-grey
  uForest: srgb("#2a3226"), // conifers below the treeline
  uScree: srgb("#8a847a"), // scree / moraine
  uRockDark: srgb("#45423f"),
  uRockLight: srgb("#a29c93"),
  uSnow: srgb("#f1f4f8"),
  uSnowShade: srgb("#8d9db3"), // snow in its own shade, blue-grey
  uRoad: srgb("#9b9282"),
};

const VERTEX = /* glsl */ `
attribute vec4 aGrad;  // xy: height gradient (x, z), zw: gradient of the mountain part
attribute vec4 aData;  // x: concavity, y: village mask, z: mountain part of the height, w: cast shadow
uniform vec3 uMapOrigin;
uniform float uLiftMax;

varying vec2 vUv;
varying vec3 vViewNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormalW;
varying vec4 vData;
varying float vLift;

// 1 in the camera corridor (|x| < 13 map units, measured drone/camera paths reach x ~ +-11), rising toward the far
// side columns and ahead of the drones.
float liftAt(vec2 m) {
    float side = smoothstep(13.0, 26.0, abs(m.x));
    float ahead = smoothstep(-6.0, -34.0, m.y);
    return 1.0 + uLiftMax * max(side, ahead);
}

void main() {
    vUv = uv;
    vec4 w0 = modelMatrix * vec4(position, 1.0);
    vec2 m = w0.xz - uMapOrigin.xz;
    float L = liftAt(m);
    const float E = 0.25;
    float Lx = (liftAt(m + vec2(E, 0.0)) - liftAt(m - vec2(E, 0.0))) / (2.0 * E);
    float Lz = (liftAt(m + vec2(0.0, E)) - liftAt(m - vec2(0.0, E))) / (2.0 * E);
    float s = length(modelMatrix[0].xyz); // map units per tile-local unit
    float k = L - 1.0;
    vec3 p = position;
    p.y += k * aData.z;
    vec2 g = aGrad.xy + k * aGrad.zw + aData.z * vec2(Lx, Lz) * s;
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));

    vPosition = p;
    vData = aData;
    vLift = L;
    vNormalW = n; // tiles are translated and uniformly scaled only
    vWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
    // Scan-grid mode keeps the shipped 2x horizontal normal exaggeration.
    vViewNormal = normalMatrix * normalize(vec3(2.0 * n.x, 1.0 * n.y, 2.0 * n.z));
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}`;

const SURFACE = /* glsl */ `
uniform sampler2D uDetail;
uniform sampler2D uDetailN;
uniform vec3 uSunDir;
uniform float uSnowLine;
uniform float uTreeLine;
uniform float uExposure;
uniform float uCloudShade;
uniform vec3 uGrass;
uniform vec3 uGrassDry;
uniform vec3 uMoss;
uniform vec3 uHeath;
uniform vec3 uLichen;
uniform vec3 uForest;
uniform vec3 uScree;
uniform vec3 uRockDark;
uniform vec3 uRockLight;
uniform vec3 uSnow;
uniform vec3 uSnowShade;
uniform vec3 uRoad;
varying vec3 vNormalW;
varying vec4 vData;
varying float vLift;

float mLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Drone shadow, softer than droneShadowAt: on the sharp mountain ground (clarity pass) the map's low-res silhouette
// (legs, rotor discs) showed as a blocky, striped ghost; three rings at up to 3x the penumbra make it a soft shadow.
float mountainDroneShadow(vec3 worldPos) {
    if (uDroneShadowStrength <= 0.0) return 0.0;
    vec4 lp = uDroneShadowMatrix * vec4(worldPos, 1.0);
    vec2 uv = lp.xy / lp.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
    float r = uDroneShadowSoft * 3.0;
    float occ = 1.0 - texture2D(uDroneShadow, uv).r;
    float wsum = 1.0;
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7853982;
        vec2 o = vec2(cos(a), sin(a));
        occ += (1.0 - texture2D(uDroneShadow, uv + o * r * 0.33).r) * 0.9;
        occ += (1.0 - texture2D(uDroneShadow, uv + vec2(o.y, -o.x) * r * 0.66).r) * 0.7;
        occ += (1.0 - texture2D(uDroneShadow, uv + o * r).r) * 0.45;
        wsum += 2.05;
    }
    occ /= wsum;
    vec2 e = smoothstep(0.0, 0.08, uv) * smoothstep(0.0, 0.08, 1.0 - uv);
    return occ * e.x * e.y * uDroneShadowStrength;
}

vec4 triDetail(vec3 p, vec3 n, float f) {
    vec3 w = pow(abs(n), vec3(4.0));
    w /= (w.x + w.y + w.z + 1e-4);
    return texture(uDetail, p.zy * f) * w.x + texture(uDetail, p.xz * f) * w.y + texture(uDetail, p.xy * f) * w.z;
}

// Triplanar detail normal (Everest's mapping of tangent x/y per projection). ch: 0 = rock relief (rg), 1 = micro (ba).
vec3 triNormal(vec3 p, vec3 n, float f, float ch) {
    vec3 w = pow(abs(n), vec3(4.0));
    w /= (w.x + w.y + w.z + 1e-4);
    vec4 a = texture(uDetailN, p.zy * f) * 2.0 - 1.0;
    vec4 b = texture(uDetailN, p.xz * f) * 2.0 - 1.0;
    vec4 c = texture(uDetailN, p.xy * f) * 2.0 - 1.0;
    vec2 tzy = mix(a.rg, a.ba, ch);
    vec2 txz = mix(b.rg, b.ba, ch);
    vec2 txy = mix(c.rg, c.ba, ch);
    return vec3(txy.x * w.z + txz.x * w.y, tzy.y * w.x + txy.y * w.z, tzy.x * w.x + txz.y * w.y);
}

vec3 mountainSurface(vec3 baked) {
    vec3 n = normalize(vNormalW);
    float up = clamp(n.y, 0.0, 1.0);
    float steep = 1.0 - up;
    vec3 p = vPosition;
    float y = p.y;
    float mask = vData.y;
    float hollow = vData.x;

    // Land use from the baked map: blurred mips classify, the fine/blurred ratio keeps crowns and grass texture
    // without the bake's large-scale sun shading.
    // Perf (2026-11-03): ~21 texture reads per pixel, was ~30 (the lens and this shader overran 16.7 ms together).
    vec3 low = texture(uBaseTexture, vUv, 3.0).rgb;
    float lowL = max(mLuma(low), 0.004);
    float fine = clamp(mLuma(baked) / lowL, 0.4, 1.8);
    float lowLum = mLuma(low);
    float lowSat = max(low.r, max(low.g, low.b)) - min(low.r, min(low.g, low.b));
    float forest = smoothstep(0.0, 0.012, low.g - low.r) * (1.0 - smoothstep(0.06, 0.14, lowLum));
    float bakedRock = smoothstep(0.005, 0.04, low.b - low.r) * (1.0 - forest);
    vec3 mid = texture(uBaseTexture, vUv, 1.0).rgb;
    float midSat = max(mid.r, max(mid.g, mid.b)) - min(mid.r, min(mid.g, mid.b));
    float road = (1.0 - smoothstep(0.02, 0.06, midSat)) * smoothstep(0.16, 0.26, mLuma(mid)) * (1.0 - bakedRock);

    vec4 dN = triDetail(p, n, 0.025);
    vec4 dF = texture(uDetail, p.xz * 0.17); // fine detail: top projection only
    float macro = texture(uDetail, p.xz * 0.004 + 0.31).a;
    float heathN = texture(uDetail, p.xz * 0.02).g * 0.6 + texture(uDetail, p.xz * 0.07 + 0.5).g * 0.4;

    // Tundra ground cover.
    vec3 col = mix(uGrassDry, uGrass, smoothstep(0.38, 0.62, macro));
    col = mix(col, uMoss, smoothstep(0.48, 0.72, heathN) * (0.45 + 0.55 * smoothstep(0.0, 1.2, hollow)));
    col = mix(col, uHeath, smoothstep(0.6, 0.78, texture(uDetail, p.xz * 0.011 + 0.3).g) * 0.65);
    col = mix(col, uLichen, smoothstep(0.68, 0.85, dF.g) * 0.3);
    col *= 0.86 + 0.28 * fine;

    // Forest below a noisy treeline; above it the baked forest thins into dark heath (krummholz).
    float tl = uTreeLine + 8.0 * (macro - 0.5) + 5.0 * (heathN - 0.5);
    float keep = 1.0 - smoothstep(tl - 2.5, tl + 2.5, y);
    float forestW = forest * keep * (1.0 - smoothstep(0.3, 0.5, steep));
    vec3 forestC = uForest * (0.45 + 0.75 * fine * fine);
    // Above the treeline the baked forest only leaves faint heath (no dark blotches; the reference has almost no green).
    col = mix(col, uHeath * 0.8 * (0.8 + 0.3 * fine), forest * (1.0 - keep) * 0.25);
    col = mix(col, forestC, forestW);

    // Scree below the cliffs, rock on steep ground and on the bake's own outcrops.
    float rockW = smoothstep(0.24, 0.42, steep + (dN.r - 0.5) * 0.2);
    rockW = max(rockW, bakedRock * 0.8 * (1.0 - forestW));
    float screeW = smoothstep(0.1, 0.22, steep + (dF.r - 0.5) * 0.08) * (1.0 - rockW) * (1.0 - forestW);
    vec3 rockC = mix(uRockDark, uRockLight, smoothstep(0.3, 0.75, dN.r * 0.7 + dF.r * 0.3));
    rockC *= 0.82 + 0.36 * macro;
    col = mix(col, uScree * (0.8 + 0.4 * dF.r), screeW * 0.75);
    col = mix(col, rockC, rockW);

    // Roads and the village terraces keep their baked look (muted).
    col = mix(col, uRoad * (0.85 + 0.3 * fine), road * (1.0 - rockW) * 0.85);
    col = mix(col, mix(vec3(mLuma(baked)), baked, 0.55) * 1.15, mask * (1.0 - forestW) * 0.55);

    // Snow: noisy snowline, deeper on slopes facing away from the sun, sliding off steep faces.
    vec2 nxz = n.xz / max(length(n.xz), 1e-4);
    float away = -dot(nxz, normalize(uSunDir.xz)) * smoothstep(0.02, 0.2, steep);
    float sl = uSnowLine + 10.0 * (macro - 0.5) + 4.0 * (dN.g - 0.5) - 4.0 * away;
    float snowW = smoothstep(sl - 2.0, sl + 2.0, y) * smoothstep(0.42, 0.68, up) * (1.0 - mask);
    float ripple = texture(uDetail, vec2(p.x * 0.03, p.z * 0.12)).b;
    // Snow streaks down the steep faces (gullies hold it), wind crust on the gentle slopes.
    float streak = smoothstep(0.55, 0.8, texture(uDetail, vec2(p.x * 0.05 + p.z * 0.02, p.y * 0.012)).b);
    float faceSnow = smoothstep(sl - 4.0, sl + 6.0, y) * (1.0 - smoothstep(0.42, 0.68, up)) * streak * 0.8 * (1.0 - mask);
    snowW = max(snowW, faceSnow * smoothstep(0.0, 1.5, hollow + 0.6));
    col = mix(col, uSnow * (0.9 + 0.1 * ripple), snowW);

    // Surface roughness: rock relief normals (two scales, strongest on rock and scree), micro relief everywhere
    // (grit, tussocks, snow crust), faded with distance so far slopes do not shimmer.
    float dist = length(vViewPosition);
    float near = smoothstep(70.0, 14.0, dist);
    float rockish = max(rockW, screeW * 0.6);
    // Rock relief: one triplanar scale plus a coarse top projection; micro relief: top projection (it is for the
    // gentle ground), the finest scale only near the camera.
    vec4 coarse = texture(uDetailN, p.xz * 0.011) * 2.0 - 1.0;
    vec3 rp = triNormal(p, n, 0.03, 0.0) * (0.55 + 0.45 * near) + vec3(coarse.r, 0.0, coarse.g) * 0.7;
    vec4 m1 = texture(uDetailN, p.xz * 0.12) * 2.0 - 1.0;
    vec3 mp = vec3(m1.b, 0.0, m1.a);
    if (near > 0.01) {
        vec4 m2 = texture(uDetailN, p.xz * 0.37) * 2.0 - 1.0;
        mp += vec3(m2.b, 0.0, m2.a) * 0.6 * near;
    }
    vec3 ln = normalize(n + rp * (0.3 + 1.1 * rockish) * (1.0 - 0.6 * snowW) + mp * (0.28 + 0.32 * near) * (1.0 - 0.4 * snowW));

    // Light: terrain sun, cool sky fill, hollows occluded; snow in shade turns blue-grey.
    float ndl = dot(ln, uSunDir);
    // Cast shadow takes nearly all direct light (Everest-style dark valleys).
    float sun = clamp(ndl, 0.0, 1.0) * (1.0 - 0.94 * smoothstep(0.08, 0.75, vData.w));
    float ao = clamp(1.0 - max(hollow, 0.0) * 0.08 + max(-hollow, 0.0) * 0.02, 0.5, 1.08);
    float skyUp = 0.5 + 0.5 * clamp(ln.y, 0.0, 1.0);
    // Low cool fill: faces turned from the sun fall to blue-grey, not flat grey.
    vec3 sky = vec3(0.48, 0.56, 0.74) * (0.2 + 0.2 * skyUp) * ao;
    // Snow's shaded side takes the sky colour (blue-grey) instead of greying out.
    vec3 snowAlb = mix(uSnowShade, uSnow, smoothstep(0.0, 0.6, sun));
    col = mix(col, snowAlb * (0.9 + 0.1 * ripple), snowW * (1.0 - smoothstep(0.0, 0.6, sun)) * 0.6);
    // Warm raking sun (17 deg): lit faces go tan, ridges catch the light.
    vec3 light = vec3(1.0, 0.9, 0.74) * sun * 2.45 + sky;
    col *= light * uExposure;

    // Drifting cloud shadows.
    vec2 cuv = vWorldPosition.xz * 0.035 + vec2(uCloudTime * 0.004, uCloudTime * 0.0025);
    float cs = texture(uDetail, cuv).a * 0.7 + texture(uDetail, cuv * 2.7 + 0.4).a * 0.3;
    col *= mix(1.0, 0.7, smoothstep(0.55, 0.7, cs) * uCloudShade);

    return mix(vec3(mLuma(col)), col, 0.8);
}
`;

export class MountainMaterial extends TerrainMaterial {
  constructor(noiseTexture: THREE.Texture) {
    super(noiseTexture);
    this.vertexShader = VERTEX;
    const anchor = "vec3 inverseTransformDirection(";
    const base = "vec3 baseColor = textureColor.rgb;";
    const shadow = "baseColor *= 1.0 - droneShadowAt(vWorldPosition);";
    if (!this.fragmentShader.includes(anchor) || !this.fragmentShader.includes(base) || !this.fragmentShader.includes(shadow)) {
      throw new Error("MountainMaterial: TerrainMaterial shader changed, update the injection points");
    }
    this.fragmentShader = this.fragmentShader
      .replace(anchor, `${SURFACE}\n${anchor}`)
      .replace(base, "vec3 baseColor = mountainSurface(textureColor.rgb);")
      // The drone-shadow map stretches into streaks on steep faces (the mountain ground sits close under the drone):
      // keep the shadow on gentle ground, fade it on steep slopes.
      .replace(shadow, "baseColor *= 1.0 - mountainDroneShadow(vWorldPosition) * smoothstep(0.55, 0.85, normalize(vNormalW).y);");
    Object.assign(this.uniforms, {
      ...mountainDetailUniforms, // shared objects: filled once the worker's maps arrive
      uSunDir: { value: TERRAIN_SUN.clone() },
      uSnowLine: { value: 15 },
      uTreeLine: { value: 4 },
      uExposure: { value: 0.82 },
      uCloudShade: { value: 1 },
      uMapOrigin: { value: new THREE.Vector3(0, -2.5, -8.6) },
      uLiftMax: { value: 2.5 },
      ...Object.fromEntries(Object.entries(PALETTE).map(([k, c]) => [k, { value: c.clone() }])),
    });
  }
}
