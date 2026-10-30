"""Raven terrain 08 (look-dev): seeded jittered-grid scatter of the 07 masters by the 06 masks. Each set is one
point-cloud mesh (attributes scale / rot / variant) instanced by a small Geometry Nodes tree; instances are sunk into
the ground by `sink * scale`. ~53k trees, ~2k bushes, ~0.5k rocks per tile.
"""
import bpy, numpy as np


def _ground(Z, x, y, HALF=200.0):
    R = Z.shape[0]; d = 2 * HALF / R
    fx = (x + HALF) / d - 0.5; fy = (y + HALF) / d - 0.5
    i0 = np.floor(fx).astype(int); j0 = np.floor(fy).astype(int); tx = fx - i0; ty = fy - j0
    i0 %= R; j0 %= R; i1 = (i0 + 1) % R; j1 = (j0 + 1) % R
    return Z[j0, i0] * (1 - tx) * (1 - ty) + Z[j0, i1] * tx * (1 - ty) + Z[j1, i0] * (1 - tx) * ty + Z[j1, i1] * tx * ty


def _sample(mask, x, y, HALF=200.0):
    R = mask.shape[0]
    i = np.clip(((x + HALF) / (2 * HALF) * R).astype(int), 0, R - 1)
    j = np.clip(((y + HALF) / (2 * HALF) * R).astype(int), 0, R - 1)
    return mask[j, i]


def _instancer(name, coll):
    ng = bpy.data.node_groups.get(name)
    if ng:
        bpy.data.node_groups.remove(ng)
    ng = bpy.data.node_groups.new(name, 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes; L = ng.links
    gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    ci = N.new('GeometryNodeCollectionInfo'); ci.inputs['Collection'].default_value = coll
    ci.inputs['Separate Children'].default_value = True; ci.inputs['Reset Children'].default_value = True
    iop = N.new('GeometryNodeInstanceOnPoints')

    def attr(nm, dt):
        a = N.new('GeometryNodeInputNamedAttribute'); a.data_type = dt; a.inputs['Name'].default_value = nm; return a
    sc = attr('scale', 'FLOAT'); rt = attr('rot', 'FLOAT'); vr = attr('variant', 'INT')
    cx = N.new('ShaderNodeCombineXYZ'); L.new(rt.outputs['Attribute'], cx.inputs['Z'])
    L.new(gi.outputs[0], iop.inputs['Points']); L.new(ci.outputs[0], iop.inputs['Instance'])
    iop.inputs['Pick Instance'].default_value = True
    L.new(vr.outputs['Attribute'], iop.inputs['Instance Index'])
    L.new(cx.outputs[0], iop.inputs['Rotation']); L.new(sc.outputs['Attribute'], iop.inputs['Scale'])
    L.new(iop.outputs[0], go.inputs[0])
    return ng


def scatter(E, spacing, density, seed, scale_rng, variants, sink, name, coll_name, weights=None, HALF=200.0):
    rng = np.random.default_rng(seed)
    n = int(2 * HALF / spacing)
    gx, gy = np.meshgrid(np.arange(n), np.arange(n))
    x = -HALF + (gx.ravel() + rng.random(n * n)) * spacing
    y = -HALF + (gy.ravel() + rng.random(n * n)) * spacing
    keep = rng.random(n * n) < np.clip(density(x, y), 0, 1)
    x, y = x[keep], y[keep]
    s = rng.uniform(*scale_rng, len(x))
    z = _ground(E['Z'], x, y) - sink * s
    v = rng.choice(variants, len(x), p=weights)  # variants = master count (Collection Info children, by name)
    rot = rng.uniform(0, 6.2832, len(x))
    old = bpy.data.objects.get(name)
    if old:
        me_old = old.data; bpy.data.objects.remove(old, do_unlink=True); bpy.data.meshes.remove(me_old)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(x)); me.vertices.foreach_set('co', np.stack([x, y, z], -1).astype(np.float32).ravel())
    for nm, typ, data in (('scale', 'FLOAT', s), ('rot', 'FLOAT', rot), ('variant', 'INT', v)):
        a = me.attributes.new(nm, typ, 'POINT'); a.data.foreach_set('value', data.astype(np.int32 if typ == 'INT' else np.float32))
    ob = bpy.data.objects.new(name, me)
    bpy.data.collections['12_LOOKDEV'].objects.link(ob)
    gn = ob.modifiers.new('instancer', 'NODES'); gn.node_group = _instancer(name + '_GN', bpy.data.collections[coll_name])
    print(name, len(x))
    return ob


def build_scatter(E):
    F, K, B = E['forest'], E['rock'], E['bush']
    trees = scatter(E, 1.0, lambda x, y: _sample(F, x, y) ** 1.1 * 0.97, 21, (0.65, 1.5), 4, 0.12,
                    'LD_Scatter_Trees', 'LD_Set_Trees', weights=[0.3, 0.3, 0.25, 0.15])
    edge = lambda x, y: np.clip((_sample(F, x, y) - 0.05) * 4, 0, 1) * (1 - _sample(F, x, y)) * 0.25  # forest margins
    bush = scatter(E, 2.2, lambda x, y: np.clip(_sample(B, x, y) * 0.35 + edge(x, y), 0, 1), 22, (0.7, 1.6), 2, 0.1,
                   'LD_Scatter_Bushes', 'LD_Set_Bushes')
    rocks = scatter(E, 2.6, lambda x, y: _sample(K, x, y) * 0.55, 23, (0.8, 3.2), 3, 0.35,
                    'LD_Scatter_Rocks', 'LD_Set_Rocks')
    return trees, bush, rocks
