"""Raven coaxial quad: procedural build of the four-arm, eight-propeller medical cargo variant (Blender 5.2).

Headless (writes textures/ and raven-quad.blend; nothing else is touched):
  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
      --python glb/raven-quad/build_raven_quad.py
Live preview (Blender MCP): exec this file with RQ_ROOT set and RQ_FAST=True. It adds/replaces
only the scene 'Raven_Quad' and RQ_/MAT_Raven_ datablocks; other scenes stay as they are.

Convention: metres, Z up, front -Y, left +X. Raven_Root sits at the arm/rotor-deck centre.
Dimensions are provisional visual design values from RAVEN_DRONE_BLENDER_BRIEF.md, not engineering data.
"""
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector, Matrix

G = globals()
ROOT = G.get('RQ_ROOT') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'glb', 'raven-quad')
TEX = os.path.join(OUT, 'textures')
FAST = G.get('RQ_FAST', False)
os.makedirs(TEX, exist_ok=True)

# Layout (brief section 3.1)
MOTOR_X, MOTOR_Y = 0.76, 0.63
UPPER_Z, LOWER_Z = 0.235, -0.175     # coaxial prop planes (pod centred on the arm at ARM_Z)
PROP_R = 0.40
TUBE_R = 0.031                      # 62 mm carbon tube
ROOT_X, ROOT_Y, ARM_Z = 0.29, 0.22, 0.03
# Upper-prop spin viewed from above; each lower prop turns the other way. Diagonal pairs match.
STATIONS = {  # name: (sx, sy, spin)   left = +X, front = -Y
    'Front_Left': (1, -1, 'CW'), 'Front_Right': (-1, -1, 'CCW'),
    'Rear_Left': (1, 1, 'CCW'), 'Rear_Right': (-1, 1, 'CW'),
}

# ---------------------------------------------------------------- scene

def fresh_scene():
    old = bpy.data.scenes.get('Raven_Quad')
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.scenes.remove(old)
    for coll in (bpy.data.collections, bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.images,
                 bpy.data.lights, bpy.data.cameras, bpy.data.worlds):
        for d in list(coll):
            if d.name.startswith(('RQ_', 'MAT_Raven_')) and d.users == 0:
                coll.remove(d)
    if bpy.app.background:  # factory file: reuse the context scene, empty it so the .blend holds only Raven
        sc = bpy.context.scene
        sc.name = 'Raven_Quad'
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
            for d in list(coll):
                if d.users == 0:
                    coll.remove(d)
    else:  # live session: separate scene; the depsgraph needs it to be the window's scene
        sc = bpy.data.scenes.new('Raven_Quad')
        bpy.context.window.scene = sc
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 1.0
    model = bpy.data.collections.new('RQ_Model')
    sc.collection.children.link(model)
    return sc, model


SC, MODEL = fresh_scene()


def depsgraph():
    d = SC.view_layers[0].depsgraph or bpy.context.evaluated_depsgraph_get()
    d.update()
    return d


def link(obj, coll=None):
    (coll or MODEL).objects.link(obj)
    return obj

# ---------------------------------------------------------------- materials

def lin(h):
    def c(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    h = h.lstrip('#')
    return tuple(c(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def srgb01(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], dtype=np.float32)


def fft_noise(n, size_px, seed):
    """Periodic gaussian-filtered noise, unit variance; size_px ~ feature diameter."""
    rng = np.random.default_rng(seed)
    f2 = np.fft.fftfreq(n)[:, None] ** 2 + np.fft.fftfreq(n)[None, :] ** 2
    sigma = 1.0 / (math.pi * max(size_px, 0.5))
    out = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((n, n))) * np.exp(-f2 / (2 * sigma ** 2))))
    return (out - out.mean()) / (out.std() + 1e-9)


