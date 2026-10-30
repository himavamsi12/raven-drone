"""Run in Blender via MCP. Creates a separate scene; never edits the Raven asset."""
import bpy, math, random, json
from mathutils import Vector, noise
from pathlib import Path
ROOT = Path('/Users/sixjuly14/Documents/Bishwa/Sixjuly/drone-site')
random.seed(418)
if bpy.data.scenes.get('Raven_Valley_Story'):
    raise RuntimeError('Story scene exists; inspect before rebuilding.')
scene = bpy.data.scenes.new('Raven_Valley_Story')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene['status'] = 'Authored environment / draft story cameras; not yet mapped to website tracks'
def collection(name):
    c=bpy.data.collections.new('COL-'+name); scene.collection.children.link(c); return c
terrain_col=collection('Terrain'); village_col=collection('Villages'); forest_col=collection('Forest')
detail_col=collection('GroundDetails'); camera_col=collection('StoryCameras'); ref_col=collection('ReferenceOnly')
def mesh(name, verts, faces, mat, col):
    d=bpy.data.meshes.new(name); d.from_pydata(verts,[],faces); d.update()
    o=bpy.data.objects.new('GEO-'+name,d); col.objects.link(o)
    if mat: d.materials.append(mat)
    return o
def pbr(name, color, rough=.8, scale=1, bump=.08):
    m=bpy.data.materials.new('MAT-'+name); m.use_nodes=True; n=m.node_tree.nodes; l=m.node_tree.links
    p=next(x for x in n if x.type=='BSDF_PRINCIPLED'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough
    tex=n.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value=scale; tex.inputs['Detail'].default_value=4
    tc=n.new('ShaderNodeTexCoord'); l.new(tc.outputs['Object'],tex.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color=(*(v*.58 for v in color),1); ramp.color_ramp.elements[1].color=(*(min(1,v*1.35) for v in color),1)
    l.new(tex.outputs['Fac'],ramp.inputs[0]); l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    b=n.new('ShaderNodeBump'); b.inputs['Strength'].default_value=.3; b.inputs['Distance'].default_value=bump
    l.new(tex.outputs['Fac'],b.inputs['Height']); l.new(b.outputs[0],p.inputs['Normal']); return m
grass=pbr('Meadow_earth',(.19,.235,.075),.93,1.9,.07)
rock=pbr('Geological_schist',(.28,.29,.265),.88,2.8,.12)
stone=pbr('Dry_stone',(.26,.245,.21),.9,4,.04)
plaster=pbr('Mineral_plaster',(.62,.59,.50),.87,6,.012)
wood=pbr('Weathered_timber',(.12,.085,.054),.87,10,.018)
slate=pbr('Charcoal_slate',(.12,.145,.15),.78,7,.012)
door=pbr('Muted_blue_green',(.065,.19,.18),.65,8,.003)
soil=pbr('Compacted_earth',(.34,.285,.19),.95,3,.025)
bark=pbr('Dry_pine_bark',(.18,.095,.047),.95,9,.03)
needles=[pbr('Pine_needles_'+str(i),c,.88,6,.002) for i,c in enumerate([(.065,.115,.035),(.105,.16,.055),(.12,.17,.065)])]
glass=pbr('Window_glass',(.095,.16,.19),.18,3,0)
gp=next(n for n in glass.node_tree.nodes if n.type=='BSDF_PRINCIPLED'); gp.inputs['Metallic'].default_value=.28
# Terrain material: world-space slope, altitude and patches, not one uniform green carpet.
n=grass.node_tree.nodes; l=grass.node_tree.links; p=next(x for x in n if x.type=='BSDF_PRINCIPLED')
geom=n.new('ShaderNodeNewGeometry'); sep=n.new('ShaderNodeSeparateXYZ'); l.new(geom.outputs['Normal'],sep.inputs[0])
r=n.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].position=.55; r.color_ramp.elements[0].color=(.24,.235,.20,1); r.color_ramp.elements[1].position=.9; r.color_ramp.elements[1].color=(.15,.20,.055,1)
l.new(sep.outputs['Z'],r.inputs[0]); tex=n.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value=.035; tex.inputs['Detail'].default_value=5
l.new(geom.outputs['Position'],tex.inputs[0]); mix=n.new('ShaderNodeMixRGB'); mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=.6; l.new(r.outputs[0],mix.inputs[1]); l.new(tex.outputs['Color'],mix.inputs[2]); l.new(mix.outputs[0],p.inputs['Base Color'])
BASE=(-175,-165); CLINIC=(155,210)
def raw_height(x,y):
    valley=42+ .032*(y+400)+ .00028*x*x
    shoulder=84*math.exp(-((x-210)/210)**2-((y-220)/320)**2)
    folds=18*math.sin(y*.006+x*.003)+10*noise.fractal(Vector((x*.009,y*.009,1.3)),1,2,4)
    return valley+shoulder+folds
def height(x,y):
    z=raw_height(x,y)
    for px,py,radius in [(*BASE,70),(*CLINIC,62)]:
        d=math.hypot(x-px,y-py); t=max(0,min(1,(d-radius)/28)); t=t*t*(3-2*t)
        z=z*t+raw_height(px,py)*(1-t)
    return z
N=230; verts=[]; faces=[]
for j in range(N+1):
    y=-800+j*2200/N
    for i in range(N+1):
        x=-1050+i*2100/N; verts.append((x,y,height(x,y)))
for j in range(N):
    for i in range(N):
        a=j*(N+1)+i; faces.append((a,a+1,a+N+2,a+N+1))
o=mesh('Valley_terrain',verts,faces,grass,terrain_col)
for p in o.data.polygons:p.use_smooth=True
# Broad high relief with nonuniform erosion, snow only on the far skyline.
snow=pbr('Summit_snow',(.82,.86,.88),.86,.06,.1)
for k,(cx,cy,h,w) in enumerate([(-1150,1750,720,770),(-550,2000,1040,850),(200,2260,1190,880),(890,2050,980,780),(1500,1800,810,850),(-1350,700,540,650),(1450,750,650,660)]):
    vs=[]; fs=[]; G=70
    for j in range(G+1):
        y=cy-w+j*2*w/G
        for i in range(G+1):
            x=cx-w+i*2*w/G; d=((x-cx)/w)**2+((y-cy)/w)**2
            v=noise.fractal(Vector((x*.006,y*.006,k*.9)),1,2,5)
            z=35+h*max(0,1-d)**1.35+v*100*max(0,1-d)+24*math.sin(x*.018+y*.009)*max(0,1-d)
            vs.append((x,y,z))
    for j in range(G):
        for i in range(G):
            a=j*(G+1)+i; fs.append((a,a+1,a+G+2,a+G+1))
    m=mesh('Ridge_%02d'%k,vs,fs,rock,terrain_col); m.data.materials.append(snow)
    for poly in m.data.polygons:
        poly.use_smooth=True
        if poly.center.z>99999: pass
        cz=sum(vs[v][2] for v in poly.vertices)/4
        if cz>h*.76 and poly.normal.z>.45:poly.material_index=1
def ribbon(name,points,width,material):
    vs=[]; fs=[]
    for j,(x,y) in enumerate(points):
        prev=Vector(points[max(0,j-1)]); nxt=Vector(points[min(len(points)-1,j+1)]); d=(nxt-prev).normalized(); q=Vector((-d.y,d.x))*width/2
        for sign in [-1,1]:
            xx=x+q.x*sign; yy=y+q.y*sign; vs.append((xx,yy,height(xx,yy)+.19))
        if j: a=j*2;fs.append((a-2,a-1,a+1,a))
    return mesh(name,vs,fs,material,terrain_col)
road=[]
for i in range(240):
    t=i/239; y=-600+1450*t; x=-120+135*math.sin(t*math.pi*3.4)+80*t
    road.append((x,y))
ribbon('Winding_contour_road',road,5,soil)
for tag,(x,y) in [('Base',BASE),('Clinic',CLINIC)]:
    nearest=min(road,key=lambda p:math.hypot(p[0]-x,p[1]-y))
    ribbon(tag+'_access',[(x+(nearest[0]-x)*i/30,y+(nearest[1]-y)*i/30) for i in range(31)],3,soil)
# Physically lit sky, consistent world direction.
world=bpy.data.worlds.new('Raven_alpine_daylight'); world.use_nodes=True; scene.world=world
wn=world.node_tree.nodes; wl=world.node_tree.links; bg=next(n for n in wn if n.type=='BACKGROUND'); bg.inputs['Strength'].default_value=.28
sky=wn.new('ShaderNodeTexSky'); sky.sky_type=next(v for v in ('MULTIPLE_SCATTERING','NISHITA','HOSEK_WILKIE') if v in {i.identifier for i in sky.bl_rna.properties['sky_type'].enum_items}); sky.sun_elevation=math.radians(35); sky.sun_rotation=math.radians(135); sky.sun_disc=False; sky.altitude=1.3
wl.new(sky.outputs[0],bg.inputs[0])
ld=bpy.data.lights.new('LGT-Late_morning_sun','SUN');ld.energy=2.8;ld.angle=math.radians(2);ld.color=(1,.94,.82)
lo=bpy.data.objects.new(ld.name,ld);scene.collection.objects.link(lo);lo.rotation_euler=(.5,-.45,-.65)
scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=60
scene.view_settings.view_transform='AgX';scene.render.fps=24;scene.frame_start=1;scene.frame_end=600
scene['reference_roles']='R01-R05 geography; R06-R08 surface quality only, no swamp'
print(json.dumps({'stage':'landscape','terrain_vertices':len(verts),'scene':scene.name}))
