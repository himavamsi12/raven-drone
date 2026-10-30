// Prepares glb/new-drone/Hexa_Medical_Drone_Black.glb for the site (geometry/material data untouched):
//  - drops the six KHR_lights_punctual nav lights (the scene lights the drone; 6 point lights x every instance is too costly)
//  - renames the six prop nodes to the rotor contract `Rotor_<Front|Mid|Rear>_<Left|Right>` with `spin_direction`
//    extras taken from the source's own prop animations (then drops those clips: the site spins rotors in code)
//  - recentres the root so the prop ring sits on the tracker origin (source origin is on the ground, off-centre)
// Usage: node glb/new-drone/prepare_hexa.mjs <gltf-transform node_modules dir> <in.glb> <out.glb>
// Then: webp --lossless --effort 100, draco 16/12/16 (see glb/new-drone/README.md).
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [mods, input, output] = process.argv.slice(2);
const load = (p) => import(pathToFileURL(join(mods, p)).href);
const { NodeIO } = await load('@gltf-transform/core/dist/index.js');
const { ALL_EXTENSIONS, KHRLightsPunctual } = await load('@gltf-transform/extensions/dist/index.js');
const { getBounds } = await load('@gltf-transform/core/dist/index.js');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const root = doc.getRoot();

// Spin direction from each prop clip's yaw delta: negative turn about +Y = CW viewed from above.
const yaw = (q) => 2 * Math.atan2(q[1], q[3]);
const spin = new Map();
for (const anim of root.listAnimations()) {
  for (const channel of anim.listChannels()) {
    if (channel.getTargetPath() !== 'rotation') continue;
    const out = channel.getSampler().getOutput();
    const a = yaw(out.getElement(0, [])), b = yaw(out.getElement(1, []));
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    spin.set(channel.getTargetNode().getName(), d < 0 ? 'CW' : 'CCW');
  }
  anim.dispose();
}

for (const node of root.listNodes()) {
  const m = node.getName().match(/^Hexa_Prop_(Front|Mid|Rear)_(Left|Right)$/);
  if (!m) continue;
  const dir = spin.get(node.getName());
  if (!dir) throw new Error(`no spin clip for ${node.getName()}`);
  node.setName(`Rotor_${m[1]}_${m[2]}`).setExtras({ ...node.getExtras(), spin_direction: dir });
}

// Nav lights: remove the light nodes and the extension (it was marked required).
for (const node of root.listNodes()) if (node.getExtension('KHR_lights_punctual')) node.dispose();
doc.createExtension(KHRLightsPunctual).dispose();

// Recentre: prop ring centre on X/Z, bounding-box middle on Y.
const scene = root.listScenes()[0];
const top = scene.listChildren()[0];
const rotors = root.listNodes().filter((n) => n.getName().startsWith('Rotor_'));
const ring = rotors.reduce((s, n) => { const p = n.getWorldTranslation(); return [s[0] + p[0] / 6, s[1] + p[1] / 6, s[2] + p[2] / 6]; }, [0, 0, 0]);
const box = getBounds(scene);
const midY = (box.min[1] + box.max[1]) / 2;
const t = top.getTranslation();
top.setTranslation([t[0] - ring[0], t[1] - midY, t[2] - ring[2]]);

await io.write(output, doc);
for (const n of rotors) console.log(n.getName(), n.getExtras().spin_direction, n.getWorldTranslation().map((v) => v.toFixed(4)).join(','));
