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

## GPU performance pass, same output (user request, 2026-11-01)

Measured in headless Chrome on an Apple M3 at 1440×900, DPR 2 (canvas 2160×1350), vsync off, interleaved A/B,
median of 5 runs. Airframe frame (scroll 7201): 11.3 → 10.1 ms per frame. Terrain lens 3.6 → 2.5 ms.
- `TerrainLensEffect`: the per-tap nearer-object test compares raw depth against `0.8 × lin` mapped back to depth
  once per pixel (linearDepth is monotonic), and the golden-angle disc direction is rotated by a constant matrix
  instead of computing sin/cos for every tap. Same taps, same weights.
- `PostFX`: the flock crossfade `EffectPass` is disabled whenever its shader would pass the input through
  (`mixFactor <= 0` or real-time-detection progress >= .15).
- `Clouds`: fragments whose alpha bound (`cloud × 0.875 × uFade × 0.3 − uIndex × 0.01`) is <= 0 are discarded
  before the second fbm. The 8-bit composer target clamps alpha to 0 there, so nothing is drawn either way.
- Checked side by side against the previous build at the hero, Airframe, flock crossfade and Route frames: no
  visible change.
- Remaining cost (not changed, it would change the look): the full-screen chain (scene → lens → SMAA ×3 → grade
  → canvas) is about 5 ms of fixed fill at this size. The two cloud layers cost about 1.5–2.5 ms. JS runs at
  1.6–3.1 ms per frame.
- `AdaptiveDpr` in `FixedContainer` has no effect: nothing calls `regress()`, and there is no `PerformanceMonitor`.

## Raven story and content rewrite (Phase 1, copy only, 2026-10-30)

- Rewrote every visible string around one illustrative delivery, from a regional health centre to a hill clinic. Brief: `RAVEN_STORY_CONTENT_PROMPT.md`; full inventory: `RAVEN_CONTENT_MAP.md`.
  - Covers: hero, chapters, callouts, HUD log, in-scene labels, nav ticks, menu, below-fold sections, footer, contact result and metadata.
- Unchanged:
  - Scene IDs, spans and windows.
  - Camera and drone clips.
  - HUD trigger points, callout anchors and text timing.
  - The nav fade/scroll/restore sequence and the footer sequence.
  - Verified: nav clicks land on exact scene ends forward and reverse at 1440×900 (Route 22501, Prepare 13501, Network 59401, Airframe 4501).
- Removed unsupported claims:
  - Sensor suite, dual-GPU agents, Phalanx link, fake coordinates, altitude and speed.
  - Detection confidence %, the 0°C/148°C thermal scale.
  - "Threat" and "secured" wording, and police/firefighter dispatch lines.
  - Globe outcome badges; the hiring/partner menu items.
  - Placeholder `#` menu links, replaced with in-page jumps.
- Shared notice copy: `src/lib/copy.ts`.
- Visual debt remains, so the copy describes the hazard detour as a simulation, not as delivery footage:
  - The scroll still shows a fleet graph, object detection, a thermal search, fire, an ops grid, responder-style arrows and a power-station fire.
  - No preparation, launch, handoff or return is animated.
  - Phase 2 plan: `RAVEN_VISUAL_STORY_PLAN.md`.
- Checked with agent-browser:
  - Every chapter at 1440×900 and 390×844, a sample at 821×1109, and below-fold sections, menu, contact dialog (still "Not sent") and footer.
  - Fixes made from the screenshots: the mobile "Care teams" callout title, shorter trait rows, the footer CTA width, and the mobile footer notice placement.
  - The WebGL footer wordmark outline still did not show in headless capture (Open work 2).

## Raven hexacopter v2 (user drone update, 2026-10-30)

- `raven_hexa.glb` is now built from the user's v2 `Hexa_Medical_Drone_Black.glb` (from `asset/latest-drone/`):
  86,456 tris (v1 36,508), 11 JPEG PBR maps, EO/IR turret, LiDAR and thermal pods. Same prepare script and rotor
  contract; v1 source, prepared copy and web asset are kept in `glb/new-drone/` with a `_v1` suffix.
- Web asset 1,995,084 bytes (v1 186,780): textures byte-identical to the source (lossless WebP would have been
  6.59 MB), Draco 16/12/16. Requires `KHR_texture_transform`.
- Rotor check passes: hub X/Z and CW/CCW pattern unchanged; hub Y 0.3385 (was 0.3485) after recentring.
- `Drone.tsx` glint list follows the new material names (`PROP_Blade_DarkGrey` replaces `REF_Prop`; `MED_Carbon_Tube`
  no longer exists).
- Browser (agent-browser, 1440×900): hero, specs overhead, three-drone swarm and globe orbiters render; 60 fps /
  16.7 ms p50 at each (vsync-capped on an M3, not a low-end measurement); no console errors.
- Props (user request: no visible blades at speed): spin raised to 150 rad/s (~24 rev/s, was 45) and, while spinning,
  each rotor shows a motion-blur disc (`scene/rotor-blur.ts`: dark smear, faint yellow tip trace, low-contrast blade
  ghosts) with the `PROP_*` blade/tip meshes hidden; hubs stay. A faster mesh spin alone wagon-wheels at 60 Hz.
  Reduced motion keeps the real, still blades. Checked at hero and overhead specs (1440×900).
- Blade sun flashes (user request: blades must read as separate fast blades): the disc is a shader that sweeps two
  blade images (crisp leading edge, long tail; 13 rad/s visible rate, per-rotor phase) and lights them with the live sun
  against twisted, cambered blade normals. Flash gated by the blade images: radial streaks in the hero, narrow
  sectors overhead, pulsing as blades pass. Checked at hero, overhead specs and swarm (1440×900).
- Not changed: loader drone, silhouettes and site renders. The specs callout still reads "Coaxial quad / Four arms
  carry paired upper and lower propellers", which does not describe this drone.

## Raven hexacopter replaces the coaxial quad (user drone, 2026-10-30)

- Hero, swarm and globe load `public/assets/models/raven_hexa.glb` (186,780 bytes), built from the user's `glb/new-drone/Hexa_Medical_Drone_Black.glb` by `glb/new-drone/prepare_hexa.mjs`. Commands: `glb/new-drone/README.md`.
- Prepare step: the six nav point lights are stripped. The props become `Rotor_<Front|Mid|Rear>_<Left|Right>`, with spin directions read from the source's own prop clips (FL/MR/RL CW, FR/ML/RR CCW); the clips are then dropped. The model is centred on the prop ring.
- Texture: lossless WebP, pixel-identical to the source. Geometry: Draco 16/12/16.
- `node scripts/check-raven-rotors.mjs` passes: 6 pivots, 3 CW / 3 CCW, web parity.
- Not yet changed: silhouettes, loader drone, mission-card/demo renders and the footer sequence still show the quad.

## Story band 2 replaces the globe map (user request, 2026-10-30)

