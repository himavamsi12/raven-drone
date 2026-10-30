# Raven — existing flying hero, richer terrain, story on scroll
## Seedance environment prompt and website experience brief

**Latest direction: preserve the current website opening.** Raven is already airborne in the hero. The terrain travels beneath it. Add the reference-inspired mountain valley, houses, terraced slopes and settlement details to that moving environment. The delivery narrative develops **after the visitor starts scrolling**. Do not replace the opening with a static clinic shot, ground preparation, takeoff sequence, overhead map or the newly authored Blender camera edit.

This revision supersedes the earlier ten-shot, approximately eighty-second clinic-first film proposal. The Blender valley is a location/material study, not a replacement for the current website experience. This document changes the brief only; it does not implement anything on the site.

## 1. Experience contract — what stays and what changes

### Preserve the opening

- Keep the existing Raven GLB, aircraft screen presence, camera relationship, hover and flying impression.
- Keep the ground visibly travelling underneath Raven while the hero is idle. A visitor who has not scrolled should still perceive flight.
- Keep the existing hero composition, interface hierarchy and transition into the first scroll chapter. Derive the terrain's apparent direction and rate from the actual site; do not invent a new orbit, banking move, lens or aerial filming style.
- Keep existing camera tracks, chapter spans and transition timing as the integration baseline. Story suggestions below are content/environment intentions, not authorization to replace tracks or retime the page.
- Keep the drone separate. Seedance generates only the environment, never the aircraft, payload, rotor effects, aircraft shadow, HUD or copy.

### Enrich the world under the existing flight

Replace the anonymous-terrain appearance with an inhabited alpine valley: rolling shoulders, shallow gullies, forested sides, restrained meadow texture, narrow winding roads, small timber/stone houses, terraces and distant high snow. Houses sit within the geography; they do not fill the screen like oversized props. Keep the projected drone area and headline area visually calm.

The landscape can already contain houses in the initial hero. Scrolling reveals what those houses and communities mean to the delivery story; it does not summon a village from nowhere or switch to an unrelated environment.

### Start the explanation on scroll

The progression is: **already flying → notice the community below → understand the care connection → see why the road is difficult → recognize the receiving clinic → understand a wider network.** Product/preparation information can be introduced through existing copy/callout windows while flight continues. Do not rewind the aircraft to a base merely to follow a conventional takeoff-to-landing film structure.

This takes the Doko references' explanatory clarity and care-centred logic, while preserving Raven's existing opening and motion language. Do not copy their numerical performance claims, basket naming story or studio-sales ending.

### Current implementation evidence

Read-only source inspection confirms that the hero is not purely a scroll-scrubbed movie:

- `src/components/scene/Terrain.tsx`: terrain travel normally accumulates using frame delta time; `Tile` moves along local/world scene −Z using `terrainWrapped`. The initial ground travel continues without scrolling. Local −Z is **not** an instruction to move pixels downward: screen-space motion depends on the camera.
- The same file derives terrain speed from scene progress and supports a hero boost. Do not copy a numeric scene-unit rate into a video prompt as a real flight speed.
- `src/components/scene/DroneRig.tsx`: existing GLB camera clips coexist with time-driven hover, micro-motion and hero steering/boost behaviour.
- Consequently, a single video whose currentTime is driven only by scroll would freeze the opening landscape. A flat video also cannot reproduce arbitrary steering parallax.

The brief must preserve the distinction between **time-driven idle flight** and **scroll-driven narrative progression**. Exact implementation and camera matching require a prototype, not an assumption that video is interchangeable with live terrain.

### Geography assumption

The supplied pictures show forested alpine/Himalayan-like villages, not treeless tundra. Continue their visual language: green lower slopes and village land, cold high mountains, snow on distant summits. “Tundra terrain” is treated as the user's shorthand for this cold mountain setting; do not silently turn it into Arctic snowfields or a wetland.

## 2. Reference roles — all eight images

Preserved locally in `research/raven-film/references/` with stable names. These are reference assets only; do not publish the originals or reproduce their watermarks in generated output.

