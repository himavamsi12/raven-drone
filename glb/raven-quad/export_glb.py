"""Export the Raven_Root hierarchy only (no QA lights/cameras) as an uncompressed textured GLB.

  /Applications/Blender.app/Contents/MacOS/Blender --background glb/raven-quad/raven-quad.blend \
      --python glb/raven-quad/export_glb.py
"""
import bpy, os

out = os.path.join(os.path.dirname(bpy.data.filepath), 'raven-quad-textured.glb')
root = bpy.data.objects['Raven_Root']
for o in [root, *root.children_recursive]:
    if o.name.startswith('Rotor_'):
        assert tuple(o.rotation_euler) == (0.0, 0.0, 0.0), o.name  # rest pose; runtime owns spin
bpy.ops.object.select_all(action='DESELECT')
for o in [root, *root.children_recursive]:
    o.select_set(True)
bpy.context.view_layer.objects.active = root
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=False,
                          export_yup=True, export_extras=True, export_animations=False, export_cameras=False,
                          export_lights=False, export_draco_mesh_compression_enable=False)
print('RQ_EXPORT', out, os.path.getsize(out), flush=True)
