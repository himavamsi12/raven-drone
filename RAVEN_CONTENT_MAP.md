# Raven content map — Phase 1 (copy-only) rewrite

Date: 2026-10-30. Source brief: `RAVEN_STORY_CONTENT_PROMPT.md`. Scope: visible text only. Scene IDs, spans, show/hide windows,
camera tracks, HUD trigger points, callout anchors, text timing and footer sequence are unchanged.

Claim status key:
- **Scenario**: describes the illustrated, intended delivery. Not a demonstrated capability.
- **Literal**: names what the current visual shows.
- **Notice**: a limitation or concept disclaimer.

## Story chapters (`src/components/scene/ChapterCopy.tsx`)

| Scene ID | Nav label | Heading | Supporting copy | Claim status | Current visual mismatch |
|---|---|---|---|---|---|
| `INTRO_SCENE` + early `DELTA_DRONE` | — | The road goes around. Raven goes over. Eyebrow: "Illustrative medical delivery". CTA: "Follow the delivery". | When a hill clinic runs short of medicines, the journey matters. Raven explores a direct air link from a regional health centre to the village waiting for supplies. | Scenario | Aircraft over terrain; no road, health centre or clinic is visible yet. The road/air contrast is stated, not shown. |
| `DELTA_DRONE` (specs gate) | Airframe | Four callouts (below) | — | Literal / Scenario | Callouts anchor to points around the airframe. The case is real geometry. "Remote clinics" and "Care teams" are explanatory labels with no object in the scene. |
| `SWARM_SCENE` | Connection | From a health centre to a hill clinic. (Short variant: "Health centre to hill clinic.") | One supply request gives the journey a purpose. Raven's wider network begins with the connection between a care team and the village it serves. Rows: Sender / Cargo / Route / Receiver. | Scenario | Three aircraft fly in formation, tagged RAVEN-01/02/03. Neither the sender nor the receiver is visible. |
| `MISSION_PRESET` | Prepare | Start with what the clinic needs. CTA: "Explore the route" (same target). | In this illustrative journey, a care team prepares the supplies and reviews the destination before dispatch. | Scenario | The aircraft is already airborne. No preparation or packing is shown (Phase 2, beat 2). |
| `FLOCK_SCENE` | (removed 2026-11-02) | — | — | Removed | Chapter removed at the user's request: no copy, no nav tick, network map not shown; the scene plays compressed inside the Route scroll as a transition. |
| `REAL_TIME_DETECTION` | Route | Read the route ahead. | The route view introduces the terrain, road access and the villages between the health centre and the clinic. | Literal | On the Raven terrain the object boxes were replaced (2026-11-02, user) by scan frames around the tile's real settlements: Hill / Ridge / Valley village and Farmstead, status "Scanning"; no counts, distances or confirmations. `?terrain=original` keeps the shipped object boxes (no percentages). No route line, start or destination is drawn. |
| `THERMAL_IRREGULARITY` | (Route) | A hazard changes the plan. Pill: "Hazard noted". | This simulated heat alert interrupts the delivery scenario. The route needs review before the journey continues. | Literal (simulated) | Thermal search box and thermal palette. This is a legacy surveillance visual and the main replacement candidate. |
| `IGNITION_VERIFIED` | (Route) | Review the affected area. | The scene confirms a fire along the illustrated route. It is a route-planning example, not a claim that Raven fights fires. | Literal + Notice | Fire over a village tile. Legacy visual. |
| `PHALANX_AI` | Care teams | Keep the care team informed. | A useful delivery view brings the destination and route status together, so the people arranging supplies share the same picture. | Scenario | Grid "ops" view of the city tile with a perimeter and focus dots. |
| `ANALYSIS_EVALUATION` | Review | Reconsider the approach. | When access changes, the delivery plan must change with it. The next step in this scenario is a review of the route. | Scenario | Two inbound low-poly drones. The visual implies a dispatch to the hazard. |
| `INTEGRATED_NOTIFICATIONS` | Updates | The clinic needs an update. | If a delivery is delayed, the people waiting for it need to know. Clear updates belong to the journey, not just to the aircraft. | Scenario | Four moving arrows converge on the zone. They were responder vehicles; the labels now read as updates (see below). |
| `INTERDRONE_COORDINATION` | Support | Coordinate the next supply run. | The wider concept connects several requests with the care teams arranging them. Extra aircraft are support, not the story's main event. | Scenario | A second zone (labelled "Hill clinic") appears beside the first. |
| `EXTRA_SUPPORT` | (Support) | Support the places still waiting. (Was untitled.) | A second Raven enters the illustration as access is reviewed. The goal remains the same: getting supplies to the intended clinic. | Literal / Scenario | A second drone flies to a power station marked red, which reads as a fire response. |
| `ZONE_STABILIZED` | (Support) | Prepare for the next step. Pill: "Scenario update". | The illustrated response settles. The delivery outcome still depends on a suitable approach and a confirmed handoff. | Notice | The zone turns green. No handoff is shown or claimed. |
| `MULTI_THREAT_RESPONSE` | Network | One journey. A wider connection. | Start with one clinic and one supply request. Then consider how a regional health centre could support more remote communities. | Scenario | Several zones turn green (now "Supply request" then "Illustrative route"). No hub is identified. |

