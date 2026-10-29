# Raven medical delivery adaptation — first pass

User direction: Raven is a medical delivery drone concept for remote mountain villages and cold-climate communities. Camera movement, scroll spans, animation tracks, and transitions remain inherited from the reference.

- Mirrored the user-supplied `glb/raven_drone.glb` into `public/assets/models/raven_drone.glb` unchanged.
- Replaced all three detailed hero/swarm aircraft with independent Raven scene clones; globe orbiters also use Raven.
- Raven bounds: 2.340 × .961 × 2.056 model units; visual adapter fits a 200-unit span before existing flight-rig scaling and rotates +Z front to the rig's -Z direction. Rotor deck remains at the existing tracker origin.
- Preserved model materials, added existing EXR environment reflections, and spun six rotor nodes using their CW/CCW metadata. Reduced-motion preference disables rotor spin. Removed the aircraft exhaust and hull-number rendering from the detailed model.
- Updated Raven navbar, metadata, hero, chapter narrative, callouts, mission cards and coverage/demo/team copy. Removed unsupported speed/AI and founder-affiliation claims from those surfaces. No measured flight performance or cold-weather certification is claimed.
- Kept camera clips, ClipSeeker bindings, scene spans, Lenis controller, overlay gates, and transition timings unchanged.
- Isolated production output in `.next-production` to avoid collisions with a running development server.

Remaining adaptation: the loader, low-poly tactical/flock silhouettes, sensor/HUD details, fire/emergency simulations, mission card/demo imagery, reference legal/Notes content, and baked footer sequence/wordmarks still come from the source reconstruction. They need a separate medical-delivery art/content pass. The existing terrain has not been replaced with snow/tundra. This first pass is model integration and core copy, not a finished Raven site.

## Raven verification

- Production build and TypeScript check pass.
- Browser-verified the hero, Explore-to-specs navigation and three-drone swarm at the default 976×1109 viewport.
- Browser-verified the hero with mobile tracks at 390×844; model, parcel, headline and CTA fit.
- Visual check found a three-line callout title colliding with its paragraph; shortened it to Medical Delivery without changing layout or timing.
- Existing development/initial preview errors came from shared build output; isolated production preview renders correctly.
- Camera/scroll code was preserved, not re-timed. No image-diff or exhaustive later-chapter regression is claimed.

## Raven material and rotor refinement

- Blender 5.2.2 background workflow, isolated from the user's live scene; Blender MCP was unavailable. Original source GLB preserved.
- Editable look-development scene: `glb/raven-refined/raven-refined.blend`; reproducible script: `glb/raven-refined/refine.py`; studio QA: `glb/raven-refined/raven-refined.png`.
- Added six tiled PBR surface sets (18 embedded images): carbon composite, graphite powder coat, brushed anodized metal, medical cargo case, rubber and webbing. Full-surface cubic UV projection covers underside/sidewalls. Color textures use sRGB; normals and packed roughness/metalness use Non-Color data. Opaque solid surfaces cull backfaces; existing optical materials remain.
- Subtle normal/roughness variation, reduced clearcoat, lower LED emission, medical cargo print; browser environment intensity reduced from 1.5 to .85 for the model only. Site lighting, cameras, timeline and transitions unchanged.
- Compressed asset `public/assets/models/raven_drone_refined.glb`: 930,840 bytes, Draco + WebP, 18 embedded images and no external dependencies. Browser hero loaded with no console errors.
- Rotor root cause: prefix matching selected 36 objects (6 assemblies and their material-split submeshes), rotating nested geometry twice. Selection now uses the exact six assembly names, with 3 CW / 3 CCW.
- `node scripts/check-raven-rotors.mjs` checks six pivot changes, unchanged child local rotations and independent clones against the textured source. Final compressed asset's six pivot names/extras and embedded maps were checked separately.
- Typecheck and production build pass. Studio render and browser hero inspected. Fine surface detail is intentionally subtle at full-page scale; the mesh silhouette remains based on the supplied design.

## Raven imagery, repository and deployment

- Jet renders are replaced with Raven renders from `glb/raven-quad/render_media.py`:
  - three mission cards (Mountain Villages, Winter Access, Remote Health Centres);
  - the demo image (desktop and mobile framings);
  - the 96-frame footer landing sequence, whose case bottom follows the shipped `FRAME_Y` path so the glow capsule stays attached.
