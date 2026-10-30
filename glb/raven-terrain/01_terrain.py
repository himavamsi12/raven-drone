"""Raven terrain 01: natural mountain-village tile heightfield (Blender, Z-up, tile-local units).

Contract (measured from the shipped terrain.glb `Land-A`, see README):
  footprint X/Y -200..200, planar UV u=(x+200)/400 v=(y+200)/400,
  boundary flat at z=2.189 (every edge), ramp to full relief within ~15-25 units,
  relief envelope about -7.7..17.3 (camera clearance sampled from every camera track).
Runtime places the tile at scale 0.04 on a 15.99 grid; glTF export converts Z-up -> Y-up.

Builds `RT_Natural_Hi` (dense source for baking) in collection 10_SOURCE_natural.
Deterministic: fixed seeds/offsets only.
"""
import bpy, bmesh, math
from mathutils import Vector, noise

EDGE_Z = 2.189
HALF = 200.0
N = 161                        # dense source grid (2.5 unit spacing); runtime copy is decimated
ROAD_X0, ROAD_A = -45.0, 38.0  # valley road: x(y) = X0 + A*sin(2pi t); same x and tangent at y=+-200
POCKETS = [  # settlement pockets on shoulders beside the road: (x, y, radius, base height, terrace step)
    (35.0, 70.0, 42.0, 4.2, 1.1),
    (-120.0, -60.0, 36.0, 5.0, 1.0),
    (95.0, -115.0, 30.0, 6.5, 1.0),
]
SPURS = [  # contour roads from the valley road up to each pocket (control points; densified + wobbled)
    [(-45 + 38 * math.sin(2 * math.pi * 0.62), 48.0), (-10.0, 50.0), (10.0, 62.0), (35.0, 70.0)],
    [(-45 + 38 * math.sin(2 * math.pi * 0.33), -68.0), (-75.0, -78.0), (-98.0, -66.0), (-120.0, -60.0)],
    [(-45 + 38 * math.sin(2 * math.pi * 0.21), -116.0), (5.0, -132.0), (40.0, -120.0), (70.0, -108.0), (95.0, -115.0)],
]
ACROSS = 0.6  # pockets are ellipses: narrow downhill (x, toward the road), long along the contour (y)


