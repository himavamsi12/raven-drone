# Raven story and content rewrite — implementation prompt

## Your task

Rewrite this existing Raven website around one clear medical delivery story. Start with **content and messaging**, preserving the current visual design, camera paths, scene timing and transitions. Then document the visual/story transitions needed for a later phase. Do not rebuild the site or start Blender/render work in this first pass.

The goal is the same explanatory clarity and human delivery narrative found in:

- https://doko-eight.vercel.app/
- https://doko-redesign.vercel.app/

Use their story logic, concrete language and progressive explanation. Adapt everything to Raven's actual concept and current implementation. Do not copy their product specifications, model architecture, cultural brand explanation, studio positioning or technology claims.

Read `AGENTS.md`, `CLAUDE.md`, `RECONSTRUCTION.md`, `glb/raven-quad/README.md`, and `research/doko-story/STORY_NOTES.md` first. If the research directory is unavailable in a checkout, this prompt contains the necessary narrative summary below. Treat newer project instructions as authoritative over historical reconstruction notes.

## 1. Why Raven currently feels different

The current experience begins with a medical-delivery promise but repeatedly returns to the original surveillance/emergency-response structure. In the current source, chapter copy still includes “battlespace,” classification of thousands of objects, thermal anomalies and an extended fire-response detour. The HUD includes hardware claims, numerical telemetry and threat language. Navigation includes Specs, Swarm, Sync, Detection, Sys Analysis, Int Alerts and Response.

That creates the wrong protagonist and goal: the aircraft/system demonstrating capabilities, rather than a clinic waiting for a medicine delivery. Replacing only the hero will not solve this. Main headings, supporting copy, callouts, chapter labels, status messages, scene annotations, below-fold sections and CTAs must all describe the same journey.

The second problem is narrative hierarchy. Generic autonomy/scalability/coverage language arrives before the reader understands a concrete delivery. Make the practical story understandable first; use the wider network as the payoff.

## 2. What to learn from the Doko references

Both start with a recognizable problem: a hill clinic needs supplies, and the road journey is difficult. They then explain the product through actions in chronological order: prepare, protect the cargo, take off, cross the ridge, hand over, return/reload, serve more clinics.

Doko Eight adds a rugged transport case and four-arm unfolding/locking sequence before flight. Doko Redesign begins with the aircraft already waiting at the hospital pad, explains its six-rotor airframe, follows a pre-rendered film, then offers a separate model-inspection section.

Their writing uses short sentences, physical objects and clear actions. A sleeve locks, a box clips on, a pack slides out, a nurse unclips the delivery. Technical information supports a point at the moment the reader needs it. Headlines explain a benefit; the body explains the mechanism; a small annotation illustrates that same point. It is not a wall of specs, a feature inventory or an abstract technology manifesto.

Both references ultimately sell Sixjuly's product-storytelling work. **Do not automatically adopt that conversion goal.** Raven currently presents a medical-delivery concept. Keep its ending product-focused unless the user separately requests a studio-portfolio ending. Likewise, Doko's bamboo-basket name origin belongs to Doko; do not invent that origin for Raven.

## 3. Phase boundaries

### Phase 1 — implement now

- Rewrite visible content and editorial hierarchy throughout the existing site.
- Change chapter/navigation labels while retaining the current scene IDs and target offsets.
- Rewrite HUD/status text and 3D-anchored labels without changing their trigger timing, positions or animation.
- Update below-fold copy, CTAs, accessible names and page metadata consistently.
- Keep the current Raven aircraft and full-resolution textures intact.
- Fix copy-induced layout issues locally: line wrapping, overly long labels, a heading collision. Do not shrink all typography or redesign the page to fit a paragraph.
- Produce a separate visual-story transition plan that identifies what content cannot yet be demonstrated by the current visuals.

### Phase 2 — plan only

Preparation, cargo loading/protection, explicit take-off, clinic handoff, return/battery exchange and hospital-to-clinic network shots may require new animation, props or scene staging. Record those requirements. Do not generate new GLBs, render new sequences, add a new scroll controller, change camera tracks, replace terrain, change lighting or retime the story in Phase 1.

Do not claim that a copy-only pass completes the full Doko-style chronological film. Existing fire/thermal/response graphics remain a real limitation until the visual phase changes them.

