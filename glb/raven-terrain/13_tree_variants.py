"""Raven terrain 13: tile variants with different tree and bush layouts (same hills, roads, rocks and villages).

Why: the site lays one 400-unit tile 15-30 times, so every grove repeated each tile (user, 2026-11-02). Each variant
rebuilds the 06 forest/bush/dry masks from other noise seeds (noise-led, see NOISE_GAIN) and runs the 08 scatter
with other seeds, then keeps the original
layout in the rim band (edge distance < 22, cross-fade to 36: the same band 06 uses for rocks). Edge texels, crowns
and shadows near the seams are therefore the original ones and any variant joins any other. Rocks (geology) and the
rock mask channel are kept.

Per variant `v` this stores, with fake users, in the open look-dev file (v10 -> v11):
  image `RT_Eco_<v>` (eco mask: forest/bush/dry re-seeded, rock kept), meshes `LD_Scatter_Trees_<v>`,
  `LD_Scatter_Bushes_<v>` (point clouds with scale/rot/variant, same instancer node groups).
`use_variant(v)` swaps them into `M_RT_GrassCliff` and the LD_Scatter_* objects (`'a'` = the original data).

Live (team-blender, file open):  exec this file, then make_variants(BUILD_SCRIPTS)
Headless render (after saving):  blender.exe -b raven-terrain-v11-treevariants.blend --python 13_tree_variants.py
                                 -- <build-scripts> <out> b c
  -> <out>/textures/raven-natural-bake-4096-<v>.png (same lighting, 11 appearance render and 04 fix_edges as v09).
"""
import bpy, os, sys, time
import numpy as np

SEEDS = {'b': 100, 'c': 200}  # added to the 06 noise seeds (11/12/13) and the 08 scatter seeds (21/22)
BAND = (22.0, 36.0)
HALF = 200.0
ECO_NODE = 'Image Texture.001'  # M_RT_GrassCliff node sampling RT_Eco
SETS = ('LD_Scatter_Trees', 'LD_Scatter_Bushes')


def _load(bs_dir, *names):
    g = {'__name__': 'raven_terrain'}
    for n in names:
        exec(compile(open(os.path.join(bs_dir, n)).read(), n, 'exec'), g)
    return g


def _eco_pixels(img):
    W = img.size[0]
    a = np.empty(W * W * 4, dtype=np.float32); img.pixels.foreach_get(a)
    return a.reshape(W, W, 4)


def _rim_weight(res):
    """0 within 22 units of any tile edge, 1 beyond 36 (smoothstep), on a res x res grid (row = y, col = x)."""
    d = 2 * HALF / res
    xs = -HALF + (np.arange(res) + 0.5) * d
    edge = HALF - np.maximum(np.abs(xs)[None, :], np.abs(xs)[:, None])
    t = np.clip((edge - BAND[0]) / (BAND[1] - BAND[0]), 0, 1)
    return t * t * (3 - 2 * t)


def _point_weight(x, y):
    edge = HALF - np.maximum(np.abs(x), np.abs(y))
    t = np.clip((edge - BAND[0]) / (BAND[1] - BAND[0]), 0, 1)
    return t * t * (3 - 2 * t)


def _eco(g):
    """06 build_eco as built (seeds 11/12/13), plus the terrain terms of its forest field. Leaves RT_Eco alone."""
    base = bpy.data.images['RT_Eco']
    base.name = 'RT_Eco__keep'  # build_eco writes an image named RT_Eco: let it make a scratch one
    try:
        E = g['build_eco']()
    finally:
        scratch = bpy.data.images.get('RT_Eco')
        if scratch:
            bpy.data.images.remove(scratch)
        base.name = 'RT_Eco'
    Z, slope, curv, sm, bl = E['Z'], E['slope'], E['curv'], g['smooth'], g['blur']
    d = 2 * HALF / Z.shape[0]
    gx = (np.roll(Z, -1, 1) - np.roll(Z, 1, 1)) / (2 * d); gy = (np.roll(Z, -1, 0) - np.roll(Z, 1, 0)) / (2 * d)
    sun = np.array([-40.0, 30.0]); sun /= np.linalg.norm(sun)
    E['facing'] = -(gx * sun[0] + gy * sun[1]) / np.maximum(slope, 1e-4) * sm(0.02, 0.15, slope)
    E['keep'] = 1 - np.clip(bl(np.maximum(E['road'], E['field']), 3) * 3, 0, 1)
    E['terrain'] = np.clip(curv * 1.8, -0.25, 0.3) - 0.12 * E['facing'] - 0.015 * (Z - 3)
    return E


