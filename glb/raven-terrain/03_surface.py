"""Raven terrain 03: mask image + procedural alpine source material for the natural tile.

Needs 01_terrain.py in the namespace (`g`) and `RT_Natural_Hi`.
Mask `RT_Masks` (non-colour, UV space = tile XY): R road/spur gravel, G terrace field region,
B terrace riser lines, A per-terrace field variant.
Material `M_RT_Alpine`: every noise is sampled on a flat (Clifford) torus built from UV, so colour at
u=0 equals u=1 and v=0 equals v=1: the texture tiles without a seam (the shipped one differs by ~0.07).
"""
import bpy, math
import numpy as np

RES = 2048


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def build_masks(g):
    N, HALF = g['N'], g['HALF']
    me = bpy.data.objects['RT_Natural_Hi'].data
    co = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get('co', co)
    H = co.reshape(N, N, 3)[:, :, 2]  # [j(y), i(x)]
    px = (np.arange(RES) + 0.5) / RES
    X, Y = np.meshgrid(-HALF + 2 * HALF * px, -HALF + 2 * HALF * px)  # rows = y
    # bilinear height from the source grid
    fi = (X + HALF) / (2 * HALF) * (N - 1); fj = (Y + HALF) / (2 * HALF) * (N - 1)
    i0 = np.clip(np.floor(fi).astype(int), 0, N - 2); j0 = np.clip(np.floor(fj).astype(int), 0, N - 2)
    ti = fi - i0; tj = fj - j0
    Z = (H[j0, i0] * (1 - ti) * (1 - tj) + H[j0, i0 + 1] * ti * (1 - tj)
         + H[j0 + 1, i0] * (1 - ti) * tj + H[j0 + 1, i0 + 1] * ti * tj)
    # roads
    rx = g['ROAD_X0'] + g['ROAD_A'] * np.sin(2 * np.pi * (Y + HALF) / (2 * HALF))
    road = 1 - smooth(0.6, 1.25, np.abs(X - rx))
    for pts, _, _, _ in g['SPUR_PATHS']:
        for (ax, ay, _), (bx, by, _) in zip(pts[:-1], pts[1:]):
            abx, aby = bx - ax, by - ay
            t = np.clip(((X - ax) * abx + (Y - ay) * aby) / (abx * abx + aby * aby), 0, 1)
            d = np.hypot(X - (ax + abx * t), Y - (ay + aby * t))
            road = np.maximum(road, 1 - smooth(0.4, 0.95, d))
    # terraces
    field = np.zeros_like(X); riser = np.zeros_like(X); variant = np.zeros_like(X)
    for (cx, cy, r, base, step) in g['POCKETS']:
        dx, dy = (X - cx) / g['ACROSS'], Y - cy  # same warped ellipse as pocket_d()
        d = np.hypot(dx, dy) * (1 + 0.12 * np.sin(dy * 0.15 + cx) * np.cos(dx * 0.11 + cy))
        wt = 1 - smooth(r * 0.45, r * 0.95, d)
        q = Z / step
        fr = q - np.floor(q)
        line = smooth(0.80, 0.86, fr) * (1 - smooth(0.92, 0.97, fr))
        field = np.maximum(field, wt)
        riser = np.maximum(riser, line * wt)
        # field variant: per terrace step and along-contour slot
        ang = np.arctan2(Y - cy, X - cx)
        slot = np.floor((ang + np.floor(q) * 0.37) * d / 8.0)  # plots run along each terrace
        h = np.sin(np.floor(q) * 12.9898 + slot * 78.233 + cx) * 43758.5453
        variant = np.where(wt > 0.01, h - np.floor(h), variant)
    edge = HALF - np.maximum(np.abs(X), np.abs(Y))
    keep = smooth(20, 32, edge)  # nothing distinctive in the seam strip except the through-road
    field *= keep; riser *= keep
    img = bpy.data.images.get('RT_Masks') or bpy.data.images.new('RT_Masks', RES, RES, alpha=True, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color'
    px4 = np.stack([road, field, riser, variant], -1).astype(np.float32)
    img.pixels.foreach_set(px4.ravel())
    img.update(); img.pack()
    print('masks road%', round(float((road > 0.5).mean()) * 100, 2), 'field%', round(float((field > 0.5).mean()) * 100, 2))
    return img


class NB:
    """Tiny node-building helper."""

    def __init__(self, nt):
        self.nt = nt

    def n(self, kind, x=0, y=0, **inputs):
        node = self.nt.nodes.new(kind); node.location = (x, y)
        for k, v in inputs.items():
            if isinstance(v, bpy.types.NodeSocket):
                self.nt.links.new(v, node.inputs[k])
            else:
                node.inputs[k].default_value = v
        return node

    def link(self, a, b):
        self.nt.links.new(a, b)

    def math(self, op, a, b=None, x=0, y=0, clamp=False):
        m = self.nt.nodes.new('ShaderNodeMath'); m.operation = op; m.location = (x, y); m.use_clamp = clamp
        for idx, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, bpy.types.NodeSocket):
                self.nt.links.new(v, m.inputs[idx])
            else:
                m.inputs[idx].default_value = v
        return m.outputs[0]

    def mix(self, fac, a, b, x=0, y=0):
        m = self.nt.nodes.new('ShaderNodeMix'); m.data_type = 'RGBA'; m.location = (x, y)
        ins = {s.identifier: s for s in m.inputs}
        for sock, v in ((ins['Factor_Float'], fac), (ins['A_Color'], a), (ins['B_Color'], b)):
            if isinstance(v, bpy.types.NodeSocket):
                self.nt.links.new(v, sock)
            else:
                sock.default_value = v if len(v) == 4 else (*v, 1)
        return next(o for o in m.outputs if o.identifier == 'Result_Color')