## 4. Product truth and claim controls

Current model is a light-gray **four-arm coaxial quad, eight propellers total**, without the raised mast. It is not Doko Redesign's six-rotor machine, Doko Eight's single-prop quad, or the previous Raven hexacopter.

Raven's payload, endurance, speed, range, dispatch time, battery-exchange time, cold-weather operating limits and certifications are unspecified. Do not import Doko's 2.5kg, 10km, 50km/h, twelve-minute flight, two-hour road journey, sixty-second swap, 4°C readout, 24-inch prop dimensions or one-motor-out landing assurance.

Do not invent a functioning winch, autonomous delivery approval, validated cold-chain system, temperature logger, operational clinic network, service availability or emergency-dispatch integration. These can be future design requirements, not current capabilities presented as proven facts.

Use a concise site-level concept notice and a small “Illustrative delivery” marker in the journey/HUD. The main copy can then describe the **intended scenario** in normal language. Do not repeat “concept” in every sentence, but do not disguise illustrations as live telemetry or field results.

For temperature-sensitive medicines, describe the need for suitable packaging and handling. Do not imply all medicines share a temperature range, or that a temperature number proves medicine is safe. Do not add numerical temperature UI without verified requirements and implementation. For cold mountain regions, express the use context, not a tested all-weather capability.

Retain `noindex`, the existing honest non-sending contact form, and local asset serving. No commit, push or deployment unless explicitly requested.

## 5. Intended complete story, independent of current scene constraints

Use this as the narrative destination. It is not authorization to pretend these actions are already animated.

| Beat | Reader question | Message | Visual needed eventually |
|---|---|---|---|
| 1. The need | Why should I care? | A hill clinic needs medicines; the road is a difficult connection. | Hospital/clinic/terrain context, not a threat scan. |
| 2. Preparation | What is being sent, and from where? | A care team prepares a supply request at a regional health centre. | Cargo preparation, packing and route context. |
| 3. The load | What does Raven carry? | Supplies travel in a secured case; packaging follows the medicine's needs. | Case detail, attachment and closure. |
| 4. Departure | How does it leave? | Introduce the intended vertical departure in the delivery scenario. | Clear launch pad and visible controlled ascent. |
| 5. Crossing | Why air? | A direct crossing connects places separated by a winding ground route. | Legible road detour, ridge crossing, destination orientation. |
| 6. Handoff | What happens at the clinic? | A local health worker receives the supplies. | A chosen, actually modeled safe handoff method. Do not invent a winch. |
| 7. Return | Can the service repeat? | The next request begins with preparation for another trip. | Return/ground turnaround; battery details only if designed. |
| 8. Network | What changes at a wider scale? | Regional health centres could support several remote clinics. | Hub and destination context, illustrative routes without invented coverage radius. |
| 9. Invitation | What can I do next? | Discuss a use case, route or concept. | Existing honest contact flow and concise concept notice. |

The drone is the means. A clinic receiving useful supplies is the outcome. Every section must answer one of these questions.

## 6. Proposed content direction

Use the copy below as the implementation baseline. Edit only when a screenshot reveals a length problem or a scene requires a more accurate bridge. Record meaningful changes in the content inventory. Do not replace it with generic AI/innovation language.

### Hero

**Headline:** “The road goes around. Raven goes over.”

**Supporting copy:** “When a hill clinic runs short of medicines, the journey matters. Raven explores a direct air link from a regional health centre to the village waiting for supplies.”

**CTA:** “Follow the delivery” — retain the current Explore button's scene target and transition.

**Small scenario marker:** “Illustrative medical delivery”

The road/air contrast is the central idea, without an invented travel-time promise. If direct-route language is unsuitable for the actual visible route, use “Care for the places beyond the road.” as the fallback headline, and explain the discrepancy rather than inventing route data.

### Airframe/spec callouts — same four anchors

| Title | Supporting copy |
|---|---|
| “Medical cargo” | “A case beneath the aircraft puts the delivery at the centre of the design.” |
| “Coaxial quad” | “Four arms carry paired upper and lower propellers.” |
| “Remote clinics” | “The intended connection is between a health centre and the communities around it.” |
| “Local care teams” | “The journey ends with people receiving the supplies they need.” |

