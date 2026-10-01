# Store screenshots v1.1 - step 1: capture real gameplay screens.
# Serve the production build first:
#   DIAMOND_NINE_PORT=4298 node scripts/serve-game.mjs
# Then: python capture.py            (writes ./_shots, deleted by make_store_images.py --clean)
#
# Every scene is shot twice from the same game state: once at 390x740 CSS px (Google Play
# phone frame) and once at 390x844 (App Store 6.7" frame), both at device scale 3.
# The page clock is fixed inside the draft week (2026-10-23) so the event banner shows.
import datetime, json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE / "_shots"
OUT.mkdir(exist_ok=True)
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
URL = ARGS[0] if ARGS else "http://127.0.0.1:4298/"
STARTER_ONLY = "--starter-only" in sys.argv  # re-shoot just scene 1 (it does not depend on the others)
W, DPR = 390, 3
SIZES = {"gp": 740, "ios": 844}

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
# leaf element whose trimmed text equals the given string
LEAF = "(t=>[...document.querySelectorAll('body *')].find(e=>e.children.length===0&&e.textContent.trim()===t))"

meta = {"errors": []}

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": W, "height": SIZES["ios"]}, device_scale_factor=DPR, is_mobile=True, has_touch=True, locale="ja-JP", accept_downloads=True)
    ctx.add_init_script("try{localStorage.setItem('diamond-nine-tester-banner-closed','1');localStorage.setItem('diamond-nine-tutorial-v1-career','done')}catch(e){}")
    page = ctx.new_page()
    page.clock.install(time=datetime.datetime(2026, 10, 23, 12, 0, 0))
    page.on("pageerror", lambda e: meta["errors"].append(str(e)))
    hold = lambda ms: page.wait_for_timeout(ms)
    click = lambda sel: page.locator(sel).first.click(timeout=8000)
    nav = lambda label: page.locator(".s-nav button", has_text=label).first.click(timeout=8000)

    def shoot(name, anchor_js=None, top=0, settle=700, per_size=None):
        """Screenshot the viewport at both sizes. anchor_js is a JS expression for an
        element to place `top` CSS px below the viewport's top edge (None = page top).
        per_size maps a size tag to its own (anchor_js, top) when one framing does not fit both."""
        for tag, h in SIZES.items():
            page.set_viewport_size({"width": W, "height": h})
            hold(250)
            anchor_js, top = (per_size or {}).get(tag, (anchor_js, top))
            if anchor_js:
                page.evaluate(f"""(() => {{ const e = {anchor_js}; if (!e) {{ scrollTo(0,0); return; }}
                    const r = e.getBoundingClientRect(); scrollTo(0, Math.max(0, scrollY + r.top - {top})); }})()""")
            else:
                page.evaluate("scrollTo(0,0)")
            hold(settle)
            page.screenshot(path=str(OUT / f"{name}-{tag}.png"))
        page.screenshot(path=str(OUT / f"{name}-full.png"), full_page=True)

    page.goto(URL)
    hold(2500)

    # 1. Starter scout: pick a card, show the 85+ player
    page.evaluate("window.scrollTo(0, 420)"); hold(500)
    click('button:has-text("02")')
    hold(4500)
    body = page.inner_text("body")
    import re
    m = re.search(r"総合\s*(\d+)", body[body.find("選手獲得"):] if "選手獲得" in body else "")
    meta["starter_ov"] = int(m.group(1)) if m else None
    # the footer link row would be cut by the bottom edge; hide it without changing layout height
    page.add_style_tag(content=".s-footer{visibility:hidden}")
    # the taller iOS frame hits the end of the page, so it starts higher: from the team-name field
    shoot("1-starter", LEAF + "('選手獲得！')", 64, settle=1200,
          per_size={"ios": ("document.evaluate(\"//*[normalize-space(text())='チーム名']\", document, null, 9, null).singleNodeValue", 56)})
    if STARTER_ONLY:
        print("starter only:", meta)
        b.close()
        raise SystemExit(0)
    page.evaluate("document.querySelectorAll('style').forEach(s=>{if(s.textContent.includes('.s-footer{visibility:hidden}'))s.remove()})")
    click('button:has-text("チームに入れて開幕する")'); hold(1500)

    # Off camera: strengthen the roster so the season ends with a title and believable stats.
    # Repeat rounds of pulls until the auto-arranged lineup averages 78+.
    def team_ovr():
        nav("チーム"); hold(800)
        page.evaluate("scrollTo(0,0)")
        click('button:has-text("おまかせ編成")'); hold(1200)
        m = re.search(r"チーム総合\s*(\d+)", page.inner_text("body"))
        return int(m.group(1)) if m else 0
    key = page.evaluate(SAVE_KEY_JS)
    ovr = 0
    for rnd in range(5):
        page.evaluate(SET_GEMS_JS, [key, 400000])
        page.reload(); hold(2500)
        nav("スカウト"); hold(800)
        for i in range(110):
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
        ovr = team_ovr()
        print("reinforce round", rnd + 1, "team ovr", ovr, flush=True)
        if ovr >= 78:
            break
    meta["team_ovr"] = ovr
    page.evaluate(SET_GEMS_JS, [key, 12000])
    page.reload(); hold(2500)

    # 2. Lineup after auto-arrange
    nav("チーム"); hold(800)
    page.evaluate("scrollTo(0,0)")
    click('button:has-text("おまかせ編成")'); hold(5000)  # wait for the toast to go away
    shoot("2-lineup", "document.querySelector('.s-nav')", 0)  # nav stuck at the top, app header fully off screen
    click('button:has-text("試合へ進む")'); hold(1500)
    page.evaluate("scrollTo(0,0)"); hold(400)

    # 3 + 6. Simulate seasons until a title
    title = None
    for season in range(5):
        click('button:has-text("シーズン終了まで")')
        hold(7000)
        page.evaluate("scrollTo(0,0)"); hold(600)
        title = page.evaluate("document.querySelector('.victory-share h2')?.innerText")
        body = page.inner_text("body")
        meta.setdefault("seasons", []).append({"title": title, "first": "1位" in body})
        if title == "優勝の記録をシェア":
            break
        click('button:has-text("次のシーズンへ")'); hold(2000)
        page.evaluate("scrollTo(0,0)"); hold(400)
    meta["share_title"] = title
    shoot("3-season", None, 0, settle=900)
    # open the image preview inside the share box
    page.evaluate("(()=>{const d=document.querySelector('.victory-share-preview');if(d)d.open=true})()")
    page.wait_for_selector(".victory-share-image img", timeout=15000)
    hold(1200)
    shoot("6-share", "document.querySelector('.victory-share')", 60, settle=900)
    # also keep the generated keepsake image itself
    data_url = page.evaluate("""async () => { const img = document.querySelector('.victory-share-image img');
        const blob = await (await fetch(img.src)).blob();
        return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); }""")
    import base64
    (OUT / "6-keepsake.png").write_bytes(base64.b64decode(data_url.split(",", 1)[1]))

    # 5. Draft-week banner on the scout tab
    key = page.evaluate(SAVE_KEY_JS)
    page.evaluate(SET_GEMS_JS, [key, 15000])
    page.reload(); hold(2500)
    nav("スカウト"); hold(900)
    shoot("5-draft", None, 0, settle=900)

    # 4. Gold / rainbow pull with the share button; retry until one comes out
    label = ""
    for attempt in range(150):
        page.evaluate(SET_GEMS_JS, [key, 15000])
        page.reload(); hold(2200)
        nav("スカウト"); hold(700)
        page.evaluate("scrollTo(0,0)")
        click('button:has-text("1人引く")')
        hold(4200)
        btn = page.locator(".scout-share-button")
        label = btn.first.inner_text() if btn.count() else ""
        r = page.evaluate(SCOUT_JS)
        new_ov = (r or {}).get("newOv") or 0
        # a gold/rainbow label alone can be a 70s card; hold out for one that reads as a hit
        if ("当たり" in label or "虹" in label) and new_ov >= 85:
            meta["scout_ov"] = new_ov
            break
    meta["scout_label"] = label
    meta["scout_attempts"] = attempt + 1
    hold(1500)
    shoot("4-scout", "document.querySelector('.draft-week-banner')?.nextElementSibling", 56, settle=1500)  # result box right under the sticky nav

    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False))
    b.close()
