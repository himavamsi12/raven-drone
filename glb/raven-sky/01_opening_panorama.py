"""Raven opening panorama: sky, cloud layers and far hill/mountain ranges behind the live terrain tiles.

User, 2026-11-02: the opening low shot showed an empty haze band between the last terrain tile (~45 units) and two
flat procedural ridge rings. Reference (local only): a deep blue sky with scattered cumulus and cirrus, a cumulus band
sitting on the horizon, receding ridges that turn bluer and flatter with distance, two snow-capped massifs, white
valley fog on the right, and a skyline that falls from left to right into hazy distance.

Measured site opening camera (1440x900, scroll 0): world (-2.2, -0.37, 1.5), about 2 units above the ground, heading
56 deg (three atan2(x, -z) = Blender atan2(x, y)), pitched up 8 deg, vertical fov 75 (~102 deg wide). The horizon
leaves the frame by scroll 1800 while the camera is still below y 2.5, so a panorama at infinity has negligible
parallax error. 1 Blender unit = 1 site unit; camera at z = CAM_H above ground level 0.

The render is a 360 deg equirectangular band, latitude LAT_MIN..90 (OpeningSky samples it by view direction).
Distant surfaces fade into the sky colour of their own direction, clamped just above the horizon, so the haze always
matches the sky. Blender 5.2 disables the Sky Texture `Vector` input for the scattering models, so pass 1 renders the
world alone to a small linear EXR panorama and the haze samples that through an Environment Texture. Valley fog is a thin volume slab, kept clear near the camera.

Headless (Windows workstation):
  blender.exe -b --factory-startup --python 01_opening_panorama.py -- <out_dir> [preview]
  blender.exe ... -- <out_dir> [preview] [full]
  -> <out_dir>/raven-opening-land.png (RGBA, land only, latitude LAT_MIN..LAND_LAT_MAX: what the site uses) or with
  `full` raven-opening-panorama.png (sky + clouds too), + .blend. `preview` renders 2048 wide, 16 samples.
"""
import bpy, math, os, sys, time
import numpy as np
from mathutils import Vector, noise

CAM_H = 2.0
VIEW_AZ = 56.0                     # opening heading (deg); composition is built around it
SUN_AZ, SUN_EL = -53.0, 38.0       # scene SUN_POSITION azimuth (glTF (-40, 100, -30)); lower than the scene's 63 deg
LAT_MIN, LAT_MAX = -22.5, 90.0
LAND_LAT_MAX = 12.0                # land layer: the highest peaks reach ~7.5 deg
PX_PER_DEG = 8192 / 360            # 22.8 px/deg (site opening: ~12 px/deg at fov 75, 15 at 59)
SAMPLES = 96

# Massifs: (azimuth deg, distance, height, radius). Two snow peaks in the opening view, lesser ones around the ring.
# Far ranges, massifs and the 850/1400 ridgelines: user removed them (2026-11-02, "not required"); kept switchable.
FAR_RANGES = False
# Hill range in front of the site's far mountain rings: flattened by the user (2026-11-02, "a bit flat").
RANGE_SCALE = 0.5
MASSIFS = [(34, 2600, 370, 560), (71, 3300, 320, 440), (52, 4200, 210, 650), (-20, 3000, 290, 650),
           (150, 3500, 320, 750), (220, 2800, 270, 650), (290, 3200, 340, 700)]
# Ridgelines: (distance, peak elevation seen from the camera in deg, radial width as a fraction, noise seed).
RIDGELINES = [(170, 1.1, 0.24, 1.3), (300, 1.5, 0.22, 4.7), (520, 1.9, 0.2, 8.1), (850, 2.2, 0.2, 2.9),
              (1400, 2.5, 0.18, 6.3)]
# Flatter land in front of the site's far ridge rings (user, 2026-11-02): ridgeline elevations and the ranged relief
# are scaled by this (1.0 = the first land render, which rose to ~3 deg).
LAND_FLATTEN = 0.45
# Skyline falls from left to right: ranges lower and hazier between these azimuths (deg).
OPEN_AZ = (88, 135)


def az_of(x, y):
    return math.degrees(math.atan2(x, y))


