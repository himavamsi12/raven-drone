# Claude Code prompt — USAvionix faithful reconstruction

Recreate https://www.usavionix.com/ with maximum visual and behavioral fidelity in this repository. This is a reconstruction task. Preserve the reference composition, copy, model detail, lighting, typography, chapter order, responsive behavior, and scroll choreography. Do not redesign it or replace its scenes with a generic aerospace landing page.

First read research/usavionix/ANALYSIS.md, home.html, asset-urls.txt, inventory.json, and the relevant shipped bundles. The report distinguishes browser observations from static code findings and unresolved details. Do not claim that an inferred behavior was measured. The source site may change; keep a dated capture of the reference used.

Inspect the existing repository and its AGENTS.md before editing. Preserve unrelated work. Determine the existing framework before installing dependencies. Prefer the current compatible stack; for an empty project use Next.js/React/TypeScript, Three.js, React Three Fiber, Drei, and CSS/Tailwind. Use a single scroll controller, a typed scene timeline, and one shared scene-progress state. The reference uses GLB animation seeking and Motion-style DOM overlays. GSAP is optional, not mandatory.

## 1. Acquire and validate the reference assets

Use the known public URLs in asset-urls.txt. Store needed assets locally under public/assets, preserving their paths. Keep a manifest with source URL, local path, bytes, SHA-256, MIME type, dimensions or GLB metadata, and missing dependencies. Inspect external glTF URIs. Reject HTML error responses pretending to be model/image files. Do not hotlink assets in the completed implementation. Five GLBs have already been captured under shipped/ and can be reused as inputs after validating their headers.

Opening scene assets:
- delta-pbr.glb: five meshes / three materials. Preserve the decals, number, turbine, air and body nodes. Requires Draco decoding and WebP texture support.
- terrain.glb; city-terrain.glb; building.glb; grid.glb; grid-city.glb; power-station.glb as needed by their scene.
- camera-animations.glb and camera-animations-mobile.glb.
- drone-animations.glb and drone-animations-mobile.glb.
- env.exr, terrain textures, noise/wind/fire effect textures.
- loading-delta.glb for the loader.

The hero is REAL-TIME 3D. Do not implement it with the landing AVIF sequence. That separate sequence is /assets/images/landing-sequence/0001.avif through 0096.avif and belongs to the later landing/footer experience. Desktop >=1024px uses that sequence; smaller layouts use the final-frame static image. Do not replace either technique with the other.

If an essential asset is unavailable, list that specific blocker and the resulting visual difference. Do not silently substitute a stock drone and call the result exact.

## 2. Establish reference states before building

Observe the live page at 1440×900, 821×1109, and 390×844. Capture the hero at rest, hero text exit, 25/50/75/95% of delta-drone, start/middle/end of swarm, each later major chapter, footer sequence start/middle/end, menu open, and contact modal. Record actual scrollY, viewport, visible copy, active chapter, camera framing, and model bounds. Use deterministic settled captures; separate idle motion from scroll effects. Capture both downward and upward travel. Collect actual mobile behavior instead of shrinking the desktop screenshot.

Recover remaining numeric settings from shipped code and runtime evidence: scene scale, camera FOV, initial transforms, renderer tone mapping/exposure, fog, light/environment intensity, postprocessing, smoothing, and breakpoints. Do not invent these values where evidence is available. Check model node names in the loaded GLBs against the code; resolve punctuation/name normalization explicitly.

## 3. Build the visual foundation

Use Geist and Geist Mono. Recover the local font files from the HTML/CSS. Base background #0f0f0f; white primary text; muted white secondary text. Technical status colors include #f66, #ffcb47, #7aebff. The token named green is actually cyan. Hero/overlay transition flash color is #FF2200.

Desktop hero type: 80px size, 76px line height, weight 600, tracking -.04em, max width 816px. Desktop section headline: 76/80px; secondary heading 50/52px; supporting hero copy 29/32px, weight 500, tracking -.01em. Mobile hero 43/38.7px, weight 600, -.04em; mobile supporting copy 19/20px. Confirm responsive scaling against screenshots.

Header fixed at top, 56px high, 32px desktop and 16px narrow horizontal padding. Wordmark left, compact chapter ticks/label centered, Contact translucent pill and three-line menu right. Portrait <480px may collapse wordmark to mark after 40px scroll. Preserve hover/focus styles. CTA is rounded-full with white/25 background, white/30 hover, 20×12px padding; Explore approximately 250px wide. Use crisp fine technical lines and small square endpoints for annotations.

Do not put hero text into cards. The hero is an edge-to-edge muted rocky terrain scene with atmospheric fog, dark corners, a detailed charcoal drone, white decals and small yellow markings. Upper-left oversized headline and lower-right supporting copy/CTA on desktop. Match exact line breaks, margins, model silhouette, shadow, exposure, and terrain contrast.

## 4. Implement the opening continuous scene

Use a sticky full-dynamic-viewport canvas inside a long scrolling wrapper. Keep the scene continuous across hero, specs and swarm. Separate scroll spacers from overlay presentation. Avoid remounting the renderer at each chapter.

Create scene definitions with id, scroll span, progress, active, showRatio, hideRatio, camera clip, drone clips, and overlay windows. The reference spans are intro-scene 100vh; delta-drone and swarm-scene 500vh each. Most later chapters also 500vh, except zone-stabilized 100vh. Read the complete ordered list in ANALYSIS.md. Verify computed offsets rather than assuming span sums equal final runtime offsets.

The exact hero copy is in ANALYSIS.md and home bundle. Hero begins with a close oblique overhead drone view, nose toward the lower-right region. Initial scroll transitions toward a centered top-down drone composition while terrain remains continuous. Hero copy must exit by delta-drone progress .075.