- The `#fleet` globe section is gone. After `#parts` the shipped chapters Care teams, Review, Updates, Support and
  Network play again with their original copy, HUD, maps, drones and camera tracks, opening on the finished
  "Keep the care team informed" frame (user's reference frame = end of phalanx-ai). Thermal, ignition and the
  phalanx satellite/city transition are not shown.
- How: `lib/story-map.ts` maps page scroll to story scroll across two bands; FixedContainer is now `position: fixed`
  and placed by `stageTop` (scroll-away after each band, slide-in before band 2); PostFX skips frames while the stage
  is off screen; SceneController snaps per band in page space (reverse snapping stops on the band 2 opening frame,
  then scrolls freely into `#parts`); chapter ticks get their band 2 entries back and jump via `toPage`; the bar's
  Network link and the menu go to `#story-band-2`. The end of the story (multi-threat fade) and footer are as shipped.
- Checked with agent-browser at 1440×900: band 2 slide-in, every band 2 chapter end, hand-off to the about text;
  wheel snapping (real wheel events) down/up in both bands and free scroll above band 2; 60 fps at band 2 chapters and
  `#parts`; no console errors; typecheck and build pass. Not checked: 390×844 for band 2, reverse scroll through the
  band 1 → parts → band 2 jumps with the stage partly on screen at mobile sizes.

## Footer drone: live hexacopter (user request, 2026-10-30)

- ≥1024px: `LandingSequence` draws `RavenModel` (raven_hexa, rotors spinning) in its pixel-space scene instead of the
  96 pre-rendered quad frames. Same frame selection, descent (FRAME_Y, interpolated) and frame travel; drone centre =
  frame top − (FRAME_Y + `FRAME_DRONE_Y` −284) / 1920 × frame size (measured on frame 96), `DRONE_SCALE` 0.36, front
  to camera with a 0.2 rad nose dip; Lightformer studio light. Capsule shimmer, top fade, ground glow, wordmark outline
  and team text unchanged. The loader flag is set when the model mounts (it was set when two frames decoded).
- <1024px: `FooterDrone` shows the hexa at rest (still rotors) where the static frame 0096 was; renders only in view.
- Checked with agent-browser: landing at 1440×900 (progress .55/.75/.9/1), 390×844 and 820×1100 footers; no console
  errors; build passes. `public/assets/images/raven-landing/*.avif` and `LANDING_SEQUENCE` are no longer used.
- The WebGL RAVEN outline wordmark still did not show in headless desktop capture (Open work 2).
- Hover (user: "not flying when the scroll stops"): while airborne the drone bobs (~10 px, two sines), drifts ~5 px,
  sways in roll/pitch (≤0.03 rad) and wanders in heading (≤0.045 rad), easing out over the touchdown (footer progress
  .92–1); off for reduced motion. Base nose dip raised 0.2 → 0.3 rad (`DRONE_PITCH`) so the rotor blur discs read from
  the front instead of edge-on. Checked: three captures 0.7 s apart move; landed view shows the discs.

## Raven homepage layout (user reference `asset/html/raven_homepage.html`, 2026-10-30)

- Structure: loader → hero → story band 1 (Airframe, Connection, Prepare, Journey, Route; unchanged camera tracks,
  transitions and snapping) → `#parts` → story band 2 → about text → footer + landing sequence. Band 2 and the
  skipped chapters are described in "Story band 2 replaces the globe map" above (`lib/story-map.ts`). Mission cards,
  coverage and demo sections were removed (user choice); the about text stays because the landing sequence draws over it.
  (First pass ended the story at Route with a 2500dvh spacer and `STORY_END` gates; superseded by the two bands.)
- Hero: the reference composition (two-line uppercase headline bottom-left, copy + square CTA bottom-right) with our
  copy, motion, loader, drone and terrain. Bar: hexacopter mark + RAVEN, in-page links, boxed Contact cell, black menu
  square, hairline; chapter ticks stay centred in it. `--nav-height` is now clamp(56px, 5.4vw, 82px). Geist kept
  (the reference uses Space Grotesk / JetBrains Mono).
- `#parts`: the reference's sticky horizontal track (Lenis-driven translate, counter + progress bar; native swipe with
  snap below 760px). Its photos showed a different airframe, so each card is a live view of `raven_hexa.glb` in one
  shared fixed canvas (drei `View`, studio Lightformers, real blades via `RavenModel still`); camera turns with the
  card's screen position. Fix found on the way: the shared canvas must reset the clear colour to transparent each frame
  (a view's scene background leaves an opaque clear colour that hid the story stage).
- `#fleet` (reference map layout over our coverage globe) was built, then removed for story band 2 (user);
  `sections/Globe.tsx` was deleted in the 2026-10-31 cleanup.
- Checked with agent-browser at 1440×900 and 390×844: hero, Route, the hand-off into `#parts`, parts track, `#fleet` (since removed),
  footer; wheel scroll continues past Route into the sections; bar link and chapter tick navigation land exactly;
  60 fps at hero, parts and fleet (M3, dev server); no console errors. Typecheck and production build pass.
- Not checked: reverse scroll from the footer through the whole story, 821×1109, reduced motion on the parts views.

## Loader shows the hexacopter (user request, 2026-10-31)

- `build_silhouettes.py` now builds `loading-drone.glb` from `glb/new-drone/raven-hexa-prepared.glb` (decimate 0.17,
  14.7k tris, six props staggered) and re-traces the boot SVG through the loader's desktop camera: viewBox 1089x805,
  h 40.19vh, +0.77vh / -1.1vh (`boot-shape.ts`, `Loader.tsx`). The tracer still reproduces the shipped jet path
  (3626.8, 1320x666). `public/assets/models/loading-drone.glb` 129 KB (Draco 16/12).
- Checked in the browser at 1440x900 (boot path drawn in red over the 3D loader: outlines coincide) and 390x844.
- The flock/ops silhouette (`drone-lowpoly.glb`) is still the quad.

## UI audit fixes (impeccable audit, 2026-10-31)

- Phones: the footer's square `FooterDrone` box (as wide as the footer is tall) made the whole page 589px wide at
  390px; the footer now clips horizontally. Parts track and counter get side padding/scroll-padding below 760px.
- Contrast (WCAG 2.2 AA): footer meta line white/20 -> white/55, footer notice white/50 -> white/60, menu notice
  white/40 -> white/65, form submit white/40 -> white/75, placeholders white/50 -> white/60. Chapter copy halo
  0.25 -> 0.45 and a halo on the airframe callouts, because both sit on live terrain.
- Form: errors are tied to fields with `aria-describedby`, focus moves to the first invalid field, the dialog
  content is left-aligned (it inherited the footer's centring on phones), close button hit area 44px.
- One button language: the shipped white/25 pill (`CTA_CLASS`) is now the homepage's square outlined CTA with a dark
  frosted fill, shared by hero, chapter, footer and form; fields and dialog are square-edged to match.
- Copy: the airframe callout said "Coaxial quad / Four arms carry paired upper and lower propellers"; it now
  describes the hexa ("Six rotors / Six arms carry propellers that spin in alternating directions").
- Focus ring 1px -> 2px white. Footer CTA line is an `h2`. Bar links never drop below 11px.
- Checked with agent-browser + axe (wcag2a/aa, 21aa, 22aa) at 1440x900 and 390x844: 0 violations (was 1);
  page width 390 on phones; form focus and announcements verified. Text over WebGL stays "needs review" in axe.

## Cleanup: unused files and dead code (user request, 2026-10-31)

- Code removed (unreachable in the two-band story, see `lib/story-map.ts`): `Fire.tsx` (sprites showed only for
  ignition > .5 with phalanx < .5), `overlays/ThermalHud.tsx` + the final-pass thermal palette box (`thermalState`,
  four uniforms, iron palette), the Thermal and "Review the affected area" chapters, the eight thermal/ignition HUD
  header lines, the thermal animation flag in the scene store, `buildingsRef`, `RENDER_ORDER.FIRE/SMOKE`,
  `sections/Globe.tsx`, and the wind sprite material in `DroneRig` (updated every frame but attached to no mesh).
  The thermal and ignition scenes stay in `SCENE_ORDER`: band 2 reads their progress (city tile, camera, clear colour).
- Public assets removed: `raven_drone.glb`, `raven_drone_refined.glb`, `raven_quad.glb` (16 MB), the 96
  `raven-landing/*.avif` frames, `images/media/raven-*.webp`, `fx/fire.webp`, `fx/wind.webp`, `textures/globe/`,
  `3d-fonts/orbitron-bold.json`, `draco/draco_encoder.js`. Gitignored USAvionix mirrors moved from `public/` to
  `research/usavionix/public-mirror/` (local only; `build_silhouettes.py` updated). `public/` is now 39 MB, of which
  30 MB is the opt-in `?plate=h00` video.
- Sources removed (user choice): `glb/raven-refined/`, `glb/raven-story/`, `glb/Untitled.blend`, `glb/raven_drone.glb`
  (all recoverable from git history), plus local `.blend1` backups and `glb/raven-quad/media/` render output.
  Kept: `glb/new-drone/`, `glb/raven-terrain/`, `glb/raven-quad/` (builds the loader/flock silhouettes).
- Measured on the production build, agent-browser 1440x900, before -> after: 50 -> 47 requests, 9.28 -> 8.41 MB
  transferred on first load (fire.webp 669 KB and wind.webp 194 KB no longer fetched); 60 fps (vsync cap) at all 11
  checkpoints from hero to footer, before and after; no console errors. Typecheck (with --noUnusedLocals), build and
  `check-raven-rotors.mjs` pass. Captures of Route, the band 2 opening and the footer look unchanged.
- Not done: the shipped `terrain.glb` (2 MB) still loads up front because the flock ground and the city tile base
  map use it; deferring it needs local Suspense around those two consumers.

## Terrain lens retune: high-speed look (user request, 2026-10-30)

- Bug fixed: the low cloud layers (`Clouds.tsx`, transparent full-screen planes) wrote depth after the terrain, so the
  lens read a flat cloud depth instead of the ground. The terrain mask never matched, and both blurs were close to
  zero in every chapter. The clouds now have `depthWrite: false` (they are see-through, so they look the same).
- High-speed look (`PostFX.tsx` constants): the terrain-travel part of the streak is exposed at `SPEED_GAIN` 9x (the
  scene terrain only drifts ~0.5 units/s); camera motion stays physical. The per-frame travel is damped so streak
  length does not flicker. Streak cap `MAX_BLUR_PX` 32 (96 and 48 smeared the overhead chapters into mush), 24 taps.
  Depth of field `COC_INF_PX` 11 (was 7), disc cap `MAX_COC_PX` 40.
- Checked with agent-browser at 1440x900: hero, Airframe overhead and Connection. Thermal wide view barely changes
  (the terrain stops there). fps with the lens on vs `?lens=off`: hero 60.3/60.3, swarm 54.7/49.0, thermal 57.0/53.3
  (dev server, M3; the swarm/thermal dips also occur with the lens off).
- Follow-up (user: "feels too much"): `SPEED_GAIN` 9 -> 6 -> 4 -> 3, `MAX_BLUR_PX` 32 -> 24 -> 20 -> 16 (three user rounds); depth of field `COC_INF_PX` 11 -> 5, `MAX_COC_PX` 40 -> 16 (subtle: strong defocus on a wide aerial reads as a miniature).
- Not checked: mobile widths, Shift boost (will sit on the streak cap), reduced motion (motion blur off by code path).

## Terrain lens: motion blur + depth of field (Raven addition, 2026-10-30)

- `scene/TerrainLensEffect.ts`, one EffectPass right after the RenderPass (uses the composer's scene depth).
  Each pixel's world position is rebuilt from depth; only the terrain band (world y < -1.55: ground + roofs reach
  -1.7, drones never go below -0.55 in any chapter, measured) is treated, and taps landing on nearer objects are
  rejected, so drones stay sharp with no halo.
- Motion blur: screen velocity of that ground point = this frame's terrain travel (`terrainOffset` delta, -Z) plus
  camera motion (reprojection with last frame's view-projection), times a 1/30 s shutter. Near ground streaks more
  than far ground; it grows with Shift boost and scroll; zero history on wrap/ramp jumps, resize or stalled frames.
  Reduced motion: no motion blur.
- Depth of field: thin lens focused on Drone1Group's world distance (7.1 at the hero, 18.5 swarm overhead, 28 in
  the thermal wide view); blur diameter 7 px (1080p) x |1 - focus/distance|, 16 Vogel taps, max 36 px.
- `?lens=off` disables the pass for comparison. Checked hero, mid-scroll, overhead specs, swarm, thermal; 60 fps
  hero, thermal 57.6-58.2 fps on vs 58.6 off (M3); no console errors.
- Idle hero motion blur is subtle by design: the terrain only moves ~0.5 units/s on screen, so a physical shutter
  gives a sub-pixel to ~2 px streak; Shift boost (6x) and scrolling show clear streaks.

## Footer drone: flight and float after drone.riotters.com (user, 2026-11-01)

- Studied (scratch only, nothing vendored): the reference's prettified app chunk (constants module + per-frame drone
  update) and `drone.glb` root/camera tracks. Float: `camera.y += sin(t·0.3Hz·2π)·1` on a 35-unit drone, faded in at 2/s.
  Flight follow: pointer smoothed `1-(1-.03)^(60dt)`, yaw x·2.5°, pitch y·4°, roll -x·3.5°, shift 6%/4% view height.
  Landing: clip frames 855-995 played over 4 s ease-out-cubic when the section is 30% visible, reset when it leaves;
  glide from (y 204, z -322) banked -31°/yaw 21°/pitch -12° levelling by 64% (pitch 50%), then a vertical let-down to
  y 0.27. Landed tilt from 47%: pitch y·8°+5°, roll x·7°, yaw x·5°, lerp .04, drift τ .4 s (5 s near edges), shift 15%/10%,
  camera head yaw 45° / pitch 40° down, 12° up. Propellers keep spinning (75.4 rad/s).
- Raven (`sections/drone-flight.ts`): the same behaviour as fitted curves in drone widths (not the reference keyframes):
  `landingPose`, `FloatBob`, `PointerLean`, `turretPivot` (re-pivots `Hexa_EOIR_Turret` at its mount, per instance).
  Desktop `LandingSequence`: the old scroll-stepped FRAME_Y descent and multi-sine sway are gone; the pad, frame travel,
  capsule (now a downwash shimmer during the glide) and the rest of the footer are unchanged. Mobile `FooterDrone`: the
  same flight (was parked). `RavenModel` gained `onObject`.
- Checked (agent-browser): 1440×900 glide-in burst (small banked drone from the top, nose-up flare, levels, let-down),
  landed float, pointer top-right / bottom-left (drift, bank, lift; copy stays on top and readable), replay after
  leaving and returning, 61 fps; 390×844 glide-in and landed; reduced motion parked and static. Typecheck/build pass.
- Known: the glide happens in screen space on our pixel-space canvas (apparent size + height), not as a 3D dolly; the
  reference's drone stays one continuous object through its page, ours appears for the footer landing only.

## Diagonal wipe joins the story bands; #parts removed (user, 2026-11-01)

- Shipped evidence (prettified copy of `page-33beb1af07230f28.js`, scratch only; REA static graph
  `ev_2fe051321e2fd4966f907c877c0e3dc002c3e3e1d59924f79b519a9dcdcfd174` confirms the module set, it does not index the GLSL):
  terrain/city/fire/grid `hideRatio = remapEased(phalanx-ai, 0, .5, 0, 1, easeInOutCubic)`; `computeScreenUv` rotates
  `gl_FragCoord / resolution` by 225° about the centre after a 1/√2 shrink, `x < hideRatio` = swept (near-black lit
  ground + 0.1 border line); grid group only after ignition > .99; HUD switches header → body at phalanx > .15.
  Reference capture 1440×900: satellite overhead (Camera06 end) swept bottom-right → top-left at 32400-33525.
- Raven: band 2 now starts at the start of phalanx-ai, directly after band 1 (no gap, `#parts` and its nav/menu links
  deleted). Our Route frame (Camera04-02 end) is not the shipped satellite frame. First version (frozen Route frame)
  stopped the terrain and drone (user: "should feel more seamless"), so: through the wipe (first half of phalanx's page
  range) the story holds on Route and everything keeps moving; the swept side shows the Care teams map at phalanx .5,
  which the shipped scene holds still, rendered once off screen (store set without notifying React, final pass
  disabled so the canvas keeps its last frame, `CopyPass` capture after 3 settle frames, store restored, lens history
  reset; repeated after a resize). At the end of the wipe the story switches to the same live map: grid, relief and
  darkness match the capture. Chapter copy + HUD sit in one layer clipped by the same diagonal (`wipeClipPath`), and each
  Route label hides as the edge passes its screen point (`wipeX`). One gesture: Route 25201 → Care teams 29701 and back.
  `#care-teams` anchor (500dvh into band 2) for the Network links.
- Checked (agent-browser 1440×900): two frames 0.6 s apart mid-wipe differ (terrain/labels moving), switch frames
  27440/27460 match, wheel forward/back, 61 fps on Route / mid-wipe / map (one 41 fps reading right after a jump),
  1280×800 resize re-captures, reload inside the wipe works (capture behind the loader); 390×844 mid-wipe.
  `npm run typecheck`, `npm run build` pass.
- Known: the off-screen map render holds the picture for ~4 frames (on load behind the loader; on resize visible as a
  short hold); the yellow points appear right after the switch (shipped phalanx > .5 behaviour); portrait edge is steeper
  (same normalized-uv maths as shipped).

## Opening: live low shot rising into the hero (user, 2026-11-01)

Replaces the 2026-10-31 pad takeoff film (`TakeoffPlate`, `raven-takeoff*.mp4`, removed; Blender sources stay in
`raven-terrain-v04-sky.blend` `15_TAKEOFF` on the Windows workstation).
- Camera (`scene/opening.ts`, applied in `DroneRig` after the Camera01 clip): spherical path about the hero aim
  point (the drone), elevation -8° (kept above y -0.42, over the one-sided cloud layers) → hero 33°, azimuth hero
  -24° → hero, smootherstep. Dolly zoom: fov 75° → 20° with radius following tan(fov/2), drone 0.62× → 1× hero size.
  Orientation slerps onto the clip quaternion over p .85–1. Works from the live clip pose, so desktop and mobile
  tracks both land exactly.
- Lens: `FisheyeEffect` (PostFX, after the terrain lens) barrel 0.32 → 0, corners pinned; pass disabled at p = 1.
- World: `OpeningSky` dome (SKY_COLOR at/below horizon, #6f9fdc zenith, sun glow from `sunlight.direction`, fbm
  high cloud) and two ridge rings (r 78 / 130, ridged integer harmonics, haze to SKY_COLOR), no depth writes.
  Terrain adds rows -1..-3 (cols -1..2) and col 2 rows 0..2 while opening < 1; fog blends to start 9 / end 40 /
  density 1 / blend 0 by (1 - ease). The flank drones (2, 3) are hidden until it lands (user: no second drone in the low shot).
- Checked (agent-browser, 1440×900 and 390×844): low shot at 0, continuous climb (900/1800/2400), hero frame at
  2701 with headline; one wheel gesture 0 → 2701 in ~5 s and back to 0; 60 fps at 0 and 2701; `npm run typecheck`,
  `npm run build` pass. Not checked: Safari/iOS, low-end GPUs (wide fov draws ~15 extra tiles during the opening).

## Seamless camera Prepare -> Route (user, 2026-11-02: screen recording, "awkward motion")

- Measured (1440×900): through the Journey range the camera pitched 40 -> 50.9 -> 31.2 deg (the shipped Camera04-02
  steepens while the tilt cap faded out over flock .4-.75) and the drone drifted past centre and back (screen y
  -0.37 -> +0.05 -> -0.03 -> 0). Now DroneRig replaces the clip there with one move between two fixed poses sampled
  from the tracks (`ClipSeeker.sample`, no mixer side effects): A = tilted Camera03 end (Prepare), B = Camera04-02 end
  (Route holds it). Distance lerps, direction about the drone and orientation slerp, smootherstep ease; the drone-size
  hold and the focus-effects weight use the same curve. The drive value is Journey progress eased over ~0.1 s so the
  shipped wheel burst (246/94/37 px in the first frames) does not jerk the camera; jumps > .5 snap.
- After: pitch 40 -> 31.2, screen y -0.41 -> 0, distance 17.1 -> 14.7, each monotonic; four real wheel gestures (two
  each way) with no rotation/position/screen spikes; rest poses unchanged; build passes. GSAP is not a dependency
  (AGENTS: per-frame maths in the R3F loops), so the easing is three.js MathUtils.

## No zoom in / out between Prepare and Route (user, 2026-11-02)

- Measured hero-drone apparent size (bounding sphere px at 1440×900): 606 Prepare -> 708 (clip camera moving in while
  the top-view x1.35 was still on) -> 576 (enlargement fading) -> 582 -> 793 (shipped dolly push -5 over flock .85-1,
  formerly hidden by the Journey map) -> 524 (pull-back over Route 0-.45). Now: DroneRig sets the camera dolly to 0
  and, on desktop tracks through the Journey range, holds the drone's scale / camera distance on a smootherstep path
  from the Prepare frame (0.0075 x 1.2 x 1.35 / 17.24) to the Route frame (0.0075 x 1.2 / 14.7). Result: 604 -> 525
  monotonic, then 524-525 through Route; one gesture Prepare -> Route without stalls. Mobile tracks unchanged.

## Scanner starts when the flank drones have left (user, 2026-11-02)

- Measured: the two flank drones leave the screen at Journey ~.45 -> .7 (page 16800 -> 17100 at vh 900); the scan
  used to start at Route .5 (~20000). Village scans, the Route copy, the Route HUD lines (Journey .86-.98) and the nav
  Route tick now start at Journey .85 (~17350): three drones -> drones leave -> scan. Checked 16201, 16800, 17100,
  17400, 17700, 22051 and Care teams 26551 (no scans there).

## Journey chapter removed (user, 2026-11-02: "remove this whole part of the scroll")

- The Journey network map is never shown (PostFX flock mix factor 0, FlockPortal never enabled; the load-time warm-up
  remains; `Flock.tsx` `JOURNEY_SHOWN = false` also keeps its dashed DOM/SVG network overlay and the flock simulation
  off: the overlay is not part of the render pass and still faded in mid Prepare -> Route until fixed), its copy ("Keep the delivery in view.") and its nav tick are removed, and Prepare's "Explore the route"
  now scrolls to Route. FLOCK_SCENE still exists in story coordinates (camera/drone clips, fog, flank-drone exit,
  dolly read its progress) but plays on 30% of its page length (`JOURNEY_PAGE_SHARE`) inside the Route snap range:
  one gesture from Prepare is a single continuous move into Route. Band 1 spacer 2500 -> 2150dvh; every later page
  position moves up 3150 px at vh 900 (AGENTS.md verification tips updated).
- Checked (1440×900, wheel): stops 2701, 7201, 11701, 16201, 22051 (Route), 26551 (Care teams), 31051; back from
  Care teams 22051, 16201, 11701; Prepare -> Route frames continuous, no map; no frame over 25 ms; build passes.

## Route: village scans instead of road-object boxes (user, 2026-11-02)

- `DetectionPoints.tsx` `VillageScan` (Raven tile only; `?terrain=original` keeps the shipped boxes): yellow corner
  frames sized every frame to the projected footprint (+6 units margin, ground to roof) of the tile's real
  settlements, measured from the v09 `Houses` mesh (23 houses: Hill / Ridge / Valley village, three Farmsteads), a
  sweeping scan line and a blinking "Scanning" tag (CSS in globals.css; static under reduced motion). Same show gate,
  centre exclusion zone and wipe clipping as the boxes; frames whose top is under the nav (< 110 px) hide.
- Copy: Route body "... road access and the villages between ..."; HUD line 8 "VILLAGES IN VIEW" (was ROAD OBJECTS
  LABELLED). RAVEN_CONTENT_MAP.md updated. `RAVEN_DETECTION_Y` is no longer used on the Raven tile (village y comes
  from the house data); if the houses move, re-measure SETTLEMENTS.
- Checked Route 24000/25201 at 1440×900 over time; build passes. Not checked: mobile/tablet (limit filters by x).

## Jitter fixes in the hero -> Airframe -> Connection scroll (user, 2026-11-02: "there is still a jitter")

- Measured per-frame camera steps during real wheel scrolls. (1) camera-tilt: the orbit heading mixed the clip's
  screen-up into the view heading; the clip has slight roll, so the camera jumped sideways (181 vs ~30) the frame the
  tilt engaged. Heading is now the view heading, with screen-up weighted sin(el)^12 (only near straight down).
  (2) A 50-67 ms stall on the first pass at Connection ~60%: the hero sky-fill hemisphere light was hidden when its
  weight reached 0, changing the light count and recompiling 7 programs. It now only goes to intensity 0. MainScene
  also compiles every material (hidden objects included) once after load (`compileAsync`).
- After: no frame over 25 ms on first passes hero -> Prepare (two fresh loads); speed profile into Connection matches
  the shipped clip. Remaining: a gentle slow-down mid hero -> Airframe where the elevation cap absorbs the clip's
  pitch (smooth, no jumps).
- Second pass (user: "the jitter is still there, make no mistakes"), measured with a per-frame probe (drone screen
  position, camera pose) over real wheel sweeps hero -> Route and back, spike = step > 2.5x its 6 neighbours:
  (3) camera-tilt rebuilt the pose with a level look-at, dropping Camera01's ~2 deg roll in one frame (2.24 deg
  rotation step where the cap engages): the clip's roll is now measured and re-applied about the new view axis
  (fading with the near-vertical heading weight). (4) Gesture start: Lenis scrolls the wheel delta itself (246, 94,
  37 px) before the snap's 2 px/ms takes over. Swallowing the wheel inside the bands removed that burst but capped all
  scrolling at the snap speed; the user found the page too slow, so it was reverted (shipped wheel handling). (5) Journey map transition: its portal scene is rendered once for
  real at load (geometry upload + programs) and the flock mix pass runs for the first 3 frames at factor 0 (identity)
  to compile; it had stalled 33-66 ms the first time.