These are explanatory labels, not performance evidence. Do not label a rotor an insulated box or pretend an anchor points to a nonexistent sensor. Keep headings short enough for the existing callout slots.

### Current main scroll: content-first bridge map

Preserve these internal IDs and their existing show/hide windows. The displayed names can change. This bridge version deliberately acknowledges the route-hazard visuals rather than falsely presenting them as delivery or cold-chain footage.

| Existing scene / copy slot | Proposed heading | Proposed supporting copy |
|---|---|---|
| `INTRO_SCENE` + early `DELTA_DRONE` | Hero above | Hero above. |
| `SWARM_SCENE` | “From a health centre to a hill clinic.” | “One supply request gives the journey a purpose. Raven's wider network begins with the connection between a care team and the village it serves.” |
| `MISSION_PRESET` | “Start with what the clinic needs.” | “In this illustrative journey, a care team prepares the supplies and reviews the destination before dispatch.” |
| `FLOCK_SCENE` | “Keep the delivery in view.” | “The aircraft is one part of the journey. The sender, the receiving clinic and the route between them matter just as much.” |
| `REAL_TIME_DETECTION` | “Read the route ahead.” | “The route view introduces the terrain, road access and obstacles between the health centre and the clinic.” |
| `THERMAL_IRREGULARITY` | “A hazard changes the plan.” | “This simulated heat alert interrupts the delivery scenario. The route needs review before the journey continues.” |
| `IGNITION_VERIFIED` | “Review the affected area.” | “The scene confirms a fire along the illustrated route. It is a route-planning example, not a claim that Raven fights fires.” |
| `PHALANX_AI` | “Keep the care team informed.” | “A useful delivery view brings the destination and route status together, so the people arranging supplies share the same picture.” |
| `ANALYSIS_EVALUATION` | “Reconsider the approach.” | “When access changes, the delivery plan must change with it. The next step in this scenario is a review of the route.” |
| `INTEGRATED_NOTIFICATIONS` | “The clinic needs an update.” | “If a delivery is delayed, the people waiting for it need to know. Clear updates belong to the journey, not just to the aircraft.” |
| `INTERDRONE_COORDINATION` | “Coordinate the next supply run.” | “The wider concept connects several requests with the care teams arranging them. Extra aircraft are support, not the story's main event.” |
| `EXTRA_SUPPORT` | “Support the places still waiting.” | “A second Raven enters the illustration as access is reviewed. The goal remains the same: getting supplies to the intended clinic.” |
| `ZONE_STABILIZED` | “Prepare for the next step.” | “The illustrated response settles. The delivery outcome still depends on a suitable approach and a confirmed handoff.” |
| `MULTI_THREAT_RESPONSE` | “One journey. A wider connection.” | “Start with one clinic and one supply request. Then consider how a regional health centre could support more remote communities.” |

**Mission CTA:** “Explore the route” — retain its current destination. Avoid “Dispatch now” or “Start delivery,” which imply a real service action.

**Status pills:** replace `M-1 Success` with “Hazard noted”; replace `M-2 Completed` with “Scenario update.” Neither a fire scene nor a color change establishes a medicine delivery.

This interim structure is less chronological than the intended complete story because the current scene order is inherited. Do not claim otherwise. Its purpose is to remove the military narrative and make the existing route detour intelligible until Phase 2 replaces it.

### Navigation labels

Keep chapter target IDs, click fade, scroll duration and active states. Suggested display labels:

- `DELTA_DRONE`: “Airframe”
- `SWARM_SCENE`: “Connection”
- `MISSION_PRESET`: “Prepare”
- `FLOCK_SCENE`: “Journey”
- `REAL_TIME_DETECTION`: “Route”
- `PHALANX_AI`: “Care teams”
- `ANALYSIS_EVALUATION`: “Review”
- `INTEGRATED_NOTIFICATIONS`: “Updates”
- `INTERDRONE_COORDINATION`: “Support”
- `MULTI_THREAT_RESPONSE`: “Network”

Check small-screen tick expansion and keyboard labels. Do not leave “Go to Detection” in an accessible name after relabeling the button. Replace unrelated menu entries such as SARA/Athena with truthful destinations available in this page; do not introduce new `#` placeholders. This is a small content/navigation correction, not a request to build product subpages.

