"""生成站点 OG 分享图（1200x630），输出到 public/og-cover.png。

用法（在博客仓库根目录）：
    python scripts/make-og-image.py
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
BG_TOP = (24, 18, 44)
BG_BOTTOM = (12, 9, 22)
ACCENT = (139, 92, 246)  # 紫罗兰，对应 themeColor hue 275 附近
TEXT = (245, 243, 250)
MUTED = (176, 168, 196)

FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_REGULAR = "C:/Windows/Fonts/msyh.ttc"


def vertical_gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        img.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img.resize((w, h))


def main():
    canvas = vertical_gradient((W, H), BG_TOP, BG_BOTTOM).convert("RGBA")

    # 左上角一团紫色光晕，避免纯色板死板
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-220, -260, 620, 420), fill=(*ACCENT, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    canvas = Image.alpha_composite(canvas, glow)

    draw = ImageDraw.Draw(canvas)

    # 左侧竖条
    draw.rounded_rectangle((88, 132, 96, 396), radius=4, fill=ACCENT)

    title_font = ImageFont.truetype(FONT_BOLD, 116)
    sub_font = ImageFont.truetype(FONT_REGULAR, 44)
    tag_font = ImageFont.truetype(FONT_REGULAR, 30)
    url_font = ImageFont.truetype(FONT_REGULAR, 28)

    draw.text((132, 176), "Vio1etz7", font=title_font, fill=TEXT)
    draw.text((136, 330), "一个软工学生的博客", font=sub_font, fill=MUTED)
    draw.text((136, 404), "游戏开发 · 游戏 · 折腾", font=tag_font, fill=ACCENT)

    # 底部细线与地址
    draw.line((88, 520, W - 88, 520), fill=(255, 255, 255, 28), width=2)
    draw.text((136, 545), "vio1etz7.github.io", font=url_font, fill=MUTED)

    canvas.convert("RGB").save("public/og-cover.png", "PNG", optimize=True)
    print("saved public/og-cover.png", canvas.size)


if __name__ == "__main__":
    main()