def wrap180(a):
    return (a + 180) % 360 - 180


def height(x, y):
    """Ground height at (x, y): rolling hills near the camera, ranges further out, massifs at the far ring."""
    r = math.hypot(x, y)
    a = az_of(x, y)
    p = Vector((x, y, 0.0))
    # domain warp for natural, non-grid ridges
    w = Vector((noise.noise(p / 900.0 + Vector((3.1, 0, 0))), noise.noise(p / 900.0 + Vector((0, 7.7, 0))), 0)) * 260
    q = (p + w)
    rolling = noise.fractal(q / 70.0, 0.9, 2.0, 5) * 0.5 + 0.5           # ~0..1
    ridged = noise.ridged_multi_fractal(q / 520.0, 0.95, 2.1, 6, 1.0, 2.0) / 2.2  # ~0..1
    # amplitude grows with distance: tile-like relief near (~1 unit), ranges of 20-70 units further out
    amp_roll = 0.9 + 6.0 * min(r / 400.0, 1.0)
    amp_range = 115.0 * LAND_FLATTEN * min(max((r - 150.0) / 1100.0, 0.0), 1.0) ** 1.3
    if not FAR_RANGES:  # far ranges off (user, 2026-11-02): relief settles into a low hazy horizon beyond ~600
        amp_range *= 1.0 - min(max((r - 450.0) / 700.0, 0.0), 1.0)
    open_fac = 1.0
    da = (wrap180(a - OPEN_AZ[0]), wrap180(OPEN_AZ[1] - a))
    if da[0] > 0 and da[1] > 0:  # inside the open sector: low hazy ranges
        edge = min(da) / 20.0
        open_fac = 1.0 - 0.6 * min(edge, 1.0)
    h = rolling * amp_roll + ridged * amp_range * open_fac * RANGE_SCALE
    # stacked ridgelines (reference: each farther ridge a separate, paler silhouette)
    for rk, el_deg, width, seed in (RIDGELINES if FAR_RANGES else RIDGELINES[:3]):
        g = math.exp(-((r - rk) / (width * rk)) ** 2)
        if g > 1e-3:
            # undulation along the ridge from planar noise at a wavelength tied to the ridge distance (smooth crests)
            pr = Vector((x, y, seed * 1000.0)) / (0.22 * rk)
            along = max(0.15, 0.55 + 0.9 * noise.fractal(pr, 1.0, 2.0, 4) + 0.12 * noise.ridged_multi_fractal(pr * 3.0, 1.0, 2.0, 3, 1.0, 2.0))
            h += g * rk * math.tan(math.radians(el_deg * LAND_FLATTEN)) * along * open_fac * RANGE_SCALE
    for maz, md, mh, mr in (MASSIFS if FAR_RANGES else ()):
        mx, my = md * math.sin(math.radians(maz)), md * math.cos(math.radians(maz))
        d2 = ((x - mx) ** 2 + (y - my) ** 2) / (mr * mr)
        if d2 < 9:
            peak = math.exp(-d2) * (0.55 + 0.45 * noise.ridged_multi_fractal(q / 260.0, 1.0, 2.2, 6, 1.0, 2.0) / 2.2)
            h += mh * peak
    return h


def build_terrain():
    rings = np.geomspace(0.5, 9000.0, 480)  # from under the camera: no hole when looking down
    na = 2048
    ang = np.arange(na) * 2 * math.pi / na
    verts = []
    for r in rings:
        for t in ang:
            x, y = r * math.sin(t), r * math.cos(t)
            verts.append((x, y, height(x, y)))
    faces = []
    for i in range(len(rings) - 1):
        for j in range(na):
            a = i * na + j; b = i * na + (j + 1) % na
            faces.append((a, b, b + na, a + na))
    me = bpy.data.meshes.new('PN_Terrain')
    me.from_pydata(verts, [], faces)
    me.shade_smooth() if hasattr(me, 'shade_smooth') else None
    ob = bpy.data.objects.new('PN_Terrain', me)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(terrain_material())
    print('terrain verts', len(verts), 'max h', round(max(v[2] for v in verts), 1), flush=True)
    return ob