def height_to_normal(h, amp_m, px_m):
    """Tangent-space (OpenGL, +Y up) normal from height field in metres."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * amp_m / px_m
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * amp_m / px_m
    nrm = np.dstack((-dx, -dy, np.ones_like(h)))
    nrm /= np.linalg.norm(nrm, axis=2)[:, :, None]
    return nrm * 0.5 + 0.5


def save_image(name, rgb, color):
    n = rgb.shape[0]
    im = bpy.data.images.new(name, width=n, height=n, alpha=False)
    im.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    rgba = np.ones((n, n, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(rgb, 0, 1)
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw = os.path.join(TEX, name + '.png')
    im.file_format = 'PNG'
    if not FAST:
        im.save()
    im.pack()
    return im


def surface_maps(key, n, tile_m, base_hex, height, amp_m, rough, rough_var, tone_var=0.0, color=True):
    """Bake a tiling height field to base color (sRGB), normal and ORM (R=1 no AO, G rough, B metal=0)."""
    if FAST:
        n = min(n, 256)
    h = height(n, tile_m / n)
    maps = {}
    if color:
        maps['color'] = save_image(f'RQ_{key}_color', srgb01(base_hex)[None, None, :] * (1 + tone_var * h)[:, :, None], True)
    orm = np.ones((n, n, 3), dtype=np.float32)
    orm[:, :, 1] = np.clip(rough[0] + rough_var * h, rough[1], rough[2])
    orm[:, :, 2] = 0.0
    maps['orm'] = save_image(f'RQ_{key}_orm', orm, False)
    maps['normal'] = save_image(f'RQ_{key}_normal', height_to_normal(h, amp_m, tile_m / n), False)
    maps['tile'] = tile_m
    return maps


def pebble(feature_mm, seed):
    def f(n, px):
        s = feature_mm * 1e-3 / px
        b = fft_noise(n, s, seed) - 0.55 * fft_noise(n, s * 2.2, seed + 1)
        b = (b - b.mean()) / b.std()
        cells = np.tanh(1.6 * b)                   # rounded plateaus with valleys between
        return cells + 0.18 * fft_noise(n, max(s * 0.35, 1.0), seed + 2)
    return f


def micro(feature_mm, broad_mm, seed, broad_w=1.0, grain_w=0.35):
    def f(n, px):
        return broad_w * fft_noise(n, broad_mm * 1e-3 / px, seed) + grain_w * fft_noise(n, max(feature_mm * 1e-3 / px, 1.0), seed + 7)
    return f


def carbon_twill(n, cells=16):
    """2x2 twill; tows run along U (weft) / V (warp). Returns height, warp mask."""
    c = n // cells
    y, x = np.mgrid[0:n, 0:n]
    i, j, fx, fy = x // c, y // c, (x % c + 0.5) / c, (y % c + 0.5) / c
    warp = ((i - j) % 4) < 2
    across = np.where(warp, fx, fy)
    along = np.where(warp, fy, fx)
    crown = np.sin(math.pi * across) ** 0.7
    stri = 0.06 * np.sin(2 * math.pi * np.where(warp, x, y) * 9 / c)
    h = crown * (0.92 + 0.08 * np.sin(math.pi * along)) + stri
    return h - h.mean(), warp


def carbon_maps():
    n = 256 if FAST else 1024
    tile = 0.024                                     # 16 cells of 1.5 mm
    h, warp = carbon_twill(n)
    base = srgb01('#22262B')
    tone = np.where(warp, 1.07, 0.93) * (1 + 0.25 * h * 0.12)
    color = save_image('RQ_carbon_color', base[None, None, :] * tone[:, :, None], True)
    orm = np.ones((n, n, 3), dtype=np.float32)
    orm[:, :, 1] = np.clip(np.where(warp, 0.30, 0.36) - 0.02 * h, 0.27, 0.39)
    orm[:, :, 2] = 0
    return {'color': color, 'orm': save_image('RQ_carbon_orm', orm, False),
            'normal': save_image('RQ_carbon_normal', height_to_normal(h, 0.00004, tile / n), False), 'tile': tile}


MATS = {}


def material(name, hex_, rough, metal=0.0, coat=0.0, coat_rough=0.3, ior=1.5, maps=None, nstrength=1.0,
             emission=None, spec_tint=None):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value = (*lin(hex_), 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['IOR'].default_value = ior
    bs.inputs['Coat Weight'].default_value = coat
    bs.inputs['Coat Roughness'].default_value = coat_rough
    if spec_tint:
        bs.inputs['Specular Tint'].default_value = (*spec_tint, 1)
    if emission:
        bs.inputs['Emission Color'].default_value = (*lin(emission[0]), 1)
        bs.inputs['Emission Strength'].default_value = emission[1]
    if maps:
        L = nt.links
        uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'UVMap'; uv.location = (-1100, 0)
        if 'color' in maps:
            t = nt.nodes.new('ShaderNodeTexImage'); t.image = maps['color']; t.location = (-700, 300)
            L.new(uv.outputs['UV'], t.inputs['Vector']); L.new(t.outputs['Color'], bs.inputs['Base Color'])
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = maps['orm']; t.location = (-700, 0)
        L.new(uv.outputs['UV'], t.inputs['Vector'])
        sep = nt.nodes.new('ShaderNodeSeparateColor'); sep.location = (-400, 0)
        L.new(t.outputs['Color'], sep.inputs[0])
        L.new(sep.outputs['Green'], bs.inputs['Roughness']); L.new(sep.outputs['Blue'], bs.inputs['Metallic'])
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = maps['normal']; t.location = (-700, -300)
        L.new(uv.outputs['UV'], t.inputs['Vector'])
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.location = (-400, -300); nm.inputs['Strength'].default_value = nstrength
        L.new(t.outputs['Color'], nm.inputs['Color']); L.new(nm.outputs['Normal'], bs.inputs['Normal'])
    m['rq_tile'] = maps['tile'] if maps else 0.1
    m.use_backface_culling = True
    MATS[name.replace('MAT_Raven_', '')] = m
    return m


def build_materials():
    shell = surface_maps('shell', 2048, 0.25, '#A3A4AC', micro(0.15, 60, 11, 1.0, 0.25), 0.000003,
                         (0.38, 0.34, 0.42), 0.022, color=False)
    deck = surface_maps('deck', 1024, 0.10, '#414249', micro(0.3, 25, 21, 0.5, 0.8), 0.000012,
                        (0.53, 0.46, 0.60), 0.03, tone_var=0.015)
    pod = surface_maps('pod', 1024, 0.04, '#1B1C20', pebble(0.30, 31), 0.00005, (0.68, 0.60, 0.75), 0.04, tone_var=0.04)
    case = surface_maps('case', 2048, 0.12, '#24252A', pebble(0.55, 41), 0.00009, (0.72, 0.65, 0.80), 0.05, tone_var=0.04)
    side = surface_maps('caseside', 1024, 0.10, '#36373D', micro(0.25, 30, 51, 0.6, 0.7), 0.000015,
                        (0.64, 0.57, 0.72), 0.03, tone_var=0.015)
    frame = surface_maps('frame', 1024, 0.08, '#202227', micro(0.2, 20, 61, 0.7, 0.5), 0.000006,
                         (0.42, 0.35, 0.49), 0.03, tone_var=0.01)
    material('MAT_Raven_Shell_CoolGray', '#A3A4AC', 0.38, coat=0.08, coat_rough=0.36, ior=1.46, maps=shell)
    material('MAT_Raven_Deck_Charcoal', '#414249', 0.53, coat=0.03, maps=deck)
    material('MAT_Raven_Carbon_Tube', '#22262B', 0.33, coat=0.22, coat_rough=0.28, maps=carbon_maps(), nstrength=0.8)
    material('MAT_Raven_Motor_Pod', '#1B1C20', 0.68, maps=pod)
    material('MAT_Raven_Propeller', '#16181C', 0.34, coat=0.06, coat_rough=0.3)
    material('MAT_Raven_PropTip', '#C9CBD0', 0.46, coat=0.06, coat_rough=0.3)
    material('MAT_Raven_Case_Pebbled', '#24252A', 0.72, maps=case)
    material('MAT_Raven_Case_Side', '#36373D', 0.64, maps=side)
    material('MAT_Raven_Frame_Coated', '#202227', 0.42, coat=0.05, coat_rough=0.35, maps=frame)
    material('MAT_Raven_Exposed_Metal', '#8F9399', 0.33, metal=1.0)
    material('MAT_Raven_Rubber', '#141519', 0.80)
    material('MAT_Raven_Lens', '#08080C', 0.10, ior=1.5, spec_tint=(0.78, 0.74, 1.0))
    material('MAT_Raven_WarningYellow', '#D2AA27', 0.52)
    material('MAT_Raven_LED_Red', '#5A0B08', 0.25, emission=('#FF2A1A', 2.0))
    material('MAT_Raven_LED_Green', '#0A3A14', 0.25, emission=('#2BFF5A', 2.0))
    material('MAT_Raven_Label_Ink', '#B9BCC3', 0.55)

# ---------------------------------------------------------------- mesh helpers


def to_mesh(bm, name, mat):
    me = bpy.data.meshes.new('RQ_' + name)
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MATS[mat])
    return me


def bevel_all(bm, offset, segs, edges=None):
    bmesh.ops.bevel(bm, geom=list(edges if edges is not None else bm.edges), offset=offset, segments=segs,
                    profile=0.5, affect='EDGES', clamp_overlap=True)


def rbox(size, center=(0, 0, 0), r=0.004, segs=3, rot_z=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if r > 0:
        bevel_all(bm, r, segs)
    M = Matrix.Translation(Vector(center)) @ Matrix.Rotation(rot_z, 4, 'Z')
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts[:])
    return bm


def lathe(profile, segs=48, matrix=None):
    """profile: [(r, z)] bottom->top; r==0 ends become poles."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z))
                          for a in (2 * math.pi * k / segs for k in range(segs))])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for k in range(segs):
                bm.faces.new((a[0], b[k], b[(k + 1) % segs]))
        elif len(b) == 1:
            for k in range(segs):
                bm.faces.new((a[k], b[0], a[(k + 1) % segs]))
        else:
            for k in range(segs):
                bm.faces.new((a[k], a[(k + 1) % segs], b[(k + 1) % segs], b[k]))
    if len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    if matrix is not None:
        bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts[:])
    return bm


