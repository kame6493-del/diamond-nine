// ポイント購入の見切れ試験(2026-10-28)。「+60%おトク」が購入ボタンの下に隠れていた。
// 本物の PackShop をアプリと同じ値段の表示で描き、組み上がった dist/assets/game.css を当てて、
// 320〜412 の各幅・文字 1.0/1.3 倍で、文字の右端が自分の枠と購入ボタンの手前に収まるかを見る。
// 先に npm run build(dist/ を作る)。ブラウザは headless Edge(Python の playwright)。
// Run: node scripts/test-pack-fit.mjs
import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const tmp=resolve('node_modules/.tmp');
await mkdir(tmp,{recursive:true});
const entry=resolve(tmp,'pack-fit-entry.tsx');
await writeFile(entry,`
const prices={pt_first_30000:'￥480',pt_pack_3000:'￥160',pt_pack_10000:'￥480',pt_pack_21000:'￥980',pt_pack_69000:'￥3,000',pt_pack_126000:'￥5,000',pt_pack_300000:'￥10,000'};
const snap={premium:{status:'ready',owned:false,verified:true,price:'￥480',busy:false,message:''},reward:{available:true,busy:false,left:3,limit:3,points:3000},privacyOptions:false,packs:{status:'ready',prices,busy:false,message:''}};
(globalThis as any).window={diamondMonetize:{snapshot:()=>snap,subscribe:()=>()=>{}}};
const {renderToStaticMarkup}=await import('react-dom/server');
const {createElement}=await import('react');
const {PackShop}=await import(${JSON.stringify(resolve('src/pro/PackShop.tsx'))});
export const html=renderToStaticMarkup(createElement(PackShop));
`);
const out=resolve(tmp,'pack-fit-entry.mjs');
await build({entryPoints:[entry],outfile:out,bundle:true,packages:'external',jsx:'automatic',platform:'node',format:'esm',logLevel:'silent',loader:{'.css':'empty'}});
const {html}=await import('file:///'+out.replace(/\\/g,'/'));
const css=await readFile('dist/assets/game.css','utf8');
const page=(look)=>`<!doctype html><html lang="ja" data-look="${look}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div class="${look==='pawa'?'simple-app nv-app':'simple-app'}"><div class="pw-modal pw-sheet-modal"><div class="pw-sheet pw-shop-sheet">${html}</div></div></div></body></html>`;
for(const look of ['pawa','classic'])await writeFile(resolve(tmp,`pack-fit-${look}.html`),page(look));
if(!html.includes('%おトク'))throw new Error('PackShop did not render the bonus percent');
execFileSync('python',['-I',resolve('scripts/test-pack-fit.py'),tmp],{stdio:'inherit'});
