# Raven visual story plan (Phase 2)

This is a plan only. Nothing here is implemented. Phase 1 (`RAVEN_CONTENT_MAP.md`) changed the copy only. The scroll still follows the inherited
surveillance/emergency structure, so the full delivery journey is not yet shown on screen. Any change to tracks, spans, terrain, lighting or
timing below needs its own approved implementation task.

## Constraints that carry over

- One Lenis instance and one scene-progress source. Add no second smoothing layer and no ScrollTrigger.
- Camera and drone motion comes from the GLB clips (`Camera0x`, `Drone0x-0y`), seeked by progress. A new action needs one of two things:
  - a new or edited clip in those tracks, or
  - object animation driven from scene progress inside the existing span.
- The Raven asset rules apply:
  - Rebuild from `glb/raven-quad/build_raven_quad.py`.
  - Use lossless WebP plus Draco only.
  - Keep the rotor contract unchanged.
- Product truth is unchanged:
  - The aircraft is a four-arm coaxial quad.
  - No payload, range, speed, endurance, temperature or certification claims.

## Product decisions needed before visual work

- **D1 Handoff method:** land on a clinic pad, lower on a tether, or drop a case at a marked point. A winch must not be drawn unless it is designed and modelled.
- **D2 Case design:** how the case attaches and closes, and whether it is a removable cartridge. Temperature control stays an open requirement. Show no readout unless verified requirements exist.
- **D3 Turnaround:** battery exchange, recharge, or not shown. A swap can only appear if it is designed. Show no timing.
- **D4 Settings:** what the health centre and clinic look like. Snow and tundra variants depend on terrain work.
- **D5 Fire detour:** whether to delete it, shorten it to a single generic "route changes" beat, or keep a hazard beat without fire.

## Transitions

### 1. Hospital/clinic context → preparation and packing

- **Current:**
  - `INTRO_SCENE` and `DELTA_DRONE` show the aircraft orbiting over generic terrain. No buildings appear.
  - `MISSION_PRESET` shows three aircraft already in flight.
- **Beat:** 1 Need and 2 Preparation. *Who needs supplies, and where do they come from?*
- **Missing:**
  - Health-centre pad prop (building, pad marking, perhaps a care-team figure).
  - A clinic location shown at a distance.
  - Supply items and an open case.
- **Proposed:**
  - Add a ground "health centre" set piece as a terrain-tile object under the delta-drone orbit.
  - Animate the case lid by progress during `MISSION_PRESET`.
  - Replace the `MISSION_PRESET` three-drone formation with one aircraft on the pad. This requires a new `Drone02-0x` / `Camera03` clip.
- **Can the existing choreography support it?**
  - Partly. The health-centre prop and lid animation fit within the current spans.
  - The aircraft on the pad needs new camera and drone clips, because the current camera is airborne.
- **Acceptance evidence:**
  - Screenshots at 1440×900, 821×1109 and 390×844 during the Prepare window.
  - The pad and case are readable without the copy.
- **Open:** D2, D4.

### 2. Case close-up → verified attachment

- **Current:** `DELTA_DRONE` spec callouts. The "Medical cargo" anchor points at the existing case.
- **Beat:** 3 The load. *What does Raven carry?*
- **Missing:**
  - Latch and attachment detail on the GLB.
  - A closing animation.
  - A cargo cutaway, or packed items visible through an opening.
- **Proposed:**
  - Model latches and the attachment interface in `build_raven_quad.py` as separate named nodes, so they can be animated.
  - Drive a close/lock motion from delta progress (0.6 to 0.9) before the callouts appear.
  - Keep "temperature control" out of the visuals until requirements exist.
- **Can the existing choreography support it?** Yes. The camera already frames the underside near the end of the delta span.
- **Acceptance evidence:**
  - `check-raven-rotors.mjs` still passes.
  - Texture identity check passes (maximum pixel difference 0).
  - The latch close is visible at the specs gate.
- **Open:** D2.

### 3. Airframe explanation → launch and vertical ascent

- **Current:** after the specs, `SWARM_SCENE` cuts to three aircraft already cruising.
- **Beat:** 4 Departure. *How does it leave?*
- **Missing:**
  - A ground pad under the aircraft.
  - Rotor spin-up from rest.
  - A vertical climb.
- **Proposed:**
  - New `Camera02` / `Drone01` clip segment: low camera, aircraft on the pad, then a vertical rise.
  - Rotor speed is already code-driven, so ramp it from 0 using progress.
  - Remove the two escort aircraft from this beat, or bring them in later as the Support beat.
- **Can the existing choreography support it?** No. Needs new clips. The span can stay at 500vh.
- **Acceptance evidence:**
  - Forward and reverse scroll through the span shows a continuous ascent with no pop.
  - Rotors start at rest and spin up.
- **Open:** D1 (whether a pad or a landing zone is shown).

### 4. Launch → route over the ridge, compared with the road

- **Current:**
  - `FLOCK_SCENE` (fleet graph) and `REAL_TIME_DETECTION` (object boxes over terrain).
  - Neither draws a route.
- **Beat:** 5 Crossing. *Why air?*
- **Missing:**
  - A drawn road path following the valley.
  - A straight-ish air path over the ridge.
  - Start and destination markers.