def frame_to(origin, direction):
    """Matrix mapping local +Z to direction at origin."""
    d = Vector(direction).normalized()
    q = Vector((0, 0, 1)).rotation_difference(d)
    return Matrix.Translation(Vector(origin)) @ q.to_matrix().to_4x4()


def fillet(points, radius, steps=8):
    pts = [Vector(p) for p in points]
    out = [pts[0]]
    for a, b, c in zip(pts, pts[1:], pts[2:]):
        u, w = (a - b).normalized(), (c - b).normalized()
        ang = u.angle(w)
        if ang > math.pi - 1e-3:
            out.append(b)
            continue
        t = min(radius / math.tan(ang / 2), (a - b).length * 0.45, (c - b).length * 0.45)
        p0, p1 = b + u * t, b + w * t
        for k in range(steps + 1):
            s = k / steps  # quadratic bezier through the corner
            out.append(p0 * (1 - s) ** 2 + b * 2 * s * (1 - s) + p1 * s * s)
    out.append(pts[-1])
    return out


def tube(points, radius, segs=24, tile=None, caps=True):
    """Swept round tube with parallel-transport frames. Cylindrical UV (seam faces down/-Z) when tile is set."""
    pts = [Vector(p) for p in points]
    tans = []
    for i in range(len(pts)):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        tans.append((b - a).normalized())
    ref = Vector((0, 0, -1))
    n0 = ref - tans[0] * ref.dot(tans[0])
    if n0.length < 1e-4:
        n0 = Vector((0, 1, 0)) - tans[0] * tans[0].y
    n0.normalize()
    frames = [n0]
    for i in range(1, len(pts)):
        q = tans[i - 1].rotation_difference(tans[i])
        n = q @ frames[-1]
        frames.append((n - tans[i] * n.dot(tans[i])).normalized())
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    rings, dist = [], [0.0]
    for i, p in enumerate(pts):
        if i:
            dist.append(dist[-1] + (p - pts[i - 1]).length)
        n = frames[i]
        bnorm = tans[i].cross(n)
        rings.append([bm.verts.new(p + (n * math.cos(a) + bnorm * math.sin(a)) * radius)
                      for a in (2 * math.pi * k / segs for k in range(segs))])
    reps = max(1, round(2 * math.pi * radius / tile)) if tile else 1
    for i in range(len(pts) - 1):
        for k in range(segs):
            f = bm.faces.new((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
            if tile:
                u0, u1 = k / segs * reps, (k + 1) / segs * reps
                v0, v1 = dist[i] / tile, dist[i + 1] / tile
                for loop, uv in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
                    loop[uvl].uv = uv
    if caps:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return bm


def rrect(w, h, r, steps=6):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for k in range(steps + 1):
            a = math.radians(a0 + 90 * k / steps)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def prism(outline, z0, z1, matrix=None, inner=None):
    """Extrude a 2D outline between z0..z1 (local); optional inner outline makes a ring."""
    bm = bmesh.new()
    def loop(o, z):
        return [bm.verts.new((x, y, z)) for x, y in o]
    a, b = loop(outline, z0), loop(outline, z1)
    n = len(outline)
    for k in range(n):
        bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    if inner is None:
        bm.faces.new(list(reversed(a))); bm.faces.new(b)
    else:
        c, d = loop(inner, z0), loop(inner, z1)
        m = len(inner)
        for k in range(m):
            bm.faces.new((c[(k + 1) % m], c[k], d[k], d[(k + 1) % m]))
        for top, bot in ((b, d), (a, c)):  # bridge outer/inner (same vertex counts required)
            for k in range(n):
                bm.faces.new((top[k], top[(k + 1) % n], bot[(k + 1) % n], bot[k]))
    if matrix is not None:
        bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts[:])
    return bm


def xplate(len_y, h_z, r, x0, x1, cy=0.0, cz=0.0):
    """Rounded-rectangle plate in the YZ plane spanning x0..x1."""
    return prism(rrect(h_z, len_y, r), x0, x1, Matrix.Translation((0, cy, cz)) @ Matrix.Rotation(math.radians(90), 4, 'Y'))


def yplate(w_x, h_z, r, y0, y1, cx=0.0, cz=0.0):
    """Rounded-rectangle plate in the XZ plane spanning y0..y1 (y0 > y1 allowed)."""
    return prism(rrect(w_x, h_z, r), -y0, -y1, Matrix.Translation((cx, 0, cz)) @ Matrix.Rotation(math.radians(90), 4, 'X'))


def section(y, w, zt, zb, ct, cb, lean=0.0):
    """Shell cross-section: slanted lower sides, shoulder facet, stepped facet, flat service plateau.
    lean tilts the section plane (top falls back) for the raked nose face."""
    x, xl = w / 2, w / 2 - 0.012
    p = min(0.15, x - ct - 0.012)
    belt = zb + 0.45 * (zt - zb)     # molded belt line: lower side flares out, upper side tucks in
    half = [(xl - cb, zb), (xl, zb + cb), (x, belt), (x - 0.014, zt - ct), (x - ct, zt - 0.012), (p, zt)]
    pts = half + [(-px, pz) for px, pz in reversed(half)]
    zm = (zt + zb) / 2
    return [Vector((px, y + lean * (pz - zm), pz)) for px, pz in pts]


FACE_Y, FACE_ZM, LEAN = -0.462, 0.0225, 0.30


def face_frame(x, z, offset=0.0):
    """Frame on the raked nose face: local +Z = outward normal, local +Y ~ up the face."""
    n = Vector((0, -1, LEAN)).normalized()
    return frame_to(Vector((x, FACE_Y + LEAN * (z - FACE_ZM), z)) + n * offset, n)


def loft(sections):
    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in s] for s in sections]
    n = len(sections[0])
    for a, b in zip(rings, rings[1:]):
        for k in range(n):
            bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    return bm


