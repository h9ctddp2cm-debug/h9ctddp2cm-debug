from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "img" / "advanced"
W, H = 720, 405
FONT_PATH = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_SMALL = ImageFont.truetype(FONT_PATH, 17)
FONT_DEGREE = ImageFont.truetype(FONT_PATH, 30)
INK = (19, 75, 66)
MUTED = (91, 105, 101)
PAPER = (252, 250, 245)


def fit_panel(panel: Image.Image) -> Image.Image:
    panel = panel.convert("RGB")
    scale = min(W / panel.width, H / panel.height)
    resized = panel.resize(
        (round(panel.width * scale), round(panel.height * scale)),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGB", (W, H), PAPER)
    canvas.paste(resized, ((W - resized.width) // 2, (H - resized.height) // 2))
    return canvas


def add_badge(frame: Image.Image, level: int, degree: int, range_text: str) -> Image.Image:
    result = frame.copy()
    draw = ImageDraw.Draw(result)
    draw.rounded_rectangle(
        (493, 22, 698, 104),
        radius=17,
        fill=(240, 247, 244),
        outline=INK,
        width=3,
    )
    draw.text((511, 38), f"Level {level}", font=FONT_SMALL, fill=INK)
    draw.text((673, 31), f"{degree}°", font=FONT_DEGREE, fill=INK, anchor="ra")
    draw.text((511, 75), range_text, font=FONT_SMALL, fill=MUTED)
    return result


def animate(frames, degrees, level, range_text, destination):
    labelled = [
        add_badge(frame, level, degree, range_text)
        for frame, degree in zip(frames, degrees)
    ]
    sequence = []
    route = list(range(len(labelled))) + list(range(len(labelled) - 2, -1, -1))
    for index in route:
        # Deliberate stepped poses are easier for older patients to read than
        # crossfades, which create double bodies when source panels shift.
        sequence.extend([labelled[index]] * 6)

    palette = [
        frame.quantize(
            colors=192,
            method=Image.Quantize.MEDIANCUT,
            dither=Image.Dither.FLOYDSTEINBERG,
        )
        for frame in sequence
    ]
    palette[0].save(
        destination,
        save_all=True,
        append_images=palette[1:],
        duration=105,
        loop=0,
        disposal=2,
        optimize=True,
    )


def crop_level3(source: Image.Image):
    width, height = source.size
    cell_width = width / 4
    panels = []
    for column in range(4):
        left = round(column * cell_width)
        right = round((column + 1) * cell_width)
        panels.append(fit_panel(source.crop((left, 0, right, height))))
    return panels


def crop_level4(source: Image.Image):
    width, height = source.size
    cell_width = width / 3
    cell_height = height / 2
    panels = []
    for row in range(2):
        for column in range(3):
            left = round(column * cell_width)
            top = round(row * cell_height)
            right = round((column + 1) * cell_width)
            bottom = round((row + 1) * cell_height)
            panels.append(fit_panel(source.crop((left, top, right, bottom))))
    return panels


def main():
    level3 = Image.open(IMG / "level3_patient_therapist_strip.png")
    level4 = Image.open(IMG / "level4_patient_therapist_sprites.png")

    animate(
        crop_level3(level3),
        [0, 30, 50, 60],
        3,
        "示範 30–60°",
        IMG / "level3_shoulder_flexion_30_60.gif",
    )
    animate(
        crop_level4(level4),
        [0, 60, 90, 120, 150, 180],
        4,
        "示範 60° 或以上",
        IMG / "level4_shoulder_flexion_60_plus.gif",
    )


if __name__ == "__main__":
    main()
