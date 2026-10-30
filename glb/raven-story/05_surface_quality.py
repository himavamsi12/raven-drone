"""CC0 texture-led refinement; no edits to Raven texture files or GLB."""
TEX=ROOT/'glb/raven-story/textures'
def image_node(nodes,filename,noncolor=False):
    node=nodes.new('ShaderNodeTexImage');node.image=bpy.data.images.load(str(TEX/filename),check_existing=True)
    if noncolor:node.image.colorspace_settings.name='Non-Color'
    node.image.pack();return node
def scanned(mat,asset,tile):
    n=mat.node_tree.nodes;l=mat.node_tree.links;p=next(n for n in n if n.type=='BSDF_PRINCIPLED')
    geom=n.new('ShaderNodeNewGeometry');scale=n.new('ShaderNodeVectorMath');scale.operation='SCALE';scale.inputs['Scale'].default_value=1/tile;l.new(geom.outputs['Position'],scale.inputs[0])
    diff=image_node(n,asset+'_diff_2k.jpg');diff.projection='BOX';diff.projection_blend=.25;l.new(scale.outputs[0],diff.inputs[0]);l.new(diff.outputs['Color'],p.inputs['Base Color'])
    rough=image_node(n,asset+'_rough_2k.jpg',True);rough.projection='BOX';rough.projection_blend=.25;l.new(scale.outputs[0],rough.inputs[0]);l.new(rough.outputs['Color'],p.inputs['Roughness'])
    bump=n.new('ShaderNodeBump');bump.inputs['Distance'].default_value=.05;bump.inputs['Strength'].default_value=.35;l.new(diff.outputs['Color'],bump.inputs['Height']);l.new(bump.outputs[0],p.inputs['Normal'])
    return diff,scale
scanned(grass,'aerial_grass_rock',26)
scanned(rock,'rock_face',65)
scanned(stone,'plastered_stone_wall',3.4)
# Sky model supported by the connected build, without gray multiple-scattering fallback.
sky=next(n for n in scene.world.node_tree.nodes if n.type=='TEX_SKY');sky.sky_type='HOSEK_WILKIE';sky.sun_direction=Vector((-.4,-.55,.73)).normalized();sky.turbidity=2.3;sky.ground_albedo=.23
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs['Strength'].default_value=.6
scene.view_settings.exposure=-.15
# Replace discrete smooth hills with a connected, eroded ridgeline and shader-driven snow.
for obj in list(terrain_col.objects):
    if obj.name.startswith('GEO-Ridge_'):obj.hide_render=True;obj.hide_set(True)
vs=[];fs=[];NX=270;NY=180
for j in range(NY+1):
    y=1050+j*3200/NY
    for i in range(NX+1):
        x=-2900+i*5800/NX
        ridge_y=2440+180*math.sin(x*.0018)+130*math.sin(x*.0051)
        profile=math.exp(-((y-ridge_y)/900)**2)
        peaks=660+140*math.sin(x*.0032)+95*math.cos(x*.0064)
        v=noise.fractal(Vector((x*.004,y*.004,4.8)),1.2,2.1,6)
        erosion=abs(noise.fractal(Vector((x*.012,y*.007,2.9)),1,2,5))
        z=45+profile*(peaks+v*180-erosion*180)
        vs.append((x,y,z))
for j in range(NY):
    for i in range(NX):
        a=j*(NX+1)+i;fs.append((a,a+1,a+NX+2,a+NX+1))
