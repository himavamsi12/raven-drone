# Raven quadrotor — reference-driven Blender production brief

## Task for Claude

Create an updated Raven medical cargo drone in Blender using the supplied DJI product imagery as the visual reference. Produce a convincing manufactured object with the reference's light-gray shell, dark carbon arms, satin-black propellers, textured black motor housings and rugged black cargo case. This is a new four-rotor Raven variant, not an exact mechanical replica of the reference aircraft.

**Required departures from the reference and existing Raven:**

1. Exactly **four arms, four motors and four propeller assemblies total** in an X configuration. Each assembly has one two-blade propeller. Not six rotors; not eight coaxial rotors; not four blade pieces masquerading as four motors.
2. Remove the tall central cylinder/mast projecting above the front/top shell, including its pedestal, collar and mounting flange. Rebuild a continuous, low-profile shell in that area. Do not leave a stump, hole, floating cap or black ring.
3. Keep Raven's medical supply purpose and underslung cargo case. Use restrained Raven identification, not DJI marks or unsupported product specifications.
4. Match the reference finish and material separation much more closely than the current dark Raven asset. In particular, the main shell must become a light, subtly cool neutral gray; do not retain the all-dark-graphite treatment.
5. Preserve the host site's existing camera paths, scroll behavior and transitions. Asset fitting and a four-rotor adapter may be necessary later, but do not rewrite the camera choreography to hide modeling errors.

Read this entire brief and inspect the source images/videos before building. A material palette alone is insufficient: silhouette, edge radii, assembly relationships, surface normals, texture scale and lighting must agree.

## 1. Reference package and evidence

Project root at time of writing:
`/Users/sixjuly14/Documents/Bishwa/Sixjuly/drone-site`

Paths below are relative to that root. Preserve the source media.

| Input | What it establishes |
|---|---|
| `research/raven-reference/reference-folded-top.png` | Supplied still 1: folded top view. Gray shell end sections, dark central battery/electronics spine, layered service panels, long satin propeller surfaces, white blade-tip markings, discrete screws and black structural recesses. Useful for top-surface finish, not the requested deployed layout. |
| `research/raven-reference/reference-flight-three-quarter.png` | Supplied still 2: deployed three-quarter view. Main geometry and material hierarchy: light shell, slender woven-carbon tubes, coarse motor pod texture, separate smooth motor rings, finned modules, paired front optics, large dark cargo case and tubular landing skids. The tallest mast is explicitly excluded from Raven. |
| `asset/video/0e4b0f41-9719-4413-908f-14fd5cbf3bd8.mp4` | 8.04 seconds, 1280×720, 25 fps. Multiple flying/underside/upper views, spinning propellers, red/green markers, blue sensing-beam graphics, concluding blue terrain/particle graphic. Most useful for underside relationships and changing highlight behavior. |
| `asset/video/d7f4d044-cdc8-452e-b58e-ca4a3bcf66af.mp4` | 5.24 seconds, 1920×1080, 25 fps. Folded-to-deployed presentation, camera moving toward a front/three-quarter product view. Most useful neutral-lighting video for shell tone, arm hinges, battery deck, blade curvature and motor pod finish. |

Inspection aids already extracted:

- `research/raven-reference/video-1-dense.png`: 16 samples at a 2-fps sampling rate, ordered left-to-right, top-to-bottom. Covers approximately 0–7.5s; samples represent half-second intervals, not frame-by-frame analysis.
- `research/raven-reference/video-2-dense.png`: half-second samples across the 5.24s clip. Last unused contact-sheet cells are black.
- `research/raven-reference/frames/video-2-1.5s.png`: full-resolution extracted frame during deployment, useful for carbon tubes, gray shell, black battery pack, fasteners and blade-tip markings.
- `research/raven-reference/frames/video-1-2s.png`: full-resolution upper three-quarter view with blue beam overlays. Useful for shape; unreliable for neutral albedo.

### Evidence boundaries

The following are directly visible: multiple distinct surface finishes, a comparatively light shell, dark carbon-like tube weave, coarse black case/pod surfaces, smooth thin blades, white tip accents, small yellow warnings, red/green indicators, screws, seams, vents and structural layering.

