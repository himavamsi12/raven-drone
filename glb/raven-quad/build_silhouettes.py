"""Raven silhouettes for the loader, sync flock and Raven Ops scenes (replaces the delta-jet silhouettes).

  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
      --python glb/raven-quad/build_silhouettes.py

Writes (uncompressed; Draco is applied afterwards, geometry only):
  glb/raven-quad/silhouettes/drone-lowpoly.glb  nodes `mainBody` + `outlineHull`, same node/axis convention as
                                                delta-lowpoly.glb (node rotated 180 deg about Z; after it: nose -Z, up +Y)
  glb/raven-quad/silhouettes/loading-drone.glb  decimated Raven coaxial quad, world nose -Z / up +Y, like loading-delta
  glb/raven-quad/silhouettes/boot-shape.json    SVG path traced from the loader's desktop camera (viewBox 1320x666)
  glb/raven-quad/silhouettes/jet-check.json     same tracer on loading-delta.glb, to validate against the shipped path
"""
import bpy, bmesh, json, math, os
import numpy as np
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'glb', 'raven-quad', 'silhouettes')
os.makedirs(OUT, exist_ok=True)
S = 1.1                       # jet parity: drone half-span 1.16 m * 1.1 ~ jet 1.29
C4 = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # three/glTF (Y up) -> Blender (Z up)


def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)


def link(o):
    bpy.context.scene.collection.objects.link(o)
    return o

# ---------------------------------------------------------------- low-poly flock / ops drone


def box(bm, size, center, bevel=0.0):
    geom = bmesh.ops.create_cube(bm, size=1.0)['verts']
    for v in geom:
        v.co = Vector((v.co.x * size[0] + center[0], v.co.y * size[1] + center[1], v.co.z * size[2] + center[2]))
    if bevel:
        edges = list({e for v in geom for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=1, profile=0.5, affect='EDGES', clamp_overlap=True)


def lathe(bm, profile, segs, center):
    rings = []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((center[0], center[1], center[2] + z))])
        else:
            rings.append([bm.verts.new((center[0] + r * math.cos(2 * math.pi * k / segs), center[1] + r * math.sin(2 * math.pi * k / segs), center[2] + z))
                          for k in range(segs)])
    for a, b in zip(rings, rings[1:]):
        n = max(len(a), len(b))
        for k in range(n):
            if len(a) == 1:
                bm.faces.new((a[0], b[k], b[(k + 1) % n]))
            elif len(b) == 1:
                bm.faces.new((a[k], b[0], a[(k + 1) % n]))
            else:
                bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    if len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if len(rings[-1]) > 1:
        bm.faces.new(rings[-1])


def rod(bm, a, b, r, segs=8):
    a, b = Vector(a), Vector(b)
    d = (b - a)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    ring = lambda c: [bm.verts.new(c + q @ Vector((r * math.cos(2 * math.pi * k / segs), r * math.sin(2 * math.pi * k / segs), 0))) for k in range(segs)]
    ra, rb = ring(a), ring(b)
    for k in range(segs):
        bm.faces.new((ra[k], ra[(k + 1) % segs], rb[(k + 1) % segs], rb[k]))
    bm.faces.new(list(reversed(ra)))
    bm.faces.new(rb)


def lowpoly_parts():
    """Closed parts in Blender axes with the nose on +Y (= glTF -Z) and up +Z; unscaled metres."""
    parts = []
    def part():
        bm = bmesh.new(); parts.append(bm); return bm
    box(part(), (0.58, 0.90, 0.22), (0, 0.0, 0.045), 0.035)          # shell + deck
    box(part(), (0.44, 0.22, 0.08), (0, -0.05, 0.17), 0.02)           # raised battery packs
    box(part(), (0.48, 0.46, 0.34), (0, 0, -0.32), 0.025)             # cargo case
    for sx in (1, -1):                                                # landing frame
        box(part(), (0.04, 0.84, 0.04), (sx * 0.33, 0, -0.62))
        for sy in (1, -1):
            rod(part(), (sx * 0.22, sy * 0.27, -0.09), (sx * 0.33, sy * 0.27, -0.62), 0.02, 6)
    for sx in (1, -1):
        for sy in (1, -1):
            m = Vector((sx * 0.76, sy * 0.63, 0.03))
            rod(part(), (sx * 0.27, sy * 0.22, 0.03), m, 0.04, 8)       # arm
            lathe(part(), [(0, -0.12), (0.07, -0.11), (0.093, -0.03), (0.093, 0.06), (0.07, 0.13), (0, 0.14)], 10, m)   # coaxial pod
            for z in (0.205, -0.145):                                   # upper / lower rotor discs (relative to pod centre)
                lathe(part(), [(0, -0.007), (0.40, -0.007), (0.40, 0.007), (0, 0.007)], 24, (m.x, m.y, m.z + z))
    return parts