def shaped(name, bm, mat, bevel=None, cutters=()):
    """Bevel (angle-limited modifier) then exact booleans; cutter materials transfer to cut walls."""
    obj = link(bpy.data.objects.new('RQ_tmp_' + name, to_mesh(bm, name, mat)))
    if bevel:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width, mod.segments, mod.limit_method = bevel[0], bevel[1], 'ANGLE'
        mod.angle_limit = math.radians(bevel[2] if len(bevel) > 2 else 25)
        mod.profile = 0.5
        mod.harden_normals = False
    tmp = []
    for cbm, cmat in cutters:
        c = link(bpy.data.objects.new('RQ_tmp_cut', to_mesh(cbm, 'cut', cmat)))
        c.hide_render = True
        tmp.append(c)
        mod = obj.modifiers.new('Cut', 'BOOLEAN')
        mod.operation, mod.solver, mod.object = 'DIFFERENCE', 'EXACT', c
        try:
            mod.material_mode = 'TRANSFER'
        except Exception:
            pass
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph()), preserve_all_data_layers=True, depsgraph=depsgraph())
    me.name = 'RQ_' + name
    old = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.meshes.remove(old)
    for c in tmp:
        d = c.data
        bpy.data.objects.remove(c, do_unlink=True)
        bpy.data.meshes.remove(d)
    return me


def simple(name, bm, mat):
    return to_mesh(bm, name, mat)


def text_mesh(text, size, matrix, mat='Label_Ink', align='CENTER'):
    cu = bpy.data.curves.new('RQ_text', 'FONT')
    cu.body, cu.size, cu.align_x, cu.align_y = text, size, align, 'CENTER'
    cu.space_character = 1.12
    o = link(bpy.data.objects.new('RQ_tmp_text', cu))
    me = bpy.data.meshes.new_from_object(o.evaluated_get(depsgraph()), depsgraph=depsgraph())
    bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.curves.remove(cu)
    me.transform(matrix)
    me.materials.clear()
    me.materials.append(MATS[mat])
    return me


def merge(name, meshes):
    """Append meshes (already in target local space) into one; material slots remapped."""
    mats, bm = [], bmesh.new()
    for me in meshes:
        if not me.uv_layers:
            me.uv_layers.new(name='UVMap')
        remap = []
        for m in me.materials:
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        idx = [remap[p.material_index] if remap else 0 for p in me.polygons]
        for p, i in zip(me.polygons, idx):
            p.material_index = i
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    out = bpy.data.meshes.new('RQ_' + name)
    bm.to_mesh(out)
    bm.free()
    for m in mats:
        out.materials.append(m)
    return out


def box_uv(me):
    """Physical-scale box projection for every non-tube face (tube UVs are authored in tube())."""
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    carbon = MATS['Carbon_Tube']
    for p in me.polygons:
        m = me.materials[p.material_index]
        if m == carbon:
            continue
        tile = m.get('rq_tile', 0.1)
        ax = max(range(3), key=lambda a: abs(p.normal[a]))
        a, b = [i for i in range(3) if i != ax]
        flip = -1 if p.normal[ax] < 0 else 1
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co[a] / tile * (flip if ax != 2 else 1), co[b] / tile)


def finish(name, meshes, parent=None, loc=(0, 0, 0), sharp=30):
    me = merge(name, meshes)
    box_uv(me)
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(sharp))
    obj = link(bpy.data.objects.new(name, me))
    obj.parent = parent
    obj.location = loc
    wn = obj.modifiers.new('WeightedNormal', 'WEIGHTED_NORMAL')
    wn.mode, wn.weight, wn.keep_sharp = 'FACE_AREA', 50, True
    baked = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph()), preserve_all_data_layers=True, depsgraph=depsgraph())
    obj.modifiers.clear()
    obj.data = baked
    bpy.data.meshes.remove(me)
    baked.name = 'RQ_' + name
    return obj


def empty(name, parent=None, loc=(0, 0, 0), size=0.1):
    o = link(bpy.data.objects.new(name, None))
    o.empty_display_type, o.empty_display_size = 'PLAIN_AXES', size
    o.parent, o.location = parent, loc
    return o

# ---------------------------------------------------------------- body


