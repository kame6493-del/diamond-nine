# X announcement cards (1200x675): draft week, autumn showdown week, new features.
# Phone shots come from the v1.2 store capture and the FTUE after-shots.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SHOTS = ROOT / "mobile/store-assets/v1.2/_shots"
AFTER = ROOT / "marketing/ftue-audit/after"
BOLD = r"C:\Windows\Fonts\YuGothB.ttc"
REG = r"C:\Windows\Fonts\YuGothM.ttc"
W, H = 1200, 675

def font(size, bold=True):
    return ImageFont.truetype(BOLD if bold else REG, size)

def gradient(top, bottom):
    g = Image.linear_gradient("L").rotate(-90).resize((W, H))
    return Image.composite(Image.new("RGB", (W, H), bottom), Image.new("RGB", (W, H), top), g)

def phone(img_path, height, crop_top=0.0, crop_h=None):
    im = Image.open(img_path).convert("RGB")
    w, h = im.size
    top = int(h * crop_top)
    bottom = h if crop_h is None else min(h, top + int(h * crop_h))
    im = im.crop((0, top, w, bottom))
    scale = height / im.height
    im = im.resize((int(im.width * scale), height), Image.LANCZOS)
    bezel = 12
    frame = Image.new("RGBA", (im.width + bezel * 2, im.height + bezel * 2), (0, 0, 0, 0))
    m = Image.new("L", frame.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, frame.width - 1, frame.height - 1), 34, fill=255)
    frame.paste((14, 16, 26, 255), (0, 0), m)
    sm = Image.new("L", im.size, 0)
    ImageDraw.Draw(sm).rounded_rectangle((0, 0, im.width - 1, im.height - 1), 24, fill=255)
    frame.paste(im, (bezel, bezel), sm)
    return frame

def shadowed(base, layer, xy):
    sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
    a = layer.split()[-1].point(lambda v: 110 if v else 0)
    sh.paste((0, 0, 0, 255), (xy[0] + 10, xy[1] + 16), a)
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14)))
    base.alpha_composite(layer, xy)

def text_block(d, x, y, lines, size, fill, gap=1.25, bold=True):
    f = font(size, bold)
    for line in lines:
        d.text((x, y), line, font=f, fill=fill)
        y += int(size * gap)
    return y

def pill(d, x, y, label, bg, fg, size=26):
    f = font(size)
    w = d.textlength(label, font=f)
    d.rounded_rectangle((x, y, x + w + 36, y + size + 22), (size + 22) // 2, fill=bg)
    d.text((x + 18, y + 9), label, font=f, fill=fg)

def card(name, top, bottom, tag, tag_colors, title, body, shots, foot):
    base = gradient(top, bottom).convert("RGBA")
    d = ImageDraw.Draw(base)
    lines = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lines)
    for off in range(-H, W, 90):
        ld.line([(off, H), (off + H, 0)], fill=(255, 255, 255, 18), width=2)
    base.alpha_composite(lines)
    d = ImageDraw.Draw(base)
    pill(d, 64, 70, tag, *tag_colors)
    y = text_block(d, 64, 140, title, 60, (255, 255, 255))
    y = text_block(d, 64, y + 18, body, 28, (235, 238, 250), 1.55, bold=False)
    d.text((64, H - 78), foot, font=font(26), fill=(255, 214, 110))
    x = W - 40
    for path, crop_top, crop_h, hgt in reversed(shots):
        ph = phone(path, hgt, crop_top, crop_h)
        x -= ph.width
        shadowed(base, ph, (x, (H - ph.height) // 2 + 6))
        x -= 18
    base.convert("RGB").save(HERE / name, quality=95)
    print(name)

card("1_draft_week.png", (14, 30, 84), (46, 92, 196), "期間限定 10/16〜11/3", ((255, 214, 110), (40, 28, 0)),
     ["ドラフト会議", "ウィーク"], ["スカウトの国内選手のうち30%が", "ルーキーから登場。", "未来のエースを引き当てよう。"],
     [(SHOTS / "5-draft-ios.png", 0.0, 0.62, 560)], "DIAMOND NINE  #DIAMONDNINEドラフト")
card("2_autumn_week.png", (90, 22, 22), (214, 104, 38), "期間限定 11/4〜11/16", ((255, 236, 180), (90, 22, 22)),
     ["秋の頂上決戦", "ウィーク"], ["期間中にシーズンを終えるたび", "ボーナス ＋2,000pt。", "秋の頂上決戦を勝ち抜こう。"],
     [(AFTER / "18_秋の頂上決戦ウィーク.png", 0.12, 0.42, 560)], "DIAMOND NINE  #DIAMONDNINE")
card("3_new_features.png", (12, 22, 60), (34, 60, 130), "アップデート", ((255, 214, 110), (40, 28, 0)),
     ["10人まとめて", "スカウト"], ["強い順に並んで、そのままおまかせ編成。", "シーズン結果カード・届きやすい目標・", "毎日のお知らせも追加。"],
     [(SHOTS / "2-batch-ios.png", 0.0, 0.66, 560)], "DIAMOND NINE  #野球ゲーム")
