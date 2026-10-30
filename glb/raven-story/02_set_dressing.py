"""Execute in raven_story_build's namespace after 01_landscape.py."""
def box(name,loc,dim,mat,col=village_col,bevel=0):
    x,y,z=loc; a,b,c=(v/2 for v in dim)
    vs=[(x+dx*a,y+dy*b,z+dz*c) for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    o=mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,col)
    if bevel:
        mod=o.modifiers.new('Manufactured_edge','BEVEL');mod.width=bevel;mod.segments=2
    return o
def tube(vs,fs,a,b,r1,r2,sides=6):
    a=Vector(a);b=Vector(b);d=(b-a).normalized();u=d.cross(Vector((0,0,1)))
    if u.length<.01:u=d.cross(Vector((0,1,0)))
    u.normalize();v=d.cross(u);start=len(vs)
    for p,r in [(a,r1),(b,r2)]:
        for j in range(sides):vs.append(tuple(p+r*(math.cos(j*math.tau/sides)*u+math.sin(j*math.tau/sides)*v)))
    for j in range(sides):fs.append((start+j,start+(j+1)%sides,start+(j+1)%sides+sides,start+j+sides))
# Metrically scaled stone joints with separate fine roughness.
n=stone.node_tree.nodes;l=stone.node_tree.links;p=next(n for n in n if n.type=='BSDF_PRINCIPLED')
tc=n.new('ShaderNodeTexCoord');brick=n.new('ShaderNodeTexBrick');brick.inputs['Scale'].default_value=1
brick.inputs['Mortar Size'].default_value=.025;brick.inputs['Brick Width'].default_value=.55;brick.inputs['Row Height'].default_value=.22
brick.inputs['Color1'].default_value=(.21,.205,.17,1);brick.inputs['Color2'].default_value=(.38,.35,.29,1);brick.inputs['Mortar'].default_value=(.1,.095,.075,1)
l.new(tc.outputs['Object'],brick.inputs['Vector']);l.new(brick.outputs['Color'],p.inputs['Base Color'])
b=n.new('ShaderNodeBump');b.inputs['Distance'].default_value=.025;b.inputs['Strength'].default_value=.5;l.new(brick.outputs['Fac'],b.inputs['Height']);l.new(b.outputs[0],p.inputs['Normal'])
def house(tag,x,y,w=8,d=6,h=4,clinic=False):
    z=height(x,y)+.15
    box(tag+'_foundation',(x,y,z+.45),(w+.5,d+.5,.9),stone,bevel=.06)
    box(tag+'_walls',(x,y,z+.8+h/2),(w,d,h),plaster if clinic else stone,bevel=.045)
    roof_z=z+.8+h;rise=d*.36
    # Gable ends, thick roof planes and individual overlapping slate courses.
    vs=[(x-w/2,y-d/2,roof_z),(x-w/2,y+d/2,roof_z),(x-w/2,y,roof_z+rise),(x+w/2,y-d/2,roof_z),(x+w/2,y+d/2,roof_z),(x+w/2,y,roof_z+rise)]
    mesh(tag+'_gables',vs,[(0,1,2),(3,5,4)],plaster if clinic else wood,village_col)
    tile_vs=[];tile_fs=[]
    nx=max(8,int((w+1)/.6));ny=max(6,int((d/2+.6)/.42))
    for side in [-1,1]:
        for j in range(ny):
            for i in range(nx):
                xx=x-w/2-.5+i*(w+1)/nx;yy=(j/ny)*(d/2+.6)
                yy2=((j+1.12)/ny)*(d/2+.6);dx=(w+1)/nx-.018
                a=len(tile_vs);off=random.uniform(-.012,.012)
                for X,Y in [(xx,yy),(xx+dx,yy),(xx+dx,yy2),(xx,yy2)]:tile_vs.append((X,y+side*Y,roof_z+rise-Y*.72+.07+off))
                tile_fs.append((a,a+1,a+2,a+3) if side==1 else (a+3,a+2,a+1,a))
    tiles=mesh(tag+'_individual_slates',tile_vs,tile_fs,slate,village_col)
    so=tiles.modifiers.new('Slate_thickness','SOLIDIFY');so.thickness=.045
    box(tag+'_ridge_cap',(x,y,roof_z+rise+.09),(w+1,.18,.16),slate)
    # Recess illusion is built as dark reveal, frame and inset reflective pane.
    front=y-d/2-.035
    for wi,wx in enumerate([x-w*.29,x+w*.29]):
        box(tag+'_window_reveal'+str(wi),(wx,front-.02,z+2.9),(1.5,.13,1.6),wood)
        box(tag+'_window_glass'+str(wi),(wx,front-.095,z+2.9),(1.25,.025,1.35),glass)
        box(tag+'_window_mullion'+str(wi),(wx,front-.12,z+2.9),(.045,.05,1.4),wood)
        box(tag+'_sill'+str(wi),(wx,front-.16,z+2.08),(1.65,.3,.10),stone)
    box(tag+'_door_frame',(x,front-.05,z+1.95),(1.5,.18,2.5),wood)
    box(tag+'_door',(x,front-.16,z+1.91),(1.23,.06,2.3),door if clinic else wood)
    for j in range(3):box(tag+'_step'+str(j),(x,front-.5-j*.38,z+.62-j*.18),(2.3,.5,.18),stone,bevel=.02)
    box(tag+'_lintel',(x,front-.3,z+3.4),(2.2,.75,.14),slate)
    if not clinic:
        # Timber beams / small balconies distinguish local houses from clinics.
        for zz in [z+1,z+3.8]:box(tag+'_timber_band',(x,front-.12,zz),(w+.1,.2,.18),wood)
        for xx in [x-w/2+.2,x+w/2-.2]:box(tag+'_corner_post',(xx,front-.15,z+2.6),(.22,.22,h),wood)
    return (x,y,z)
