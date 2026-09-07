import numpy as np
from PIL import Image, ImageDraw, ImageFont

BRAND_A = (0x16, 0x81, 0x5C)  # --brand-a
BRAND_B = (0x1D, 0x5C, 0x87)  # --brand-b
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def make_icon(size, corner_ratio=0.24, supersample=4):
    big = size * supersample
    # Gradiente diagonal (135deg): interpola de canto a canto.
    x = np.linspace(0, 1, big)
    y = np.linspace(0, 1, big)
    xx, yy = np.meshgrid(x, y)
    t = (xx + yy) / 2.0
    gradient = np.zeros((big, big, 3), dtype=np.uint8)
    for channel in range(3):
        gradient[:, :, channel] = (BRAND_A[channel] + (BRAND_B[channel] - BRAND_A[channel]) * t).astype(np.uint8)
    base = Image.fromarray(gradient, "RGB").convert("RGBA")

    mask = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(mask)
    radius = int(big * corner_ratio)
    draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=radius, fill=255)
    base.putalpha(mask)

    glyph_layer = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glyph_layer)
    font = ImageFont.truetype(FONT_PATH, int(big * 0.56))
    bbox = gdraw.textbbox((0, 0), "F", font=font)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pos = ((big - text_w) / 2 - bbox[0], (big - text_h) / 2 - bbox[1])
    gdraw.text(pos, "F", font=font, fill=(255, 255, 255, 255))

    combined = Image.alpha_composite(base, glyph_layer)
    return combined.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    make_icon(192).save("/home/claude/finpilot/icons/icon-192.png")
    make_icon(512).save("/home/claude/finpilot/icons/icon-512.png")
    print("ok")