| ID / filename | Take from it | Do not take from it |
|---|---|---|
| **R01 — `R01-village-terraces.png`** | Terraced land stepping down a slope; timber/stone houses; slate roof texture; distributed settlement; distant jagged snowy skyline; foreground/middle/background hierarchy. | Exact building arrangement or ornamental landmark as the medical clinic; postcard oversaturation; an invented identification of the location. |
| **R02 — `R02-meadow-valley.png`** | Open meadow, forested valley walls, village beyond an open foreground, natural sun/shade patches, a generous valley opening. | Livestock crossing a future flight/landing area; dense foreground activity; changing to a different season. |
| **R03 — `R03-valley-settlements.png`** | Large-scale valley depth; a legible inhabited destination; road/river geography; clustered roofs; haze separating overlapping slopes. | Dense town infrastructure suddenly appearing beside a tiny isolated clinic; balcony railing blocking the composite area. |
| **R04 — `R04-stone-houses.png`** | Dry-stone construction, plaster patches, simple pitched roofs, irregular village paths, small gardens and close-range hillside scale. | Poverty stereotypes, ruined roofs or a distressed settlement; blown-out cyan highlights. |
| **R05 — `R05-high-slope-village.png`** | Compact settlement on a steep green shoulder; exposed rock; narrow paths; low vegetation and small wildflowers around rocks. | Copying the source watermark, high-chroma pink buildings as the main motif, or removing forest from every other view. |
| **R06 — `R06-forest-materials.png`** | Fine bark, varied needle clusters, grasses at multiple scales, soft sky illumination, restrained natural surface variation, believable contact and depth. | Flooded forest, swamp water, algae carpets, tropical wetland composition, logos or captions. |
| **R07 — `R07-rock-forest-depth.png`** | Rock massing through atmosphere, layered forest density, branch complexity, ground-cover variation, muted distant color. | The waterside hut/jetty, bare wetland trees as the village identity, source-brand graphics. |
| **R08 — `R08-light-foliage-water.png`** | Controlled warm sunlight/cool sky balance, foliage translucency, irregular tree spacing, soft atmospheric layering and physically coherent reflections where actual water is present. | A lake becoming the hero environment, giant blurred leaves obscuring the GLB, puddles everywhere or a warmer time of day than the rest of the film. |

### Initial reference-upload map

When uploading the original eight together, assign in the same order:

- `@Image1` = R01; `@Image2` = R02; `@Image3` = R03; `@Image4` = R04.
- `@Image5` = R05; `@Image6` = R06; `@Image7` = R07; `@Image8` = R08.

Use the platform's actual reference chips; tag spelling may differ by interface. Never assume an image keeps its index after reordering the upload list.

The first five govern **place and composition**. The last three govern **material/render response only**. Do not average all eight into a single nonspecific forest scene.

## 3. Continuity bible — lock before generating motion

### One fictional geography

- **Base A:** modest regional health centre on a lower western valley shelf, not a huge urban hospital. Pale mineral plaster, dark stone plinth, charcoal standing-seam pitched roof, muted blue-green door, a small roofed entrance and a rectangular open service apron.
- **Clinic B:** smaller one-storey clinic on the higher eastern village shoulder. Pale warm-gray plaster with visible local stone at its base, charcoal pitched roof, one muted blue-green door, two rectangular windows, a low stone boundary wall and a flat rectangular courtyard.
- **Village:** roughly a dozen scattered timber/stone dwellings around terraces. Slate gray roofs dominate; a few subdued blue-green metal roofs may recur. Do not randomize house count and roof colors between angles.
- **Landmarks:** a two-notch snowy ridge in the far distance, a triangular darker rock shoulder below it, one tall asymmetric conifer beside Clinic B, a pale road making two visible bends, and a narrow stream at the valley floor where geography permits.
- **Route:** Base A west/lower valley → a saddle in the forested shoulder → Clinic B east/higher slope. The road follows contours around the shoulder while the implied air route crosses the open saddle. No glowing routes are generated in the footage.
- The final network view includes Base A, Clinic B and a few other small settlement clusters in the **same** valley. It does not turn into an unrelated mountain range or an entire country.

These are fictional art-direction choices, not real surveyed positions. Write an overhead sketch/landmark sheet before producing independent angles. If separate clips cannot preserve this layout, use fewer distinct views instead of pretending they match.

### Time, season and weather

One settled late-morning period. Sun at moderate elevation, fixed world direction; broad soft highlights with readable shadows. Thin scattered clouds, good visibility with gentle valley haze. Grass moves lightly, conifer tips respond to a steady breeze, clouds drift slowly. No rapidly moving cloud shadows, time-lapse lighting, sudden storm, snowfall, sunset or blue-hour jump.

