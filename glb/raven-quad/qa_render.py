"""Raven quad QA studio + Cycles views. Adds collection RQ_Studio (never exported), saves it into the .blend,
then renders the brief's section-7 views to glb/raven-quad/qa/.

  /Applications/Blender.app/Contents/MacOS/Blender --background glb/raven-quad/raven-quad.blend \
      --python glb/raven-quad/qa_render.py -- [view names...] [--samples N]
"""
import bpy, math, os, sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SAMPLES = int(args[args.index('--samples') + 1]) if '--samples' in args else 128
ONLY = [a for a in args if not a.startswith('--') and not a.isdigit()]
OUT = os.path.join(os.path.dirname(bpy.data.filepath), 'qa')
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene

old = bpy.data.collections.get('RQ_Studio')
if old:
    for o in list(old.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(old)
studio = bpy.data.collections.new('RQ_Studio')
sc.collection.children.link(studio)


def aim(o, target):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()


def softbox(name, loc, power, size, color=(1, 1, 1), target=(0, 0, -0.15)):
    d = bpy.data.lights.new('RQ_' + name, 'AREA')
    d.shape, d.size, d.size_y, d.energy, d.color = 'RECTANGLE', size[0], size[1], power, color
    o = bpy.data.objects.new('RQ_' + name, d)
    studio.objects.link(o)
    o.location = loc
    aim(o, target)
    return o


# Neutral product studio: large key + top + fill softboxes, restrained cool rim to separate black parts.
softbox('Key', (3.2, -3.6, 3.2), 1400, (3.0, 2.0))
softbox('Top', (0.0, 0.0, 4.2), 900, (3.5, 3.5))
softbox('Fill', (-4.0, -2.6, 1.2), 380, (3.0, 2.0))
softbox('Rim', (-0.6, 4.2, 1.8), 700, (3.0, 1.5), (0.93, 0.96, 1.0))
softbox('Under', (0.0, -1.5, -3.0), 160, (3.0, 3.0))

world = bpy.data.worlds.get('RQ_World') or bpy.data.worlds.new('RQ_World')
sc.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')


def set_world(rgb, strength=1.0):
    bg.inputs['Color'].default_value = (*rgb, 1)
    bg.inputs['Strength'].default_value = strength


try:
    sc.render.engine = 'CYCLES'
except TypeError as e:
    print('engine', e)
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.cycles.use_adaptive_sampling = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print('GPU unavailable, CPU render:', e)
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1600, 1000, 100
sc.render.film_transparent = False
sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'None'
sc.view_settings.exposure = -1.5


def camera(name, loc, target, lens=85, ortho=None):
    d = bpy.data.cameras.new('RQ_' + name)
    o = bpy.data.objects.new('RQ_' + name, d)
    studio.objects.link(o)
    o.location = loc
    if ortho:
        d.type, d.ortho_scale = 'ORTHO', ortho
    else:
        d.lens = lens
    d.clip_start, d.clip_end = 0.05, 50
    aim(o, target)
    return o


def orbit(target, direction, dist):
    return Vector(target) + Vector(direction).normalized() * dist


T1 = (0.0, 0.0, -0.17)
VIEWS = {
    'qa_01_front_three_quarter': camera('Cam_FrontThreeQuarter', orbit(T1, (0.62, -1, 0.14), 7.6), T1, 85),
    'qa_02_top_ortho': camera('Cam_TopOrtho', (0, 0, 5), (0, 0, 0), ortho=3.5),
    'qa_03_side_ortho': camera('Cam_SideOrtho', (5, 0, -0.2), (0, 0, -0.2), ortho=2.6),
    'qa_04_front_closeup': camera('Cam_FrontClose', orbit((0, -0.33, 0.0), (0.38, -1, 0.3), 2.4), (0, -0.33, 0.0), 100),
    'qa_05_arm_motor_closeup': camera('Cam_ArmMotor', orbit((0.6, -0.5, 0.04), (0.2, -1, 0.35), 2.1), (0.6, -0.5, 0.04), 100),
    'qa_06_cargo_closeup': camera('Cam_Cargo', orbit((0.06, -0.04, -0.34), (0.8, -1, 0.08), 2.2), (0.06, -0.04, -0.34), 85),
}
VIEWS['qa_02_top_ortho'].rotation_euler = (0, 0, 0)          # front (-Y) at image bottom
VIEWS['qa_03_side_ortho'].rotation_euler = (math.radians(90), 0, math.radians(90))  # left side, front at image left
sc.camera = VIEWS['qa_01_front_three_quarter']
bpy.ops.wm.save_mainfile()
print('RQ_STUDIO_SAVED')

# Stills only: stagger blade phase so the four stations read as separate rotors (file keeps zero rotation).
for name, ang in {'Front_Left': 25, 'Front_Right': -35, 'Rear_Left': 70, 'Rear_Right': -10}.items():
    bpy.data.objects[f'Rotor_{name}_Upper'].rotation_euler.z = math.radians(ang)
    bpy.data.objects[f'Rotor_{name}_Lower'].rotation_euler.z = math.radians(ang + 75)


def render(name, cam, world_rgb, strength=1.0):
    if ONLY and name not in ONLY:
        return
    sc.camera = cam
    set_world(world_rgb, strength)
    sc.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    print('RQ_RENDER', name, flush=True)


DARK = (0.012, 0.012, 0.013)
for name, cam in VIEWS.items():
    render(name, cam, DARK)
render('qa_07_white_background', VIEWS['qa_01_front_three_quarter'], (0.85, 0.85, 0.85))
render('qa_08a_gray_background', VIEWS['qa_01_front_three_quarter'], (0.18, 0.18, 0.18))


def diagnostic(mode):
    """Replace each surface with an emission of roughness or camera-space normal (incl. normal maps)."""
    for m in bpy.data.materials:
        if not m.name.startswith('MAT_Raven_') or not m.node_tree:
            continue
        nt = m.node_tree
        bs = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        em = nt.nodes.new('ShaderNodeEmission')
        em.name = 'RQ_diag'
        if mode == 'roughness':
            src = bs.inputs['Roughness']
            if src.is_linked:
                nt.links.new(src.links[0].from_socket, em.inputs['Color'])
            else:
                v = src.default_value
                em.inputs['Color'].default_value = (v, v, v, 1)
        else:
            src = bs.inputs['Normal'].links[0].from_socket if bs.inputs['Normal'].is_linked else None
            if src is None:
                geo = nt.nodes.new('ShaderNodeNewGeometry'); geo.name = 'RQ_diag_geo'
                src = geo.outputs['Normal']
            vt = nt.nodes.new('ShaderNodeVectorTransform'); vt.name = 'RQ_diag_vt'
            vt.vector_type, vt.convert_from, vt.convert_to = 'NORMAL', 'WORLD', 'CAMERA'
            mp = nt.nodes.new('ShaderNodeVectorMath'); mp.name = 'RQ_diag_map'
            mp.operation = 'MULTIPLY_ADD'
            mp.inputs[1].default_value = (0.5, 0.5, -0.5)  # Cycles camera space looks down +Z
            mp.inputs[2].default_value = (0.5, 0.5, 0.5)
            nt.links.new(src, vt.inputs['Vector']); nt.links.new(vt.outputs['Vector'], mp.inputs[0])
            nt.links.new(mp.outputs['Vector'], em.inputs['Color'])
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])


if not ONLY or any(n.startswith('qa_08b') or n.startswith('qa_08c') for n in ONLY):
    for o in studio.objects:
        if o.type == 'LIGHT':
            o.hide_render = True
    sc.view_settings.view_transform = 'Standard'
    sc.cycles.samples = 32
    diagnostic('roughness')
    render('qa_08b_roughness_diagnostic', VIEWS['qa_01_front_three_quarter'], (0.18, 0.18, 0.18), 0.0)
    bpy.ops.wm.revert_mainfile()  # drop diagnostic node edits (file on disk keeps clean materials)
    sc = bpy.context.scene
    for o in bpy.data.collections['RQ_Studio'].objects:
        if o.type == 'LIGHT':
            o.hide_render = True
    sc.view_settings.view_transform = 'Standard'
    sc.cycles.samples = 32
    bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
    diagnostic('normal')
    sc.camera = bpy.data.objects['RQ_Cam_FrontThreeQuarter']
    bg.inputs['Strength'].default_value = 0.0
    sc.render.filepath = os.path.join(OUT, 'qa_08c_normal_diagnostic.png')
    bpy.ops.render.render(write_still=True)
    print('RQ_RENDER qa_08c_normal_diagnostic', flush=True)
