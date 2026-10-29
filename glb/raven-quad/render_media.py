"""Raven site imagery that replaces the delta-jet renders (Blender 5.2, Cycles). Model is appended from raven-quad.blend.

  B=/Applications/Blender.app/Contents/MacOS/Blender
  $B --background --factory-startup --python glb/raven-quad/render_media.py -- cards [--only mountain] [--samples 128]
  $B --background --factory-startup --python glb/raven-quad/render_media.py -- demo
  $B --background --factory-startup --python glb/raven-quad/render_media.py -- seq [--frames 1-96] [--samples 48]

PNG output goes to glb/raven-quad/media/ (encoding to the site's webp/avif happens afterwards).
Landscapes are procedural (numpy height fields); no third-party imagery.
"""
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND = os.path.join(ROOT, 'glb', 'raven-quad', 'raven-quad.blend')
OUT = os.path.join(ROOT, 'glb', 'raven-quad', 'media')
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = ARGS[0] if ARGS else 'cards'
opt = lambda k, d: ARGS[ARGS.index(k) + 1] if k in ARGS else d
PREVIEW = '--preview' in ARGS
os.makedirs(OUT, exist_ok=True)

# Shipped footer drone y-offset per frame in a 1920px frame (LandingSequence.tsx FRAME_Y, module 90999).
FRAME_Y = [
    -162, -124, -86, -49, -12, 24, 60, 96, 131, 166, 201, 235, 269, 303, 336, 368, 401, 432, 464, 495, 525, 555, 585, 614, 643, 672, 700, 727, 754, 781, 807,
    833, 858, 883, 907, 931, 955, 978, 1000, 1022, 1044, 1065, 1086, 1106, 1126, 1146, 1165, 1183, 1201, 1219, 1236, 1253, 1269, 1285, 1300, 1315, 1330, 1344,
    1357, 1370, 1383, 1396, 1408, 1419, 1430, 1441, 1451, 1461, 1470, 1479, 1488, 1496, 1504, 1511, 1519, 1525, 1532, 1537, 1543, 1548, 1553, 1558, 1562, 1566,
    1569, 1572, 1575, 1577, 1580, 1582, 1583, 1584, 1585, 1586, 1586, 1587,
]

# ---------------------------------------------------------------- common


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def scene_setup(w, h, samples):
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(sc.collection.children):
        bpy.data.collections.remove(c)
    bpy.data.orphans_purge(do_recursive=True)
    try:
        sc.render.engine = 'CYCLES'
    except TypeError as e:
        print('engine', e)
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:
        print('GPU unavailable, CPU render:', e)
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 35 if PREVIEW else 100
    if PREVIEW:
        sc.cycles.samples = min(samples, 24)
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'None'
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.5
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    world = bpy.data.worlds.new('RQ_World')
    world.use_nodes = True
    sc.world = world
    return sc


def load_raven(sc):
    with bpy.data.libraries.load(BLEND, link=False) as (src, dst):
        dst.collections = ['RQ_Model']
    sc.collection.children.link(dst.collections[0])
    root = bpy.data.objects['Raven_Root']
    rotors = [o for o in bpy.data.objects if o.name.startswith('Rotor_') and o.type == 'EMPTY']
    assert len(rotors) == 8, [o.name for o in rotors]
    return root, rotors


def spin(rotors, f0, f1, deg_per_frame=140):
    """Linear rotor keys so Cycles motion blur smears the blades (CW = negative turn viewed from above)."""
    for i, r in enumerate(rotors):
        r.rotation_mode = 'XYZ'
        sign = -1 if r.get('spin_direction') == 'CW' else 1
        phase = math.radians(37 * i)
        for f in (f0, f1):
            r.rotation_euler = (0, 0, phase + sign * math.radians(deg_per_frame) * (f - f0))
            r.keyframe_insert('rotation_euler', index=2, frame=f)
        try:
            r.cycles.motion_steps = 6
        except Exception:
            pass


def aim(o, target):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()


def camera(sc, loc, target, lens):
    cam = bpy.data.objects.new('RQ_Cam', bpy.data.cameras.new('RQ_Cam'))
    sc.collection.objects.link(cam)
    cam.location = loc
    aim(cam, target)
    cam.data.lens = lens
    cam.data.clip_start, cam.data.clip_end = 0.1, 20000
    sc.camera = cam
    return cam


def area(sc, name, loc, power, size, color=(1, 1, 1), target=(0, 0, 0)):
    d = bpy.data.lights.new('RQ_' + name, 'AREA')
    d.shape, d.size, d.size_y, d.energy, d.color = 'RECTANGLE', size[0], size[1], power, color
    o = bpy.data.objects.new('RQ_' + name, d)
    sc.collection.objects.link(o)
    o.location = loc
    aim(o, target)
    return o


