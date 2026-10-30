"""Validate the exported Raven terrain GLB as decoded (Draco + WebP), headless:

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python glb/raven-terrain/check_terrain.py -- \
      public/assets/models/raven-terrain.glb [report.json]

Checks the runtime contract Terrain.tsx relies on and the seam/placement properties that are easy to break:
node names + identity transforms, attributes, triangle budget, footprint/envelope, one rim height on every edge,
planar UVs, periodic texture edges, houses clear of the seam strip and seated in the ground.
Also samples the decoded ground under the 34 DetectionPoints anchors (glTF tile-local x/z) for DetectionPoints.tsx.
Exit code 1 on any failed check.
"""
import bpy, bmesh, json, struct, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PATH = argv[0] if argv else 'public/assets/models/raven-terrain.glb'
REPORT = argv[1] if len(argv) > 1 else None

# DetectionPoints.tsx POINTS (glTF tile-local x, y, z); only x/z are used here.
DETECTION_XZ = [
    (-182.2743, -195.5112), (-32.062, -123.1434), (-6.3289, -171.9805), (68.3493, -126.7537), (179.2427, -173.0501),
    (125.5761, -57.8208), (64.5723, -64.839), (-99.9169, -159.1456), (-69.8519, -79.9549), (-176.3916, -36.679),
    (-50.4171, 17.2192), (9.4389, -7.9998), (-99.0042, 51.2302), (141.9201, 12.8108), (136.9131, 94.4187),
    (72.1303, 47.9911), (44.0578, 84.1614), (-40.6997, 83.6216), (-95.2252, 123.0311), (-155.1492, 84.7013),
    (-4.1252, -42.9317), (-111.9607, -10.3134), (-155.1492, -106.4079), (9.7148, -93.9014), (87.2463, -181.9878),
    (144.4711, -104.2485), (185.6602, -44.7009), (192.0777, 41.4001), (193.0582, 117.6326), (-159.2784, 153.1709),
    (138.819, 174.1206), (68.0067, 145.6838), (-37.8814, 197.5583), (-1.83, 139.2268),
]

results, failures = {}, []


def check(name, ok, detail):
    results[name] = {'ok': bool(ok), 'detail': detail}
    if not ok:
        failures.append(name)
    print(('PASS ' if ok else 'FAIL ') + name + ': ' + json.dumps(detail))


# --- glTF JSON (what three.js sees before decoding)
raw = open(PATH, 'rb').read()
jlen = struct.unpack('<I', raw[12:16])[0]
gj = json.loads(raw[20:20 + jlen])
nodes = {n.get('name'): n for n in gj['nodes']}
check('file size', len(raw) < 3_000_000, {'bytes': len(raw)})
check('node names', set(nodes) == {'Land-A', 'Houses'}, sorted(nodes))
check('identity node transforms', all(not any(k in n for k in ('translation', 'rotation', 'scale', 'matrix'))
                                      for n in gj['nodes']), [n.get('name') for n in gj['nodes']])
attrs = {gj['meshes'][n['mesh']]['name']: sorted(gj['meshes'][n['mesh']]['primitives'][0]['attributes'])
         for n in gj['nodes']}
check('attributes', all(a == ['NORMAL', 'POSITION', 'TEXCOORD_0'] for a in attrs.values()), attrs)
check('no cameras/lights/animations', not any(k in gj for k in ('cameras', 'animations'))
      and 'KHR_lights_punctual' not in gj.get('extensionsUsed', []), gj.get('extensionsUsed'))
imgs = [(im.get('name'), im.get('mimeType')) for im in gj.get('images', [])]
check('images', len(imgs) == 2 and all(m == 'image/webp' for _, m in imgs), imgs)

# --- decode
bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.gltf(filepath=PATH)
land = next(o for o in bpy.data.objects if o.name.startswith('Land-A'))
houses = next(o for o in bpy.data.objects if o.name.startswith('Houses'))
me = land.data
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)  # Blender: x, -z, y
tris = sum(len(p.vertices) - 2 for p in me.polygons)
check('Land-A budget', 15000 <= tris <= 26000, {'tris': tris, 'verts': len(me.vertices)})
check('footprint', np.allclose([co[:, 0].min(), co[:, 0].max(), co[:, 1].min(), co[:, 1].max()],
                               [-200, 200, -200, 200], atol=1e-3),
      [round(float(v), 4) for v in (co[:, 0].min(), co[:, 0].max(), co[:, 1].min(), co[:, 1].max())])
check('relief envelope (shipped -7.68..17.33)', co[:, 2].min() >= -7.8 and co[:, 2].max() <= 17.4,
      [round(float(co[:, 2].min()), 3), round(float(co[:, 2].max()), 3)])