def _sky_node(nt):
    s = nt.nodes.new('ShaderNodeTexSky')
    s.sky_type = 'MULTIPLE_SCATTERING'
    s.sun_elevation = math.radians(SUN_EL)
    s.sun_rotation = math.radians(SUN_AZ)  # measured: rotation = heading, clockwise from +Y (0 -> +Y, 90 -> +X)
    s.air_density = 1.0
    s.aerosol_density = 0.7  # deep blue overhead, pale warm horizon (reference)
    s.ozone_density = 1.0
    s.sun_disc = True
    s.sun_intensity = SUN_INTENSITY  # direct light only: exposure is set by the sky, the full sun blew out the ground
    return s


def haze_mix(nt, surface, dist_scale, strength=1.0, min_z=0.012, color=None):
    """Mix a surface shader toward the sky colour of the view direction (clamped above the horizon) by distance."""
    N = nt.nodes; L = nt.links
    geo = N.new('ShaderNodeNewGeometry')
    neg = N.new('ShaderNodeVectorMath'); neg.operation = 'SCALE'; neg.inputs['Scale'].default_value = -1.0
    L.new(geo.outputs['Incoming'], neg.inputs[0])
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(neg.outputs[0], sep.inputs[0])
    # min_z: lowest view-direction z the haze colour is taken from (0.012 = near-white horizon, 0.1 = ~6 deg, bluer)
    mx = N.new('ShaderNodeMath'); mx.operation = 'MAXIMUM'; mx.inputs[1].default_value = min_z
    L.new(sep.outputs['Z'], mx.inputs[0])
    comb = N.new('ShaderNodeCombineXYZ')
    L.new(sep.outputs['X'], comb.inputs['X']); L.new(sep.outputs['Y'], comb.inputs['Y']); L.new(mx.outputs[0], comb.inputs['Z'])
    sky = N.new('ShaderNodeTexEnvironment'); sky.image = SKY_ENV['image']  # pass-1 sky render (see sky_env)
    L.new(comb.outputs[0], sky.inputs['Vector'])
    em = N.new('ShaderNodeEmission')
    if color is None:
        L.new(sky.outputs['Color'], em.inputs['Color'])
    else:  # fixed haze colour (land mode: the site's own sky horizon)
        em.inputs['Color'].default_value = (*color, 1.0)
    em.inputs['Strength'].default_value = strength
    cam = N.new('ShaderNodeCameraData')
    # fac = 1 - exp(-d / D), D grows with altitude (thinner air higher up)
    sepw = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'], sepw.inputs[0])
    alt = N.new('ShaderNodeMath'); alt.operation = 'MULTIPLY_ADD'
    alt.inputs[1].default_value = 1.0 / 160.0; alt.inputs[2].default_value = 1.0
    L.new(sepw.outputs['Z'], alt.inputs[0])
    D = N.new('ShaderNodeMath'); D.operation = 'MULTIPLY'; D.inputs[1].default_value = dist_scale
    L.new(alt.outputs[0], D.inputs[0])
    div = N.new('ShaderNodeMath'); div.operation = 'DIVIDE'
    L.new(cam.outputs['View Distance'], div.inputs[0]); L.new(D.outputs[0], div.inputs[1])
    ex = N.new('ShaderNodeMath'); ex.operation = 'EXPONENT'
    ng = N.new('ShaderNodeMath'); ng.operation = 'MULTIPLY'; ng.inputs[1].default_value = -1.0
    L.new(div.outputs[0], ng.inputs[0]); L.new(ng.outputs[0], ex.inputs[0])
    fac = N.new('ShaderNodeMath'); fac.operation = 'SUBTRACT'; fac.inputs[0].default_value = 1.0
    L.new(ex.outputs[0], fac.inputs[1])
    mix = N.new('ShaderNodeMixShader')
    L.new(fac.outputs[0], mix.inputs['Fac']); L.new(surface, mix.inputs[1]); L.new(em.outputs[0], mix.inputs[2])
    return mix.outputs[0]


def _noise(nt, scale, detail=6.0, rough=0.55, coord=None):
    n = nt.nodes.new('ShaderNodeTexNoise'); n.noise_dimensions = '3D'
    n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rough
    if coord is not None:
        nt.links.new(coord, n.inputs['Vector'])
    return n