def mat(name, color, rough=0.8, emission=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value = (*lin(color), 1)
    bs.inputs['Roughness'].default_value = rough
    if emission:
        bs.inputs['Emission Color'].default_value = (*lin(emission[0]), 1)
        bs.inputs['Emission Strength'].default_value = emission[1]
    return m


def haze(m, color, distance):
    """Aerial perspective: blend toward an emissive haze colour with camera distance (cheap, no volumes)."""
    nt = m.node_tree
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    surf = out.inputs['Surface'].links[0].from_socket
    cd = nt.nodes.new('ShaderNodeCameraData')
    k = nt.nodes.new('ShaderNodeMath'); k.operation = 'DIVIDE'; k.inputs[1].default_value = -distance
    nt.links.new(cd.outputs['View Distance'], k.inputs[0])
    e = nt.nodes.new('ShaderNodeMath'); e.operation = 'EXPONENT'
    nt.links.new(k.outputs[0], e.inputs[0])
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1
    nt.links.new(e.outputs[0], inv.inputs[1])
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (*lin(color), 1); em.inputs['Strength'].default_value = 1
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(inv.outputs[0], mix.inputs['Fac'])
    nt.links.new(surf, mix.inputs[1]); nt.links.new(em.outputs['Emission'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return m


def sky(sc, elevation, rotation, strength=1.0, air=1.0, aerosol=1.0, ozone=1.0, kind='MULTIPLE_SCATTERING'):
    nt = sc.world.node_tree
    bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    s = nt.nodes.new('ShaderNodeTexSky')
    s.sky_type = kind
    s.sun_elevation, s.sun_rotation = math.radians(elevation), math.radians(rotation)
    s.sun_disc = False
    for k, v in (('air_density', air), ('aerosol_density', aerosol), ('ozone_density', ozone)):
        if hasattr(s, k):
            setattr(s, k, v)
    nt.links.new(s.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    return s


def sun(sc, elevation, azimuth, strength, color='#ffffff', angle=0.6):
    d = bpy.data.lights.new('RQ_Sun', 'SUN')
    d.energy, d.color, d.angle = strength, lin(color), math.radians(angle)
    o = bpy.data.objects.new('RQ_Sun', d)
    sc.collection.objects.link(o)
    el, az = math.radians(elevation), math.radians(azimuth)
    to_sun = Vector((math.cos(el) * math.sin(az), math.cos(el) * math.cos(az), math.sin(el)))
    o.rotation_euler = to_sun.to_track_quat('Z', 'Y').to_euler()
    return o

# ---------------------------------------------------------------- terrain


def fft_noise(n, size_px, seed):
    rng = np.random.default_rng(seed)
    f2 = np.fft.fftfreq(n)[:, None] ** 2 + np.fft.fftfreq(n)[None, :] ** 2
    sigma = 1.0 / (math.pi * max(size_px, 0.5))
    out = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((n, n))) * np.exp(-f2 / (2 * sigma ** 2))))
    return (out - out.mean()) / (out.std() + 1e-9)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


class Terrain:
    def __init__(self, seed, n=512, xr=(-1800, 1800), yr=(-300, 3300), relief=1.0, valley_w=(110, 1100), floor=1.0):
        self.n, self.xr, self.yr = n, xr, yr
        xs, ys = np.linspace(*xr, n), np.linspace(*yr, n)
        X, Y = np.meshgrid(xs, ys)                       # rows = y
        n1, n2, n3, n4 = (fft_noise(n, s, seed + i) for i, s in enumerate((72, 24, 8, 2.5)))
        # broad ridged massifs; finer octaves add relief without needle peaks
        r = lambda v: np.clip(1 - np.abs(v), 0, None)
        ridge = 0.7 * r(n1) ** 1.4 + 0.22 * r(n2) ** 1.2 + 0.08 * (0.5 + 0.5 * n3)
        self.meander = lambda y: 140 * np.sin(y / 650.0) + 60 * np.sin(y / 230.0 + 1.0)
        d = np.abs(X - self.meander(Y))
        valley = sstep(valley_w[0], valley_w[1], d)
        far = sstep(700, 3200, Y)
        H = floor * (6 * n3 + 1.5 * n4) + valley * relief * (120 + 520 * ridge) + far * relief * (260 + 560 * ridge) + 18 * valley * n2
        self.X, self.Y, self.H = X, Y, H
        self.patch = fft_noise(n, 9, seed + 9)          # forest / clearing mask
        self.step = (xs[1] - xs[0], ys[1] - ys[0])
        gy, gx = np.gradient(H, self.step[1], self.step[0])
        self.nz = 1 / np.sqrt(1 + gx ** 2 + gy ** 2)

    def height(self, x, y):
        fx = (x - self.xr[0]) / self.step[0]; fy = (y - self.yr[0]) / self.step[1]
        i, j = int(np.clip(fy, 0, self.n - 2)), int(np.clip(fx, 0, self.n - 2))
        ty, tx = fy - i, fx - j
        H = self.H
        return float((H[i, j] * (1 - tx) + H[i, j + 1] * tx) * (1 - ty) + (H[i + 1, j] * (1 - tx) + H[i + 1, j + 1] * tx) * ty)

    def sample(self, grid, x, y):
        fx = int(np.clip((x - self.xr[0]) / self.step[0], 0, self.n - 1)); fy = int(np.clip((y - self.yr[0]) / self.step[1], 0, self.n - 1))
        return float(grid[fy, fx])

    def slope_nz(self, x, y):
        fx = int(np.clip((x - self.xr[0]) / self.step[0], 0, self.n - 1)); fy = int(np.clip((y - self.yr[0]) / self.step[1], 0, self.n - 1))
        return float(self.nz[fy, fx])

    def mesh(self, sc, material):
        n = self.n
        verts = np.stack([self.X.ravel(), self.Y.ravel(), self.H.ravel()], 1)
        idx = np.arange(n * n).reshape(n, n)
        quads = np.stack([idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]], -1).reshape(-1, 4)
        me = bpy.data.meshes.new('RQ_Terrain')
        me.vertices.add(len(verts)); me.vertices.foreach_set('co', verts.astype(np.float32).ravel())
        me.loops.add(quads.size); me.loops.foreach_set('vertex_index', quads.astype(np.int32).ravel())
        me.polygons.add(len(quads))
        me.polygons.foreach_set('loop_start', (np.arange(len(quads)) * 4).astype(np.int32))
        me.update(calc_edges=True)
        me.shade_smooth()
        me.materials.append(material)
        o = bpy.data.objects.new('RQ_Terrain', me)
        sc.collection.objects.link(o)
        return o