mountain=mesh('Continuous_eroded_alpine_range',vs,fs,rock,terrain_col)
for p in mountain.data.polygons:p.use_smooth=True
# A separate geological shader uses altitude + noise + slope for irregular snow patches.
rm=rock.copy();rm.name='MAT-Range_rock_snow';mountain.data.materials[0]=rm
n=rm.node_tree.nodes;l=rm.node_tree.links;p=next(n for n in n if n.type=='BSDF_PRINCIPLED')
old=next(link.from_socket for link in l if link.to_node==p and link.to_socket==p.inputs['Base Color'])
g=n.new('ShaderNodeNewGeometry');sep=n.new('ShaderNodeSeparateXYZ');l.new(g.outputs['Position'],sep.inputs[0])
tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=.023;tex.inputs['Detail'].default_value=4;l.new(g.outputs['Position'],tex.inputs[0])
mul=n.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.inputs[1].default_value=130;l.new(tex.outputs['Fac'],mul.inputs[0])
add=n.new('ShaderNodeMath');add.operation='ADD';l.new(sep.outputs['Z'],add.inputs[0]);l.new(mul.outputs[0],add.inputs[1])
mapper=n.new('ShaderNodeMapRange');mapper.inputs['From Min'].default_value=620;mapper.inputs['From Max'].default_value=700;l.new(add.outputs[0],mapper.inputs[0])
blend=n.new('ShaderNodeMixRGB');blend.inputs[2].default_value=(.80,.84,.86,1);l.new(mapper.outputs[0],blend.inputs[0]);l.new(old,blend.inputs[1]);l.new(blend.outputs[0],p.inputs['Base Color'])
# Real conifer alpha atlases on volumetrically distributed sprays, not screen billboards.
fol=pbr('Scanned_fir_sprays',(.1,.16,.05),.9,1,0)
n=fol.node_tree.nodes;l=fol.node_tree.links;p=next(n for n in n if n.type=='BSDF_PRINCIPLED')
d=image_node(n,'fir_tree_01_twig_diff_2k.jpg');a=image_node(n,'fir_tree_01_twig_alpha_2k.png',True)
l.new(d.outputs['Color'],p.inputs['Base Color']);l.new(a.outputs['Color'],p.inputs['Alpha'])
if hasattr(fol,'surface_render_method'):fol.surface_render_method='DITHERED'
new_crowns=[]
for variant in range(4):
    random.seed(880+variant);v=[];f=[];H=13+variant*.7
    for tier in range(12):
        z=2.2+tier*(H-2.5)/12;reach=(1-z/H)**.65*4.5
        for branch in range(8):
            angle=branch*math.tau/8+tier*1.93+random.uniform(-.2,.2)
            for q in range(7):
                t=.22+q*.115;rad=reach*t
                center=Vector((math.cos(angle)*rad,math.sin(angle)*rad,z-.3*t))
                length=(.55+.6*(1-t))*random.uniform(.85,1.2)
                for cross in [0,1.2]:
                    a=angle+random.uniform(-.4,.4);u=Vector((-math.sin(a),math.cos(a),.2))*length*.6
                    w=Vector((math.cos(a),math.sin(a),.35+cross))*length
                    k=len(v);v.extend([tuple(center-u),tuple(center+u),tuple(center+u+w),tuple(center-u+w)]);f.append((k,k+1,k+2,k+3))
    ob=mesh('Scanned_crown_master_%d'%variant,v,f,fol,ref_col);uv=ob.data.uv_layers.new(name='Fir_atlas')
    for poly in ob.data.polygons:
        for loop,co in zip(poly.loop_indices,[(.59,.57),(.99,.57),(.99,.99),(.59,.99)]):uv.data[loop].uv=co
    ob.hide_render=True;ob.hide_set(True);new_crowns.append(ob.data)
for i,ob in enumerate(forest_col.objects):
    if 'needles' in ob.name:ob.data=new_crowns[i%4]
# Reframe overview with village in foreground and enough distant skyline.
ob=bpy.data.objects['CAM-01_The_valley'];ob.animation_data_clear();ob.data.lens=35
for frame,loc in [(1,(330,-285,210)),(100,(310,-250,205))]:
    ob.location=loc;ob.rotation_quaternion=(Vector((90,620,270))-ob.location).to_track_quat('-Z','Y');ob.keyframe_insert('location',frame=frame);ob.keyframe_insert('rotation_quaternion',frame=frame)
scene.cycles.transparent_max_bounces=16;scene.cycles.samples=32
scene.frame_set(450);scene.render.filepath=str(ROOT/'glb/raven-story/qa/clinic-textured.png')
scene['quality_status']='Look development: scanned surfaces added; full sequence and website camera mapping pending'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'glb/raven-story/raven-valley-story-v02.blend'))
print(json.dumps({'stage':'scanned_surface_pass','images':len(bpy.data.images),'range_vertices':len(vs)}))