- After: forward and back sweeps have no rotation or position spikes (largest screen step outlier 0.56 px); seven
  wheel gestures from the top land on 2701 ... 29701; free scroll past the story end and back works; no stalls on the
  Journey transition on two fresh loads. Not fixed (not camera related): a single 33 ms frame at ~27513 (end of the
  band 2 wipe, story switching to the live map).

## Oblique camera in Airframe and Connection (user, 2026-11-02: "make them like the Route camera angle")

- `camera-tilt.ts` `applyCameraTilt` (DroneRig, after the clip and opening): the shipped clip poses are kept and the
  camera's elevation above the hero drone is capped smoothly: the clip's own below 35 deg (`TILT_START`; the hero is
  ~33 deg, untouched), then an exponential ease toward 40 deg (`TILT_ELEVATION`), C1 continuous; distance and orbit
  heading stay the clip's and the pose is rebuilt on that orbit. Prepare keeps it too (user: remove the top-down angle
  entirely); the cap hands off to the Journey network map over FLOCK_SCENE 0.4 -> 0.75. Deviation from the shipped camera tracks (user decision).
- Seamless hero -> Airframe (user): the first version blended clip and tilted poses by weight (straight line); mid-way
  the pitch bumped to ~43 deg and the camera cut inside the orbit (drone swelled, then shrank). Measured clip data
  2701 -> 7201: elevation 33 -> 90 deg, radius 7.0 -> 8.9. Effects weight = smoothstep(clip elevation, 35, 75 deg).
