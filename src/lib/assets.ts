/** Local copies of the reference asset paths (shipped module 25621). */
export const ASSETS = {
  blueNoise: "/assets/textures/terrain/bnoise.png",
  cityTexture: "/assets/textures/terrain/city.webp",
  terrain: "/assets/models/terrain.glb",
  cityTerrain: "/assets/models/city-terrain.glb",
  ravenTerrain: "/assets/models/raven-terrain.glb", // Raven natural tile Land-A + Houses (glb/raven-terrain/)
  building: "/assets/models/building.glb",
  grid: "/assets/models/grid.glb",
  gridCity: "/assets/models/grid-city.glb",
  raven: "/assets/models/raven_hexa.glb", // hexacopter medical drone (6 props); source glb/new-drone/
  droneLowpoly: "/assets/models/drone-lowpoly.glb", // Raven silhouette, same node/axis convention as delta-lowpoly
  cameraAnimations: "/assets/models/camera-animations.glb",
  cameraAnimationsMobile: "/assets/models/camera-animations-mobile.glb",
  droneAnimations: "/assets/models/drone-animations.glb",
  droneAnimationsMobile: "/assets/models/drone-animations-mobile.glb",
  loadingDrone: "/assets/models/loading-drone.glb", // Raven silhouette, replaces loading-delta
  noise: "/assets/textures/fx/noise.webp",
  openingLand: "/assets/textures/environment/raven-opening-land.webp", // glb/raven-sky/01_opening_panorama.py (land)
  env: "/assets/textures/environment/env.exr",
  geistSemiBold: "/assets/3d-fonts/Geist-SemiBold.woff",
} as const;

export const DRACO_PATH = "/draco/";