base_pos=house('Health_centre',*BASE,15,9,4.3,True)
clinic_pos=house('Hill_clinic',*CLINIC,10,7,3.8,True)
for tag,(x,y,z),w in [('Base',base_pos,23),('Clinic',clinic_pos,18)]:
    box(tag+'_service_apron',(x,y-15,z-.04),(w,18,.18),soil,bevel=.1)
    for side in [-1,1]:box(tag+'_boundary_wall',(x+side*(w/2+1),y-14,z+.48),(1,19,1),stone,bevel=.06)
    box(tag+'_bench_seat',(x+w*.3,y-8,z+.52),(2,.5,.15),wood)
    for q in [-.7,.7]:box(tag+'_bench_leg',(x+w*.3+q,y-8,z+.25),(.15,.4,.5),wood)
    # Roof gutter and downpipe, no generated typography or medical claims.
    box(tag+'_gutter',(x,y-4.8,z+4.6),(w*.66,.16,.15),slate)
villages=[]
for i,(x,y) in enumerate([(92,180),(113,249),(199,270),(227,230),(247,310),(78,300),(177,340),(266,370),(-247,-110),(-280,-208),(-225,-260),(-305,-80),(-355,25),(-256,50),(370,580),(400,630),(345,670)]):
    villages.append((x,y));house('Dwelling_%02d'%i,x,y,random.uniform(7,10),random.uniform(5,7),random.uniform(3.4,4.8))
    ribbon('Footpath_%02d'%i,[(x,y-4),(x-3,y-10),(x-12,y-15)],1.2,soil)
# Small contour-following terrace retaining walls, not floating horizontal strips.
for idx,(x,y) in enumerate(villages[:8]):
    vs=[];fs=[]
    for j in range(18):
        xx=x-18+j*2; yy=y+14+math.sin(j*.12)*2;zz=height(xx,yy)
        a=len(vs);vs.extend([(xx,yy,zz-.1),(xx,yy,zz+1.2)])
        if j:fs.append((a-2,a,a+1,a-1))
    ob=mesh('Terrace_wall_%02d'%idx,vs,fs,stone,village_col);md=ob.modifiers.new('Wall_thickness','SOLIDIFY');md.thickness=.55