- `cameraTilt.weight` keeps the drone-focus effects on at the oblique angle (larger drone, background blur,
  sun-angled shadow). SpecsCallouts stretch their z anchors by 1/sin(40 deg) with the weight so the four lines keep
  their spacing. Checked 1440×900: 12 frames 2701 -> 7201 move continuously (steady turn from 3/4 to front view, size
  and blur ramp together), Airframe callouts clear, Connection 9500/11701 tags and links follow, Prepare back to top
  view; build passes. Not checked: mobile tracks, narrow desktop.

## Black overlay between terrain and clouds (user, 2026-11-02: "so the ground is a little less evident")

- `groundDimUniforms.uGroundDim` (drone-shadow.ts), multiplied onto every TerrainMaterial's final colour (fog
  included), equivalent to a black layer under the cloud wisps. CloudWisps writes `GROUND_DIM` 0.5 (was 0.35) x its strength,
  so it follows the wisps: off in the opening/hero, on from Airframe whenever the camera looks down, off from the
  Care teams map. Checked hero 2701 (unchanged), Airframe 7201, Connection 9500, Route 25201 (1440×900); build passes.

## Care teams map becomes a clay landscape (user, 2026-11-02: "instead of the 2D map ... a landscape like the HTML",
then "not this top-down view only ... directly show this view")

