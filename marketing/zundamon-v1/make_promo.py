# zundamon-v1: vertical promo (1080x1920, 30fps) with VOICEVOX dialogue (Zundamon / Shikoku Metan).
# Based on marketing/promo-v8/make_promo.py.
# Inputs: clips/ (capture.py), lines.json (script + scene mapping), voice/ (tts.py).
# Output: diamond-nine-zundamon-60s.mp4 + check-*.jpg + timing.json next to this script.
# Scene length = LEAD + voice length + TAIL. Sound effects are the game's own CC0 files (public/audio). No BGM.
# Character art is NOT used (separate license); speakers are shown as colored name tags + speech bubbles.
import json, subprocess, wave
from bisect import bisect_right
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CLIPS = HERE / "clips"
VOICE = HERE / "voice"
FFMPEG = Path("C:/Users/yuichi1/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe")
OUT = HERE / "diamond-nine-zundamon-60s.mp4"
W, H, FPS = 1080, 1920, 30
BOLD = r"C:\Windows\Fonts\YuGothB.ttc"
LOGO = Image.open(ROOT / "mobile/android/app/src/main/res/drawable-nodpi/diamond_nine_logo.png").convert("RGB")
NAVY_TOP, NAVY_BOTTOM = (9, 18, 44), (28, 46, 102)
GOLD, WHITE, INK = (255, 212, 110), (255, 255, 255), (20, 28, 60)
MAX_TEXT_W = 950
LEAD, TAIL, OUTRO_EXTRA, FADE = 0.15, 0.3, 1.2, 0.2
VOICE_GAIN = 1.6  # VOICEVOX output peaks around -6 dBFS; +4 dB, limiter caps at -1 dBFS
SPEAKERS = {
    "zundamon": {"name": "ずんだもん", "color": (86, 176, 64), "side": "left"},
    "metan": {"name": "四国めたん", "color": (232, 92, 150), "side": "right"},
}
CREDIT = "VOICEVOX:ずんだもん　VOICEVOX:四国めたん"

def font(size):
    return ImageFont.truetype(BOLD, size)

_meta, _img = {}, {}
def clip_frame(name, t):
    if name not in _meta:
        d = CLIPS / name
        idx = json.loads((d / "index.json").read_text())
        _meta[name] = (d, [e["t"] for e in idx], [e["f"] for e in idx])
    d, ts, fs = _meta[name]
    i = max(0, bisect_right(ts, t) - 1)
    key = (name, i)
    if key not in _img:
        if len(_img) > 40:
            _img.clear()
        _img[key] = Image.open(d / fs[i]).convert("RGB")
    return _img[key]

def background():
    bg = Image.new("RGB", (W, H))
    px = bg.load()
    for y in range(H):
        k = y / (H - 1)
        c = tuple(round(a + (b - a) * k) for a, b in zip(NAVY_TOP, NAVY_BOTTOM))
        for x in range(W):
            px[x, y] = c
    d = ImageDraw.Draw(bg)
    for off in range(-H, W + H, 160):
        d.line([(off, 0), (off + H, H)], fill=(40, 62, 124), width=2)
        d.line([(off + H, 0), (off, H)], fill=(40, 62, 124), width=2)
    bg = bg.filter(ImageFilter.GaussianBlur(1))
    # credit is drawn once into the background, so it is on screen for the whole video
    d = ImageDraw.Draw(bg)
    f = font(30)
    d.text(((W - d.textlength(CREDIT, font=f)) / 2, 1862), CREDIT, font=f, fill=(200, 210, 235))
    return bg

BG = background()
PHONE_W, PHONE_Y = 660, 60
PHONE_H = round(PHONE_W * 16 / 9)
PHONE_X = (W - PHONE_W) // 2
MASK = Image.new("L", (PHONE_W, PHONE_H), 0)
ImageDraw.Draw(MASK).rounded_rectangle((0, 0, PHONE_W, PHONE_H), 40, fill=255)
SHADOW = Image.new("L", (PHONE_W + 120, PHONE_H + 120), 0)
ImageDraw.Draw(SHADOW).rounded_rectangle((60, 70, PHONE_W + 60, PHONE_H + 70), 48, fill=150)
SHADOW = SHADOW.filter(ImageFilter.GaussianBlur(28))