The reference appears to use **four coaxial rotor stations with upper/lower propellers**. Do not reproduce that mechanism: the user's requirement is four single-propeller stations total. The long propeller blades overlapping the frame can obscure the count in an individual image; use the unfolding video to understand the assembly.

The exact polymer resin, carbon layup, coating chemistry, dimensions, spectral reflectance and factory roughness are **not recoverable** from these promotional shots. Material identities below are appearance-based authoring interpretations. Hex colors and BSDF values are starting targets, not measured manufacturer specifications. Do not state that a render-derived color equals the real object's physical albedo.

The bright blue cones/rays and final blue landscape are presentation graphics. Do not turn them into blue base color, glowing shell material, a holographic coating or permanent emitters on the asset. Small red/green position lights are separate from these graphics.

## 2. Art direction and overall read

The target is a serious industrial logistics aircraft photographed in a controlled product studio. It should feel assembled from different manufactured parts rather than sculpted as one object.

The dominant visual arrangement is:

- Light cool-gray front/top shell with broad soft highlights and restrained molded facets.
- Dark charcoal battery/electronics spine behind it, with service breaks and shallow raised rails.
- Four thin, long dark woven-carbon arms, interrupted by distinct clamps and hinge hardware.
- Four upright black motor pods, with rounded transitions, a coarse textured outer cover and more precise machined cap/ring parts.
- Four thin two-blade propellers with gently curved/twisted surfaces and small pale tip markings.
- A large black rugged case hanging centrally below the body, with molded perimeter structure, a lid seam and a small latch.
- Two slender U/skid-style landing rails framing the case, with a believable load path back to the chassis.

Gray identifies the body; black/dark gray identifies structure and cargo. Carbon pattern is confined to plausible composite parts. Avoid a copper/brown cardboard parcel, olive-green case, chrome arms, bright white shell, saturated medical colors or oversized luminous crosses.

Use a clean, lightly handled factory finish. Realism should come primarily from geometry, normals, scale and reflections. Do not fake realism by adding mud, random rust, heavy scratches, soot, large dents or a uniform noise overlay.

## 3. Geometry and proportions

### 3.1 Coordinate and scale convention

Author in Blender meters: Z up, X lateral, front along -Y. Export glTF Y up; this produces front along +Z in glTF and can retain the existing Raven visual adapter's 180° Y rotation. Verify by exporting a small orientation test rather than assuming the convention survived parenting.

Place the main asset root at the flight-rig reference origin near the center of the rotor deck. Keep stable object transforms. Separate visual geometry from the root used for path animation. Do not bake host-site camera movement into the GLB.

The following are **provisional visual design dimensions**, not evidence about DJI or flightworthiness. They keep Raven near the previous roughly 2.34m visual envelope:

| Element | Starting dimensions/position |
|---|---|
| Motor center positions | X ±0.80m; Y ±0.65m; common hub height approximately Z +0.15m |
| Propeller radius | Approximately 0.32–0.34m, two blades per station |
| Rotor-tip overall footprint | Approximately 2.24–2.28m wide × 1.94–1.98m long |
| Central body | Approximately 0.50–0.55m wide × 0.75–0.85m long, low main-shell height 0.15–0.20m |
| Carbon arm tube diameter | Approximately 45–60mm; avoid oversized log-like arms |
| Cargo case | Approximately 0.40–0.45m wide × 0.38–0.46m long × 0.30–0.36m high |
| Cargo/landing relation | Case below body, skids below case with visible ground clearance; do not let the case touch the ground first |

Adjust these as a coherent set to match reference proportions and prevent intersections. Do not compensate for a stubby body with excessively long arms. Check rotor disk clearance against other disks, shell, wiring and landing structure. This is a visual model, not an engineered airframe with validated mass/structural/flight performance.

### 3.2 Four-arm conversion

Build an intentional quadrotor X layout. Simply deleting the existing two middle rotors is insufficient if it leaves six-arm sockets or front/rear arms with a hexagonal spread. Remove unused arm roots, duplicate fasteners, wiring, warning bands and mount stubs. Re-space/re-angle the remaining four arms and their root brackets so each is structurally connected to the chassis.

Keep the front and rear silhouettes legible. Motor axes must be parallel and vertical. Do not tilt motors randomly to make the still look dynamic. If a flight pose is needed, tilt the entire drone through a separate pose root.