Edits from the brief's baseline, prompted by screenshots:

- **Swarm trait rows:** the brief gave none. The old Autonomy/Scalability/Collaboration/Coverage rows are replaced with the four parts of one delivery. They are kept short so each fits on one line at 390px.
- **Mobile callout:** "Local care teams" is shortened to "Care teams". At 390px it wrapped to two lines and collided with its body text.
- **Mission heading:** `whitespace-nowrap` is replaced with `text-balance` so the longer heading wraps inside its existing max width.
- **Thermal heading line break:** the break is now "A hazard changes / the plan." so the pill fits on line two.
- **Zone pill:** moved under the heading.

## Airframe callouts (`overlays/SpecsCallouts.tsx`, same four anchors)

| Title | Body | Status |
|---|---|---|
| Medical cargo | A case beneath the aircraft puts the delivery at the centre of the design. | Literal: the case is modelled. Its contents and any insulation are not designed. |
| Six rotors | Six arms carry propellers that spin in alternating directions. | Literal: raven_hexa has 6 arms/props; spin directions come from the source GLB's prop clips (2026-10-31). |
| Remote clinics | The intended connection is between a health centre and the communities around it. | Scenario |
| Care teams | The journey ends with people receiving the supplies they need. | Scenario |

## HUD log (`HudLog.tsx`, same 32 trigger points)

The header lines appear, in order, through flock, detection, thermal and ignition:

1. ILLUSTRATIVE DELIVERY
2. FROM: REGIONAL HEALTH CENTRE
3. DESTINATION: HILL CLINIC
4. REQUEST: MEDICAL SUPPLIES
5. ROUTE VIEW
6. TERRAIN AND RIDGES SHOWN
7. ROAD ACCESS SHOWN
8. VILLAGES IN VIEW
9. SIMULATED HEAT ALERT
10. ALERT ON ILLUSTRATED ROUTE
11. ROUTE REVIEW REQUIRED
12. CARE-TEAM UPDATE
13. SIMULATED HEAT ALERT
14. FIRE SHOWN NEAR ROUTE
15. AFFECTED AREA SHOWN
16. ROUTE REVIEW REQUIRED

The body lines appear through phalanx, analysis, notifications, extra support and zone:

1. ROUTE VIEW
2. DESTINATION: HILL CLINIC
3. SHARED VIEW: CARE TEAMS
4. HAZARD NOTED ON ROUTE
5. REVIEWING THE APPROACH
6. 2 FIRES + 1 ROADBLOCK SHOWN
7. CARE-TEAM UPDATE
8. SCENARIO: DELIVERY DELAYED
9. SUPPORT VIEW
10. DESTINATION: HILL CLINIC
11. SECOND RAVEN SHOWN
12. ON THE ILLUSTRATED ROUTE
13. FIRE NEAR POWER STATION
14. ROUTE REVIEW CONTINUES
15. HAZARD: SETTLING
16. STATUS: SCENARIO COMPLETE

Removed from the HUD:

