// Native-only ads (AdMob) and the one-time "premium pass" (StoreKit 2 / Play Billing).
// Imported from runtime.ts only when Capacitor.isNativePlatform(); the browser build
// never bundles this file. Nothing here may throw into the game: every native call is
// wrapped, and failures fall back to "no ad" / "not purchasable".
import {Capacitor,type PluginListenerHandle} from '@capacitor/core';
import {App} from '@capacitor/app';
import {AdMob,AdmobConsentStatus,InterstitialAdPluginEvents,RewardAdPluginEvents} from '@capacitor-community/admob';
import {NativePurchases,PURCHASE_TYPE,type Transaction} from '@capgo/native-purchases';
import config from './ads-config.json';
import {setPremiumMatchBonus} from '../src/pro/platform-economy';
import {
 PREMIUM_DAILY_POINTS,REWARD_AD_DAILY_LIMIT,REWARD_AD_POINTS,dailyLeft,interstitialDue,localDay,parseDaily,spendDaily,
 type MonetizeBridge,type MonetizeSnapshot,type PremiumSnapshot,type RewardOutcome,
} from '../src/pro/monetization';
import {track} from '../src/pro/analytics';
import {STAMINA_AD_DAILY_LIMIT,STAMINA_AD_POINTS,setStaminaPass} from '../src/pro/stamina';
import {PREMIUM_PASS_PRICE_YEN,packById,pointPackIds,recordSpend} from '../src/pro/point-products';
import type {PacksSnapshot} from '../src/pro/monetization';

const platform=Capacitor.getPlatform()==='ios'?'ios':'android';
const ids=config[platform];
const PRODUCT=config.premiumProductId;
const KEY={premium:'diamond-nine-premium-cache',reward:'diamond-nine-reward-ads',daily:'diamond-nine-premium-daily',pacing:'diamond-nine-interstitial',ledger:'diamond-nine-iap-ledger',staminaAd:'diamond-nine-stamina-ads'};
const read=(k:string)=>{try{return localStorage.getItem(k);}catch{return null;}};
const write=(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch{/* ads/bonus still work this session */}};
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
const withTimeout=<T,>(p:Promise<T>,ms:number)=>Promise.race([p,sleep(ms).then(()=>{throw new Error('timeout');})]) as Promise<T>;

// ---------- observable state ----------
const listeners=new Set<()=>void>();
let premium:PremiumSnapshot={status:'checking',owned:read(KEY.premium)==='1',verified:false,price:null,busy:false,message:''};
let packs:PacksSnapshot={status:'checking',prices:{},busy:false,message:''};
let adsAllowed=false,privacyOptions=false,rewardBusy=false;
let snap:MonetizeSnapshot=build();
function build():MonetizeSnapshot{
 return {premium,privacyOptions,packs,reward:{available:adsAllowed,busy:rewardBusy,left:dailyLeft(parseDaily(read(KEY.reward)),localDay(),REWARD_AD_DAILY_LIMIT),limit:REWARD_AD_DAILY_LIMIT,points:REWARD_AD_POINTS},
  staminaReward:{left:dailyLeft(parseDaily(read(KEY.staminaAd)),localDay(),STAMINA_AD_DAILY_LIMIT),limit:STAMINA_AD_DAILY_LIMIT,points:STAMINA_AD_POINTS}};
}
function emit(){snap=build();setPremiumMatchBonus(premium.owned);setStaminaPass(premium.owned);for(const l of listeners)l();}
const setPremium=(patch:Partial<PremiumSnapshot>)=>{premium={...premium,...patch};emit();};
setPremiumMatchBonus(premium.owned);setStaminaPass(premium.owned);

