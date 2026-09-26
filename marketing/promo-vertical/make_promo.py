# Vertical promo video (1080x1920, 30fps) from real gameplay captures.
# Input: frame folders written by capture.py (CDP screencast, timestamped JPEGs).
# Output: diamond-nine-promo-vertical.mp4 next to this script.
# Sound effects are the game's own CC0 files (public/audio, see THIRD_PARTY_ASSETS.txt).
import json, math, subprocess, sys
from bisect import bisect_right
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CLIPS = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "clips"
FFMPEG = next((ROOT / ".tools").rglob("ffmpeg*.exe"))
OUT = HERE / "diamond-nine-promo-vertical.mp4"
W, H, FPS = 1080, 1920, 30
BOLD = r"C:\Windows\Fonts\YuGothB.ttc"
LOGO = Image.open(ROOT / "mobile/android/app/src/main/res/drawable-nodpi/diamond_nine_logo.png").convert("RGB")
NAVY_TOP, NAVY_BOTTOM = (9, 18, 44), (28, 46, 102)
GOLD, WHITE = (255, 212, 110), (255, 255, 255)

def font(size):
    return ImageFont.truetype(BOLD, size)

def load_clip(name):
    d = CLIPS / name
    idx = json.loads((d / "index.json").read_text())
    return d, [e["t"] for e in idx], [e["f"] for e in idx]

_cache = {}
def clip_frame(name, t):
    d, ts, fs = _cache.setdefault(name, load_clip(name))
    i = max(0, bisect_right(ts, t) - 1)
    key = (name, i)
    if key not in _cache:
        _cache.clear() if len(_cache) > 40 else None
        _cache[name] = (d, ts, fs)
        _cache[key] = Image.open(d / fs[i]).convert("RGB")
    return _cache[key]

def background():
    bg = Image.new("RGB", (W, H))
    px = bg.load()
    for y in range(H):
        k = y / (H - 1)
        c = tuple(round(a + (b - a) * k) for a, b in zip(NAVY_TOP, NAVY_BOTTOM))
        for x in range(W):
            px[x, y] = c
    # faint diamond lines, like the infield chalk
    d = ImageDraw.Draw(bg)
    for off in range(-H, W + H, 160):
        d.line([(off, 0), (off + H, H)], fill=(40, 62, 124), width=2)
        d.line([(off + H, 0), (off, H)], fill=(40, 62, 124), width=2)
    return bg.filter(ImageFilter.GaussianBlur(1))

BG = background()
PHONE_W, PHONE_Y = 810, 400
PHONE_H = round(PHONE_W * 16 / 9)
MASK = Image.new("L", (PHONE_W, PHONE_H), 0)
ImageDraw.Draw(MASK).rounded_rectangle((0, 0, PHONE_W, PHONE_H), 48, fill=255)
SHADOW = Image.new("L", (PHONE_W + 120, PHONE_H + 120), 0)
ImageDraw.Draw(SHADOW).rounded_rectangle((60, 70, PHONE_W + 60, PHONE_H + 70), 56, fill=150)
SHADOW = SHADOW.filter(ImageFilter.GaussianBlur(28))

def text_center(draw, y, s, size, fill, stroke=6):
    f = font(size)
    w = draw.textlength(s, font=f)
    draw.text(((W - w) / 2, y), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=(6, 12, 30))

def ease(k):
    return 1 - (1 - max(0, min(1, k))) ** 3

