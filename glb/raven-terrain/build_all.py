"""Rebuild the Raven natural terrain tile end to end, headless (deterministic geometry; baked maps vary only by
Cycles noise). From the repo root:

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python glb/raven-terrain/build_all.py -- <out_dir>

Writes <out_dir>/raven-terrain.glb, glb/raven-terrain/textures/*.png and glb/raven-terrain/raven-terrain-v02.blend.
v02 = look-dev pipeline (06-11): eco masks, scattered trees/bushes/rocks, golden-hour light, orthographic appearance bake.
Then glb/raven-terrain/encode.sh <out_dir> (WebP q80 + Draco), validate with check_terrain.py, copy to public/.
"""
import bpy, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else os.path.join(HERE, 'build'))
TEX = os.path.join(HERE, 'textures')
os.makedirs(OUT, exist_ok=True); os.makedirs(TEX, exist_ok=True)
os.environ['RAVEN_TERRAIN_OUT'] = OUT

bpy.ops.wm.read_homefile(use_empty=True)
prefs = bpy.context.preferences.addons['cycles'].preferences
for kind in ('METAL', 'OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == kind]
        if gpus:
            for d in prefs.devices:
                d.use = d.type == kind
            print('cycles device', kind, [d.name for d in gpus])
            break
    except TypeError:
        continue

RES = int(os.environ.get('RAVEN_TERRAIN_RES', '4096'))  # base map size (appearance render)

g = {'__name__': 'raven_terrain'}
for name in ('01_terrain.py', '02_village.py', '03_surface.py', '04_bake.py', '05_runtime_export.py',
             '06_eco.py', '07_masters.py', '08_scatter.py', '09_lookdev_material.py', '10_lighting.py',
             '11_appearance_bake.py'):
    exec(compile(open(os.path.join(HERE, name)).read(), name, 'exec'), g)

t0 = time.time()
g['build']()
g['build_houses'](g)
mask = g['build_masks'](g)
g['build_material'](mask)  # defines the shared helpers; the look-dev material replaces it on the ground
eco = g['build_eco']()
g['build_masters']()
g['build_scatter'](eco)
mat = g['build_lookdev_material'](g)
src = bpy.data.objects['RT_Natural_Hi'].data
src.materials.clear(); src.materials.append(mat)
g['build_lighting']()
if bpy.context.scene.cycles.device == 'GPU' and not any(d.use for d in prefs.devices if d.type != 'CPU'):
    bpy.context.scene.cycles.device = 'CPU'
else:
    bpy.context.scene.cycles.device = 'GPU'
g['setup_appearance_scene']()
img = g['render_appearance'](RES, os.path.join(TEX, f'raven-natural-render-{RES}.png'))
g['fix_edges'](img)
fixed = os.path.join(TEX, f'raven-natural-bake-{RES}.png')
img.filepath_raw = fixed; img.file_format = 'PNG'; img.save()
# Re-pack from the saved file: packed bytes are not refreshed by pixel edits, so a plain pack() keeps the unfixed render.
bpy.data.images.remove(img)
img = bpy.data.images.load(fixed); img.name = 'RT_Natural_Bake'; img.colorspace_settings.name = 'sRGB'; img.pack()
print('appearance bake done', RES, round(time.time() - t0, 1), 's')

land = g['runtime_terrain']()
houses = g['runtime_houses']()
g['bake_houses'](houses, tex_dir=TEX)
path = g['export']([land, houses], 'raven-terrain-raw.glb', draco=False, image_format='AUTO')  # then encode.sh
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'raven-terrain-v02.blend'))
print('BUILD OK', path, round(time.time() - t0, 1), 's')