Each motor station contains:

1. Static arm-end bracket and cable attachment.
2. Static motor housing, textured pod cover and appropriate vent/finned detail.
3. A named rotating propeller pivot on the true shaft axis.
4. Rotor bell/cap only if designed to rotate with the propeller.
5. One two-blade propeller, not two separate overlapping complete propeller assemblies.

Do not spin the entire arm, electrical cable, stationary motor outer housing or cooling fins.

### 3.3 Main shell and mast removal

Use the stills to guide the faceted-but-soft front shell: broad central planes, shallow shoulder slopes, small lens recesses, controlled seams and gently softened corners. Avoid a collection of unrelated stacked boxes.

Remove the conspicuous tall central cylinder currently projecting upward from Raven's head/top. Remove its pedestal/collar too. Close the surface with a low, continuous panel that follows adjacent shell planes. A shallow service-panel seam is acceptable; a replacement tower is not. Preserve four motor hubs; these are not the removed mast.

Because the current drone body is merged/multi-material geometry, the mast may be part of `Drone_Body`, not a conveniently separate object. Identify its connected components and mounting geometry in mesh space. Do not remove all geometry sharing its material. Rebuild the affected shell and normals after removal; check the silhouette from front, side and top.

Retain small, flush front sensor optics if useful for the reference appearance. Mount them in black inset bezels with two or four subtle lens elements. Do not add a large camera turret, antenna forest or another protruding top sensor.

### 3.4 Details that matter at close range

- Consistent narrow panel gaps and overlap logic; approximately 0.5–1.5mm where appropriate for this visual scale.
- Real edge radii on shell transitions and brackets. Start around 1–3mm for molded shell edges and 0.3–1mm for machined brackets; tune by silhouette and close-ups.
- A clean highlight running around an edge should have width; do not rely on normal smoothing across a mathematically sharp corner.
- Recessed fastener seats with dark metal heads. Use modest sizes and credible counts; no decorative bolt grid.
- Root clamps that actually wrap the carbon tube, a legible hinge/pin if retaining folding-arm cues, small protected cable loops.
- Cooling fins/vent slots with actual depth for foreground modules. Bake distant repeats when they no longer affect silhouette.
- Landing tube joints, small collars and rubber contact pads. Tubes remain slim and round, not flat rectangular bars.
- Case perimeter lip, shallow molded ribs, protected corners, lid split and a recessed latch. Avoid a featureless black cube and overdeep sci-fi bevels.
- Small labels and yellow warning bands placed on real surfaces with correct orientation. Use Raven markings; do not invent serials/certifications or copy DJI branding.

## 4. Material specification

### 4.1 Color workflow — read before entering values

The hex swatches below are **sRGB appearance targets** for neutral-light look development. Blender BSDF Base Color inputs use scene-linear values. Convert sRGB components before direct Python assignment; typing a hex color through Blender's color picker normally performs the conversion. Do not paste sRGB channel fractions directly into Python Base Color and then wonder why the shell is washed out.

For one normalized sRGB component c: linear = c/12.92 when c ≤ 0.04045; otherwise ((c+0.055)/1.055)^2.4. Base-color image textures are tagged sRGB. Roughness/metalness, normal, height and AO are Non-Color.

Use only exporter-supported Principled BSDF material paths for the final asset. Dielectrics have Metallic 0; bare metals have Metallic 1. A nonmetal coating over aluminum is still authored as a dielectric coating when that is the visible surface. Avoid making every dark part half-metallic.

### 4.2 PBR material table

Ranges are starting points to refine under matched lighting, not fixed truths. Coat means Principled Coat Weight, with Coat Roughness listed separately.

