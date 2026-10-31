"""Raven terrain v09: ship the Windows look-dev file (v08 grass/cliff, aerial_grass_rock lawns, Cottage_FREE
cottages, BlenderKit moss forest floor) as the runtime tile.

v05-v08 were authored live in team-blender on the Windows workstation; their ground material `M_RT_GrassCliff`
(~180 nodes) is NOT in 09_lookdev_material.py, so this step runs on that .blend instead of rebuilding from 01-11:

1. In the open look-dev file (v08): `web_cottages()` builds `Cottage_Web`, a 16-tri gable proxy fitted to the
   cottage (walls x -5.47..5.83, y -6.96..7.03, 2.5 high; roof ridge along x at y 1.07, z 6.0, eaves y -7.56 z 2.4 /
   y 6.79 z 2.6), recovers the 24 placements from RT_Natural_Houses_Cottage (Umeyama fit per 6,599-vertex chunk,
   plinth vertices first), and writes `Houses` = 24 proxies + the stone plinths, one smart-UV atlas, material
   `RavenHouses`. Saved as raven-terrain-v09-webport.blend.
2. Headless: blender.exe -b raven-terrain-v09-webport.blend --python 12_v09_webport.py -- <build-scripts> <out>
   Repo lighting (10 build_lighting; the preview sun PV_sun is hidden), the orthographic appearance render (11) at
   4096 with fix_edges (04), runtime Land-A (05), then `Houses` baked selected-to-active from the detailed cottages
   (DIFFUSE colour + direct + indirect, cage 0.25, ray 0.6, 1024 atlas), raw GLB export (05). Then encode.sh and
   check_terrain.py on the Mac, as for v03.
"""
import bpy, bmesh, os, sys, time
import numpy as np
from mathutils import Matrix, Vector

# Cottage proxy in Cottage_Master space (measured from the master's vertex slices and roof normals).
WALL = (-5.47, 5.83, -6.96, 7.03, 2.5)
ROOF = (-6.03, 6.40, 1.07, 6.0, -7.56, 2.4, 6.79, 2.6)  # x0, x1, ridge y, ridge z, front y, z, back y, z
VIS = ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_shadow',
       'visible_volume_scatter')


def _verts(me):
    a = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', a)
    return a.reshape(-1, 3)


def _umeyama(src, dst):
    ms, md = src.mean(0), dst.mean(0); s0, d0 = src - ms, dst - md
    U, S, Vt = np.linalg.svd(d0.T @ s0 / len(src)); D = np.eye(3)
    if np.linalg.det(U @ Vt) < 0:
        D[2, 2] = -1
    R = U @ D @ Vt; s = np.trace(np.diag(S) @ D) / (s0 ** 2).sum(1).mean()
    return s, R, md - s * R @ ms


def proxy_mesh():
    x0, x1, y0, y1, h = WALL
    rx0, rx1, ry, rz, fy, fz, by, bz = ROOF
    bm = bmesh.new()
    face = lambda *vs: bm.faces.new([bm.verts.new(v) for v in vs])
    c = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    for i in range(4):
        (ax, ay), (bx, by_) = c[i], c[(i + 1) % 4]
        face((ax, ay, 0), (bx, by_, 0), (bx, by_, h), (ax, ay, h))
    face((rx0, fy, fz), (rx1, fy, fz), (rx1, ry, rz), (rx0, ry, rz))
    face((rx1, by, bz), (rx0, by, bz), (rx0, ry, rz), (rx1, ry, rz))
    face((rx0, fy, fz), (rx0, ry, rz), (rx0, by, bz))
    face((rx1, by, bz), (rx1, ry, rz), (rx1, fy, fz))
    face((rx0, by, bz), (rx1, by, bz), (rx1, fy, fz), (rx0, fy, fz))
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    me = bpy.data.meshes.get('Cottage_Web') or bpy.data.meshes.new('Cottage_Web')
    bm.to_mesh(me); bm.free()
    return me


