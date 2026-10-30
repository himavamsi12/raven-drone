"""Raven terrain 02: generic village houses for the natural tile (tile-local units, Z-up).

Needs 01_terrain.py loaded in the same namespace (POCKETS, SPURS, road_x, HALF) and `RT_Natural_Hi`.
Houses are grounded by raycasting the source mesh; each sits on a stone plinth that reaches below the
lowest footprint corner so no gap shows on slopes. Long axis follows the contour.
One merged mesh `RT_Natural_Houses`, material slots: 0 stone, 1 timber, 2 roof (roof tint in vertex colour).
Seeded and deterministic. Keeps every house >= 40 units from the tile edge (seam strip stays clear).
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOF_TINTS = [(0.20, 0.21, 0.23), (0.27, 0.28, 0.30), (0.16, 0.17, 0.18), (0.22, 0.30, 0.31), (0.34, 0.22, 0.17)]
ROOF_WEIGHTS = [5, 4, 3, 1, 1]  # mostly slate; a few restrained metal roofs (R05)


def build_houses(g):
    rng = random.Random(1407)
    src = bpy.data.objects['RT_Natural_Hi']
    bm_src = bmesh.new(); bm_src.from_mesh(src.data)
    bvh = BVHTree.FromBMesh(bm_src)

    def ground(x, y):
        hit = bvh.ray_cast(Vector((x, y, 100.0)), Vector((0, 0, -1)))
        return hit[0].z if hit[0] else None

    def slope(x, y, e=1.5):
        zx = (ground(x + e, y) - ground(x - e, y)) / (2 * e)
        zy = (ground(x, y + e) - ground(x, y - e)) / (2 * e)
        return Vector((zx, zy))

    def near_road(x, y):
        if abs(x - g['road_x'](y)) < 6:
            return True
        return g['spur_info'](Vector((x, y, 0)))[0] < 3.2

    sites = []
    def try_site(x, y, min_gap):
        if g['HALF'] - max(abs(x), abs(y)) < 40 or near_road(x, y):
            return False
        if any((Vector((x, y)) - s[0]).length < min_gap for s in sites):
            return False
        gr = slope(x, y)
        if gr.length > 0.35:
            return False
        sites.append((Vector((x, y)), gr))
        return True

    counts = [9, 7, 5]
    for pk, want in zip(g['POCKETS'], counts):
        px, py, r, base, step = pk
        n = 0
        for k in range(400):
            if n >= want:
                break
            a = k * 2.399963  # golden-angle spiral
            d = r * 0.85 * math.sqrt((k + 0.5) / 60.0)
            if d > r * 0.85:
                break
            x, y = px + d * math.cos(a) * g['ACROSS'], py + d * math.sin(a)
            if g['pocket_d'](x, y, pk) < r * 0.8 and try_site(x, y, 6.5):
                n += 1
    # sparse farmsteads beside the valley road
    for y in (-150.0, -10.0, 120.0, 160.0):
        side = 1 if int(y) % 2 == 0 else -1
        for off in (10.0, 13.0, 16.0):
            if try_site(g['road_x'](y) + side * off, y, 6.5):
                break

    me = bpy.data.meshes.new('RT_Natural_Houses')
    bm = bmesh.new()
    col = bm.loops.layers.color.new('Col')
    roof_tints = [t for t, w in zip(ROOF_TINTS, ROOF_WEIGHTS) for _ in range(w)]
    done = set()

    def quad(vs, mat, tint=(1, 1, 1)):
        f = bm.faces.new(vs); f.material_index = mat
        for l in f.loops:
            l[col] = (*tint, 1.0)
        return f

    for (p, gr) in sites:
        L = rng.uniform(3.0, 4.4); W = rng.uniform(2.1, 2.8)
        wall = rng.uniform(1.0, 1.5); plinth = 0.45; pitch = rng.uniform(0.75, 1.05); over = 0.28
        # long axis along the contour: perpendicular to the gradient
        ang = math.atan2(gr.y, gr.x) + math.pi / 2 if gr.length > 0.02 else rng.uniform(0, math.pi)
        R = Matrix.Rotation(ang, 3, 'Z')
        corners = [R @ Vector((sx * L / 2, sy * W / 2, 0)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        zs = [ground(p.x + c.x, p.y + c.y) for c in corners]
        floor = max(zs) + 0.05
        low = min(zs) - 0.35
        tint = rng.choice(roof_tints)

        def V(x, y, z):
            c = R @ Vector((x, y, 0))
            return bm.verts.new((p.x + c.x, p.y + c.y, z))

        def box(x0, x1, y0, y1, z0, z1, mat):
            b = [V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0)]
            t = [V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1)]
            for i in range(4):
                quad([b[i], b[(i + 1) % 4], t[(i + 1) % 4], t[i]], mat)
            return t

        hx, hy = L / 2, W / 2
        box(-hx - 0.08, hx + 0.08, -hy - 0.08, hy + 0.08, low, floor + plinth, 0)   # stone plinth
        top = box(-hx, hx, -hy, hy, floor + plinth, floor + plinth + wall, 1)          # timber walls
        ez = floor + plinth + wall
        # gable ends (triangles) on the short sides
        for sx in (-1, 1):
            a = V(sx * hx, -hy, ez); b = V(sx * hx, hy, ez); c = V(sx * hx, 0, ez + pitch)
            f = bm.faces.new((a, b, c) if sx > 0 else (b, a, c)); f.material_index = 1
            for l in f.loops:
                l[col] = (1, 1, 1, 1)
        # roof: two slabs with overhang and thickness
        th = 0.12
        for sy in (-1, 1):
            e0 = V(-hx - over, sy * (hy + over), ez - over * pitch / hy)
            e1 = V(hx + over, sy * (hy + over), ez - over * pitch / hy)
            r1 = V(hx + over, 0, ez + pitch)
            r0 = V(-hx - over, 0, ez + pitch)
            quad([e0, e1, r1, r0] if sy < 0 else [e1, e0, r0, r1], 2, tint)
            u0 = V(-hx - over, sy * (hy + over), ez - over * pitch / hy - th)
            u1 = V(hx + over, sy * (hy + over), ez - over * pitch / hy - th)
            quad([u0, u1, e1, e0] if sy < 0 else [u1, u0, e0, e1], 2, tint)  # eave fascia
        # orient every face of this house away from its core (open shells, so no recalc_face_normals)
        core = Vector((p.x, p.y, floor + plinth + 0.5 * wall))
        for f in bm.faces:
            if f in done:
                continue
            f.normal_update()
            if f.normal.dot(f.calc_center_median() - core) < 0:
                f.normal_flip()
            done.add(f)
    bm.to_mesh(me); bm.free(); bm_src.free()

    coll = bpy.data.collections['10_SOURCE_natural']
    old = bpy.data.objects.get('RT_Natural_Houses')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    ob = bpy.data.objects.new('RT_Natural_Houses', me)
    coll.objects.link(ob)
    for name, rgb in (('M_Stone', (0.32, 0.31, 0.29)), ('M_Timber', (0.23, 0.15, 0.09)), ('M_Roof', (1, 1, 1))):
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        bsdf.inputs['Base Color'].default_value = (*rgb, 1)
        bsdf.inputs['Roughness'].default_value = 0.85
        if name == 'M_Roof':  # per-house roof tint lives in the 'Col' corner colours
            ca = next((n for n in m.node_tree.nodes if n.type == 'VERTEX_COLOR'), None) or m.node_tree.nodes.new('ShaderNodeVertexColor')
            ca.layer_name = 'Col'
            m.node_tree.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
        me.materials.append(m)
    print('houses', len(sites), 'tris', sum(len(p.vertices) - 2 for p in me.polygons))
    return ob