| Surface / material name | sRGB target / allowable range | Metallic | Roughness | Coat / other settings | Appearance to achieve |
|---|---|---:|---:|---|---|
| `MAT_Raven_Shell_CoolGray` | Start **#A3A4AC**; tune roughly #91939D–#B1B2B8 | 0 | .32–.44 | Coat .05–.12, coat roughness .30–.42; IOR ~1.46 | Light neutral/cool-gray molded shell. Broad soft highlight; smooth fine-grain finish. Not glossy automotive paint, raw silver metal, chalky white or blue plastic. |
| `MAT_Raven_Deck_Charcoal` | **#414249**, range #34353D–#505159 | 0 | .46–.60 | Coat 0–.06 | Dark battery/electronics casing, shallow molded texture, distinct panel rails and service boundaries. |
| `MAT_Raven_Carbon_Tube` | **#22262B**, alternating weave tones around #1B1E23 / #30343B | 0 | .27–.39 | Coat .15–.28, coat roughness .22–.34 | Tight resin-coated carbon twill on tubes; weave revealed by light, not high-contrast checkerboard paint. |
| `MAT_Raven_Motor_Pod` | **#1B1C20**, range #15161A–#292A2F | 0 | .60–.75 | Coat 0–.03 | Black pebbled/textured outer motor pod. Grain noticeably coarser than shell but not rock/gravel. |
| `MAT_Raven_Propeller` | **#16181C**, range #111317–#24262B | 0 | .28–.40 | Coat .03–.10 | Smooth satin composite blades. Long, soft moving highlights; almost no visible coarse bump. |
| `MAT_Raven_PropTip` | **#C9CBD0**, range #B9BCC3–#D5D6D9 | 0 | .40–.53 | Match blade substrate | Small pale tip marking; not an emissive stripe. |
| `MAT_Raven_Case_Pebbled` | **#24252A**, range #1A1B20–#303138 | 0 | .65–.80 | Coat 0 | Rugged dark case, dense molded/pebbled grain. Material interpretation is visual; do not assert the real reference is a particular foam or polymer. |
| `MAT_Raven_Case_Side` | **#36373D**, range #292A30–#45464D | 0 | .57–.72 | Coat 0 | Slightly smoother side panel than textured case end; do not put the same coarse grain everywhere. |
| `MAT_Raven_Frame_Coated` | **#202227** | 0 | .35–.49 | Coat .03–.08 | Coated black landing tubes and brackets, smooth with restrained fine wear. |
| `MAT_Raven_Exposed_Metal` | Neutral reflectance starting around #8F9399; keep areas small | 1 | .26–.40 | Fine directional brushing if visible | Fasteners, shaft collars or exposed metal surfaces. Do not turn whole arms or shell into chrome. |
| `MAT_Raven_Rubber` | **#141519** | 0 | .72–.88 | Coat 0 | Pads, seals, cable boots; very subtle microtexture. |
| `MAT_Raven_Lens` | Near-black neutral with restrained blue-purple coating | 0 | .06–.15 | IOR ~1.5; transmission only for actual glass thickness | Small optical reflections within a dark recess. No bright blue glowing eyeballs. |
| `MAT_Raven_WarningYellow` | **#D2AA27**, keep area tiny | 0 | .45–.60 | No emission | Narrow warning labels at arm roots; not gold metal. |

Position LEDs: small separate red/green optical elements with subtle emission, not glowing motor housings. Tune emission under exposure; start around 1–3 rather than flooding the drone with bloom. Avoid green/blue casts across the gray shell.

### 4.3 Reference priority for color

Use still 2 and the neutral unfolding video for color matching. Still 1 has deep top-view shadows: use it to understand the relative material hierarchy, not to darken every surface. The blue-beam video must not drive the shell albedo. Compare highlights, midtones and shadows on the same material before changing base color.

The shell may read silvery because of studio highlights, but the visual target is a dielectric gray surface with restrained reflectance. Do not set Metallic 1 merely because it looks silver in a bright patch.

## 5. Texture and finish specification

### 5.1 Carbon arms

Create a small-scale 2×2 twill-like weave with two alternating thread directions following the tube. Texture orientation must continue plausibly around the circumference and along its length. Use cylindrical UVs with a seam on the underside/back, not arbitrary cube projection causing square discontinuities across the tube.

Suggested visual starting scale: weave cells about 1–2mm; tune from reference close-ups, since exact physical scale is unknown. Keep albedo variation low (roughly 5–12% around the dark base). Let roughness/normal variation provide most of the weave visibility. Small normal response; no rope-like raised ridges or chessboard contrast. Normal amplitude must not change the arm silhouette.

### 5.2 Light-gray shell