Use distant summit snow only. Roads and clinic courtyard remain dry. Dense forest belongs on lower/middle slopes; sparse vegetation and rock may appear near the saddle. Do not place a saturated lowland swamp at high altitude.

### Color palette — appearance guidance, not pixel-matching targets

- Conifer mass: deep neutral green with cool shadow separation, not black cutouts.
- Meadows: muted olive, moss and spring-green variation; avoid fluorescent grass.
- Weathered stone: warm gray, charcoal and desaturated brown, with distinct dry/light faces.
- Timber: aged dark brown with subtle gray weathering, not orange varnished logs.
- Roofs: charcoal slate; occasional subdued blue-green sheet metal.
- Plaster: soft warm mineral gray, never pure white clipped flat.
- Sky: restrained pale/cool blue, thin white clouds; distant ridges lose contrast through haze.
- Human-scale accents: blue-green doors and tiny muted roof details. No saturated red cross, billboard or generated clinic text.

The later light-gray Raven GLB must separate clearly from dark forest/rock without looking pasted into a different exposure. Reserve medium-to-dark terrain behind its intended position; avoid a bright snow patch directly behind a pale aircraft at the main hero moment.

## 4. Environment materials and realism

**Rock:** large geological planes first, fractured middle-scale form second, fine surface variation last. Strata follow rock mass; cracks do not swim between frames. No uniformly noisy displacement or melted cliffs.

**Soil/paths:** compacted pale dirt or muted local stone, small irregular aggregate near camera, slight drainage/wear. Paths connect to actual doors; terraces follow contours. No repeated texture stamps, floating grass, or perfectly clean road ribbons over impossible slopes.

**Grass/meadow:** multiple heights, density pockets, exposed soil and rocks, restrained dead-grass variation. Keep the compositing apron clear. Grass changes with slope and shade instead of one carpet on every surface.

**Conifers:** varied species-like shapes within one coherent forest; trunks taper, branches have irregular gaps, needles form fine clusters. Bark is rough and dry with controlled warm highlights. No identical tree rows, wind-induced branch melting, billboard foliage or one oversized tree repeated across the valley.

**Buildings:** roof tiles/sheets at believable scale, local stone courses, recessed openings, roof thickness and modest weathering. Houses sit on foundations following the terrain rather than hovering. The clinic should be recognizable by repeated architecture, not generated lettering.

**Metal roofing:** weathered low-gloss reflection, subtle seams and dents. Not chrome, plastic, black mirror or a wet reflective surface unless the approved anchor already has it.

**Water, if visible:** a narrow stream consistent with the valley's slope, with restrained surface reflection and stable banks. No swamp import from R06–R08. Water is optional geography, not a required foreground feature.

**Atmosphere:** progressively lower contrast with distance, fine soft haze, clear foreground edges. Avoid volumetric god rays in every shot, opaque fog curtains, overly strong depth of field and film grain baked into the plate. Generate clean plates and grade/grain the GLB and environment together later.

## 5. Seedance production approach — preserve motion before adding story

### Obtain the motion reference first

For generation that closely follows the current opening, record a short clean viewport capture of the **actual current Raven hero**, including a few moments before scrolling and the initial scroll transition. Record the viewport dimensions. Use that capture as `@Video1` for camera relationship, terrain-flow direction, apparent ground travel and the handoff into scrolling only. It is **not** a reference for generating a drone, copying UI text, adding an aircraft shadow or recreating the old terrain's appearance.

No such motion capture is attached to this brief. Do not pretend `@Video1` already exists, upload one of the DJI product videos in its place, or substitute the six-camera Blender edit. If proceeding without the capture, use the no-video prompt variant below and label the resulting motion as an approximation.

For composition, prepare an environment-only first-frame anchor aligned to the current hero view. Retain the actual horizon, camera elevation/pitch, scale cues and open drone area. Removing the aircraft from an anchor must preserve the underlying perspective rather than reframing the whole scene.

### Reference map for final clip generation

This map is separate from the original eight-image upload map in section 2:

- `@Image1`: approved environment-only first frame for this exact website view, aligned to the existing hero or chapter camera. No drone or UI in the image.
- `@Image2`: approved canonical valley/settlement image, using R01–R05 geography and architecture.
- `@Image3`: one selected R06–R08 surface-quality reference, used only for material, foliage and light quality; exclude wetland geography and graphics.
- `@Video1`: a short actual website motion capture, **only if supplied**, used for camera and ground-flow behaviour.

