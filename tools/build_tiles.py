#!/usr/bin/env python3
"""Programmatically render legible, beveled mahjong tile and playing card
sprite atlases with transparent backgrounds.

mahjong_atlas.png : 9 cols x 4 rows, cell 132x176
  row0 = p1..p9 (筒), row1 = s1..s9 (索), row2 = w1..w9 (萬),
  row3 = E,S,W,N,C,F,B  (東南西北中發白)
cards_atlas.png   : 13 cols x 4 rows, cell 132x184
  rows = S,H,D,C (spade, heart, diamond, club); cols = A,2..10,J,Q,K
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = "/home/user/workspace/dimsum_project/img/advanced"
os.makedirs(OUT, exist_ok=True)
CJK = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SS = 3  # supersample factor


def f(path, size):
    return ImageFont.truetype(path, size)


def ctext(d, xy, text, font, fill, stroke=0, stroke_fill=None):
    d.text(xy, text, font=font, fill=fill, anchor="mm",
           stroke_width=stroke, stroke_fill=stroke_fill)


def rr(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


# ----------------------------------------------------------------- mahjong
MC_W, MC_H = 132, 176
M_COLS, M_ROWS = 9, 4


def tile_body(size):
    """Ivory tile with beveled edges, transparent outside."""
    w, h = size
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    m = int(w * 0.05)
    box = (m, m, w - m, h - m)
    rad = int(w * 0.12)
    # drop shadow
    rr(d, (box[0] + 4, box[1] + 7, box[2] + 4, box[3] + 7), rad, fill=(0, 0, 0, 55))
    # side / body
    rr(d, box, rad, fill=(214, 205, 182, 255))
    # face inset (lighter, gives bevel)
    inset = (box[0] + int(w * 0.045), box[1] + int(w * 0.045),
             box[2] - int(w * 0.045), box[3] - int(w * 0.075))
    rr(d, inset, int(rad * 0.8), fill=(249, 246, 234, 255))
    # top-left highlight, bottom-right shade
    d.line([(inset[0] + 3, inset[3] - 4), (inset[0] + 3, inset[1] + 4),
            (inset[2] - 4, inset[1] + 3)], fill=(255, 255, 255, 235), width=4)
    d.line([(inset[0] + 4, inset[3] - 3), (inset[2] - 3, inset[3] - 3),
            (inset[2] - 3, inset[1] + 4)], fill=(196, 186, 162, 235), width=4)
    rr(d, box, rad, outline=(150, 141, 120, 200), width=2)
    return im, inset


DOT_LAYOUT = {
    1: [(0.5, 0.5)],
    2: [(0.5, 0.28), (0.5, 0.72)],
    3: [(0.26, 0.24), (0.5, 0.5), (0.74, 0.76)],
    4: [(0.3, 0.28), (0.7, 0.28), (0.3, 0.72), (0.7, 0.72)],
    5: [(0.28, 0.26), (0.72, 0.26), (0.5, 0.5), (0.28, 0.74), (0.72, 0.74)],
    6: [(0.3, 0.22), (0.7, 0.22), (0.3, 0.5), (0.7, 0.5), (0.3, 0.78), (0.7, 0.78)],
    7: [(0.24, 0.18), (0.5, 0.26), (0.76, 0.34),
        (0.3, 0.58), (0.7, 0.58), (0.3, 0.82), (0.7, 0.82)],
    8: [(0.3, 0.16), (0.7, 0.16), (0.3, 0.38), (0.7, 0.38),
        (0.3, 0.62), (0.7, 0.62), (0.3, 0.84), (0.7, 0.84)],
    9: [(0.25, 0.2), (0.5, 0.2), (0.75, 0.2), (0.25, 0.5), (0.5, 0.5),
        (0.75, 0.5), (0.25, 0.8), (0.5, 0.8), (0.75, 0.8)],
}
DOT_COLS = {1: (30, 90, 170), 2: (30, 90, 170), 3: (30, 90, 170), 4: (30, 90, 170),
            5: (30, 90, 170), 6: (36, 122, 72), 7: (36, 122, 72), 8: (36, 122, 72),
            9: (176, 40, 34)}


def draw_dots(d, inset, n):
    x0, y0, x1, y1 = inset
    w, h = x1 - x0, y1 - y0
    rad = w * (0.115 if n <= 4 else 0.095 if n <= 6 else 0.082)
    col = DOT_COLS[n] + (255,)
    for fx, fy in DOT_LAYOUT[n]:
        cx, cy = x0 + fx * w, y0 + 0.06 * h + fy * h * 0.88
        d.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=col,
                  outline=(60, 60, 60, 140), width=max(2, int(rad * 0.12)))
        ir = rad * 0.42
        d.ellipse((cx - ir, cy - ir, cx + ir, cy + ir), fill=(252, 250, 242, 255))


def draw_sticks(d, inset, n):
    x0, y0, x1, y1 = inset
    w, h = x1 - x0, y1 - y0
    cols = 1 if n == 1 else (2 if n in (2, 4) else 3)
    green = (34, 118, 66, 255)
    red = (176, 40, 34, 255)

    def stick(cx, cy, sh, colr):
        sw = w * 0.075
        d.rounded_rectangle((cx - sw, cy - sh / 2, cx + sw, cy + sh / 2),
                            radius=sw * 0.7, fill=colr)
        for k in (-0.22, 0.22):
            d.line([(cx - sw, cy + sh * k), (cx + sw, cy + sh * k)],
                   fill=(250, 248, 240, 210), width=max(2, int(sw * 0.35)))

    if n == 1:
        stick(x0 + w * 0.5, y0 + h * 0.5, h * 0.62, green)
        return
    rows = [1, 2, 3, 2, 3, 3][0] if False else None
    layout = {2: [(0.5, 0.3), (0.5, 0.7)],
              3: [(0.5, 0.24), (0.32, 0.68), (0.68, 0.68)],
              4: [(0.32, 0.3), (0.68, 0.3), (0.32, 0.72), (0.68, 0.72)],
              5: [(0.3, 0.26), (0.7, 0.26), (0.5, 0.5), (0.3, 0.76), (0.7, 0.76)],
              6: [(0.24, 0.3), (0.5, 0.3), (0.76, 0.3),
                  (0.24, 0.74), (0.5, 0.74), (0.76, 0.74)],
              7: [(0.5, 0.18), (0.26, 0.48), (0.5, 0.48), (0.74, 0.48),
                  (0.26, 0.8), (0.5, 0.8), (0.74, 0.8)],
              8: [(0.2, 0.3), (0.4, 0.3), (0.6, 0.3), (0.8, 0.3),
                  (0.2, 0.74), (0.4, 0.74), (0.6, 0.74), (0.8, 0.74)],
              9: [(0.24, 0.2), (0.5, 0.2), (0.76, 0.2),
                  (0.24, 0.5), (0.5, 0.5), (0.76, 0.5),
                  (0.24, 0.8), (0.5, 0.8), (0.76, 0.8)]}[n]
    sh = h * (0.34 if n <= 4 else 0.26)
    for i, (fx, fy) in enumerate(layout):
        colr = red if (n == 5 and i == 2) or (n == 9 and i in (1, 4, 7)) else green
        stick(x0 + fx * w, y0 + fy * h, sh, colr)


NUM_CN = "一二三四五六七八九"
HONORS = [("E", "東"), ("S", "南"), ("W", "西"), ("N", "北"),
          ("C", "中"), ("F", "發"), ("B", "白")]
HONOR_COL = {"E": (34, 72, 140), "S": (34, 72, 140), "W": (34, 72, 140),
             "N": (34, 72, 140), "C": (176, 40, 34), "F": (28, 116, 62),
             "B": (40, 78, 150)}


def make_mahjong():
    cw, ch = MC_W * SS, MC_H * SS
    atlas = Image.new("RGBA", (MC_W * M_COLS * SS, MC_H * M_ROWS * SS), (0, 0, 0, 0))
    fnum = f(CJK, int(ch * 0.30))
    fwan = f(CJK, int(ch * 0.33))
    fhon = f(CJK, int(ch * 0.50))
    for row in range(M_ROWS):
        for col in range(M_COLS):
            if row == 3 and col >= len(HONORS):
                continue
            body, inset = tile_body((cw, ch))
            d = ImageDraw.Draw(body)
            n = col + 1
            if row == 0:
                draw_dots(d, inset, n)
            elif row == 1:
                draw_sticks(d, inset, n)
            elif row == 2:
                x0, y0, x1, y1 = inset
                ctext(d, ((x0 + x1) / 2, y0 + (y1 - y0) * 0.30),
                      NUM_CN[col], fnum, (34, 34, 34, 255))
                ctext(d, ((x0 + x1) / 2, y0 + (y1 - y0) * 0.72),
                      "萬", fwan, (176, 40, 34, 255))
            else:
                key, glyph = HONORS[col]
                x0, y0, x1, y1 = inset
                if key == "B":
                    m = (x1 - x0) * 0.16
                    d.rounded_rectangle((x0 + m, y0 + m * 1.1, x1 - m, y1 - m * 1.1),
                                        radius=m * 0.5, outline=HONOR_COL[key] + (255,),
                                        width=int(m * 0.45))
                else:
                    ctext(d, ((x0 + x1) / 2, (y0 + y1) / 2), glyph, fhon,
                          HONOR_COL[key] + (255,))
            atlas.paste(body, (col * cw, row * ch), body)
    atlas = atlas.resize((MC_W * M_COLS, MC_H * M_ROWS), Image.LANCZOS)
    p = os.path.join(OUT, "mahjong_atlas.png")
    atlas.save(p, optimize=True)
    return p


# ------------------------------------------------------------------- cards
CC_W, CC_H = 132, 184
SUITS = [("S", "\u2660", (26, 26, 30)), ("H", "\u2665", (186, 32, 38)),
         ("D", "\u2666", (186, 32, 38)), ("C", "\u2663", (26, 26, 30))]
RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]


def make_cards():
    cw, ch = CC_W * SS, CC_H * SS
    atlas = Image.new("RGBA", (CC_W * 13 * SS, CC_H * 4 * SS), (0, 0, 0, 0))
    frank = f(SANS, int(ch * 0.20))
    fsmall = f(SANS, int(ch * 0.115))
    fbig = f(SANS, int(ch * 0.46))
    for r, (skey, glyph, col) in enumerate(SUITS):
        for c, rank in enumerate(RANKS):
            card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            d = ImageDraw.Draw(card)
            m = int(cw * 0.055)
            box = (m, m, cw - m, ch - m)
            rad = int(cw * 0.11)
            rr(d, (box[0] + 4, box[1] + 7, box[2] + 4, box[3] + 7), rad,
               fill=(0, 0, 0, 50))
            rr(d, box, rad, fill=(255, 255, 255, 255))
            rr(d, box, rad, outline=(120, 120, 128, 255), width=3)
            rr(d, (box[0] + 8, box[1] + 8, box[2] - 8, box[3] - 8), int(rad * 0.8),
               outline=(228, 228, 232, 255), width=2)
            fill = col + (255,)
            # corner index (top-left) + mirrored (bottom-right)
            ctext(d, (box[0] + cw * 0.16, box[1] + ch * 0.105), rank, frank, fill)
            ctext(d, (box[0] + cw * 0.16, box[1] + ch * 0.215), glyph, fsmall, fill)
            rot = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            dr = ImageDraw.Draw(rot)
            ctext(dr, (box[0] + cw * 0.16, box[1] + ch * 0.105), rank, frank, fill)
            ctext(dr, (box[0] + cw * 0.16, box[1] + ch * 0.215), glyph, fsmall, fill)
            card.alpha_composite(rot.rotate(180))
            # central pip
            ctext(d, (cw / 2, ch / 2), glyph, fbig, fill)
            atlas.paste(card, (c * cw, r * ch), card)
    atlas = atlas.resize((CC_W * 13, CC_H * 4), Image.LANCZOS)
    p = os.path.join(OUT, "cards_atlas.png")
    atlas.save(p, optimize=True)
    return p


for p in (make_mahjong(), make_cards()):
    print(p, os.path.getsize(p), Image.open(p).size)