def terrain_material(name, grass, rock, snow, snowline, snow_slope=0.72, haze_color='#b8c6d6', haze_dist=2600, wet=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt, L = m.node_tree, m.node_tree.links
    bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep_n = nt.nodes.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Normal'], sep_n.inputs[0])
    sep_p = nt.nodes.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'], sep_p.inputs[0])
    noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 0.012; noise.inputs['Detail'].default_value = 8
    L.new(geo.outputs['Position'], noise.inputs['Vector'])
    fine = nt.nodes.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value = 0.35; fine.inputs['Detail'].default_value = 6
    L.new(geo.outputs['Position'], fine.inputs['Vector'])
    mid = nt.nodes.new('ShaderNodeTexNoise'); mid.inputs['Scale'].default_value = 0.0035; mid.inputs['Detail'].default_value = 4
    L.new(geo.outputs['Position'], mid.inputs['Vector'])
    crag = nt.nodes.new('ShaderNodeTexNoise'); crag.inputs['Scale'].default_value = 0.045; crag.inputs['Detail'].default_value = 10
    crag.inputs['Roughness'].default_value = 0.65
    L.new(geo.outputs['Position'], crag.inputs['Vector'])

    def ramp_mix(fac, a, b):
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
        L.new(fac, mx.inputs[0])
        for sock, v in ((mx.inputs[6], a), (mx.inputs[7], b)):     # colour A/B (names repeat per data type)
            if isinstance(v, str):
                sock.default_value = (*lin(v), 1)
            else:
                L.new(v, sock)
        return mx.outputs[2]

    def smooth(x, a, b):
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'
        mr.inputs['From Min'].default_value, mr.inputs['From Max'].default_value = a, b
        L.new(x, mr.inputs['Value'])
        return mr.outputs['Result']
    grass_var = ramp_mix(mid.outputs['Fac'], grass[0], grass[1])
    grass_var = ramp_mix(smooth(noise.outputs['Fac'], 0.35, 0.75), grass_var, grass[0])
    near = nt.nodes.new('ShaderNodeTexNoise'); near.inputs['Scale'].default_value = 0.09; near.inputs['Detail'].default_value = 6
    L.new(geo.outputs['Position'], near.inputs['Vector'])
    nf = nt.nodes.new('ShaderNodeMath'); nf.operation = 'MULTIPLY'; nf.inputs[1].default_value = 0.45
    L.new(smooth(near.outputs['Fac'], 0.4, 0.7), nf.inputs[0])
    grass_var = ramp_mix(nf.outputs[0], grass_var, grass[1])
    rock_f = smooth(sep_n.outputs['Z'], 0.86, 0.74)                 # steep -> rock
    base = ramp_mix(rock_f, grass_var, ramp_mix(noise.outputs['Fac'], rock[0], rock[1]))
    # snow: above snowline (noisy) on slopes flatter than snow_slope
    zn = nt.nodes.new('ShaderNodeMath'); zn.operation = 'MULTIPLY_ADD'
    L.new(noise.outputs['Fac'], zn.inputs[0]); zn.inputs[1].default_value = 160; L.new(sep_p.outputs['Z'], zn.inputs[2])
    hs = smooth(zn.outputs[0], snowline - 40, snowline + 60)
    ss = smooth(sep_n.outputs['Z'], snow_slope - 0.08, snow_slope + 0.04)
    sf = nt.nodes.new('ShaderNodeMath'); sf.operation = 'MULTIPLY'
    L.new(hs, sf.inputs[0]); L.new(ss, sf.inputs[1])
    col = ramp_mix(sf.outputs[0], base, snow)
    L.new(col, bs.inputs['Base Color'])
    rough = nt.nodes.new('ShaderNodeMapRange'); rough.inputs['To Min'].default_value, rough.inputs['To Max'].default_value = 0.92 - wet, 0.55
    L.new(sf.outputs[0], rough.inputs['Value']); L.new(rough.outputs['Result'], bs.inputs['Roughness'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35
    L.new(fine.outputs['Fac'], bump.inputs['Height'])
    cragb = nt.nodes.new('ShaderNodeBump'); cragb.inputs['Distance'].default_value = 6.0
    L.new(crag.outputs['Fac'], cragb.inputs['Height']); L.new(rock_f, cragb.inputs['Strength'])   # crags only on rock
    L.new(bump.outputs['Normal'], cragb.inputs['Normal']); L.new(cragb.outputs['Normal'], bs.inputs['Normal'])
    return haze(m, haze_color, haze_dist)


def merged(sc, name, parts, material):
    """parts: list of (template_verts (n,3), template_faces list, Matrix) -> one object (fast instancing)."""
    verts, faces, off = [], [], 0
    for tv, tf, M in parts:
        R = np.array(M.to_3x3()); t = np.array(M.translation)
        verts.append(tv @ R.T + t)
        faces.extend([[i + off for i in f] for f in tf])
        off += len(tv)
    me = bpy.data.meshes.new(name)
    me.from_pydata(np.concatenate(verts).tolist(), [], faces)
    me.update()
    me.shade_flat()
    me.materials.append(material)
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    return o


def cone(r, h, z0, segs=7):
    v = [(r * math.cos(2 * math.pi * k / segs), r * math.sin(2 * math.pi * k / segs), z0) for k in range(segs)] + [(0, 0, z0 + h)]
    f = [[k, (k + 1) % segs, segs] for k in range(segs)] + [list(reversed(range(segs)))]
    return v, f


def pine():
    v, f = [], []
    for r, h, z in ((0.42, 0.55, 0.12), (0.33, 0.48, 0.38), (0.22, 0.42, 0.62)):
        cv, cf = cone(r, h, z)
        f += [[i + len(v) for i in face] for face in cf]
        v += cv
    tv, tf = cone(0.05, 0.25, 0.0, 5)
    f += [[i + len(v) for i in face] for face in tf]
    v += tv
    return np.array(v), f


def house(w, d, h, roof):
    v = [(-w / 2, -d / 2, 0), (w / 2, -d / 2, 0), (w / 2, d / 2, 0), (-w / 2, d / 2, 0),
         (-w / 2, -d / 2, h), (w / 2, -d / 2, h), (w / 2, d / 2, h), (-w / 2, d / 2, h),
         (-w / 2 - 0.4, 0, h + roof), (w / 2 + 0.4, 0, h + roof)]
    walls = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [3, 2, 1, 0]]
    roofs = [[4, 5, 9, 8], [6, 7, 8, 9], [5, 6, 9], [7, 4, 8]]
    return np.array(v), walls, roofs


def forest(sc, T, rng, count, treeline, zone, tint, haze_color, haze_dist, keep_out=(), min_dist=70, size=(9, 17)):
    tv, tf = pine()
    parts = []
    tries = 0
    while len(parts) < count and tries < count * 40:
        tries += 1
        x, y = rng.uniform(*zone[0]), rng.uniform(*zone[1])
        if math.hypot(x, y) < min_dist or any(math.hypot(x - kx, y - ky) < kr for kx, ky, kr in keep_out):
            continue
        z = T.height(x, y)
        if z > treeline + rng.normal(0, 40) or T.slope_nz(x, y) < 0.8 or T.sample(T.patch, x, y) < -0.15:
            continue
        s = rng.uniform(*size)
        parts.append((tv, tf, Matrix.Translation((x, y, z - 0.4)) @ Matrix.Rotation(rng.uniform(0, 6.28), 4, 'Z') @ Matrix.Diagonal((s, s, s * rng.uniform(0.9, 1.25), 1))))
    m = haze(mat('RQ_Pine', tint, 0.9), haze_color, haze_dist)
    print('trees', len(parts))
    return merged(sc, 'RQ_Forest', parts, m)


def village(sc, T, rng, centre, n, radius, wall, roof, haze_color, haze_dist, lit=False):
    walls_p, roofs_p, win_p = [], [], []
    placed = []
    while len(placed) < n:
        a, r = rng.uniform(0, 6.28), radius * math.sqrt(rng.uniform(0.02, 1))
        x, y = centre[0] + r * math.cos(a), centre[1] + r * math.sin(a)
        if any(math.hypot(x - px, y - py) < 16 for px, py in placed):
            continue
        placed.append((x, y))
        w, d, h = rng.uniform(7, 11), rng.uniform(5.5, 8), rng.uniform(3.2, 5.5)
        v, wf, rf = house(w, d, h, rng.uniform(2.2, 3.4))
        M = Matrix.Translation((x, y, T.height(x, y) - 0.3)) @ Matrix.Rotation(rng.uniform(-0.5, 0.5) + (0 if rng.random() < .5 else 1.57), 4, 'Z')
        walls_p.append((v, wf, M)); roofs_p.append((v, rf, M))
        if lit:  # two small window panes on the long side
            for wx in (-w / 4, w / 4):
                pv = np.array([(wx - 0.6, -d / 2 - 0.05, 1.2), (wx + 0.6, -d / 2 - 0.05, 1.2), (wx + 0.6, -d / 2 - 0.05, 2.3), (wx - 0.6, -d / 2 - 0.05, 2.3)])
                win_p.append((pv, [[0, 1, 2, 3]], M))
    merged(sc, 'RQ_Walls', walls_p, haze(mat('RQ_Wall', wall, 0.85), haze_color, haze_dist))
    merged(sc, 'RQ_Roofs', roofs_p, haze(mat('RQ_Roof', roof, 0.7), haze_color, haze_dist))
    if win_p:
        merged(sc, 'RQ_Windows', win_p, mat('RQ_Window', '#2a1c0c', 0.4, emission=('#ffb45e', 6)))
    return placed


def in_view(cam, dist, right=0.0, up=0.0):
    """World point `dist` m along the camera axis, offset in camera right/up metres."""
    bpy.context.view_layer.update()
    M = cam.matrix_world
    return M.translation + M.to_3x3() @ Vector((right, up, -dist))


def place_drone(root, loc, yaw, pitch=0.0, roll=0.0):
    root.location = loc
    root.rotation_mode = 'ZXY'
    root.rotation_euler = (math.radians(pitch), math.radians(roll), math.radians(yaw))

# ---------------------------------------------------------------- mission cards


def card_mountain(samples):
    sc = scene_setup(1350, 1260, samples)
    root, rotors = load_raven(sc)
    rng = np.random.default_rng(7)
    T = Terrain(11, relief=1.0)
    hz, hd = '#a9bdd3', 5200
    T.mesh(sc, terrain_material('RQ_Ground', ('#3a4d24', '#6a6c33'), ('#58534a', '#857d70'), '#f3f5f8', snowline=560, haze_color=hz, haze_dist=hd))
    vx, vy = T.meander(520) + 230, 520
    village(sc, T, rng, (vx, vy), 22, 95, '#ebe5d8', '#3a3536', hz, hd)
    forest(sc, T, rng, 14000, 640, ((-1700, 1700), (60, 2600)), '#1d2c1a', hz, hd, keep_out=((vx, vy, 120),), min_dist=220)
    z0 = T.height(0, 0)
    cam = camera(sc, (0, 0, z0 + 110), (40, 900, z0 + 70), 32)
    place_drone(root, in_view(cam, 6.0, 0.9, -0.35), yaw=-125, pitch=5, roll=-6)
    spin(rotors, 1, 2)
    sky(sc, 17, 98, strength=0.7)
    sun(sc, 17, 98, 4.8, '#ffeccf')
    sc.view_settings.exposure = -0.35
    render(sc, 'card_mountain_villages')


def card_winter(samples):
    sc = scene_setup(1350, 1260, samples)
    root, rotors = load_raven(sc)
    rng = np.random.default_rng(21)
    T = Terrain(31, relief=0.85, valley_w=(160, 1200))
    hz = '#dfe6ee'
    T.mesh(sc, terrain_material('RQ_Ground', ('#e9eef4', '#dfe6ee'), ('#5b5f66', '#7b8088'), '#f4f7fa', snowline=-200, snow_slope=0.66,
                                haze_color=hz, haze_dist=900))
    # snow-covered road following the valley floor: dark compacted strip
    pts = [(T.meander(y) + 20, y) for y in np.linspace(-60, 2200, 160)]
    road = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy); nx, ny = -dy / L * 3.2, dx / L * 3.2
        v = np.array([(x0 - nx, y0 - ny, T.height(x0, y0) + 0.25), (x0 + nx, y0 + ny, T.height(x0, y0) + 0.25),
                      (x1 + nx, y1 + ny, T.height(x1, y1) + 0.25), (x1 - nx, y1 - ny, T.height(x1, y1) + 0.25)])
        road.append((v, [[0, 1, 2, 3]], Matrix()))
    merged(sc, 'RQ_Road', road, haze(mat('RQ_RoadMat', '#9aa3ad', 0.5), hz, 900))
    vx, vy = T.meander(640) - 110, 640
    village(sc, T, rng, (vx, vy), 12, 70, '#c9c2b6', '#f1f4f7', hz, 900, lit=True)
    forest(sc, T, rng, 5000, 700, ((-1700, 1700), (80, 2600)), '#4b5a55', hz, 900, keep_out=((vx, vy, 90),), size=(7, 14), min_dist=160)
    z0 = T.height(0, 0)
    cam = camera(sc, (8, -4, z0 + 38), (0, 500, z0 + 18), 35)
    place_drone(root, in_view(cam, 7.0, -0.9, -0.3), yaw=150, pitch=6, roll=5)
    spin(rotors, 1, 2)
    sky(sc, 7, 200, strength=0.55, air=1.6, aerosol=4.0)
    sun(sc, 7, 200, 1.1, '#ffe2c4', angle=4.0)
    sc.view_settings.exposure = 0.35
    render(sc, 'card_winter_access')


def card_clinic(samples):
    sc = scene_setup(1350, 1260, samples)
    root, rotors = load_raven(sc)
    rng = np.random.default_rng(5)
    T = Terrain(51, relief=0.55, valley_w=(220, 1300), floor=0.6)
    hz = '#6f7b98'
    T.mesh(sc, terrain_material('RQ_Ground', ('#42442b', '#69623c'), ('#55514b', '#716b62'), '#e3e8f0', snowline=240, haze_color=hz, haze_dist=1300))
    cx, cy = T.meander(60) + 45, 60
    gz = T.height(cx, cy)
    # health centre: low building, flat roof, lit windows, a neutral sign band (no protected emblems)
    bm_parts = []
    for (w, d, h, ox, oy) in ((26, 11, 4.2, 0, 0), (10, 9, 3.6, -13, 7)):
        v, wf, rf = house(w, d, h, 0.01)
        bm_parts.append((v, wf + rf, Matrix.Translation((cx + ox, cy + oy, gz - 0.2))))
    merged(sc, 'RQ_Clinic', bm_parts, haze(mat('RQ_ClinicWall', '#e6e3dc', 0.7), hz, 1600))
    wins = []
    for k in range(7):
        x = cx - 11 + k * 3.4
        wins.append((np.array([(x - 0.9, cy - 5.55, gz + 1.0), (x + 0.9, cy - 5.55, gz + 1.0), (x + 0.9, cy - 5.55, gz + 2.7), (x - 0.9, cy - 5.55, gz + 2.7)]), [[0, 1, 2, 3]], Matrix()))
    merged(sc, 'RQ_ClinicWindows', wins, mat('RQ_ClinicWin', '#2a1c0c', 0.3, emission=('#ffcf8a', 16)))
    band = np.array([(cx - 13, cy - 5.6, gz + 3.3), (cx + 13, cy - 5.6, gz + 3.3), (cx + 13, cy - 5.6, gz + 4.0), (cx - 13, cy - 5.6, gz + 4.0)])
    merged(sc, 'RQ_Band', [(band, [[0, 1, 2, 3]], Matrix())], mat('RQ_BandMat', '#2f6f73', 0.5))
    # gravel apron following the ground around building and pad
    ax0, ax1, ay0, ay1 = cx - 35, cx + 15, cy - 22, cy + 7
    G = 24
    av = [(ax0 + (ax1 - ax0) * i / (G - 1), ay0 + (ay1 - ay0) * j / (G - 1)) for j in range(G) for i in range(G)]
    av = np.array([(x, y, T.height(x, y) + 0.06) for x, y in av])
    af = [[j * G + i, j * G + i + 1, (j + 1) * G + i + 1, (j + 1) * G + i] for j in range(G - 1) for i in range(G - 1)]
    merged(sc, 'RQ_Apron', [(av, af, Matrix())], haze(mat('RQ_Gravel', '#4e4b46', 0.95), hz, 1300))
    # landing pad: dark disc, pale ring, edge lights
    px, py = cx - 26, cy - 12
    pz = T.height(px, py) + 0.14
    pad = []
    for r0, r1, mname, col, em in ((0, 7, 'RQ_Pad', '#2c2e33', None), (5.6, 6.1, 'RQ_PadRing', '#d9dde3', None)):
        segs = 48
        v = [(px + r * math.cos(2 * math.pi * k / segs), py + r * math.sin(2 * math.pi * k / segs), pz + (0.02 if r0 else 0)) for r in (r0 + 1e-3, r1) for k in range(segs)]
        f = [[k, (k + 1) % segs, segs + (k + 1) % segs, segs + k] for k in range(segs)]
        merged(sc, mname, [(np.array(v), f, Matrix())], mat(mname + 'M', col, 0.8))
    lights = []
    for k in range(12):
        a = 2 * math.pi * k / 12
        lv, lf = cone(0.18, 0.2, 0, 6)
        lights.append((np.array(lv), lf, Matrix.Translation((px + 7.3 * math.cos(a), py + 7.3 * math.sin(a), pz))))
    merged(sc, 'RQ_PadLights', lights, mat('RQ_PadLight', '#203a2a', 0.4, emission=('#7dff9a', 14)))
    village(sc, T, rng, (cx + 140, cy + 210), 9, 80, '#d7d1c6', '#38363a', hz, 1600, lit=True)
    camx, camy = cx - 70, cy - 150
    forest(sc, T, rng, 3500, 380, ((-1700, 1700), (120, 2600)), '#2a352a', hz, 1600,
           keep_out=((cx, cy, 160), (cx + 140, cy + 210, 110), (camx, camy, 90)), size=(6, 12))
    cam = camera(sc, (camx, camy, T.height(camx, camy) + 42), (cx - 8, cy + 20, gz + 4), 35)
    place_drone(root, in_view(cam, 6.4, -1.25, 0.55), yaw=-140, pitch=6, roll=-4)
    spin(rotors, 1, 2)
    sky(sc, 2.5, 5, strength=0.9, air=1.3, aerosol=2.5)
    sun(sc, 2.5, 5, 3.6, '#ff9a55', angle=1.0)
    sc.view_settings.exposure = 0.15
    render(sc, 'card_remote_health_centres')

# ---------------------------------------------------------------- demo


def demo(samples, only=None):
    for name, (w, h), cam_dist, shift in (('demo_desktop', (2030, 1288), 6.6, -0.10), ('demo_mobile', (1654, 800), 9.4, 0.25)):
        if only and only not in name:
            continue
        sc = scene_setup(w, h, samples)
        root, rotors = load_raven(sc)
        T = Terrain(71, n=300, xr=(-45, 45), yr=(-25, 70))
        n = T.n                                            # demo backdrop: low rolling ground, soft hills rising behind
        T.H = (0.45 * fft_noise(n, 30, 1) + 0.12 * fft_noise(n, 9, 2)
               + sstep(6, 62, T.Y) * (2.5 + 4.5 * (0.5 + 0.5 * fft_noise(n, 45, 3))))
        ground = bpy.data.materials.new('RQ_DemoGround'); ground.use_nodes = True
        nt = ground.node_tree; bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        bs.inputs['Base Color'].default_value = (0.0025, 0.0028, 0.0032, 1); bs.inputs['Roughness'].default_value = 0.9
        # topographic grid: world-space XY lines draped over the terrain (Cycles' Wireframe would draw triangle diagonals)
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs[0])
        spacing, width = 1.1, 0.012
        lines = []
        for axis in ('X', 'Y'):
            d = nt.nodes.new('ShaderNodeMath'); d.operation = 'DIVIDE'; d.inputs[1].default_value = spacing
            nt.links.new(sep.outputs[axis], d.inputs[0])
            fr = nt.nodes.new('ShaderNodeMath'); fr.operation = 'FRACT'; nt.links.new(d.outputs[0], fr.inputs[0])
            c = nt.nodes.new('ShaderNodeMath'); c.operation = 'SUBTRACT'; c.inputs[1].default_value = 0.5; nt.links.new(fr.outputs[0], c.inputs[0])
            ab = nt.nodes.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'; nt.links.new(c.outputs[0], ab.inputs[0])
            mr = nt.nodes.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'
            mr.inputs['From Min'].default_value = 0.5 - 1.6 * width / spacing
            mr.inputs['From Max'].default_value = 0.5 - 0.4 * width / spacing
            nt.links.new(ab.outputs[0], mr.inputs['Value'])
            lines.append(mr.outputs['Result'])
        mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'MAXIMUM'
        nt.links.new(lines[0], mx.inputs[0]); nt.links.new(lines[1], mx.inputs[1])
        em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (0.55, 0.62, 0.7, 1); em.inputs['Strength'].default_value = 0.22
        mix = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(mx.outputs[0], mix.inputs['Fac'])
        nt.links.new(bs.outputs['BSDF'], mix.inputs[1]); nt.links.new(em.outputs['Emission'], mix.inputs[2])
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'); nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
        haze(ground, '#000000', 30)
        t = T.mesh(sc, ground)
        t.location.z = -1.6
        place_drone(root, (0, 0, 0), yaw=-38, pitch=4, roll=-3)
        spin(rotors, 1, 2, 90)
        target = Vector((0, 0, -0.12))
        dirv = Vector((-0.62, -1, 0.42)).normalized()
        cam = camera(sc, target + dirv * cam_dist, target, 70)
        cam.data.shift_x = shift
        sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0
        area(sc, 'Key', (-3.5, -4.0, 3.4), 650, (2.5, 2.0), (1, 0.97, 0.93), (0, 0, -0.2))
        area(sc, 'Rim', (2.5, 3.5, 1.6), 900, (2.5, 1.2), (0.78, 0.86, 1.0), (0, 0, -0.1))
        area(sc, 'Top', (0, 0, 4), 300, (3, 3), (1, 1, 1), (0, 0, 0))
        sc.view_settings.exposure = -0.6
        render(sc, name)

