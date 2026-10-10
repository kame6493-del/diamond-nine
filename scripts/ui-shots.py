# 主な画面を 390x844 で撮る(ヘッドレスの Chromium。共有 Chrome は使わない)
# 使い方: python scripts/ui-shots.py http://localhost:4341 出力フォルダ [navy|classic]
# 新しい見た目(nv-*)と以前の見た目(s-*)の両方の部品名に対応。
import sys, os
from playwright.sync_api import sync_playwright

base = sys.argv[1].rstrip('/')
out = sys.argv[2]
look = sys.argv[3] if len(sys.argv) > 3 else ''
os.makedirs(out, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='ja-JP')
    if look:
        ctx.add_init_script(f"try{{localStorage.setItem('diamond-nine-look','{look}')}}catch(e){{}}")
    page = ctx.new_page()
    page.on('pageerror', lambda e: print('PAGEERROR', e))

    def shot(name, full=False):
        page.wait_for_timeout(250)
        page.screenshot(path=os.path.join(out, name + '.png'), full_page=full)
        print('shot', name)

    def pick(*sels):
        for s in sels:
            loc = page.locator(s)
            if loc.count():
                return loc.first
        raise RuntimeError('not found: ' + ' / '.join(sels))

    def js_click(*sels):
        pick(*sels).evaluate('e=>e.click()')

    def top():
        page.evaluate('window.scrollTo(0,0)')

    def close_dialogs():
        for _ in range(4):
            d = page.locator('.simple-dialog header .s-icon, .nv-result-screen .nv-close')
            if not d.count():
                break
            d.first.evaluate('e=>e.click()'); page.wait_for_timeout(300)

    def celebration():
        if page.locator('.title-celebration').count():
            shot('10_お祝い演出')
            page.locator('.title-celebration button[aria-label="お祝い演出を閉じる"]').evaluate('e=>e.click()'); page.wait_for_timeout(400)

    complete = '.s-season-view.is-complete, .nv-season.is-complete'
    page.goto(base + '/')
    page.wait_for_timeout(1800)
    shot('01_初回ガイド_スタートスカウト')
    if page.locator('.nv-back-card').count():
        page.locator('.nv-back-card').nth(1).click(); page.wait_for_timeout(300)
        page.locator('.nv-starter').evaluate('e=>e.scrollIntoView()')
        shot('01b_スタートスカウト_選択')
        js_click('.nv-starter > .nv-gold')
    else:
        page.locator('.starter-choice').first.click()
    page.wait_for_timeout(500)
    pick('.nv-charge', '.scout-charge').evaluate('e=>e.scrollIntoView({block:"center"})')
    shot('02_スタートスカウト演出')
    page.wait_for_timeout(1000)
    shot('02b_スタートスカウト演出_後半')
    page.wait_for_timeout(5000)
    pick('.nv-result, .starter-reward').evaluate('e=>e.scrollIntoView()')
    shot('03_最初の主力')
    js_click('.starter-begin')
    page.wait_for_timeout(1200); top()
    shot('04_編成_ガイド')
    page.get_by_role('button', name='おまかせ編成して次へ').first.click()
    page.wait_for_timeout(1000); top()
    shot('05_試合タブ_ガイド')
    js_click('.beginner-tutorial .s-primary')
    page.wait_for_selector(complete, timeout=120000)
    page.wait_for_timeout(1200); top()
    shot('06_シーズン終了_ガイド')
    js_click('.beginner-tutorial .s-primary')
    page.wait_for_timeout(600); top()
    shot('07_ガイド完了')
    for btn in page.locator('.beginner-tutorial button').all():
        if 'チュートリアルを終える' in btn.inner_text():
            btn.evaluate('e=>e.click()'); break
    page.wait_for_timeout(600)
    close_dialogs()
    js_click('.s-nav button'); page.wait_for_timeout(900); top()
    shot('08_試合タブ')
    shot('08b_試合タブ_全体', full=True)
    try:
        close_dialogs()
        js_click('.nv-season-end .nv-gold', '.s-season-end .s-primary'); page.wait_for_timeout(1500)
        celebration(); close_dialogs(); top()
        shot('08c_新シーズン')
        js_click('.nv-play .nv-gold:last-child', '.s-play-actions .s-primary')
        page.wait_for_timeout(700)
        shot('08d_試合中')
        page.wait_for_selector(complete, timeout=120000)
        page.wait_for_timeout(1500)
        celebration()
        shot('11_シーズン結果')
        shot('11a_シーズン結果_全体', full=True)
        close_dialogs(); top()
        shot('11b_シーズン終了後の試合タブ')
        st = page.locator('.nv-standings, .league-stats-panel')
        if st.count():
            st.first.evaluate('e=>{if(e.tagName==="DETAILS")e.open=true;e.scrollIntoView()}'); page.wait_for_timeout(500)
            shot('09_順位表')
    except Exception as e:
        print('season flow', e)
    close_dialogs()
    page.locator('.s-nav button').nth(1).evaluate('e=>e.click()'); page.wait_for_timeout(900); top()
    shot('12_編成')
    shot('12b_編成_全体', full=True)
    if page.locator('.nv-tabs button').count():
        page.locator('.nv-tabs button').nth(1).click(); page.wait_for_timeout(500); top()
        shot('12c_編成_投手')
        page.locator('.nv-tabs button').nth(0).click(); page.wait_for_timeout(300)
        page.locator('.nv-swap').first.click(); page.wait_for_timeout(500)
        shot('12d_編成_入替')
        page.locator('.nv-sheet header button').click(); page.wait_for_timeout(300)
    try:
        js_click('[data-player-id]'); page.wait_for_timeout(800)
        shot('13_選手詳細')
        tabs = page.locator('.nv-player .nv-tabs button')
        if tabs.count() > 1:
            tabs.nth(1).click(); page.wait_for_timeout(400)
            shot('13b_選手詳細_覚醒')
            tabs.nth(3).click(); page.wait_for_timeout(300)
            shot('13c_選手詳細_特殊能力')
        else:
            page.locator('.simple-dialog').first.evaluate('e=>e.scrollTo(0,9999)'); page.wait_for_timeout(300)
            shot('13b_選手詳細_下')
        close_dialogs()
    except Exception as e:
        print('detail', e)
    try:
        js_click('.nv-team-links .nv-navy', '.catalog-open'); page.wait_for_timeout(900); top()
        shot('14_カタログ')
        page.evaluate('window.scrollTo(0,520)')
        shot('14b_カタログ_下')
    except Exception as e:
        print('catalog', e)
    page.locator('.s-nav button').nth(2).evaluate('e=>e.click()'); page.wait_for_timeout(900); top()
    shot('15_スカウト')
    shot('15b_スカウト_全体', full=True)
    try:
        js_click('.nv-draws .nv-gold', '.s-draw')
        page.wait_for_timeout(350); shot('16_スカウト演出_1')
        page.wait_for_timeout(700); shot('16_スカウト演出_2')
        page.wait_for_timeout(5500); top(); shot('17_スカウト結果')
        shot('17b_スカウト結果_全体', full=True)
    except Exception as e:
        print('scout', e)
    page.locator('button[aria-label="設定を開く"]').click(); page.wait_for_timeout(600)
    shot('18_設定')
    b.close()
