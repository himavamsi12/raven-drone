"""Raven terrain 05: runtime copies, house atlas bake and GLB export.

`Land-A` (runtime terrain): decimated copy of RT_Natural_Hi, boundary vertices locked (seam contract),
  identity transform, material `RavenTerrain` with the baked map as baseColorTexture.
`Houses`: copy of RT_Natural_Houses with a lightmapped atlas (`RavenHouses`), identity transform,
  same tile-local space as Land-A so it rides the same moving Tile group at runtime.
Export: glTF binary, +Y up, Draco (pos 14 / normal 10 / uv 12 bits), WebP images, no cameras/lights.
"""
import bpy, bmesh, os
import numpy as np

OUT = os.environ.get('RAVEN_TERRAIN_OUT', r'C:\Users\india\Documents\raven-terrain\exports')
TARGET_TRIS = 20000


def _free_name(name):
    """Runtime node names must be exact ('Land-A' is what Terrain.tsx reads); move guides aside."""
    o = bpy.data.objects.get(name)
    if o and not o.get('raven_runtime'):
        o.name = 'GUIDE_' + name


def runtime_terrain():
    _free_name('Land-A')
    src = bpy.data.objects['RT_Natural_Hi']
    coll = bpy.data.collections.get('20_RUNTIME_export') or bpy.data.collections.new('20_RUNTIME_export')
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    old = bpy.data.objects.get('Land-A')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    me = src.data.copy(); me.name = 'Land-A'
    ob = bpy.data.objects.new('Land-A', me); ob['raven_runtime'] = True
    coll.objects.link(ob)
    vg = ob.vertex_groups.new(name='seam_lock')
    edge = [v.index for v in me.vertices if max(abs(v.co.x), abs(v.co.y)) > 199.9]
    vg.add(edge, 1.0, 'REPLACE')
    mod = ob.modifiers.new('dec', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = TARGET_TRIS / len(me.polygons)
    mod.vertex_group = 'seam_lock'; mod.invert_vertex_group = True
    mod.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    new = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); new.name = 'Land-A'
    ob.modifiers.clear(); ob.data = new
    bpy.data.meshes.remove(me)
    new.name = 'Land-A'  # the source copy held the name until now
    ob.vertex_groups.clear()
    # collapse interpolates UVs as it moves vertices (measured up to ~10 texels off); re-project planar UVs
    uvl = new.uv_layers[0].data
    for loop in new.loops:
        x, y, _ = new.vertices[loop.vertex_index].co
        uvl[loop.index].uv = ((x + 200.0) / 400.0, (y + 200.0) / 400.0)
    # material: baked map only (runtime reads .map and swaps in TerrainMaterial)
    m = bpy.data.materials.get('RavenTerrain') or bpy.data.materials.new('RavenTerrain')
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = bpy.data.images['RT_Natural_Bake']
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tx.outputs['Color'], bs.inputs['Base Color']); nt.links.new(bs.outputs[0], out.inputs[0])
    bs.inputs['Roughness'].default_value = 1.0
    new.materials.clear(); new.materials.append(m)
    co = np.array([v.co[:] for v in new.vertices])
    b = co[np.max(np.abs(co[:, :2]), 1) > 199.9]
    print('Land-A tris', len(new.polygons), 'verts', len(new.vertices), 'boundary verts', len(b),
          'boundary z dev', float(np.abs(b[:, 2] - 2.189).max()))
    return ob


def runtime_houses(res=1024):
    src = bpy.data.objects['RT_Natural_Houses']
    coll = bpy.data.collections['20_RUNTIME_export']
    _free_name('Houses')
    old = bpy.data.objects.get('Houses')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    me = src.data.copy(); me.name = 'Houses'
    ob = bpy.data.objects.new('Houses', me); ob['raven_runtime'] = True
    coll.objects.link(ob)
    # atlas UVs
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    me.uv_layers.active = uv
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.01)
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def bake_houses(ob, res=1024, tex_dir=None):
    """Lightmapped atlas for `Houses` (Cycles DIFFUSE with the terrain source present for bounce/occlusion),
    then one shared material `RavenHouses` and no vertex colours (the runtime shader reads only the map)."""
    src = bpy.data.objects['RT_Natural_Houses']
    land = bpy.data.objects.get('Land-A')
    src.hide_render = True  # coincident with `Houses`: would occlude every bake ray
    if land:
        land.hide_render = True  # RT_Natural_Hi supplies the ground
    bpy.data.collections['20_RUNTIME_export'].hide_render = False
    img = bpy.data.images.get('RT_Houses_Bake')
    if img and tuple(img.size) != (res, res):
        bpy.data.images.remove(img); img = None
    img = img or bpy.data.images.new('RT_Houses_Bake', res, res, alpha=False)
    img.colorspace_settings.name = 'sRGB'
    for m in ob.data.materials:
        nt = m.node_tree
        n = nt.nodes.get('BAKE_TARGET') or nt.nodes.new('ShaderNodeTexImage')
        n.name = 'BAKE_TARGET'; n.image = img; nt.nodes.active = n
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.hide_render = False; ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT', 'COLOR'}, margin=4)
    src.hide_render = False
    if tex_dir:
        img.filepath_raw = os.path.join(tex_dir, 'raven-houses-bake-1k.png'); img.file_format = 'PNG'; img.save()
    m = bpy.data.materials.get('RavenHouses') or bpy.data.materials.new('RavenHouses')
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tx.outputs['Color'], bs.inputs['Base Color']); nt.links.new(bs.outputs[0], out.inputs[0])
    ob.data.materials.clear(); ob.data.materials.append(m)
    for p in ob.data.polygons:
        p.material_index = 0
    for a in list(ob.data.color_attributes):
        ob.data.color_attributes.remove(a)
    return img


def export(objs, name, draco=True, image_format='WEBP'):
    """v02 build: draco=False, image_format='AUTO' (PNG); encode.sh then applies WebP q80 + Draco with gltf-transform
    (Blender's WebP encoder broke edge-texel continuity at 4K; sharp's keeps it)."""
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.hide_set(False); o.select_set(True)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True,
        export_apply=True, export_texcoords=True, export_normals=True, export_materials='EXPORT',
        export_image_format=image_format, export_image_quality=90,
        export_cameras=False, export_lights=False, export_animations=False, export_extras=False,
        export_draco_mesh_compression_enable=draco, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12, export_draco_color_quantization=10)
    print('exported', path, os.path.getsize(path))
    return path
