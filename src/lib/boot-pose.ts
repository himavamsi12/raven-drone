import * as THREE from "three";

/**
 * Loader match cut (user 2026-11-05: "change the logo of the loader to the current 3D model ... like a match cut").
 * While the loader is up, DroneRig writes the live hero drone's world matrix, the main camera and the main canvas
 * rectangle here every frame; the loader draws the same Raven model as a flat silhouette through that camera on a
 * canvas over the same rectangle, so the silhouette sits exactly on the drone the reveal uncovers.
 */
export const bootPose = {
  ready: false,
  /** World matrix of the RavenModel root (the cloned GLB scene) in the main scene. */
  model: new THREE.Matrix4(),
  /** Main camera world matrix and projection (view offset and fov included). */
  camera: new THREE.Matrix4(),
  projection: new THREE.Matrix4(),
  /** Main canvas rectangle in CSS px. */
  rect: { x: 0, y: 0, w: 0, h: 0 },
};
