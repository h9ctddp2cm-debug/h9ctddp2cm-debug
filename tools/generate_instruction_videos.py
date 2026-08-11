from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "videos"
FRAMES = OUT / "_instruction_frames"
OUT.mkdir(exist_ok=True)
FRAMES.mkdir(exist_ok=True)

W, H, FPS, SECONDS = 960, 540, 15, 8
REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

font_title = ImageFont.truetype(BOLD, 35)
font_head = ImageFont.truetype(BOLD, 25)
font_body = ImageFont.truetype(REG, 22)
font_small = ImageFont.truetype(REG, 17)
font_level = ImageFont.truetype(BOLD, 19)

BG = "#F8F4EA"
INK = "#243A38"
TEAL = "#147D72"
TEAL_LIGHT = "#DDF2ED"
ORANGE = "#E98A35"
GOLD = "#F5C451"
WHITE = "#FFFFFF"
RED = "#B94444"

SPECS = {
    3: {
        "title": "雙手桌面水平掃掠",
        "setup": ["iPad 置於患者正前方", "前臂放在毛巾／滑板", "鏡頭同時看見雙肩、手腕"],
        "caption": "雙手保持合攏，由中央向左／右水平滑動，再返回中央",
        "note": "量度水平路徑的垂直偏差；技術驗證模組",
    },
    4: {
        "title": "桌面支撐中線前伸",
        "setup": ["iPad 平放或低角度固定", "前臂獲桌面承托", "手掌／滑墊由下方中線開始"],
        "caption": "沿中線向前滑至目標，停住後返回起點",
        "note": "不用趕速度；治療師觀察肩聳、軀幹代償及疼痛",
    },
    5: {
        "title": "握取、搬運及放手",
        "setup": ["鏡頭距離約一個手臂", "掌心面向鏡頭", "手腕及五隻指尖保持入鏡"],
        "caption": "先張手準備，握拳拿取，維持握住搬運，再張手放下",
        "note": "純色背景及均勻光線可改善 grasp／release 偵測",
    },
    6: {
        "title": "拇食指捏取及放開",
        "setup": ["鏡頭約 35–45° 斜上方", "拇指、食指及手腕保持入鏡", "先不用工具完成校準"],
        "caption": "兩指分開準備，拇食指捏合拿取，搬運後重新分開",
        "note": "系統量度指尖距離（aperture），不量度 pinch force",
    },
}


def rounded(draw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, font, fill=INK, anchor=None):
    draw.text(xy, value, font=font, fill=fill, anchor=anchor)


