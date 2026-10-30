"""Raven terrain 04: appearance bake for the natural tile (Cycles DIFFUSE: colour x direct+indirect light).

The runtime TerrainMaterial is unlit and outputs the base map, so the map carries the light
(the shipped `Textura-WaterFix` is baked the same way). Sun azimuth matches the scene sun
(SUN_POSITION (-40,100,-30) glTF -> Blender (-40,30,100)); elevation lowered to ~35 deg for readable relief.
The 8 neighbours sit at exact 400 spacing while baking (runtime is 399.75; that overlap is coplanar), so shadows and
sky occlusion continue across tile edges. Only collection 10_SOURCE_natural + bake helpers render.
"""
import bpy, math
from mathutils import Vector

SPACING = 400.0  # exact while baking: the runtime 399.75 overlap is coplanar and darkens edge texels
SUN_DIR = Vector((-40.0, 30.0, 35.0)).normalized()  # same azimuth as the scene sun, ~35 deg for relief


def setup_bake_scene():
    sc = bpy.context.scene
    for c in bpy.data.collections:
        c.hide_render = c.name not in ('10_SOURCE_natural', '11_BAKE_neighbours')
    for o in sc.collection.objects:
        o.hide_render = o.type != 'LIGHT'
    nb = bpy.data.collections.get('11_BAKE_neighbours') or bpy.data.collections.new('11_BAKE_neighbours')
    if nb.name not in sc.collection.children:
        sc.collection.children.link(nb)
    for o in list(nb.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    src = [bpy.data.objects['RT_Natural_Hi'], bpy.data.objects['RT_Natural_Houses']]
    for o in src:
        o.location = (0, 0, 0); o.hide_render = False
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx == dy == 0:
                continue
            for o in src:
                c = bpy.data.objects.new(f'{o.name}_nb{dx}{dy}', o.data)
                c.location = (dx * SPACING, dy * SPACING, 0)
                nb.objects.link(c)
    sun = bpy.data.objects.get('BakeSun')
    if not sun:
        sun = bpy.data.objects.new('BakeSun', bpy.data.lights.new('BakeSun', 'SUN'))
        sc.collection.objects.link(sun)
    sun.hide_render = False
    sun.rotation_euler = SUN_DIR.to_track_quat('Z', 'Y').to_euler()
    sun.data.energy = 4.2; sun.data.angle = math.radians(2.0)
    sun.data.color = (1.0, 0.97, 0.92)
    if not sc.world:
        sc.world = bpy.data.worlds.new('RT_Bake_World')
    sc.world.use_nodes = True
    w = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
    w.inputs[0].default_value = (0.55, 0.68, 0.85, 1); w.inputs[1].default_value = 0.28
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'GPU'
    sc.cycles.samples = 256
    sc.view_settings.view_transform = 'Standard'


def bake(res=2048, name='RT_Natural_Bake'):
    sc = bpy.context.scene
    ob = bpy.data.objects['RT_Natural_Hi']
    img = bpy.data.images.get(name)
    if img and tuple(img.size) != (res, res):
        bpy.data.images.remove(img); img = None
    img = img or bpy.data.images.new(name, res, res, alpha=False)
    img.colorspace_settings.name = 'sRGB'
    mat = ob.data.materials[0]
    node = mat.node_tree.nodes.get('BAKE_TARGET') or mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.name = 'BAKE_TARGET'; node.image = img; node.location = (1400, -300)
    mat.node_tree.nodes.active = node
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    b = sc.render.bake
    b.use_pass_direct = b.use_pass_indirect = b.use_pass_color = True
    b.margin = 8; b.use_clear = True
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT', 'COLOR'}, margin=8)
    fix_edges(img)
    return img


def fix_edges(img, band=2):
    """Edge texels are half covered by the UV square: copy the first clean texel outward, then make
    opposite edges identical so REPEAT/linear filtering across a tile seam sees one colour."""
    import numpy as np
    W = img.size[0]
    a = np.empty(W * W * 4, dtype=np.float32); img.pixels.foreach_get(a); a = a.reshape(W, W, 4)
    for k in range(band):
        a[:, k] = a[:, band]; a[:, W - 1 - k] = a[:, W - 1 - band]
        a[k, :] = a[band, :]; a[W - 1 - k, :] = a[W - 1 - band, :]
    for k in range(band + 1):
        m = 0.5 * (a[:, k] + a[:, W - 1 - k]); a[:, k] = m; a[:, W - 1 - k] = m
        m = 0.5 * (a[k, :] + a[W - 1 - k, :]); a[k, :] = m; a[W - 1 - k, :] = m
    img.pixels.foreach_set(a.ravel()); img.update()