## 7. HUD, scene annotations and secondary language

The small text is part of the story. Do not leave it as a surveillance demo beneath the new headings.

Audit `HudLog.tsx`, `Perimeters.tsx`, `DetectionPoints.tsx`, `ThermalHud`, `SwarmTags`, `Globe.tsx`, loader strings, menu/dialog strings and any canvas-rendered text. Preserve animation and trigger logic while updating or suppressing unsupported wording.

Use concise scene-accurate statuses, for example:

- `ILLUSTRATIVE DELIVERY`
- `REGIONAL HEALTH CENTRE`
- `DESTINATION: HILL CLINIC`
- `ROUTE VIEW`
- `ROAD ACCESS SHOWN`
- `SIMULATED HEAT ALERT`
- `ROUTE REVIEW REQUIRED`
- `CARE-TEAM UPDATE`
- `SUPPORT VIEW`
- `SCENARIO COMPLETE`

These are display labels, not backend events. Do not add fake “temperature verified,” “dose safe,” “payload secure,” “clinic notified,” “delivery completed” or “cold chain maintained” confirmations without modeled/validated support. A UI completion marker should describe the illustration, not assert a completed real delivery.

Remove the unverified dual-GPU/agent claim, old speed/altitude values, invented confidence percentages, hardcoded coordinates presented as live position, “Phalanx,” “battlespace,” “target locked,” “potential threat,” and military-style secured-zone success messages. Where the current visual genuinely depicts fire, police or firefighters, keep the wording accurate to the illustration or mark it as a legacy visual needing replacement. Do not rename a firefighter graphic “nurse” and call that a content fix.

Keep object labels literal when the visible object is a car, road block or power line. If 99% confidence is baked into a label, remove the number; do not substitute another fabricated confidence. Preserve status contrast and text fit.

## 8. Below-fold content and ending

### Use-case heading

“Care depends on the connection.”

Three cards:

1. **Mountain villages** — “A nearby health centre can still be a difficult road journey away. Raven explores another connection for essential supplies.”
2. **Winter access** — “Snow and disrupted roads can separate communities from routine care. Cold-climate delivery is part of the use case, not a tested weather capability.”
3. **Remote health centres** — “A regional hub could support smaller clinics with planned supply runs and a clear handoff to local health workers.”

### Coverage / globe

**Heading:** “From one health centre to the communities around it.”

**Body, if the existing layout supports one:** “The network view illustrates a relationship between senders and receivers. It does not represent confirmed routes, an operating service or a guaranteed coverage radius.”

Replace unrelated globe success messages such as “power restored” or “wildfire contained” with illustrative destination/status labels that do not fabricate delivered outcomes.

### Demo / concept section

**Heading:** “Follow a medical delivery scenario.”

**Body:** “Explore how an air route could connect a regional health centre with a remote clinic, from the request for supplies to the people waiting at the other end.”

**CTA:** “Discuss a use case” — opens the existing contact dialog. Do not promise a live flight demo or a follow-up service that is not implemented.

### About/concept copy

“Raven is a medical delivery drone concept for remote mountain and cold-climate communities. This site explores the journey, the aircraft and the connection between local care teams.”

### Footer

**Headline:** “Start with a place that needs the connection.”

**CTA:** “Discuss a use case”

**Concept notice:** “Raven is a design concept. Aircraft capability, temperature-control requirements, operating limits and service availability are not established by this demonstration.”

Retain the existing privacy/concept notices and honest form result. Do not reintroduce the removed third-party brand, old Notes link or team affiliations. Do not insert Sixjuly's sales pitch unless the user confirms that Raven should be a studio case study rather than a product concept.

## 9. Existing transition contract — preserve in Phase 1

- One Lenis controller, one scene progress source. No new ScrollTrigger/smoothing layer.
- Existing scene order and scroll spans; intro's special offset handling remains intact.
- Existing GLB camera and drone animation bindings, responsive tracks and root fitting transforms.
- Existing chapter show/hide progress thresholds, including hero exit at delta .075 and specs gate near delta > .9 / swarm < .01.
- Existing heading/support/CTA entrance and exit timing, offsets and easing. Preserve .4s text transitions, .2s support delay and .4s CTA delay unless a documented bug requires a narrowly scoped fix.
- Existing chapter-click sequence: 150ms scene fade, .75s scroll, scene restore.
- Existing projected callout anchors, SVG line draws, status reveals, HUD triggers and footer sequence mapping.
- Existing reduced-motion behavior and accessible dialog/focus/scroll lock.