def to_object(name, bms, inflate=0.0):
    out = bmesh.new()
    for bm in bms:
        bm.normal_update()
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        if inflate:
            bm.normal_update()
            for v in bm.verts:
                v.co += v.normal * inflate
        me = bpy.data.meshes.new('tmp')
        bm.to_mesh(me)
        out.from_mesh(me)
        bpy.data.meshes.remove(me)
    for v in out.verts:
        v.co *= S
    # Node carries a 180 deg turn about glTF Z (= Blender Y); store the counter-rotated geometry like the jet.
    bmesh.ops.rotate(out, verts=out.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi, 3, 'Y'))
    uv = out.loops.layers.uv.new('UVMap')
    for f in out.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x * 0.5 + 0.5, l.vert.co.y * 0.5 + 0.5)
    me = bpy.data.meshes.new(name)
    out.to_mesh(me)
    out.free()
    o = link(bpy.data.objects.new(name, me))
    o.rotation_mode = 'XYZ'
    o.rotation_euler = (0, math.pi, 0)
    return o


def build_lowpoly():
    reset()
    body = to_object('mainBody', lowpoly_parts())
    hull = to_object('outlineHull', lowpoly_parts(), inflate=0.045)
    for o in (body, hull):
        o.data.materials.append(bpy.data.materials.new('silhouette'))
    path = os.path.join(OUT, 'drone-lowpoly.glb')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
                              export_animations=False, export_cameras=False, export_lights=False,
                              export_draco_mesh_compression_enable=False)
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    print('RQ_SIL lowpoly', path, 'mainBody tris', tris, 'hull tris', sum(len(p.vertices) - 2 for p in hull.data.polygons))

# ---------------------------------------------------------------- loader drone (decimated real model)


def build_loader(scale):
    reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'glb', 'raven-quad', 'raven-quad-textured.glb'))
    for name, ang in {'Front_Left': 25, 'Front_Right': -35, 'Rear_Left': 70, 'Rear_Right': -10}.items():  # blades read as blades
        for level, extra in (('Upper', 0), ('Lower', 75)):
            o = bpy.data.objects[f'Rotor_{name}_{level}']
            o.rotation_mode = 'XYZ'
            o.rotation_euler.z += math.radians(ang + extra)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
        me = o.evaluated_get(dg).to_mesh()
        me.transform(o.matrix_world)
        bm.from_mesh(me)
        o.evaluated_get(dg).to_mesh_clear()
    # Raven imports nose -Y (glTF +Z); the loader expects the jet's world frame: nose glTF -Z = Blender +Y.
    bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi, 3, 'Z'))
    zs = [v.co.z for v in bm.verts]
    for v in bm.verts:
        v.co.z -= (max(zs) + min(zs)) / 2                               # vertically centred like the jet
        v.co *= scale
    for layer in list(bm.loops.layers.uv.values()):
        bm.loops.layers.uv.remove(layer)
    reset()
    me = bpy.data.meshes.new('RavenSilhouette')
    bm.to_mesh(me)
    bm.free()
    me.materials.clear()
    o = link(bpy.data.objects.new('RavenSilhouette', me))
    dec = o.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = 0.22
    dg = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = baked
    o.data.materials.append(bpy.data.materials.new('silhouette'))
    path = os.path.join(OUT, 'loading-drone.glb')
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
                              export_texcoords=False, export_animations=False, export_cameras=False, export_lights=False,
                              export_draco_mesh_compression_enable=False)
    print('RQ_SIL loader', path, 'tris', sum(len(p.vertices) - 2 for p in o.data.polygons))

# ---------------------------------------------------------------- boot SVG path from the loader camera


def three_matrix(pos, rot, scale=1.0):
    r = Matrix.Rotation(rot[0], 4, 'X') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[2], 4, 'Z')  # three Euler 'XYZ'
    return Matrix.Translation(pos) @ r @ Matrix.Diagonal((scale, scale, scale, 1))


