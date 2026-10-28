# test-pack-fit.mjs から呼ぶ。各幅・文字倍率で、パックの行の文字が枠からはみ出していないかを見る。
import sys, os
from pathlib import Path
from playwright.sync_api import sync_playwright

tmp = Path(sys.argv[1])
WIDTHS = [(320, 568), (360, 640), (393, 852), (412, 915)]
ZOOMS = [1.0, 1.3]
CHECK = """(zoom)=>{
 for(const el of document.querySelectorAll('.pack-shop *')){const s=parseFloat(getComputedStyle(el).fontSize);el.style.fontSize=(s*zoom)+'px';}
 const bad=[];
 for(const li of document.querySelectorAll('.pack-list li')){
  const row=li.getBoundingClientRect(),buy=li.querySelector('.pack-buy').getBoundingClientRect();
  for(const el of li.querySelectorAll('.pack-pt,.pack-info em,.pack-info small,.pack-info small i,.pack-buy')){
   const rg=document.createRange();rg.selectNodeContents(el);const t=rg.getBoundingClientRect();
   const cell=(el.parentElement.closest('.pack-info,.pack-pt,.pack-buy')||li).getBoundingClientRect();
   const limit=el.classList.contains('pack-buy')||el.closest('.pack-buy')?row.right:Math.min(cell.right,buy.left);
   if(t.right>limit+0.5||t.left<row.left-0.5||t.bottom>row.bottom+0.5)bad.push(el.textContent.trim()+' right='+Math.round(t.right)+' limit='+Math.round(limit));
  }
  if(row.right>document.documentElement.clientWidth+0.5)bad.push('row wider than screen');
 }
 return bad;}"""

fails = 0
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    for look in ('pawa', 'classic'):
        url = (tmp / f'pack-fit-{look}.html').as_uri()
        for (w, h) in WIDTHS:
            for z in ZOOMS:
                pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
                pg.goto(url)
                bad = pg.evaluate(CHECK, z)
                pcts = pg.evaluate("[...document.querySelectorAll('.pack-info small i')].length")
                if bad or pcts < 5:
                    fails += 1
                    print(f'NG {look} {w}x{h} x{z}: {bad[:4]} pct={pcts}')
                pg.close()
    b.close()
print('pack fit:', 'ALL PASS' if not fails else f'{fails} NG', f'({2*len(WIDTHS)*len(ZOOMS)} cases)')
sys.exit(1 if fails else 0)
