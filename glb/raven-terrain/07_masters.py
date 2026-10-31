"""Raven terrain 07 (look-dev): vegetation and rock masters in collections LD_Set_Trees / LD_Set_Bushes / LD_Set_Rocks
(excluded from the view layer; used only through the 08 instancers). Three broadleaf crowns + one fir, two bushes,
three limestone rocks. Colour variation per instance via Object Info > Random.
v03: broadleaf crowns use the CC0 Blend Swap 5671 leaf card (textures/blendswap-5671/, RAVEN_LEAF_TEX overrides).
2026-10-31 (user: v03 crowns read as blobs from the hero camera): the crown blobs shrink to CROWN_CORE of their size
and only fill the gaps (`M_LD_Crown`, leaf card box-projected, tint x0.8); LEAF_CLUMPS clumps of three cards sit at
0.82-1.08 of the lobe radius facing outward, so the cards make the outline and the top. Leaves are 30% translucent
(back-lit cards glow instead of going black) and need transparent bounces >= 16. Earlier note: dense cards self-shaded
in the low bake sun (forest patch ~40% darker than v02 with full-size cards inside a full-size blob); re-check the
appearance bake brightness after this change.
"""
import bpy, bmesh, math, os, random
from mathutils import Matrix, Vector, noise

LEAF_TEX = os.environ.get('RAVEN_LEAF_TEX') or os.path.join(
    os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd(),
    'textures', 'blendswap-5671', 'tree_leaves_128.webp')
CROWN_CORE = 0.6
LEAF_CLUMPS = 46


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


def _tint(nt, k=1.0):
    oi = nt.nodes.new('ShaderNodeObjectInfo'); ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(oi.outputs['Random'], ramp.inputs[0])
    e = ramp.color_ramp.elements
    e[0].color = (0.016 * k, 0.034 * k, 0.010 * k, 1); e[1].color = (0.075 * k, 0.105 * k, 0.022 * k, 1)
    e.new(0.55).color = (0.035 * k, 0.068 * k, 0.016 * k, 1)
    return ramp.outputs[0]


def _leaf_shade(nt, tex, gain):
    # leaf-card luminance around 1.0 (its mean is ~0.22 linear): the canopy ramp keeps the hue, the card adds detail
    bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(tex.outputs['Color'], bw.inputs[0])
    k = nt.nodes.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = gain
    nt.links.new(bw.outputs[0], k.inputs[0]); return k.outputs[0]


def _crown(nt, bs):
    tex = _leaf_tex(nt, box=True); shade = _leaf_shade(nt, tex, 7.0)
    # same balance as _canopy (ramp x 0.55 detail mix), the leaf card replacing the Voronoi cells; darker: crown interior
    nt.links.new(_mix_mul(nt, _tint(nt, 0.8), shade, 0.55), bs.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.6
    nt.links.new(shade, bump.inputs['Height']); nt.links.new(bump.outputs[0], bs.inputs['Normal'])
    bs.inputs['Roughness'].default_value = 0.85


def _leaves(nt, bs):
    # mix: Transparent (alpha cut-out) <- [Principled 70% / Translucent 30%]; the template Principled stays the main lobe
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    tex = _leaf_tex(nt)
    col = _mix_mul(nt, _tint(nt, 1.15), _leaf_shade(nt, tex, 7.0), 0.55)
    nt.links.new(col, bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.6
    tr = nt.nodes.new('ShaderNodeBsdfTranslucent'); nt.links.new(col, tr.inputs['Color'])
    mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs[0].default_value = 0.3
    nt.links.new(bs.outputs[0], mx.inputs[1]); nt.links.new(tr.outputs[0], mx.inputs[2])
    tp = nt.nodes.new('ShaderNodeBsdfTransparent'); cut = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tex.outputs['Alpha'], cut.inputs[0]); nt.links.new(tp.outputs[0], cut.inputs[1])
    nt.links.new(mx.outputs[0], cut.inputs[2]); nt.links.new(cut.outputs[0], out.inputs[0])


def _leaf_cards(bm, seed, lobes, leaves=2, clumps=LEAF_CLUMPS):
    """Clumps of three fanned leaf cards facing outward from the crown lobes (two thirds on the main lobe), placed
    just inside to just outside each lobe surface so they form the silhouette and the top seen from the air."""
    uv = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    rng = random.Random(seed)

    def card(p, rot, size):
        h = size / 2
        f = bm.faces.new([bm.verts.new(p + rot @ Vector(co)) for co in ((-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0))])
        f.material_index = leaves
        for loop, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uv].uv = t

    for i in range(clumps):
        cen, rad, sq = lobes[0] if i < clumps * 0.68 else lobes[1]
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), abs(rng.gauss(0, 1)) * 0.9 + 0.15)).normalized()
        p = Vector(cen) + Vector((d.x * rad, d.y * rad, d.z * rad * sq)) * rng.uniform(0.82, 1.08)
        size = rad * rng.uniform(0.55, 0.8)
        base = d.to_track_quat('Z', 'Y').to_matrix()
        for _ in range(3):
            rot = base @ Matrix.Rotation(rng.uniform(-0.7, 0.7), 3, 'X') @ Matrix.Rotation(rng.uniform(-0.7, 0.7), 3, 'Y') \
                @ Matrix.Rotation(rng.uniform(0, 2 * math.pi), 3, 'Z')
            card(p + d * rng.uniform(-0.08, 0.08) * rad, rot, size)


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
            lobes = (((0, 0, 1.45), 1.0, 0.82, seed, 0.28, 2),
                     ((0.45 * math.cos(seed), 0.45 * math.sin(seed), 1.9), 0.62, 0.8, seed + 5, 0.3, 1))  # second lobe
            for lobe in lobes:
                c = Vector(lobe[0])
                for v in _blob(bm, *lobe):
                    v.co = c + (v.co - c) * CROWN_CORE
            for f in bm.faces:
                f.material_index = 0
            r = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.09, radius2=0.06, depth=1.2)
            bmesh.ops.translate(bm, verts=r['verts'], vec=(0, 0, 0.6))  # taller: the smaller core no longer hides it
            rv = set(r['verts'])
            for f in bm.faces:
                if all(v in rv for v in f.verts):
                    f.material_index = 1
            _leaf_cards(bm, int(seed * 1000), [lobe[:3] for lobe in lobes])
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