// ---------- premium pass ----------
const validPurchase=(t:Transaction)=>t.productIdentifier===PRODUCT&&(platform==='ios'?!t.revocationDate:t.purchaseState==='1');
let refreshing:Promise<void>|null=null;
function refreshPremium():Promise<void>{
 return refreshing??=(async()=>{
  let price:string|null=null,status:PremiumSnapshot['status']='unavailable';
  try{
   const {products}=await withTimeout(NativePurchases.getProducts({productIdentifiers:[PRODUCT],productType:PURCHASE_TYPE.INAPP}),15000);
   const product=products.find(p=>p.identifier===PRODUCT||p.planIdentifier===PRODUCT);
   if(product?.priceString){price=product.priceString;status='ready';}
  }catch{/* product not registered yet, offline, or billing unavailable */}
  try{
   // iOS: Transaction.currentEntitlements (refunded/revoked excluded). Android: queryPurchasesAsync.
   const {purchases}=await withTimeout(NativePurchases.getPurchases({productType:PURCHASE_TYPE.INAPP,onlyCurrentEntitlements:true}),15000);
   const mine=purchases.filter(validPurchase);
   // Play refunds unacknowledged purchases after 3 days: acknowledge anything left over
   // (e.g. a PENDING payment that completed while the app was closed).
   if(platform==='android')for(const t of mine)if(t.isAcknowledged===false&&t.purchaseToken)await NativePurchases.acknowledgePurchase({purchaseToken:t.purchaseToken}).catch(()=>{});
   const owned=mine.length>0;write(KEY.premium,owned?'1':'0');
   setPremium({status,price,owned,verified:true});
  }catch{
   // Store unreachable: keep the cached ownership, mark as unverified.
   setPremium({status,price,verified:false});
  }
 })().finally(()=>{refreshing=null;});
}
async function buyPremium(){
 if(premium.busy||premium.status!=='ready'||premium.owned)return;
 setPremium({busy:true,message:''});track('premium_begin',{price:premium.price??''});
 try{
  const t=await NativePurchases.purchaseProduct({productIdentifier:PRODUCT,productType:PURCHASE_TYPE.INAPP,quantity:1,isConsumable:false,autoAcknowledgePurchases:true});
  if(validPurchase(t)){
   if(platform==='android'&&t.isAcknowledged===false&&t.purchaseToken)await NativePurchases.acknowledgePurchase({purchaseToken:t.purchaseToken}).catch(()=>{});
   write(KEY.premium,'1');recordSpend(PREMIUM_PASS_PRICE_YEN);setPremium({owned:true,verified:true,message:'プレミアムパスを有効にしました。ありがとうございます！'});track('premium_purchase',{price:premium.price??''});
  }else setPremium({message:'お支払いの完了を待っています。完了すると自動で有効になります。'});
 }catch(e){
  const text=String((e as {message?:string})?.message??e);track('premium_fail',{cancelled:/cancel/i.test(text)});
  setPremium({message:/cancel/i.test(text)?'購入をキャンセルしました。':/pending|PURCHASE_STATE_2/i.test(text)?'お支払いの完了を待っています。完了すると自動で有効になります。':'購入を完了できませんでした。通信状態を確認して、もう一度お試しください。'});
 }finally{
  setPremium({busy:false});void refreshPremium();
 }
}
async function restorePremium(){
 if(premium.busy)return;
 setPremium({busy:true,message:''});
 try{await withTimeout(NativePurchases.restorePurchases(),60000);}catch{/* still re-query below */}
 await refreshPremium();
 setPremium({busy:false,message:!premium.verified?'ストアに接続できませんでした。時間をおいてお試しください。':premium.owned?'購入を復元しました。':'復元できる購入は見つかりませんでした。'});
}
function claimPremiumDaily(){
 if(!premium.owned||!premium.verified)return 0;
 const today=localDay();if(read(KEY.daily)===today)return 0;
 write(KEY.daily,today);return PREMIUM_DAILY_POINTS;
}