def build_body(root):
    S = 'Shell_CoolGray'
    front = loft([section(FACE_Y, 0.42, 0.090, -0.045, 0.050, 0.028, LEAN),
                  section(-0.444, 0.50, 0.130, -0.062, 0.068, 0.032, 0.18),
                  section(-0.405, 0.56, 0.152, -0.072, 0.082, 0.034),
                  section(-0.320, 0.58, 0.160, -0.074, 0.088, 0.034),
                  section(-0.070, 0.58, 0.160, -0.074, 0.088, 0.034)])
    cuts = []
    for sx in (1, -1):  # optics pockets in the raked nose face
        cuts.append((prism(rrect(0.078, 0.034, 0.012), -0.010, 0.020, face_frame(sx * 0.11, FACE_ZM)), 'Frame_Coated'))
    # Shallow service-panel seam where the reference mast stood: continuous closed shell, no tower.
    cuts.append((prism(rrect(0.224, 0.204, 0.022, 6), 0.1585, 0.17, Matrix.Translation((0, -0.21, 0)),
                       inner=rrect(0.221, 0.201, 0.0205, 6)), 'Frame_Coated'))
    screws = [(sx * 0.093, y) for sx in (1, -1) for y in (-0.293, -0.127)]
    for x, y in screws:
        cuts.append((lathe([(0.0042, 0.1575), (0.0042, 0.17)], 20, Matrix.Translation((x, y, 0))), 'Frame_Coated'))
    shell = shaped('front_shell', front, S, bevel=(0.005, 3, 20), cutters=cuts)

    rear = loft([section(0.250, 0.57, 0.135, -0.070, 0.085, 0.034),
                 section(0.380, 0.57, 0.135, -0.070, 0.085, 0.034),
                 section(0.425, 0.50, 0.112, -0.058, 0.070, 0.032, -0.15),
                 section(0.440, 0.42, 0.085, -0.042, 0.052, 0.028, -0.25)])
    back = Matrix.Rotation(math.radians(-90), 4, 'X')  # local +Z -> +Y (rear)
    rcuts = [(prism(rrect(0.15, 0.0055, 0.0027, 3), -0.012, 0.02, Matrix.Translation((0, 0.440, z)) @ back), 'Frame_Coated')
             for z in (-0.004, 0.008, 0.020, 0.032)]
    rscrews = [(sx * 0.11, 0.32) for sx in (1, -1)]
    for x, y in rscrews:
        rcuts.append((lathe([(0.0042, 0.1325), (0.0042, 0.15)], 20, Matrix.Translation((x, y, 0))), 'Frame_Coated'))
    rear_shell = shaped('rear_shell', rear, S, bevel=(0.005, 3, 20), cutters=rcuts)

    parts = [shell, rear_shell]
    for (x, y), z in [(p, 0.1575) for p in screws] + [(p, 0.1325) for p in rscrews]:
        parts.append(simple('screw', lathe([(0, z - 0.004), (0.0034, z - 0.004), (0.0034, z + 0.0012), (0.0026, z + 0.002), (0, z + 0.002)], 16,
                                           Matrix.Translation((x, y, 0))), 'Exposed_Metal'))
    # Structural core: thick chassis plate plus pierced side rails carry arms, deck, case and landing gear.
    parts.append(shaped('chassis', rbox((0.54, 0.84, 0.03), (0, -0.01, -0.088), 0.0), 'Frame_Coated', bevel=(0.005, 2, 30)))
    for sx in (1, -1):
        holes = [(xplate(0.075, 0.026, 0.011, sx * 0.25, sx * 0.31, y, -0.084), 'Frame_Coated') for y in (-0.33, -0.10, 0.04, 0.33)]
        parts.append(shaped('side_rail', rbox((0.03, 0.80, 0.058), (sx * 0.28, -0.01, -0.084), 0.0), 'Frame_Coated', bevel=(0.004, 2, 30), cutters=holes))
        for sy in (1, -1):  # hinge mounts: each arm root is carried by the body side, not floating
            parts.append(shaped('arm_mount', rbox((0.085, 0.13, 0.15), (sx * 0.27, sy * ROOT_Y, 0.012), 0.0), 'Frame_Coated', bevel=(0.007, 3, 30)))
            parts.append(simple('mount_bolt', lathe([(0, -0.003), (0.0055, -0.003), (0.0055, 0.004), (0, 0.004)], 6,
                                                    frame_to((sx * 0.3125, sy * ROOT_Y + 0.04, -0.035), (sx, 0, 0))), 'Exposed_Metal'))
            parts.append(simple('mount_bolt', lathe([(0, -0.003), (0.0055, -0.003), (0.0055, 0.004), (0, 0.004)], 6,
                                                    frame_to((sx * 0.3125, sy * ROOT_Y - 0.04, -0.035), (sx, 0, 0))), 'Exposed_Metal'))
    return finish('Body_Shell', parts, root)


def build_deck(root):
    D = 'Deck_Charcoal'
    cuts = []
    for sx in (1, -1):
        for k in range(6):
            cuts.append((rbox((0.02, 0.007, 0.06), (sx * 0.26, 0.005 + k * 0.026, 0.01), 0.0), 'Frame_Coated'))
    base = shaped('deck_base', rbox((0.52, 0.36, 0.17), (0, 0.09, 0.01), 0.0), D, bevel=(0.006, 3, 30), cutters=cuts)
    parts = [base]
    for sx in (1, -1):
        pack = shaped('pack', rbox((0.225, 0.31, 0.045), (sx * 0.1215, 0.09, 0.115), 0.0), D, bevel=(0.007, 3, 30),
                      cutters=[(prism(rrect(0.10, 0.024, 0.012), 0.127, 0.16, Matrix.Translation((sx * 0.1215, 0.21, 0))), 'Frame_Coated')]
                      + [(xplate(0.27, 0.006, 0.003, sx * 0.229, sx * 0.25, 0.09, z), 'Frame_Coated') for z in (0.105, 0.12)])
        parts.append(pack)
        parts.append(shaped('pack_tab', rbox((0.06, 0.016, 0.026), (sx * 0.1215, -0.071, 0.11), 0.0), 'Frame_Coated', bevel=(0.0025, 2, 30)))
    parts.append(shaped('rail', rbox((0.018, 0.33, 0.042), (0, 0.09, 0.112), 0.0), 'Frame_Coated', bevel=(0.003, 2, 30)))
    return finish('Battery_Deck', parts, root)


