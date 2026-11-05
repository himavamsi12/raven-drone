import * as THREE from "three";
import { mountainDetailUniforms, TERRAIN_SUN } from "../mountain-terrain";
import { TerrainMaterial } from "./TerrainMaterial";

/**
 * Raven mountain ground (`?terrain=mountain`, mountain-terrain.ts). Same shader as TerrainMaterial (fog, opening
 * panorama, diagonal-wipe scan grid, ground dim; every uniform the frame loop writes), with:
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
 * - realism pass (user, 2026-11-03): rock types by region, strata colour bands with sienna iron-oxide layers, dark
 *   streaks down faces, damp gullies, warm snow bounce light, snow sheen and glints, blue shade, near-full colour and
 *   aerial perspective with distance (`uAerial`, `uAerialDist`).
 */
const srgb = (hex: string) => new THREE.Color(hex); // ColorManagement converts sRGB hex to the working (linear) space

const PALETTE = {
  // Realism pass (user, 2026-11-03: "realistic effect with textures and color"): photographic Himalayan palette,
  // warmer earths and real hue separation between layers instead of one grey-brown.
  uGrass: srgb("#65583f"), // alpine meadow, fresh green (user 2026-11-03: less dry)
  uGrassDry: srgb("#76614a"), // drier turf, olive (was straw-ochre)
  uMoss: srgb("#4f5034"), // moss in damp hollows, green
  uHeath: srgb("#5a4334"), // dwarf heath / rhododendron scrub, rust
  uLichen: srgb("#b0a07c"), // lichen on stones, pale ochre
  uForest: srgb("#2b2c20"), // conifers below the treeline
  uForestDeep: srgb("#192d14"), // mid-slope forest patches, shaded crowns
  uForestLit: srgb("#4d6230"), // sunlit crown tops
  uLush: srgb("#3d4f24"), // green hillside regions, shaded
  uLushLit: srgb("#5b6d33"), // green hillside regions, lit grass
  uScree: srgb("#8f8576"), // scree / moraine
  uRockDark: srgb("#3f3a35"), // shaded schist, warm dark grey
  uRockLight: srgb("#948a7e"), // granite / gneiss, warm buff
  uRockWarm: srgb("#8a5f40"), // iron-oxide band, sienna
  uRockCool: srgb("#5d6066"), // slate / limestone, cool grey
  uSnow: srgb("#f6f4ef"), // sunlit snow, faintly warm
  uSnowShade: srgb("#7f97ba"), // snow in its own shade, sky blue
  uRoad: srgb("#9b9282"),
  uAerial: srgb("#9fb3cc"), // aerial perspective (thin blue air over far ranges)
};

