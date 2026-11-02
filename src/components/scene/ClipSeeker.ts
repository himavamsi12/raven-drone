import * as THREE from "three";
import { SCENE, scenes, type SceneId } from "@/lib/scenes";

/**
 * One clip bound to a scene, in the order the shipped `tN` registers them.
 * `always` bindings seek even at progress 0; `lastFrame` pins the clip end.
 */
export type ClipBinding = {
  scene: SceneId | null;
  clip: string;
  always?: boolean;
  lastFrame?: boolean;
};

export const CAMERA_BINDINGS: ClipBinding[] = [
  { scene: SCENE.DELTA_DRONE, clip: "Camera01", always: true },
  { scene: SCENE.SWARM_SCENE, clip: "Camera02" },
  { scene: SCENE.MISSION_PRESET, clip: "Camera03" },
  { scene: SCENE.FLOCK_SCENE, clip: "Camera04-02" },
  { scene: SCENE.THERMAL_IRREGULARITY, clip: "Camera05" },
  { scene: SCENE.IGNITION_VERIFIED, clip: "Camera06" },
  { scene: SCENE.ANALYSIS_EVALUATION, clip: "Camera07" },
  { scene: SCENE.INTERDRONE_COORDINATION, clip: "Camera08" },
  { scene: SCENE.MULTI_THREAT_RESPONSE, clip: "Camera09" },
];

export const DRONE1_BINDINGS: ClipBinding[] = [{ scene: null, clip: "Drone01-01", lastFrame: true }];

export const DRONE2_BINDINGS: ClipBinding[] = [
  { scene: SCENE.SWARM_SCENE, clip: "Drone02-01", always: true },
  { scene: SCENE.MISSION_PRESET, clip: "Drone02-02" },
  { scene: SCENE.FLOCK_SCENE, clip: "Drone02-03" },
];

export const DRONE3_BINDINGS: ClipBinding[] = [
  { scene: SCENE.SWARM_SCENE, clip: "Drone03-01", always: true },
  { scene: SCENE.FLOCK_SCENE, clip: "Drone03-02" },
];

/**
 * Deterministic clip seeking for one animated tracker node.
 *
 * The reference creates one AnimationMixer per binding and sets
 * `action.time = duration * progress - 1e-6` on play()+paused actions, then
 * copies the tracker's transform to the mover. With several mixers writing the
 * same node, the last-registered active binding wins. This class resolves that
 * winner explicitly every frame (latest binding whose scene has progress > 0,
 * else the `always` one), so forward travel matches and reverse travel seeks
 * the same clip backward instead of holding a stale pose.
 */
export class ClipSeeker {
  private mixer: THREE.AnimationMixer;
  private actions: (THREE.AnimationAction | null)[];
  private current: THREE.AnimationAction | null = null;

  private samplers = new Map<string, { duration: number; pos: THREE.Interpolant; rot: THREE.Interpolant }>();

  constructor(
    private tracker: THREE.Object3D,
    private clips: THREE.AnimationClip[],
    private bindings: ClipBinding[],
  ) {
    this.mixer = new THREE.AnimationMixer(tracker);
    this.actions = bindings.map((b) => {
      const clip = clips.find((c) => c.name === b.clip);
      if (!clip) return null;
      const action = this.mixer.clipAction(clip);
      action.clampWhenFinished = true;
      return action;
    });
  }

  /** Seeks and copies the tracker transform into `mover`. Returns false if nothing is bound yet. */
  apply(mover: THREE.Object3D) {
    const state = scenes();
    // Fallback: the always/lastFrame binding. Preferred: latest scene with progress > 0.
    let index = this.bindings.findIndex((b) => b.always || b.lastFrame);
    for (let i = this.bindings.length - 1; i >= 0; i--) {
      const b = this.bindings[i];
      if (b.scene && state[b.scene].progress > 0) {
        index = i;
        break;
      }
    }
    const action = index >= 0 ? this.actions[index] : null;
    if (!action) return false;
    const binding = this.bindings[index];
    if (this.current !== action) {
      this.current?.stop();
      action.play();
      action.paused = true;
      this.current = action;
    }
    const duration = action.getClip().duration;
    const progress = binding.scene ? state[binding.scene].progress : 0;
    action.time = binding.lastFrame ? duration : duration * progress - 1e-6;
    this.mixer.update(0);
    mover.position.copy(this.tracker.position);
    mover.rotation.copy(this.tracker.rotation);
    return true;
  }

  /**
   * Pose of the tracker in clip `name` at `progress` (0..1), sampled straight from its tracks: does not touch the mixer,
   * the active action or the tracker. Raven: used to blend between two fixed camera poses (DroneRig Prepare -> Route).
   */
  sample(name: string, progress: number, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
    let entry = this.samplers.get(name);
    if (!entry) {
      const clip = this.clips.find((c) => c.name === name);
      if (!clip) return false;
      const pos = clip.tracks.find((t) => t.name === `${this.tracker.name}.position`);
      const rot = clip.tracks.find((t) => t.name === `${this.tracker.name}.quaternion`);
      if (!pos || !rot) return false;
      // createInterpolant is installed per track at runtime (it honours the track's own interpolation, e.g. glTF
      // cubic spline); the three.js typings do not declare it.
      type WithInterpolant = { createInterpolant(): THREE.Interpolant };
      const interp = (t: THREE.KeyframeTrack) => (t as unknown as WithInterpolant).createInterpolant();
      entry = { duration: clip.duration, pos: interp(pos), rot: interp(rot) };
      this.samplers.set(name, entry);
    }
    const t = Math.min(Math.max(entry.duration * progress - 1e-6, 0), entry.duration);
    const p = entry.pos.evaluate(t);
    const q = entry.rot.evaluate(t);
    outPos.set(p[0], p[1], p[2]);
    outQuat.set(q[0], q[1], q[2], q[3]).normalize();
    return true;
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.tracker);
  }
}
