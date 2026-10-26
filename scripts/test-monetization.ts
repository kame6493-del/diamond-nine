import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {INTERSTITIAL_COOLDOWN_MS,INTERSTITIAL_GRACE_SEASONS,PREMIUM_DAILY_POINTS,REWARD_AD_POINTS,interstitialGraceOver,REWARD_AD_DAILY_LIMIT,dailyLeft,interstitialDue,localDay,parseDaily,spendDaily,type MonetizeBridge,type MonetizeSnapshot} from '../src/pro/monetization';
import {PremiumPassCard,RewardAdButton} from '../src/pro/MonetizePanel';
import {appEdition,setPremiumMatchBonus} from '../src/pro/platform-economy';
import {gameReward} from '../src/pro/progression';
import {PREMIUM_PASS_PRICE_YEN,AGE_BANDS,addSpend,canSpend,monthlyLimit,packBonusPercent,parseSpend,pointPacks,pointProducts,spentThisMonth,yenPerDraw} from '../src/pro/point-products';
import {SIMPLE_SCOUT_COST} from '../src/pro/simple-game';
import {PackShop} from '../src/pro/PackShop';

const fakeBridge=(snapshot:MonetizeSnapshot):MonetizeBridge=>({snapshot:()=>snapshot,subscribe:()=>()=>{},buyPremium:async()=>{},restorePremium:async()=>{},showRewardAd:async()=>'failed',noteScout:()=>{},showInterstitial:async()=>false,claimPremiumDaily:()=>0,showPrivacyOptions:async()=>{}});
const snapshot=(premium:Partial<MonetizeSnapshot['premium']>={}):MonetizeSnapshot=>({privacyOptions:false,reward:{available:true,busy:false,left:3,limit:3,points:REWARD_AD_POINTS},premium:{status:'unavailable',owned:false,verified:true,price:null,busy:false,message:'',...premium}});
const withBridge=<T,>(bridge:MonetizeBridge|undefined,run:()=>T)=>{
 const g=globalThis as {window?:unknown};const old=g.window;g.window={diamondMonetize:bridge};
 try{return run();}finally{g.window=old;}
};