def _ramp(nt, fac, stops):
    r = nt.nodes.new('ShaderNodeValToRGB'); nt.links.new(fac, r.inputs['Fac'])
    el = r.color_ramp.elements
    while len(el) < len(stops):
        el.new(0.5)
    for e, (pos, col) in zip(el, stops):
        e.position = pos; e.color = col
    return r


def _hex(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)


def _mix_rgb(nt, fac, a, b):
    """Mix node in RGBA mode. By name, inputs['A'] / ['B'] are the hidden float sockets: use the identifiers."""
    m = nt.nodes.new('ShaderNodeMix'); m.data_type = 'RGBA'
    ins = {s.identifier: s for s in m.inputs}
    nt.links.new(fac, ins['Factor_Float'])
    for key, v in (('A_Color', a), ('B_Color', b)):
        if isinstance(v, tuple):
            ins[key].default_value = v
        else:
            nt.links.new(v, ins[key])
    return next(o for o in m.outputs if o.identifier == 'Result_Color')


def terrain_material():
    m = bpy.data.materials.new('PN_Ground'); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    for n in list(N):
        N.remove(n)
    out = N.new('ShaderNodeOutputMaterial')
    geo = N.new('ShaderNodeNewGeometry')
    pos = geo.outputs['Position']
    # grass: golden meadows and green slopes; forest patches; rock on steep faces; snow on the massifs
    meadow = _ramp(nt, _noise(nt, 1 / 140.0, coord=pos).outputs['Fac'],
                   [(0.35, _hex('#6f7f35')), (0.55, _hex('#9a8c48')), (0.7, _hex('#b49a55'))])
    forest_n = _noise(nt, 1 / 25.0, 8.0, 0.65, coord=pos)
    forest_m = _ramp(nt, forest_n.outputs['Fac'], [(0.47, (0, 0, 0, 1)), (0.53, (1, 1, 1, 1))])  # ~40% forest
    mixf = _mix_rgb(nt, forest_m.outputs['Color'], meadow.outputs['Color'], _hex('#26361f'))
    # slope (normal z) -> rock
    sepn = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Normal'], sepn.inputs[0])
    rock_m = _ramp(nt, sepn.outputs['Z'], [(0.72, (1, 1, 1, 1)), (0.86, (0, 0, 0, 1))])
    mixr = _mix_rgb(nt, rock_m.outputs['Color'], mixf, _hex('#8b8a82'))
    # snow above a noisy snowline, less on steep faces
    sepp = N.new('ShaderNodeSeparateXYZ'); L.new(pos, sepp.inputs[0])
    sn = _noise(nt, 1 / 60.0, coord=pos)
    snl = N.new('ShaderNodeMath'); snl.operation = 'MULTIPLY_ADD'
    snl.inputs[1].default_value = 60.0; snl.inputs[2].default_value = 165.0  # snowline 165..225: massifs only
    L.new(sn.outputs['Fac'], snl.inputs[0])
    above = N.new('ShaderNodeMath'); above.operation = 'SUBTRACT'
    L.new(sepp.outputs['Z'], above.inputs[0]); L.new(snl.outputs[0], above.inputs[1])
    snow_m = N.new('ShaderNodeMapRange'); snow_m.inputs['From Min'].default_value = 0.0
    snow_m.inputs['From Max'].default_value = 25.0
    L.new(above.outputs[0], snow_m.inputs['Value'])
    flat = _ramp(nt, sepn.outputs['Z'], [(0.55, (0, 0, 0, 1)), (0.75, (1, 1, 1, 1))])
    snow_f = N.new('ShaderNodeMath'); snow_f.operation = 'MULTIPLY'
    L.new(snow_m.outputs['Result'], snow_f.inputs[0]); L.new(flat.outputs['Color'], snow_f.inputs[1])
    mixs = _mix_rgb(nt, snow_f.outputs[0], mixr, _hex('#f2f3f5'))
    bsdf = N.new('ShaderNodeBsdfPrincipled'); bsdf.inputs['Roughness'].default_value = 0.95
    L.new(mixs, bsdf.inputs['Base Color'])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35
    L.new(_noise(nt, 1 / 6.0, 4.0, 0.6, coord=pos).outputs['Fac'], bump.inputs['Height'])
    L.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    # Land fades to the site's procedural sky horizon (OpeningSky uHorizon = SKY_COLOR #c9e0f7), divided by the render
    # exposure so it lands on exactly that colour. The Blender sky 6 deg up clipped to white at this exposure and drew
    # a flat white band along the horizon (user, 2026-11-02).
    ev = 2.0 ** EXPOSURE['ev']
    L.new(haze_mix(nt, bsdf.outputs[0], 2600.0, color=tuple(c / ev for c in SITE_HORIZON)), out.inputs['Surface'])
    return m