- Source studied: the `net` section of `asset/html/raven_homepage.html` (inline script 0, read directly; REA CLI
  `analyze-javascript-application` on the extracted scripts, evidence `ev_69f04045…`, static only). Procedural three
  r128 terrain: grey clay by height and slope (`uLow #262626` → `uHigh #8e8e8e`), contour lines (index every 5th,
  `fwidth` AA), a draped dot grid, a cursor glow (raycast hit, eased) brightening lines and dots, a low camera
  (~17°) on a ridged massif, dashed routes and HTML pins.
- Band 2's map is now `scene/ClayTerrain.tsx` + `scene/clay-map.ts`: while the map is on (`clayOn`, same test as the
  tiles' scan ratio > .5) the terrain tiles hide and one dense mesh (361², grid warped: ~0.05 map units at the centre,
  ~0.35 at the rim) draws our Raven tiles from a height field rasterised from `raven-terrain.glb` `Land-A`. The
  reference's colours and contour/dot/glow terms are reused; the old tile shader is unchanged.
- Landscape view: Care teams opens on a low camera (12° elevation, 28 units, heading drift over phalanx .5 → 1,
  `applyLandscapeCamera` in DroneRig after the shipped clip) on one mountain made from our own relief
  (`liftedHeight`): inside a Gaussian footprint (5.5 x 3.8 map units, around the village hill) the real Raven
  heights are raised 2.4 units and their hills/valleys stretched x5.5 about the tile rim, eased off on two village
  shelves. Only a smoothed copy of the height field is stretched (periodic box blur, radius 3 cells x 2 passes, ~5.6
  local units; user: "the tip of the hills looks very sharp"), so the tops stay rounded like our hills and the fine
  detail stays at 1x; the lower village (tile cottages + cluster B) stands on a flat-topped terrace raised 1.1 units
  (`LANDSCAPE.terrace`, exp(-r^4) profile; user: "put this village house a bit more higher altitude"); outside it the ground keeps its real low relief. No invented noise and no texture (user iterations:
  ridged-noise massif → whole tile landscape stretched with land-cover tone → "just the landscape structure of the
  hill/mountain, not the whole"). Over Review progress .04 → .5 the camera blends back to the shipped track and the
  lift goes to 0 (per-vertex `aLift` + `aLiftNormal`; Review .32 → .75 since the climb was added), so from late Review on the map has the real tile heights and
  the shipped overlays, drones and responders fit. The pair drones fly 5 units higher while the lift is on; the
  centre outline, its three points and badge are hidden until it is below .05.
- Village: clay houses on the Raven cottage centres of the nearby tiles plus 17 on the Care teams tile (one larger
  clinic) around the two analysis drone targets; they ride between real and lifted heights.
- Contour lines removed (user, 2026-11-02: "this flows are not required"): the clay shows shading and the dot grid
  only; the cursor glow lifts the clay and the dots.
- Care teams climb (user, 2026-11-02): the two analysis drones stay hidden while the landscape is up; instead one
  Raven (`scene/ClayFlight.tsx`, LowPolyDrone) climbs from the bottom left of the frame to the terrace village along a
  dashed route (ref `routeMat`: drifting dashes, 55% duty, our own path), with a relative climb gauge and
  "Ready / Climbing / Holding above village" (no metres: performance unspecified). Scroll-driven: the first
  part of Review's range is the flight (`pageBands` splits Review at each village stop), snapping at 1 px/ms inside
  it. The camera hand-back moved to
  Review .52 → .75 and the Care teams copy now leaves at Review .54 (was .075). Checked wheel forward/back through
  all stops.
- Second leg (user: "continue the path of the drone to the next village"): `WAYPOINTS` valley → Hill clinic
  (terrace village) → Ridge village (the tile's 7-cottage cluster on the right ridge), one snap stop per village
  (`CLIMB_STOPS` [.25, .5] of Review; at vh 900: 26551 → 27676 → 28801 → 31051). The indicator shows ▲ climbing /
  ▼ descending / holding, the gauge spans the start height to the highest waypoint. Checkpoint pins after the
  reference (dark "+" disc on a stem standing on the site, mono label; display-only, no card): Health centre, Hill
  clinic, Ridge village. The nav tick already reads "Review" during the climb (scene-based).
- Wipe fix (user: "extra frame when the diagonal cut transition is coming"): the wipe shows the map captured at
  phalanx .5, but the landscape camera drifted its heading over phalanx .5 → 1, so a second framing appeared after
  the cut. Heading is now fixed (`LANDSCAPE.yaw` 0.04) and the drone + route render in the capture (only the DOM
  label and pins fade in after the switch). Checked 23800 (mid-wipe) vs 26551: same framing.
- Cursor glow: window `pointermove` (mouse/pen), ray marched against `clayHeight` (CPU mirror of the mesh). The
  terrain lens depth of field is off while the clay map shows; the flat `GridRow` is not rendered in raven mode.
  `?terrain=original` keeps the shipped dark map.
- Checked (agent-browser 1440×900): Care teams 26551 with cursor, mid-wipe 23176 (capture shows the landscape),
  hand-back 27600, Review 31051 (drones over the village), Updates 35551, hero 2701 unchanged; 60 fps on the
  landscape. Typecheck and build pass. Not checked: mobile widths, Support/multi-threat chapters, scrolling back up
  through the hand-back with wheel snapping. Not ported: the reference's pins, dashed routes and drag-to-turn.

## Wipe into the landscape, second pass (user, 2026-11-03: "the extra during the diagonal transition is still coming")

- Found by recording the wheel-driven wipe (agent-browser `record`, 30 fps contact sheets); the 3D frame was already
  identical across the switch. The extras were the overlay layer: (1) pins and the altitude tag were DOM, so the
  capture was bare and they popped in ~0.4 s after the cut; (2) the Route HUD lines flashed for a frame when the clip
  came off; (3) village scan frames anchored just off screen were never counted as swept, and swept ones faded 500 ms.
- Fixes: pins and altitude tag are WebGL now (`scene/ClayMarkers.tsx`: camera-facing, 1 unit = 1 CSS px, Geist Mono
  via drei `Text`, font copied to `public/assets/3d-fonts/GeistMono-Regular.ttf`), so they are in the capture; the copy
  and HUD layer stays clipped until phalanx .7 (`FixedContainer`); HUD lines leaving their section drop instantly;
  `sweptByWipe` clamps the anchor to the screen, sweeps everything once the ratio reaches .995, and swept scan frames
  skip their fade. Re-recorded: Route → wipe → landscape with pins, no flash, nothing lingers.
- Bare Route frame mid-wipe (user screenshot, 2026-11-03): any viewport resize (or a dev hot reload) cleared the map
  capture (CopyPass auto-resized with the composer) and the wipe overlay stayed off until the recapture ~13 frames
  later, so the live Route showed with nothing on the swept side. The capture now has its own target (`CopyPass(target,
  false)`), resized only when the next capture starts; the wipe shows whenever a capture exists (`captured`), and with
  no capture at all while on the wipe the preroll starts after 2 frames instead of 10. Reproduced by resizing during a
  wheel-driven wipe at 1990×1125 before the fix; after it, every recorded frame keeps the map; forward/back clean.

## Story ends at the Care teams landscape (user, 2026-11-03: Review, Support, Network "remove this sections completely")

- Band 2 ends at the ridge village stop (Review .5): `storyMap.L2` = that point, `toStory` clamps there while the
  stage scrolls away, spacer 3200dvh → 850dvh, `pageBands` keeps phalanx + the two village stops. Removed: the
  Review → Network chapter copy, nav ticks and HUD lines; `Perimeters`, `CoordinationDrones`, `PowerStation` (and the
  power-station GLB, `Badge`, `Pill`, four icons) since nothing else used them. At vh 900: Care teams 26551 → Hill
  clinic 27676 → Ridge village 28801 → free scroll into About/footer (page ~31147).
- `findBand` now counts the band's own end as inside, so a reverse gesture on the last stop snaps back (the old last
  stop was never a resting frame).
- The canvas wrapper forced `visibility: visible`, overriding the hidden stage; it only went unnoticed because the
  shipped story ended on a black frame. Raven's ends on the landscape, which stayed behind the footer; the wrapper
  now inherits the stage's visibility.
- Checked (agent-browser 1440×900, real wheel events): stops both ways, Route → Care teams in one gesture, scroll-away
  29300, footer 29900 clean, hero 2701 unchanged. Not checked: mobile/tablet widths.

## Connection shows one drone (user, 2026-11-02: "remove three drone and keep the center one only")

- `DroneRig`: the flank drones (Drone2/3, shipped tracks 02-02/02-03, 03-02) are never shown; their clips still
  run so nothing else moves. `SwarmTags` is now the RAVEN-01 tag only (RAVEN-02/03 tags and dashed links removed).
  The drone shadow already frames only visible drones. Checked Connection 11701 (1440×900); build passes.

## Larger drone in top views (user, 2026-11-02)

- `DroneRig.tsx` `TOP_VIEW_SCALE` 1.35 on mover1 (hero drone), blended by the camera's view direction (-dir.y
  0.75 -> 0.95) and eased over ~0.4 s, the same top-view weight as the background blur. Spec callouts are fixed world
  points near the drone centre and still land on the airframe. Checked 1440×900: hero 2701 unchanged, tilt 4600/5400
  grows smoothly, Airframe 7201 and Connection 9500 larger (Connection side drones unchanged). Not checked: narrow
  desktop widths for callout/motor overlap, mobile (scale applies there too).

