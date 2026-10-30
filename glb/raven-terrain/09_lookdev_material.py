"""Raven terrain 09 (look-dev): ground material `M_RT_Lookdev` (reference: golden-hour aerial of green karst hills).
Golden lit meadow with tuft detail and dry crests, dark forest floor, grey cracked limestone with lichen (on steep
faces only), asphalt road core with dirt shoulders/spur tracks, terrace plots and walls.
All noise is sampled on a flat 4D torus built from UV (periodic across tile edges). Uses `NB` from 03, `RT_Masks`,
`RT_Eco`.
"""
import bpy, math


def build_lookdev_material(g):
    NB = g['NB']
    m = bpy.data.materials.get('M_RT_Lookdev') or bpy.data.materials.new('M_RT_Lookdev')
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); b = NB(nt)
    uvn = b.n('ShaderNodeUVMap', -2400, 0); uvn.uv_map = 'UVMap'
    sep = b.n('ShaderNodeSeparateXYZ', -2200, 0, Vector=uvn.outputs[0])
    TP = 2 * math.pi; R = 400.0 / TP
    au = b.math('MULTIPLY', sep.outputs[0], TP); av = b.math('MULTIPLY', sep.outputs[1], TP)
    comb = b.n('ShaderNodeCombineXYZ', -2000, 0, X=b.math('MULTIPLY', b.math('COSINE', au), R),
               Y=b.math('MULTIPLY', b.math('SINE', au), R), Z=b.math('MULTIPLY', b.math('COSINE', av), R))
    tw = b.math('MULTIPLY', b.math('SINE', av), R)

    def nz(scale, detail, rough, off):
        n = nt.nodes.new('ShaderNodeTexNoise'); n.noise_dimensions = '4D'
        b.link(comb.outputs[0], n.inputs['Vector']); b.link(b.math('ADD', tw, off), n.inputs['W'])
        n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        return n.outputs['Fac']

    def vz(scale, off, feature='F1'):
        n = nt.nodes.new('ShaderNodeTexVoronoi'); n.voronoi_dimensions = '4D'; n.feature = feature
        b.link(comb.outputs[0], n.inputs['Vector']); b.link(b.math('ADD', tw, off), n.inputs['W'])
        n.inputs['Scale'].default_value = scale; return n.outputs['Distance']

    macro = nz(1 / 30.0, 4, 0.55, 3.0); meso = nz(1 / 6.0, 6, 0.6, 31.0); micro = nz(1 / 0.8, 8, 0.7, 77.0)
    fine = nz(1 / 0.3, 4, 0.7, 123.0); tufts = vz(1 / 0.25, 9.0); cracks = vz(1 / 0.7, 17.0, 'DISTANCE_TO_EDGE')
    strata = nz(1 / 2.5, 3, 0.5, 41.0)

    def tex(img):
        t = b.n('ShaderNodeTexImage', -1700, -900); t.image = img; t.interpolation = 'Cubic'
        b.link(uvn.outputs[0], t.inputs['Vector']); return t
    mk = tex(bpy.data.images['RT_Masks']); eco = tex(bpy.data.images['RT_Eco'])
    ms = b.n('ShaderNodeSeparateColor', Color=mk.outputs['Color']); es = b.n('ShaderNodeSeparateColor', Color=eco.outputs['Color'])
    road, field, riser = ms.outputs[0], ms.outputs[1], ms.outputs[2]; variant = mk.outputs['Alpha']
    forest, rock = es.outputs[0], es.outputs[1]; dry = eco.outputs['Alpha']
    # meadow: lush hollows -> golden lit slopes -> dry gold crests, darker gaps between tufts
    lush = b.mix(macro, (0.045, 0.085, 0.012), (0.085, 0.13, 0.018))
    gold = b.mix(meso, (0.14, 0.17, 0.025), (0.21, 0.21, 0.035))
    meadow = b.mix(b.math('MULTIPLY', b.math('ADD', macro, b.math('MULTIPLY', meso, 0.5)), 0.9, clamp=True), lush, gold)
    meadow = b.mix(b.math('MULTIPLY', dry, 0.8), meadow, (0.26, 0.23, 0.07))
    tuft = b.math('MULTIPLY', b.math('SUBTRACT', 1.0, b.math('MULTIPLY', tufts, 1.4, clamp=True)), 0.16)
    meadow = b.mix(tuft, meadow, (0.03, 0.05, 0.01))
    floor = b.mix(micro, (0.012, 0.02, 0.008), (0.03, 0.04, 0.014))
    lime = b.mix(b.math('MULTIPLY', b.math('ADD', strata, b.math('MULTIPLY', micro, 0.5)), 0.9, clamp=True),
                 (0.20, 0.195, 0.18), (0.46, 0.45, 0.41))
    lime = b.mix(b.math('MULTIPLY', b.math('SUBTRACT', 1.0, b.math('MULTIPLY', cracks, 22.0, clamp=True)), 0.8), lime,
                 (0.06, 0.055, 0.05))
    lichen = b.math('GREATER_THAN', b.math('ADD', fine, b.math('MULTIPLY', meso, 0.5)), 1.05)
    lime = b.mix(b.math('MULTIPLY', lichen, 0.6), lime, (0.16, 0.18, 0.08))
    asphalt = b.mix(fine, (0.10, 0.10, 0.10), (0.15, 0.15, 0.145))
    dirt = b.mix(micro, (0.14, 0.11, 0.07), (0.22, 0.18, 0.12))
    fieldc = b.mix(b.math('GREATER_THAN', variant, 0.55), (0.09, 0.13, 0.02), (0.22, 0.19, 0.06))
    fieldc = b.mix(b.math('GREATER_THAN', variant, 0.85), fieldc, (0.12, 0.08, 0.045))
    col = b.mix(b.math('MULTIPLY', b.math('SUBTRACT', forest, 0.15), 1.6, clamp=True), meadow, floor)
    geo = b.n('ShaderNodeNewGeometry'); nzz = b.n('ShaderNodeSeparateXYZ', Vector=geo.outputs['Normal']).outputs['Z']
    steep = b.math('SUBTRACT', 1.0, nzz)
    rock_s = b.math('MULTIPLY', rock, b.math('MULTIPLY', b.math('SUBTRACT', steep, 0.06), 6.0, clamp=True))  # faces, not flats
    col = b.mix(rock_s, col, lime)
    col = b.mix(field, col, fieldc)
    col = b.mix(riser, col, (0.05, 0.05, 0.045))
    core = b.math('GREATER_THAN', road, 0.75)  # asphalt core; shoulders and spur tracks read as dirt
    col = b.mix(road, col, dirt)
    col = b.mix(core, col, asphalt)
    grain = b.n('ShaderNodeHueSaturation', Color=col, Value=b.math('ADD', 0.85, b.math('MULTIPLY', fine, 0.3)))
    bs = b.n('ShaderNodeBsdfPrincipled', 1200, 300)
    b.link(grain.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.9
    h = b.math('ADD', b.math('MULTIPLY', meso, 0.6), b.math('MULTIPLY', tufts, 0.1))
    h = b.math('ADD', h, b.math('MULTIPLY', rock_s, b.math('ADD', b.math('MULTIPLY', cracks, 3.0, clamp=True),
                                                             b.math('MULTIPLY', strata, 0.8))))
    h = b.math('ADD', h, b.math('MULTIPLY', riser, 0.6))
    bump = b.n('ShaderNodeBump', Height=h, Strength=0.7, Distance=0.5)
    b.link(bump.outputs[0], bs.inputs['Normal'])
    out = b.n('ShaderNodeOutputMaterial', 1500, 300); b.link(bs.outputs[0], out.inputs['Surface'])
    return m