def cloud_layer(name, z, size, scale, stretch, threshold, soft, opacity, dist_scale):
    """Flat cloud deck: thresholded fBm alpha, lit white with a cool underside, hazed into the sky by distance."""
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    ob = bpy.context.object; ob.name = name
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    for n in list(N):
        N.remove(n)
    out = N.new('ShaderNodeOutputMaterial')
    tc = N.new('ShaderNodeTexCoord')
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0, stretch, 1.0)
    mp.inputs['Rotation'].default_value = (0, 0, math.radians(VIEW_AZ + 25))
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    n1 = _noise(nt, 1 / scale, 7.0, 0.62, coord=mp.outputs[0])
    n2 = _noise(nt, 1 / (scale * 6.0), 3.0, 0.5, coord=mp.outputs[0])  # large-scale coverage variation
    # coverage field n1 + 0.5 * n2, mean ~0.75: `threshold` is relative to a 0.5 mean (Noise Fac ~0.5 +- 0.1)
    add = N.new('ShaderNodeMath'); add.operation = 'MULTIPLY_ADD'; add.inputs[1].default_value = 0.5
    L.new(n2.outputs['Fac'], add.inputs[0]); L.new(n1.outputs['Fac'], add.inputs[2])
    a = N.new('ShaderNodeMapRange')
    a.inputs['From Min'].default_value = threshold + 0.25; a.inputs['From Max'].default_value = threshold + 0.25 + soft
    a.inputs['To Max'].default_value = opacity
    L.new(add.outputs[0], a.inputs['Value'])
    shade = _ramp(nt, n1.outputs['Fac'], [(0.5, _hex('#aebdd2')), (0.68, _hex('#ffffff'))])
    bsdf = N.new('ShaderNodeBsdfPrincipled'); bsdf.inputs['Roughness'].default_value = 1.0
    L.new(shade.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Subsurface Weight'].default_value = 0.0
    em = N.new('ShaderNodeEmission'); L.new(shade.outputs['Color'], em.inputs['Color'])
    em.inputs['Strength'].default_value = CLOUD_GLOW  # flat decks get their brightness here (sky ~4.5 overhead)
    addsh = N.new('ShaderNodeAddShader'); L.new(bsdf.outputs[0], addsh.inputs[0]); L.new(em.outputs[0], addsh.inputs[1])
    hazed = haze_mix(nt, addsh.outputs[0], dist_scale)
    tr = N.new('ShaderNodeBsdfTransparent')
    mix = N.new('ShaderNodeMixShader')
    L.new(a.outputs['Result'], mix.inputs['Fac']); L.new(tr.outputs[0], mix.inputs[1]); L.new(hazed, mix.inputs[2])
    L.new(mix.outputs[0], out.inputs['Surface'])
    ob.data.materials.append(m)
    ob.visible_shadow = False
    return ob


def valley_fog():
    """Soft cloud banks low on the horizon, in front of the site's far ridge rings (user, 2026-11-02).

    Volume slab, clear within ~300 units of the camera. Each bank has its own top (6..30 units, noise), so the tops
    are soft and uneven; coverage = large-scale noise x medium breakup, so the banks are separate with gaps (a single
    wide mask read as one white sheet / line). Emission keeps thick banks white without clipping (FOG_GLOW).
    """
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=9000, depth=60, location=(0, 0, 30))
    ob = bpy.context.object; ob.name = 'PN_ValleyFog'
    m = bpy.data.materials.new('PN_ValleyFog'); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    for n in list(N):
        N.remove(n)
    out = N.new('ShaderNodeOutputMaterial')
    geo = N.new('ShaderNodeNewGeometry'); pos = geo.outputs['Position']
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(pos, sep.inputs[0])

    def mul(a, b):
        n = N.new('ShaderNodeMath'); n.operation = 'MULTIPLY'; L.new(a, n.inputs[0])
        if isinstance(b, float):
            n.inputs[1].default_value = b
        else:
            L.new(b, n.inputs[1])
        return n.outputs[0]

    def rng(value, lo, hi, to_lo=0.0, to_hi=1.0, lo_sock=None, hi_sock=None):
        n = N.new('ShaderNodeMapRange'); n.interpolation_type = 'SMOOTHSTEP'
        n.inputs['From Min'].default_value = lo; n.inputs['From Max'].default_value = hi
        n.inputs['To Min'].default_value = to_lo; n.inputs['To Max'].default_value = to_hi
        L.new(value, n.inputs['Value'])
        if hi_sock is not None:
            L.new(hi_sock, n.inputs['From Max'])
        return n.outputs['Result']

    # per-bank top height 6..30 from a slow noise; density fades smoothly from the ground to that top
    top = rng(_noise(nt, 1 / 520.0, 2.0, 0.5, coord=pos).outputs['Fac'], 0.35, 0.65, 6.0, 30.0)
    height = rng(sep.outputs['Z'], 0.0, 1.0, 1.0, 0.0, hi_sock=top)
    # separate banks: coverage x breakup
    cover = rng(_noise(nt, 1 / 650.0, 3.0, 0.5, coord=pos).outputs['Fac'], 0.5, 0.62)
    breakup = rng(_noise(nt, 1 / 170.0, 5.0, 0.6, coord=pos).outputs['Fac'], 0.42, 0.62)
    cxy = N.new('ShaderNodeCombineXYZ'); L.new(sep.outputs['X'], cxy.inputs['X']); L.new(sep.outputs['Y'], cxy.inputs['Y'])
    ln = N.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'; L.new(cxy.outputs[0], ln.inputs[0])
    near = rng(ln.outputs['Value'], 300.0, 900.0)
    dens = mul(mul(mul(mul(height, cover), breakup), near), FOG_DENSITY)
    vol = N.new('ShaderNodeVolumePrincipled'); vol.inputs['Color'].default_value = (1, 1, 1, 1)
    vol.inputs['Anisotropy'].default_value = 0.3
    L.new(dens, vol.inputs['Density'])
    # thick banks settle at ~FOG_GLOW radiance (emission / density): white, below clipping at the render exposure
    L.new(mul(dens, FOG_GLOW), vol.inputs['Emission Strength'])
    vol.inputs['Emission Color'].default_value = (1, 1, 1, 1)
    L.new(vol.outputs[0], out.inputs['Volume'])
    ob.data.materials.append(m)
    return ob


