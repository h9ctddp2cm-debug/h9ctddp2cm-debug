#!/usr/bin/env python3
"""Crop 2x2 contact sheets from GPT Image 1.5 (transparent bg) into single
trimmed sprites, then produce colour variants for laundry garments/baskets.

Outputs to dimsum_project/img/advanced/.
"""
import os
from PIL import Image

SRC = "/home/user/workspace"
OUT = "/home/user/workspace/dimsum_project/img/advanced"
os.makedirs(OUT, exist_ok=True)

SHEETS = {
    "gen_cook1": ["rice_bowl", "eggs", "spring_onion", "oil_bottle"],
    "gen_cook2": ["egg_beaten", "onion_chopped", "plate_empty", "salt_dish"],
    "gen_cook3": ["wok", "friedrice", "stove_knob", "board_knife"],
    "gen_flow1": ["fl_rose", "fl_chrys", "fl_sunflower", "fl_gerbera"],
    "gen_flow2": ["fl_tulip", "fl_lily", "leaf_blade", "leaf_euca"],
    "gen_laun1": ["g_tshirt", "g_socks", "g_shorts", "g_vest"],
    "gen_laun2": ["g_trousers", "g_jacket", "basket", "vase"],
}

MAXDIM = 300          # longest edge of each sprite
ALPHA_CUT = 8         # alpha below this is cleared (kills halo)


def clean_alpha(im):
    """Remove residual near-transparent halo pixels."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= ALPHA_CUT:
                px[x, y] = (0, 0, 0, 0)
    return im


def sprite(im):
    im = clean_alpha(im.convert("RGBA"))
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    s = MAXDIM / max(w, h)
    if s < 1:
        im = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
    return im


def alpha_stats(im):
    a = im.getchannel("A")
    hist = a.histogram()
    transparent = hist[0]
    total = im.size[0] * im.size[1]
    return transparent, total


report = []
for stem, names in SHEETS.items():
    path = os.path.join(SRC, stem + ".png")
    sheet = Image.open(path).convert("RGBA")
    W, H = sheet.size
    # strict quadrants
    cells = [(0, 0), (1, 0), (0, 1), (1, 1)]
    for name, (cx, cy) in zip(names, cells):
        box = (cx * W // 2, cy * H // 2, (cx + 1) * W // 2, (cy + 1) * H // 2)
        sp = sprite(sheet.crop(box))
        outp = os.path.join(OUT, name + ".png")
        sp.save(outp, optimize=True)
        tr, tot = alpha_stats(sp)
        report.append((name, sp.size, round(tr / tot * 100, 1),
                       os.path.getsize(outp)))

# ---- colour variants for garments + baskets (multiply tint on white) ----
COLORS = {
    "red":    (196, 62, 52),
    "blue":   (44, 108, 178),
    "yellow": (226, 176, 32),
    "green":  (48, 138, 88),
}
GARMENTS = ["g_tshirt", "g_socks", "g_shorts", "g_vest", "g_trousers", "g_jacket"]


def tint(im, rgb):
    """Multiply blend keeps fabric shading while recolouring pure white."""
    r, g, b, a = im.split()
    cr, cg, cb = rgb
    r = r.point(lambda v, c=cr: int(v * c / 255))
    g = g.point(lambda v, c=cg: int(v * c / 255))
    b = b.point(lambda v, c=cb: int(v * c / 255))
    return Image.merge("RGBA", (r, g, b, a))


for base in GARMENTS + ["basket"]:
    src = Image.open(os.path.join(OUT, base + ".png")).convert("RGBA")
    for cname, rgb in COLORS.items():
        t = tint(src, rgb)
        outp = os.path.join(OUT, f"{base}_{cname}.png")
        t.save(outp, optimize=True)
        report.append((f"{base}_{cname}", t.size, None, os.path.getsize(outp)))

print(f"{'asset':22s} {'size':12s} {'%alpha':>7s} {'bytes':>8s}")
for name, size, pct, nb in report:
    print(f"{name:22s} {str(size):12s} {str(pct):>7s} {nb:>8d}")
print("total bytes:", sum(r[3] for r in report))