def arrow(draw, start, end, fill=ORANGE, width=11):
    draw.line([start, end], fill=fill, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    size = 22
    points = [
        end,
        (end[0] - size * math.cos(angle - .55), end[1] - size * math.sin(angle - .55)),
        (end[0] - size * math.cos(angle + .55), end[1] - size * math.sin(angle + .55)),
    ]
    draw.polygon(points, fill=fill)


def draw_table(draw):
    rounded(draw, (515, 185, 910, 430), 26, "#E7D4B3", "#BE9D70", 3)
    draw.line((540, 430, 525, 485), fill="#8A684C", width=10)
    draw.line((885, 430, 900, 485), fill="#8A684C", width=10)
    rounded(draw, (650, 112, 790, 205), 15, "#384B52")
    rounded(draw, (663, 122, 777, 190), 9, "#D8F1EE")
    draw.ellipse((710, 194, 730, 214), fill="#384B52")


def draw_arm(draw, palm, direction=0, color="#E7B08B"):
    px, py = palm
    draw.line((px - 105 * math.cos(direction), py + 105 * math.sin(direction), px, py),
              fill=color, width=37)
    draw.ellipse((px - 27, py - 22, px + 27, py + 22), fill=color, outline="#A5674E", width=2)


def draw_level3(draw, phase):
    draw_table(draw)
    offset = math.sin(phase * math.pi * 2) * 105
    center_x, y = 713 + offset, 330
    draw_arm(draw, (center_x - 20, y), 0)
    draw_arm(draw, (center_x + 20, y), math.pi)
    draw.line((610, y, 815, y), fill="#137C73", width=4)
    if math.cos(phase * math.pi * 2) >= 0:
        arrow(draw, (680, 385), (800, 385))
    else:
        arrow(draw, (745, 385), (625, 385))
    text(draw, (713, 460), "中央 ↔ 左／右", font_head, TEAL, "mm")


def draw_level4(draw, phase):
    draw_table(draw)
    travel = (1 - math.cos(phase * math.pi * 2)) / 2
    palm_y = 385 - travel * 125
    draw_arm(draw, (712, palm_y), math.pi / 2)
    draw.line((712, 225, 712, 405), fill="#137C73", width=4)
    draw.ellipse((678, 205, 746, 250), fill=GOLD, outline=ORANGE, width=3)
    arrow(draw, (760, 375), (760, 245))
    text(draw, (713, 460), "沿中線向前／返回", font_head, TEAL, "mm")


def fingers(draw, palm, openness, pinch=False):
    px, py = palm
    draw.ellipse((px - 52, py - 38, px + 52, py + 45), fill="#E7B08B", outline="#A5674E", width=2)
    if pinch:
        gap = 14 + openness * 50
        draw.line((px - 12, py - 10, px - gap, py - 75), fill="#E7B08B", width=22)
        draw.line((px + 12, py - 10, px + gap, py - 75), fill="#E7B08B", width=22)
        draw.ellipse((px - gap - 11, py - 86, px - gap + 11, py - 64), fill="#E7B08B")
        draw.ellipse((px + gap - 11, py - 86, px + gap + 11, py - 64), fill="#E7B08B")
    else:
        for i, x in enumerate((-33, -11, 11, 33)):
            length = 20 + openness * (62 - abs(i - 1.5) * 7)
            draw.line((px + x, py - 10, px + x + (i - 1.5) * 5 * openness, py - length),
                      fill="#E7B08B", width=18)


def draw_level5(draw, phase):
    draw_table(draw)
    openness = (1 + math.cos(phase * math.pi * 2)) / 2
    fingers(draw, (710, 342), openness)
    item_y = 315 if openness < .45 else 370
    draw.ellipse((685, item_y, 735, item_y + 38), fill=GOLD, outline=ORANGE, width=3)
    labels = "張手" if openness > .65 else "握取"
    text(draw, (713, 460), f"{labels} · 搬運 · 張手放下", font_head, TEAL, "mm")


def draw_level6(draw, phase):
    draw_table(draw)
    openness = (1 + math.cos(phase * math.pi * 2)) / 2
    fingers(draw, (710, 350), openness, pinch=True)
    draw.ellipse((690, 260, 730, 300), fill=GOLD, outline=ORANGE, width=3)
    labels = "兩指分開" if openness > .65 else "捏合"
    text(draw, (713, 460), f"{labels} · 搬運 · 分開放下", font_head, TEAL, "mm")


DRAWERS = {3: draw_level3, 4: draw_level4, 5: draw_level5, 6: draw_level6}


def frame(level, index):
    spec = SPECS[level]
    im = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(im)
    rounded(draw, (18, 18, W - 18, H - 18), 28, WHITE, "#E5D7BD", 2)
    rounded(draw, (36, 35, 178, 74), 18, TEAL)
    text(draw, (107, 55), f"FTHUE Level {level}", font_level, WHITE, "mm")
    text(draw, (200, 54), spec["title"], font_title, TEAL, "lm")

    rounded(draw, (45, 105, 465, 445), 22, TEAL_LIGHT)
    text(draw, (70, 135), "環境設定", font_head, TEAL)
    for n, line in enumerate(spec["setup"], 1):
        cy = 198 + (n - 1) * 75
        draw.ellipse((70, cy - 17, 104, cy + 17), fill=TEAL)
        text(draw, (87, cy), str(n), font_small, WHITE, "mm")
        text(draw, (120, cy), line, font_body, INK, "lm")

    phase = index / (FPS * SECONDS)
    DRAWERS[level](draw, phase)
    rounded(draw, (45, 457, 915, 505), 16, "#FFF3D5")
    text(draw, (65, 481), spec["caption"], font_body, INK, "lm")
    text(draw, (900, 516), spec["note"], font_small, RED, "rm")
    return im


def build(level):
    level_dir = FRAMES / f"level{level}"
    level_dir.mkdir(parents=True, exist_ok=True)
    for i in range(FPS * SECONDS):
        frame(level, i).save(level_dir / f"frame_{i:04d}.png")
    output = OUT / f"fthue-level-{level}-setup-movement.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-framerate", str(FPS),
        "-i", str(level_dir / "frame_%04d.png"),
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(output)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


for level in SPECS:
    build(level)