export function registerMonetizationTests(test:(name:string,run:()=>void)=>void){
 test('reward ads count per local day and reset the next day',()=>{
  const day='2026-09-30';
  assert.equal(dailyLeft(null,day,REWARD_AD_DAILY_LIMIT),3);
  let record=null as ReturnType<typeof parseDaily>;
  for(let i=0;i<3;i++)record=spendDaily(record,day);
  assert.equal(dailyLeft(record,day,REWARD_AD_DAILY_LIMIT),0);
  assert.equal(dailyLeft(record,'2026-10-01',REWARD_AD_DAILY_LIMIT),3);
  assert.deepEqual(parseDaily(JSON.stringify(record)),{day,used:3});
  assert.equal(parseDaily('{bad'),null);assert.equal(parseDaily('{"day":"x","used":-1}'),null);
  assert.equal(localDay(new Date(2026,0,5,23,59)),'2026-01-05');
 });
 test('interstitials skip pass owners, respect the cooldown and wait for three scouts',()=>{
  const base={premium:false,lastShownAt:0,now:INTERSTITIAL_COOLDOWN_MS*10,scoutsSince:0};
  assert.equal(interstitialDue('season',base),true);
  assert.equal(interstitialDue('season',{...base,premium:true}),false);
  assert.equal(interstitialDue('season',{...base,lastShownAt:base.now-1000}),false);
  assert.equal(interstitialDue('scout',{...base,scoutsSince:2}),false);
  assert.equal(interstitialDue('scout',{...base,scoutsSince:3}),true);
  assert.equal(interstitialDue('scout',{...base,scoutsSince:3,premium:true}),false);
 });
 test('ad pacing leaves new players alone and keeps a five-minute gap; ads and the pass are worth a scout',()=>{
  assert.equal(INTERSTITIAL_COOLDOWN_MS,5*60*1000);
  assert.equal(interstitialGraceOver(0),false);assert.equal(interstitialGraceOver(INTERSTITIAL_GRACE_SEASONS-1),false);assert.equal(interstitialGraceOver(INTERSTITIAL_GRACE_SEASONS),true);
  const now=INTERSTITIAL_COOLDOWN_MS*10;
  assert.equal(interstitialDue('season',{premium:false,lastShownAt:now-4*60*1000,now,scoutsSince:0}),false);
  assert.equal(REWARD_AD_POINTS,3000,'one rewarded ad is one scout');assert.equal(PREMIUM_DAILY_POINTS,500);
 });
 test('browser rewards ignore the premium flag and render no ad or pass UI',()=>{
  assert.equal(appEdition,false);
  const s={club:'t',franchise:{stadium:3}} as never,game={home:'t',away:'g',homeRuns:4,awayRuns:1} as never;
  const before=gameReward(s,game);setPremiumMatchBonus(true);
  try{assert.equal(gameReward(s,game),before);assert.equal(before,5);}finally{setPremiumMatchBonus(false);}
  withBridge(undefined,()=>{
   assert.equal(renderToStaticMarkup(createElement(PremiumPassCard)),'');
   assert.equal(renderToStaticMarkup(createElement(RewardAdButton,{disabled:false,onStart:()=>{},onReward:()=>{},onEnd:()=>{}})),'');
  });
 });
 test('point packs: new ids, Play-settable yen prices, cheaper per draw as they grow, ¥10,000 is 100 scouts',()=>{
  const ids=pointPacks.map(p=>p.id);assert.equal(new Set(ids).size,ids.length);
  for(const old of pointProducts)assert.ok(!ids.includes(old.id),'old proposal ids are never reused');
  assert.ok(!ids.includes('premium_pass'));
  for(const p of pointPacks){assert.ok(Number.isInteger(p.priceYen)&&p.priceYen>=100&&p.priceYen<=50000);assert.ok(p.points%1000===0);assert.match(p.id,/^[a-z0-9_.]+$/);}
  for(let i=1;i<pointPacks.length;i++){assert.ok(pointPacks[i].priceYen>pointPacks[i-1].priceYen);assert.ok(yenPerDraw(pointPacks[i])<yenPerDraw(pointPacks[i-1]));assert.ok(packBonusPercent(pointPacks[i])>packBonusPercent(pointPacks[i-1]));}
  const top=pointPacks.at(-1)!;assert.equal(top.priceYen,10000);assert.equal(top.points,SIMPLE_SCOUT_COST*100);assert.equal(yenPerDraw(top),100);
 });
 test('minors get a monthly cap: 15 and under 5,000 yen, 16-17 10,000 yen, adults none; unknown age cannot buy',()=>{
  assert.deepEqual(AGE_BANDS.map(b=>b.limitYen),[5000,10000,null]);
  assert.equal(canSpend(null,0,160),false);
  assert.equal(canSpend('u16',4840,160),true);assert.equal(canSpend('u16',4900,160),false);assert.equal(canSpend('u16',0,10000),false);
  assert.equal(canSpend('u18',0,10000),true);assert.equal(canSpend('u18',160,10000),false);
  assert.equal(PREMIUM_PASS_PRICE_YEN,480);assert.equal(canSpend('u16',4520,PREMIUM_PASS_PRICE_YEN),true);assert.equal(canSpend('u16',4600,PREMIUM_PASS_PRICE_YEN),false,'the pass counts toward the cap');
  assert.equal(canSpend('adult',999999,10000),true);assert.equal(monthlyLimit('adult'),null);
  let r=addSpend(null,'2026-10',480);r=addSpend(r,'2026-10',980);assert.equal(spentThisMonth(r,'2026-10'),1460);
  assert.equal(spentThisMonth(r,'2026-11'),0,'the cap resets each month');assert.equal(addSpend(r,'2026-11',160).yen,160);
  assert.deepEqual(parseSpend(JSON.stringify(r)),r);assert.equal(parseSpend('{"month":"x","yen":-1}'),null);assert.equal(parseSpend('{bad'),null);
 });
 test('pack shop: browser build shows app-only buttons; the app shows store prices, or a retry when the store cannot be reached',()=>{
  const web=withBridge(undefined,()=>renderToStaticMarkup(createElement(PackShop)));
  assert.equal((web.match(/アプリ版で<small>使えます/g)??[]).length,pointPacks.length);assert.match(web,/300,000/);assert.match(web,/スカウト100回分/);assert.doesNotMatch(web,/10連/);assert.match(web,/disabled=""/);
  const none=withBridge(fakeBridge({...snapshot(),packs:{status:'unavailable',prices:{},busy:false,message:''}}),()=>renderToStaticMarkup(createElement(PackShop)));
  // 2026-10-26: ストアにつながらない時は「読み込めません」と「もう一度読み込む」(押せないまま黙らない)
  assert.equal((none.match(/読み込めません/g)??[]).length,pointPacks.length);assert.match(none,/もう一度読み込む/);assert.doesNotMatch(none,/販売準備中/);
  const ready=withBridge(fakeBridge({...snapshot(),packs:{status:'ready',prices:{pt_pack_300000:'￥10,000'},busy:false,message:''}}),()=>renderToStaticMarkup(createElement(PackShop)));
  assert.match(ready,/￥10,000/);assert.match(ready,/保護者の同意/);
 });
 test('premium pass shows store prices only and disables purchase until the product exists',()=>{
  const off=withBridge(fakeBridge(snapshot()),()=>renderToStaticMarkup(createElement(PremiumPassCard)));
  assert.match(off,/disabled=""[^>]*>読み込めません/);assert.match(off,/もう一度読み込む/);assert.match(off,/購入を復元/);assert.doesNotMatch(off,/円/);
  const ready=withBridge(fakeBridge(snapshot({status:'ready',price:'￥480'})),()=>renderToStaticMarkup(createElement(PremiumPassCard)));
  assert.match(ready,/￥480 で購入する/);
  const owned=withBridge(fakeBridge(snapshot({status:'ready',price:'￥480',owned:true})),()=>renderToStaticMarkup(createElement(PremiumPassCard)));
  assert.match(owned,/購入済み/);assert.doesNotMatch(owned,/で購入する/);
  const ad=withBridge(fakeBridge(snapshot()),()=>renderToStaticMarkup(createElement(RewardAdButton,{disabled:false,onStart:()=>{},onReward:()=>{},onEnd:()=>{}})));
  assert.match(ad,/広告を見て1回引く/);assert.match(ad,/今日あと 3 \/ 3 回/);
 });
}