H = round(666 / 0.3325)    # viewport height (px) at which the shipped boot SVG box is exactly 1320 x 666
W = 2 * H                  # any width: three's fov is vertical and the view stays centred
SHIPPED_BOX = (W / 2 - 0.0983 * H - 660, H / 2 - 0.0067 * H - 333, 1320, 666)   # h 33.25vh, -9.83vh / -0.67vh


def render_mask(glb, ss=2, box=None):
    """Mask of the loader object exactly where Loader.tsx draws it (desktop camera, fov 20, scale 0.75).
    box = (x0, y0, w, h) in viewport px at height H crops the render; None renders the whole viewport."""
    reset()
    bpy.ops.import_scene.gltf(filepath=glb)
    parent = link(bpy.data.objects.new('loader', None))
    for o in list(bpy.context.scene.objects):
        if o.parent is None and o != parent:
            o.parent = parent
    parent.matrix_world = C4 @ three_matrix((-0.005623, 0.00259, 0.022765), (-3.141362, 2e-6, -3.130472), 0.75) @ C4.inverted()
    cam = link(bpy.data.objects.new('cam', bpy.data.cameras.new('cam')))
    cam.matrix_world = C4 @ three_matrix((-3.152446, 3.910685, 5.033364), (-0.660528, -0.459299, -0.311193))
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.angle_y = math.radians(20)
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = round(W * ss), round(H * ss), 100
    if box:
        x0, y0, bw, bh = box
        sc.render.use_border, sc.render.use_crop_to_border = True, True
        sc.render.border_min_x, sc.render.border_max_x = x0 / W, (x0 + bw) / W
        sc.render.border_max_y, sc.render.border_min_y = 1 - y0 / H, 1 - (y0 + bh) / H
    else:
        sc.render.use_border = False
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'FLAT'
    sc.display.shading.color_type = 'SINGLE'
    sc.display.shading.single_color = (1, 1, 1)
    sc.render.film_transparent = True
    sc.display.render_aa = 'OFF'
    path = os.path.join(OUT, 'mask.png')
    sc.render.filepath = path
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    mask = px.reshape(h, w, 4)[::-1, :, 3] > 0.5          # top row first
    bpy.data.images.remove(img)
    os.remove(path)
    return mask, ss


def trace(mask, ss, min_area=60):
    """Chain inside/outside pixel edges into closed loops (inside on the left), then Douglas-Peucker."""
    h, w = mask.shape
    m = np.zeros((h + 2, w + 2), bool)
    m[1:-1, 1:-1] = mask
    nxt = {}
    # horizontal edges between row y-1 and y; vertical edges between column x-1 and x (padded coords)
    ys, xs = np.nonzero(m[1:, :] & ~m[:-1, :])      # inside below -> edge runs +x
    for y, x in zip(ys + 1, xs):
        nxt.setdefault((x, y), []).append((x + 1, y))
    ys, xs = np.nonzero(~m[1:, :] & m[:-1, :])      # inside above -> edge runs -x
    for y, x in zip(ys + 1, xs):
        nxt.setdefault((x + 1, y), []).append((x, y))
    ys, xs = np.nonzero(m[:, 1:] & ~m[:, :-1])      # inside right -> edge runs -y
    for y, x in zip(ys, xs + 1):
        nxt.setdefault((x, y + 1), []).append((x, y))
    ys, xs = np.nonzero(~m[:, 1:] & m[:, :-1])      # inside left -> edge runs +y
    for y, x in zip(ys, xs + 1):
        nxt.setdefault((x, y), []).append((x, y + 1))
    loops = []
    while nxt:
        start = next(iter(nxt))
        loop, cur, prev = [start], start, None
        while True:
            outs = nxt[cur]
            if len(outs) > 1 and prev is not None:   # saddle: keep the turn that hugs the same region
                d = (cur[0] - prev[0], cur[1] - prev[1])
                outs.sort(key=lambda p: (d[0] * (p[1] - cur[1]) - d[1] * (p[0] - cur[0])))
            n = outs.pop(0)
            if not outs:
                del nxt[cur]
            prev, cur = cur, n
            if cur == start:
                break
            loop.append(cur)
        loops.append(loop)

    def area(l):
        return 0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(l, l[1:] + l[:1]))

    def dp(pts, eps):
        if len(pts) < 3:
            return pts
        a, b = np.array(pts[0], float), np.array(pts[-1], float)
        ab = b - a
        L = np.hypot(*ab) or 1e-9
        P = np.array(pts, float)
        d = np.abs(ab[0] * (P[:, 1] - a[1]) - ab[1] * (P[:, 0] - a[0])) / L
        i = int(d.argmax())
        if d[i] > eps:
            return dp(pts[:i + 1], eps)[:-1] + dp(pts[i:], eps)
        return [pts[0], pts[-1]]
    subpaths, length = [], 0.0
    for l in loops:
        if abs(area(l)) < min_area * ss * ss:
            continue
        # split at the farthest point so DP works on two open chains
        far = max(range(len(l)), key=lambda i: (l[i][0] - l[0][0]) ** 2 + (l[i][1] - l[0][1]) ** 2)
        pts = dp(l[:far + 1], 1.1 * ss)[:-1] + dp(l[far:] + [l[0]], 1.1 * ss)[:-1]
        pts = [((x - 1) / ss, (y - 1) / ss) for x, y in pts]
        length += sum(math.dist(a, b) for a, b in zip(pts, pts[1:] + pts[:1]))
        subpaths.append('M ' + ' L '.join(f'{x:.1f} {y:.1f}' for x, y in pts) + ' Z')
    xs = [float(t) for sp in subpaths for t in sp.replace('M', '').replace('L', '').replace('Z', '').split()][0::2]
    ys = [float(t) for sp in subpaths for t in sp.replace('M', '').replace('L', '').replace('Z', '').split()][1::2]
    return {'d': ' '.join(subpaths), 'length': round(length, 1), 'loops': len(subpaths),
            'bbox': [min(xs), min(ys), max(xs), max(ys)]}