# Irregular branch-and-needle tree prototypes. Shared meshes keep the forest economical.
prototypes=[]
for variant in range(4):
    random.seed(880+variant);vs=[];fs=[];nv=[];nf=[]
    H=13+variant*.7;tube(vs,fs,(0,0,0),(.18,-.13,H),.25,.025,9)
    for tier in range(11):
        z=2.6+tier*(H-3)/11;reach=(1-(z/H))**.65*4.5
        for branch in range(7):
            a=branch*math.tau/7+tier*1.93+random.uniform(-.25,.25)
            end=Vector((math.cos(a)*reach,math.sin(a)*reach,z+random.uniform(-.6,.5)))
            start=Vector((.05,0,z));tube(vs,fs,start,end,.055*(1-z/H)+.012,.008,5)
            for q in range(12):
                t=.15+q*.069;cp=start.lerp(end,t); sideways=Vector((-math.sin(a),math.cos(a),.15))
                twiglen=(1-t)*.75+.18
                for sg in [-1,1]:
                    tip=cp+sideways*sg*twiglen+Vector((math.cos(a)*.32,math.sin(a)*.32,.18))
                    tube(vs,fs,cp,tip,.01,.002,4)
                    for needle in range(12):
                        v=cp.lerp(tip,needle/12);angle=random.random()*math.tau
                        d=Vector((math.cos(angle),math.sin(angle),random.uniform(-.1,.8)))*random.uniform(.12,.24)
                        u=Vector((-d.y,d.x,.015)).normalized()*.012
                        index=len(nv);nv.extend([tuple(v-u),tuple(v+u),tuple(v+d)]);nf.append((index,index+1,index+2))
    trunk=mesh('Pine_bark_master_%d'%variant,vs,fs,bark,ref_col)
    crown=mesh('Pine_needles_master_%d'%variant,nv,nf,needles[variant%3],ref_col)
    prototypes.append((trunk.data,crown.data))
    trunk.hide_render=True;trunk.hide_set(True);crown.hide_render=True;crown.hide_set(True)
random.seed(418);tree_count=0
for i in range(1300):
    x=random.uniform(-930,930);y=random.uniform(-620,1320)
    if abs(x)<65 and random.random()<.8:continue
    if any(math.hypot(x-px,y-py)<r for px,py,r in [(*BASE,92),(*CLINIC,83)]+[(a,b,20) for a,b in villages]):continue
    if min(math.hypot(x-a,y-b) for a,b in road[::3])<8:continue
    size=random.uniform(.72,1.65);rot=random.random()*math.tau;loc=(x,y,height(x,y)-.05)
    for part,data in zip(['trunk','needles'],prototypes[i%4]):
        ob=bpy.data.objects.new('GEO-Forest_%04d_%s'%(i,part),data);forest_col.objects.link(ob);ob.location=loc;ob.scale=(size,size,size*random.uniform(.95,1.05));ob.rotation_euler.z=rot
    tree_count+=1
# Intentional tall asymmetric landmark beside the clinic.
for part,data in zip(['trunk','needles'],prototypes[2]):
    ob=bpy.data.objects.new('GEO-Clinic_landmark_'+part,data);forest_col.objects.link(ob);ob.location=(180,220,height(180,220));ob.scale=(1.6,1.25,1.7)
# Ground grass blades are geometry, with bare apron exclusions.
grassmat=pbr('Grass_blades',(.20,.28,.075),.9,3,.001)
vs=[];fs=[]
for i in range(22000):
    x=random.uniform(65,275);y=random.uniform(130,355)
    if any(abs(x-px)<ww and abs(y-(py-8))<24 for px,py,ww in [(*CLINIC,16)]+[(a,b,9) for a,b in villages]):continue
    z=height(x,y);h=random.uniform(.12,.52);a=random.random()*math.tau;w=.025
    k=len(vs);vs.extend([(x-w*math.cos(a),y-w*math.sin(a),z),(x+w*math.cos(a),y+w*math.sin(a),z),(x+.15*math.cos(a),y+.15*math.sin(a),z+h)]);fs.append((k,k+1,k+2))
mesh('Clinic_meadow_grass',vs,fs,grassmat,detail_col)
# Rounded fractured field stones shared from a small mesh, varied at terrain level.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
ob=bpy.context.object;ob.name='GEO-Fieldstone_master';data=ob.data;data.materials.append(rock)
for v in data.vertices:v.co*=random.uniform(.8,1.15)
for c in list(ob.users_collection):c.objects.unlink(ob)
ref_col.objects.link(ob);ob.hide_render=True;ob.hide_set(True)
for i in range(350):
    x=random.uniform(-500,600);y=random.uniform(-450,850)
    if any(math.hypot(x-px,y-py)<60 for px,py in [BASE,CLINIC]):continue
    ob=bpy.data.objects.new('GEO-Fieldstone_%03d'%i,data);detail_col.objects.link(ob);ob.location=(x,y,height(x,y));s=random.uniform(.3,2.5);ob.scale=(s,s*.75,s*.65);ob.rotation_euler=(.2,.1,random.random()*6.28)
print(json.dumps({'stage':'set_dressing','houses':len(villages)+2,'trees':tree_count,'grass_triangles':len(fs),'objects':len(scene.objects)}))