const VERTEX = /* glsl */ `
attribute vec4 aGrad;  // xy: height gradient (x, z), zw: gradient of the mountain part
attribute vec4 aData;  // x: concavity, y: village mask, z: mountain part of the height, w: cast shadow
uniform vec3 uMapOrigin;
uniform float uLiftMax;
// Payload page altitude stage (TerrainMaterial payloadClayUniforms): the side view looks from -x, flight direction +z
// on the right. uPayloadSide (0..1) eases off the lifts that would sit behind the drone (-z) or between the camera and
// the drone (-x), and raises the ridges the drone flies toward (+z) by uPayloadRiseLift.
uniform float uPayloadSide;
uniform float uPayloadRiseLift;

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
    float w = uPayloadSide;
    float sideFar = smoothstep(13.0, 26.0, m.x);   // behind the drone in the side view (backdrop)
    float sideNear = smoothstep(13.0, 26.0, -m.x); // camera side in the side view
    float ahead = smoothstep(-6.0, -34.0, m.y);
    float rise = smoothstep(13.0, 38.0, m.y);      // where the drone heads in the side view (none under it, m.y ~8.6)
    float base = max(max(sideFar * (1.0 - 0.45 * w), sideNear * (1.0 - w)), ahead * (1.0 - w));
    return 1.0 + uLiftMax * base + uPayloadRiseLift * rise * w;
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
uniform vec3 uForestDeep;
uniform vec3 uForestLit;
uniform float uPatchCover;
uniform vec3 uLush;
uniform vec3 uLushLit;
uniform float uLushCover;
uniform vec3 uScree;
uniform vec3 uRockDark;
uniform vec3 uRockLight;
uniform vec3 uRockWarm;
uniform vec3 uRockCool;
uniform vec3 uAerial;
uniform float uAerialDist;
uniform vec3 uSnow;
uniform vec3 uSnowShade;
uniform vec3 uRoad;
varying vec3 vNormalW;
varying vec4 vData;
varying float vLift;

float mLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

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
    // Greener ground (user 2026-11-03: "looks dry, add more greenery"): meadow dominates, dry turf only on
    // exposed patches, moss spreads from the hollows, heath patches are smaller.
    vec3 col = mix(uGrassDry, uGrass, smoothstep(0.32, 0.58, macro + 0.1 * up));
    col = mix(col, uMoss, smoothstep(0.5, 0.74, heathN) * (0.35 + 0.65 * smoothstep(0.0, 1.2, hollow)));
    col = mix(col, uHeath, smoothstep(0.66, 0.82, texture(uDetail, p.xz * 0.011 + 0.3).g) * 0.5);
    col = mix(col, uLichen, smoothstep(0.68, 0.85, dF.g) * 0.3);
    col *= 0.86 + 0.28 * fine;

    // Moist earth (user reference 2026-11-03: dark umber soil, not dry straw): darker, richer brown on the open
    // slopes, darkest in hollows; grey textured rock outcrops scattered across the mid slopes.
    col *= mix(vec3(0.92, 0.9, 0.88), vec3(0.8, 0.76, 0.72), smoothstep(0.0, 1.2, hollow));
    // Green regions (user 2026-11-03: "not patches; complete mountains should be green, randomly in some terrains"):
    // a very low-frequency mask turns whole hillsides lush green below the snow, others stay moist brown.
    // Soft wide edges so a region fades over a slope; damp hollows greener, ridges and steep faces less.
    float lushN = texture(uDetail, p.xz * 0.0028 + 0.53).a * 0.8 + texture(uDetail, p.xz * 0.009 + 0.17).a * 0.2;
    float lush = smoothstep(0.5 - uLushCover, 0.62 - uLushCover, lushN + 0.05 * clamp(hollow, -1.0, 1.5))
        * (1.0 - smoothstep(uSnowLine - 4.0, uSnowLine + 1.0, y + 3.0 * (macro - 0.5)))
        * (1.0 - smoothstep(0.38, 0.6, steep)) * (1.0 - mask) * (1.0 - road);
    vec3 lushC = mix(uLush, uLushLit, smoothstep(0.3, 0.75, heathN * 0.6 + dF.g * 0.4));
    lushC = mix(lushC, uMoss, smoothstep(0.62, 0.8, heathN) * 0.4) * (0.82 + 0.3 * fine);
    col = mix(col, lushC, lush * 0.9);
    float outcrop = smoothstep(0.6, 0.66, texture(uDetail, p.xz * 0.021 + 0.83).a + 0.08 * (dN.r - 0.5) + 0.15 * steep);
    vec3 outC = mix(uRockDark, uRockLight, smoothstep(0.3, 0.75, dN.r * 0.7 + dF.r * 0.3)) * (0.85 + 0.3 * macro);
    col = mix(col, outC, outcrop * 0.85);

    // Forest below a noisy treeline; above it the baked forest thins into dark heath (krummholz).
    float tl = uTreeLine + 8.0 * (macro - 0.5) + 5.0 * (heathN - 0.5);
    float keep = 1.0 - smoothstep(tl - 2.5, tl + 2.5, y);
    float forestW = forest * keep * (1.0 - smoothstep(0.3, 0.5, steep));
    vec3 forestC = uForest * (0.45 + 0.75 * fine * fine);
    // Above the treeline the baked forest only leaves faint heath (no dark blotches; the reference has almost no green).
    col = mix(col, uHeath * 0.8 * (0.8 + 0.3 * fine), forest * (1.0 - keep) * 0.25);
    col = mix(col, forestC, forestW * 0.65);

    // Scree below the cliffs, rock on steep ground and on the bake's own outcrops.
    float rockW = smoothstep(0.24, 0.42, steep + (dN.r - 0.5) * 0.2);
    rockW = max(rockW, bakedRock * 0.8 * (1.0 - forestW));
    float screeW = smoothstep(0.16, 0.28, steep + (dF.r - 0.5) * 0.08) * (1.0 - rockW) * (1.0 - forestW);
    // Rock: two rock types by region (cool slate vs warm granite), horizontal strata bands in world height,
    // sienna iron-oxide layers, dark mineral streaks running down the faces, light crests and dark cracks.
    float tone = smoothstep(0.3, 0.75, dN.r * 0.7 + dF.r * 0.3);
    vec3 rockC = mix(uRockDark, uRockLight, tone);
    float rtype = smoothstep(0.35, 0.65, texture(uDetail, p.xz * 0.0065 + 0.71).a);
    rockC = mix(rockC, mix(uRockCool * (0.7 + 0.5 * tone), rockC, 0.35), (1.0 - rtype) * 0.6);
    float band = texture(uDetail, vec2(p.x * 0.004 + p.z * 0.003, y * 0.045)).r;
    rockC = mix(rockC, uRockWarm * (0.75 + 0.5 * tone), smoothstep(0.58, 0.74, band) * 0.55 * rtype);
    rockC *= 0.88 + 0.24 * smoothstep(0.3, 0.7, band);
    float varnish = smoothstep(0.5, 0.85, texture(uDetail, vec2(p.x * 0.09 + p.z * 0.05, y * 0.008)).b);
    rockC *= 1.0 - 0.32 * varnish * steep;
    rockC *= 0.78 + 0.44 * macro;
    vec3 screeC = mix(uScree, mix(uRockLight, uRockWarm, 0.25), smoothstep(0.4, 0.8, dN.g) * 0.5);
    col = mix(col, screeC * (0.72 + 0.56 * dF.r), screeW * 0.8);
    col = mix(col, rockC, rockW);

    // Forest patches on the mid slopes (user reference 2026-11-03: dense green conifer stands on the mountainside,
    // broken by brown clearings): blob-noise stands on moderate slopes between the valleys and a noisy treeline,
    // denser in hollows (moisture), never on cliffs, roads or village terraces. Crowns are a fine stipple.
    float stand = texture(uDetail, p.xz * 0.0085 + 0.13).a * 0.7 + texture(uDetail, p.xz * 0.027 + 0.57).a * 0.3;
    float ptl = uSnowLine - 2.0 + 7.0 * (macro - 0.5);
    float patchW = smoothstep(0.5 - uPatchCover, 0.58 - uPatchCover, stand + 0.06 * clamp(hollow, -1.0, 1.5))
        * (1.0 - smoothstep(ptl - 3.0, ptl + 1.5, y))
        * (1.0 - smoothstep(0.34, 0.52, steep))
        * (1.0 - rockW * 0.5) * (1.0 - mask) * (1.0 - road);
    // Ragged edge: single trees thin out at the stand's border.
    float crown = texture(uDetail, p.xz * 0.62 + 0.21).a * 0.55 + texture(uDetail, p.xz * 1.7).g * 0.45;
    patchW *= smoothstep(0.15, 0.45, crown + patchW * 0.7);
    // Clearings: brown meadow holes inside the stands (reference: bare patches in the forest).
    float clearing = smoothstep(0.58, 0.66, texture(uDetail, p.xz * 0.05 + 0.37).a);
    patchW *= 1.0 - clearing * 0.9;
    // Crowns: lit tops against dark gaps, coarse and fine scale.
    float crownF = texture(uDetail, p.xz * 2.3 + 0.6).r;
    vec3 patchC = mix(uForestDeep * 0.7, uForestLit, smoothstep(0.3, 0.75, crown * 0.6 + crownF * 0.4)) * (0.8 + 0.35 * macro);
    col = mix(col, patchC, patchW);
    forestW = max(forestW, patchW);

    // Roads and the village terraces keep their baked look (muted).
    col = mix(col, uRoad * (0.85 + 0.3 * fine), road * (1.0 - rockW) * 0.85);
    col = mix(col, mix(vec3(mLuma(baked)), baked, 0.55) * 1.15, mask * (1.0 - forestW) * 0.55);
    // Damp gullies: meltwater darkens and greens the hollows a little.
    float damp = smoothstep(0.4, 1.6, hollow) * (1.0 - rockW * 0.5);
    col = mix(col, col * vec3(0.72, 0.78, 0.7), damp * 0.6);

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
    snowW *= 1.0 - 0.85 * patchW;
    col = mix(col, uSnow * (0.9 + 0.1 * ripple), snowW);

    // Surface roughness: rock relief normals (two scales, strongest on rock and scree), micro relief everywhere
    // (grit, tussocks, snow crust), faded with distance so far slopes do not shimmer.
    float dist = length(vViewPosition);
    float near = smoothstep(70.0, 14.0, dist);
    float rockish = max(max(rockW, screeW * 0.6), outcrop * 0.8);
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
    vec3 ln = normalize(n + rp * (0.3 + 1.1 * rockish) * (1.0 - 0.6 * snowW) + mp * (0.28 + 0.32 * near + 0.5 * forestW) * (1.0 - 0.4 * snowW));

    // Light: terrain sun, cool sky fill, hollows occluded; snow in shade turns blue-grey.
    float ndl = dot(ln, uSunDir);
    // Cast shadow takes nearly all direct light (Everest-style dark valleys).
    float shadow = 1.0 - 0.94 * smoothstep(0.08, 0.75, vData.w);
    float sun = clamp(ndl, 0.0, 1.0) * shadow;
    float ao = clamp(1.0 - max(hollow, 0.0) * 0.1 + max(-hollow, 0.0) * 0.03, 0.45, 1.1);
    float skyUp = 0.5 + 0.5 * clamp(ln.y, 0.0, 1.0);
    // Cool sky fill: faces turned from the sun fall to blue, not flat grey (real high-altitude shade).
    vec3 sky = vec3(0.44, 0.55, 0.78) * (0.22 + 0.24 * skyUp) * ao;
    // Snow fields bounce warm light into nearby shaded rock.
    sky += vec3(0.22, 0.2, 0.18) * smoothstep(sl - 6.0, sl + 4.0, y) * (1.0 - snowW) * (1.0 - up) * ao;
    // Snow's shaded side takes the sky colour (blue) instead of greying out.
    vec3 snowAlb = mix(uSnowShade, uSnow, smoothstep(0.0, 0.6, sun));
    col = mix(col, snowAlb * (0.9 + 0.1 * ripple), snowW * (1.0 - smoothstep(0.0, 0.6, sun)) * 0.6);
    // Warm raking sun (17 deg): lit faces go tan, ridges catch the light.
    vec3 light = vec3(1.0, 0.91, 0.76) * sun * 2.55 + sky;
    col *= light * uExposure;

    // Snow sheen: a soft specular lobe plus glints on the crust, sun side only.
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 H = normalize(uSunDir + V);
    float nh = clamp(dot(ln, H), 0.0, 1.0);
    float sheen = pow(nh, 40.0) * 0.35 + pow(nh, 220.0) * smoothstep(0.7, 0.95, dF.b) * 1.4 * near;
    col += vec3(1.0, 0.96, 0.9) * sheen * snowW * shadow;

    // Drifting cloud shadows.
    vec2 cuv = vWorldPosition.xz * 0.035 + vec2(uCloudTime * 0.004, uCloudTime * 0.0025);
    float cs = texture(uDetail, cuv).a * 0.7 + texture(uDetail, cuv * 2.7 + 0.4).a * 0.3;
    col *= mix(vec3(1.0), vec3(0.66, 0.7, 0.8), smoothstep(0.55, 0.7, cs) * uCloudShade);

    // Light grade: keep most of the colour (was 0.8 saturation), lift contrast a touch.
    col = mix(vec3(mLuma(col)), col, 0.94);
    vec3 cc = clamp(col, 0.0, 1.0);
    col = mix(col, cc * cc * (3.0 - 2.0 * cc), 0.35);

    // Aerial perspective: distant ground loses contrast and turns blue before the shipped fog takes over.
    float air = 1.0 - exp(-dist / uAerialDist);
    col = mix(col, uAerial * (0.85 + 0.15 * skyUp), air * 0.55);
    return col;
}
`;