def world():
    w = bpy.data.worlds.new('PN_Sky'); bpy.context.scene.world = w
    w.use_nodes = True; nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    sky = _sky_node(nt)
    bg = nt.nodes.new('ShaderNodeBackground'); out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs[0], out.inputs['Surface'])


def camera(lat_max):
    cd = bpy.data.cameras.new('PN_Cam'); cd.type = 'PANO'
    cd.panorama_type = 'EQUIRECTANGULAR'
    cd.latitude_min = math.radians(LAT_MIN); cd.latitude_max = math.radians(lat_max)
    cd.longitude_min = -math.pi; cd.longitude_max = math.pi
    cd.clip_start = 0.1; cd.clip_end = 40000
    ob = bpy.data.objects.new('PN_Cam', cd); bpy.context.scene.collection.objects.link(ob)
    # Looks along +Y (azimuth 0): image centre = azimuth 0, left edge = -180, right = +180 (x = +X side to the right)
    ob.location = (0, 0, CAM_H); ob.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.scene.camera = ob


def render(out_dir, preview, land):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == 'OPTIX'
    sc.cycles.device = 'GPU'
    sc.cycles.samples = 16 if preview else SAMPLES
    sc.cycles.use_denoising = True; sc.cycles.denoising_use_gpu = True
    sc.cycles.max_bounces = 4; sc.cycles.transparent_max_bounces = 16
    sc.cycles.volume_step_rate = 4.0; sc.cycles.volume_max_steps = 256
    w = 2048 if preview else round(360 * PX_PER_DEG)
    lat_max = LAND_LAT_MAX if land else LAT_MAX
    sc.render.resolution_x = w; sc.render.resolution_y = round(w * (lat_max - LAT_MIN) / 360)
    sc.render.film_transparent = land  # land layer: the site draws its own sky behind it
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'Standard'  # predictable mapping; exposure from the sky EXR (sky_env)
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = EXPOSURE['ev']
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA' if land else 'RGB'
    sc.render.image_settings.color_depth = '8'
    name = ('raven-opening-land' if land else 'raven-opening-panorama') + ('-preview' if preview else '')
    sc.render.filepath = os.path.join(out_dir, name + '.png')
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print('RENDER OK', sc.render.filepath, round(time.time() - t0, 1), 's', flush=True)