def smoothstep(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def road_x(y):
    return ROAD_X0 + ROAD_A * math.sin(2 * math.pi * (y + HALF) / (2 * HALF))


def road_level(y):
    t = (y + HALF) / (2 * HALF)
    return EDGE_Z + 2.4 * math.sin(math.pi * t) ** 2


def pocket_d(x, y, pocket):
    """Warped elliptical distance to a pocket centre (same formula as the numpy mask)."""
    px, py = pocket[0], pocket[1]
    dx, dy = (x - px) / ACROSS, y - py
    return math.hypot(dx, dy) * (1 + 0.12 * math.sin(dy * 0.15 + px) * math.cos(dx * 0.11 + py))


def _catmull(pts, step=2.5):
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = (Vector((*P[k], 0)) for k in (i - 1, i, i + 1, i + 2))
        n = max(2, int((p2 - p1).length / step))
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(Vector((*pts[-1], 0)))
    return out


def _spur_paths():
    """Dense spur polylines with a gentle perpendicular wobble, plus road height per point."""
    paths = []
    for pts in SPURS:
        c = _catmull(pts)
        L = [0.0]
        for a, b in zip(c[:-1], c[1:]):
            L.append(L[-1] + (b - a).length)
        out = []
        for i, p in enumerate(c):
            a, b = c[max(i - 1, 0)], c[min(i + 1, len(c) - 1)]
            t = (b - a).normalized(); nrm = Vector((-t.y, t.x, 0))
            s = L[i] / L[-1]
            fade = math.sin(math.pi * s)  # endpoints stay on the road / pocket centre
            out.append(p + nrm * 3.0 * fade * math.sin(L[i] / 14.0))
        start_h = road_level(pts[0][1])
        end_h = next(b for (x, y, r, b, st) in POCKETS if (x, y) == pts[-1])
        hs = [start_h + (end_h - start_h) * smoothstep(0, 1, L[i] / L[-1]) for i in range(len(c))]
        lo = Vector((min(p.x for p in out) - 25, min(p.y for p in out) - 25, 0))
        hi = Vector((max(p.x for p in out) + 25, max(p.y for p in out) + 25, 0))
        paths.append((out, hs, lo, hi))
    return paths


SPUR_PATHS = _spur_paths()


def spur_info(p):
    """Closest spur distance and the interpolated road height there."""
    best = (1e9, 0.0)
    for pts, hs, lo, hi in SPUR_PATHS:
        if not (lo.x < p.x < hi.x and lo.y < p.y < hi.y):
            continue
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            ab = b - a
            t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
            d = (p - (a + ab * t)).length
            if d < best[0]:
                best = (d, hs[i] + (hs[i + 1] - hs[i]) * t)
    return best


def relief(x, y):
    p = Vector((x / 95.0 + 11.3, y / 95.0 - 4.7, 0.37))
    ridges = noise.ridged_multi_fractal(p, 1.0, 2.05, 6, 1.0, 2.2, noise_basis='PERLIN_NEW')
    broad = noise.fractal(Vector((x / 230.0 - 3.1, y / 230.0 + 8.2, 1.9)), 0.6, 2.0, 3, noise_basis='PERLIN_NEW')
    warp = Vector((noise.noise(Vector((x / 70.0, y / 70.0, 3.3))), noise.noise(Vector((x / 70.0, y / 70.0, 7.7))), 0))
    folds = noise.ridged_multi_fractal(Vector((x / 30.0, y / 30.0, 5.5)) + warp * 0.6, 0.9, 2.2, 3, 0.8, 2.0,
                                       noise_basis='PERLIN_NEW')
    h = 3.0 + 7.0 * broad + 9.0 * (ridges - 1.1) + 4.5 * (folds - 0.7)
    h = 3.0 + RELIEF_GAIN * (h - RELIEF_MID)
    return h if h > -5.0 else -5.0 + 0.35 * (h + 5.0)  # soft valley floor


RELIEF_MID, RELIEF_GAIN = 3.05, 1.75  # raw p2/50/98 = -5.5/3.05/9.3; re-measure after any relief change


def height(x, y):
    h = relief(x, y)
    p = Vector((x, y, 0))
    # valley road: wide valley floor that the road follows along the contour
    dv = abs(x - road_x(y))
    floor = road_level(y) + 0.06 * max(dv - 6, 0)
    h = floor + (h - floor) * smoothstep(5.0, 48.0, dv) if h > floor else floor + (h - floor) * smoothstep(5.0, 20.0, dv)
    # settlement pockets: soften relief, then terrace
    for pk in POCKETS:
        px, py, r, base, step = pk
        d = pocket_d(x, y, pk)
        w = 1.0 - smoothstep(r * 0.55, r * 1.35, d)
        if w <= 0:
            continue
        # gentle tilted plane downhill toward the valley road
        tilt = 0.09 * (x - px) * (1 if px > road_x(py) else -1)
        soft = base + tilt + 0.15 * (h - base)
        q = soft / step
        terr = step * (math.floor(q) + smoothstep(0.78, 1.0, q - math.floor(q)))
        wt = 1.0 - smoothstep(r * 0.45, r * 0.95, d)
        target = soft + (terr - soft) * wt
        h = h + (target - h) * w
    # spur roads: benches cut along the contour
    ds, rh = spur_info(p)
    if ds < 22:
        h = rh + (h - rh) * smoothstep(1.6, 14.0, ds)
    # seam contract: flat rim
    edge = HALF - max(abs(x), abs(y))
    h = EDGE_Z + (h - EDGE_Z) * smoothstep(1.0, 26.0, edge)
    return max(-7.5, min(17.0, h))


def build():
    coll = bpy.data.collections.get('10_SOURCE_natural') or bpy.data.collections.new('10_SOURCE_natural')
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    old = bpy.data.objects.get('RT_Natural_Hi')
    mats = list(old.data.materials) if old else []
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    me = bpy.data.meshes.new('RT_Natural_Hi')
    bm = bmesh.new()
    step = 2 * HALF / (N - 1)
    vs = [[bm.verts.new((-HALF + i * step, -HALF + j * step, 0.0)) for i in range(N)] for j in range(N)]
    for j in range(N):
        for i in range(N):
            v = vs[j][i]
            v.co.z = EDGE_Z if (i in (0, N - 1) or j in (0, N - 1)) else height(v.co.x, v.co.y)
    uv = bm.loops.layers.uv.new('UVMap')
    for j in range(N - 1):
        for i in range(N - 1):
            # alternate diagonals to avoid directional faceting
            a, b, c, d = vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]
            tris = [(a, b, c), (a, c, d)] if (i + j) % 2 == 0 else [(a, b, d), (b, c, d)]
            for t in tris:
                f = bm.faces.new(t)
                for l in f.loops:
                    l[uv].uv = ((l.vert.co.x + HALF) / (2 * HALF), (l.vert.co.y + HALF) / (2 * HALF))
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new('RT_Natural_Hi', me)
    coll.objects.link(ob)
    zs = [v.co.z for v in me.vertices]
    print('RT_Natural_Hi verts', len(me.vertices), 'tris', len(me.polygons), 'z', round(min(zs), 3), round(max(zs), 3))
    return ob
