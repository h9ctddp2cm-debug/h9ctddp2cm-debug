from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path("/home/user/workspace")
OUT = ROOT / "ych_rehab_games_advanced" / "img" / "advanced"
SIZE = (640, 360)


def cover(image: Image.Image) -> Image.Image:
    image = image.convert("RGB")
    scale = max(SIZE[0] / image.width, SIZE[1] / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - SIZE[0]) // 2
    top = (resized.height - SIZE[1]) // 2
    return resized.crop((left, top, left + SIZE[0], top + SIZE[1]))


def arrow(frame: Image.Image, start, end, opacity: int, both_ends: bool = False) -> Image.Image:
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    color = (196, 42, 48, opacity)
    width = 14
    draw.line((start, end), fill=color, width=width)
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    head = 30
    wing = 18
    p1 = (end[0] - ux * head + px * wing, end[1] - uy * head + py * wing)
    p2 = (end[0] - ux * head - px * wing, end[1] - uy * head - py * wing)
    draw.polygon((end, p1, p2), fill=color)
    if both_ends:
        p3 = (start[0] + ux * head + px * wing, start[1] + uy * head + py * wing)
        p4 = (start[0] + ux * head - px * wing, start[1] + uy * head - py * wing)
        draw.polygon((start, p3, p4), fill=color)
    return Image.alpha_composite(frame.convert("RGBA"), layer).convert("RGB")


def add_epaulettes(frame: Image.Image, polygons) -> Image.Image:
    """Guarantee white badges with exactly three vertical green stripes."""
    result = frame.copy()
    draw = ImageDraw.Draw(result)
    for polygon in polygons:
        draw.polygon(polygon, fill=(255, 255, 255), outline=(31, 71, 52), width=2)
        left = min(point[0] for point in polygon)
        right = max(point[0] for point in polygon)
        top = min(point[1] for point in polygon)
        bottom = max(point[1] for point in polygon)
        stripe_top = top + 3
        stripe_bottom = bottom - 3
        for fraction in (0.32, 0.5, 0.68):
            x = round(left + (right - left) * fraction)
            draw.line((x, stripe_top, x, stripe_bottom), fill=(38, 112, 75), width=2)
    return result


def save_gif(frames, destination: Path, duration=110):
    quantized = [
        frame.quantize(colors=160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        for frame in frames
    ]
    quantized[0].save(
        destination,
        save_all=True,
        append_images=quantized[1:],
        duration=duration,
        loop=0,
        disposal=2,
        optimize=True,
    )


def level3():
    base = cover(Image.open(OUT / "level3_cartoon_small_towel.png"))
    frames = []
    for index in range(28):
        phase = (index % 14) / 13
        opacity = 90 + int(130 * (1 - abs(phase - 0.5) * 2))
        frame = arrow(base, (222, 294), (418, 294), opacity, both_ends=True)
        frames.append(frame)
    save_gif(frames, OUT / "level3_small_towel_side_slide.gif")


def level4():
    base = cover(Image.open(OUT / "level4_lateral_table_start.png"))
    frames = []
    for index in range(28):
        phase = (index % 14) / 13
        opacity = 90 + int(130 * (1 - abs(phase - 0.5) * 2))
        if index < 14:
            # Forward reach along the table positioned beside the affected side.
            frame = arrow(base, (375, 216), (515, 216), opacity)
        else:
            # Return toward the approximately 90-degree elbow start position.
            frame = arrow(base, (515, 216), (375, 216), opacity)
        frames.append(frame)
    save_gif(frames, OUT / "level4_lateral_forward_slide_v2.gif")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    level3()
    level4()
