"""Offline Blender look development. Original GLB stays untouched; all maps are embedded."""
import bpy, math, json, os
import numpy as np
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT=ROOT+'/glb/raven-refined'
os.makedirs(OUT+'/textures',exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=ROOT+'/glb/raven_drone.glb')
root=bpy.data.objects['Raven_Drone']
meshes=[o for o in root.children_recursive if o.type=='MESH']
rng=np.random.default_rng(71)
N=512; y,x=np.mgrid[0:N,0:N]; u=x/N; v=y/N
noise=rng.normal(0,1,(N,N))
weave=np.where(((x//16+y//16)%2)==0,np.sin(y*math.pi/3),np.sin(x*math.pi/3))
brush=np.sin(y*1.1)+.4*np.sin(y*3.7)+noise*.25

def image(name, data, color=False):
    im=bpy.data.images.new(name,width=N,height=N,alpha=True)
    im.colorspace_settings.name='sRGB' if color else 'Non-Color'
    rgba=np.ones((N,N,4),dtype=np.float32)
    if data.ndim==2: rgba[:,:,:3]=data[:,:,None]
    else: rgba[:,:,:3]=data
    im.pixels.foreach_set(rgba.ravel());im.filepath_raw=OUT+'/textures/'+name+'.png';im.file_format='PNG';im.save();im.pack()
    return im

def maps(name,base,rough,metal,pattern,amp):
    tone=np.clip(1+pattern*amp, .65,1.3)
    albedo=image(name+'_color',np.array(base)[None,None,:]*tone[:,:,None],True)
    orm=np.ones((N,N,3));orm[:,:,1]=np.clip(rough+pattern*.025,.08,.95);orm[:,:,2]=metal
    packed=image(name+'_orm',orm)
    dx=np.roll(pattern,1,axis=1)-np.roll(pattern,-1,axis=1)
    dy=np.roll(pattern,1,axis=0)-np.roll(pattern,-1,axis=0)
    nn=np.dstack((dx*.055,dy*.055,np.ones((N,N))));nn/=np.linalg.norm(nn,axis=2)[:,:,None]
    normal=image(name+'_normal',nn*.5+.5)
    return albedo,packed,normal

sets={
 'carbon':maps('raven_carbon',(.025,.029,.032),.36,0,weave+noise*.15,.14),
 'powder':maps('raven_graphite',(.035,.043,.048),.48,0,noise,.035),
 'metal':maps('raven_anodized',(.17,.19,.20),.31,1,brush,.035),
 'case':maps('raven_medical_case',(.40,.46,.43),.58,0,noise,.025),
 'rubber':maps('raven_rubber',(.012,.014,.015),.79,0,noise,.04),
 'strap':maps('raven_webbing',(.018,.024,.023),.82,0,weave,.1),
}
# A physical-scale cubic UV projection covers every surface, including undercarriage.
for obj in meshes:
    obj.data=obj.data.copy()
    uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='Raven_Surface')
    for poly in obj.data.polygons:
        axis=max(range(3),key=lambda a:abs(poly.normal[a])); axes=[a for a in range(3) if a!=axis]
        for li in poly.loop_indices:
            co=obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv=(co[axes[0]]/.12,co[axes[1]]/.12)
    # Keep authored split normals; remove double-sided shading on solid opaque shells.

for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    bs=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if not bs: continue
    name=mat.name
    kind=None
    if 'Composite' in name: kind='carbon'
    elif any(k in name for k in ['Chassis','Polymer','Motor','Shell']):kind='powder'
    elif any(k in name for k in ['Anodized','Steel']):kind='metal'
    elif 'Cardboard' in name or 'Packing_Tape' in name:kind='case'
    elif 'Rubber' in name:kind='rubber'
    elif 'Strap' in name:kind='strap'
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    bs.inputs['Coat Weight'].default_value=.14 if kind=='carbon' else .03
    bs.inputs['Coat Roughness'].default_value=.34
    if 'LED_' in name and 'Housing' not in name:bs.inputs['Emission Strength'].default_value=2
    if 'Label_Abstract' in name:bs.inputs['Base Color'].default_value=(.34,.38,.36,1);bs.inputs['Roughness'].default_value=.67
    if kind:
        for socket in ['Base Color','Metallic','Roughness','Normal']:
            for link in list(bs.inputs[socket].links):links.remove(link)
        color,orm,normal=sets[kind]
        tex=nodes.new('ShaderNodeTexImage');tex.image=color;links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        tex=nodes.new('ShaderNodeTexImage');tex.image=orm
        sep=nodes.new('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],sep.inputs[0]);links.new(sep.outputs['Green'],bs.inputs['Roughness']);links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
        tex=nodes.new('ShaderNodeTexImage');tex.image=normal
        norm=nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.3 if kind=='carbon' else .12
        links.new(tex.outputs['Color'],norm.inputs['Color']);links.new(norm.outputs['Normal'],bs.inputs['Normal'])
    mat.use_backface_culling=True

# Named assembly pivots are the ONLY nodes animated by the web runtime.
for o in meshes:
    if o.name.startswith('Rotor_'):o['raven_rotor']=True

# Medical cargo identification; dark printed markings, not an emissive badge.
def plain(name,c,rough=.65):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=rough
    return m
ink=plain('Raven_Medical_Ink',(.017,.073,.064))
def label(text,loc,size):
    bpy.ops.object.select_all(action='DESELECT')
    curve=bpy.data.curves.new('Raven label','FONT');curve.body=text;curve.size=size;curve.align_x='CENTER';curve.extrude=0
    o=bpy.data.objects.new('Raven_Label_'+text,curve);bpy.context.collection.objects.link(o);o.parent=root;o.location=loc;o.rotation_euler=(math.pi/2,0,0);o.data.materials.append(ink)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
label('RAVEN',(0,-.163,-.355),.037)
label('MEDICAL SUPPLIES',(0,-.163,-.395),.013)
# Select only deliverable geometry; keep validation studio out of GLB.
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=OUT+'/raven-textured.glb',export_format='GLB',use_selection=True,export_apply=False,export_animations=False,export_cameras=False,export_lights=False,export_extras=True,export_draco_mesh_compression_enable=False)
# Studio QA saved in editable .blend. Render lights never enter the site asset.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
world=bpy.data.worlds.new('Raven studio');scene.world=world;world.use_nodes=True
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.12,.15,.18,1);bg.inputs['Strength'].default_value=.35

def aim(o,pt):o.rotation_euler=(Vector(pt)-o.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,size,color):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;aim(o,(0,0,-.1))
area('Softbox key',(2,-3,4),450,4,(1,.94,.86));area('Cool rim',(-2,2,2),650,3,(.76,.86,1));area('Fill',(-3,-2,1),180,3,(1,1,1))
d=bpy.data.cameras.new('Product QA');cam=bpy.data.objects.new('Product QA',d);scene.collection.objects.link(cam);cam.location=(3,-4,2.6);d.lens=55;aim(cam,(0,0,-.12));scene.camera=cam
scene.render.resolution_x=1100;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False;scene.render.filepath=OUT+'/raven-refined.png'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/raven-refined.blend')
print('RAVEN_EXPORT',os.path.getsize(OUT+'/raven-textured.glb'),flush=True)
bpy.ops.render.render(write_still=True)