The shell should look smoother than the pod/case. Use fine, barely perceptible micrograin and broad, low-frequency roughness variation. Start with ±.02–.035 roughness modulation, clamped inside the intended range. Under an overall product shot the surface should read as gray satin, not noisy plaster.

Use very slight edge handling only at exposed service edges. Keep the albedo clean; do not scatter dark speckles on the body. Do not use a normal map to simulate the main shell facets, panel gaps or mast removal: those require geometry.

### 5.3 Motor pods and cargo case

Use a dense irregular pebbled texture with rounded irregular cells, not white random noise and not uniform orange peel. Suggested feature sizes: about .15–.45mm for pod finish and .3–.8mm for the rougher case end. These are authoring estimates; compare at the reference framing.

Use height variation on the order of tens to a few hundred micrometers as a starting point. Bake tangent-space normals and tune their strength at target resolution; do not treat this as a measured physical surface. It should catch small highlights without looking melted or eroded. Do not use actual displacement that swells the case or motor silhouette.

Keep case side panels slightly smoother than the coarse end surface. Lid seams and corner protectors must remain crisp enough to identify construction.

### 5.4 Blades and tip accents

Propellers are thin airfoil-like forms with tapered planform, curved leading/trailing edges and gentle pitch/twist. They are not flat rectangular paddles or straight tapered cylinders. Give them a clean satin finish. Avoid the conspicuous carbon checker texture used on the arms: the reference blades mainly read as smooth black.

Add small pale-gray/white tip patches whose boundaries follow blade shape. Use dedicated UV space or a restrained separate material region. Keep tip lengths consistent across all eight individual blades. Avoid yellow tips unless the references explicitly require them; the visible pale tips are the primary cue.

### 5.5 Texture delivery

Author high-quality textures for the Blender source, then create a separate web set. A practical starting allocation is 2K shell/case atlases and 1K tiling carbon/pod surfaces, reducing secondary maps when close-up tests show no loss. Prefer a few well-organized shared materials over dozens of duplicate 4K maps.

Export-ready channels: base color, normal, packed occlusion/roughness/metallic where used. glTF ORM convention: R occlusion, G roughness, B metallic; AO may need its exporter-recognized hookup. Do not bake lighting or dark studio reflections into base color. Do not multiply AO into albedo permanently. Avoid double AO in the browser.

Procedural Blender noise/weave/bump nodes are authoring tools, not deliverables by themselves. Bake what must survive into exporter-supported image textures. Connect tangent-space normal textures through a Normal Map node. Match tangent basis/UVs to the actual exported mesh. Pad UV islands and inspect mipmapped seams, flipped normals and visible texture stretching on top, bottom and sides.

Use only gentle compression on normal maps, or preserve them losslessly if compression creates ripples. Compare the compressed GLB against the textured source. Compression must follow appearance validation, not replace it.

## 6. Four-propeller rig and runtime contract

Suggested hierarchy:

```text
Raven_Root
  Body_Shell
  Battery_Deck
  Front_Optics
  Cargo_Case
  Landing_Frame
  Arm_Front_Left
    Motor_Static_Front_Left
    Rotor_Front_Left              [pivot at shaft center; CW metadata]
      Propeller_Front_Left       [two blades plus rotating hub if appropriate]
  Arm_Front_Right
    Motor_Static_Front_Right
    Rotor_Front_Right             [CCW metadata]
      Propeller_Front_Right
  Arm_Rear_Left
    Motor_Static_Rear_Left
    Rotor_Rear_Left               [CCW metadata]
      Propeller_Rear_Left
  Arm_Rear_Right
    Motor_Static_Rear_Right
    Rotor_Rear_Right              [CW metadata]
      Propeller_Rear_Right
```

CW/CCW here are viewed from above; choose a consistent viewing convention and reverse opposite pairs. Shape blade pitch/handedness consistently with the selected spin; do not just mirror label text. Two diagonal pairs counter-rotate. No `Rotor_Mid_Left` or `Rotor_Mid_Right` in the delivered variant.

Keep pivots at true shaft centers, not at the whole drone origin or arbitrary geometry centers. Blender local spin axis is Z; after glTF conversion verify which local axis represents the shaft, normally Y with this convention. Do not blindly reuse a sign or axis if parent rotation changed it.

