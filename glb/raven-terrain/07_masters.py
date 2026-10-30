"""Raven terrain 07 (look-dev): vegetation and rock masters in collections LD_Set_Trees / LD_Set_Bushes / LD_Set_Rocks
(excluded from the view layer; used only through the 08 instancers). Three broadleaf crowns + one fir, two bushes,
three limestone rocks. Colour variation per instance via Object Info > Random.
"""
import bpy, bmesh, math
from mathutils import Vector, noise


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
    bark = _mat('M_LD_Bark', _bark); rock = _mat('M_LD_Limestone', _rock)

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

    _mesh('LD_Tree_A_broadleaf', trees, broadleaf(1.0), [canopy, bark])
    _mesh('LD_Tree_B_broadleaf', trees, broadleaf(4.2), [canopy, bark])
    _mesh('LD_Tree_C_broadleaf', trees, broadleaf(7.7), [canopy, bark])
    _mesh('LD_Tree_D_fir', trees, fir(2.0), [conifer])
    _mesh('LD_Bush_A', bushes, lambda bm: _blob(bm, (0, 0, 0.32), 0.55, 0.62, 3.3, 0.3, 2), [canopy])
    _mesh('LD_Bush_B', bushes, lambda bm: _blob(bm, (0, 0, 0.28), 0.45, 0.7, 8.1, 0.35, 1), [canopy])
    for i, sd in enumerate((1.1, 2.9, 6.4)):
        _mesh(f'LD_Rock_{i}', rocks, lambda bm, sd=sd: _blob(bm, (0, 0, 0.05), 1.0, 0.55, sd, 0.45, 3), [rock])
    return trees, bushes, rocks
