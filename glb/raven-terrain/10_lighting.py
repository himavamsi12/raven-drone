"""Raven terrain 10 (look-dev): golden-hour light. Warm sun 20 deg up on the scene sun's azimuth (SUN_POSITION in
Blender axes), physical sky (multiple scattering) as fill. Haze, clouds and the colour grade are not baked: the site
supplies fog and a final grade, and the bake must stay a ground appearance.
"""
import bpy, math
from mathutils import Vector

SUN_AZ = Vector((-40.0, 30.0, 0.0)).normalized()
SUN_ELEV = math.radians(20.0)


def sun_dir():
    return Vector((SUN_AZ.x * math.cos(SUN_ELEV), SUN_AZ.y * math.cos(SUN_ELEV), math.sin(SUN_ELEV))).normalized()


def build_lighting(sun_energy=10.0, sky_strength=0.2):
    sc = bpy.context.scene
    w = bpy.data.worlds.get('LD_World') or bpy.data.worlds.new('LD_World')
    w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground')
    sky = nt.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'MULTIPLE_SCATTERING'
    except TypeError:
        pass
    sky.sun_disc = False
    sky.sun_elevation = SUN_ELEV
    sky.sun_rotation = math.atan2(SUN_AZ.x, SUN_AZ.y) % (2 * math.pi)
    sky.air_density = 1.2; sky.aerosol_density = 1.6
    nt.links.new(sky.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = sky_strength
    nt.links.new(bg.outputs[0], out.inputs['Surface'])
    sc.world = w
    sun = bpy.data.objects.get('LD_Sun')
    if not sun:
        sun = bpy.data.objects.new('LD_Sun', bpy.data.lights.new('LD_Sun', 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = sun_energy; sun.data.color = (1.0, 0.83, 0.62); sun.data.angle = math.radians(1.5)
    sun.rotation_euler = sun_dir().to_track_quat('Z', 'Y').to_euler()
    sun.hide_render = False
    old = bpy.data.objects.get('BakeSun')
    if old:
        old.hide_render = True
    sc.view_settings.view_transform = 'Standard'
    return sun
