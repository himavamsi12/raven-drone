"""Raven terrain 06 (look-dev): ecology masks from the actual source heights, image `RT_Eco` (1024, non-colour):
R forest (hollows, gullies, shade slopes; clumped), G limestone outcrops (steep convex faces, kept clear of roads,
terraces and the tile rim), B bushes / lone trees on the meadow, A dry sunlit crests.
Every field is periodic across the tile (flat rim, wrapped derivatives, periodic noise), so the bake tiles seamlessly.
Needs `RT_Natural_Hi` (01) and `RT_Masks` (03).
"""
import bpy, numpy as np

RES = 1024
HALF = 200.0


def pnoise(res, cells, seed, octaves=4, gain=0.5):
    """Periodic value-noise fBm on a res x res tile (wraps exactly at the edges)."""
    rng = np.random.default_rng(seed)
    out = np.zeros((res, res)); amp = 1.0; tot = 0.0
    for o in range(octaves):
        c = cells * (2 ** o)
        g = rng.random((c, c))
        u = np.arange(res) * c / res
        i0 = np.floor(u).astype(int); t = u - i0; t = t * t * (3 - 2 * t)
        i1 = (i0 + 1) % c
        a = g[i0][:, i0]; b = g[i0][:, i1]; cc = g[i1][:, i0]; d = g[i1][:, i1]
        tx = t[None, :]; ty = t[:, None]
        out += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty)
        tot += amp; amp *= gain
    return out / tot


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)


def blur(a, k=2):
    for _ in range(k):
        a = (a + np.roll(a, 1, 0) + np.roll(a, -1, 0) + np.roll(a, 1, 1) + np.roll(a, -1, 1)) / 5
    return a


def build_eco(N=161):
    me = bpy.data.objects['RT_Natural_Hi'].data
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co)
    H = co.reshape(N, N, 3)[:, :, 2]
    px = (np.arange(RES) + 0.5) / RES * (N - 1)
    i0 = np.clip(np.floor(px).astype(int), 0, N - 2); t = px - i0
    Z = (H[i0][:, i0] * (1 - t[None]) * (1 - t[:, None]) + H[i0][:, i0 + 1] * t[None] * (1 - t[:, None])
         + H[i0 + 1][:, i0] * (1 - t[None]) * t[:, None] + H[i0 + 1][:, i0 + 1] * t[None] * t[:, None])
    d = 2 * HALF / RES
    # periodic derivatives (the rim is flat, so wrapping is exact)
    gx = (np.roll(Z, -1, 1) - np.roll(Z, 1, 1)) / (2 * d); gy = (np.roll(Z, -1, 0) - np.roll(Z, 1, 0)) / (2 * d)
    slope = np.hypot(gx, gy)
    Zs = blur(Z, 12)
    curv = (np.roll(Zs, 1, 0) + np.roll(Zs, -1, 0) + np.roll(Zs, 1, 1) + np.roll(Zs, -1, 1) - 4 * Zs) / (d * d)  # >0 concave
    sun = np.array([-40.0, 30.0]); sun /= np.linalg.norm(sun)
    facing = -(gx * sun[0] + gy * sun[1]) / np.maximum(slope, 1e-4) * smooth(0.02, 0.15, slope)  # +1 faces the sun
    m = bpy.data.images['RT_Masks']; W = m.size[0]
    mp = np.empty(W * W * 4, dtype=np.float32); m.pixels.foreach_get(mp); mp = mp.reshape(W, W, 4)
    step = W // RES; mp = mp[::step, ::step]
    road, field = mp[:, :, 0], mp[:, :, 1]
    clump = pnoise(RES, 10, 11, 5); clump2 = pnoise(RES, 28, 12, 3); grain = pnoise(RES, 64, 13, 2)
    keep = 1 - np.clip(blur(np.maximum(road, field), 3) * 3, 0, 1)
    near = (np.maximum(road, field) > 0.3).astype(float)
    for _ in range(36):  # dilate ~14 units (spur benches blend out to 14): no outcrops in road cuts / terrace edges
        near = np.maximum.reduce([near, np.roll(near, 1, 0), np.roll(near, -1, 0), np.roll(near, 1, 1), np.roll(near, -1, 1)])
    clear = 1 - blur(near, 3)
    forest = smooth(0.42, 0.62, clump * 0.75 + 0.25 * clump2 + np.clip(curv * 1.8, -0.25, 0.3) - 0.12 * facing - 0.015 * (Z - 3))
    forest *= keep * (1 - smooth(0.55, 0.8, slope))
    rock = smooth(1.0, 1.35, slope + 0.5 * (clump2 - 0.5) - np.clip(curv * 0.8, -0.2, 0.2)) * keep
    rock = np.maximum(rock, smooth(0.75, 0.95, -curv * 1.1 + 0.5 * clump2) * smooth(0.5, 0.9, slope) * keep)
    xs = -HALF + (np.arange(RES) + 0.5) * d
    edge = HALF - np.maximum(np.abs(xs)[None, :], np.abs(xs)[:, None])
    rim = smooth(22.0, 36.0, edge)  # the seam ramp is artificial slope: no rock along tile borders (would draw the grid)
    rock = smooth(0.25, 0.55, blur(rock, 4)) * clear * rim  # coherent outcrops, not specks
    bush = smooth(0.45, 0.75, clump2 * 0.6 + grain * 0.4) * keep * (1 - forest) * (1 - rock)
    dry = smooth(0.1, 0.6, facing * 0.6 - curv * 1.5 + 0.4 * (clump - 0.5)) * (1 - forest)
    img = bpy.data.images.get('RT_Eco') or bpy.data.images.new('RT_Eco', RES, RES, alpha=True, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(np.stack([forest, rock, bush, dry], -1).astype(np.float32).ravel()); img.update(); img.pack()
    print('eco forest%', round(float((forest > .5).mean() * 100), 1), 'rock%', round(float((rock > .5).mean() * 100), 1),
          'bush%', round(float((bush > .5).mean() * 100), 1), 'dry%', round(float((dry > .5).mean() * 100), 1))
    return dict(Z=Z, slope=slope, curv=curv, forest=forest, rock=rock, bush=bush, dry=dry, road=road, field=field)