# 06's forest is mostly terrain (curvature/height/sun, std 0.24) with low-contrast noise (std 0.105), so re-seeding
# alone left 75% overlap (IoU of forest > .5). Variants boost the noise 4x and halve the terrain pull (trees still
# favour hollows): IoU ~0.4 against the original, ~0.37 between variants; roads, terraces and cliffs stay clear.
NOISE_GAIN, TERRAIN_GAIN = 4.0, 0.5


def _variant_masks(g, E, off):
    """forest / bush / dry for one variant, forest cover matched to the original (bisection on the threshold)."""
    pn, sm, RES = g['pnoise'], g['smooth'], E['Z'].shape[0]
    clump = pn(RES, 10, 11 + off, 5); clump2 = pn(RES, 28, 12 + off, 3); grain = pn(RES, 64, 13 + off, 2)
    n = 0.55 * clump + 0.45 * clump2  # more of the 28-cell layer: grain closer to the original's mottling
    x = (n - n.mean()) * NOISE_GAIN + TERRAIN_GAIN * E['terrain']
    x0 = 0.75 * pn(RES, 10, 11, 5) + 0.25 * pn(RES, 28, 12, 3) + E['terrain']
    h = 0.1 * x.std() / x0.std()  # same transition width relative to the field as 06's smooth(0.42, 0.62)
    mask = E['keep'] * (1 - sm(0.55, 0.8, E['slope']))
    target = (E['forest'] > 0.5).mean()
    lo, hi = float(x.min()), float(x.max())
    for _ in range(40):
        c = 0.5 * (lo + hi)
        forest = sm(c - h, c + h, x) * mask
        lo, hi = (c, hi) if (forest > 0.5).mean() > target else (lo, c)
    bush = sm(0.45, 0.75, clump2 * 0.6 + grain * 0.4) * E['keep'] * (1 - forest) * (1 - E['rock'])
    dry = sm(0.1, 0.6, E['facing'] * 0.6 - E['curv'] * 1.5 + 0.4 * (clump - 0.5)) * (1 - forest)
    return forest, bush, dry


def _cloud(name, x, y, z, s, rot, var):
    me = bpy.data.meshes.get(name)
    if me:
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(x)); me.vertices.foreach_set('co', np.stack([x, y, z], -1).astype(np.float32).ravel())
    for nm, typ, data in (('scale', 'FLOAT', s), ('rot', 'FLOAT', rot), ('variant', 'INT', var)):
        a = me.attributes.new(nm, typ, 'POINT')
        a.data.foreach_set('value', data.astype(np.int32 if typ == 'INT' else np.float32))
    me.use_fake_user = True
    return me


def _read_cloud(me):
    n = len(me.vertices)
    co = np.empty(n * 3, dtype=np.float32); me.vertices.foreach_get('co', co); co = co.reshape(n, 3)
    out = {}
    for nm in ('scale', 'rot', 'variant'):
        a = me.attributes[nm]; buf = np.empty(n, dtype=np.int32 if a.data_type == 'INT' else np.float32)
        a.data.foreach_get('value', buf); out[nm] = buf
    return co, out


def _merge(base_me, new_me, name, seed):
    """Original points fade out and new points fade in across the rim band (expected density cross-fades)."""
    rng = np.random.default_rng(seed)
    (bc, ba), (nc, na) = _read_cloud(base_me), _read_cloud(new_me)
    keep_b = rng.random(len(bc)) >= _point_weight(bc[:, 0], bc[:, 1])
    keep_n = rng.random(len(nc)) < _point_weight(nc[:, 0], nc[:, 1])
    cat = lambda a, b: np.concatenate([a[keep_b], b[keep_n]])
    me = _cloud(name, cat(bc[:, 0], nc[:, 0]), cat(bc[:, 1], nc[:, 1]), cat(bc[:, 2], nc[:, 2]),
                cat(ba['scale'], na['scale']), cat(ba['rot'], na['rot']), cat(ba['variant'], na['variant']))
    print(name, 'kept original', int(keep_b.sum()), 'new', int(keep_n.sum()))
    return me


def _keep_originals():
    """Hold the original data under *_a names so use_variant('a') can restore it."""
    for s in SETS:
        ob = bpy.data.objects[s]
        if not bpy.data.meshes.get(s + '_a'):
            ob.data.name = s + '_a'
        ob.data.use_fake_user = True
    bpy.data.images['RT_Eco'].use_fake_user = True