def text_center(draw, y, s, size, fill, stroke=6):
    f = font(size)
    while draw.textlength(s, font=f) + 2 * stroke > MAX_TEXT_W and size > 20:
        size -= 2
        f = font(size)
    w = draw.textlength(s, font=f)
    draw.text(((W - w) / 2, y), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=(6, 12, 30))

def ease(k):
    return 1 - (1 - max(0, min(1, k))) ** 3

# --- speech bubble -------------------------------------------------------
BUB_X0, BUB_X1, BUB_Y0, BUB_Y1 = 44, W - 44, 1400, 1830
TEXT_W = BUB_X1 - BUB_X0 - 100
NO_START = set("、。！？…』」）ー・!?,.")

def tokens(s):
    # keep ASCII words (DIAMOND, TestFlight, 143) together; everything else per character
    out, buf = [], ""
    for ch in s:
        if ch.isascii() and (ch.isalnum() or ch in "-'"):
            buf += ch
        else:
            if buf:
                out.append(buf); buf = ""
            out.append(ch)
    if buf:
        out.append(buf)
    return out

def wrap(draw, s, f):
    lines, cur = [], ""
    for tk in tokens(s):
        if cur and draw.textlength(cur + tk, font=f) > TEXT_W and tk not in NO_START:
            lines.append(cur.rstrip())
            cur = tk.lstrip()
        else:
            cur += tk
    if cur:
        lines.append(cur)
    return lines

_bubble_cache = {}
def bubble_layer(who, text, given=None):
    if given:
        assert "".join(given) == text, (given, text)
        given = tuple(given)
    key = (who, text, given)
    if key in _bubble_cache:
        return _bubble_cache[key]
    sp = SPEAKERS[who]
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # name tag
    nf = font(46)
    nw = d.textlength(sp["name"], font=nf) + 64
    tag_y0, tag_y1 = BUB_Y0 - 92, BUB_Y0 - 14
    tx0 = BUB_X0 + 20 if sp["side"] == "left" else BUB_X1 - 20 - nw
    # tail from the tag down into the bubble
    cx = tx0 + 70 if sp["side"] == "left" else tx0 + nw - 70
    d.polygon([(cx - 26, BUB_Y0 + 8), (cx + 26, BUB_Y0 + 8), (cx, tag_y1 - 6)], fill=sp["color"])
    d.rounded_rectangle((BUB_X0, BUB_Y0, BUB_X1, BUB_Y1), 44, fill=(255, 255, 255, 255), outline=sp["color"], width=10)
    d.polygon([(cx - 16, BUB_Y0 + 12), (cx + 16, BUB_Y0 + 12), (cx, BUB_Y0 - 4)], fill=(255, 255, 255, 255))
    d.rounded_rectangle((tx0, tag_y0, tx0 + nw, tag_y1), 39, fill=sp["color"], outline=WHITE, width=4)
    d.text((tx0 + 32, tag_y0 + 12), sp["name"], font=nf, fill=WHITE)
    # text: hand-made line breaks (must join back to the spoken line), else auto wrap;
    # biggest size where every line fits inside the bubble
    for size in range(66, 30, -2):
        f = font(size)
        lines = given if given else wrap(d, text, f)
        lh = round(size * 1.42)
        if len(lines) <= 4 and len(lines) * lh <= BUB_Y1 - BUB_Y0 - 70 and all(d.textlength(l, font=f) <= TEXT_W for l in lines):
            break
    y = (BUB_Y0 + BUB_Y1) / 2 - len(lines) * lh / 2 + (lh - size) / 2 - 6
    for l in lines:
        d.text((BUB_X0 + 50, y), l, font=f, fill=INK)
        lines = list(lines)
        y += lh
    _bubble_cache[key] = (layer, size, lines)
    return _bubble_cache[key]

