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

const platform=Capacitor.getPlatform()==='ios'?'ios':'android';
const ids=config[platform];
const PRODUCT=config.premiumProductId;
const KEY={premium:'diamond-nine-premium-cache',reward:'diamond-nine-reward-ads',daily:'diamond-nine-premium-daily',pacing:'diamond-nine-interstitial'};
const read=(k:string)=>{try{return localStorage.getItem(k);}catch{return null;}};
const write=(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch{/* ads/bonus still work this session */}};
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
const withTimeout=<T,>(p:Promise<T>,ms:number)=>Promise.race([p,sleep(ms).then(()=>{throw new Error('timeout');})]) as Promise<T>;

// ---------- observable state ----------
const listeners=new Set<()=>void>();
let premium:PremiumSnapshot={status:'checking',owned:read(KEY.premium)==='1',verified:false,price:null,busy:false,message:''};
let adsAllowed=false,privacyOptions=false,rewardBusy=false;
let snap:MonetizeSnapshot=build();
function build():MonetizeSnapshot{
 return {premium,privacyOptions,reward:{available:adsAllowed,busy:rewardBusy,left:dailyLeft(parseDaily(read(KEY.reward)),localDay(),REWARD_AD_DAILY_LIMIT),limit:REWARD_AD_DAILY_LIMIT,points:REWARD_AD_POINTS}};
}
function emit(){snap=build();setPremiumMatchBonus(premium.owned);for(const l of listeners)l();}
const setPremium=(patch:Partial<PremiumSnapshot>)=>{premium={...premium,...patch};emit();};
setPremiumMatchBonus(premium.owned);

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
   write(KEY.premium,'1');setPremium({owned:true,verified:true,message:'プレミアムパスを有効にしました。ありがとうございます！'});track('premium_purchase',{price:premium.price??''});
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
async function showRewardAd(onReward:(points:number)=>void):Promise<RewardOutcome>{
 if(rewardBusy||fullscreen)return 'busy';
 if(dailyLeft(parseDaily(read(KEY.reward)),localDay(),REWARD_AD_DAILY_LIMIT)<=0)return 'limit';
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
   write(KEY.reward,JSON.stringify(spendDaily(parseDaily(read(KEY.reward)),localDay())));
   try{onReward(REWARD_AD_POINTS);}finally{emit();}
  },()=>done());
  await Promise.race([closed,sleep(180000)]);
  await sleep(500);// a reward callback may land just after dismissal
  track('reward_ad',{outcome:granted?'rewarded':'dismissed'});
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
 buyPremium,restorePremium,showRewardAd,noteScout,showInterstitial,claimPremiumDaily,
 async showPrivacyOptions(){try{await AdMob.showPrivacyOptionsForm();}catch{/* not required in this region */}},
};

// Called synchronously from runtime.ts (native only) before the game renders.
export function installMonetize(){
 if(window.diamondMonetize)return;
 window.diamondMonetize=bridge;
 void refreshPremium();
 // Start the ad SDK after the first paint so the game appears without waiting.
 setTimeout(()=>{void initAds();},1500);
 if(platform==='ios')void NativePurchases.addListener('transactionUpdated',()=>{void refreshPremium();}).catch(()=>{});
 let lastResume=0;
 void App.addListener('resume',()=>{
  const now=Date.now();if(now-lastResume<30000)return;lastResume=now;
  void refreshPremium();if(!adsAllowed)void initAds();emit();// emit: daily counters roll over at midnight
 }).catch(()=>{});
}