def build_optics(root):
    parts = []
    for sx in (1, -1):
        parts.append(shaped('bezel', prism(rrect(0.0765, 0.0325, 0.0112), 0.0, 0.006, face_frame(sx * 0.11, FACE_ZM, -0.010)),
                            'Frame_Coated', bevel=(0.0012, 2, 30)))
        for dx in (-0.019, 0.019):
            m = face_frame(sx * 0.11 + dx, FACE_ZM, -0.0045)
            parts.append(simple('barrel', lathe([(0, -0.001), (0.0108, -0.001), (0.0108, 0.0022), (0.0095, 0.0028), (0, 0.0028)], 32, m), 'Frame_Coated'))
            parts.append(simple('lens', lathe([(0, 0.002), (0.0082, 0.002), (0.0082, 0.0030), (0.006, 0.0038), (0.003, 0.0042), (0, 0.0043)], 32, m), 'Lens'))
    # compact downward sensor block under the nose (flush lenses, not a turret)
    parts.append(shaped('chin', rbox((0.17, 0.085, 0.045), (0, -0.39, -0.112), 0.0), 'Frame_Coated', bevel=(0.008, 3, 30)))
    down = Matrix.Rotation(math.pi, 4, 'X')
    for dx in (-0.035, 0.035):
        m = Matrix.Translation((dx, -0.39, -0.1345)) @ down
        parts.append(simple('barrel', lathe([(0, -0.001), (0.0108, -0.001), (0.0108, 0.0022), (0.0095, 0.0028), (0, 0.0028)], 32, m), 'Frame_Coated'))
        parts.append(simple('lens', lathe([(0, 0.002), (0.0082, 0.002), (0.0082, 0.0030), (0.006, 0.0038), (0.003, 0.0042), (0, 0.0043)], 32, m), 'Lens'))
    return finish('Front_Optics', parts, root)


CASE_W, CASE_D, CASE_H, CASE_Z = 0.48, 0.46, 0.36, -0.32   # centre z; top -0.14, bottom -0.50


