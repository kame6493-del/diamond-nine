# Regenerates the iOS app icon and launch image from the shipped logo.
# App Store rejects icons with an alpha channel, so both are written as RGB.
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
logo = Image.open(root / "mobile/android/app/src/main/res/drawable-nodpi/diamond_nine_logo.png").convert("RGB")
assets = root / "mobile/ios/App/App/Assets.xcassets"

logo.resize((1024, 1024), Image.LANCZOS).save(assets / "AppIcon.appiconset/AppIcon-512@2x.png")

# Launch image: logo centred on the white background set in capacitor.config.json
splash = Image.new("RGB", (2732, 2732), (255, 255, 255))
art = logo.resize((900, 900), Image.LANCZOS)
splash.paste(art, ((2732 - 900) // 2, (2732 - 900) // 2))
for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
    splash.save(assets / "Splash.imageset" / name)

for p in [assets / "AppIcon.appiconset/AppIcon-512@2x.png", assets / "Splash.imageset/splash-2732x2732.png"]:
    im = Image.open(p)
    print(p.name, im.size, im.mode)