## Drone-focused depth of field (user, 2026-11-02: blur the landscape like a film lens focusing on the product)

- `PostFX.tsx`: `COC_INF_PX` 5 -> 60, `MAX_COC_PX` 16 -> 14 (thin-lens CoC = COC_INF_PX x |1 - focus/dist|, focus on
  `Drone1Group`, terrain band only, drones never blurred). Only in top views (user: not in the hero or the oblique
  chapters): strength blends 5 -> 60 with the camera's view direction (-dir.y 0.75 -> 0.95), eased over ~0.4 s so
  snaps and track switches never pop. Overhead ground ~8 px.
  Checked hero 2701 and Route 25201 sharp, Airframe 7201 and Connection 9500 blurred, and the tilt 2701 -> 7201
  (six frames) blurs in gradually (1440×900); build passes. AGENTS.md lens note updated.

## Drone product lighting: tried and removed (user, 2026-11-02)

- A key + rim light rig and a fresnel edge glow on the drone materials (drone-light.ts, DroneLightRig.tsx) were added
  and then removed at the user's request: with more cloud the background is whiter, so the plain dark airframe gives
  more contrast. The rig was never committed, so it is not in git history.

## Drone shadow on the terrain + overhead cloud wisps (user, 2026-11-02: drone must stand out, no extra lights)

- `DroneShadow.tsx` + `drone-shadow.ts`: each frame the drones' opaque meshes (layer 5, override black) are rendered
  from the light into a 1024 half-float map framing all visible drones; every TerrainMaterial (shared uniform
  objects) projects its world position into it and darkens the ground before the fog (13-tap soft penumbra, set in
  world units). Daylight: real sun direction, strength 0.9. Hero overcast preset: softer (0.85; darkened from 0.75/0.65 at the user's request), direction 60% from
  the sun toward straight down (straight down hid it exactly behind the drone). The shadow camera's up is -Z
  (lookAt is degenerate straight down). `?shadow=off` disables it.
- Top views (user: stronger shadow in Airframe): with the camera looking down (same eased -dir.y 0.75 -> 0.95 blend
  as blur and drone size) the shadow goes to full strength, a crisper 0.07 penumbra and a 40 deg sun on the scene
  sun's heading (the ~63 deg scene sun and the overcast hero preset hid it under the drone). Visible beside the
  drones in Connection; in Airframe the large drone still covers part of it.
- The drones' shadow also falls on the cloud wisps (same light-space map, `droneShadowAt` in the wisp shader, x0.85).
  Verified with a temporarily opaque cloud layer at Connection and Route: clean soft hexacopter shadows offset with
  the sun.
- `CloudWisps.tsx`: streaky broken stratus plane at world y -1.25 between drones and ground, scrolling with the
  terrain travel plus a slow wind, faded around where the camera's view ray meets the layer (0.7-1.4 x that distance;
  the camera sits in a moving rig, so its world position is used). On whenever the camera looks down (view y
  < -0.3 -> -0.55) once DELTA_DRONE is past 0.3-0.6 (Airframe, Connection, Prepare, Route), off in hero/opening, from
  the Care teams map and after ignition. Coverage ~40%, opacity 0.68 (raised from ~25% / 0.6, user). (First version faded 8-18 units from the camera and only overhead: invisible
  in Connection, where the camera is ~15-28 units up, and in Route.)
- Checked (agent-browser 1440×900): white-ground isolation at Airframe shows the sun shadow offset lower right;
  hero 2701, Airframe 7201, Connection 9500, Swarm 16201 render; build passes. The shadow is subtle on the busy
  forest texture; terrain travel makes on/off frame differencing unusable (frames differ everywhere).

## Opening horizon artefacts fixed (user, 2026-11-02: "glitched?")

- Ridge rings: the high-frequency gully term (sin 420 x sin 173 of the angle) aliased into vertical comb stripes once
  the rings were lifted; replaced by a soft low-frequency one. Each ring now has a 30-unit fully hazed skirt below its
  foot, so the lift leaves no bottom edge. The cloud-sea bank top is 1.4-2.0 deg (was 1.1-1.7) so no Blender hill
  slivers show above it. Checked at scroll 0 and 900 (1440×900, zoomed); build passes.

## Terrain motion blur reduced (user, 2026-11-02)