def build_case(root):
    P, cz, hx, hy, top = 'Case_Pebbled', CASE_Z, CASE_W / 2, CASE_D / 2, CASE_Z + CASE_H / 2
    lid = top - 0.045
    cuts = [(prism(rrect(CASE_W + 0.03, CASE_D + 0.03, 0.03, 6), lid - 0.0009, lid + 0.0009,
                   inner=rrect(CASE_W - 0.004, CASE_D - 0.004, 0.016, 6)), 'Frame_Coated')]
    for sx in (1, -1):
        cuts.append((xplate(CASE_D - 0.12, 0.21, 0.02, sx * (hx - 0.004), sx * (hx + 0.02), 0, cz - 0.03), 'Case_Side'))
    cuts.append((yplate(0.09, 0.055, 0.008, -(hy - 0.006), -(hy + 0.02), 0, lid), 'Frame_Coated'))
    body = shaped('case_body', rbox((CASE_W, CASE_D, CASE_H), (0, 0, cz), 0.0), P, bevel=(0.018, 4, 30), cutters=cuts)
    parts = [body]
    for sx in (1, -1):
        parts.append(shaped('case_panel', xplate(CASE_D - 0.126, 0.204, 0.017, sx * (hx - 0.006), sx * (hx - 0.0015), 0, cz - 0.03), 'Case_Side', bevel=(0.0012, 2, 30)))
        rot = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1))) if sx > 0 else Matrix(((0, 0, -1, 0), (-1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
        parts.append(text_mesh('RAVEN', 0.05, Matrix.Translation((sx * (hx - 0.0012), 0, cz - 0.008)) @ rot))
        parts.append(text_mesh('MEDICAL SUPPLY', 0.015, Matrix.Translation((sx * (hx - 0.0012), 0, cz - 0.053)) @ rot))
        for sy in (1, -1):  # protected vertical corners
            parts.append(shaped('corner', rbox((0.056, 0.056, CASE_H - 0.03), (sx * (hx - 0.016), sy * (hy - 0.016), cz), 0.0), 'Rubber', bevel=(0.013, 3, 30)))
    for sy in (1, -1):  # shallow molded ribs on the ends
        for z in (cz - 0.07, cz - 0.12):
            parts.append(shaped('rib', rbox((0.32, 0.008, 0.015), (0, sy * (hy - 0.0015), z), 0.0), P, bevel=(0.003, 2, 30)))
    # recessed latch straddling the lid split
    parts.append(shaped('latch_base', rbox((0.075, 0.006, 0.044), (0, -(hy - 0.0045), lid), 0.0), 'Frame_Coated', bevel=(0.004, 2, 30)))
    parts.append(shaped('latch_lever', rbox((0.056, 0.005, 0.024), (0, -(hy - 0.0015), lid - 0.006), 0.0), 'Frame_Coated', bevel=(0.002, 2, 30)))
    parts.append(simple('latch_pin', tube([(-0.032, -(hy - 0.0015), lid + 0.008), (0.032, -(hy - 0.0015), lid + 0.008)], 0.003, 12), 'Exposed_Metal'))
    # quick-release rails and hangers to the chassis
    for sx in (1, -1):
        parts.append(shaped('rail', rbox((0.034, 0.40, 0.014), (sx * 0.13, 0, top + 0.006), 0.0), 'Frame_Coated', bevel=(0.003, 2, 30)))
        for sy in (1, -1):
            parts.append(simple('hanger', lathe([(0, top + 0.01), (0.010, top + 0.01), (0.010, -0.1), (0, -0.1)], 20,
                                                Matrix.Translation((sx * 0.13, sy * 0.15, 0))), 'Frame_Coated'))
            parts.append(simple('hanger_nut', lathe([(0, top + 0.011), (0.014, top + 0.011), (0.014, top + 0.021), (0, top + 0.021)], 6,
                                                    Matrix.Translation((sx * 0.13, sy * 0.15, 0))), 'Exposed_Metal'))
    return finish('Cargo_Case', parts, root)


def build_landing(root):
    F, R = 'Frame_Coated', 0.0155            # 31 mm coated tube
    X, Y, ZS, ZB = 0.33, 0.27, -0.62, -0.385  # skid line, post line, skid height, brace height
    parts = []
    for sx in (1, -1):
        x = sx * X
        for sy in (1, -1):
            y = sy * Y
            parts.append(simple('post', tube(fillet([(sx * 0.22, y, -0.098), (x, y, -0.205), (x, y, ZS)], 0.06), R, 20), F))
            parts.append(shaped('foot_bracket', rbox((0.07, 0.055, 0.03), (sx * 0.22, y, -0.098), 0.0), F, bevel=(0.005, 2, 30)))
            for z, axis in ((ZB, 'Z'), (ZS, 'Y')):
                d = (0, 0, 1) if axis == 'Z' else (0, 1, 0)
                parts.append(simple('collar', tube([Vector((x, y, z)) - Vector(d) * 0.025, Vector((x, y, z)) + Vector(d) * 0.025], 0.021, 24), F))
                parts.append(simple('collar_bolt', tube([Vector((x, y, z)) + Vector((sx * 0.018, 0, 0)), Vector((x, y, z)) + Vector((sx * 0.026, 0, 0))], 0.005, 6), 'Exposed_Metal'))
            parts.append(simple('pad', tube([(x, sy * 0.10, ZS), (x, sy * 0.22, ZS)], 0.019, 24), 'Rubber'))
        parts.append(simple('skid', tube(fillet([(x, -0.42, ZS + 0.04), (x, -0.36, ZS), (x, 0.36, ZS), (x, 0.42, ZS + 0.04)], 0.05), R, 20), F))
        for sy in (1, -1):
            parts.append(simple('cap', lathe([(0, -0.014), (0.0135, -0.014), (0.0165, -0.007), (0.0165, 0.005), (0, 0.005)], 20,
                                             frame_to((x, sy * 0.42, ZS + 0.04), (0, sy * 0.6, 0.8))), 'Rubber'))
        parts.append(simple('stiffener', tube([(x, -Y, ZB), (x, Y, ZB)], 0.012, 20), F))
    for sy in (1, -1):
        parts.append(simple('brace', tube([(-X, sy * Y, ZB), (X, sy * Y, ZB)], 0.012, 20), F))
        parts.append(simple('foot_tie', tube([(-X, sy * 0.30, ZS), (X, sy * 0.30, ZS)], 0.011, 20), F))
    return finish('Landing_Frame', parts, root)

# ---------------------------------------------------------------- arms, motors, rotors


def blade_bm(spin):
    """One thin cambered/twisted blade along +X. Leading edge faces the direction of travel and sits higher."""
    s = 1 if spin == 'CCW' else -1
    k = PROP_R / 0.3312                       # radial scale of the base planform
    bm = bmesh.new()
    na = 13
    xs = [(1 - math.cos(math.pi * i / (na - 1))) / 2 for i in range(na)]  # cosine-spaced chord points

    def foil(x, t):
        yt = 5 * t * (0.2969 * math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
        m, p = 0.035, 0.4
        yc = m / p ** 2 * (2 * p * x - x * x) if x < p else m / (1 - p) ** 2 * ((1 - 2 * p) + 2 * p * x - x * x)
        return yc, yt
    base = [0.022, 0.030, 0.042, 0.058, 0.075, 0.095] + [0.095 + (0.30 - 0.095) * i / 11 for i in range(1, 12)] + [0.312, 0.321, 0.3275, 0.3305]
    rings = []
    for rb in base:
        r = rb * k
        if rb <= 0.075:
            chord = 0.030 + (0.050 - 0.030) * (rb - 0.022) / (0.075 - 0.022)
        else:
            chord = 0.050 + (0.026 - 0.050) * (min(rb, 0.30) - 0.075) / (0.30 - 0.075)
        chord *= k * 1.55
        if rb > 0.30:
            chord *= math.sqrt(max(1 - ((rb - 0.30) / (0.3312 - 0.30)) ** 2, 0.02))
        thick = 0.20 - (0.20 - 0.075) * min((rb - 0.022) / 0.2, 1)
        theta = min(math.atan(0.30 * k / (2 * math.pi * r)), math.radians(24))
        sweep = -0.012 * k * max(0, (rb - 0.12) / 0.21) ** 2
        upper = [(x, sum(foil(x, thick))) for x in xs]
        lower = [(x, foil(x, thick)[0] - foil(x, thick)[1]) for x in reversed(xs[1:-1])]
        ring = []
        for x, z in upper + lower:
            t = (0.30 - x) * chord + sweep        # LE ahead of the pitch axis
            zz = z * chord
            tr = t * math.cos(theta) - zz * math.sin(theta)
            zr = t * math.sin(theta) + zz * math.cos(theta)
            ring.append(bm.verts.new((r, s * tr, zr)))
        rings.append(ring)
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def build_propeller(name, spin, parent, lower):
    """Rotating set: outrunner bell (faces the pod), hub, nut and two blades. Lower set mirrors bell/hub only;
    blades keep leading-edge-up pitch so both props push air downward."""
    f = -1 if lower else 1
    L = lambda prof: [(r, f * z) for r, z in (prof if not lower else reversed(prof))]
    parts = [simple('bell', lathe(L([(0, -0.060), (0.062, -0.060), (0.066, -0.056), (0.0668, -0.030), (0.063, -0.021), (0.034, -0.019), (0, -0.019)]), 48), 'Frame_Coated'),
             simple('bell_band', lathe(L([(0.0664, -0.050), (0.0676, -0.050), (0.0676, -0.040), (0.0664, -0.040)]), 48), 'Exposed_Metal'),
             simple('hub', lathe(L([(0, -0.020), (0.031, -0.020), (0.034, -0.015), (0.034, 0.011), (0.030, 0.018), (0.015, 0.022), (0, 0.0225)]), 40), 'Propeller'),
             simple('nut', lathe(L([(0, 0.019), (0.009, 0.019), (0.009, 0.028), (0.0072, 0.031), (0, 0.032)]), 6), 'Exposed_Metal')]
    for i in range(2):
        bm = blade_bm(spin)
        bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi * i, 3, 'Z'))
        me = to_mesh(bm, 'blade', 'Propeller')
        me.materials.append(MATS['PropTip'])
        for p in me.polygons:  # pale tip patch, identical on all sixteen blades
            if Vector((p.center.x, p.center.y)).length > 0.287 * PROP_R / 0.3312:
                p.material_index = 1
        parts.append(me)
    return finish('Propeller_' + name, parts, parent, sharp=35)


def build_station(root, name, sx, sy, spin):
    M = Vector((sx * MOTOR_X, sy * MOTOR_Y, 0))
    R = Vector((sx * ROOT_X, sy * ROOT_Y, ARM_Z))
    d = (Vector((M.x, M.y, 0)) - Vector((R.x, R.y, 0))).normalized()
    yaw = math.atan2(d.y, d.x)
    up = Vector((0, 0, 1))
    side = d.cross(up)
    L = lambda p: Vector(p) - M          # world -> arm local (arm origin at motor axis, z=0)
    Mz = lambda z: Vector((M.x, M.y, z))
    A = lambda t, z=0.0: R + d * t + up * z
    TR = TUBE_R
    arm_parts = [
        simple('tube', tube([L(A(0.03)), L(Mz(ARM_Z) - d * 0.05)], TR, 36, tile=0.024, caps=True), 'Carbon_Tube'),
        shaped('root_bracket', rbox((0.10, 0.10, 0.11), L(A(0.0, -0.004)), 0.0, rot_z=yaw), 'Frame_Coated', bevel=(0.008, 3, 30)),
        simple('hinge_pin', lathe([(0, -0.066), (0.0135, -0.066), (0.0135, 0.066), (0, 0.066)], 24, Matrix.Translation(L(A(0.02)))), 'Exposed_Metal'),
        simple('root_clamp', tube([L(A(0.06)), L(A(0.125))], TR + 0.011, 36), 'Frame_Coated'),
        shaped('clamp_lug', rbox((0.05, 0.022, 0.03), L(A(0.0925, TR + 0.016)), 0.0, rot_z=yaw), 'Frame_Coated', bevel=(0.004, 2, 30)),
        simple('clamp_bolt', tube([L(A(0.0925, TR + 0.016) - side * 0.016), L(A(0.0925, TR + 0.016) + side * 0.016)], 0.0045, 12), 'Exposed_Metal'),
        # folding joint: split collars around a knuckle with a latch lever
        simple('fold_collar', tube([L(A(0.19)), L(A(0.232))], TR + 0.009, 36), 'Frame_Coated'),
        simple('fold_collar', tube([L(A(0.238)), L(A(0.28))], TR + 0.009, 36), 'Frame_Coated'),
        shaped('fold_knuckle', rbox((0.07, 0.05, 0.034), L(A(0.235, -(TR + 0.012))), 0.0, rot_z=yaw), 'Frame_Coated', bevel=(0.005, 2, 30)),
        simple('fold_pin', tube([L(A(0.235, -(TR + 0.012)) - side * 0.03), L(A(0.235, -(TR + 0.012)) + side * 0.03)], 0.006, 16), 'Exposed_Metal'),
        shaped('fold_lever', rbox((0.085, 0.018, 0.012), L(A(0.235, TR + 0.012)), 0.0, rot_z=yaw), 'Frame_Coated', bevel=(0.003, 2, 30)),
        simple('warning_band', tube([L(A(0.30)), L(A(0.316))], TR + 0.0006, 36), 'WarningYellow'),
        simple('pod_clamp', tube([L(Mz(ARM_Z) - d * 0.135), L(Mz(ARM_Z) - d * 0.088)], TR + 0.008, 36), 'Frame_Coated'),
        simple('cable_boot', tube([L(A(0.04, -0.045)), L(A(0.09, -0.04))], 0.008, 12), 'Rubber'),
    ]
    # finned electronics module astride the tube near the motor pod
    c = Mz(ARM_Z) - d * 0.215
    arm_parts.append(shaped('esc', rbox((0.10, 0.078, 0.078), L(c), 0.0, rot_z=yaw), 'Frame_Coated', bevel=(0.006, 3, 30)))
    for i in range(7):
        off = (i - 3) * 0.0105
        arm_parts.append(shaped('fin', rbox((0.09, 0.0035, 0.018), L(c + side * off + up * 0.045), 0.0, rot_z=yaw), 'Frame_Coated', bevel=(0.001, 1, 30)))
    arm = finish('Arm_' + name, arm_parts, root, loc=M)

    led = 'LED_Red' if sx > 0 else 'LED_Green'
    zc = ARM_Z
    ring = [(0, 0.000), (0.070, 0.000), (0.0728, 0.005), (0.0728, 0.016), (0.067, 0.020), (0, 0.020)]
    pod_parts = [
        simple('pod', lathe([(0, zc - 0.12), (0.042, zc - 0.12), (0.065, zc - 0.112), (0.082, zc - 0.092), (0.090, zc - 0.058), (0.093, zc),
                             (0.090, zc + 0.058), (0.082, zc + 0.092), (0.065, zc + 0.112), (0.042, zc + 0.12), (0, zc + 0.12)], 64), 'Motor_Pod'),
        simple('top_ring', lathe([(r, zc + 0.118 + z) for r, z in ring], 64), 'Frame_Coated'),
        simple('bottom_ring', lathe([(r, zc - 0.118 - z) for r, z in reversed(ring)], 64), 'Frame_Coated'),
        simple('top_collar', lathe([(0, zc + 0.136), (0.026, zc + 0.136), (0.026, zc + 0.146), (0, zc + 0.146)], 32), 'Exposed_Metal'),
        simple('bottom_collar', lathe([(0, zc - 0.146), (0.026, zc - 0.146), (0.026, zc - 0.136), (0, zc - 0.136)], 32), 'Exposed_Metal'),
    ]
    out = Vector((d.x, d.y, 0))
    led_m = frame_to(out * 0.0885 + Vector((0, 0, zc - 0.05)), out + Vector((0, 0, -0.35)))
    pod_parts.append(simple('led', lathe([(0, -0.004), (0.008, -0.004), (0.008, 0.0015), (0.0055, 0.0038), (0, 0.0046)], 24, led_m), led))
    finish('Motor_Static_' + name, pod_parts, arm)

    # Coaxial pair on one shaft axis: upper and lower props counter-rotate.
    for level, z, direction in (('Upper', UPPER_Z, spin), ('Lower', LOWER_Z, 'CCW' if spin == 'CW' else 'CW')):
        rotor = empty(f'Rotor_{name}_{level}', arm, (0, 0, z), 0.08)
        rotor['spin_direction'] = direction
        rotor['raven_rotor'] = True
        build_propeller(f'{name}_{level}', direction, rotor, level == 'Lower')
    return arm


def build():
    build_materials()
    root = empty('Raven_Root', None, (0, 0, 0), 0.3)
    root['raven_variant'] = 'coaxial-quad'
    build_body(root)
    build_deck(root)
    build_optics(root)
    build_case(root)
    build_landing(root)
    for name, (sx, sy, spin) in STATIONS.items():
        build_station(root, name, sx, sy, spin)
    leftovers = [o for o in SC.objects if o.name.startswith('RQ_tmp')]
    assert not leftovers, leftovers
    return root


ROOT_OBJ = build()
if not bpy.app.background:
    try:
        bpy.context.window.scene = SC
    except Exception:
        pass
print('RQ_BUILD objects', len(SC.objects), 'tris', sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in SC.objects if o.type == 'MESH'))
if not FAST:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'raven-quad.blend'))
    print('RQ_SAVED', os.path.join(OUT, 'raven-quad.blend'))
