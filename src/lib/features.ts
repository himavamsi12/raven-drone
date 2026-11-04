/**
 * Copy for the sections after the 3D stage (user's Figma, file "Drone Website", 2026-11-04):
 * Section 03 = frames 128:804 / 128:830 / 128:857 (one feature each, switched by scroll),
 * Section 04 = frame 100:622 (capability videos, played one after another).
 * The Figma frames repeat one placeholder card ("Sealed motor pods", Propulsion / Status LED); only frame 3 shows a
 * motor pod, so the first two cards are titled after their own image (parts of the hexa model, no performance claims).
 */

export const SECTION_HEADING = "Send What’s Needed, Where It’s Needed";
export const SECTION_BODY = "Heavy payload capacity and long flight distance overcome logistical limitations for next-generation delivery.";

export type Feature = { id: string; title: string; body: string; tags: string[]; image: string; alt: string };

export const FEATURES: Feature[] = [
  {
    id: "arms",
    title: "Carbon-fibre arms",
    body: SECTION_BODY,
    tags: ["Airframe", "Carbon fibre"],
    image: "/assets/features/feature-arm.webp",
    alt: "Close-up of a woven carbon-fibre drone arm",
  },
  {
    id: "gimbal",
    title: "Sensor gimbal",
    body: SECTION_BODY,
    tags: ["EO/IR", "Thermal"],
    image: "/assets/features/feature-gimbal.webp",
    alt: "The drone's sensor gimbal above the medical box",
  },
  {
    id: "motor",
    title: "Sealed motor pods",
    body: SECTION_BODY,
    tags: ["Propulsion", "Status LED"],
    image: "/assets/features/feature-motor.webp",
    alt: "A sealed motor pod with its propeller",
  },
];

export type CapabilityVideo = { id: string; label: string; src: string; poster: string };

/** Section 04 tabs, in the Figma order. Clips: assets/Section 04 videos (audio stripped, they play muted). */
export const CAPABILITY_VIDEOS: CapabilityVideo[] = [
  { id: "sensor", label: "Sensor", src: "/assets/video/section04/sensor.mp4", poster: "/assets/video/section04/sensor-poster.jpg" },
  { id: "crosswind", label: "Crosswind", src: "/assets/video/section04/crosswind.mp4", poster: "/assets/video/section04/crosswind-poster.jpg" },
  { id: "autopilot", label: "Auto pilot", src: "/assets/video/section04/autopilot.mp4", poster: "/assets/video/section04/autopilot-poster.jpg" },
];