- `PostFX.tsx` lens: `SPEED_GAIN` 3 -> 1.5, `MAX_BLUR_PX` 16 -> 9 (terrain-travel streak only; DoF unchanged).
  Checked at hero 2701 (1440×900): houses, trees and paths read crisper; build passes.

## Opening cloud sea (user, 2026-11-02)

- While the opening camera climbs it looked down past the last tiles onto the flat Blender plain (a green band, a hard
  line at the horizon). `shaders/panorama.ts` `cloudSea` adds a procedural sea of cloud on a plane below the camera,
  composited over the land layer inside `panoramaColor`, so the land dome and the terrain fog (`uPanoMix`) both show
  it and the tiles dissolve into it. Coverage is full toward the back, rises toward the left/right screen edges and
  thins toward the near ground; the bank top sits 1.1-1.7 deg above the horizon (varies with heading, soft edge) so it
  also hides the hills there; the far part takes SKY_COLOR. Slow drift (`uCloudTime`, ~1 noise cell per minute, same
  clock in the land dome and the terrain fog so the tiles keep dissolving into the same clouds).
- Checked (agent-browser 1440×900): scroll 0, 600, 900, 1200; typecheck and build pass.

## Hero lighting preset from the user's panel (user, 2026-11-02)

- `scene/hero-light.ts` holds the panel values: sun intensity 0 (colour #fffaf2, azimuth -51, elevation -8, shadows
  on, bias -0.0004 = the panel's "-0.0"), hemisphere sky fill 1.65 (#cfe3ff / #8a7f70, new `hemisphereLight` in
  MainScene), HDRI x0.65 with envMapRotation yaw -27 / pitch 35 / roll 91, grain 0.06, sharpen 0. Weight 1 in the
  opening, hero frame and the whole Airframe chapter, smoothstep to the regular daylight over SWARM_SCENE 0 -> 0.6
  (first version blended over DELTA_DRONE 0.05 -> 0.3; one snapped gesture crossed it and the drone visibly jumped). `sunlight.strength` carries
  the sun-off state to the drone glints and rotor-disc sun flashes.
- Assumed conventions (panel source not available): azimuth = atan2(x, -z) (scene sun -53 there), elevation above the
  horizon, env Euler (x = pitch, y = yaw, z = roll), "intensity x" multiplies the existing drone env intensity.
- Checked (agent-browser 1440×900): opening 0, hero 2701, Airframe 5000/7201 on the preset, Swarm 9000/11701 blending
  back to daylight; typecheck and build pass.

## Opening panorama: no haze gap behind the terrain (user, 2026-11-02)

- The opening low shot showed an empty haze band between the last tile (~45 units, fogged to SKY_COLOR by 40) and two
  flat procedural ridge rings. `OpeningSky` keeps its procedural sky and drifting cloud and draws a Blender land layer
  over it (`glb/raven-sky/`, land mode: 8192x785 RGBA WebP, 365 KB, latitude -22.5..12: low rolling plain (three near
  ridgelines, flattened to 0.45, `LAND_FLATTEN`) settling into a low hazy horizon hazed to SKY_COLOR (no white band), soft separate cloud banks at the ridge-ring
  feet, transparent sky; far ranges and snow massifs removed by the
  user, `FAR_RANGES = False`); during the opening `TerrainMaterial` fades its fog into that layer in
  the same view direction (`uPanoMix` = 1 - openingEase), so tiles dissolve into the distant ranges. The two
  procedural ridge rings (the far mountains) were restored at the user's request, drawn before the land layer and
  raised so their silhouettes clear the Blender hills (near ring 3.2 deg, far ring 5.2 deg for layered depth; lift is
  the last `RIDGES` field); the land layer is a separate
  transparent, depth-tested dome (transparent objects draw after opaque ones, so without the depth test it covered
  the terrain and drones). A full Blender sky + cloud panorama was tried first and rejected by the user (the procedural sky and
  clouds looked better). Off from the hero frame on (uPanoMix 0, dome hidden).
- Checked (agent-browser 1440×900): scroll 0, 900 (no band, ranges continue the tiles), hero 2701 unchanged;
  typecheck, build pass. Not checked: mobile aspect, Safari, fps; the 8192-wide texture needs MAX_TEXTURE_SIZE >= 8192.

## Terrain tile variants: no repeated tree groups (user, 2026-11-02)

- The natural tile was one baked map repeated 15-30 times, so groves repeated every tile. Two extra tree-layout maps
  (`raven-natural-b/c.webp`, 2.7 MB each; build in `glb/raven-terrain/README.md` v11) share the tile's hills, roads,
  rocks, houses and rim band. `Terrain.tsx` gives each natural tile one of three `TerrainMaterial`s by
  `ravenTileVariant(col, row + wraps travelled)` (6-row layout, no equal side-by-side or consecutive tiles), so a ground
  strip keeps its variant when the tiles jump back a row. The two maps load after the scene (not behind the loader);
  until then those tiles show the GLB map. Not under `?terrain=original` / `?plate=h00`.
- Checked (agent-browser 1440×900): opening 0 and hero 2701 render the variant maps, no new console errors;
  `npm run typecheck`, `npm run build` pass. Not checked: a wrap moment frame by frame, mobile, fps.
- Gap: hills, roads and villages still repeat every tile (only the trees vary); +5.4 MB download.

## Terrain v09: Windows look-dev v08 on the site (user, 2026-11-01)

- `raven-terrain.glb` v09: grass/cliff, Poly Haven lawns, BlenderKit moss forest floor, 24 web cottages (16-tri
  proxies baked from Cottage_FREE). Checker PASS, 2.85 MB, same geometry/rim/detection heights as v03. Build notes in
  `glb/raven-terrain/README.md`. Checked 1440×900: opening, hero 2701, Airframe 7201, Route 25201, Care teams 31130.
- Gaps: lawns read straw/orange after the site grade; moss caps on outcrops show as bright green flecks; the base map
  is darker than v03; Cottage_FREE licence (TurboSquid Royalty Free) may not allow a public, extractable GLB; the
  ground material is not in the repo builder scripts yet.
- Opening: the flank drones (2, 3) stay hidden until the opening lands (user).
- Opening: the hero headline shows from the first opening frame (user), not only once the camera lands.

## Larger drones (user, 2026-10-31)

- `DroneRig.tsx` `DRONE_SCALE` 1.2 multiplies all three drone movers' shipped scales in every scene, desktop and
  mobile. Checked 1440×900 hero, Airframe overhead (spec callouts still line up), Connection, Prepare, Route; hero at
  375×812 (earlier hero-only version). Not a shipped value.

## Raven terrain v03: leaf-card tree crowns (user: "trees are looking like blobs", 2026-10-31)

- Same contract and geometry as v02; only the baked base map changed. Broadleaf crowns (`07_masters.py`) are now built
  from the Blend Swap 5671 leaf card: crown blob shrunk to 0.6 (fills gaps only), 46 clumps of 3 outward-facing cards
  at 0.82-1.08 of the lobe radius, leaves 30% translucent, 16 transparent bounces in the appearance render.
- Built on the Windows workstation (OptiX, RTX 3060, 304 s at 4096); Windows `encode.cmd` fails in sharp/libvips
  ("colourspace: parameter space not set"), so the raw GLB was copied over and encoded on the Mac with `encode.sh`.
- `public/assets/models/raven-terrain.glb` 2,677,716 bytes (v02 2,468,236), sha256 `f0285fcb…b5e664`. Checker PASS
  (edges 0.0123 / 0.0137 vs interior 0.0179); `DETECTION_GROUND_Y` unchanged.
- Base map luma (stored sRGB): mean 0.319 (v02 0.352); forest pixels 9% darker than v02, open ground also ~9% darker.
- Checked in the dev preview (1440×900): hero and DELTA overhead load the new file, no console errors. Not checked:
  mobile, production build, fps.

## Raven terrain v02 look-dev map (user reference: golden-hour aerial of green karst hills, 2026-10-30)

- Same `raven-terrain.glb` contract and geometry; only the baked appearance changed. New base map (4096, WebP q80) is an
  orthographic render of the look-dev scene: ~53k trees, ~2k bushes, ~0.5k limestone outcrops per tile placed by
  slope/curvature/sun-facing masks, golden meadow and rock materials, asphalt road, warm 20 deg sun with long shadows.
  House atlas re-baked under the same light. 2,468,236 bytes (v01 873,544). No site code changed.