The previous Raven bug came from selecting every name starting with `Rotor_`: GLTFLoader creates material-split children with similar names, so both root groups and child pieces rotated. Select the **four exact assembly pivots** (or a validated metadata flag on those pivots only) and rotate each once. Stationary housings and child local transforms must stay unchanged.

Provide a rotor test: four pivots detected, all four change angle over time, two CW/two CCW, no nested double rotation, no orbiting off-center, no stationary blades hidden beneath moving duplicates, no changes to other instances' transforms. Check loaded GLTFLoader names, not just Blender object labels. Use independent transform clones while sharing immutable geometry/textures.

Animate smooth continuous rotation from elapsed time or delta time. Do not keyframe a low-frame-rate wobble. For stills, show clean individual blades; for a flying product render use physically plausible motion blur. A stylized opacity disk in the web viewer is optional only after the base rig works, and must not obscure all material detail.

## 7. Lighting and camera validation

Create an isolated product QA scene; do not overwrite unrelated Blender scenes. Save a new file. Use neutral studio lighting first, with large softboxes that create broad controlled gradients across the shell and tube reflections. A restrained cool fill/rim can separate black parts from a dark background, but neutral illumination must remain the basis for color evaluation.

Minimum views:

1. Deployed front three-quarter, matching supplied still 2 as closely as possible while showing the intentional four-rotor/no-mast changes.
2. Neutral top orthographic: confirms four X arms, deck structure and complete mast removal.
3. Side orthographic: confirms low shell profile, case clearance and coherent landing frame.
4. Front close-up: shell bevels, lens recesses and filled former mast location.
5. Arm/motor close-up: carbon scale, clamp construction, pod texture versus smooth motor cap.
6. Cargo close-up: grain, side/end material distinction, lid seam, latch and small Raven label.
7. White/light-gray background test: dark surfaces must remain dark because of materials, not only because the room is black.
8. Neutral-gray background test with roughness/normal diagnostic views; inspect all surfaces before stylistic grading.

Use a product lens around 65–100mm for the main QA view; adjust subject distance to fill roughly 75–85% of frame without perspective exaggeration. This is a QA camera, not permission to alter the website camera tracks. Keep adequate focus; shallow depth of field must not hide modeling defects. Validate in Cycles with enough samples and denoising to separate texture from sampling noise.

Match color management and exposure before tuning materials. AgX for Blender look development and the browser's tone mapping can differ. Check final appearance in the real site; a beautiful Blender-only render does not prove glTF parity. Do not fix a washed-out browser model by arbitrarily crushing all base colors.

## 8. Existing files, preservation and implementation boundaries

Existing Raven inputs:

- `glb/raven_drone.glb`: original six-rotor drone. Preserve untouched.
- `glb/raven-refined/raven-refined.blend`: previous dark material pass, useful geometry source, not the target color scheme.
- `glb/raven-refined/raven-textured.glb`: uncompressed textured source from that pass.
- `public/assets/models/raven_drone_refined.glb`: current compressed web asset. Do not overwrite it until a new variant is validated.
- `src/components/scene/Drone.tsx`: current visual adapter and model fitting.
- `src/components/scene/raven-rotors.ts`: current six-pivot helper, which will need a four-pivot contract if/when integrated.
- `scripts/check-raven-rotors.mjs`: existing test assumes six. Update explicitly for the new variant during integration, not by ignoring failures.

Inspect topology, material slots and connected components before deleting anything. The body can contain multiple logical parts in one mesh. Do not delete every face with a gray material to remove the mast. Do not keep an unwanted mast hidden rather than removed from the export.

Keep existing website files, six-rotor source, original source media and camera animation GLBs intact. Create a new Blender source such as `glb/raven-quad/raven-quad.blend` and new exported asset such as `glb/raven-quad/raven-quad-textured.glb`. A web-ready derivative can be `public/assets/models/raven_quad.glb` once approved by visual QA. Asset creation is not a request to deploy the website or submit a real contact form.

The four-rotor variant supersedes previous instructions calling for six spinning rotor assemblies. The requested light-gray/black reference palette supersedes the prior all-dark material pass. The request to remove the mast overrides its visible presence in the reference footage.

