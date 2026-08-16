from pathlib import Path
from PIL import Image, ImageDraw
import math

OUT = Path(__file__).resolve().parents[1] / "img" / "advanced" / "cook_motion"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 240, 180
BG = (255, 252, 246, 255)
SKIN = (229, 174, 132, 255)
SLEEVE = (54, 117, 96, 255)
LINE = (62, 55, 49, 255)
RED = (205, 48, 40, 255)


def arrow(draw, start, end, width=8):
    draw.line([start, end], fill=RED, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    size = 15
    left = (end[0] - size * math.cos(angle - .55), end[1] - size * math.sin(angle - .55))
    right = (end[0] - size * math.cos(angle + .55), end[1] - size * math.sin(angle + .55))
    draw.polygon([end, left, right], fill=RED)


def hand(draw, x, y, closed=False, tilt=0):
    draw.rounded_rectangle((x - 72, y - 18, x - 10, y + 18), radius=12, fill=SLEEVE, outline=LINE, width=3)
    draw.ellipse((x - 20, y - 25, x + 28, y + 25), fill=SKIN, outline=LINE, width=3)
    if closed:
        for i in range(3):
            draw.ellipse((x + 8 + i * 4, y - 18 + i * 7, x + 29 + i * 4, y + 1 + i * 7),
                         fill=SKIN, outline=LINE, width=2)
    else:
        for i in range(4):
            yy = y - 23 + i * 14
            draw.rounded_rectangle((x + 15, yy, x + 52, yy + 9), radius=5, fill=SKIN, outline=LINE, width=2)
        draw.rounded_rectangle((x + 2, y + 13, x + 36, y + 24), radius=5, fill=SKIN, outline=LINE, width=2)


def frame(kind, phase):
    im = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(im)
    wave = math.sin(phase * math.pi * 2)
    x, y = 115, 92
    closed = kind in {"loosen", "onion"} and phase < .5
    if kind in {"wash", "heat", "off", "plate"}:
        x += int(28 * phase)
    elif kind == "beat":
        x += int(18 * math.cos(phase * math.pi * 2))
        y += int(18 * math.sin(phase * math.pi * 2))
    elif kind == "salt":
        x += int(12 * wave)
    elif kind == "chop":
        y += int(22 * wave)
    elif kind in {"oil", "pour", "mix"}:
        y += int(7 * wave)
    hand(d, x, y, closed=closed)

    if kind == "loosen":
        arrow(d, (82, 142), (155, 142) if phase < .5 else (82, 142))
    elif kind == "beat":
        d.arc((72, 42, 172, 142), 20, 315, fill=RED, width=8)
        arrow(d, (163, 117), (170, 88))
    elif kind == "mix":
        d.arc((75, 42, 168, 144), 200, 510, fill=RED, width=8)
        arrow(d, (77, 82), (85, 58))
    elif kind == "wash":
        arrow(d, (72, 146), (175, 146))
    elif kind == "chop":
        arrow(d, (190, 55), (190, 137))
    elif kind == "heat":
        arrow(d, (70, 146), (184, 146))
    elif kind in {"oil", "pour"}:
        d.arc((72, 43, 174, 146), 210, 340, fill=RED, width=8)
        arrow(d, (166, 119), (178, 94))
    elif kind == "salt":
        arrow(d, (72, 145), (165, 145))
    elif kind == "onion":
        arrow(d, (188, 64), (188, 139))
    elif kind == "off":
        d.ellipse((176, 68, 214, 106), outline=LINE, width=4)
        d.arc((169, 58, 221, 116), 205, 500, fill=RED, width=7)
    elif kind == "plate":
        d.ellipse((174, 119, 224, 145), outline=LINE, width=4)
        arrow(d, (68, 150), (194, 132))
    return im


for motion in ("loosen", "beat", "mix", "wash", "chop", "heat",
               "oil", "pour", "salt", "onion", "off", "plate"):
    frames = [frame(motion, i / 8) for i in range(8)]
    frames[0].save(
        OUT / f"{motion}.gif",
        save_all=True,
        append_images=frames[1:],
        duration=130,
        loop=0,
        disposal=2,
    )

print(f"Created 12 cooking motion GIFs in {OUT}")