def compose_game(game, title, sub, local, dur):
    frame = BG.copy()
    zoom = 1.0 + 0.035 * (local / max(dur, 0.01))
    gw, gh = round(PHONE_W * zoom), round(PHONE_H * zoom)
    g = game.resize((gw, gh), Image.LANCZOS).crop(((gw - PHONE_W) // 2, (gh - PHONE_H) // 2, (gw - PHONE_W) // 2 + PHONE_W, (gh - PHONE_H) // 2 + PHONE_H))
    x = (W - PHONE_W) // 2
    frame.paste((0, 0, 0), (x - 60, PHONE_Y - 60), SHADOW)
    frame.paste(g, (x, PHONE_Y), MASK)
    d = ImageDraw.Draw(frame)
    k = ease(local / 0.35)
    dy = round((1 - k) * 40)
    text_center(d, 110 + dy, title, 104, WHITE)
    text_center(d, 250 + dy, sub, 54, GOLD, stroke=4)
    return frame

def compose_intro(local, dur):
    frame = BG.copy()
    k = ease(local / 0.8)
    size = round(620 * (0.82 + 0.18 * k))
    logo = LOGO.resize((size, size), Image.LANCZOS)
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size, size), 70, fill=round(255 * k))
    frame.paste(logo, ((W - size) // 2, 560 - size // 2 + 200), m)
    d = ImageDraw.Draw(frame)
    if local > 0.5:
        text_center(d, 1260, "選手を集めて、育てて、", 72, WHITE)
        text_center(d, 1360, "自分だけの最強チームへ。", 72, GOLD)
    return frame

def compose_outro(local, dur):
    frame = BG.copy()
    size = 520
    logo = LOGO.resize((size, size), Image.LANCZOS)
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size, size), 60, fill=255)
    frame.paste(logo, ((W - size) // 2, 260), m)
    d = ImageDraw.Draw(frame)
    k = ease(local / 0.4)
    text_center(d, 860, "スマホ・PCで無料", 88, WHITE)
    # pill for the call to action
    pill_w, pill_h, py = 880, 150, 1030
    px = (W - pill_w) // 2
    d.rounded_rectangle((px, py, px + pill_w, py + pill_h), 75, fill=(255, 196, 70))
    f = font(66)
    s = "Android版 テスター募集中"
    d.text(((W - d.textlength(s, font=f)) / 2, py + 36), s, font=f, fill=(20, 28, 60))
    text_center(d, 1260, "diamond-nine-baseball.com", 58, WHITE, stroke=4)
    text_center(d, 1360, "で今すぐ遊べる", 58, GOLD, stroke=4)
    if k < 1:
        frame = Image.blend(BG, frame, k)
    return frame

# (kind, duration, clip, [(local_from, local_to, clip_from, clip_to)...], title, sub)
SCENES = [
    ("intro", 2.2, None, None, "", ""),
    ("game", 4.2, "01-pull", [(0.0, 2.3, 0.45, 3.24), (2.3, 4.2, 3.24, 4.8)], "カードを引いて", "いきなり総合94が来た!"),
    ("game", 2.2, "02-lineup", [(0.0, 2.2, 0.2, 0.9)], "打線を組んで", "迷ったら「おまかせ編成」"),
    ("game", 2.1, "03-season", [(0.0, 2.1, 0.3, 1.9)], "1年を一気に", "143試合をワンタップで"),
    ("game", 2.6, "04-stats", [(0.0, 2.6, 0.7, 2.75)], "成績を眺める", "打率・本塁打・OPSまで"),
    ("game", 1.9, "05-scout", [(0.0, 1.9, 0.9, 2.3)], "スカウトで補強", "次は誰が来る?"),
    ("outro", 3.4, None, None, "", ""),
]
FADE = 0.2

def clip_time(segs, local):
    for a, b, ca, cb in segs:
        if local <= b:
            k = (local - a) / (b - a)
            return ca + (cb - ca) * max(0, min(1, k))
    return segs[-1][3]

def render_scene(s, local):
    kind, dur, clip, segs, title, sub = s
    if kind == "intro":
        return compose_intro(local, dur)
    if kind == "outro":
        return compose_outro(local, dur)
    return compose_game(clip_frame(clip, clip_time(segs, local)), title, sub, local, dur)

def main():
    total = sum(s[1] for s in SCENES)
    n = round(total * FPS)
    starts, t = [], 0.0
    for s in SCENES:
        starts.append(t)
        t += s[1]
    silent = HERE / "_video.mp4"
    enc = subprocess.Popen([str(FFMPEG), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(silent)], stdin=subprocess.PIPE)
    for i in range(n):
        tt = i / FPS
        si = max(j for j, st in enumerate(starts) if st <= tt)
        local = tt - starts[si]
        img = render_scene(SCENES[si], local)
        # crossfade from the previous scene's last frame
        if si > 0 and local < FADE:
            prev = render_scene(SCENES[si - 1], SCENES[si - 1][1])
            img = Image.blend(prev, img, local / FADE)
        enc.stdin.write(img.tobytes())
        if i % 60 == 0:
            print(f"{i}/{n}", flush=True)
    enc.stdin.close()
    enc.wait()

    # sound effects: (file, start seconds, volume)
    a = ROOT / "public/audio"
    s_pull = starts[1]
    sfx = [
        (a / "kenney/pack-open.wav", s_pull + 0.15, 0.9),
        (a / "freesound/scout-gold-success-171671.wav", s_pull + 2.3, 0.8),
        (a / "kenney/card-place.wav", starts[2], 0.6),
        (a / "kenney/card-place.wav", starts[3], 0.6),
        (a / "kenney/confirm.wav", starts[4], 0.6),
        (a / "kenney/pack-open.wav", starts[5] + 0.1, 0.8),
        (a / "kenney/scout-congratulations.wav", starts[6] + 0.2, 0.7),
    ]
    cmd = [str(FFMPEG), "-y", "-loglevel", "error", "-i", str(silent)]
    for f, _, _ in sfx:
        cmd += ["-i", str(f)]
    parts = []
    for k, (_, st, vol) in enumerate(sfx, start=1):
        ms = round(st * 1000)
        parts.append(f"[{k}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={vol},adelay={ms}|{ms}[s{k}]")
    mix = "".join(f"[s{k}]" for k in range(1, len(sfx) + 1))
    parts.append(f"{mix}amix=inputs={len(sfx)}:normalize=0,apad,atrim=0:{total:.2f}[aout]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(OUT)]
    subprocess.run(cmd, check=True)
    silent.unlink()
    print("wrote", OUT, round(total, 1), "s")

if __name__ == "__main__":
    main()
