"""Android launch assets from the ChatGPT art (2026-10-26). Run from mobile/:  python scripts-make-launch-assets.py
- splash_icon.png: Android 12+ splash icon, 288dp canvas, emblem inside the central 192dp circle
- ic_launcher_foreground.png (adaptive, 108dp): emblem inside the 66dp safe circle
- ic_launcher.png / ic_launcher_round.png (legacy): emblem on the navy disc / rounded square
- splash.png (legacy theme drawables): navy loading art with the emblem
- launch/launch-logo.webp: the emblem for the web loading screen
"""
import math, os
from PIL import Image, ImageDraw

SRC = 'store-assets/launch-gpt-2026-10-26'
RES = 'android/app/src/main/res'
NAVY = (10, 42, 102, 255)
emb = Image.open(f'{SRC}/d9_emblem_gpt.png').convert('RGBA')
bg_art = Image.open(f'{SRC}/d9_launch_bg_gpt.png').convert('RGB')

# tight crop + the radius of the farthest visible pixel from the crop centre
A = emb.getchannel('A').point(lambda v: 255 if v > 24 else 0)
emb = emb.crop(A.getbbox()); A = A.crop(A.getbbox())
w, h = emb.size; cx, cy = w / 2, h / 2
px = A.load(); r = 0.0
for y in range(0, h, 2):
    for x in range(0, w, 2):
        if px[x, y]: r = max(r, math.hypot(x - cx, y - cy))
print('emblem', emb.size, 'radius', round(r))

def place(canvas_px, safe_radius_px, bg=None):
    s = safe_radius_px / r
    e = emb.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    c = Image.new('RGBA', (canvas_px, canvas_px), bg or (0, 0, 0, 0))
    c.alpha_composite(e, (round(canvas_px / 2 - e.size[0] / 2), round(canvas_px / 2 - e.size[1] / 2)))
    return c

dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
# splash icon: one big nodpi bitmap is scaled by the system into the 288dp slot
place(1152, 768 / 2 * 0.96).save(f'{RES}/drawable-nodpi/splash_icon.png', optimize=True)
for d, k in dens.items():
    os.makedirs(f'{RES}/mipmap-{d}', exist_ok=True)
    fg = round(108 * k)
    place(fg, 66 / 2 * k * 0.97).save(f'{RES}/mipmap-{d}/ic_launcher_foreground.png', optimize=True)
    n = round(48 * k)
    # legacy square icon (rounded) and round icon: navy base, emblem within
    sq = Image.new('RGBA', (n, n), (0, 0, 0, 0)); m = Image.new('L', (n, n), 0)
    ImageDraw.Draw(m).rounded_rectangle((round(n * .04), round(n * .04), n - round(n * .04), n - round(n * .04)), radius=round(n * .18), fill=255)
    base = Image.new('RGBA', (n, n), NAVY); base.putalpha(m); sq.alpha_composite(base)
    sq.alpha_composite(place(n, n * .44)); sq.save(f'{RES}/mipmap-{d}/ic_launcher.png', optimize=True)
    rd = Image.new('RGBA', (n, n), (0, 0, 0, 0)); m = Image.new('L', (n, n), 0)
    ImageDraw.Draw(m).ellipse((round(n * .03), round(n * .03), n - round(n * .03), n - round(n * .03)), fill=255)
    base = Image.new('RGBA', (n, n), NAVY); base.putalpha(m); rd.alpha_composite(base)
    rd.alpha_composite(place(n, n * .44)); rd.save(f'{RES}/mipmap-{d}/ic_launcher_round.png', optimize=True)

# legacy splash.png (port/land): art cover-cropped, emblem centred
def cover(img, W, H):
    s = max(W / img.size[0], H / img.size[1]); im = img.resize((math.ceil(img.size[0] * s), math.ceil(img.size[1] * s)), Image.LANCZOS)
    x, y = (im.size[0] - W) // 2, (im.size[1] - H) // 2
    return im.crop((x, y, x + W, y + H))
for root, dirs, files in os.walk(RES):
    for f in files:
        if f == 'splash.png':
            p = os.path.join(root, f); W, H = Image.open(p).size
            im = cover(bg_art, W, H).convert('RGBA')
            e = place(round(min(W, H) * .62), min(W, H) * .62 / 2)
            im.alpha_composite(e, ((W - e.size[0]) // 2, round(H * .4 - e.size[1] / 2)))
            im.convert('RGB').save(p, optimize=True)

os.makedirs('launch', exist_ok=True)
place(720, 352).save('launch/launch-logo.webp', quality=90, method=6)
print('ok')
