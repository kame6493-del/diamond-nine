import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {INTERSTITIAL_COOLDOWN_MS,REWARD_AD_DAILY_LIMIT,dailyLeft,interstitialDue,localDay,parseDaily,spendDaily,type MonetizeBridge,type MonetizeSnapshot} from '../src/pro/monetization';
import {PremiumPassCard,RewardAdButton} from '../src/pro/MonetizePanel';
import {appEdition,setPremiumMatchBonus} from '../src/pro/platform-economy';
import {gameReward} from '../src/pro/progression';

const fakeBridge=(snapshot:MonetizeSnapshot):MonetizeBridge=>({snapshot:()=>snapshot,subscribe:()=>()=>{},buyPremium:async()=>{},restorePremium:async()=>{},showRewardAd:async()=>'failed',noteScout:()=>{},showInterstitial:async()=>false,claimPremiumDaily:()=>0,showPrivacyOptions:async()=>{}});
const snapshot=(premium:Partial<MonetizeSnapshot['premium']>={}):MonetizeSnapshot=>({privacyOptions:false,reward:{available:true,busy:false,left:5,limit:5,points:600},premium:{status:'unavailable',owned:false,verified:true,price:null,busy:false,message:'',...premium}});
const withBridge=<T,>(bridge:MonetizeBridge|undefined,run:()=>T)=>{
 const g=globalThis as {window?:unknown};const old=g.window;g.window={diamondMonetize:bridge};
 try{return run();}finally{g.window=old;}
};

export function registerMonetizationTests(test:(name:string,run:()=>void)=>void){
 test('reward ads count per local day and reset the next day',()=>{
  const day='2026-09-30';
  assert.equal(dailyLeft(null,day,REWARD_AD_DAILY_LIMIT),5);
  let record=null as ReturnType<typeof parseDaily>;
  for(let i=0;i<5;i++)record=spendDaily(record,day);
  assert.equal(dailyLeft(record,day,REWARD_AD_DAILY_LIMIT),0);
  assert.equal(dailyLeft(record,'2026-10-01',REWARD_AD_DAILY_LIMIT),5);
  assert.deepEqual(parseDaily(JSON.stringify(record)),{day,used:5});
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
 test('browser rewards ignore the premium flag and render no ad or pass UI',()=>{
  assert.equal(appEdition,false);
  const s={club:'t',franchise:{stadium:3}} as never,game={home:'t',away:'g',homeRuns:4,awayRuns:1} as never;
  const before=gameReward(s,game);setPremiumMatchBonus(true);
  try{assert.equal(gameReward(s,game),before);assert.equal(before,28);}finally{setPremiumMatchBonus(false);}
  withBridge(undefined,()=>{
   assert.equal(renderToStaticMarkup(createElement(PremiumPassCard)),'');
   assert.equal(renderToStaticMarkup(createElement(RewardAdButton,{disabled:false,onStart:()=>{},onReward:()=>{},onEnd:()=>{}})),'');
  });
 });
 test('premium pass shows store prices only and disables purchase until the product exists',()=>{
  const off=withBridge(fakeBridge(snapshot()),()=>renderToStaticMarkup(createElement(PremiumPassCard)));
  assert.match(off,/販売準備中/);assert.match(off,/disabled=""[^>]*>販売準備中/);assert.match(off,/購入を復元/);assert.doesNotMatch(off,/円/);
  const ready=withBridge(fakeBridge(snapshot({status:'ready',price:'￥480'})),()=>renderToStaticMarkup(createElement(PremiumPassCard)));
  assert.match(ready,/￥480 で購入する/);
  const owned=withBridge(fakeBridge(snapshot({status:'ready',price:'￥480',owned:true})),()=>renderToStaticMarkup(createElement(PremiumPassCard)));
  assert.match(owned,/購入済み/);assert.doesNotMatch(owned,/で購入する/);
  const ad=withBridge(fakeBridge(snapshot()),()=>renderToStaticMarkup(createElement(RewardAdButton,{disabled:false,onStart:()=>{},onReward:()=>{},onEnd:()=>{}})));
  assert.match(ad,/広告を見て ＋600 pt/);assert.match(ad,/今日あと 5 \/ 5 回/);
 });
}
