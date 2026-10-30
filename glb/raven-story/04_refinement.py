"""Render-led corrections: fuller forest, controlled exposure and skyline framing."""
scene=bpy.data.scenes['Raven_Valley_Story']
world=scene.world
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Strength'].default_value=.16
scene.view_settings.exposure=-.7
vol=next(n for n in bpy.data.materials['MAT-Valley_aerial_perspective'].node_tree.nodes if n.type=='PRINCIPLED_VOLUME');vol.inputs['Density'].default_value=.000025
# Wider individual needles survive distant pixel footprints; maintain actual irregular branches.
for data_pair in prototypes:
    data=data_pair[1]
    for polygon in data.polygons:
        a,b,c=[data.vertices[i] for i in polygon.vertices]
        center=(a.co+b.co)/2;half=(b.co-a.co)/2
        a.co=center-half*2.6;b.co=center+half*2.6;c.co=center+(c.co-center)*1.5
    data.update()
# Triplanar-like wall projection: brick courses need world Z, not XY stripes.
n=stone.node_tree.nodes;l=stone.node_tree.links
brick=next(n for n in n if n.type=='TEX_BRICK')
geom=n.new('ShaderNodeNewGeometry');sep=n.new('ShaderNodeSeparateXYZ');l.new(geom.outputs['Position'],sep.inputs[0])
add=n.new('ShaderNodeMath');add.operation='ADD';l.new(sep.outputs['X'],add.inputs[0]);l.new(sep.outputs['Y'],add.inputs[1])
comb=n.new('ShaderNodeCombineXYZ');l.new(add.outputs[0],comb.inputs['X']);l.new(sep.outputs['Z'],comb.inputs['Y']);l.new(comb.outputs[0],brick.inputs['Vector'])
# Directional bark grain rather than one-scale noise.
n=bark.node_tree.nodes;l=bark.node_tree.links;tex=next(n for n in n if n.type=='TEX_NOISE');tc=next(n for n in n if n.type=='TEX_COORD')
mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(3,3,.13);l.new(tc.outputs['Object'],mapping.inputs[0]);l.new(mapping.outputs[0],tex.inputs[0])
random.seed(721);added=0
for i in range(7200):
    x=random.uniform(-1020,1020);y=random.uniform(-570,1410)
    # Mostly wooded valley sides, interrupted clearings and a visible inhabited corridor.
    if abs(x)<110 and y<400 and random.random()<.88:continue
    if any(math.hypot(x-px,y-py)<r for px,py,r in [(*BASE,80),(*CLINIC,68)]+[(a,b,19) for a,b in villages]):continue
    if min(math.hypot(x-a,y-b) for a,b in road[::4])<8:continue
    size=random.uniform(1.1,2.15);rot=random.random()*math.tau
    for part,data in zip(['trunk','needles'],prototypes[i%4]):
        ob=bpy.data.objects.new('GEO-DenseForest_%05d_%s'%(i,part),data);forest_col.objects.link(ob);ob.location=(x,y,height(x,y)-.08);ob.scale=(size,size,size);ob.rotation_euler.z=rot
    added+=1
# Closer shots need grass tufts at a legible scale and irregular density.
vs=[];fs=[]
for cx,cy in [BASE,CLINIC]:
    for i in range(33000):
        x=random.uniform(cx-60,cx+65);y=random.uniform(cy-48,cy+65)
        if abs(x-cx)<15 and cy-27<y<cy+8:continue
        if any(abs(x-a)<8 and abs(y-b)<8 for a,b in villages):continue
        if random.random()<.3+.18*math.sin(x*.16)*math.cos(y*.12):continue
        z=height(x,y);h=random.uniform(.12,.48);angle=random.random()*6.28
        for offset in [0,1.4]:
            a=angle+offset;w=.018;k=len(vs)
            vs.extend([(x-w*math.cos(a),y-w*math.sin(a),z),(x+w*math.cos(a),y+w*math.sin(a),z),(x+.12*math.cos(a),y+.12*math.sin(a),z+h)])
            fs.append((k,k+1,k+2))
mesh('Service_clearing_grass_tufts',vs,fs,grassmat,detail_col)
# Set low camera views so the snowy ridgeline is actually part of the composition.
overrides={
 '01_The_valley':((380,-365,220),(365,-340,222),(80,900,400),36),
 '04_Mountain_crossing':((260,40,230),(230,90,237),(30,1150,450),38),
 '05_Clinic_arrival':((184,157,clinic_pos[2]+10),(180,164,clinic_pos[2]+9),(155,210,clinic_pos[2]+4.2),38),
 '06_Connected_valley':((590,-425,365),(635,-470,400),(0,650,260),38)
}
for name,(loc1,loc2,target,lens) in overrides.items():
    ob=bpy.data.objects['CAM-'+name];ob.animation_data_clear();ob.data.lens=lens
    shot=next(s for s in manifest if s['id']==name)
    for frame,loc in zip(shot['frames'],[loc1,loc2]):
        ob.location=loc;ob.rotation_quaternion=(Vector(target)-ob.location).to_track_quat('-Z','Y');ob.keyframe_insert('location',frame=frame);ob.keyframe_insert('rotation_quaternion',frame=frame)
    shot['target']=target;shot['lens_mm']=lens
(ROOT/'glb/raven-story/storyboard.json').write_text(json.dumps({'fps':24,'frame_range':[1,600],'duration_seconds':25,'status':'draft, requires website camera mapping','shots':manifest},indent=2))
scene.frame_set(450);scene.cycles.samples=32;scene.render.resolution_percentage=60
scene.render.filepath=str(ROOT/'glb/raven-story/qa/clinic-refined.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'glb/raven-story/raven-valley-story-v01.blend'))
print(json.dumps({'stage':'refinement','additional_trees':added,'objects':len(scene.objects)}))