# ---------------------------------------------------------------- footer landing sequence


def sequence(samples, frames):
    sc = scene_setup(1920, 1920, samples)
    # Shipped frames are RGBA with a transparent background; the footer blends them over the page and glow capsule.
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
    root, rotors = load_raven(sc)
    cam = camera(sc, (0, -8.9, -0.95), (0, 0, -0.32), 100)
    sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0
    area(sc, 'Key', (-4.5, -5.5, 3.5), 900, (3, 2.5), (1, 0.96, 0.9), (0, 0, -0.2))
    area(sc, 'Fill', (5, -4, -1.5), 260, (3, 3), (0.85, 0.9, 1.0), (0, 0, -0.2))
    area(sc, 'Rim', (0, 5, 2.5), 1100, (4, 1.5), (0.8, 0.88, 1.0), (0, 0, -0.1))
    area(sc, 'Top', (0, 0, 6), 500, (4, 4), (1, 1, 1), (0, 0, 0))
    sc.view_settings.exposure = -0.7
    anchor_local = Vector((0, 0, -0.5))                      # case bottom centre: where the shipped glow capsule sits
    n = len(FRAME_Y)
    for i in range(n):
        t = i / (n - 1)
        place_drone(root, (0, 0, 0), yaw=18, pitch=-7 * (1 - t) ** 2, roll=0)
        target = 1 - FRAME_Y[i] / 1920                         # camera-view y measured from the bottom
        lo, hi = -6.0, 12.0
        for _ in range(40):                                    # projection is monotonic in height: bisect
            mid = (lo + hi) / 2
            root.location.z = mid
            bpy.context.view_layer.update()
            y = world_to_camera_view(sc, cam, root.matrix_world @ anchor_local).y
            lo, hi = (mid, hi) if y < target else (lo, mid)
        root.keyframe_insert('location', frame=i + 1)
        root.keyframe_insert('rotation_euler', frame=i + 1)
    spin(rotors, 1, n + 1, 140)
    f0, f1 = frames
    sc.frame_start, sc.frame_end = f0, f1
    sc.render.filepath = os.path.join(OUT, 'seq', '####')
    os.makedirs(os.path.join(OUT, 'seq'), exist_ok=True)
    bpy.ops.render.render(animation=True)
    print('RQ_MEDIA seq', f0, f1, flush=True)


def render(sc, name):
    sc.frame_set(1)
    sc.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    print('RQ_MEDIA', name, flush=True)


samples = int(opt('--samples', 128))
if MODE == 'cards':
    only = opt('--only', None)
    for key, fn in (('mountain', card_mountain), ('winter', card_winter), ('clinic', card_clinic)):
        if not only or only == key:
            fn(samples)
elif MODE == 'demo':
    demo(samples, opt('--only', None))
elif MODE == 'seq':
    a, b = (int(v) for v in opt('--frames', '1-96').split('-'))
    sequence(int(opt('--samples', 48)), (a, b))
