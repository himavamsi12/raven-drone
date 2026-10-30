"""Draft 25-second environment camera edit, separate from legacy website tracks."""
shots=[
 ('01_The_valley',1,100,(565,-680,425),(545,-645,410),(25,190,145),42),
 ('02_Health_centre',101,200,(-134,-222,base_pos[2]+23),(-139,-217,base_pos[2]+21),(-175,-166,base_pos[2]+3),40),
 ('03_Departure_space',201,300,(-194,-204,base_pos[2]+7),(-192,-204,base_pos[2]+11),(-175,-177,base_pos[2]+6),35),
 ('04_Mountain_crossing',301,400,(300,-10,255),(275,35,265),(30,510,190),38),
 ('05_Clinic_arrival',401,500,(188,151,clinic_pos[2]+18),(183,160,clinic_pos[2]+15),(155,207,clinic_pos[2]+3),43),
 ('06_Connected_valley',501,600,(590,-425,430),(635,-470,475),(-5,80,100),38),
]
manifest=[]
for name,start,end,loc1,loc2,target,lens in shots:
    data=bpy.data.cameras.new('CAM-'+name);data.lens=lens;data.sensor_width=36;data.clip_end=10000;data.clip_start=.1
    ob=bpy.data.objects.new(data.name,data);camera_col.objects.link(ob);ob.rotation_mode='QUATERNION'
    for frame,loc in [(start,loc1),(end,loc2)]:
        ob.location=loc;ob.rotation_quaternion=(Vector(target)-ob.location).to_track_quat('-Z','Y')
        ob.keyframe_insert('location',frame=frame);ob.keyframe_insert('rotation_quaternion',frame=frame)
    marker=scene.timeline_markers.new(name,frame=start);marker.camera=ob
    ob['status']='Draft storyboard camera, not a replacement for shipped camera GLBs'
    manifest.append({'id':name,'frames':[start,end],'camera':ob.name,'lens_mm':lens,'target':target})
scene.camera=bpy.data.objects['CAM-01_The_valley'];scene.frame_set(1)
# Low-density finite aerial perspective. No swamp / opaque fog curtain.
mist=bpy.data.materials.new('MAT-Valley_aerial_perspective');mist.use_nodes=True
mn=mist.node_tree.nodes;mn.clear();out=mn.new('ShaderNodeOutputMaterial');vol=mn.new('ShaderNodeVolumePrincipled')
vol.inputs['Density'].default_value=.000095;vol.inputs['Color'].default_value=(.69,.77,.86,1);vol.inputs['Anisotropy'].default_value=.15
mist.node_tree.links.new(vol.outputs['Volume'],out.inputs['Volume'])
box('Atmosphere_bounds',(0,900,650),(6500,6500,1800),mist,terrain_col)
scene.view_layers[0].use_pass_z=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='16'
scene.render.film_transparent=False
scene.render.filepath=str(ROOT/'glb/raven-story/qa/valley-overview.png')
# References embedded as image datablocks, not visible geometry or published assets.
for path in sorted((ROOT/'research/raven-film/references').glob('*.png')):
    image=bpy.data.images.load(str(path),check_existing=True);image.pack()
manifest_path=ROOT/'glb/raven-story/storyboard.json'
manifest_path.write_text(json.dumps({'fps':24,'frame_range':[1,600],'duration_seconds':25,'status':'draft, requires website camera mapping','shots':manifest},indent=2))
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.shading.use_scene_world=True
            area.spaces.active.shading.use_scene_lights=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'glb/raven-story/raven-valley-story-v01.blend'))
print(json.dumps({'stage':'cameras_saved','cameras':len(shots),'blend':bpy.data.filepath,'frames':600}))