- **Proposed:**
  - Replace the flock graph with a route overlay: two ground-projected polylines using the existing `GroundHtml`/terrain projection.
  - The road path is long and winding; the air path is direct.
  - Compare them by geometry only. Show no times or distances.
  - Reduce the detection boxes to a few road-related labels: road block, car.
- **Can the existing choreography support it?**
  - Partly. Overlays fit the current camera.
  - The fleet visual itself is driven by `Flock.tsx` and can be swapped for a single drone without clip changes.
- **Acceptance evidence:**
  - The route comparison reads at 390×844.
  - No numerical claims.
- **Open:** D4.

### 5. Ridge crossing → clinic arrival and handoff

- **Current:**
  - `THERMAL_IRREGULARITY` and `IGNITION_VERIFIED`: thermal search and a fire over the village tile.
  - This is the fire-response detour.
- **Beat:** 6 Handoff. *What happens at the clinic?*
- **Missing:**
  - A clinic building or yard.
  - The chosen handoff (per D1).
  - A health-worker figure receiving the case.
- **Proposed:**
  - **The main replacement candidate.**
  - Reuse the village tile as the clinic destination.
  - Retire the thermal HUD, the thermal post-effect box and the fire shader in these spans.
  - Animate descent and the D1 handoff with a new `Camera05`/`Camera06` segment and a progress-driven case release.
  - Pill "Hazard noted" becomes a handoff marker only once a handoff is actually modelled.
- **Can the existing choreography support it?**
  - The camera over the village tile already frames a destination.
  - Descent and handoff need new drone clips.
  - Removing the fire is code-only (`Fire.tsx`, `ThermalHud.tsx`, `PostFX` thermal uniforms).
- **Acceptance evidence:**
  - No fire or thermal palette remains in these spans.
  - The handoff is legible.
  - The copy changes from "hazard" to "arrival".
- **Open:** D1, D5.

### 6. Handoff → return and ground preparation

- **Current:** `PHALANX_AI` and `ANALYSIS_EVALUATION`, an ops-grid view with two inbound drones.
- **Beat:** 7 Return. *Can the service repeat?*
- **Missing:**
  - The return flight.
  - The aircraft back on the pad.
  - The next case being prepared.
  - A battery exchange, only if D3 adopts one.
- **Proposed:**
  - Keep the grid view as a schematic "turnaround" board: health centre, clinic, one return path.
  - Show a battery exchange only as a designed object animation, if D3 adopts it.
  - Show no timing.
- **Can the existing choreography support it?**
  - The grid camera supports schematic overlays.
  - A ground turnaround needs a new set piece and clip.
- **Acceptance evidence:**
  - The return reads at 390×844.
  - No speed or timing labels.
- **Open:** D3.

### 7. One route → illustrative multi-clinic network

- **Current:**
  - `INTEGRATED_NOTIFICATIONS` through `MULTI_THREAT_RESPONSE`: several perimeter zones, moving arrows (formerly responders), and the power-station fire in `EXTRA_SUPPORT`.
  - The globe below the fold.
- **Beat:** 8 Network. *What changes at a wider scale?*
- **Missing:**
  - A hub marker.
  - Clinic markers.
  - Illustrative route lines from the hub to each clinic.
- **Proposed:**
  - Turn the perimeters into a hub plus several clinic zones.
  - Draw the arrows as hub-to-clinic route lines.
  - Remove the power-station fire.
  - Merge `EXTRA_SUPPORT` and `ZONE_STABILIZED` into the network build-up instead of a second hazard.
  - Show no coverage radius or service-area fill.
- **Can the existing choreography support it?**
  - Mostly yes. The labels and overlays are progress-driven already.
  - Removing the power-station fire is code-only.
- **Acceptance evidence:**
  - The network reads as one hub serving several clinics.
  - No "secured" or "contained" wording, and no red hazard state.
- **Open:** D5.

### 8. Guided story → optional inspection → honest invitation

- **Current:**
  - After the scroll story: use-case cards, globe, demo render, about text, footer sequence and contact.
- **Beat:** 9 Invitation. *What can I do next?*
- **Missing:**
  - An optional model inspection: orbit and zoom of `raven_quad.glb` with the four callouts.
- **Proposed:**
  - Replace the static demo render with a lazy-loaded inspection canvas that reuses `RavenModel`. Keep the static image as fallback.
  - Keep the "Discuss a use case" contact flow.
- **Can the existing choreography support it?** Yes, as a separate section. It does not touch the scroll story.
- **Acceptance evidence:**
  - The inspection canvas only loads near the viewport.
  - No layout shift.
  - Keyboard-operable controls.
  - `prefers-reduced-motion` respected.
- **Open:** none.

## Pacing

Do not stretch the delivery to fill all twelve 500vh spans with near-identical chapters. The target journey is nine beats. When the visual phase
replaces the fire detour, plan a span reduction (for example, merging thermal, ignition, phalanx and analysis into handoff plus return). Treat that as a
deliberate change to `SCENE_SPAN`, the spacer height, the nav targets and the `AGENTS.md` scroll model, verified forward and reverse.
