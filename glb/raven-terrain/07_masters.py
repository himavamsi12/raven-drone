"""Raven terrain 07 (look-dev): vegetation and rock masters in collections LD_Set_Trees / LD_Set_Bushes / LD_Set_Rocks
(excluded from the view layer; used only through the 08 instancers). Three broadleaf crowns + one fir, two bushes,
three limestone rocks. Colour variation per instance via Object Info > Random.
v03: broadleaf crowns use the CC0 Blend Swap 5671 leaf card (textures/blendswap-5671/, RAVEN_LEAF_TEX overrides):
box-projected onto the crown blob as leaf detail (`M_LD_Crown`, keeps the v02 shading and brightness) plus a few small
crossed leaf cards on the rim to break the outline. Dense full-size cards self-shaded in the low bake sun and merged
neighbouring crowns into one dark mass (forest patch ~40% darker than v02), so the cards stay sparse: 8 rim clumps
leave the forest ~9% darker than v02 (none: matched; measured on 1024 test bakes).
"""
import bpy, bmesh, math, os, random
from mathutils import Matrix, Vector, noise

LEAF_TEX = os.environ.get('RAVEN_LEAF_TEX') or os.path.join(
    os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd(),
    'textures', 'blendswap-5671', 'tree_leaves_128.webp')


def _coll(name, parent=None, exclude=False):
    sc = bpy.context.scene
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    par = parent or sc.collection
    if c.name not in par.children:
        par.children.link(c)
    if exclude:
        def find(lc):
            if lc.collection == c:
                return lc
            for ch in lc.children:
                r = find(ch)
                if r:
                    return r
        lc = find(bpy.context.view_layer.layer_collection)
        if lc:
            lc.exclude = True
    return c


def _mat(name, build):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bs.outputs[0], out.inputs[0]); build(nt, bs); return m


def _mix_mul(nt, a, b, fac):
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    ins = {s.identifier: s for s in mix.inputs}
    ins['Factor_Float'].default_value = fac
    nt.links.new(a, ins['A_Color']); nt.links.new(b, ins['B_Color'])
    return next(o for o in mix.outputs if o.identifier == 'Result_Color')


def _canopy(nt, bs):
    oi = nt.nodes.new('ShaderNodeObjectInfo'); ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(oi.outputs['Random'], ramp.inputs[0])
    e = ramp.color_ramp.elements
    e[0].color = (0.016, 0.034, 0.010, 1); e[1].color = (0.075, 0.105, 0.022, 1); e.new(0.55).color = (0.035, 0.068, 0.016, 1)
    vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 7.0
    nt.links.new(_mix_mul(nt, ramp.outputs[0], vor.outputs['Distance'], 0.55), bs.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.9
    nt.links.new(vor.outputs['Distance'], bump.inputs['Height']); nt.links.new(bump.outputs[0], bs.inputs['Normal'])
    bs.inputs['Roughness'].default_value = 0.85


def _leaf_tex(nt, box=False):
    img = bpy.data.images.load(LEAF_TEX, check_existing=True); img.alpha_mode = 'STRAIGHT'
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
    if box:  # crown blobs have no UVs: object-space box projection, ~1.3 leaf cards per unit
        tex.projection = 'BOX'; tex.projection_blend = 0.3
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1.3, 1.3, 1.3)
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs[0], tex.inputs['Vector'])
    return tex


def _tint(nt):
    oi = nt.nodes.new('ShaderNodeObjectInfo'); ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(oi.outputs['Random'], ramp.inputs[0])
    e = ramp.color_ramp.elements
    e[0].color = (0.016, 0.034, 0.010, 1); e[1].color = (0.075, 0.105, 0.022, 1); e.new(0.55).color = (0.035, 0.068, 0.016, 1)
    return ramp.outputs[0]


def _leaf_shade(nt, tex, gain):
    # leaf-card luminance around 1.0 (its mean is ~0.22 linear): the canopy ramp keeps the hue, the card adds detail
    bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(tex.outputs['Color'], bw.inputs[0])
    k = nt.nodes.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = gain
    nt.links.new(bw.outputs[0], k.inputs[0]); return k.outputs[0]