def make_variants(bs_dir, names=tuple(SEEDS)):
    use_variant('a') if bpy.data.meshes.get(SETS[0] + '_a') else _keep_originals()
    g = _load(bs_dir, '06_eco.py', '08_scatter.py')
    base_px = _eco_pixels(bpy.data.images['RT_Eco'])
    E0 = _eco(g)
    ref = np.stack([E0['forest'], E0['rock'], E0['bush'], E0['dry']], -1)
    err = float(np.abs(ref - base_px).max())
    print('06 reproduces RT_Eco: max abs diff', err)
    assert err < 1e-4, 'RT_Eco was edited after 06: variants would not match the original tile'
    w = _rim_weight(base_px.shape[0])[..., None]
    for v in names:
        off = SEEDS[v]
        forest, bush, dry = _variant_masks(g, E0, off)
        new = np.stack([forest, base_px[..., 1], bush, dry], -1)  # rock channel kept
        px = base_px * (1 - w) + new * w
        img = bpy.data.images.get('RT_Eco_' + v)
        if img:
            bpy.data.images.remove(img)
        img = bpy.data.images.new('RT_Eco_' + v, *bpy.data.images['RT_Eco'].size, alpha=True, float_buffer=True)
        img.colorspace_settings.name = 'Non-Color'
        img.pixels.foreach_set(px.astype(np.float32).ravel()); img.update(); img.pack(); img.use_fake_user = True
        # 08 build_scatter on the blended masks with shifted seeds; only its tree/bush clouds are kept
        Ev = dict(E0, forest=px[..., 0], bush=px[..., 2])
        sc = g['scatter']
        F, B = Ev['forest'], Ev['bush']
        smp = g['_sample']
        tmp = []
        tmp.append(sc(Ev, 1.0, lambda x, y: smp(F, x, y) ** 1.1 * 0.97, 21 + off, (0.65, 1.5), 4, 0.12,
                      '_tmp_trees', 'LD_Set_Trees', weights=[0.3, 0.3, 0.25, 0.15]))
        edge = lambda x, y: np.clip((smp(F, x, y) - 0.05) * 4, 0, 1) * (1 - smp(F, x, y)) * 0.25
        tmp.append(sc(Ev, 2.2, lambda x, y: np.clip(smp(B, x, y) * 0.35 + edge(x, y), 0, 1), 22 + off, (0.7, 1.6),
                      2, 0.1, '_tmp_bushes', 'LD_Set_Bushes'))
        for s, t in zip(SETS, tmp):
            _merge(bpy.data.meshes[s + '_a'], t.data, f'{s}_{v}', 7 + off)
            ng = t.modifiers[0].node_group; me = t.data
            bpy.data.objects.remove(t, do_unlink=True); bpy.data.meshes.remove(me); bpy.data.node_groups.remove(ng)
        diff = float(np.abs(px[..., 0] - base_px[..., 0])[w[..., 0] == 0].max())
        core = slice(int(0.1 * len(px)), int(0.9 * len(px)))
        A, V = base_px[core, core, 0] > 0.5, px[core, core, 0] > 0.5
        print('variant', v, 'forest%', round(float((px[..., 0] > .5).mean() * 100), 1),
              'IoU vs original', round(float((A & V).sum() / (A | V).sum()), 3), 'rim-band forest diff', diff)
    use_variant('a')


def use_variant(v):
    """Swap the eco mask in the ground material and the tree/bush clouds ('a' = original)."""
    nt = bpy.data.materials['M_RT_GrassCliff'].node_tree
    nt.nodes[ECO_NODE].image = bpy.data.images['RT_Eco' if v == 'a' else 'RT_Eco_' + v]
    for s in SETS:
        bpy.data.objects[s].data = bpy.data.meshes[f'{s}_{v}']


def render_variants(bs_dir, out, names):
    """Headless: the v09 appearance render (12_v09_webport build(), ground map only) once per variant."""
    tex = os.path.join(out, 'textures'); os.makedirs(tex, exist_ok=True)
    os.environ['RAVEN_TERRAIN_OUT'] = out
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == 'OPTIX'
    sc = bpy.context.scene; sc.cycles.device = 'GPU'
    g = _load(bs_dir, '04_bake.py', '10_lighting.py', '11_appearance_bake.py')
    g['build_lighting']()
    for n in ('PV_sun', 'BakeSun'):
        if bpy.data.objects.get(n):
            bpy.data.objects[n].hide_render = True
    for v in names:
        t0 = time.time()
        use_variant(v)
        g['setup_appearance_scene']()  # neighbours share the swapped meshes
        img = g['render_appearance'](4096, os.path.join(tex, f'raven-natural-render-4096-{v}.png'))
        g['fix_edges'](img)
        ims = sc.render.image_settings; ims.file_format = 'PNG'; ims.color_mode = 'RGB'; ims.color_depth = '8'
        path = os.path.join(tex, f'raven-natural-bake-4096-{v}.png')
        img.save_render(path, scene=sc)
        bpy.data.images.remove(img)
        print('VARIANT OK', v, path, round(time.time() - t0, 1), 's', flush=True)


if __name__ == '__main__' and '--' in sys.argv:
    a = sys.argv[sys.argv.index('--') + 1:]
    render_variants(a[0], a[1], a[2:] or list(SEEDS))
