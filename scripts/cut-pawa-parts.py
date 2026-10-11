# パワプロ風の参考画像 第2弾(marketing/ui_ref_pawapuro_v2_2026-10-11/ref_01〜10.png)から使える絵を切り出し、
# 白地を透過にして public/assets/pro/pawa/ に webp で置く。
# 人の絵(参考画像のカードやスカウト画面の選手)・実在の球団名やロゴ風の物は切り出さない。
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'marketing', 'ui_ref_pawapuro_v2_2026-10-11')
OUT = os.path.join(ROOT, 'public', 'assets', 'pro', 'pawa')
os.makedirs(OUT, exist_ok=True)
R = {i: Image.open(os.path.join(SRC, f'ref_{i:02d}.png')).convert('RGB') for i in range(1, 11)}


def save(im, name, q=90):
    path = os.path.join(OUT, name + '.webp')
    im.save(path, 'WEBP', quality=q, method=6)
    print(f'{name}.webp {im.size[0]}x{im.size[1]} {os.path.getsize(path)//1024}KB')


def fit(im, w):
    return im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def keyed(ref, box, light=215, satmax=45, trim=True):
    """白〜ごく薄い色の地のうち、外側とつながった部分だけを透かす(縁は少しぼかす)。"""
    a = np.asarray(R[ref].crop(box)).astype(np.float32)
    lo, sat = a.min(2), a.max(2) - a.min(2)
    bgish = (lo > light) & (sat < satmax)
    lab, _ = ndimage.label(bgish)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge))
    outside = ndimage.binary_dilation(outside, iterations=1) & (lo > light - 40)
    alpha = np.where(outside, 0.0, 1.0)
    alpha = ndimage.gaussian_filter(alpha, 0.7)
    im = Image.fromarray(np.dstack([a, alpha * 255]).astype(np.uint8))
    return im.crop(im.getbbox()) if trim else im


def sky_keyed(ref, box):
    """空・雲・球場の写真の上にあるロゴを抜く。紺の太い縁の外側を外側からの塗りつぶしで透かす。"""
    a = np.asarray(R[ref].crop(box)).astype(np.float32)
    lum = a.mean(2)
    navy = (a[..., 2] > a[..., 0] + 30) & (lum < 95)          # ロゴの縁取り
    lab, _ = ndimage.label(~navy)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge))
    alpha = ndimage.gaussian_filter(np.where(outside, 0.0, 1.0), 0.8)
    im = Image.fromarray(np.dstack([a, alpha * 255]).astype(np.uint8))
    return im.crop(im.getbbox())


def tiles(ref, y0, y1, xs):
    return [(x0, y0, x1, y1) for x0, x1 in xs]


# ロゴ(DIAMOND NINE ダイヤモンドナイン)ref_02 の左上
logo = R[2].crop((40, 0, 588, 126)).convert('RGBA')
w, h = logo.size
yy, xx = np.mgrid[0:h, 0:w]
edge = np.minimum.reduce([xx, w - 1 - xx, yy * 3, (h - 1 - yy) * 3]).astype(np.float32)
logo.putalpha(Image.fromarray((np.clip(edge / 18, 0, 1) * 255).astype(np.uint8)))
save(fit(logo, 520), 'logo')  # 空の写真ごと切り、縁をぼかして空色のヘッダーに馴染ませる
# アプリアイコン ref_10
save(fit(keyed(10, (28, 192, 248, 418)), 300), 'app-icon')

# 能力ランク S〜G ref_10(パワプロ風の色の角丸の札)
xs = [(30, 105), (113, 188), (196, 271), (279, 354), (362, 437), (445, 520), (528, 603), (611, 686)]
for k, b in zip('SABCDEFG', tiles(10, 682, 752, xs)):
    save(fit(keyed(10, b), 96), f'rank-{k}')

# 適性 ◎○△ ref_10
for name, b in zip(('apt-double', 'apt-circle', 'apt-triangle'), [(757, 838, 812, 895), (812, 838, 867, 895), (867, 838, 924, 895)]):
    save(fit(keyed(10, b), 80), name)

# 下のタブのアイコン(試合・成績=バット、チーム=帽子、スカウト=巻物、メニュー=歯車)ref_07 / ref_10
save(fit(keyed(7, (52, 275, 100, 318)), 96), 'tab-season')
save(fit(keyed(7, (155, 275, 210, 318)), 96), 'tab-team')
save(fit(keyed(10, (733, 205, 785, 258)), 96), 'tab-scout')
save(fit(keyed(10, (843, 208, 895, 258)), 96), 'tab-menu')

# 覚醒5段階のバッジ ref_09
for i, (x0, x1) in enumerate([(30, 98), (120, 188), (210, 278), (300, 368), (388, 462)], 1):
    save(fit(keyed(9, (x0, 1027, x1, 1093)), 96), f'awaken-{i}')

# OVR の盾は数字が焼き込まれているため切り出さず、SVG で描く(src/pro/pawa/PawaCard.tsx の OvrShield)

# スタートスカウトの裏向きカード ref_01
save(fit(R[1].crop((93, 862, 239, 1049)), 200), 'card-back')

# スカウトのパック(通常・金・虹)ref_08
for name, b in zip(('pack-normal', 'pack-gold', 'pack-rainbow'), [(100, 335, 240, 588), (405, 335, 545, 588), (708, 335, 848, 588)]):
    save(fit(R[8].crop(b), 220), name)

# シーズン終了: トロフィー・ホームラン王 ref_04
save(fit(keyed(4, (30, 185, 215, 420), light=200, satmax=60), 240), 'trophy')
save(fit(keyed(4, (30, 755, 235, 955)), 240), 'hr-king')
# お祝い・達成の絵(海外挑戦権・世界一・宇宙リーグ)ref_04 下段。文字の帯は入れない
save(fit(R[4].crop((28, 1250, 312, 1440)), 340), 'emblem-overseas')
save(fit(R[4].crop((333, 1250, 612, 1440)), 340), 'emblem-world')
save(fit(R[4].crop((633, 1250, 917, 1440)), 340), 'emblem-space')

# コイン ref_02
save(fit(keyed(2, (750, 95, 800, 140)), 48), 'coin')

# 背景の球場(bg-stadium.webp)は第1弾の参考画像から切り出した物をそのまま使う