def _crown(nt, bs):
    tex = _leaf_tex(nt, box=True); shade = _leaf_shade(nt, tex, 7.0)
    # same balance as _canopy (ramp x 0.55 detail mix), the leaf card replacing the Voronoi cells
    nt.links.new(_mix_mul(nt, _tint(nt), shade, 0.55), bs.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.6
    nt.links.new(shade, bump.inputs['Height']); nt.links.new(bump.outputs[0], bs.inputs['Normal'])
    bs.inputs['Roughness'].default_value = 0.85


def _leaves(nt, bs):
    tex = _leaf_tex(nt)
    nt.links.new(_mix_mul(nt, _tint(nt), _leaf_shade(nt, tex, 7.0), 0.55), bs.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], bs.inputs['Alpha'])
    bs.inputs['Roughness'].default_value = 0.8


def _leaf_cards(bm, seed, canopy=0, leaves=2, clumps=8, core=1.0):
    """Sparse clumps of three small leaf cards (two crossed upright, one flat) on the crown rim, like the source
    pack's hand-placed clumps; they break the blob outline without shading the crown."""
    cv = {v for f in bm.faces if f.material_index == canopy for v in f.verts}
    c = sum((v.co for v in cv), Vector()) / len(cv)
    R = max((v.co - c).length for v in cv)
    for v in cv:
        v.co = c + (v.co - c) * core
    uv = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    rng = random.Random(seed)

    def card(p, rot, size):
        h = size / 2
        f = bm.faces.new([bm.verts.new(p + rot @ Vector(co)) for co in ((-h, 0, -h), (h, 0, -h), (h, 0, h), (-h, 0, h))])
        f.material_index = leaves
        for loop, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uv].uv = t

    for _ in range(clumps):
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1) * 0.75 + 0.25)).normalized()
        p = c + d * R * rng.uniform(0.8, 0.98); size = R * rng.uniform(0.4, 0.6); yaw = rng.uniform(0, math.pi)
        for q in range(2):
            card(p, Matrix.Rotation(yaw + q * math.pi / 2, 3, 'Z') @ Matrix.Rotation(rng.uniform(-0.6, 0.6), 3, 'X'), size)
        card(p, Matrix.Rotation(rng.uniform(0, 2 * math.pi), 3, 'Z') @ Matrix.Rotation(math.pi / 2 + rng.uniform(-0.3, 0.3), 3, 'X'), size)