Content that is too long should be edited, not accommodated by changing camera positions or extending the timeline. Keep headlines around 5–10 words, supporting blocks generally 20–35 words, compact HUD lines and short callout titles. Validate rendered wrapping rather than relying only on word counts.

## 10. Phase 2 transition plan — write, do not implement

Create `RAVEN_VISUAL_STORY_PLAN.md` describing each desired transition with:

- current scene and what it actually depicts;
- intended story beat and the question it answers;
- missing assets/actions;
- precise change proposed: prop, character, overlay, object animation, new frame render or camera modification;
- whether existing choreography can genuinely support it;
- acceptance evidence required;
- any product decisions/claims still awaiting confirmation.

Cover at least:

1. Hospital/clinic context → preparation and packing.
2. Case close-up → verified attachment; temperature-control treatment remains an open design requirement.
3. Airframe explanation → launch/vertical ascent.
4. Launch → route over ridge, with road/air comparison that uses geometry rather than invented times.
5. Ridge crossing → clinic arrival and a chosen handoff method.
6. Handoff → return/ground preparation; battery exchange is a design task if adopted, not a proven speed claim.
7. One route → illustrative multi-clinic network.
8. Guided story → optional inspection/product detail → honest use-case invitation.

Make the fire-response detour a specific replacement candidate. Do not propose fifteen near-identical delivery chapters to fill all existing spans indefinitely. The visual phase should eventually simplify and pace a complete journey, but any changes to current tracks/spans need a separate deliberate implementation task.

## 11. Implementation and verification

Likely files: `src/components/scene/ChapterCopy.tsx`, `HudLog.tsx`, `overlays/SpecsCallouts.tsx`, `Navbar.tsx`, `sections/Sections.tsx`, `sections/Globe.tsx`, relevant in-scene text modules, `ContactForm.tsx` / `ContactButton.tsx`, and `src/app/layout.tsx`. Inspect before editing; do not blindly replace strings throughout research files or historical documentation.

Consider one typed content configuration for repeated text, if it reduces inconsistent copies without refactoring the animation architecture. Use the existing project's patterns and avoid per-frame React state.

Deliver:

1. Implemented Phase 1 content rewrite.
2. `RAVEN_CONTENT_MAP.md`: old scene ID → displayed chapter name → final heading/body → evidence/claim status → current visual mismatch.
3. `RAVEN_VISUAL_STORY_PLAN.md`: actionable Phase 2 plan.
4. Updated `RECONSTRUCTION.md` and current-work notes in `AGENTS.md`, accurately stating what changed and what remains visual debt.
5. Validation results and concise remaining decisions.

Checks:

- Search visible source for residual tactical and unsupported capability text; inspect findings rather than banning legitimate code identifiers.
- Confirm no imported Doko figures or capabilities appear in Raven copy.
- Confirm four-arm/eight-prop coaxial terminology stays consistent.
- `npm run typecheck` and `npm run build` pass.
- Use the project-recommended browser workflow to inspect hero, specs, chapter transitions, hazard bridge, network, cards, footer and contact dialog at desktop and 390×844; include 821×1109 where feasible.
- Check titles and support text do not collide, narrow-screen navigation remains usable, and accessible labels match visible copy.
- Check selected forward and reverse chapter navigation; record any mismatch rather than changing camera timing to hide it.
- Do not submit the contact form to any real third-party service. The local form must continue to say nothing was sent.
- Do not commit, push or deploy as part of this prompt unless the user separately authorizes it.

## Final quality test

A reader should be able to explain the intended medical delivery in ordinary language after one pass: who needs supplies, where they come from, why the route is difficult, what Raven is intended to carry, who receives it and how this could connect more clinics.

If the reader instead remembers object detection, military-style coordination, fire response or vague autonomous intelligence, the content pass has not solved the problem. If the copy describes packing, temperature monitoring, a winch or a battery swap that the scene does not show, document the gap rather than claiming that the full story has been rebuilt.