// ---------- point packs (consumable) ----------
// 端末の台帳: 付与済みの購入トークン(重複よけ)と、受け取り待ち(ゲームの口がまだ無い)。セーブとは別に置く。
interface Ledger {granted:string[];pending:{token:string;id:string;points:number}[]}
const readLedger=():Ledger=>{try{const v=JSON.parse(read(KEY.ledger)??'');if(Array.isArray(v.granted)&&Array.isArray(v.pending))return v;}catch{/* empty */}return {granted:[],pending:[]};};
const writeLedger=(l:Ledger)=>write(KEY.ledger,JSON.stringify({granted:l.granted.slice(-500),pending:l.pending}));
const setPacks=(patch:Partial<PacksSnapshot>)=>{packs={...packs,...patch};emit();};
let sink:((points:number,id:string)=>void)|null=null;
const tokenOf=(t:Transaction)=>t.purchaseToken??t.transactionId;
const validPack=(t:Transaction)=>!!packById(t.productIdentifier)&&(platform==='ios'?!t.revocationDate:t.purchaseState==='1');
function flushPending(){
 if(!sink)return;
 const l=readLedger();if(!l.pending.length)return;
 for(const p of l.pending){try{sink(p.points,p.id);}catch{/* the save keeps whatever was applied */}}
 writeLedger({granted:l.granted,pending:[]});
}
// 1件の購入を1回だけゲームへ渡し、そのあとでストアに消費を伝える(付与前に消費しない)。
async function fulfil(t:Transaction){
 const pack=packById(t.productIdentifier),token=tokenOf(t);if(!pack||!token)return false;
 const l=readLedger();
 if(!l.granted.includes(token)){
  l.granted.push(token);l.pending.push({token,id:pack.id,points:pack.points});writeLedger(l);
  recordSpend(pack.priceYen);track('pack_purchase',{id:pack.id,points:pack.points});
  flushPending();
 }
 try{
  if(platform==='android')await NativePurchases.consumePurchase({purchaseToken:token});
  else await NativePurchases.acknowledgePurchase({purchaseToken:token});
 }catch{/* retried at the next start from getPurchases */}
 return true;
}
async function refreshPacks(){
 try{
  const {products}=await withTimeout(NativePurchases.getProducts({productIdentifiers:pointPackIds,productType:PURCHASE_TYPE.INAPP}),15000);
  const prices:Record<string,string>={};for(const p of products)if(p.priceString&&packById(p.identifier))prices[p.identifier]=p.priceString;
  setPacks({status:Object.keys(prices).length?'ready':'unavailable',prices});
 }catch{setPacks({status:'unavailable'});}
 // 前回アプリが途中で閉じた購入(支払い済み・未消費)を拾う。
 try{
  const {purchases}=await withTimeout(NativePurchases.getPurchases({productType:PURCHASE_TYPE.INAPP}),15000);
  for(const t of purchases)if(validPack(t))await fulfil(t);
 }catch{/* offline */}
}
async function buyPack(id:string){
 const pack=packById(id);
 if(!pack||packs.busy||!packs.prices[id])return;
 setPacks({busy:true,message:''});track('pack_begin',{id});
 try{
  const t=await NativePurchases.purchaseProduct({productIdentifier:id,productType:PURCHASE_TYPE.INAPP,quantity:1,isConsumable:false,autoAcknowledgePurchases:false});
  if(validPack(t)&&await fulfil(t))setPacks({message:`${pack.points.toLocaleString('ja-JP')} pt を受け取りました。ありがとうございます！`});
  else setPacks({message:'お支払いの完了を待っています。完了すると次に開いたときに受け取れます。'});
 }catch(e){
  const text=String((e as {message?:string})?.message??e);track('pack_fail',{id,cancelled:/cancel/i.test(text)});
  setPacks({message:/cancel/i.test(text)?'購入をキャンセルしました。':/pending|PURCHASE_STATE_2/i.test(text)?'お支払いの完了を待っています。完了すると次に開いたときに受け取れます。':'購入を完了できませんでした。通信状態を確認して、もう一度お試しください。'});
 }finally{setPacks({busy:false});}
}

