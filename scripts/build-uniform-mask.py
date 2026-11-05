# 試合の人形のユニフォームをチームの色に塗り替えるための「塗る所」の絵(2026-11-05)。
# 今の青と赤の2枚のコマ(ChatGPT イメージで描いた物、atlas_blue/atlas_red)を比べ、青い方が青で赤い方が赤の画素=チームの色の所とする。
# 出力 atlas_mask.webp(ロスレス): R=明るさ(128=ふつう)、G=255 なら帽子(上の方)、A=塗る強さ。絵柄・線はそのまま(線の黒は塗らない)。
# 使い方: python -I scripts/build-uniform-mask.py
import os, re
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = os.path.join(ROOT, 'public', 'assets', 'pro', 'watch', 'm')
blue = Image.open(os.path.join(M, 'atlas_blue.webp')).convert('RGBA')
red = Image.open(os.path.join(M, 'atlas_red.webp')).convert('RGBA')
W, H = blue.size
src = open(os.path.join(ROOT, 'src', 'pro', 'sprite-atlas.ts'), encoding='utf-8').read()
frames = {m.group(1): tuple(int(x) for x in m.group(2).split(',')[:4]) for m in re.finditer(r"(\w+):\[([\d,\.]+)\]", src)}
bp, rp = blue.load(), red.load()
vals = []
team = {}
for y in range(H):
    for x in range(W):
        b = bp[x, y]; r = rp[x, y]
        if b[3] < 8: continue
        bb = b[2] - max(b[0], b[1]); rr = r[0] - max(r[1], r[2])
        if bb > 18 and rr > 18:
            a = min(255, int(min(bb, rr) * 255 / 60), b[3])
            v = max(b[0], b[1], b[2])
            team[(x, y)] = (v, a); vals.append(v)
vals.sort(); base = vals[len(vals) // 2]
print('team pixels', len(vals), 'base value', base)
cap_frac = {}
for name, (fx, fy, fw, fh) in frames.items():
    if name in ('field_dive', 'run_slide'): cap_frac[name] = 0
    elif name.startswith('catch_'): cap_frac[name] = .42
    else: cap_frac[name] = .36
def frame_of(x, y):
    for name, (fx, fy, fw, fh) in frames.items():
        if fx <= x < fx + fw and fy <= y < fy + fh: return name, fy, fh
    return None, 0, 0
out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); op = out.load()
for (x, y), (v, a) in team.items():
    s = max(0, min(255, round(v / base * 128)))
    name, fy, fh = frame_of(x, y)
    cap = 255 if name and cap_frac.get(name, 0) and y < fy + fh * cap_frac[name] else 0
    op[x, y] = (s, cap, 0, a)
out.save(os.path.join(M, 'atlas_mask.webp'), lossless=True, quality=100)
print('saved', os.path.getsize(os.path.join(M, 'atlas_mask.webp')))