- Checker PASS (edge continuity required sharp WebP via gltf-transform; Blender's WebP export failed it at 4K).
- Browser (agent-browser, dev server): hero 1440×900, idle 30 s, DELTA overhead, route/detection (anchors on the ground),
  thermal wide view, 390×844 mobile; 60 fps / 16.7 ms p50 at the hero (M3, vsync-capped); no console errors.
- Gaps: trees are baked into the ground (flat at oblique angles, not 3D); haze/clouds from the Blender look-dev are not
  in the site (site fog/grade apply instead); the shipped city tile still differs in style during thermal/ignition;
  the golden light is lower (20 deg) than the drone's scene sun.

## Raven mountain-village terrain replaces the natural tile (2026-10-30)

Brief: `RAVEN_REALTIME_TERRAIN_CLAUDE_PROMPT.md`. Source, rebuild and checker: `glb/raven-terrain/README.md`.

- `public/assets/models/raven-terrain.glb` (873,544 bytes): `Land-A` (20,000 tris, same footprint, flat 2.189 rim and
  planar UV contract as the shipped tile) plus `Houses` (24 houses, 624 tris), baked appearance maps (2K ground,
  1K house atlas). Valley road continues across tile rows; three terraced villages; rock, scree, conifers, summit snow.
- `Terrain.tsx`: tile placement, travel, wrap, ramp, fog keyframes, scan and visibility groups are unchanged. Natural
  tiles use the Raven `Land-A` and map. Each natural tile mounts `Houses` inside its own moving group (houses travel
  with their ground) using a third `TerrainMaterial`, so fog and the Phalanx scan apply to them too. The city tile
  keeps the shipped geometry, base map and `city.webp` overlay, so the thermal/ignition destination is unchanged.
- `DetectionPoints` take `RAVEN_DETECTION_Y` (`scene/raven-terrain.ts`): the shipped anchors sit on their own ground,
  so each anchor's height is the decoded Raven ground at the same x/z.
- `?terrain=original` restores the shipped natural tile; `?plate=h00` also uses it (the plate was matched to it and
  supplies its own hero background, so the two backgrounds never share a test). `plateLight.weight` stays 0 otherwise.
- Depth: the postprocessing composer's targets carry a depth buffer (`depthBuffer` defaults to true), so houses and
  ridges occlude each other; `depth: false` on the canvas context does not affect that path.
- Checked: `check_terrain.py` PASS on the decoded asset (identity nodes, one rim height on all 4 edges, UV error
  0.31 texel, periodic texture edges, houses seated). Headless Chrome (agent-browser, production build): hero 1440×900,
  idle 72 s (over two wraps), Arrow steering and Shift, DELTA mid/end (roofs read overhead), swarm, detection
  (anchors on the ground), thermal, ignition, scan, reverse scroll to the hero, 390×844 (mobile tracks), 821×1109 and
  1600×900 (desktop-only tiles); no console errors (the `toHalfFloat` warning also occurs with `?terrain=original`).
  60 fps / 16.7 ms p50 at hero and thermal for both terrains (vsync-capped on an M3; not a low-end measurement).

Known gaps:
- No settlement/clinic tile: the city tile is still the shipped one, so its texture style differs from the Raven
  tiles beside it during thermal/ignition.
- The shipped 4K terrain map still loads (city base map); the Raven tile adds 874 KB download.
- Softer than the shipped 4K texture at the closest overhead framing (end of DELTA_DRONE).
- Houses are flat-coloured; conifers are baked crowns, not geometry.
- Draw calls: +1 per natural tile for its houses (up to 18).

## Environment plate prototype (opt-in `?plate=h00`, 2026-10-30)

Seedance 2.5 clips (480p, high bitrate, 16:9, 24 fps, silent) of one flight, drawn behind the live drones by `scene/HeroPlate.tsx`. The live terrain stays the default; without the query nothing changes.

| Clip | File | Drives it | Notes |
|---|---|---|---|
| Hero | `raven-h00-loop.mp4`, 6.54 s | time, loops | 1.5 s crossfade loop. Measured drift −146° (up-left) at 3.8 %W/s, matching the live hero (−136°, 3.8 %W/s). |
| Airframe | `raven-s01-airframe.mp4`, 8.04 s, all-intra | DELTA_DRONE progress → measured camera pitch (33.4° → 90°) → clip time | 33° oblique tilts to straight down; health centre enters upper-left. Flow-map drift keeps the ground moving when scroll stops. |
| Connection | `raven-s02-connection.mp4`, 12.04 s | plays from 0 when the tilt ends, then loops 5.5–12.04 s | Straight down, past the health centre. Opening similarity-aligned to the Airframe last frame (seam diff 30.3 → 11.2); the loop range excludes the building. |

- Crossfades: hero → airframe at DELTA_DRONE .02–.08, airframe → connection at .90–.96; fade to live terrain at SWARM_SCENE .88–1.
- Shader: parallax shear on oblique views, two-phase flow map (no reset at loop points), directional motion blur near / disc blur far, haze, grade `pow(c,1.3)*0.9`.
- Lighting (`scene/plate-light.ts`): while the plate shows, the drone uses a plate-matched PMREM environment (hazy sky, high late-morning sun 48° up and 22° left of the view heading, the plate's ground as reflected ground) instead of the sunset `env.exr`. The sun casts soft 2048 PCF shadows on the drones only; `MainScene` refits the shadow camera round `Drone1Group` every 15 frames.
- Prompt rule learnt: the live camera retreats ahead of the drone, so ground must recede toward the TOP of frame. Seedance reads "forward" as content moving down; S02 was generated rotated 180° and turned back.
- Sources, prompts and clip manifests: `research/raven-film/` (local only, `README.md` there).

Known gaps:
- Airframe mid-clip drift runs about 20° right of vertical; live terrain drifts slightly left. Visible only while scrolling.
- Connection keeps one ground scale while the live camera climbs (0.54×); reads as a climb because the drones shrink.
- 480p is soft behind the specs callouts; crossfades show brief double exposure.
- The hand-off to live terrain at Prepare is a visible style change; later chapters have no plates.
- Not checked on mobile widths or mobile camera tracks; not committed or deployed.

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
| Camera + 3 drones, GLB clip seeking, hover/steer, shake | `scene/DroneRig.tsx`, `scene/ClipSeeker.ts`, `scene/Drone.tsx` | `tU`, `tN`, `tC`, `tP`, `tr`, 31905 |
| Terrain tiles, fog keyframes, Phalanx scan wipe, buildings (fire sprites removed 2026-10-31) | `scene/Terrain.tsx`, `materials/TerrainMaterial.ts` | `J`, `K`, `y`, `z`/`V`/`W`, `B`, `G`–`Q` |
| Grid, clouds, detection boxes | `scene/Grid.tsx`, `scene/Clouds.tsx`, `scene/DetectionPoints.tsx` | `et`/`en`, `g`, `D`/`U` |
| Spec callouts, DSA tags (thermal HUD removed 2026-10-31) | `scene/overlays/*` | `tS`/`tR`, `ts`/`ta`/`ti`, `tv` |
| Flock (instanced, separation + Delaunay links) | `scene/Flock.tsx` | `tZ`, `tk`, `tz` |
| Zones, responders, coordination drones, power station | `scene/Perimeters.tsx`, `scene/CoordinationDrones.tsx`, `scene/PowerStation.tsx` | `e1`/`eV`/`eq`, `eb`/`eg`/`eh`, `e8` |
| Chapter copy + time windows, mission log | `scene/ChapterCopy.tsx`, `scene/HudLog.tsx` | `nl`/`nc`, `nd`, 76772 |
| Navbar, chapter ticks (150ms fade → .75s scroll → restore), menu sheet | `src/components/Navbar.tsx` | 72781 |
| Modal, contact form | `ui/Modal.tsx`, `ContactForm.tsx`, `ContactButton.tsx` | 66741, 98317, 52953 |
| Team, footer (mission cards, globe, demo removed) | `sections/Sections.tsx` | 88572, 48847, 98776, 28866 |
| Landing sequence with the live hexa (≥1024px), `FooterDrone` below | `sections/LandingSequence.tsx` | 73560, 68363, 51462, 38219, 80465 |
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
8. ~~Globe orbiters~~: the globe was removed (2026-10-31).
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
