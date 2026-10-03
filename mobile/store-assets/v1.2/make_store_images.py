# Store screenshots v1.2 - step 2: compose captioned store images from ./_shots.
#   python make_store_images.py          -> google-play/phone-1..6.png (1080x1920)
#                                           app-store/iphone67-1..6.png (1290x2796, RGB)
#   python make_store_images.py --clean  -> same, then deletes ./_shots
# Look follows marketing/promo-v8/make_promo.py (navy gradient, chalk diamond lines, gold).
import shutil, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
SHOTS = HERE / "_shots"
BOLD = r"C:\Windows\Fonts\YuGothB.ttc"
NAVY_TOP, NAVY_BOTTOM = (9, 18, 44), (28, 46, 102)
GOLD, WHITE, INK = (255, 212, 110), (255, 255, 255), (20, 28, 60)

# (shot name, catch lines, sub line, pill above the catch or None)
SLIDES = [
    ("1-starter", ["選手を集めて、育てて、", "優勝へ。"], "スタートスカウトは総合85以上", None),
    ("2-batch", ["まとめて10人スカウト"], "強い順に並んで、そのままおまかせ編成", "NEW"),
    ("3-season", ["ワンタップで1シーズン"], "143試合を一気に進めて成績をチェック", None),
    ("4-scout", ["当たりカードをシェア"], "金・虹カードは画像にして自慢できる", None),
    ("5-draft", ["ドラフト会議ウィーク"], "10/16〜11/3 ルーキー出現率アップ", "期間限定"),
    ("6-share", ["優勝の記録を", "1枚の画像に"], "打撃成績もチーム能力も記念画像に", None),
]

# Per store: canvas, header box, phone box, which capture size to use.
TARGETS = {
    "gp": dict(size=(1080, 1920), out=HERE / "google-play", name="phone-{}.png", shot="gp",
               catch=100, line=124, sub=50, pill=40, header=(40, 470), phone_top=496, phone_bottom=1868, bezel=18, radius=58),
    "ios": dict(size=(1290, 2796), out=HERE / "app-store", name="iphone67-{}.png", shot="ios",
                catch=122, line=152, sub=60, pill=48, header=(90, 700), phone_top=730, phone_bottom=2706, bezel=22, radius=76),
}

def font(size):
    return ImageFont.truetype(BOLD, size)

def background(w, h):
    grad = Image.linear_gradient("L").resize((w, h))
    bg = Image.composite(Image.new("RGB", (w, h), NAVY_BOTTOM), Image.new("RGB", (w, h), NAVY_TOP), grad)
    d = ImageDraw.Draw(bg)
    step = round(160 * w / 1080)
    for off in range(-h, w + h, step):
        d.line([(off, 0), (off + h, h)], fill=(40, 62, 124), width=2)
        d.line([(off + h, 0), (off, h)], fill=(40, 62, 124), width=2)
    bg = bg.filter(ImageFilter.GaussianBlur(1))
    # soft gold glow behind the phone
    glow = Image.new("L", (w, h), 0)
    ImageDraw.Draw(glow).ellipse((-w * 0.2, h * 0.38, w * 1.2, h * 1.05), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(w * 0.18))
    return Image.composite(Image.new("RGB", (w, h), (120, 96, 40)), bg, glow)

def fit_font(draw, s, size, max_w):
    f = font(size)
    while draw.textlength(s, font=f) > max_w and size > 20:
        size -= 2
        f = font(size)
    return f

def centered(img, y, s, f, fill, shadow=True):
    d = ImageDraw.Draw(img)
    w = d.textlength(s, font=f)
    x = (img.width - w) / 2
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((x, y + 6), s, font=f, fill=(0, 0, 0, 150))
        sh = sh.filter(ImageFilter.GaussianBlur(8))
        img.paste(sh, (0, 0), sh)
        d = ImageDraw.Draw(img)
    d.text((x, y), s, font=f, fill=fill)