Use the interface's actual reference chips and verify their indexing. Do not upload all eight original references under this three-image map. Use the original eight together only for look development, then use the reduced map for individual clip generation.

### Settings outside the prompt blocks

Generate one restrained motion beat per clip. Where the interface supports it, source clips around six to eight seconds give editing handles; retain roughly three to five useful seconds per story transition. Aim initially for **twenty to twenty-five seconds of unique selected background motion across the hero and story**, not eighty seconds of continuously changing landscape. The hero can remain visible indefinitely; its idle behaviour is not limited by the film's runtime.

Use a consistent landscape master and frame-rate conform; choose supported resolution/output controls in the actual interface. These are production planning targets, not claims about available model options. Keep sound muted on the website. Generate only quiet wind/natural ambience if audio cannot be omitted. No music, voiceover, aircraft sound or story text.

Do not request the complete multi-chapter sequence in a single generation. Approve the hero terrain-flow test first. If it fails, more clips will multiply the alignment problem.

## 6. Revised story flow — the hero comes first

These are narrative states, not replacement scene IDs or new fixed scroll ranges. Map them to the existing chapter gates only after visual prototyping. Do not alter the production spacer, snapping, tracks or scene spans to match the table automatically.

| State | What the visitor sees | Environment motion | Meaning / separate UI |
|---|---|---|---|
| **H00 — initial hero, no scroll** | The existing Raven already flying. Reference-inspired valleys, a few houses and terraced land pass below. | Continuous ground travel matching the current hero; calm camera relationship. No static opening. | Keep the current hero introduction. The environment establishes an inhabited mountain setting without explaining every detail yet. |
| **S01 — first scroll: a community below** | The same terrain continues. A recognizable house cluster and contour road become easier to read within the inherited camera transition. | Continue the incoming ground flow; no reset, hard cut, new camera orbit or top-down map at this boundary. | Introduce the people/clinic connection. The place visible in the hero becomes meaningful. |
| **S02 — the care connection** | A modest health-centre cluster or its access road is readable along the same valley geography. | Keep flight continuity. Allow a quiet landscape region behind the existing product/cargo callouts. | Explain where supplies originate and what the service connects. Do not physically rewind Raven onto a pad or add a new takeoff. |
| **S03 — the route across the shoulder** | The winding ground road and forested ridge show the geographical difficulty. | Forward travel over the same terrain; foreground parallax stronger than distant ridge motion. | Explain the connection visually; no unverified distance, speed, range or journey-time comparison. |
| **S04 — receiving village / clinic** | The previously established settlement grows readable; the same clinic architecture recurs. | Approach only as far as the inherited camera supports. No forced descent, roof fly-through or courtyard cut. | Introduce arrival context. This environment brief does not invent a physical handoff, winch or delivery confirmation. |
| **S05 — wider connection** | Valley settlements read as parts of one coherent place. | Use an existing supported wider view or a clean stable hold. Do not add an automatic giant pullback or map morph. | Explain a health centre connecting communities. Any illustrative routes remain a separate website layer. |

**Most important transition: H00 → S01.** The visitor should feel that the same flight continues and the story begins around it. They should not feel that scrolling closes a hero movie and opens a different commercial.

Preparation/departure/landing inserts from the older brief are optional future material only. They are not required for this pass and must not override the currently flying opening.

## 7. Paste-ready environment prompts

Each prompt is a separate clip, not an instruction to cut among shots inside one generation. Reference controls and generation settings stay outside the prompt text. Use the reference-video versions only when the current-site capture is actually uploaded.

### H00 — priority test: moving terrain beneath the existing flying hero

> Create an environment-only replacement background for an already-airborne website hero. Use @Image1 as the opening composition and perspective anchor, @Image2 for the coherent inhabited alpine valley, and @Image3 only for realistic bark, fine conifer foliage, rock, grass and restrained daylight materials. Use @Video1 only to follow the existing camera-to-ground relationship, apparent terrain-travel direction, ground-flow rhythm and framing; exclude its drone, interface and original terrain styling from the output. Maintain the same apparent camera height, pitch, perspective and steady flight direction throughout. The ground continuously travels through the lower frame beneath the reserved empty aircraft area, with nearby meadows, stone details and a few small slate-roofed timber-and-stone houses moving faster in perspective than distant slopes and snowy summits. A narrow contour road and terraces make the valley inhabited without crowding the composition. Houses remain firmly attached to the terrain and keep their geometry as they pass. Fixed late-morning sunlight, muted natural greens, cool distant mountains, dry ground and distant summit snow. Keep the central flight corridor and existing headline region visually quiet. One continuous steady motion, no camera orbit, zoom, banking, takeoff, descent, cut or change of location. Environment only: no drone, aircraft, propellers, cargo, moving aircraft shadow, rotor wash, dust plume, text, HUD, routes, pins, logos, people or traffic. Restrained natural wind ambience only, no engine sound, music or speech.