def build_material(mask_img):
    m = bpy.data.materials.get('M_RT_Alpine') or bpy.data.materials.new('M_RT_Alpine')
    m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    b = NB(nt)
    uvn = b.n('ShaderNodeUVMap', -2200, 0); uvn.uv_map = 'UVMap'
    sep = b.n('ShaderNodeSeparateXYZ', -2000, 0, Vector=uvn.outputs[0])
    TWO_PI = 2 * math.pi
    R = 400.0 / TWO_PI  # torus radius in tile units: noise Scale = cycles per tile unit
    au = b.math('MULTIPLY', sep.outputs[0], TWO_PI, -1800, 100)
    av = b.math('MULTIPLY', sep.outputs[1], TWO_PI, -1800, -100)
    comb = b.n('ShaderNodeCombineXYZ', -1500, 0,
               X=b.math('MULTIPLY', b.math('COSINE', au), R), Y=b.math('MULTIPLY', b.math('SINE', au), R),
               Z=b.math('MULTIPLY', b.math('COSINE', av), R))
    tw = b.math('MULTIPLY', b.math('SINE', av), R, -1500, -200)

    def noise(scale, detail=4.0, rough=0.55, y=0, offset=0.0, kind='ShaderNodeTexNoise'):
        node = nt.nodes.new(kind); node.location = (-1200, y)
        if kind == 'ShaderNodeTexNoise':
            node.noise_dimensions = '4D'
        else:
            node.voronoi_dimensions = '4D'
        b.link(comb.outputs[0], node.inputs['Vector'])
        b.link(b.math('ADD', tw, offset) if offset else tw, node.inputs['W'])
        node.inputs['Scale'].default_value = scale
        if kind == 'ShaderNodeTexNoise':
            node.inputs['Detail'].default_value = detail
            node.inputs['Roughness'].default_value = rough
        return node

    macro = noise(1 / 24.0, 3, 0.5, 600).outputs['Fac']
    meso = noise(1 / 5.0, 5, 0.6, 400, 31.0).outputs['Fac']
    micro = noise(1 / 0.9, 6, 0.65, 200, 77.0).outputs['Fac']
    crowns = noise(1 / 0.7, y=0, offset=13.0, kind='ShaderNodeTexVoronoi').outputs['Distance']
    clump = noise(1 / 7.0, 4, 0.6, -200, 55.0).outputs['Fac']
    gully = noise(1 / 6.0, 3, 0.5, -400, 91.0).outputs['Fac']
    fine = noise(1 / 0.35, 4, 0.7, -600, 123.0).outputs['Fac']  # ~1-2 texels at 2048: grain at hero scale

    geo = b.n('ShaderNodeNewGeometry', -2000, -500)
    tc = b.n('ShaderNodeTexCoord', -2000, -700)
    pos = b.n('ShaderNodeSeparateXYZ', -1800, -700, Vector=tc.outputs['Object'])
    z = pos.outputs['Z']
    nz = b.n('ShaderNodeSeparateXYZ', -1800, -500, Vector=geo.outputs['Normal']).outputs['Z']
    steep = b.math('SUBTRACT', 1.0, nz, -1600, -500)
    mtex = b.n('ShaderNodeTexImage', -1600, -900); mtex.image = mask_img; mtex.interpolation = 'Linear'
    b.link(uvn.outputs[0], mtex.inputs['Vector'])
    msep = b.n('ShaderNodeSeparateColor', -1300, -900, Color=mtex.outputs['Color'])
    road, field, riser = msep.outputs[0], msep.outputs[1], msep.outputs[2]
    variant = mtex.outputs['Alpha']

    # meadow: olive greens with dry yellow patches (alpine meadow / tundra grass)
    meadow = b.mix(b.math('MULTIPLY', macro, 1.3, clamp=True), (0.055, 0.075, 0.025), (0.13, 0.12, 0.045), -900, 600)
    meadow = b.mix(b.math('MULTIPLY', meso, 0.6), meadow, (0.035, 0.05, 0.02), -700, 600)
    # scree/soil and rock
    soil = b.mix(micro, (0.09, 0.075, 0.05), (0.15, 0.13, 0.10), -900, 300)
    rock = b.mix(b.math('MULTIPLY', meso, micro), (0.10, 0.10, 0.095), (0.26, 0.255, 0.24), -900, 150)
    # conifers: dark crowns with gaps
    crown_dark = b.math('SUBTRACT', 1.0, b.math('MULTIPLY', crowns, 2.2, clamp=True), -900, 0)
    forest = b.mix(crown_dark, (0.03, 0.035, 0.02), (0.012, 0.03, 0.014), -700, 0)
    snow = b.mix(micro, (0.36, 0.38, 0.42), (0.50, 0.52, 0.56), -900, -150)  # kept below the white cargo box
    gravel = b.mix(micro, (0.13, 0.12, 0.10), (0.21, 0.19, 0.16), -900, -300)
    # terrace fields: grass, hay, ploughed earth by variant
    fieldc = b.mix(b.math('GREATER_THAN', variant, 0.55), (0.10, 0.12, 0.035), (0.20, 0.17, 0.07), -900, -450)
    fieldc = b.mix(b.math('GREATER_THAN', variant, 0.85), fieldc, (0.10, 0.07, 0.045), -700, -450)
    wallc = (0.05, 0.05, 0.045)  # terrace retaining walls read as dark lines (R01)

    # masks
    rock_m = b.math('MULTIPLY', b.math('SUBTRACT', b.math('ADD', steep, b.math('MULTIPLY', meso, 0.15)), 0.24), 6.0, -1100, 100)
    rock_m = b.math('MINIMUM', b.math('MAXIMUM', rock_m, 0.0), 1.0)
    soil_m = b.math('MINIMUM', b.math('MAXIMUM', b.math('MULTIPLY', b.math('SUBTRACT', steep, 0.09), 8.0), 0.0), 1.0)
    forest_m = b.math('MULTIPLY', b.math('GREATER_THAN', b.math('ADD', b.math('MULTIPLY', clump, 1.0), b.math('MULTIPLY', z, -0.05)), 0.5), b.math('LESS_THAN', steep, 0.22), -1100, 0)
    forest_m = b.math('MULTIPLY', forest_m, b.math('SUBTRACT', 1.0, b.math('MAXIMUM', field, road)))
    # summit tips only, soft edges broken by fine grain (hard white blobs read as decals at the hero)
    snow_m = b.math('MULTIPLY', b.math('SUBTRACT', b.math('ADD', z, b.math('ADD', b.math('MULTIPLY', meso, 3.0), b.math('MULTIPLY', fine, 1.5))), 15.6), 0.9, -1100, -150, clamp=True)
    snow_m = b.math('MULTIPLY', snow_m, b.math('LESS_THAN', b.math('ADD', steep, b.math('MULTIPLY', micro, 0.2)), 0.38))

    col = b.mix(soil_m, meadow, soil, -400, 400)
    col = b.mix(forest_m, col, forest, -200, 400)
    col = b.mix(rock_m, col, rock, 0, 400)
    col = b.mix(snow_m, col, snow, 200, 400)
    col = b.mix(field, col, fieldc, 400, 400)
    col = b.mix(riser, col, wallc, 600, 400)
    col = b.mix(road, col, gravel, 800, 400)
    grain = b.n('ShaderNodeHueSaturation', 950, 400, Color=col, Value=b.math('ADD', 0.78, b.math('MULTIPLY', fine, 0.44)))
    col = grain.outputs['Color']

    bsdf = b.n('ShaderNodeBsdfPrincipled', 1100, 300)
    b.link(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.95
    # micro relief baked into the light: crowns, rocks, riser walls
    hgt = b.math('ADD', b.math('MULTIPLY', forest_m, b.math('MULTIPLY', crown_dark, 0.6)), b.math('ADD', b.math('MULTIPLY', rock_m, b.math('MULTIPLY', micro, 0.8)), b.math('ADD', b.math('MULTIPLY', riser, 0.5), b.math('MULTIPLY', b.math('MULTIPLY', steep, 6.0, clamp=True), b.math('SUBTRACT', 1.0, b.math('ABSOLUTE', b.math('SUBTRACT', b.math('MULTIPLY', gully, 2.0), 1.0)))))), 800, -200)
    hgt = b.math('ADD', hgt, b.math('MULTIPLY', fine, 0.35))
    bump = b.n('ShaderNodeBump', 1000, -200, Height=hgt, Strength=0.8, Distance=0.8)
    b.link(bump.outputs[0], bsdf.inputs['Normal'])
    out = b.n('ShaderNodeOutputMaterial', 1400, 300)
    b.link(bsdf.outputs[0], out.inputs['Surface'])
    return m