def phone(img, shot, t):
    W, H = img.size
    top, bottom, bz, rad = t["phone_top"], t["phone_bottom"], t["bezel"], t["radius"]
    fh = bottom - top
    sh_h = fh - 2 * bz
    sw = round(sh_h * shot.width / shot.height)
    fw = sw + 2 * bz
    x = (W - fw) // 2
    # drop shadow
    pad = 90
    s = Image.new("L", (fw + 2 * pad, fh + 2 * pad), 0)
    ImageDraw.Draw(s).rounded_rectangle((pad, pad + 24, pad + fw, pad + fh + 24), rad, fill=170)
    s = s.filter(ImageFilter.GaussianBlur(34))
    img.paste((0, 0, 0), (x - pad, top - pad), s)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((x, top, x + fw, top + fh), rad, fill=(14, 18, 34), outline=(92, 108, 160), width=3)
    screen = shot.resize((sw, sh_h), Image.LANCZOS)
    m = Image.new("L", (sw, sh_h), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, sw, sh_h), rad - bz, fill=255)
    img.paste(screen, (x + bz, top + bz), m)

def compose(slide, t):
    name, lines, sub, pill = slide
    W, H = t["size"]
    img = background(W, H)
    d = ImageDraw.Draw(img)
    max_w = W - 2 * round(W * 0.06)
    cf = [fit_font(d, s, t["catch"], max_w) for s in lines]
    csize = min(f.size for f in cf)
    cf = font(csize)
    sf = fit_font(d, sub, t["sub"], max_w)
    pill_h = round(t["pill"] * 1.9) if pill else 0
    gap_pill, gap_sub = round(t["catch"] * 0.32), round(t["catch"] * 0.42)
    block = (pill_h + gap_pill if pill else 0) + t["line"] * len(lines) + gap_sub + round(t["sub"] * 1.25)
    h0, h1 = t["header"]
    y = h0 + (h1 - h0 - block) // 2
    if pill:
        pf = font(t["pill"])
        pw = d.textlength(pill, font=pf) + t["pill"] * 1.6
        px = (W - pw) / 2
        d.rounded_rectangle((px, y, px + pw, y + pill_h), pill_h // 2, fill=(255, 196, 70))
        tb = d.textbbox((0, 0), pill, font=pf)
        d.text(((W - (tb[2] - tb[0])) / 2 - tb[0], y + (pill_h - (tb[3] - tb[1])) / 2 - tb[1]), pill, font=pf, fill=INK)
        y += pill_h + gap_pill
    for i, s in enumerate(lines):
        # last line of a two-line catch is the payoff: gold
        fill = GOLD if (len(lines) > 1 and i == len(lines) - 1 and name == "1-starter") else WHITE
        centered(img, y, s, cf, fill)
        y += t["line"]
    d = ImageDraw.Draw(img)
    bar_w = round(W * 0.09)
    by = y + gap_sub // 2 - 4
    d.rounded_rectangle(((W - bar_w) / 2, by, (W + bar_w) / 2, by + 6), 3, fill=GOLD)
    y += gap_sub
    centered(img, y, sub, sf, GOLD, shadow=False)
    shot = Image.open(SHOTS / f"{name}-{t['shot']}.png").convert("RGB")
    phone(img, shot, t)
    return img.convert("RGB")

def main():
    for key, t in TARGETS.items():
        t["out"].mkdir(parents=True, exist_ok=True)
        for i, slide in enumerate(SLIDES, start=1):
            img = compose(slide, t)
            assert img.size == t["size"] and img.mode == "RGB"
            p = t["out"] / t["name"].format(i)
            img.save(p, optimize=True)
            print(p.relative_to(HERE), img.size, img.mode, f"{p.stat().st_size / 1e6:.2f}MB", " / ".join(slide[1]))
    if "--clean" in sys.argv:
        shutil.rmtree(SHOTS)
        print("removed", SHOTS)

if __name__ == "__main__":
    main()