def web_cottages():
    master = _verts(bpy.data.objects['Cottage_Master'].data)
    hi = bpy.data.meshes['RT_Natural_Houses_Cottage']
    allv = _verts(hi); n = len(master); off = len(allv) - 24 * n  # plinth vertices come first
    proxy = proxy_mesh()
    out = bmesh.new()
    pb = bmesh.new(); pb.from_mesh(hi)
    bmesh.ops.delete(pb, geom=[f for f in pb.faces if f.material_index != 1], context='FACES')
    tmp = bpy.data.meshes.new('tmp'); pb.to_mesh(tmp); pb.free(); out.from_mesh(tmp); bpy.data.meshes.remove(tmp)
    for i in range(24):
        s, R, t = _umeyama(master, allv[off + i * n:off + (i + 1) * n])
        M = Matrix.Translation(Vector(t)) @ Matrix([list(r) + [0] for r in R] + [[0, 0, 0, 1]]) @ Matrix.Scale(s, 4)
        tb = bmesh.new(); tb.from_mesh(proxy); bmesh.ops.transform(tb, matrix=M, verts=tb.verts[:])
        tm = bpy.data.meshes.new('t'); tb.to_mesh(tm); tb.free(); out.from_mesh(tm); bpy.data.meshes.remove(tm)
    for f in out.faces:
        f.material_index = 0
    old = bpy.data.meshes.get('Houses_Web')
    if old:
        bpy.data.meshes.remove(old)
    me = bpy.data.meshes.new('Houses_Web'); out.to_mesh(me); out.free()
    for l in list(me.uv_layers):
        me.uv_layers.remove(l)
    me.uv_layers.new(name='UVMap')
    img = bpy.data.images.get('RT_Houses_Bake')
    if img and tuple(img.size) != (1024, 1024):
        bpy.data.images.remove(img); img = None
    img = img or bpy.data.images.new('RT_Houses_Bake', 1024, 1024, alpha=False)
    m = bpy.data.materials.get('RavenHouses') or bpy.data.materials.new('RavenHouses')
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img; tx.name = 'BAKE_TARGET'
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tx.outputs['Color'], bs.inputs['Base Color']); nt.links.new(bs.outputs[0], o.inputs[0])
    bs.inputs['Roughness'].default_value = 1.0; nt.nodes.active = tx
    me.materials.append(m)
    ob = bpy.data.objects['Houses']; ob.data = me; ob['raven_runtime'] = True
    for x in bpy.context.view_layer.objects:
        x.select_set(False)
    ob.hide_set(False); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def build(bs_dir, out):
    tex = os.path.join(out, 'textures'); os.makedirs(tex, exist_ok=True)
    os.environ['RAVEN_TERRAIN_OUT'] = out
    t0 = time.time()
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == 'OPTIX'
    sc = bpy.context.scene; sc.cycles.device = 'GPU'
    g = {'__name__': 'raven_terrain'}
    for name in ('04_bake.py', '05_runtime_export.py', '10_lighting.py', '11_appearance_bake.py'):
        exec(compile(open(os.path.join(bs_dir, name)).read(), name, 'exec'), g)
    g['OUT'] = out
    g['build_lighting']()
    for name in ('PV_sun', 'BakeSun'):
        if bpy.data.objects.get(name):
            bpy.data.objects[name].hide_render = True
    g['setup_appearance_scene']()
    img = g['render_appearance'](4096, os.path.join(tex, 'raven-natural-render-4096.png'))
    g['fix_edges'](img)
    fixed = os.path.join(tex, 'raven-natural-bake-4096.png')
    ims = sc.render.image_settings; ims.file_format = 'PNG'; ims.color_mode = 'RGB'; ims.color_depth = '8'
    img.save_render(fixed, scene=sc)
    bpy.data.images.remove(img)
    img = bpy.data.images.load(fixed); img.name = 'RT_Natural_Bake'; img.colorspace_settings.name = 'sRGB'; img.pack()
    land = g['runtime_terrain']()
    houses = bpy.data.objects['Houses']; hi = bpy.data.objects['RT_Natural_Houses']
    land.hide_render = True
    bpy.data.collections['20_RUNTIME_export'].hide_render = False
    houses.hide_render = False
    for a in VIS:
        setattr(houses, a, False)  # bake target only: must not shadow the cottages it samples
    hi.visible_camera = True; hi.hide_render = False
    nt = houses.data.materials[0].node_tree; nt.nodes.active = nt.nodes['BAKE_TARGET']
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    hi.hide_set(False); houses.hide_set(False)
    hi.select_set(True); houses.select_set(True); bpy.context.view_layer.objects.active = houses
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT', 'COLOR'}, use_selected_to_active=True,
                        cage_extrusion=0.25, max_ray_distance=0.6, margin=4)
    hb = bpy.data.images['RT_Houses_Bake']
    hb.filepath_raw = os.path.join(tex, 'raven-houses-bake-1k.png'); hb.file_format = 'PNG'; hb.save(); hb.pack()
    for a in VIS:
        setattr(houses, a, True)
    for a in list(houses.data.color_attributes):
        houses.data.color_attributes.remove(a)
    path = g['export']([land, houses], 'raven-terrain-raw.glb', draco=False, image_format='AUTO')
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'raven-terrain-v09-built.blend'))
    print('BUILD OK', path, os.path.getsize(path), round(time.time() - t0, 1), 's')


if __name__ == '__main__' and '--' in sys.argv:
    build(*sys.argv[sys.argv.index('--') + 1:][:2])