### H00 alternative — when no current-site video capture is uploaded

> Animate @Image1 as a clean environment-only alpine flying-background plate. Preserve its perspective, horizon, camera pitch and reserved empty aircraft area. Use @Image2 for stable valley geography and village architecture, and @Image3 only for realistic forest, rock, grass and light quality, excluding its wetland setting. Maintain a steady forward-flight impression through continuous terrain translation beneath the view: nearer meadow, road edges, stones and scattered small slate-roofed houses pass faster than the forested shoulders, while distant snow-capped peaks remain almost stable. Keep the viewing direction and lens fixed with no orbit, zoom, banking or altitude change. Stable late-morning sun, restrained green lower slopes, dry village ground, snow only on distant summits, physically convincing surfaces. Keep the centre and headline region calm for later compositing. No aircraft, drone, payload, flying object, aircraft shadow, rotor effects, text, UI, people, traffic or source graphics. One continuous shot without cuts. Quiet natural ambience only, no music, speech or mechanical sound.

This second version describes the intent but does not prove a match to the live hero. Do not call it exact.

### S01 — first-scroll continuation: the village becomes part of the story

> Continue the same alpine flight from @Image1, which is the approved environment-only boundary frame of the hero. Preserve @Image2's established valley, house cluster, contour road, forested shoulder and distant skyline. Use @Image3 only for material realism. Follow @Video1's initial scroll-transition camera behaviour and the incoming terrain-flow direction, without reproducing its aircraft or interface. The same ground continues passing beneath the reserved clear aircraft area; a modest house cluster on a terraced slope becomes legible toward the side of the view, connected by a real winding road. Reveal it through continuous perspective and terrain travel, not through spawning buildings, a sudden lens change or a jump to a different valley. Keep scale, sun direction, road continuity and architectural proportions stable. No autonomous orbit, hard cut, crane rise, clinic close-up or map transformation. Environment only, no drone, aircraft, package, moving object shadow, UI, labels, people, traffic or effects. Quiet mountain ambience only, no speech or music.

### S02 — care connection within the existing flight

> Use @Image1 as this chapter's approved environment-only view, @Image2 for the same valley and its modest regional health-centre architecture, and @Image3 only for realistic stone, plaster, roof, foliage and soil response. Continue the established incoming travel and perspective without restarting the flight. Let a small care-building cluster and its access road remain readable within the landscape, at a plausible scale beside timber-and-stone dwellings. Keep the area reserved for the separate aircraft and product copy calm, with medium-to-dark terrain behind the light-gray aircraft's intended screen position. Preserve fixed daylight, distant snowy skyline and all existing terrain landmarks. No cut to a grounded aircraft, packing table, apron close-up, takeoff, camera orbit or invented medical equipment. Environment only, without aircraft, payload, staff, patients, signs, lettering, HUD graphics, temperature displays or route effects. Restrained wind ambience only.

### S03 — road around the shoulder, flight continuing across the valley

> Animate the approved view in @Image1 as a continuous environment-only alpine transit plate. Preserve @Image2's road, village clusters, forested shoulder and distant ridge. Use @Image3 only for detailed natural surface quality. Continue the existing incoming camera heading and ground-flow behaviour: a winding road follows the contours around the shoulder while open terrain and a saddle remain visible through the valley. Nearby ground has clear natural parallax; distant peaks move gently and retain their shape. Keep a clear region for later aircraft compositing, with no tree crossing that region unexpectedly. Realistic restrained greens, rough dry stone, irregular conifers and stable late-morning illumination. No new camera dive, summit orbit, fast racing move, hard cut or changed lens. No aircraft, drone, package, aircraft shadow, glowing routes, map graphics, measurements, people, vehicles, text or source logos. Quiet natural ambience only.