def add_bubble(frame, scene, local):
    layer = bubble_layer(scene["who"], scene["text"], scene.get("lines"))[0]
    k = ease(local / 0.18)
    if k < 1:
        a = layer.split()[3].point(lambda v: round(v * k))
        layer = layer.copy()
        layer.putalpha(a)
    frame.paste(layer, (0, round((1 - k) * 24)), layer)
    return frame

# --- scene bodies ----------------------------------------------------------
def compose_game(game, local, dur):
    frame = BG.copy()
    zoom = 1.0 + 0.03 * (local / max(dur, 0.01))
    gw, gh = round(PHONE_W * zoom), round(PHONE_H * zoom)
    g = game.resize((gw, gh), Image.LANCZOS).crop(((gw - PHONE_W) // 2, (gh - PHONE_H) // 2, (gw - PHONE_W) // 2 + PHONE_W, (gh - PHONE_H) // 2 + PHONE_H))
    frame.paste((0, 0, 0), (PHONE_X - 60, PHONE_Y - 60), SHADOW)
    frame.paste(g, (PHONE_X, PHONE_Y), MASK)
    return frame

def rounded_logo(size, r, alpha=255):
    logo = LOGO.resize((size, size), Image.LANCZOS)
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size, size), r, fill=alpha)
    return logo, m