export class MountainMaterial extends TerrainMaterial {
  constructor(noiseTexture: THREE.Texture) {
    super(noiseTexture);
    this.vertexShader = VERTEX;
    const anchor = "vec3 inverseTransformDirection(";
    const base = "vec3 baseColor = textureColor.rgb;";
    if (!this.fragmentShader.includes(anchor) || !this.fragmentShader.includes(base)) {
      throw new Error("MountainMaterial: TerrainMaterial shader changed, update the injection points");
    }
    this.fragmentShader = this.fragmentShader
      .replace(anchor, `${SURFACE}\n${anchor}`)
      .replace(base, "vec3 baseColor = mountainSurface(textureColor.rgb);");
    Object.assign(this.uniforms, {
      ...mountainDetailUniforms, // shared objects: filled once the worker's maps arrive
      uSunDir: { value: TERRAIN_SUN.clone() },
      uSnowLine: { value: 15 },
      uTreeLine: { value: 4 },
      uExposure: { value: 0.82 },
      uCloudShade: { value: 1 },
      uMapOrigin: { value: new THREE.Vector3(0, -2.5, -8.6) },
      uLiftMax: { value: 2.5 },
      uAerialDist: { value: 140 },
      uPatchCover: { value: -0.07 }, // + more forest, - less
      uLushCover: { value: 0.0 }, // + more green hillsides, - fewer
      ...Object.fromEntries(Object.entries(PALETTE).map(([k, c]) => [k, { value: c.clone() }])),
    });
  }
}