Load GLB camera/drone clips into animation mixers. For each active stage seek action.time = clip.duration * normalizedProgress - epsilon; update the mixer/trackers in the correct frame order, and copy the animated tracker transforms to the camera/drone mover. Reference uses play + paused actions. Preserve parent transforms and glTF coordinate conventions. Do not just lerp between two guessed camera positions. Verify endpoint continuity, forward/reverse scroll, resize, and deep-link/reload behavior.

Map delta-drone → Camera01; swarm → Camera02 with Drone02-01 and Drone03-01; mission → Camera03; flock → Camera04-02; thermal → Camera05; ignition → Camera06; analysis → Camera07; interdrone coordination → Camera08; multi-threat response → Camera09. Use separate mobile tracks at the recovered >=768px selection boundary. Presence of extra unused clips is not a reason to play them.

Keep micro camera shake/wind distinct from scroll-driven motion. Match the source fog and material uniforms by scene progress. Use the actual env.exr reflection/illumination and preserve model PBR maps. Recreate shader effects from the relevant shipped code in readable modules, preserving their behavior and verifying visually.

## 5. Specifications and swarm overlays

Near the end of delta-drone, show the four feature callouts: 400 km/h Top Speed; VTOL Architecture; Onboard AI Compute; Multi-Sensor Payload Suite. Recover exact descriptions from the bundle. Callouts are 3D-anchored HTML/SVG, not screen-fixed labels floating independently of the model. Visibility gate is delta progress >.9 and swarm progress <.01. Use screenshot evidence to confirm the narrow active window.

Leader lines draw over about .8s with a .3s delay, with endpoint squares about 1.1s; stagger individual callouts. Overlay text entrance: opacity 0, y +8px, #FF2200 → opacity 1, y 0, white, .4s easeInOut. Exit opacity 0, y -8px, #FF2200. Supporting text delay .2s; CTA delay .4s.

Swarm expands to three drones using the recovered animation tracks, changes camera framing, and introduces DSA011/012/013 tags and dashed connection lines. The headline is Understanding the Swarm System on tall desktop and The Swarm System on narrower/shorter layouts. Preserve the accompanying autonomy/scalability/collaboration content from the bundle. Technical character reveals may use shuffled per-character timing; do not replace them with a typewriter if the reference does not.

Chapter navigation labels and click behavior must work. Reference navigation fades scene over 150ms, scrolls for .75s, then restores it. Do not use long crossfades between normal stacked sections to simulate the pinned camera move.

## 6. Complete the remaining page

Follow scene order and overlay windows from the shipped bundle: mission setup, flock/sync, detection, thermal irregularity, ignition verification, Phalanx AI, system analysis, integrated notifications, interdrone coordination, support, stabilization, multi-threat response. Recreate scripted detection tags, threat areas, sensor HUD, shader mode changes, notifications, tactical grids and infrastructure state. Presentation labels are scripted demo content; do not pretend to implement live object detection.

Then implement the mission cards, coverage/globe section, live demo request, team statement, and footer. Preserve exact reference text and images. Footer sequence has 96 frames and non-linear progress mapping described in ANALYSIS.md. Original shader samples the current frame only; base1 blending is commented out. Start with faithful frame selection rather than adding a different effect. Implement frame readiness, texture disposal, memory limits and stopping inactive render loops. Preserve final-frame mobile fallback and chapter/header layer ordering.

Implement the menu and contact/request modal with working keyboard focus, Escape, close buttons, body scroll locking and accessible labels. Do not submit real contact requests while testing. If no backend is provided, make submission state explicit instead of showing a fake successful delivery.

## 7. Performance, accessibility and verification

Use one progress source and one RAF owner; do not stack Lenis smoothing with GSAP scrub smoothing without evidence. Avoid React state updates every frame. Use refs/uniform updates for hot paths. Reuse geometries/materials and instance repeated tactical objects where appropriate. Limit DPR based on evidence and device. Pause offscreen renderers; dispose resources; avoid decoding 96 full-size frames on a low-memory phone when it uses a static fallback.

Keep text in semantic DOM. Support keyboard chapter navigation, real focus styles, accessible dialogs, readable contrast and reduced-motion/fallback states. A reduced-motion implementation is a reconstruction safeguard unless observed in the original; document that distinction.

Compare reference and implementation at identical viewport, scroll position, and settled state. Check model bounds, camera angle, heading wrapping, terrain scale, fog, exposure, annotation anchor alignment, text timing, chapter offsets, reverse scrolling and mobile track composition. Use image diffs and side-by-side captures. A passing build is not evidence of visual fidelity. Report remaining discrepancies honestly. Do not claim exact equivalence without matching evidence.

Deliver runnable local code, asset manifest, a short architecture note, reference/local comparison captures, checks run, and a precise discrepancy list. Prioritize hero→specs→swarm fidelity before polishing later content, but complete the requested homepage.

## Skills and technical capabilities

Use reverse-engineer-anything, agent-browser, ui-skills-root, web-animation-design, fixing-motion-performance, fixing-accessibility. Add extract-design-system/create-design-md and review-animations as useful. Read applicable SKILL.md files before using them. If you choose GSAP, use gsap-scrolltrigger, gsap-react, gsap-timeline and gsap-performance selectively. Do not load every design skill or redesign this reference. Blender skills are only needed if supplied assets cannot be reused. Required engineering knowledge includes Three.js/R3F/Drei, GLTFLoader + Draco, GLB AnimationMixer, shader uniforms/GLSL, EXR environment lighting, scroll progress mapping, responsive camera composition, and visual regression testing.
