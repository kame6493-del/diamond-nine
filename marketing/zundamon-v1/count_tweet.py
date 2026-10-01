# Weighted length per X rules: URLs count 23, chars in the light ranges count 1, others 2.
import re, sys
from pathlib import Path
s = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name("tweet.txt")).read_text(encoding="utf-8").rstrip("\n")
LIGHT = [(0, 4351), (8192, 8205), (8208, 8223), (8242, 8247)]
urls = re.findall(r"https?://\S+", s)
body = re.sub(r"https?://\S+", "", s)
n = 23 * len(urls)
for ch in body:
    c = ord(ch)
    n += 1 if any(a <= c <= b for a, b in LIGHT) else 2
print(n)