def _conifer(nt, bs):
    oi = nt.nodes.new('ShaderNodeObjectInfo'); ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(oi.outputs['Random'], ramp.inputs[0])
    e = ramp.color_ramp.elements; e[0].color = (0.010, 0.024, 0.012, 1); e[1].color = (0.030, 0.052, 0.020, 1)
    nt.links.new(ramp.outputs[0], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.9


def _bark(nt, bs):
    bs.inputs['Base Color'].default_value = (0.05, 0.035, 0.022, 1); bs.inputs['Roughness'].default_value = 0.95


def _rock(nt, bs):
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n1 = nt.nodes.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 1.6; n1.inputs['Detail'].default_value = 8
    nt.links.new(tc.outputs['Object'], n1.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); nt.links.new(n1.outputs['Fac'], ramp.inputs[0])
    e = ramp.color_ramp.elements
    e[0].position = 0.3; e[0].color = (0.17, 0.165, 0.15, 1); e[1].position = 0.75; e[1].color = (0.44, 0.43, 0.39, 1)
    vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.feature = 'DISTANCE_TO_EDGE'; vor.inputs['Scale'].default_value = 2.2
    nt.links.new(tc.outputs['Object'], vor.inputs['Vector'])
    crack = nt.nodes.new('ShaderNodeMapRange'); crack.inputs['From Min'].default_value = 0.0; crack.inputs['From Max'].default_value = 0.06
    nt.links.new(vor.outputs['Distance'], crack.inputs['Value'])
    nt.links.new(_mix_mul(nt, ramp.outputs[0], crack.outputs[0], 0.75), bs.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.8
    nt.links.new(crack.outputs[0], bump.inputs['Height']); nt.links.new(bump.outputs[0], bs.inputs['Normal'])
    bs.inputs['Roughness'].default_value = 0.8


def _blob(bm, centre, rad, squash, seed, amp, subdiv):
    ret = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    for v in ret['verts']:
        d = v.co.normalized()
        n = noise.fractal(d * 1.7 + Vector((seed, seed * 0.37, 1.3)), 0.6, 2.0, 4)
        v.co = Vector((d.x * rad, d.y * rad, d.z * rad * squash)) * (1 + amp * n) + Vector(centre)
    return ret['verts']


def _mesh(name, coll, build, mats):
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    me = bpy.data.meshes.new(name); bm = bmesh.new(); build(bm); bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob); return ob


def build_masters():
    root = _coll('12_LOOKDEV')
    trees = _coll('LD_Set_Trees', root, exclude=True)
    bushes = _coll('LD_Set_Bushes', root, exclude=True)
    rocks = _coll('LD_Set_Rocks', root, exclude=True)
    canopy = _mat('M_LD_Canopy', _canopy); conifer = _mat('M_LD_Conifer', _conifer)
    bark = _mat('M_LD_Bark', _bark); rock = _mat('M_LD_Limestone', _rock); leaves = _mat('M_LD_Leaves', _leaves)
    crown = _mat('M_LD_Crown', _crown)

    def broadleaf(seed):
        def b(bm):
            _blob(bm, (0, 0, 1.45), 1.0, 0.82, seed, 0.28, 2)
            for f in bm.faces:
                f.material_index = 0
            r = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.09, radius2=0.06, depth=1.0)
            bmesh.ops.translate(bm, verts=r['verts'], vec=(0, 0, 0.5))
            for f in bm.faces:
                if all(v in r['verts'] for v in f.verts):
                    f.material_index = 1
            _blob(bm, (0.45 * math.cos(seed), 0.45 * math.sin(seed), 1.9), 0.62, 0.8, seed + 5, 0.3, 1)  # second lobe
            _leaf_cards(bm, int(seed * 1000))
        return b

    def fir(seed):
        def b(bm):
            for k, (z, r, h) in enumerate(((0.55, 0.85, 1.3), (1.25, 0.65, 1.15), (1.9, 0.42, 1.0))):
                c = bmesh.ops.create_cone(bm, cap_ends=True, segments=9, radius1=r, radius2=0.02, depth=h)
                for v in c['verts']:
                    v.co.x *= 1 + 0.12 * noise.noise(v.co * 3 + Vector((seed, k, 0)))
                    v.co.y *= 1 + 0.12 * noise.noise(v.co * 3 + Vector((k, seed, 0)))
                bmesh.ops.translate(bm, verts=c['verts'], vec=(0, 0, z + h / 2))
        return b

    _mesh('LD_Tree_A_broadleaf', trees, broadleaf(1.0), [crown, bark, leaves])
    _mesh('LD_Tree_B_broadleaf', trees, broadleaf(4.2), [crown, bark, leaves])
    _mesh('LD_Tree_C_broadleaf', trees, broadleaf(7.7), [crown, bark, leaves])
    _mesh('LD_Tree_D_fir', trees, fir(2.0), [conifer])
    _mesh('LD_Bush_A', bushes, lambda bm: _blob(bm, (0, 0, 0.32), 0.55, 0.62, 3.3, 0.3, 2), [canopy])
    _mesh('LD_Bush_B', bushes, lambda bm: _blob(bm, (0, 0, 0.28), 0.45, 0.7, 8.1, 0.35, 1), [canopy])
    for i, sd in enumerate((1.1, 2.9, 6.4)):
        _mesh(f'LD_Rock_{i}', rocks, lambda bm, sd=sd: _blob(bm, (0, 0, 0.05), 1.0, 0.55, sd, 0.45, 3), [rock])
    return trees, bushes, rocks