// ---------- ads ----------
// iOS never asks for tracking permission (no ATT), and the App Store privacy label says no tracking, so iOS always requests non-personalized ads.
const adOptions=(adId:string)=>({adId,isTesting:config.useTestAds,npa:config.nonPersonalizedAds||platform==='ios'});
let rewardLoaded=false,rewardLoading:Promise<void>|null=null,interstitialLoaded=false,interstitialLoading:Promise<void>|null=null,fullscreen=false,lastFullscreenAt=0,adsInit:Promise<void>|null=null;
function initAds():Promise<void>{
 return adsInit??=(async()=>{
  try{
   await AdMob.initialize({initializeForTesting:config.useTestAds});
   let info=await AdMob.requestConsentInfo();
   if(!info.canRequestAds&&info.isConsentFormAvailable&&info.status===AdmobConsentStatus.REQUIRED)info=await AdMob.showConsentForm();
   privacyOptions=String(info.privacyOptionsRequirementStatus)==='REQUIRED';
   adsAllowed=info.canRequestAds;emit();
   if(adsAllowed){void preloadReward();void preloadInterstitial();}
  }catch{adsInit=null;/* offline or SDK failure: retried on resume */}
 })();
}
function preloadReward(){
 if(!adsAllowed||rewardLoaded)return Promise.resolve();
 return rewardLoading??=AdMob.prepareRewardVideoAd(adOptions(ids.rewardedId)).then(()=>{rewardLoaded=true;},()=>{rewardLoaded=false;}).finally(()=>{rewardLoading=null;});
}
function preloadInterstitial(){
 if(!adsAllowed||interstitialLoaded||premium.owned)return Promise.resolve();
 return interstitialLoading??=AdMob.prepareInterstitial(adOptions(ids.interstitialId)).then(()=>{interstitialLoaded=true;},()=>{interstitialLoaded=false;}).finally(()=>{interstitialLoading=null;});
}
// スカウト1回の広告と、行動力の広告(2026-10-19)は同じ広告枠を使い、1日の回数は別々に数える。
const showRewardAd=(onReward:(points:number)=>void)=>showAd(KEY.reward,REWARD_AD_DAILY_LIMIT,REWARD_AD_POINTS,'reward_ad',onReward);
const showStaminaAd=(onReward:(amount:number)=>void)=>showAd(KEY.staminaAd,STAMINA_AD_DAILY_LIMIT,STAMINA_AD_POINTS,'stamina_ad',onReward);
async function showAd(key:string,limit:number,amount:number,event:string,onReward:(amount:number)=>void):Promise<RewardOutcome>{
 if(rewardBusy||fullscreen)return 'busy';
 if(dailyLeft(parseDaily(read(key)),localDay(),limit)<=0)return 'limit';
 rewardBusy=true;emit();
 const handles:PluginListenerHandle[]=[];
 try{
  await initAds();if(!adsAllowed)return 'failed';
  if(!rewardLoaded)await withTimeout(preloadReward(),15000);
  if(!rewardLoaded)return 'failed';
  let granted=false,done!:()=>void;const closed=new Promise<void>(r=>{done=r;});
  handles.push(await AdMob.addListener(RewardAdPluginEvents.Dismissed,()=>done()));
  handles.push(await AdMob.addListener(RewardAdPluginEvents.FailedToShow,()=>done()));
  rewardLoaded=false;fullscreen=true;
  // The reward is granted ONLY from the SDK's earned-reward callback (this promise
  // resolves from onUserEarnedReward / userDidEarnRewardHandler), and only once.
  AdMob.showRewardVideoAd().then(()=>{
   if(granted)return;granted=true;
   write(key,JSON.stringify(spendDaily(parseDaily(read(key)),localDay())));
   try{onReward(amount);}finally{emit();}
  },()=>done());
  await Promise.race([closed,sleep(180000)]);
  await sleep(500);// a reward callback may land just after dismissal
  track(event,{outcome:granted?'rewarded':'dismissed'});
  return granted?'rewarded':'dismissed';
 }catch{rewardLoaded=false;return 'failed';}
 finally{
  for(const h of handles)void h.remove();
  if(fullscreen)lastFullscreenAt=Date.now();
  fullscreen=false;rewardBusy=false;emit();void preloadReward();
 }
}
interface Pacing {lastShownAt:number;scoutsSince:number}
const readPacing=():Pacing=>{try{const v=JSON.parse(read(KEY.pacing)??'');if(Number.isFinite(v.lastShownAt)&&Number.isInteger(v.scoutsSince))return v;}catch{/* default */}return {lastShownAt:0,scoutsSince:0};};
function noteScout(){const p=readPacing();write(KEY.pacing,JSON.stringify({...p,scoutsSince:p.scoutsSince+1}));}
async function showInterstitial(reason:'season'|'scout'){
 const p=readPacing();
 if(!interstitialDue(reason,{premium:premium.owned,lastShownAt:Math.max(p.lastShownAt,lastFullscreenAt),now:Date.now(),scoutsSince:p.scoutsSince}))return false;
 if(fullscreen||rewardBusy||!adsAllowed||!interstitialLoaded){void preloadInterstitial();return false;}
 const handles:PluginListenerHandle[]=[];
 try{
  let done!:()=>void;const closed=new Promise<void>(r=>{done=r;});
  handles.push(await AdMob.addListener(InterstitialAdPluginEvents.Dismissed,()=>done()));
  handles.push(await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow,()=>done()));
  interstitialLoaded=false;fullscreen=true;
  await AdMob.showInterstitial();
  write(KEY.pacing,JSON.stringify({lastShownAt:Date.now(),scoutsSince:0}));track('interstitial_ad',{reason});
  await Promise.race([closed,sleep(120000)]);
  return true;
 }catch{return false;}
 finally{
  for(const h of handles)void h.remove();
  if(fullscreen)lastFullscreenAt=Date.now();
  fullscreen=false;void preloadInterstitial();
 }
}

const bridge:MonetizeBridge={
 snapshot:()=>snap,
 subscribe(l){listeners.add(l);return()=>{listeners.delete(l);};},
 buyPremium,restorePremium,showRewardAd,showStaminaAd,noteScout,showInterstitial,claimPremiumDaily,
 async showPrivacyOptions(){try{await AdMob.showPrivacyOptionsForm();}catch{/* not required in this region */}},
 setPointSink(fn){sink=fn;flushPending();},
 buyPack,
};

// Called synchronously from runtime.ts (native only) before the game renders.
export function installMonetize(){
 if(window.diamondMonetize)return;
 window.diamondMonetize=bridge;
 void refreshPremium();void refreshPacks();
 // Start the ad SDK after the first paint so the game appears without waiting.
 setTimeout(()=>{void initAds();},1500);
 if(platform==='ios')void NativePurchases.addListener('transactionUpdated',()=>{void refreshPremium();}).catch(()=>{});
 let lastResume=0;
 void App.addListener('resume',()=>{
  const now=Date.now();if(now-lastResume<30000)return;lastResume=now;
  void refreshPremium();void refreshPacks();if(!adsAllowed)void initAds();emit();// emit: daily counters roll over at midnight
 }).catch(()=>{});
}
