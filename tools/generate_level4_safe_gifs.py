#!/usr/bin/env python3
"""Generate privacy-safe, fully illustrated Level 4 scenario GIFs."""

from pathlib import Path
from math import cos, pi, sin

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "img" / "advanced"
SIZE = (640, 360)
FRAMES = 36


def save(frames, name):
    frames[0].save(
        OUT / name,
        save_all=True,
        append_images=frames[1:],
        duration=80,
        loop=0,
        disposal=2,
        optimize=True,
    )


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def bowling():
    frames = []
    pin_origins = [(270 + c * 34 + r * 17, 100 + r * 25) for r in range(4) for c in range(4 - r)]
    for i in range(FRAMES):
        im = Image.new("RGB", SIZE, "#132239")
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, 640, 92), fill="#1b2940")
        for x in (44, 596):
            d.rectangle((x - 8, 0, x + 8, 92), fill="#31445e")
        d.polygon([(142, 360), (498, 360), (405, 80), (235, 80)], fill="#d8ae72")
        d.polygon([(142, 360), (174, 360), (251, 80), (235, 80)], fill="#7d532e")
        d.polygon([(466, 360), (498, 360), (405, 80), (389, 80)], fill="#7d532e")
        for y in range(110, 360, 42):
            d.line((155, y, 485, y), fill="#efce98", width=2)
        d.polygon([(126, 360), (142, 360), (235, 80), (220, 80)], fill="#233b50")
        d.polygon([(498, 360), (514, 360), (420, 80), (405, 80)], fill="#233b50")

        t = i / (FRAMES - 1)
        bx = 320 + 8 * sin(t * pi)
        by = 332 - 224 * min(1, t * 1.35)
        br = int(25 - 13 * min(1, t * 1.35))
        d.ellipse((bx - br, by - br, bx + br, by + br), fill="#176f9f", outline="#e6f4ff", width=3)
        d.ellipse((bx - br // 3, by - br // 2, bx, by - br // 5), fill="#0a3857")
        d.ellipse((bx + br // 5, by - br // 4, bx + br // 2, by + br // 8), fill="#0a3857")

        hit = max(0, (t - 0.72) / 0.28)
        for n, (px, py) in enumerate(pin_origins):
            px += (n % 3 - 1) * 42 * hit
            py += (n % 2) * 28 * hit
            angle = (n % 2 * 2 - 1) * hit
            w, h = 9, 28
            if hit > 0:
                d.ellipse((px - h * 0.55, py - w, px + h * 0.55, py + w), fill="#f8f5e9", outline="#c53935", width=2)
                d.line((px - 8, py, px + 8, py), fill="#c53935", width=3)
            else:
                rounded(d, (px - w, py - h, px + w, py + h), 7, "#f8f5e9", "#d6d0bd", 1)
                d.rectangle((px - w, py - 10, px + w, py - 5), fill="#c53935")
        frames.append(im)
    save(frames, "level4_bowling_illustrated.gif")


def buspay():
    frames = []
    for i in range(FRAMES):
        im = Image.new("RGB", SIZE, "#d8e4e7")
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, 640, 95), fill="#355f68")
        d.rectangle((22, 18, 270, 153), fill="#a9d5e0", outline="#eef9fb", width=5)
        d.line((146, 18, 146, 153), fill="#eef9fb", width=5)
        d.rectangle((485, 0, 512, 360), fill="#e3c25f")
        d.rectangle((0, 275, 640, 360), fill="#6d777b")
        d.polygon([(0, 275), (640, 275), (580, 360), (60, 360)], fill="#9aa5a8")
        rounded(d, (332, 96, 492, 286), 24, "#253b42", "#10262c", 5)
        rounded(d, (354, 119, 470, 221), 15, "#5c9c8f", "#b8eee0", 4)
        d.arc((378, 139, 446, 207), 210, 330, fill="#e8fff8", width=5)
        d.arc((389, 151, 435, 196), 210, 330, fill="#e8fff8", width=4)
        d.ellipse((409, 171, 419, 181), fill="#e8fff8")
        rounded(d, (361, 233, 463, 262), 10, "#10262c")

        t = i / (FRAMES - 1)
        phase = min(1, t / 0.62) if t < 0.62 else max(0, 1 - (t - 0.62) / 0.38)
        cx = 160 + 240 * phase
        cy = 238 - 58 * sin(phase * pi / 2)
        rounded(d, (cx - 66, cy - 40, cx + 66, cy + 40), 13, "#b72939", "#fff3dc", 4)
        d.rectangle((cx - 47, cy - 20, cx + 20, cy - 10), fill="#f6d37a")
        d.ellipse((cx + 30, cy - 22, cx + 49, cy - 3), outline="#f6d37a", width=4)
        if abs(phase - 1) < 0.12:
            pulse = 8 + (i % 5) * 7
            d.arc((412 - pulse, 166 - pulse, 412 + pulse, 166 + pulse), 285, 75, fill="#ffd34f", width=6)
            d.arc((412 - pulse - 14, 152 - pulse, 426 + pulse, 180 + pulse), 285, 75, fill="#ffd34f", width=4)
        frames.append(im)
    save(frames, "level4_buspay_illustrated.gif")


def mahjong():
    frames = []
    tiles = [(112 + (n % 7) * 68, 84 + (n // 7) * 72) for n in range(28)]
    marks = ["●", "■", "◆"]
    for i in range(FRAMES):
        im = Image.new("RGB", SIZE, "#214f47")
        d = ImageDraw.Draw(im)
        d.rectangle((18, 18, 622, 342), fill="#2e7668", outline="#d8b96b", width=7)
        d.rectangle((35, 35, 605, 325), outline="#1c4a42", width=3)
        t = i / (FRAMES - 1)
        sweep = sin(t * pi)
        for n, (x, y) in enumerate(tiles):
            wobble = 10 * sweep * sin(n * 1.7 + t * 2 * pi)
            xx = x + wobble
            yy = y + 8 * sweep * cos(n + t * pi)
            rounded(d, (xx - 24, yy - 30, xx + 24, yy + 30), 7, "#f4ead2", "#c8b891", 2)
            color = ("#bf3434", "#183f8f", "#197151")[n % 3]
            if n % 3 == 0:
                d.ellipse((xx - 7, yy - 7, xx + 7, yy + 7), outline=color, width=4)
            elif n % 3 == 1:
                d.rectangle((xx - 7, yy - 7, xx + 7, yy + 7), outline=color, width=4)
            else:
                d.polygon([(xx, yy - 10), (xx + 9, yy), (xx, yy + 10), (xx - 9, yy)], outline=color)

        # Clearly illustrated sleeve and hand, not photographic human media.
        a = t * 2 * pi
        hx = 320 + 150 * cos(a)
        hy = 205 + 72 * sin(a)
        d.line((590, 322, hx + 24, hy + 18), fill="#296690", width=38)
        d.ellipse((hx - 26, hy - 19, hx + 32, hy + 25), fill="#efbd8c", outline="#8f5e3d", width=3)
        for f in range(4):
            fy = hy - 16 + f * 10
            d.line((hx - 25, fy, hx - 55, fy - 5), fill="#efbd8c", width=8)
        d.arc((145, 65, 495, 325), 200, 520, fill="#dc3a2f", width=8)
        frames.append(im)
    save(frames, "level4_mahjongwash_illustrated.gif")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    bowling()
    buspay()
    mahjong()