## 9. Production sequence and checkpoints

1. Inventory existing source and inspect every reference. Record observed features separately from provisional design choices.
2. Create a safe working copy in a new Blender scene/file. Establish units, front direction and root origin.
3. Block out a coherent four-arm silhouette, case and landing frame. Remove mast and rebuild top. Validate gray-clay front/top/side renders before texture work.
4. Refine silhouette, real bevels, shell facet transitions, blade airfoil and connection details. Do not hide a primitive-looking silhouette under textures.
5. Assign clean flat material colors and roughness first. Match shell/body/case hierarchy under neutral lighting.
6. Add correctly scaled carbon weave, pod/case grain, small labels, lens treatment and restrained warning accents. Validate close-ups at normal exposure.
7. UV and bake exportable PBR channels. Inspect closed-surface coverage, tangent normals and seams.
8. Add four exact propeller pivots and test counter-rotation without altering static motor parts.
9. Render the QA views and a short slow turntable, plus a short rotor-motion test. Compare with supplied neutral reference frames.
10. Export uncompressed textured GLB, inspect nodes/materials/images, load it in the target renderer, then compress a separate derivative. Verify again after compression. Apply Draco last; do not repeatedly decode/re-encode a compressed master.
11. If integrating, preserve camera tracks/progress/timing. Change only the visual asset reference, fitting transforms as needed, and rotor selection contract. Inspect hero, top-down specs and swarm, including mobile and reverse scroll.
12. Deliver source, textures, GLB, preview renders, validation results and an honest discrepancy list. Do not claim exact reference equivalence or real-world flight readiness.

## 10. Acceptance checklist

- [ ] Four motors and four single two-blade propellers; no coaxial lower set, middle arms or leftover six-arm hardware.
- [ ] Tall top/front mast, pedestal and collar are absent; rebuilt top surface has coherent topology and normals.
- [ ] Light gray satin shell remains distinguishable from dark charcoal battery deck and black structural parts.
- [ ] Carbon tubes show fine, directional low-contrast weave, not coarse checkerboard paint.
- [ ] Blades are thin, twisted/tapered, satin black, with consistent pale tip markings.
- [ ] Motor pod/cargo texture reads as manufactured grain, not rock, foam rubble, sand or static noise.
- [ ] Case is black/dark charcoal with construction detail; no brown cardboard/olive-case carryover.
- [ ] Genuine seams, hardware, clamps, vents and bevels support the material appearance.
- [ ] No baked blue beams, holographic terrain, exaggerated LEDs, DJI branding or fake certification labels.
- [ ] Four pivot rotations verified; two CW/two CCW; no child double rotation or shared-instance mutation.
- [ ] UV and texture coverage includes underside/sidewalls. Color/data-map color spaces are correct.
- [ ] Export contains intended geometry, embedded maps and stable pivots; no QA lights, cameras, reference planes, hidden mast or unnecessary objects.
- [ ] Original files remain intact; new `.blend` is editable and maps are packed or clearly organized.
- [ ] Blender and compressed browser render both checked. No missing materials, flipped normals, black glass artifacts, clipping or texture seams.
- [ ] Existing host camera, scroll and transition behavior preserved if integration is performed.

## 11. Skills to use selectively

Use `blender-mcp` for live inspection and safe scene operations; `blender-pro-workflow` for staged modeling/look development; `blender-materials` for Principled PBR setup; `blender-uv-texturing` for oriented UVs and baked maps; `blender-lighting`, `blender-cameras` and `blender-rendering` for repeatable reference comparisons; `blender-export` / `blender-web-pipeline` for final glTF validation and web delivery. Read the installed skill files and map recipes to the actual Blender version/backend.

A broad website design/taste skill is not the authority for this asset. The supplied reference images and the explicit four-rotor/no-mast changes are the authority. Do not introduce a new color direction, futuristic geometry, six rotors or a mast because a generic aesthetic recipe suggests them.

## Final instruction

Aim for the reference's manufactured material response and assembly precision, adapted to Raven's four-rotor medical cargo silhouette. If a result still looks like a toy, diagnose the cause in order: proportion/silhouette, edge geometry/normals, lighting/color management, material separation, texture scale, then fine wear. Adding more noise is not the solution.