EXPOSURE = {'ev': -3.2}
SKY_BLUE = 0.50  # linear blue at heading VIEW_AZ, 60 deg up, after exposure (reference upper sky ~ #3380d1)
SKY_ENV = {'image': None}
SUN_INTENSITY = 0.25
CLOUD_GLOW = 7.0
FOG_GLOW = 6.0
FOG_DENSITY = 0.1
SITE_HORIZON = (0.5840, 0.7454, 0.9301)  # linear #c9e0f7 (SKY_COLOR in src/lib/constants.ts)


def sky_env(out_dir):
    """Pass 1: the world only, full sphere, 2048x1024 linear EXR (the haze colour source)."""
    sc = bpy.context.scene; cam = sc.camera.data
    lat = (cam.latitude_min, cam.latitude_max)
    cam.latitude_min, cam.latitude_max = -math.pi / 2, math.pi / 2
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = 2048, 1024; sc.render.resolution_percentage = 100
    ims = sc.render.image_settings; ims.file_format = 'OPEN_EXR'; ims.color_depth = '32'; ims.color_mode = 'RGB'
    path = os.path.join(out_dir, 'sky-env.exr'); sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    cam.latitude_min, cam.latitude_max = lat
    img = bpy.data.images.load(path); img.pack()
    SKY_ENV['image'] = img
    W, H = img.size; px = np.empty(W * H * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
    b = float(px[int((60 + 90) / 180 * H), int((VIEW_AZ + 180) / 360 * W), 2])  # rows bottom-up
    EXPOSURE['ev'] = math.log2(SKY_BLUE / b)
    print('sky blue at 60 deg', round(b, 3), '-> exposure', round(EXPOSURE['ev'], 2), flush=True)


def build(out_dir, preview=False, land=True):
    """land (default, what the site uses since the user preferred the procedural sky, 2026-11-02): ranges, massifs
    and valley fog only, transparent sky, latitude up to LAND_LAT_MAX. full: sky + cloud decks too (first version)."""
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    t0 = time.time()
    world(); camera(LAND_LAT_MAX if land else LAT_MAX); sky_env(out_dir); build_terrain(); valley_fog()
    if not land:
        clouds()
    print('scene built', round(time.time() - t0, 1), 's', flush=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, 'raven-opening-panorama.blend'), compress=True)
    render(out_dir, preview, land)


def clouds():
    cloud_layer('PN_CumulusLow', 320, 60000, 260, 1.6, 0.50, 0.05, 0.95, 9000.0)    # band on the horizon
    cloud_layer('PN_Cumulus', 650, 30000, 340, 1.3, 0.60, 0.04, 0.95, 12000.0)      # scattered fair-weather cumulus
    cloud_layer('PN_Cirrus', 1400, 60000, 700, 6.0, 0.59, 0.08, 0.5, 20000.0)       # streaks


if __name__ == '__main__' and '--' in sys.argv:
    a = sys.argv[sys.argv.index('--') + 1:]
    build(a[0], preview='preview' in a[1:], land='full' not in a[1:])
