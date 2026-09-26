# Records real gameplay as timestamped frames via the Chrome DevTools screencast,
# which delivers device-pixel frames (1080x1920) instead of Playwright's 1x video.
import base64, json, time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent / "clips"  # large; kept out of git
URL = "http://127.0.0.1:4293/"  # serve mobile/www on this port first
W, H, DPR = 432, 768, 2.5  # 1080x1920 frames

class Recorder:
    def __init__(self, page):
        self.cdp = page.context.new_cdp_session(page)
        self.frames = []
        self.on = False
        self.cdp.on("Page.screencastFrame", self._frame)

    def _frame(self, ev):
        self.cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
        if self.on:
            self.frames.append((time.perf_counter(), ev["data"]))

    def start(self):
        self.frames = []
        self.on = True
        self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": 1080, "maxHeight": 1920, "everyNthFrame": 1})

    def stop(self, name):
        self.on = False
        self.cdp.send("Page.stopScreencast")
        d = OUT / name
        d.mkdir(parents=True, exist_ok=True)
        t0 = self.frames[0][0] if self.frames else 0
        index = []
        for i, (t, data) in enumerate(self.frames):
            f = d / f"{i:05d}.jpg"
            f.write_bytes(base64.b64decode(data))
            index.append({"t": round(t - t0, 4), "f": f.name})
        (d / "index.json").write_text(json.dumps(index))
        print(name, len(index), "frames", round(index[-1]["t"], 2) if index else 0, "s")

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=DPR, is_mobile=True, has_touch=True, locale="ja-JP")
    page = ctx.new_page()
    page.goto(URL)
    page.wait_for_timeout(2500)
    rec = Recorder(page)
    hold = lambda ms: page.wait_for_timeout(ms)
    click = lambda sel: page.locator(sel).first.click(timeout=8000)

    # 1. First card pull (the free starter pick)
    page.evaluate("window.scrollTo(0, 420)")
    hold(500)
    rec.start(); hold(600)
    click('button:has-text("02")')
    hold(3200)
    page.get_by_text("驕ｸ謇狗佐蠕・).first.evaluate("e=>e.scrollIntoView({behavior:'smooth',block:'start'})")
    hold(1800)
    rec.stop("01-pull")

    click('button:has-text("繝√・繝縺ｫ蜈･繧後※髢句ｹ輔☆繧・)'); hold(1500)

    # 2. Lineup: auto-arrange and scroll through the batting order
    page.evaluate("window.scrollTo(0,0)"); hold(400)
    rec.start(); hold(500)
    click('button:has-text("縺翫∪縺九○邱ｨ謌舌＠縺ｦ谺｡縺ｸ")') if False else None
    page.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('縺翫∪縺九○邱ｨ謌・)&&!b.innerText.includes('谺｡縺ｸ'))?.scrollIntoView({block:'start'})"); hold(700)
    page.evaluate("window.scrollBy({top:380,behavior:'smooth'})"); hold(1400)
    page.evaluate("window.scrollBy({top:420,behavior:'smooth'})"); hold(1400)
    rec.stop("02-lineup")

    click('button:has-text("縺翫∪縺九○邱ｨ謌舌＠縺ｦ谺｡縺ｸ")'); hold(1500)
    page.evaluate("window.scrollTo(0,0)"); hold(300)

    # 3. Simulate a whole season
    rec.start(); hold(500)
    click('button:has-text("繧ｷ繝ｼ繧ｺ繝ｳ邨ゆｺ・∪縺ｧ")')
    hold(6500)
    rec.stop("03-season")
    try:
        click('button:has-text("繝√Η繝ｼ繝医Μ繧｢繝ｫ繧堤ｵゅ∴繧・)'); hold(800)
    except Exception:
        pass

    # 4. Results and batting stats
    page.evaluate("window.scrollTo(0,0)"); hold(400)
    rec.start(); hold(900)
    page.evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('謇捺茶謌千ｸｾ')).scrollIntoView({behavior:'smooth',block:'start'})"); hold(1600)
    page.evaluate("window.scrollBy({top:-170,behavior:'smooth'})"); hold(1800)
    rec.stop("04-stats")

    # 5. Scout with the points earned this season
    page.evaluate("window.scrollTo(0,0)"); hold(300)
    click('button:has-text("繧ｹ繧ｫ繧ｦ繝・)'); hold(1200)
    rec.start(); hold(700)
    click('button:has-text("1莠ｺ蠑輔￥")')
    hold(5000)
    rec.stop("05-scout")
    page.screenshot(path=str(OUT / "after-scout.png"))
    b.close()
