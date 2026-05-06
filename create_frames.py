"""サンプルフレーム画像を生成するスクリプト（フォルダ別管理版）"""
from PIL import Image, ImageDraw, ImageFont
import os

BASE_DIR = os.path.dirname(__file__)
TATE = (1080, 1920)
YOKO = (1920, 1080)

EVENTS = [
    {
        "id": "mother",
        "variants": [
            {"id": "pink",   "label": "Happy Mother's Day", "color": (224,123,139), "accent": (248,200,212)},
            {"id": "flower", "label": "母の日",              "color": (200, 80,120), "accent": (255,220,230)},
        ]
    },
    {
        "id": "father",
        "variants": [
            {"id": "blue",  "label": "Happy Father's Day", "color": (74,127,181),  "accent": (168,204,232)},
            {"id": "green", "label": "父の日",              "color": (60,150, 80),  "accent": (180,230,190)},
        ]
    },
    {
        "id": "keirou",
        "variants": [
            {"id": "gold",   "label": "敬老の日",   "color": (212,160, 86), "accent": (240,219,184)},
            {"id": "sakura", "label": "敬老会",     "color": (210,100,130), "accent": (250,210,220)},
        ]
    },
    {
        "id": "birthday",
        "variants": [
            {"id": "colorful", "label": "Happy Birthday!", "color": (232,160, 64), "accent": (253,228,176)},
            {"id": "cake",     "label": "お誕生日おめでとう", "color": (180, 80,180), "accent": (230,190,230)},
        ]
    },
    {
        "id": "christmas",
        "variants": [
            {"id": "red",  "label": "Merry Christmas!", "color": (192, 57, 43), "accent": (245,183,177)},
            {"id": "snow", "label": "クリスマス",        "color": ( 60,120,180), "accent": (190,220,255)},
        ]
    },
]


def draw_frame(w, h, variant):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    border = int(min(w, h) * 0.06)
    color  = variant["color"]
    accent = variant["accent"]

    draw.rounded_rectangle([0, 0, w-1, h-1], radius=24,
                           fill=(*accent, 255), outline=(*color, 255),
                           width=max(4, border // 5))

    # 内側を透明化
    mask = Image.new("L", (w, h), 255)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([border, border, w-border-1, h-border-1], radius=16, fill=0)
    img.putalpha(Image.composite(img.split()[3], Image.new("L", (w, h), 0), mask))

    # 枠線を再描画
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, w-1, h-1], radius=24,
                           fill=None, outline=(*color, 255),
                           width=max(4, border // 5))

    # ラベルテキスト
    font_size = int(min(w, h) * 0.04)
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), variant["label"], font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((w - tw) // 2, int(border * 0.25)), variant["label"],
              fill=(*color, 255), font=font)

    # 四隅の丸
    dot_r = int(min(w, h) * 0.015)
    for cx, cy in [(border//2, border//2), (w-border//2, border//2),
                   (border//2, h-border//2), (w-border//2, h-border//2)]:
        draw.ellipse([cx-dot_r, cy-dot_r, cx+dot_r, cy+dot_r],
                     fill=(*color, 200))

    # 装飾ライン
    for dash_y in [border - 2, h - border + 2]:
        x = border * 2
        while x < w - border * 2:
            x2 = min(x + 12, w - border * 2)
            draw.line([(x, dash_y), (x2, dash_y)], fill=(*color, 120), width=3)
            x += 20

    return img


for ev in EVENTS:
    folder = os.path.join(BASE_DIR, "frames", ev["id"])
    os.makedirs(folder, exist_ok=True)
    for v in ev["variants"]:
        for size, suffix in [(TATE, "tate"), (YOKO, "yoko")]:
            img = draw_frame(*size, v)
            path = os.path.join(folder, f"{v['id']}_{suffix}.png")
            img.save(path)
            print(f"Created: {path}")

print("\nDone!")
