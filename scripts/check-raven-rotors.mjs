// Regression: Raven coaxial quad must expose exactly eight rotor pivots (4 CW / 4 CCW): one upper and one
// lower pivot per arm on the same shaft axis, counter-rotating.
// Material-split Propeller_* children must never be selected; only the pivots may change.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { collectRavenRotors, advanceRavenRotors } from '../src/components/scene/raven-rotors.ts';

const SOURCE = 'glb/raven-quad/raven-quad-textured.glb';
const WEB = 'public/assets/models/raven_quad.glb';
const readJson = (file) => { const b = readFileSync(file); return [b, JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)))]; };

const [file, json] = readJson(SOURCE);
const jsonSize = file.readUInt32LE(12);
// Texture decoding is browser-specific; retain scene/geometry/transforms for this motion check.
json.materials = [{ name: 'motion-test' }]; delete json.images; delete json.textures; delete json.samplers;
for (const mesh of json.meshes) for (const primitive of mesh.primitives) primitive.material = 0;
let text = Buffer.from(JSON.stringify(json)); text = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 32)]);
const binary = file.subarray(20 + jsonSize); const header = Buffer.alloc(20);
header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + text.length + binary.length, 8); header.writeUInt32LE(text.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const glb = Buffer.concat([header, text, binary]);
const { scene } = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.length), '');
scene.updateMatrixWorld(true);

const rotors = collectRavenRotors(scene);
assert.equal(rotors.length, 8, 'eight rotor pivots');
let mid = 0; scene.traverse((o) => { if (/Mid/.test(o.name)) mid++; }); assert.equal(mid, 0, 'no middle rotors');
// Upper-prop direction per station (viewed from above, CW = -1); lower props turn the other way.
const expected = { Front_Left: [0.76, 0.63, -1], Front_Right: [-0.76, 0.63, 1], Rear_Left: [0.76, -0.63, 1], Rear_Right: [-0.76, -0.63, -1] };
const LEVEL = { Upper: [0.235, 1], Lower: [-0.175, -1] };
for (const { object, direction } of rotors) {
  const [, station, level] = object.name.match(/^Rotor_(.+)_(Upper|Lower)$/);
  const [x, z, dir] = expected[station];
  const [y, flip] = LEVEL[level];
  const p = object.getWorldPosition(new THREE.Vector3());
  assert(Math.abs(p.x - x) < 1e-4 && Math.abs(p.y - y) < 1e-4 && Math.abs(p.z - z) < 1e-4, `${object.name} pivot at shaft ${p.toArray()}`);
  assert.equal(direction, dir * flip, `${object.name} spin direction`);
  assert(object.quaternion.equals(new THREE.Quaternion()), `${object.name} rest rotation is identity`);
  // Blades must be centred on the pivot (no orbiting): bounds centre on the shaft in XZ.
  const box = new THREE.Box3().setFromObject(object); const c = box.getCenter(new THREE.Vector3());
  assert(Math.hypot(c.x - p.x, c.z - p.z) < 0.01, `${object.name} geometry centred on shaft`);
  let meshes = 0; object.traverse((o) => { if (o.isMesh) meshes++; }); assert(meshes > 0, `${object.name} carries propeller geometry`);
}
assert.equal(rotors.filter((r) => r.direction === 1).length, 4); assert.equal(rotors.filter((r) => r.direction === -1).length, 4);

const pivotSet = new Set(rotors.map((r) => r.object)); const before = new Map(); scene.traverse((o) => before.set(o, o.quaternion.clone()));
const centres = rotors.map((r) => new THREE.Box3().setFromObject(r.object).getCenter(new THREE.Vector3()));
advanceRavenRotors(rotors, 1 / 60); scene.updateMatrixWorld(true);
scene.traverse((o) => assert.equal(!o.quaternion.equals(before.get(o)), pivotSet.has(o), o.name));
rotors.forEach((r, i) => { const c = new THREE.Box3().setFromObject(r.object).getCenter(new THREE.Vector3()); assert(c.distanceTo(centres[i]) < 0.01, 'no off-centre orbit'); });
const clone = scene.clone(true); const cloneRotors = collectRavenRotors(clone); const original = rotors.map((r) => r.object.quaternion.clone());
advanceRavenRotors(cloneRotors, 1 / 60); rotors.forEach((r, i) => assert(r.object.quaternion.equals(original[i]), 'instances must be independent'));

// Compressed web derivative must keep the same pivot names, hierarchy and metadata.
try {
  const [, web] = readJson(WEB);
  const pivots = (j) => j.nodes.filter((n) => /^Rotor_/.test(n.name)).map((n) => [n.name, n.extras?.spin_direction, (n.children ?? []).map((c) => j.nodes[c].name).join()].join(':')).sort();
  assert.deepEqual(pivots(web), pivots(json), 'web asset pivots');
  console.log('PASS: web derivative keeps eight pivots', web.extensionsUsed.join(','));
} catch (e) { if (e.code !== 'ENOENT') throw e; console.log('SKIP: web derivative not built yet'); }
console.log('PASS: eight coaxial Raven pivots on four shaft axes, four CW/four CCW, pairs counter-rotate; children unchanged; instances independent.');
