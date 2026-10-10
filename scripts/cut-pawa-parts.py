# パワプロ風の参考画像(marketing/ui_ref_pawapuro_2026-10-11/ref_01〜10.png)から使える絵を切り出し、
# 白地を透過にして public/assets/pro/pawa/ に webp で置く。
# 人の絵・実在の球団名やロゴ風の物は切り出さない(ロゴ・ランク札・OVR札・アイコン・◎○△・パック・裏向きカード・
# 覚醒の星・帽子・球場の背景・お祝いの紋章だけ)。
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'marketing', 'ui_ref_pawapuro_2026-10-11')
OUT = os.path.join(ROOT, 'public', 'assets', 'pro', 'pawa')
os.makedirs(OUT, exist_ok=True)
R = {i: Image.open(os.path.join(SRC, f'ref_{i:02d}.png')).convert('RGB') for i in range(1, 11)}


def save(im, name, q=90):
    path = os.path.join(OUT, name + '.webp')
    im.save(path, 'WEBP', quality=q, method=6)
    print(f'{name}.webp {im.size[0]}x{im.size[1]} {os.path.getsize(path)//1024}KB')


def fit(im, w):
    return im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def keyed(ref, box, thr=24, soft=36, holes=False, trim=True, satmax=40):
    """明るい地(白〜ごく薄い水色)のうち、外側とつながった部分だけを透かす。"""
    a = np.asarray(R[ref].crop(box)).astype(np.float32)
    light = a.min(2)                       # 白に近いほど大きい
    sat = a.max(2) - a.min(2)
    bgish = (light > 255 - thr - soft) & (sat < satmax)
    lab, _ = ndimage.label(bgish)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge)) if not holes else bgish
    dist = np.clip((255 - light - thr) / soft, 0, 1)   # 0=真っ白 1=色あり
    alpha = np.where(outside, dist, 1.0)
    alpha = ndimage.uniform_filter(alpha, 2)
    im = Image.fromarray(np.dstack([a, alpha * 255]).astype(np.uint8))
    return im.crop(im.getbbox()) if trim else im


def segs(ref, box, gap=4):
    """box の中で横に並ぶ部品ごとの範囲を返す。"""
    a = np.asarray(R[ref].crop(box)).astype(np.int16)
    col = ((a.min(2) < 225) | ((a.max(2) - a.min(2)) > 40)).any(0)
    out, s = [], None
    for x, v in enumerate(col):
        if v and s is None: s = x
        if not v and s is not None:
            if x - s > 12: out.append((box[0] + s, box[1], box[0] + x, box[3]))
            s = None
    if s is not None: out.append((box[0] + s, box[1], box[2], box[3]))
    return out


# ランク札 S〜G (ref_10)
for row, letters in (((410, 100, 935, 238), 'SABC'), ((410, 290, 935, 412), 'DEFG')):
    for k, b in zip(letters, segs(10, row)):
        save(fit(keyed(10, b), 120), f'rank-{k}')

# OVR 札(金・銀・銅) ref_10
for name, b in zip(('ovr-gold', 'ovr-silver', 'ovr-bronze'), segs(10, (520, 888, 910, 990))):
    save(fit(keyed(10, b), 120), name)

# ◎○△ ref_10 (地の薄い四角も抜く)
for name, b in zip(('apt-double', 'apt-circle', 'apt-triangle'), [(42, 905, 145, 978), (188, 905, 290, 978), (332, 905, 438, 978)]):
    save(fit(keyed(10, b, thr=20, soft=50, holes=True), 96), name)

# 下タブのアイコン ref_10
for name, b in zip(('tab-season', 'tab-team', 'tab-scout'), [(580, 728, 632, 775), (700, 728, 755, 775), (825, 728, 885, 775)]):
    save(fit(keyed(10, b), 96), name)

# ロゴ ref_01
save(fit(keyed(1, (38, 0, 340, 158), thr=40, soft=50, satmax=75), 360), 'logo')
# アプリアイコン ref_10(角丸の正方形)
save(fit(keyed(10, (22, 105, 388, 462)), 320), 'app-icon')

# パック ref_08(左の通常の演出から)・裏向きカード ref_01
save(fit(R[8].crop((95, 240, 245, 500)), 220), 'pack-scene')
save(fit(R[1].crop((743, 547, 826, 682)), 160), 'card-back')

# 覚醒の星 5段階 ref_09
for i, b in enumerate([(60, 1228, 108, 1290), (131, 1228, 178, 1290), (202, 1228, 249, 1290), (275, 1228, 322, 1290), (352, 1226, 412, 1292)], 1):
    save(fit(keyed(9, b, thr=30, soft=40, satmax=50), 80), f'awaken-{i}')

# 帽子(D・W)ref_02 — 対戦カードの絵に使う
save(fit(keyed(2, (348, 445, 450, 515)), 140), 'cap-blue')
save(fit(keyed(2, (500, 445, 600, 515)), 140), 'cap-red')

# コイン ref_10 のヘッダーにある金貨
save(fit(keyed(7, (78, 1112, 108, 1140), thr=10, soft=30), 48), 'coin')

# 背景: 晴れた昼の球場(ref_01 タイトル画面の上半分、空と球場だけ)
save(fit(R[1].crop((15, 585, 305, 712)), 600), 'bg-stadium', q=80)

# お祝いの紋章(海外挑戦権・世界一・宇宙リーグ)
save(fit(R[4].crop((335, 540, 605, 800)), 320), 'emblem-overseas')
save(fit(R[4].crop((655, 360, 925, 590)), 320), 'emblem-world')
save(fit(R[4].crop((645, 760, 930, 1105)), 320), 'emblem-space')
