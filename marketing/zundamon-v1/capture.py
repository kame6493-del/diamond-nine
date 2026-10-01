# zundamon-v1 capture (copied from promo-v8/capture.py): records real gameplay as timestamped frames via the Chrome DevTools
# screencast (1080x1920 device pixels). Based on marketing/promo-vertical/capture.py.
# The page clock is set inside the draft-week event (2026-10-23) before the page loads.
import base64, datetime, json, shutil, time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent / "clips"  # large; deleted after rendering
URL = "http://127.0.0.1:4297/"  # DIAMOND_NINE_PORT=4297 node scripts/serve-game.mjs
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
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True)
        t0 = self.frames[0][0] if self.frames else 0
        index = []
        for i, (t, data) in enumerate(self.frames):
            f = d / f"{i:05d}.jpg"
            f.write_bytes(base64.b64decode(data))
            index.append({"t": round(t - t0, 4), "f": f.name})
        (d / "index.json").write_text(json.dumps(index))
        print(name, len(index), "frames", round(index[-1]["t"], 2) if index else 0, "s", flush=True)

SAVE_KEY_JS = "Object.keys(localStorage).find(k=>{try{const v=JSON.parse(localStorage.getItem(k));return v&&typeof v.gems==='number'&&v.season}catch(e){return false}})"
SET_GEMS_JS = "([k,g])=>{const s=JSON.parse(localStorage.getItem(k));s.gems=g;localStorage.setItem(k,JSON.stringify(s));}"
SCOUT_JS = r"""() => {
  const t = document.body.innerText;
  const i = t.indexOf('新しい選手が加入');
  const j = t.indexOf('現在の選手');
  if (i < 0) return null;
  const grab = s => { const m = s.match(/総合\s*(\d+)/); return m ? +m[1] : null; };
  return {newOv: grab(t.slice(i, j < 0 ? i + 400 : j)), curOv: j < 0 ? null : grab(t.slice(j, j + 400)), hasSwap: t.includes('この選手と入れ替える')};
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=DPR, is_mobile=True, has_touch=True, locale="ja-JP")
    ctx.add_init_script("try{localStorage.setItem('diamond-nine-tester-banner-closed','1');localStorage.setItem('diamond-nine-tutorial-v1-career','done')}catch(e){}")
    page = ctx.new_page()
    page.clock.install(time=datetime.datetime(2026, 10, 23, 12, 0, 0))
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_timeout(2500)
    rec = Recorder(page)
    hold = lambda ms: page.wait_for_timeout(ms)
    click = lambda sel: page.locator(sel).first.click(timeout=8000)
    nav = lambda label: page.locator(".s-nav button", has_text=label).first.click(timeout=8000)
    top = lambda: page.evaluate("window.scrollTo(0,0)")
    # eased scroll driven by requestAnimationFrame, so the screencast gets a steady stream of frames
    def smooth_to(js_el, block="start", ms=1400):
        page.evaluate("""([sel, block, ms]) => new Promise(done => {
          const e = eval(sel); if (!e) return done();
          const r = e.getBoundingClientRect();
          const off = block === 'center' ? (innerHeight - r.height) / 2 : 70;
          const y0 = scrollY, y1 = Math.max(0, y0 + r.top - off), t0 = performance.now();
          const step = now => { const k = Math.min(1, (now - t0) / ms); const q = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2;
            scrollTo(0, y0 + (y1 - y0) * q); k < 1 ? requestAnimationFrame(step) : done(); };
          requestAnimationFrame(step);
        })""", [js_el, block, ms])

    # 0. Title area -> starter scout section
    top(); hold(400)
    rec.start(); hold(1500)
    page.evaluate("""() => new Promise(done => { const y0 = scrollY, y1 = 420, t0 = performance.now();
      const step = now => { const k = Math.min(1, (now - t0) / 1800); const q = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2;
        scrollTo(0, y0 + (y1 - y0) * q); k < 1 ? requestAnimationFrame(step) : done(); }; requestAnimationFrame(step); })""")
    hold(1500)
    rec.stop("00-title")

    # 1. Starter scout: pick one of three cards
    page.evaluate("window.scrollTo(0, 420)")
    hold(600)
    rec.start(); hold(700)
    click('button:has-text("02")')
    hold(3000)
    smooth_to("[...document.querySelectorAll('*')].find(e=>e.children.length===0&&e.textContent.trim()==='選手獲得！')", "start", 1000)
    hold(1200)
    rec.stop("01-pull")
    click('button:has-text("チームに入れて開幕する")'); hold(1500)

    # Off camera: strengthen the roster with scouts so the season is not a 25-win farce
    key = page.evaluate(SAVE_KEY_JS)
    page.evaluate(SET_GEMS_JS, [key, 300000])
    page.reload(); hold(2500)
    nav("スカウト"); hold(800)
    for i in range(95):
        page.locator("button", has_text="引く").first.click(timeout=8000)
        hold(300)
        sk = page.locator("button", has_text="演出をスキップ")
        if sk.count():
            try: sk.first.click(timeout=1500)
            except Exception: pass
        hold(900)
        r = page.evaluate(SCOUT_JS)
        if r and r["hasSwap"] and r["newOv"] and r["curOv"] and r["newOv"] > r["curOv"]:
            page.locator("button", has_text="この選手と入れ替える").first.click(); hold(500)
    # leave a believable point balance on screen
    page.evaluate(SET_GEMS_JS, [key, 12000])
    page.reload(); hold(2500)

    # 2. Lineup: auto-arrange
    nav("チーム"); hold(800)
    top(); hold(500)
    rec.start(); hold(900)
    click('button:has-text("おまかせ編成")')
    hold(1500)
    page.evaluate("window.scrollBy({top:420,behavior:'smooth'})"); hold(2500)
    rec.stop("02-lineup")
    click('button:has-text("試合へ進む")'); hold(1500)
    top(); hold(400)

    # 3. Simulate a whole season with one tap
    rec.start(); hold(700)
    click('button:has-text("シーズン終了まで")')
    hold(6500)
    rec.stop("03-season")
    top(); hold(400)

    # 4. Rank and team stats
    rec.start(); hold(1200)
    smooth_to("[...document.querySelectorAll('*')].find(e=>e.children.length===0&&e.textContent.trim()==='チーム全体成績')", "center", 2400)
    hold(2500)
    rec.stop("04-stats")

    # 6. Season record share (captured now, shown after the scout scene)
    page.evaluate("(()=>{const e=document.querySelector('.victory-share');if(e)e.scrollIntoView({block:'center'})})()")
    hold(600)
    page.evaluate("window.scrollBy(0,-360)"); hold(300)
    rec.start(); hold(500)
    smooth_to("document.querySelector('.victory-share')", "center", 1600)
    hold(2500)
    rec.stop("06-share")
    share_title = page.evaluate("document.querySelector('.victory-share h2')?.innerText")

    # 5. Draft-week banner -> one pull -> new share button. Retry until a gold/rainbow card.
    key = page.evaluate(SAVE_KEY_JS)
    label = ""
    for attempt in range(25):
        page.evaluate(SET_GEMS_JS, [key, 15000 + 3000 * 0])
        page.reload(); hold(2200)
        nav("スカウト"); hold(700)
        top(); hold(300)
        rec.start(); hold(1300)
        click('button:has-text("1人引く")')
        hold(3600)
        smooth_to("document.querySelector('.scout-share-button')", "center", 1000)
        hold(3000)
        btn = page.locator(".scout-share-button")
        label = btn.first.inner_text() if btn.count() else ""
        if "当たり" in label or attempt == 24:
            rec.stop("05-scout")
            break
        rec.on = False
        rec.cdp.send("Page.stopScreencast")
    page.screenshot(path=str(OUT / "after-scout.png"))

    # 7. Draft-week banner on the scout tab, held on screen
    nav("チーム"); hold(800)
    top(); hold(300)
    rec.start(); hold(400)
    nav("スカウト"); hold(800)
    top(); hold(4500)
    rec.stop("07-draft")
    (OUT / "meta.json").write_text(json.dumps({"share_title": share_title, "scout_label": label, "attempts": attempt + 1, "errors": errors}, ensure_ascii=False), encoding="utf-8")
    print("share:", share_title, "scout:", label, "attempts:", attempt + 1, "errors:", errors)
    b.close()
    if share_title != "優勝の記録をシェア":
        raise SystemExit(3)