def compose_intro(local, dur):
    frame = BG.copy()
    k = ease(local / 0.8)
    size = round(560 * (0.82 + 0.18 * k))
    logo, m = rounded_logo(size, 66, round(255 * k))
    frame.paste(logo, ((W - size) // 2, 560 - size // 2), m)
    d = ImageDraw.Draw(frame)
    if local > 0.35:
        text_center(d, 920, "DIAMOND NINE", 104, WHITE)
        text_center(d, 1080, "スマホ野球シミュレーション", 64, GOLD, stroke=4)
    return frame

def compose_outro(local, dur):
    frame = BG.copy()
    size = 420
    logo, m = rounded_logo(size, 52)
    frame.paste(logo, ((W - size) // 2, 70), m)
    d = ImageDraw.Draw(frame)
    text_center(d, 530, "DIAMOND NINE", 96, WHITE)
    pill_w, pill_h, py = 760, 136, 680
    px = (W - pill_w) // 2
    d.rounded_rectangle((px, py, px + pill_w, py + pill_h), 68, fill=(255, 196, 70))
    f = font(68)
    s = "無料で遊べる"
    d.text(((W - d.textlength(s, font=f)) / 2, py + 30), s, font=f, fill=INK)
    text_center(d, 880, "iPhone：TestFlight　Android：テスター募集中", 44, WHITE, stroke=4)
    text_center(d, 990, "#DIAMONDNINE  #野球ゲーム", 58, GOLD, stroke=4)
    text_center(d, 1100, "diamond-nine-baseball.com", 54, WHITE, stroke=4)
    k = ease(local / 0.4)
    if k < 1:
        frame = Image.blend(BG, frame, k)
    return frame

def clip_time(sc, local):
    a, b = sc["from"], sc["to"]
    if "slow" in sc:
        rate = 1 / sc["slow"]
    else:
        rate = max(1.0, (b - a) / max(sc["dur"] - 0.4, 0.1))  # speed up only when the clip is longer than the scene
    return min(b, a + local * rate)

def render_scene(sc, local):
    if sc["kind"] == "intro":
        frame = compose_intro(local, sc["dur"])
    elif sc["kind"] == "outro":
        frame = compose_outro(local, sc["dur"])
    else:
        frame = compose_game(clip_frame(sc["clip"], clip_time(sc, local)), local, sc["dur"])
    return add_bubble(frame, sc, local)

def wav_len(p):
    with wave.open(str(p)) as w:
        return w.getnframes() / w.getframerate()

def main():
    scenes = json.loads((HERE / "lines.json").read_text(encoding="utf-8"))
    starts, t = [], 0.0
    for i, sc in enumerate(scenes, start=1):
        sc["voice"] = VOICE / f"{i:02d}.wav"
        sc["vlen"] = wav_len(sc["voice"])
        sc["dur"] = round(LEAD + sc["vlen"] + TAIL + (OUTRO_EXTRA if sc["kind"] == "outro" else 0), 3)
        starts.append(round(t, 3))
        t += sc["dur"]
    total = t
    n = round(total * FPS)
    silent = HERE / "_video.mp4"
    enc = subprocess.Popen([str(FFMPEG), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(silent)], stdin=subprocess.PIPE)
    for i in range(n):
        tt = i / FPS
        si = max(j for j, st in enumerate(starts) if st <= tt + 1e-9)
        local = tt - starts[si]
        img = render_scene(scenes[si], local)
        if si > 0 and local < FADE:
            prev = render_scene(scenes[si - 1], scenes[si - 1]["dur"])
            img = Image.blend(prev, img, local / FADE)
        enc.stdin.write(img.tobytes())
        if i % 150 == 0:
            print(f"{i}/{n}", flush=True)
    enc.stdin.close()
    enc.wait()

    # audio: dialogue at full level, sound effects quieter, limiter keeps the peak under 0 dBFS
    a = ROOT / "public/audio"
    inputs = []  # (file, start seconds, volume)
    for sc, st in zip(scenes, starts):
        inputs.append((sc["voice"], st + LEAD, VOICE_GAIN))
        for f, lt, vol in sc.get("sfx", []):
            inputs.append((a / f, st + lt, vol))
    cmd = [str(FFMPEG), "-y", "-loglevel", "error", "-i", str(silent)]
    for f, _, _ in inputs:
        cmd += ["-i", str(f)]
    parts = []
    for k, (_, st, vol) in enumerate(inputs, start=1):
        ms = round(st * 1000)
        parts.append(f"[{k}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={vol},adelay={ms}|{ms}[s{k}]")
    mix = "".join(f"[s{k}]" for k in range(1, len(inputs) + 1))
    parts.append(f"{mix}amix=inputs={len(inputs)}:normalize=0,alimiter=limit=0.89:level=0,apad,atrim=0:{total:.3f}[aout]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-shortest", "-movflags", "+faststart", str(OUT)]
    subprocess.run(cmd, check=True)
    silent.unlink()

    # one still per scene (middle of the line) for checking
    for old in HERE.glob("check-*.jpg"):
        old.unlink()
    timing = []
    for i, (sc, st) in enumerate(zip(scenes, starts), start=1):
        mid = st + LEAD + sc["vlen"] * 0.5
        subprocess.run([str(FFMPEG), "-y", "-loglevel", "error", "-ss", f"{mid:.3f}", "-i", str(OUT), "-frames:v", "1", "-q:v", "3",
                        str(HERE / f"check-{i:02d}-{mid:.1f}s.jpg")], check=True)
        _, size, lines = bubble_layer(sc["who"], sc["text"], sc.get("lines"))
        timing.append({"n": i, "who": sc["who"], "start": st, "dur": sc["dur"], "voice_start": round(st + LEAD, 3),
                       "voice_len": round(sc["vlen"], 3), "font": size, "lines": lines, "text": sc["text"]})
    (HERE / "timing.json").write_text(json.dumps({"total": round(total, 3), "scenes": timing}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", OUT, round(total, 2), "s")
    for tm in timing:
        print(f"  {tm['n']:2d} {tm['start']:6.2f}-{tm['start'] + tm['dur']:6.2f}s ({tm['dur']:.2f}) {SPEAKERS[tm['who']]['name']} {tm['text']}")

if __name__ == "__main__":
    main()