- Sensor suite (thermal, lidar, RGB, IR).
- "2 agents / dual GPU".
- The Phalanx link.
- Coordinates presented as live position.
- Altitude and speed (1,240 m, 74 km/h).
- Object counts.
- 87% signal intensity.
- "Potential threat" and "target zone locked".
- "Authorities contacted" and "firefighter units alerted".
- "Area secured".

## In-scene labels

| Location | Old | New | Status |
|---|---|---|---|
| `DetectionPoints.tsx` | label + jittering `NN%` | label only (kept literal) | Literal |
| `ThermalHud.tsx` | Thermal Sensor / 0°C / 148°C / Threat Area | Simulated heat view / Cool / Hot / Hazard area | Literal (simulated); no temperature numbers |
| `SwarmTags.tsx` | DSA011/012/013 | RAVEN-01/02/03 | Literal |
| `Perimeters.tsx` centre zone | Survey Area → Active Threats → Services on site | Route view → Hazard noted → Care-team update | Scenario |
| `Perimeters.tsx` second zone | Sensitive Area → Alert Area → Area Secured | Hill clinic → Access review → Scenario update | Scenario |
| `Perimeters.tsx` responders | Police / Firefighters / Ambulance / Emergency Services | Health centre update / Clinic update / Care-team update / Road access update | Scenario. The arrows were responder vehicles; now they illustrate updates in transit, not confirmed notifications. |
| `Perimeters.tsx` network zones | Hazard Area / Active Zone / Alert Area → Zone Stabilized / Area Contained | Supply request → Illustrative route | Scenario |
| `Globe.tsx` | Power Restored, Flood Area Secured, Evacuation Supported, Missing Person Found, Road Block Cleared, Wildfire Contained | Hill clinic, Village health post, Regional health centre, Winter-access clinic, Mountain village, Remote health post | Illustrative destinations, not outcomes |
| Loader | Calibrating | Preparing scene | — |

## Navigation and menu (`Navbar.tsx`)

- **Chapter ticks:** Airframe, Connection, Prepare, Journey, Route, Care teams, Review, Updates, Support, Network.
  - Targets are unchanged, and so are the 150ms fade, 0.75s scroll and restore.
  - Accessible names follow the labels ("Go to Route").
- **Menu links:** the old links (Raven, Raven Ops, SARA, Athena, About Us) all pointed at `#`. They are replaced with in-page jumps:
  - The delivery story (top), Use cases (`#use-cases`), Network (`#network`), Scenario (`#scenario`), About Raven (`#our-team`). Contact is unchanged.
- **Menu footer:** "We're hiring" ("sentient drone") and "Partner Program" ("agencies") are removed. A concept notice replaces them.

## Below the fold (`sections/Sections.tsx`)

- **Use cases:**
  - Heading: "Care depends on the connection."
  - Cards: Mountain villages, Winter access and Remote health centres, using the brief's copy verbatim.
  - The winter card states that cold-climate delivery is not a tested weather capability.
- **Coverage:**
  - Heading: "From one health centre to the communities around it."
  - Body: the network view is illustrative, not confirmed routes, an operating service or a guaranteed coverage radius.
- **Demo:** heading "Follow a medical delivery scenario." and the brief's body copy. CTA "Discuss a use case" opens the existing contact dialog.
- **About text** (DOM on every size): the brief's about copy.
- **Footer:** removed (user, 2026-11-03), with its headline, "Discuss a use case" CTA, legal links and concept notice. The concept notice is still in the menu (`src/lib/copy.ts`).
- **Contact result:** "Not sent: this concept site has no form backend, so your message was not delivered." Still nothing is sent.
- **Metadata:** the description leads with the road/air line. `noindex` is unchanged.

## Claim checks

- None of Doko's figures appear in Raven copy:
  - 2.5 kg, 10 km, 50 km/h, 12 minutes, two hours, 60 s, 4°C, 24-inch props, motor-out landing.
- None of these capabilities are invented:
  - Winch, cold chain or temperature logger.
  - Delivery approval, clinic network, service availability or dispatch integration.
- Airframe terminology is consistent everywhere: hexacopter, six arms, six props with alternating spin (the loader/flock silhouettes still show the earlier quad).
- Temperature appears once, as an open requirement in the concept notice, with no numerical readout.
