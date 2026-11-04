"""Studio renders of the Raven hexa for the feature cards.

Builds a scene "Raven_Studio" (the open file's other scenes are left alone): imports the black hexa, swaps the
shared REF_Carbon for two lacquered-twill copies (arms finer than plates), adds a black cyclorama, softbox/strip
lights and one camera per feature, then renders each camera with Cycles (GPU, OIDN) to 2560x1440 16-bit PNG.

Run inside Blender (Text Editor or MCP) or headless:
  blender -b -P render_feature_cards.py -- <path/to/Hexa_Medical_Drone_Black.glb> <out_dir> [shot ...]
Shots: carbon-arm motor-pod carbon-frame landing-gear eoir medical-box hero, and the 2400x2064 transparent card
shots sensors motor-pods (default: all).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
GLB = ARGV[0] if len(ARGV) > 0 else r"C:\Users\india\Documents\Hexa_Medical_Drone_Black.glb"
OUT = ARGV[1] if len(ARGV) > 1 else r"C:\Users\india\Documents\raven-feature-renders"
ONLY = ARGV[2:]

# Front-left arm, measured on the source: hub -> motor direction, horizontal; arm centreline z 0.637, r 0.031.
ARM = Vector((0.4730, -0.8811, 0))
SIDE = Vector((-0.8811, -0.4730, 0))  # perpendicular to the arm, towards the front-right
UP = Vector((0, 0, 1))

# name: (file, target, eye direction, distance, lens mm, f-stop, focus point or None, floor visible, exposure)
SHOTS = {
    "carbon-arm": ("01_carbon-fibre-arm", ARM * 0.62 + UP * 0.66, SIDE * 0.8 + ARM * 0.5 + UP * 0.25,
                   0.62, 65, 2.8, ARM * 0.62 + UP * 0.64 + SIDE * 0.03, False, 0.0),
    "motor-pod": ("02_sealed-motor-pod", ARM * 0.68 + UP * 0.655, SIDE * 0.97 + ARM * 0.18 + UP * 0.2,
                  0.55, 60, 3.5, ARM * 0.70 + UP * 0.637 + SIDE * 0.03, False, 0.0),
    "carbon-frame": ("03_carbon-frame-plate", Vector((0.18, -0.05, 0.70)), Vector((1, -0.35, 0.55)),
                     0.6, 65, 3.2, None, False, -0.45),
    "landing-gear": ("04_carbon-landing-gear", Vector((0.36, -0.45, 0.06)), Vector((1, -0.55, 0.18)),
                     0.65, 70, 3.2, None, False, 0.0),
    "eoir": ("05_eo-ir-camera", Vector((-0.03, -0.26, 0.45)), Vector((0.35, -1, 0.05)),
             0.55, 85, 3.5, None, False, 0.0),
    "medical-box": ("06_medical-payload-box", Vector((-0.03, -0.05, 0.29)), Vector((0.7, -1, 0.25)),
                    1.35, 70, 4.0, None, False, 0.0),
    "hero": ("07_hero-studio", Vector((0.0, 0.0, 0.38)), Vector((0.75, -1, 0.30)),
             4.9, 70, 8.0, None, True, 0.0),
}

# Card shots after the user's card mock-ups (2026-11-03): 2400x2064 (the cards' 1.16:1), subject on the right via
# lens shift so the copy sits bottom-left, RGBA with a transparent background for any card colour.
# name: (file, eye, target, lens mm, f-stop, focus point, shift_x)
CARD_SIZE = (2400, 2064)
CARD_SHOTS = {
    "sensors": ("08_sensors-card", Vector((-0.11, -0.80, 0.36)), Vector((-0.06, -0.25, 0.49)),
                34, 5.6, Vector((-0.03, -0.31, 0.46)), -0.21),
    # Front-left pod (status LED) with the mid-left pod behind, from just above the pod tops; both arms run left.
    "motor-pods": ("09_motor-pods-card", Vector((-0.354, -1.198, 0.91)), Vector((0.393, -0.732, 0.68)),
                   55, 6.3, Vector((0.393, -0.732, 0.64)), -0.10),
}


def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def setup_scene():
    if bpy.context.window:  # interactive: own scene beside the open file's
        sc = bpy.data.scenes.get("Raven_Studio") or bpy.data.scenes.new("Raven_Studio")
        bpy.context.window.scene = sc
    else:  # headless (-b, factory file): no window to switch, use the startup scene
        sc = bpy.context.scene
        sc.name = "Raven_Studio"
    for o in list(sc.collection.all_objects):
        bpy.data.objects.remove(o)
    bpy.ops.import_scene.gltf(filepath=GLB)
    for o in list(sc.objects):
        if o.type == "LIGHT":  # source nav point lights
            bpy.data.objects.remove(o)
    return sc


def carbon_materials(sc):
    src = bpy.data.materials["REF_Carbon"]

    def build(name, scale):
        old = bpy.data.materials.get(name)
        if old:
            bpy.data.materials.remove(old)
        m = src.copy()
        m.name = name
        N, L = m.node_tree.nodes, m.node_tree.links
        p = principled(m)
        tc, mp = N.new("ShaderNodeTexCoord"), N.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (scale, scale, 1)
        L.new(tc.outputs["UV"], mp.inputs["Vector"])
        imgs = [n for n in N if n.type == "TEX_IMAGE"]
        for im in imgs:
            L.new(mp.outputs["Vector"], im.inputs["Vector"])
            im.interpolation = "Cubic"
        col = next(n for n in imgs if n.image.name == "carbon_twill_color")
        hsv = N.new("ShaderNodeHueSaturation")  # neutral, darker tows: weave shows in the coat highlight
        hsv.inputs["Saturation"].default_value = 0.0
        hsv.inputs["Value"].default_value = 0.42
        L.new(col.outputs["Color"], hsv.inputs["Color"])
        L.new(hsv.outputs["Color"], p.inputs["Base Color"])
        sep = next(n for n in N if n.type == "SEPARATE_COLOR")
        mr = N.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = 0.22
        mr.inputs["To Max"].default_value = 0.5
        L.new(sep.outputs["Green"], mr.inputs["Value"])
        L.new(mr.outputs["Result"], p.inputs["Roughness"])
        next(n for n in N if n.type == "MATH").inputs[1].default_value = 0.35  # metallic
        p.inputs["Coat Weight"].default_value = 1.0
        p.inputs["Coat Roughness"].default_value = 0.035
        p.inputs["Coat IOR"].default_value = 1.52
        next(n for n in N if n.type == "NORMAL_MAP").inputs["Strength"].default_value = 0.8
        return m

    arm, plate = build("RAVEN_Carbon_Arm", 1.8), build("RAVEN_Carbon_Plate", 1.0)
    for o in sc.objects:
        if o.type == "MESH":
            for s in o.material_slots:
                if s.material and s.material.name == "REF_Carbon":
                    s.material = arm if o.name == "Hexa_Arms_Motors" else plate


def studio(sc):
    coll = bpy.data.collections.get("Studio") or bpy.data.collections.new("Studio")
    if coll.name not in sc.collection.children:
        sc.collection.children.link(coll)
    for o in list(coll.objects):
        bpy.data.objects.remove(o)

    w = bpy.data.worlds.get("Studio_World") or bpy.data.worlds.new("Studio_World")
    w.use_nodes = True
    sc.world = w
    nt = w.node_tree
    nt.nodes.clear()
    bg, out = nt.nodes.new("ShaderNodeBackground"), nt.nodes.new("ShaderNodeOutputWorld")
    bg.inputs["Color"].default_value = (0.02, 0.021, 0.024, 1)
    bg.inputs["Strength"].default_value = 0.05
    nt.links.new(bg.outputs[0], out.inputs[0])

    # Cyclorama: flat floor curving into a back wall. Close-ups hide it from camera (black ground, reflections kept).
    me, bm = bpy.data.meshes.new("Cyc"), bmesh.new()
    prof = []
    for i in range(25):
        t = i / 24
        if t < 0.5:
            prof.append((-6 + t / 0.5 * 10, 0))
        else:
            a = (t - 0.5) / 0.5 * math.pi / 2
            prof.append((4 + 3 * math.sin(a), 3 - 3 * math.cos(a)))
    prof.append((7, 10))
    rows = [[bm.verts.new((-14, y, z)), bm.verts.new((14, y, z))] for y, z in prof]
    for a, b in zip(rows, rows[1:]):
        bm.faces.new((a[0], a[1], b[1], b[0]))
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    cyc = bpy.data.objects.new("Studio_Cyc", me)
    coll.objects.link(cyc)
    cm = bpy.data.materials.get("Studio_Cyc_Mat") or bpy.data.materials.new("Studio_Cyc_Mat")
    cm.use_nodes = True
    p = principled(cm)
    p.inputs["Base Color"].default_value = (0.006, 0.006, 0.0065, 1)
    p.inputs["Roughness"].default_value = 0.9
    p.inputs["Specular IOR Level"].default_value = 0.05
    me.materials.append(cm)

    # Area lights with narrowed spread (grid softboxes); spread concentrates power, so energies are low.
    def area(name, loc, size, size_y, energy, spread, color):
        L = bpy.data.lights.new(name, "AREA")
        L.shape, L.size, L.size_y, L.energy, L.color = "RECTANGLE", size, size_y, energy, color
        L.spread = math.radians(spread)
        o = bpy.data.objects.new(name, L)
        coll.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector((0, 0, 0.45)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    area("Key_Softbox", (-2.6, -2.4, 3.0), 2.4, 1.6, 80, 70, (1, 0.97, 0.93))
    area("Fill_Card", (3.2, -1.6, 1.2), 3.0, 2.0, 8, 90, (0.93, 0.96, 1))
    area("Top_Softbox", (0, 0, 4.2), 3.0, 3.0, 9, 60, (1, 1, 1))
    area("Rim_Strip_L", (-3.0, 2.6, 1.6), 0.25, 3.5, 160, 50, (0.95, 0.97, 1))
    area("Rim_Strip_R", (3.0, 2.4, 1.8), 0.25, 3.5, 160, 50, (1, 0.98, 0.95))

    for key, (_, target, eye, dist, lens, fstop, focus, _, _) in SHOTS.items():
        cam = bpy.data.objects.new("CAM_" + key, bpy.data.cameras.new("CAM_" + key))
        coll.objects.link(cam)
        cam.data.lens, cam.data.sensor_width = lens, 36
        cam.location = target + eye.normalized() * dist
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.dof.use_dof = True
        cam.data.dof.aperture_fstop = fstop
        cam.data.dof.focus_distance = ((focus or target) - cam.location).length
    for key, (_, eye, target, lens, fstop, focus, shift_x) in CARD_SHOTS.items():
        cam = bpy.data.objects.new("CAM_" + key, bpy.data.cameras.new("CAM_" + key))
        coll.objects.link(cam)
        cam.data.lens, cam.data.sensor_width, cam.data.sensor_fit = lens, 36, "HORIZONTAL"
        cam.data.shift_x = shift_x
        cam.location = eye
        cam.rotation_euler = (target - eye).to_track_quat("-Z", "Y").to_euler()
        cam.data.dof.use_dof = True
        cam.data.dof.aperture_fstop = fstop
        cam.data.dof.focus_distance = (focus - eye).length
    return cyc


def render_settings(sc):
    try:
        sc.render.engine = "CYCLES"
    except TypeError as e:
        print(e)
    sc.cycles.device = "GPU"
    prefs = bpy.context.preferences.addons["cycles"].preferences  # headless runs may not have a device saved
    for kind in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
        try:
            prefs.compute_device_type = kind
        except TypeError:
            continue
        prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == kind]
        if gpus:
            for d in gpus:
                d.use = True
            break
    sc.cycles.samples = 512
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.008
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    sc.cycles.max_bounces, sc.cycles.glossy_bounces, sc.cycles.transmission_bounces = 12, 6, 8
    sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 0.5
    r = sc.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = 2560, 1440, 100
    r.film_transparent = False
    r.image_settings.file_format, r.image_settings.color_mode = "PNG", "RGB"
    r.image_settings.color_depth, r.image_settings.compression = "16", 15
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"


def main():
    sc = setup_scene()
    carbon_materials(sc)
    cyc = studio(sc)
    render_settings(sc)
    os.makedirs(OUT, exist_ok=True)
    for key, (fname, *_, floor, exposure) in SHOTS.items():
        if ONLY and key not in ONLY:
            continue
        cyc.visible_camera = floor
        sc.view_settings.exposure = exposure
        sc.camera = bpy.data.objects["CAM_" + key]
        sc.render.filepath = os.path.join(OUT, fname + ".png")
        bpy.ops.render.render(write_still=True)
        print("wrote", sc.render.filepath)
    r = sc.render
    r.resolution_x, r.resolution_y = CARD_SIZE
    r.film_transparent, r.image_settings.color_mode = True, "RGBA"
    cyc.visible_camera = False
    sc.view_settings.exposure = 0.0
    for key, (fname, *_) in CARD_SHOTS.items():
        if ONLY and key not in ONLY:
            continue
        sc.camera = bpy.data.objects["CAM_" + key]
        r.filepath = os.path.join(OUT, fname + ".png")
        bpy.ops.render.render(write_still=True)
        print("wrote", r.filepath)


main()
