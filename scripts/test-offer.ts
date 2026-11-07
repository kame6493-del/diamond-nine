// 11/7 夜(持ち主「とりあえず速く売りたい。収益上げたい」)の購入の案内の試験。
// 欲しくなる場面で出す・同じ場面で何度も出さない・はじめてのパックの残り時間は本物・値段はストアの文字だけ。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUTO_MOMENTS,FIRST_PACK_WINDOW_MS,OFFER_DAILY_AUTO,OFFER_GAP_MS,OFFER_MIN_PULLS,emptyOfferLog,expectedCount,firstPackWindow,formatLeft,noteOffer,offerDue,parseOfferLog} from '../src/pro/offer-moments';
import {SCOUT_BANDS} from '../src/pro/simple-game';
import {firstPack,packDraws} from '../src/pro/point-products';

export function registerOfferTests(test:(name:string,run:()=>void)=>void){
 const t0=new Date(2026,10,7,21,0,0).getTime();
 test('offer (11/7): pressing scout without points always opens it; automatic moments wait for 5 pulls, 30 minutes, 2 a day and once per moment per day',()=>{
  const log=emptyOfferLog();
  assert.deepEqual([...AUTO_MOMENTS],['loss','season']);
  assert.equal(offerDue(log,'short',t0,0),true,'本人が押した時はいつでも');
  assert.equal(offerDue(log,'hit',t0,0),true);
  assert.equal(offerDue(log,'season',t0,OFFER_MIN_PULLS-1),false,'スカウトを5回引くまでは自動で出さない');
  assert.equal(offerDue(log,'season',t0,OFFER_MIN_PULLS),true);
  const a=noteOffer(log,'season',t0);
  assert.equal(noteOffer(a,'short',t0),a,'本人が押した分は数えない');
  assert.equal(offerDue(a,'season',t0+OFFER_GAP_MS+1,9),false,'同じ場面は1日1回');
  assert.equal(offerDue(a,'loss',t0+OFFER_GAP_MS-1,9),false,'30分あける');
  assert.equal(offerDue(a,'loss',t0+OFFER_GAP_MS,9),true);
  const b=noteOffer(a,'loss',t0+OFFER_GAP_MS);
  assert.equal(b.shown,OFFER_DAILY_AUTO);
  assert.equal(offerDue({...b,moments:[]},'season',t0+2*OFFER_GAP_MS,9),false,'1日2回まで');
  const next=new Date(2026,10,8,12,0,0).getTime();
  assert.equal(offerDue(b,'season',next,9),true,'次の日はまた出せる');
  assert.equal(noteOffer(b,'season',next).shown,1);
  assert.deepEqual(parseOfferLog('壊れた'),emptyOfferLog());
  assert.deepEqual(parseOfferLog(JSON.stringify(b)),b);
 });
 test('offer (11/7): the first-purchase pack window is real: 72 hours from the first time it was shown, then it is gone (readOncePacks)',()=>{
  assert.equal(FIRST_PACK_WINDOW_MS,72*3600*1000);
  assert.deepEqual(firstPackWindow(null,t0),{open:true,leftMs:FIRST_PACK_WINDOW_MS},'まだ見せていない');
  assert.equal(firstPackWindow(t0,t0+FIRST_PACK_WINDOW_MS-1).open,true);
  assert.deepEqual(firstPackWindow(t0,t0+FIRST_PACK_WINDOW_MS),{open:false,leftMs:0});
  assert.equal(formatLeft(FIRST_PACK_WINDOW_MS),'3日 0時間');
  assert.equal(formatLeft(FIRST_PACK_WINDOW_MS-60000),'2日 23時間');
  assert.equal(formatLeft(3*3600000+5*60000),'3時間 5分');
  assert.equal(formatLeft(59*60000+59000),'59分');
  assert.equal(formatLeft(30000),'1分未満');
  assert.equal(formatLeft(0),'終了');
  const pp=readFileSync('src/pro/point-products.ts','utf8');
  assert.ok(/readOncePacks = \(now=Date.now\(\)\):string\[\] => \{const v=boughtOncePacks\(\);return !firstPackWindowNow\(now\)\.open/.test(pp),'期限を過ぎたら買えない物に数える');
  assert.ok(pp.includes('export const markOncePack = (id:string) => {try{const v=boughtOncePacks();'),'買った記録には期限切れを混ぜない');
 });
 test('offer (11/7): expected gold/rainbow counts come from the shown odds; the first pack is 1,200 draws',()=>{
  const gold=SCOUT_BANDS.filter(b=>b.id!=='domStandard').reduce((n,b)=>n+b.rate,0);
  assert.equal(Math.round(gold*10000)/100,2.65);
  assert.equal(packDraws(firstPack),1200);
  assert.equal(Math.round(expectedCount(packDraws(firstPack),gold)),32);
 });
 test('offer (11/7): honest sheet: store price text only, close button and "今はいい", no fake timer words, scout button opens it only when the store has prices',()=>{
  const o=readFileSync('src/pro/pawa/PawaOffer.tsx','utf8');
  assert.ok(o.includes('{`${prices[firstPack.id]} で購入する`}')||o.includes('`${prices[firstPack.id]} で購入する`'),'値段はストアの文字');
  assert.ok(!/¥\$\{|priceYen\)\}/.test(o),'円の直書きを出さない');
  assert.ok(o.includes('aria-label="閉じる"')&&o.includes('今はいい'),'閉じる所が2つ');
  for(const w of ['残りわずか','今だけ','急いで','あと〇人','売り切れ'])assert.ok(!o.includes(w),`煽りの言葉なし: ${w}`);
  assert.ok(o.includes('スカウトの確率は買っても変わりません'));
  const s=readFileSync('src/pro/pawa/PawaScout.tsx','utf8');
  assert.ok(s.includes("const storeReady=!!money?.packs&&Object.keys(money.packs.prices).length>0;"));
  assert.ok(s.includes('const refill=!canDraw&&storeReady&&!drawing'),'ブラウザ版・値段が取れない間は前と同じ');
  const app=readFileSync('src/pro/SimpleApp.tsx','utf8');
  assert.ok(app.includes('if(!offerDue(log,want.moment,now,state.pulls))'),'自動の案内は回数の決まりを通す');
  assert.ok(/const offerFree=!busy&&!drawing&&!managing&&!picking&&!seasonCard&&!celebration&&!giftPopup&&!tutorialOn&&!starter/.test(app),'ほかの窓・案内の間は出さない');
 });
}
