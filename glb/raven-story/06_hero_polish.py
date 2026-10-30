"""Balance clear daylight and refine the courtyard's human-scale foreground."""
# Explicit sky dome radiance avoids version-specific physical-sky changes.
n=scene.world.node_tree.nodes;l=scene.world.node_tree.links;bg=next(n for n in n if n.type=='BACKGROUND')
tc=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(tc.outputs['Normal'],sep.inputs[0])
absolute=n.new('ShaderNodeMath');absolute.operation='ABSOLUTE';l.new(sep.outputs['Z'],absolute.inputs[0])
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.68,.78,.90,1);ramp.color_ramp.elements[1].position=.85;ramp.color_ramp.elements[1].color=(.18,.38,.68,1)
l.new(absolute.outputs[0],ramp.inputs[0]);l.new(ramp.outputs[0],bg.inputs['Color']);bg.inputs['Strength'].default_value=.65
# Direct source reaches the clinic facade; soft, readable midday shadows.
sun=bpy.data.objects['LGT-Late_morning_sun'];sun.rotation_euler=(math.radians(30),math.radians(-25),math.radians(-15));sun.data.energy=2.2;sun.data.angle=math.radians(3)
scene.view_settings.exposure=.1
mountain=bpy.data.objects['GEO-Continuous_eroded_alpine_range'];mountain.location.y=1850;mountain.scale.z=.83
# Cool gray geology rather than the scanned source's brown color cast.
rm=mountain.data.materials[0];n=rm.node_tree.nodes;l=rm.node_tree.links
tex=next(n for n in n if n.type=='TEX_IMAGE' and '_diff_' in n.image.name)
sat=n.new('ShaderNodeHueSaturation');sat.inputs['Saturation'].default_value=.25;l.new(tex.outputs['Color'],sat.inputs['Color'])
for link in list(l):
    if link.from_node==tex and link.to_node.type=='MIX_RGB':
        to=link.to_socket;l.remove(link);l.new(sat.outputs[0],to)
# Bring meadow color into the reference's muted green range, keep scanned detail.
n=grass.node_tree.nodes;l=grass.node_tree.links;p=next(n for n in n if n.type=='BSDF_PRINCIPLED')
tex=next(n for n in n if n.type=='TEX_IMAGE' and '_diff_' in n.image.name)
mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.8;mix.inputs[2].default_value=(.35,.65,.16,1);l.new(tex.outputs[0],mix.inputs[1]);l.new(mix.outputs[0],p.inputs['Base Color'])
# Shared meadow patches: a fuller fine silhouette near both clearings.
random.seed(914);patches=[]
for variant in range(3):
    vs=[];fs=[]
    for i in range(440):
        x=random.uniform(-1,1);y=random.uniform(-1,1);h=random.uniform(.08,.30);a=random.random()*math.tau;w=random.uniform(.008,.018)
        k=len(vs);vs.extend([(x-w*math.cos(a),y-w*math.sin(a),0),(x+w*math.cos(a),y+w*math.sin(a),0),(x+.10*math.cos(a),y+.10*math.sin(a),h*.65),(x+.13*math.cos(a),y+.13*math.sin(a),h)])
        fs.extend([(k,k+1,k+2),(k+1,k+3,k+2)])
    ob=mesh('Grass_patch_master_%d'%variant,vs,fs,grassmat,ref_col);ob.hide_render=True;ob.hide_set(True);patches.append(ob.data)
for site,(cx,cy) in enumerate([BASE,CLINIC]):
    for i in range(2000):
        x=random.uniform(cx-55,cx+55);y=random.uniform(cy-50,cy+55)
        if abs(x-cx)<15 and cy-29<y<cy+8:continue
        if any(abs(x-a)<8 and abs(y-b)<8 for a,b in villages):continue
        ob=bpy.data.objects.new('GEO-Meadow_patch_%d_%04d'%(site,i),patches[i%3]);detail_col.objects.link(ob);ob.location=(x,y,height(x,y)-.015);ob.rotation_euler.z=random.random()*6.28;ss=random.uniform(.8,1.2);ob.scale=(ss,ss,ss)
# Fascia, porch supports and modest architecture detail at both care buildings.
for tag,(x,y,z),w,d,h in [('Health_centre',base_pos,15,9,4.3),('Hill_clinic',clinic_pos,10,7,3.8)]:
    roofz=z+.8+h
    for side in [-1,1]:box(tag+'_eave_fascia_'+str(side),(x,y+side*(d/2+.55),roofz-.25),(w+1.1,.16,.23),wood,bevel=.02)
    for side in [-1,1]:
        box(tag+'_porch_post_'+str(side),(x+side*.94,y-d/2-.7,z+1.9),(.1,.1,2.5),wood,bevel=.01)
    box(tag+'_notice_board_frame',(x+w*.38,y-d/2-.17,z+2.1),(.75,.1,.9),wood)
    box(tag+'_blank_notice_board',(x+w*.38,y-d/2-.23,z+2.1),(.62,.03,.77),plaster)
    # Varied stone entrance paving rather than a perfectly featureless near doorway.
    for row in range(5):
        for col in range(5):
            xx=x+(col-2)*.61;yy=y-d/2-1.3-row*.6
            box(tag+'_entrance_flagstone_%d_%d'%(row,col),(xx,yy,z+.045+random.uniform(-.012,.012)),(.58,.57,.065),stone,bevel=.015)
# Set usable final render settings; sample stills are separately reduced.
scene.cycles.samples=96;scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.025;scene.cycles.use_denoising=True
scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=50
scene.frame_set(450);scene.render.filepath=str(ROOT/'glb/raven-story/qa/clinic-daylight.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'glb/raven-story/raven-valley-story-v03.blend'))
print(json.dumps({'stage':'hero_polish','objects':len(scene.objects),'file':bpy.data.filepath}))