def bbox(mask, ss):
    ys, xs = np.nonzero(mask)
    return xs.min() / ss, ys.min() / ss, (xs.max() + 1) / ss, (ys.max() + 1) / ss


build_lowpoly()
# Validation: the tracer must reproduce the shipped jet path inside the shipped box.
mask, ss = render_mask(os.path.join(ROOT, 'public', 'assets', 'models', 'loading-delta.glb'), 2, SHIPPED_BOX)
jet = trace(mask, ss)
json.dump(jet, open(os.path.join(OUT, 'jet-check.json'), 'w'))
print('RQ_SIL jet-check loops', jet['loops'], 'length', jet['length'], 'bbox', jet['bbox'])
# Size the loader drone to the jet's on-screen footprint (equal bbox area), then fit a new SVG box around it.
jx0, jy0, jx1, jy1 = bbox(*render_mask(os.path.join(ROOT, 'public', 'assets', 'models', 'loading-delta.glb'), 0.5))
build_loader(S)
dx0, dy0, dx1, dy1 = bbox(*render_mask(os.path.join(OUT, 'loading-drone.glb'), 0.5))
k = math.sqrt(((jx1 - jx0) * (jy1 - jy0)) / ((dx1 - dx0) * (dy1 - dy0)))
build_loader(S * k)
mask, ss = render_mask(os.path.join(OUT, 'loading-drone.glb'), 1)
x0, y0, x1, y1 = bbox(mask, ss)
box = (math.floor(x0) - 2, math.floor(y0) - 2, math.ceil(x1 - x0) + 4, math.ceil(y1 - y0) + 4)
mask, ss = render_mask(os.path.join(OUT, 'loading-drone.glb'), 2, box)
res = trace(mask, ss)
res.update(viewBox=[box[2], box[3]], scale=round(S * k, 4),
           css={'heightVh': round(100 * box[3] / H, 2), 'translateXVh': round(100 * (box[0] + box[2] / 2 - W / 2) / H, 2),
                'translateYVh': round(100 * (box[1] + box[3] / 2 - H / 2) / H, 2)},
           jetViewport=[jx0, jy0, jx1, jy1])
json.dump(res, open(os.path.join(OUT, 'boot-shape.json'), 'w'))
print('RQ_SIL boot-shape loops', res['loops'], 'length', res['length'], 'viewBox', res['viewBox'], 'css', res['css'], 'scale', res['scale'],
      'jet viewport bbox', [round(v) for v in (jx0, jy0, jx1, jy1)], 'drone', [round(v) for v in (x0, y0, x1, y1)])
