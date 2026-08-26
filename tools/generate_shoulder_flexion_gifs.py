from math import cos, pi, sin
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "img" / "advanced"
W, H = 720, 405
FONT_PATH = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

INK = (19, 75, 66)
MUTED = (96, 108, 105)
TEAL = (46, 132, 119)
TEAL_DARK = (31, 104, 91)
SKIN = (224, 153, 105)
SHIRT = (92, 168, 158)
TROUSERS = (47, 58, 78)
CHAIR = (51, 113, 111)
ARC = (222, 139, 20)
PAPER = (252, 250, 245)

F16 = ImageFont.truetype(FONT_PATH, 16)
F18 = ImageFont.truetype(FONT_PATH, 18)
F22 = ImageFont.truetype(FONT_PATH, 22)
F28 = ImageFont.truetype(FONT_PATH, 28)


def pt_at_angle(origin, length, angle_deg):
    """Shoulder flexion: 0° down by trunk, 90° forward, 180° overhead."""
    radians = angle_deg * pi / 180
    return (
        origin[0] + length * sin(radians),
        origin[1] + length * cos(radians),
    )


def rounded_line(draw, points, fill, width):
    draw.line(points, fill=fill, width=width, joint="curve")
    radius = width // 2
    for x, y in (points[0], points[-1]):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def draw_angle_arc(draw, shoulder, angle):
    radius = 58
    steps = max(2, round(angle / 4))
    points = [pt_at_angle(shoulder, radius, angle * i / steps) for i in range(steps + 1)]
    draw.line(points, fill=ARC, width=5, joint="curve")
    for marker in (30, 60, 90, 120, 150, 180):
        if marker > angle + 0.5:
            continue
        inner = pt_at_angle(shoulder, radius - 6, marker)
        outer = pt_at_angle(shoulder, radius + 6, marker)
        draw.line((inner, outer), fill=ARC, width=3)


def draw_scene(angle, level, range_label):
    image = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(image)

    # Quiet floor and chair.
    draw.line((34, 350, 686, 350), fill=(225, 218, 203), width=3)
    draw.rounded_rectangle((238, 231, 356, 257), radius=12, fill=CHAIR)
    draw.line((258, 250, 250, 350), fill=CHAIR, width=13)
    draw.line((337, 250, 356, 350), fill=CHAIR, width=13)
    draw.rounded_rectangle((226, 91, 248, 249), radius=10, fill=CHAIR)

    # Seated patient's trunk/head in strict lateral view.
    shoulder = (302, 142)
    draw.ellipse((255, 45, 321, 111), fill=SKIN, outline=INK, width=3)
    draw.pieslice((250, 38, 319, 104), 175, 350, fill=(80, 78, 73))
    draw.polygon(((278, 104), (331, 126), (345, 235), (274, 237), (264, 151)), fill=SHIRT)
    draw.line((278, 104, 331, 126, 345, 235), fill=INK, width=3)
    draw.polygon(((283, 235), (345, 235), (432, 280), (411, 309), (321, 270)), fill=TROUSERS)
    draw.polygon(((321, 270), (411, 309), (405, 350), (376, 350), (374, 303)), fill=TROUSERS)

    # Shoulder baseline is always vertical down at 0°.
    baseline_end = pt_at_angle(shoulder, 151, 0)
    draw.line((shoulder, baseline_end), fill=(155, 164, 160), width=3)
    for y in range(round(shoulder[1]), round(baseline_end[1]), 12):
        draw.line((shoulder[0] - 5, y, shoulder[0] + 5, y), fill=(155, 164, 160), width=2)

    # A straight arm isolates shoulder flexion and makes the angle unambiguous.
    elbow = pt_at_angle(shoulder, 72, angle)
    wrist = pt_at_angle(shoulder, 138, angle)
    rounded_line(draw, (shoulder, elbow), SKIN, 25)
    rounded_line(draw, (elbow, wrist), SKIN, 21)
    hand = pt_at_angle(shoulder, 151, angle)
    rounded_line(draw, (wrist, hand), SKIN, 15)
    draw.ellipse((shoulder[0] - 8, shoulder[1] - 8, shoulder[0] + 8, shoulder[1] + 8), fill=INK)
    draw_angle_arc(draw, shoulder, angle)

    # Degree badge remains large enough to read on the tablet card.
    draw.rounded_rectangle((485, 36, 682, 122), radius=18, fill=(235, 244, 241), outline=TEAL_DARK, width=3)
    draw.text((503, 48), f"Level {level}", font=F18, fill=INK)
    degree_text = f"{round(angle):d}°"
    draw.text((608, 43), degree_text, font=F28, fill=TEAL_DARK, anchor="ma")
    draw.text((503, 88), range_label, font=F16, fill=MUTED)

    draw.rounded_rectangle((40, 24, 214, 62), radius=19, fill=TEAL_DARK)
    draw.text((127, 42), "肩屈曲 Shoulder flexion", font=F18, fill="white", anchor="mm")
    draw.text((40, 374), "0°＝上臂在身旁　90°＝向前水平　180°＝舉高過頭", font=F16, fill=MUTED)
    return image


def easing(t):
    return 0.5 - 0.5 * cos(pi * t)


def sequence(key_angles, transit_frames=5, hold_frames=4):
    values = []
    for index, start in enumerate(key_angles):
        values.extend([start] * hold_frames)
        if index == len(key_angles) - 1:
            continue
        end = key_angles[index + 1]
        for step in range(1, transit_frames + 1):
            values.append(start + (end - start) * easing(step / transit_frames))
    return values


def save_gif(frames, destination, duration=105):
    palette_frames = [
        frame.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        for frame in frames
    ]
    palette_frames[0].save(
        destination,
        save_all=True,
        append_images=palette_frames[1:],
        duration=duration,
        loop=0,
        disposal=2,
        optimize=True,
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    # Level 3 demonstrates each available 30–60° therapist-selected target.
    level3_angles = sequence([0, 30, 40, 50, 60, 50, 40, 30, 0])
    level3_frames = [draw_scene(angle, 3, "訓練範圍 30–60°") for angle in level3_angles]
    save_gif(level3_frames, OUT / "level3_shoulder_flexion_30_60.gif")

    # Level 4 demonstrates the 60° threshold and representative higher targets.
    level4_angles = sequence([0, 60, 90, 120, 150, 180, 150, 120, 90, 60, 0])
    level4_frames = [draw_scene(angle, 4, "訓練目標 60° 或以上") for angle in level4_angles]
    save_gif(level4_frames, OUT / "level4_shoulder_flexion_60_plus.gif")


if __name__ == "__main__":
    main()