### S04 — the familiar receiving settlement becomes readable

> Use @Image1 as the approved chapter perspective and @Image2 to preserve the already-established receiving village, small pale clinic, charcoal roof, blue-green door, stone base and landmark conifer. Use @Image3 only for physical material and foliage quality. Continue the incoming landscape travel in the same valley. The receiving settlement becomes more readable as terrain passes beneath the reserved aircraft region; the clinic remains part of the hillside geography rather than becoming a separate architectural showcase. Keep dry paths, believable foundations, terraces and stable surrounding houses. Maintain the incoming camera elevation and heading; do not force a landing view, sudden close-up, courtyard cut, roof fly-through or reversal of travel. Environment only, without aircraft, cargo, delivery worker, winch, moving aircraft shadow, rotor wash, text, UI or delivery confirmation. Consistent natural daylight and restrained mountain ambience.

### S05 — wider connection without replacing the site's motion language

> Preserve @Image1's approved wider chapter composition and @Image2's same alpine valley geography. Use @Image3 only for realistic forest depth, geology, foliage and atmospheric layering. Show the relationship among the modest health centre, the receiving hillside village and a few smaller settlement clusters connected by winding ground roads. Maintain the inherited view and incoming travel where present; if the approved anchor is a held view, keep that view stable instead of inventing a dramatic pullback. Reuse the same architecture, skyline, daylight and scale cues. Leave calm composition for separate semantic website labels. No morph into a map, globe or different mountain range, no orbit, cut or giant zoom-out. Environment only: no aircraft, payload, glowing routes, pins, identity graphics, lettering, interface, people or traffic. Quiet natural ambience only, without music or narration.

For S01–S05 without a motion reference, remove sentences that mention `@Video1` and rely on the approved matched anchor plus inherited direction. Never leave unresolved reference tags in the actual submitted prompt.

## 8. Idle flight and scroll handoff — implementation requirements, not generated effects

### Preferred preservation path

Keep the existing real-time hero terrain movement and camera/GLB behaviour. Use generated media to establish the new environment look, or use a camera-matched background only after testing. This retains idle flight and steering without pretending a flat image sequence is a full terrain simulation. The authoring method may change later; the current flying interaction must not.

If a video background is used for the hero instead, it needs an independent idle playback state. A timeline controlled solely by scroll is unsuitable because it freezes when scroll stops. Validate a seamless loop before adopting it. A prompt saying “loop” does not ensure a perfect loop of forward-travelling unique houses.

### Loop construction

- Prefer periodic terrain or less identifiable landscape at the loop join. Never reverse the video into a boomerang: the ground would visibly travel backward.
- Avoid placing the main village, clinic or a unique landmark directly at the seam.
- Match ground displacement, flow speed, horizon, lighting and visible house positions at the join. An arbitrary crossfade can double buildings and break scale.
- Repeated houses must not reveal an obvious short conveyor belt. If the loop cannot be made convincing, retain live terrain rather than shipping a visible reset.
- The idle loop must not download/decode the entire later story.

### Handoff when scrolling begins

The hero can run for any length of time before the visitor scrolls. Therefore, the current idle playback frame will not necessarily equal the story's first frame. This must be designed, not ignored.

Preferred order: preserve live terrain and let existing progress gates introduce the story. If using generated plates, first prototype a phase-compatible continuation or an appropriately masked/matched handoff using a shared camera and boundary state. Avoid snapping idle playback to the story's initial frame. Do not solve the problem by changing the hero to a static clinic view.

Steering/boost complicates video alignment further. Preserve the existing live system unless a replacement demonstrates equivalent behaviour. No keyboard feature should be silently removed just to make a background clip easier.

### During and after the first scroll

Use existing scene progress to reveal copy and choose story frames. Reuse calm frames while explanatory text changes; twenty-five seconds of source movement does not mean a twenty-five-second mandatory experience. Preserve existing transition gates and mobile behaviour as the baseline.

Do not cut from the moving hero to a static clinic immediately on the first scroll. Do not add a cinematic multi-camera edit simply because a generated clip or Blender camera exists. Later chapter camera changes must follow the current site's supported choreography.

## 9. Camera matching, GLB compositing and performance

Generated video does not supply guaranteed camera matrices, depth, ground geometry or physically matching parallax. A reference prompt can approximate the current site's movement; it cannot certify exact camera equivalence.