rim = co[np.max(np.abs(co[:, :2]), 1) > 199.999]
edges = {k: int(m.sum()) for k, m in (('x-', co[:, 0] < -199.999), ('x+', co[:, 0] > 199.999),
                                       ('z+', co[:, 1] < -199.999), ('z-', co[:, 1] > 199.999))}
spread = float(rim[:, 2].max() - rim[:, 2].min())
check('one rim height on every edge', spread < 1e-4 and abs(float(rim[:, 2].mean()) - 2.189) < 0.02 and min(edges.values()) >= 2,
      {'rim_y': round(float(rim[:, 2].mean()), 6), 'spread': spread, 'verts_per_edge': edges})
uv = np.empty(len(me.loops) * 2); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
vi = np.empty(len(me.loops), dtype=np.int64); me.loops.foreach_get('vertex_index', vi); p = co[vi]
uv_err = max(np.abs(uv[:, 0] - (p[:, 0] + 200) / 400).max(), np.abs(uv[:, 1] - (p[:, 1] + 200) / 400).max())
check('planar UV (texels at 2048)', uv_err * 2048 < 1.0, round(float(uv_err * 2048), 3))

# periodic texture edges
tex = next(n.image for n in land.material_slots[0].material.node_tree.nodes if n.type == 'TEX_IMAGE')
W, H = tex.size
px = np.empty(W * H * 4, dtype=np.float32); tex.pixels.foreach_get(px); px = px.reshape(H, W, 4)[:, :, :3]
lr = float(np.abs(px[:, 0] - px[:, -1]).mean()); tb = float(np.abs(px[0] - px[-1]).mean())
inner = float(np.abs(px[:, W // 2] - px[:, W // 2 + 1]).mean())
check('texture edges periodic', lr <= inner + 2 / 255 and tb <= inner + 2 / 255,
      {'size': [W, H], 'left_right': round(lr, 4), 'top_bottom': round(tb, 4), 'adjacent_columns': round(inner, 4)})

# houses: clear of the seam strip, plinths reach below the ground
bm = bmesh.new(); bm.from_mesh(me); bvh = BVHTree.FromBMesh(bm)
ground = lambda x, y: bvh.ray_cast(Vector((x, y, 100)), Vector((0, 0, -1)))[0].z
hb = bmesh.new(); hb.from_mesh(houses.data); hb.verts.ensure_lookup_table()
seen, islands = set(), []
for v in hb.verts:
    if v in seen:
        continue
    stack, comp = [v], []
    while stack:
        x = stack.pop()
        if x in seen:
            continue
        seen.add(x); comp.append(x.co.copy())
        stack += [e.other_vert(x) for e in x.link_edges]
    islands.append(comp)
# each house is several unconnected shells (plinth sides, walls, gables, roof slabs): union shells whose xy bounds
# overlap; houses stand >= 6.5 apart, so neighbours never merge
boxes = [(min(v.x for v in c) - 0.05, max(v.x for v in c) + 0.05, min(v.y for v in c) - 0.05, max(v.y for v in c) + 0.05)
         for c in islands]
parent = list(range(len(islands)))
def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]; i = parent[i]
    return i
for i in range(len(boxes)):
    for j in range(i + 1, len(boxes)):
        a_, b_ = boxes[i], boxes[j]
        if a_[0] <= b_[1] and b_[0] <= a_[1] and a_[2] <= b_[3] and b_[2] <= a_[3]:
            parent[find(i)] = find(j)
centres = {}
for i, comp in enumerate(islands):
    centres.setdefault(find(i), []).extend(comp)
margin = min(200 - max(abs(v.x), abs(v.y)) for comp in islands for v in comp)
floating = []
for key, verts in centres.items():
    zmin = min(v.z for v in verts)
    low = [v for v in verts if v.z < zmin + 1e-3]
    worst = max(zmin - ground(v.x, v.y) for v in low)
    if worst > 0.01:
        floating.append({'house': [round(verts[0].x, 1), round(verts[0].y, 1)], 'gap': round(worst, 3)})
check('houses clear of seam strip (>= 32)', margin >= 32, round(margin, 2))
check('houses seated (plinth below ground)', not floating, {'houses': len(centres), 'floating': floating})

# detection anchors: decoded ground height (glTF y) under each point
det = [round(ground(x, -z), 4) for x, z in DETECTION_XZ]
results['detection_ground_y'] = det
print('DETECTION_GROUND_Y', json.dumps(det))

if REPORT:
    json.dump({'file': PATH, 'bytes': len(raw), 'results': results, 'failures': failures}, open(REPORT, 'w'), indent=2)
print('RESULT', 'FAIL ' + ', '.join(failures) if failures else 'PASS')
sys.exit(1 if failures else 0)