- The originals stay on disk but are gitignored and not deployed, as are the brand logos, `research/` and `asset/`.
- The sync and Raven Ops low-poly drone reverted to the solid rotor-disc version, on user request.
- The footer sequence frames are RGBA with a transparent background, like the shipped frames, so the footer blends them over the page and glow capsule. The mission cards keep the shipped per-row alpha fade.
- Brand cleanup before the public deploy:
  - The footer wordmark is now "RAVEN", in the same boxes and outline style (SVG text, plus a canvas texture for the WebGL outline).
  - The third-party team-logos texture is gone; the neutral DOM labels show instead.
  - The Privacy and Terms copy is rewritten as concept notices: no analytics or cookies, the form sends nothing, no performance claims.
  - The `notes.usavionix.com` link is removed.
  - Modal paragraphs now wrap (they had inherited the footer's `whitespace-nowrap`).
- Private GitHub repo `bishwamandal/raven-drone-site`; public Vercel production (user decision). The page remains `noindex`.

## Raven silhouettes replace the delta jet

- The boot splash SVG, the 3D loader, the sync flock, and the Raven Ops, coordination and response drones now use Raven drone silhouettes (`glb/raven-quad/build_silhouettes.py`). The design style is unchanged:
  - same flat #2d302e silhouette, grain and travelling highlight;
  - same ScanlineMaterial and white outlines;
  - same flock, Delaunay links and steering.
- The boot SVG is re-fitted (new viewBox, height and offset), so the splash still hands off seamlessly to the 3D loader. The flock outline now uses a normal-inflated `outlineHull` instead of uniform 1.15× scaling.
- Verified in headless Chrome at 60 fps:
  - desktop boot and loader handoff;
  - mobile loader at 390×844;
  - the sync swarm at the end of the flock scene;
  - Raven Ops analysis (pair inbound), coordination support and multi-threat response.
- Typecheck and build pass.
- Remaining jet imagery is raster and not a silhouette: the 96-frame footer landing sequence, the mission-card photos (`border-storm`, `critical-infrastructure`, `wildfire-cascade`) and the demo image (`desktop`/`mobile.webp`). Each needs new renders or photos.

## Raven live daylight + full-quality asset

- `scene/sunlight.ts` is a Raven addition, not in the shipped bundle. It derives daylight from forward travel (`terrainOffset`):
  - the sun and sky heading sway by about ±0.38 rad, over roughly 25 s plus a faster correction;
  - the sky pitch moves slightly;
  - a broken-cloud shade drops the direct sun to 70% for about 3 s at a time.
- `MainScene` writes this state each frame to the single `directionalLight`. That light only affects lit materials, so the unlit terrain shader is unchanged.
- `RavenModel` points every material's `envMapRotation` at the same heading, so sky and sun reflections slide across the shell, arms and blades in flight. Under cloud the environment reflections dim less than the direct sun.
- Sun glints: the half-vector between the camera and the swayed sun is tested against five shell-facet normals. Alignment within about 6–17° briefly raises clearcoat and reflection strength on the shell, carbon tubes and blades. Glints are suppressed under cloud.
- Reduced motion keeps a static sun: no sway, shade or glints. Camera clips, scroll spans and transitions are untouched.
- Measured live in the hero: heading -0.37 to +0.32, shade 1.0 down to 0.70, glint 0 rising to 0.67 and back. The preview pane throttles requestAnimationFrame, so smoothness was not judged there.
- The site asset keeps full-resolution maps, re-encoded as lossless WebP (all 20 verified pixel-identical to the source PNGs), with Draco geometry: 16.8 MB. That compares with 29.3 MB as Draco-only PNG and 2.1 MB with lossy 1K WebP.

## Raven coaxial quad (v2, user revision)

- On user request, the quad became a heavy-duty coaxial X8. It has four arms, and each arm carries an upper and a lower counter-rotating propeller (eight pivots). The structure is heavier: 62 mm arms with hinge clamps and folding joints, 186 mm pods, a larger body with a chassis core and side rails, 31 mm landing tubes and a larger case. Colours and materials are unchanged.
- The rotor contract is now eight exact names (`Rotor_<station>_Upper/Lower`). The check script asserts eight pivots, four shafts, a 4 CW / 4 CCW split, counter-rotating pairs and web parity. The specs callout reads "Coaxial Quad Architecture".
- The web asset is 2.1 MB. Typecheck, build and the rotor check pass. The desktop browser check covered the hero, specs and swarm.

## Raven quad (four-rotor) variant

- New Blender 5.2.2 model per `RAVEN_DRONE_BLENDER_BRIEF.md`. It has four X arms with one two-blade propeller each, and no mast. The shell is light cool gray (#A3A4AC), with a charcoal deck, carbon arms, pebbled pods and case, and tubular skids. Source, scripts, QA renders and the discrepancy list are in `glb/raven-quad/` (see its README).
- The site asset is now `public/assets/models/raven_quad.glb` (2.0 MB, Draco + WebP). `raven_drone_refined.glb` and the original GLB remain untouched and unused.
- The rotor contract is exactly four pivots (`RAVEN_ROTOR_NAMES` in `scene/raven-rotors.ts`). `scripts/check-raven-rotors.mjs` now asserts:
  - four pivots, split 2 CW / 2 CCW;
  - shaft positions;
  - no orbit or child changes;
  - clone independence;
  - web-asset pivot parity.
- The specs callout copy changed from six rotors to four. Camera tracks, spans, scroll, snapping and transitions are unchanged. Fitting still uses the existing 200-unit span and 180° adapter.
- Verified: typecheck, build, rotor check, and browser checks of the hero (desktop and 390×844), specs top-down and swarm, with no console errors. Callout anchor positions were not re-placed for the new silhouette.

## Original reconstruction notes (historical)

# USAvionix homepage reconstruction — architecture and discrepancies

Reference: https://www.usavionix.com/, captured 29 October 2026 (bundles in `research/usavionix/shipped/`).
Local study only: not affiliated with USAvionix, `noindex`, no form backend.

## Run

```bash
npm install
npm run dev        # http://localhost:3100
npm run build      # production build (passes)
npm run assets:manifest
```

## Stack

Next.js 15 (App Router) · React 19 · three 0.176 · @react-three/fiber 9 · drei 10 · postprocessing 6 · Lenis 1.3 · zustand 5 · motion 12 · Tailwind 4 · Geist / Geist Mono (`geist` package).
Draco decoder is served locally from `public/draco/`; nothing is hotlinked.

## Architecture

| Concern | Where | Source module ported |
|---|---|---|
| Scene ids, spans, ordered ranges, progress store | `src/lib/scenes.ts` | 36745 |
| Single scroll controller (Lenis, lerp .95) + per-scene progress writer + scene-end snapping | `src/components/SmoothScroll.tsx` | 82245 |
| Sticky stage inside the `calc(6600dvh + 1px + nav)` track | `src/components/scene/FixedContainer.tsx`, `src/app/page.tsx` | 7370 `np` |
| Scene assembly, composer, flock FBO portal, hero audio | `scene/MainScene.tsx`, `scene/PostFX.tsx` | `t4`, 41480, 8743, 98894 |
| Camera + 3 drones, GLB clip seeking, hover/steer/boost, shake, wind | `scene/DroneRig.tsx`, `scene/ClipSeeker.ts`, `scene/Drone.tsx` | `tU`, `tN`, `tC`, `tP`, `tr`, 31905 |
| Terrain tiles, fog keyframes, Phalanx scan wipe, buildings, fire | `scene/Terrain.tsx`, `materials/TerrainMaterial.ts`, `scene/Fire.tsx` | `J`, `K`, `y`, `z`/`V`/`W`, `B`, `G`–`Q` |
| Grid, clouds, detection boxes | `scene/Grid.tsx`, `scene/Clouds.tsx`, `scene/DetectionPoints.tsx` | `et`/`en`, `g`, `D`/`U` |
| Spec callouts, DSA tags, thermal HUD | `scene/overlays/*` | `tS`/`tR`, `ts`/`ta`/`ti`, `tv` |
| Flock (instanced, separation + Delaunay links) | `scene/Flock.tsx` | `tZ`, `tk`, `tz` |
| Zones, responders, coordination drones, power station | `scene/Perimeters.tsx`, `scene/CoordinationDrones.tsx`, `scene/PowerStation.tsx` | `e1`/`eV`/`eq`, `eb`/`eg`/`eh`, `e8` |
| Chapter copy + time windows, mission log | `scene/ChapterCopy.tsx`, `scene/HudLog.tsx` | `nl`/`nc`, `nd`, 76772 |
| Navbar, chapter ticks (150ms fade → .75s scroll → restore), menu sheet | `src/components/Navbar.tsx` | 72781 |
| Modal, contact form | `ui/Modal.tsx`, `ContactForm.tsx`, `ContactButton.tsx` | 66741, 98317, 52953 |
| Mission cards, globe, demo, team, footer | `sections/Sections.tsx`, `sections/Globe.tsx` | 88572, 48847, 98776, 28866 |
| 96-frame landing sequence (≥1024px), static frame 96 below | `sections/LandingSequence.tsx` | 73560, 68363, 51462, 38219, 80465 |
| Loader | `loading/Loader.tsx` | 86700, 58905, 60745 |

Hot paths use refs and uniforms. Per-frame React state is avoided except where the source does the same
(threshold booleans via zustand selectors). One Lenis instance drives every progress value.

## Verification done

- `tsc --noEmit` and `next build` pass.
- Side-by-side captures at 1440×900, same `scrollY`, reference vs local (built-in browser):
  hero at rest, delta-drone 95% (spec callouts), swarm 96% (DSA tags + dashed links), flock 95%,
  real-time detection 70%, thermal 99.5% (thermal box + lock), Phalanx 90% (survey zone). These matched
  closely in composition, copy, camera framing and overlay anchoring.
- 390×844 hero uses the mobile camera/drone tracks and mobile type scale.
- No image diffs were computed; comparison was visual. Idle motion (hover, terrain travel, wind) is time
  based, so terrain texture position differs between any two captures.

## Known discrepancies (honest list)

1. **Loader.** The reference renders its loader in a Web Worker OffscreenCanvas (chunk 4867, not captured).
   Here a DOM boot splash + a regular canvas with `loading-delta.glb` stand in, with the same state machine
   and 12s / 20s / 3s fallbacks. Reveal timing and the loader's exact look differ.
2. **Clip seeking on reverse scroll.** The reference creates one AnimationMixer per binding; the
   last-registered active binding wins, which can hold a stale pose when scrolling back up (inferred from
   code, not observed). `ClipSeeker` resolves the winner explicitly, so forward travel matches and reverse
   travel seeks the same clip backward.
3. **Third composer pass** is a default-constructed effect in the bundle (minified `eF`). SMAA is an inference.
4. **Landing sequence memory.** The reference uploads all 96 1920² textures (~1.4 GB GPU). This keeps one
   texture and swaps its image on frame change. Frame selection and the non-linear mapping are unchanged;
   `base1` blending stays disabled as in the source.
5. **Heat distortion / jet beam** over the landing frame (module 85508) is not ported. The large white jet
   shape visible in the reference's final footer frame is therefore missing.
6. **Outlined wordmark in WebGL** (module 38219) is ported but was not confirmed visible in local captures
   (preview throttling made late-footer screenshots unreliable). Needs a foreground-browser check.
7. **Icons.** Phosphor glyphs in badges/arrows are close stand-ins, not the exact paths.
8. **Globe orbiters** use the PBR drone without the rendered hull number.
9. **Reverse travel into ignition**: the reference showed the Phalanx survey zone still visible after
   scrolling back to ignition-verified; this build hides it per the code's state mapping.
10. **Menu links** point to `#` (other pages were not reconstructed). Contact submit validates and then states
    that nothing was sent (no backend).
11. **Reduced motion**: a global transition/animation clamp is a reconstruction safeguard, not observed on the
    reference. Scroll-seeking stays since it follows the user's own input.
12. Not exercised: 821×1109 capture set, upward-travel capture set for every chapter, contact modal and
    menu at all breakpoints, image-diff tooling.

## Asset manifest

`research/usavionix/asset-manifest.json`: 132 files, 10.3 MB; each with source URL, local path, bytes,
SHA-256, MIME, dimensions or GLB nodes/materials/clips. 0 HTML error pages, 0 external glTF URIs.
GLB node name normalization: GLTFLoader sanitizes `Drone.001` → `Drone001` (`PropertyBinding.sanitizeNodeName`),
which is the name the shipped code looks up.