For the hero prototype, check the current and replacement views side by side at the same viewport and scroll position: aircraft screen bounds, apparent ground altitude, travel direction, flow speed, horizon, lens perspective, sunlight and the empty compositing corridor. Include both idle and initial scroll states. Also check the portrait/mobile view.

Keep the original camera tracks authoritative. If a generated plate cannot align, reject/rework it or render matching terrain with those exact tracks. Do not silently modify the drone camera to rescue arbitrary footage.

A flat background cannot receive the GLB's shadow or occlude it behind a roof/tree without proxy geometry and masks/depth. No aircraft-shaped moving shadow belongs in the generated clean plate. Keep the drone in unobstructed air unless the compositor supports occlusion.

Performance starting point: one short independently loaded hero asset; short story chunks; approximately twenty to twenty-five seconds of unique selected motion; chapter-based loading and bounded decoded-frame caches; responsive environment resolution and static/reduced-motion fallbacks. These are targets to test with the live Raven GLB, not guaranteed budgets. Do not preload a full eighty-second image sequence or keep every frame decoded.

## 10. Review and rejection checklist

Approve **H00 plus H00 → S01 first**, before producing the remaining clips.

- At scroll zero, Raven is already flying and terrain visibly travels underneath it.
- The new world contains believable houses, roads and valleys from the opening without becoming a dense city or a clinic close-up.
- First scroll continues the same flight while the explanation begins.
- No new shot replaces the existing hero camera relationship, apparent altitude or composition.
- No sudden terrain pause, reset, reversed ground flow, doubled house, seam or exposure jump at the idle-to-scroll boundary.
- No generated drone, payload, aircraft shadow, rotor effect, UI, logo, sign, source watermark or unverified performance claim.
- No drifting house, changing doorway, breathing mountain, warped road, unstable foliage or unexplained season change.
- R01–R05 govern place. R06–R08 govern material quality. No swamp, jetty, flooded forest or treeless Arctic biome is imported.
- Look at paused frames and reverse scrubbing, not only normal-speed playback.
- Test the actual live GLB over the plate. An attractive empty landscape alone does not prove a working hero.
- The production site remains unchanged until that integration is separately implemented and verified.

## 11. Handoff checklist

Deliver the current-site motion capture when available; an aligned environment-only hero anchor; an accepted H00 test; an accepted initial-scroll continuation; only then the remaining chapter clips. Record lens/perspective estimates, horizon, source/output dimensions, sun direction, clear aircraft region, boundary frames, loop method and whether each camera is solved or approximated.

Retain the eight references and their roles. Preserve clean masters, start/mid/end drift-review frames and clip-specific manifests. Do not treat the Blender six-shot study as the new required website camera sequence.

## 12. Status (2026-10-30)

Prototype only, opt-in at `?plate=h00`; production unchanged. Implementation and known gaps: `RECONSTRUCTION.md` ("Environment plate prototype"). Local manifest: `research/raven-film/README.md`.

| Shot | State | Camera | Boundary / loop |
|---|---|---|---|
| H00 | Accepted (v2) | Fixed ~33° oblique, retreating; drift −146° at 3.8 %W/s (live −136°). Approximated, not solved. | 1.5 s crossfade loop; two-phase flow map hides the loop. |
| S01 Airframe | Accepted (v2) | Tilts 33° → 90° in step with the measured live pitch; scrubbed by scroll. | Starts on the H00 view; ends top-down with the health centre upper-left. |
| S02 Connection | Accepted (v2) | Locked top-down, ground straight up. Generated rotated 180°. | Opening aligned to S01's last frame; loops 5.5–12.04 s so the building never repeats. |
| Prepare onward | Not started | Live terrain | Plate fades out at the end of SWARM_SCENE. |

Lessons for the next prompts:
- The live camera sits ahead of the drone and moves backward. Write "the ground recedes toward the TOP of the frame"; Seedance reads "flying forward" as content moving down.
- Start and end frames are followed closely; direction words are not. Shift the start/end crops along the measured flow, or generate rotated and turn the result back.
- Sun for every plate: high late-morning, beyond the frame, about 48° up and 22° left of the view heading; no cloud shadows.

## Final instruction

**Keep Raven's current flying hero. Change the environment under it. Let scrolling reveal the story inside that same world.** No drone is generated into the video. No static clinic-first opening. No wholesale replacement of the site's camera choreography.
