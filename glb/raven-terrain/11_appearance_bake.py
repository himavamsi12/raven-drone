"""Raven terrain 11 (look-dev): bake the full look into the runtime base map.

The runtime TerrainMaterial is unlit and samples one base map with planar UVs u=(x+200)/400, v=(y+200)/400, so a
straight-down orthographic render that spans exactly the tile footprint IS that map, texel for texel. Unlike a surface
bake it also records what stands on the ground (tree crowns, bushes, outcrops) with their shadows.
- 3x3 copies of ground + scatter + houses at exact 400 spacing: shadows and overhanging crowns continue across edges,
  and the scatter is identical per tile, so the result is periodic.
- Houses are real runtime geometry: they cast shadows but are hidden from the camera (no roofs painted on the ground).
- `fix_edges` (04) then makes opposite edge texels identical.
"""
import bpy, os
import numpy as np

SPACING = 400.0
SOURCES = ('RT_Natural_Hi', 'RT_Natural_Houses', 'LD_Scatter_Trees', 'LD_Scatter_Bushes', 'LD_Scatter_Rocks')


def setup_appearance_scene():
    sc = bpy.context.scene
    nb = bpy.data.collections.get('11_BAKE_neighbours') or bpy.data.collections.new('11_BAKE_neighbours')
    if nb.name not in sc.collection.children:
        sc.collection.children.link(nb)
    for o in list(nb.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in bpy.data.collections:
        c.hide_render = c.name not in ('10_SOURCE_natural', '11_BAKE_neighbours', '12_LOOKDEV',
                                       'LD_Set_Trees', 'LD_Set_Bushes', 'LD_Set_Rocks')
    for name in SOURCES:
        src = bpy.data.objects[name]
        src.location = (0, 0, 0); src.hide_render = False
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == dy == 0:
                    continue
                o = bpy.data.objects.new(f'{name}_nb{dx}{dy}', src.data)
                for m in src.modifiers:
                    if m.type == 'NODES':
                        o.modifiers.new(m.name, 'NODES').node_group = m.node_group
                o.location = (dx * SPACING, dy * SPACING, 0)
                nb.objects.link(o)
    for o in list(bpy.data.objects):
        if o.name.startswith('RT_Natural_Houses'):
            o.visible_camera = False  # shadows only
    cam = bpy.data.objects.get('RT_AppearanceCam')
    if not cam:
        cam = bpy.data.objects.new('RT_AppearanceCam', bpy.data.cameras.new('RT_AppearanceCam'))
        sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2 * 200.0
    cam.data.clip_start = 1.0; cam.data.clip_end = 200.0
    cam.data.shift_x = cam.data.shift_y = 0.0
    cam.location = (0, 0, 100.0); cam.rotation_euler = (0, 0, 0)  # looks -Z; image up = +Y = v
    sc.camera = cam
    return cam


def render_appearance(res, out_png, samples=128):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.render.resolution_x = sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    sc.render.pixel_aspect_x = sc.render.pixel_aspect_y = 1.0
    sc.render.film_transparent = False
    sc.render.use_compositing = False
    sc.cycles.samples = samples; sc.cycles.use_denoising = True
    sc.cycles.filter_width = 1.0
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '16'
    sc.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
    old = bpy.data.images.get('RT_Natural_Bake')
    if old:
        bpy.data.images.remove(old)
    img = bpy.data.images.load(out_png); img.name = 'RT_Natural_Bake'
    img.colorspace_settings.name = 'sRGB'
    return img  # packed by build_all only after fix_edges + save (see there)
