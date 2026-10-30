"""Preserve source cameras, sample authored camera matrices, save handoff."""
legacy=bpy.data.collections.new('COL-Legacy_website_cameras_REFERENCE');scene.collection.children.link(legacy)
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/models/camera-animations.glb'))
for ob in set(bpy.data.objects)-before:
    for col in list(ob.users_collection):col.objects.unlink(ob)
    legacy.objects.link(ob);ob['reference_only']='Original website animation clips; not replaced by storyboard cameras'
legacy.hide_render=True;legacy.hide_viewport=True
def curves(action):
    if hasattr(action,'fcurves'):yield from action.fcurves
    else:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in getattr(strip,'channelbags',[]):yield from bag.fcurves
for ob in camera_col.objects:
    if ob.animation_data and ob.animation_data.action:
        for curve in curves(ob.animation_data.action):
            for key in curve.keyframe_points:key.interpolation='LINEAR'
# Camera-native basis is -Z forward / +Y up in both Blender and Three.js.
# Convert Blender world to Three world by left-multiplying C: (x,y,z)->(x,z,-y).
C=[[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]]
samples=[]
for f in range(1,601):
    scene.frame_set(f);bpy.context.view_layer.update();cam=scene.camera
    deps=bpy.context.evaluated_depsgraph_get();ev=cam.evaluated_get(deps)
    matrix=ev.matrix_world;projection=cam.calc_matrix_camera(deps,x=1920,y=1080,scale_x=1,scale_y=1)
    samples.append({'frame':f,'camera':cam.name,'world_matrix_rows':[list(row) for row in matrix],'projection_matrix_rows':[list(row) for row in projection]})
(ROOT/'glb/raven-story/camera-samples.json').write_text(json.dumps({'fps':24,'aspect':[1920,1080],'source_world':'Blender Z-up','matrix_storage':'nested rows; transpose for column-major JS arrays','three_world_conversion_left_multiply':C,'status':'draft authored cameras, not production site tracks','frames':samples},separators=(',',':')))
inventory=[]
for shot in manifest:
    cam=bpy.data.objects['CAM-'+shot['id']]
    inventory.append({'id':shot['id'],'frames':shot['frames'],'camera':cam.name,'lens_mm':cam.data.lens,'status':'draft, not legacy track match'})
(ROOT/'glb/raven-story/storyboard.json').write_text(json.dumps({'fps':24,'frame_range':[1,600],'duration_seconds':25,'cuts':'camera markers, hard cuts at chapter boundaries','shots':inventory},indent=2))
scene.frame_set(450);scene.camera=bpy.data.objects['CAM-05_Clinic_arrival'];scene.cycles.samples=96;scene.render.resolution_percentage=100
scene.render.filepath=str(ROOT/'glb/raven-story/frames/frame_')
scene['quality_status']='Authored first pass, six story cameras, scanned maps; reference parity and site integration not yet verified'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'glb/raven-story/raven-valley-story-v03.blend'))
print(json.dumps({'saved':bpy.data.filepath,'sampled_frames':len(samples),'legacy_cameras_preserved':len(legacy.objects),'story_cameras':len(camera_col.objects)}))
