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
import {PREMIUM_PASS_PRICE_YEN,packById,pointPackIds,recordSpend,isOncePack,markOncePack} from '../src/pro/point-products';
import type {PacksSnapshot} from '../src/pro/monetization';
import {initRevenueCat,recordPurchase} from './revenuecat';

const platform=Capacitor.getPlatform()==='ios'?'ios':'android';
const launchedAt=Date.now();
const ids=config[platform];
const PRODUCT=config.premiumProductId;
const KEY={premium:'diamond-nine-premium-cache',reward:'diamond-nine-reward-ads',daily:'diamond-nine-premium-daily',pacing:'diamond-nine-interstitial',ledger:'diamond-nine-iap-ledger',staminaAd:'diamond-nine-stamina-ads'};
const read=(k:string)=>{try{return localStorage.getItem(k);}catch{return null;}};
const write=(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch{/* ads/bonus still work this session */}};
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
const withTimeout=<T,>(p:Promise<T>,ms:number)=>Promise.race([p,sleep(ms).then(()=>{throw new Error('timeout');})]) as Promise<T>;
const errText=(e:unknown)=>String((e as {message?:string})?.message??e);

// ---------- one store call at a time (2026-10-26) ----------
// @capgo/native-purchases (Android) ends the previous BillingClient at the start of EVERY call.
// Two calls at once cut each other off: at start-up the premium and pack price queries
// failed ("販売準備中"), and the refresh that ran on 'resume' when the Play purchase sheet
// closed killed the purchase's own client, so its result never came back (the button
// stayed busy and the points arrived only at the next start). Every NativePurchases call
// now goes through this queue, and nothing refreshes while a purchase is open.
let storeChain:Promise<unknown>=Promise.resolve();
function store<T>(task:()=>Promise<T>,ms=20000):Promise<T>{
 const run=storeChain.then(()=>withTimeout(task(),ms));
 storeChain=run.catch(()=>{});
 return run;
}
let purchasing=false;
// Waits for the Play / App Store purchase sheet. The plugin never answers when the sheet
// could not open (launchBillingFlow error), so: no 'pause' within 12 s = the sheet did not
// open; after the sheet closed ('resume') the result must arrive within 25 s. Either way we
// stop waiting and re-read the store, which picks up a purchase that did go through.
// Android only: iOS fires 'pause' only on backgrounding, not for the StoreKit sheet.
function purchaseCall(task:()=>Promise<Transaction>):Promise<Transaction>{
 if(platform!=='android')return store(task,30*60*1000);
 return store(()=>new Promise<Transaction>((resolve,reject)=>{
  let settled=false,timer:ReturnType<typeof setTimeout>|undefined;
  const handles:Promise<PluginListenerHandle>[]=[];
  const finish=(fn:()=>void)=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);for(const h of handles)void h.then(x=>x.remove()).catch(()=>{});fn();};
  const arm=(ms:number,code:string)=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>finish(()=>reject(new Error(code))),ms);};
  arm(12000,'SHEET_NOT_OPENED');
  handles.push(App.addListener('pause',()=>{if(!settled&&timer)clearTimeout(timer);}));
  handles.push(App.addListener('resume',()=>{if(!settled)arm(25000,'RESULT_LOST');}));
  task().then(t=>finish(()=>resolve(t)),e=>finish(()=>reject(e)));
 }),30*60*1000);
}

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
   const {products}=await store(()=>NativePurchases.getProducts({productIdentifiers:[PRODUCT],productType:PURCHASE_TYPE.INAPP}));
   const product=products.find(p=>p.identifier===PRODUCT||p.planIdentifier===PRODUCT);
   if(product?.priceString){price=product.priceString;status='ready';}
  }catch(e){
   track('store_error',{step:'premium_products',msg:errText(e).slice(0,90)});
   // keep a price we already had (a brief network failure must not stop the sale)
   if(premium.price){price=premium.price;status='ready';}
  }
  try{
   // iOS: Transaction.currentEntitlements (refunded/revoked excluded). Android: queryPurchasesAsync.
   const {purchases}=await store(()=>NativePurchases.getPurchases({productType:PURCHASE_TYPE.INAPP,onlyCurrentEntitlements:true}));
   const mine=purchases.filter(validPurchase);
   // Play refunds unacknowledged purchases after 3 days: acknowledge anything left over
   // (e.g. a PENDING payment that completed while the app was closed).
   if(platform==='android')for(const t of mine)if(t.isAcknowledged===false&&t.purchaseToken){const token=t.purchaseToken;void recordPurchase(PRODUCT);await store(()=>NativePurchases.acknowledgePurchase({purchaseToken:token})).catch(()=>{});}
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
  purchasing=true;
  const t=await purchaseCall(()=>NativePurchases.purchaseProduct({productIdentifier:PRODUCT,productType:PURCHASE_TYPE.INAPP,quantity:1,isConsumable:false,autoAcknowledgePurchases:true}));
  purchasing=false;
  if(validPurchase(t)){
   if(platform==='android'&&t.isAcknowledged===false&&t.purchaseToken){const token=t.purchaseToken;await store(()=>NativePurchases.acknowledgePurchase({purchaseToken:token})).catch(()=>{});}
   write(KEY.premium,'1');recordSpend(PREMIUM_PASS_PRICE_YEN);void recordPurchase(PRODUCT);setPremium({owned:true,verified:true,message:'プレミアムパスを有効にしました。ありがとうございます！'});track('premium_purchase',{price:premium.price??''});
  }else setPremium({message:'お支払いの完了を待っています。完了すると自動で有効になります。'});
 }catch(e){
  purchasing=false;
  const text=errText(e),cancelled=/cancel/i.test(text);track('premium_fail',{cancelled,msg:text.slice(0,90)});
  // the result did not come back / already owned: re-read the store before saying anything
  if(!cancelled)await refreshPremium();
  setPremium({message:premium.owned?'プレミアムパスを有効にしました。ありがとうございます！':cancelled?'購入をキャンセルしました。':/pending|PURCHASE_STATE_2/i.test(text)?'お支払いの完了を待っています。完了すると自動で有効になります。':/RESULT_LOST/.test(text)?'購入の結果を確認できませんでした。お支払いが済んでいれば、次に開いたときに有効になります。':'購入を完了できませんでした。通信状態を確認して、もう一度お試しください。'});
 }finally{
  purchasing=false;setPremium({busy:false});void refreshPremium();
 }
}
async function restorePremium(){
 if(premium.busy)return;
 setPremium({busy:true,message:''});
 try{await store(()=>NativePurchases.restorePurchases(),60000);}catch{/* still re-query below */}
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
 // RevenueCat の記録(observer)は消費の前に。消費した購入は端末から読めなくなる。最長で数秒待つだけで、失敗しても先へ進む。
 await recordPurchase(pack.id);
 try{
  // 1回だけのパック(pt_first_30000)は消費しない(Play が同じアカウントでの2回目を止める)。受け取りの確認だけ伝える。
  if(isOncePack(pack.id)){markOncePack(pack.id);setPacks({});if(platform==='ios'||t.isAcknowledged!==true)await store(()=>NativePurchases.acknowledgePurchase({purchaseToken:token}));}
  else if(platform==='android')await store(()=>NativePurchases.consumePurchase({purchaseToken:token}));
  else await store(()=>NativePurchases.acknowledgePurchase({purchaseToken:token}));
 }catch{/* retried at the next start from getPurchases */}
 return true;
}
let packsRefreshing:Promise<void>|null=null;
function refreshPacks():Promise<void>{
 return packsRefreshing??=(async()=>{
  try{
   const {products}=await store(()=>NativePurchases.getProducts({productIdentifiers:pointPackIds,productType:PURCHASE_TYPE.INAPP}));
   const prices:Record<string,string>={};for(const p of products)if(p.priceString&&packById(p.identifier))prices[p.identifier]=p.priceString;
   setPacks({status:Object.keys(prices).length?'ready':'unavailable',prices});
  }catch(e){
   track('store_error',{step:'pack_products',msg:errText(e).slice(0,90)});
   // 取れていた価格は残す(一時的な通信の失敗で買えなくしない)。
   setPacks({status:Object.keys(packs.prices).length?'ready':'unavailable'});
  }
  // 前回アプリが途中で閉じた購入(支払い済み・未消費)を拾う。
  try{
   const {purchases}=await store(()=>NativePurchases.getPurchases({productType:PURCHASE_TYPE.INAPP}));
   for(const t of purchases)if(validPack(t))await fulfil(t);
  }catch{/* offline */}
 })().finally(()=>{packsRefreshing=null;});
}
// ストアにつながらなかった時: ショップを開いた時と「もう一度読み込む」で読み直す。
let lastStoreRetry=0;
function refreshStore(force=false){
 if(purchasing||packs.busy||premium.busy)return;
 const now=Date.now();if(!force&&now-lastStoreRetry<10000)return;lastStoreRetry=now;
 if(force||packs.status==='unavailable'){setPacks({status:'checking',message:''});void refreshPacks();}
 if(force||premium.status==='unavailable')void refreshPremium();
}
async function buyPack(id:string){
 const pack=packById(id);
 if(!pack||packs.busy||!packs.prices[id])return;
 setPacks({busy:true,message:''});track('pack_begin',{id});
 try{
  purchasing=true;
  const t=await purchaseCall(()=>NativePurchases.purchaseProduct({productIdentifier:id,productType:PURCHASE_TYPE.INAPP,quantity:1,isConsumable:false,autoAcknowledgePurchases:false}));
  purchasing=false;
  if(validPack(t)&&await fulfil(t))setPacks({message:`${pack.points.toLocaleString('ja-JP')} pt を受け取りました。ありがとうございます！`});
  else setPacks({message:'お支払いの完了を待っています。完了すると次に開いたときに受け取れます。'});
 }catch(e){
  purchasing=false;
  const text=errText(e),cancelled=/cancel/i.test(text);track('pack_fail',{id,cancelled,msg:text.slice(0,90)});
  // 結果が届かなかった・前の購入が未消費(ITEM_ALREADY_OWNED)の時は、ストアを読み直して受け取る。
  const before=readLedger().granted.length;
  if(!cancelled)await refreshPacks();
  const got=readLedger().granted.length>before;
  setPacks({message:got?'お支払い済みのポイントを受け取りました。ありがとうございます！':cancelled?'購入をキャンセルしました。':/pending|PURCHASE_STATE_2/i.test(text)?'お支払いの完了を待っています。完了すると次に開いたときに受け取れます。':/RESULT_LOST/.test(text)?'購入の結果を確認できませんでした。お支払いが済んでいれば、次に開いたときに受け取れます。':'購入を完了できませんでした。通信状態を確認して、もう一度お試しください。'});
 }finally{purchasing=false;setPacks({busy:false});}
}

// ---------- ads ----------
// iOS never asks for tracking permission (no ATT), and the App Store privacy label says no tracking, so iOS always requests non-personalized ads.
const adOptions=(adId:string)=>({adId,isTesting:config.useTestAds,npa:config.nonPersonalizedAds||platform==='ios'});
let rewardLoaded=false,rewardLoading:Promise<void>|null=null,interstitialLoaded=false,interstitialLoading:Promise<void>|null=null,fullscreen=false,lastFullscreenAt=0,adsInit:Promise<void>|null=null;
function initAds():Promise<void>{
 return adsInit??=(async()=>{
  try{
   await withTimeout(AdMob.initialize({initializeForTesting:config.useTestAds}),15000);
   // UMP: a consent request that never answers must not leave the ad button waiting forever.
   // 2026-11-01: a failed consent request (offline, no consent message set up) used to leave
   // adsAllowed false for the whole session, so「広告を見る」always said it could not load.
   // Japan needs no consent form: when UMP itself fails, still request ads (the SDK only
   // serves what the region allows). A real "consent required, not given" still blocks.
   let info:Awaited<ReturnType<typeof AdMob.requestConsentInfo>>|null=null;
   try{
    info=await withTimeout(AdMob.requestConsentInfo(),10000);
    if(!info.canRequestAds&&info.isConsentFormAvailable&&info.status===AdmobConsentStatus.REQUIRED)info=await AdMob.showConsentForm();
   }catch(e){track('ad_error',{step:'consent_request',msg:errText(e).slice(0,90)});}
   privacyOptions=!!info&&String(info.privacyOptionsRequirementStatus)==='REQUIRED';
   adsAllowed=info?info.canRequestAds||info.status!==AdmobConsentStatus.REQUIRED:true;emit();
   if(!adsAllowed)track('ad_error',{step:'consent',msg:String(info?.status)});
   if(adsAllowed){void preloadReward();void preloadInterstitial();}
  }catch(e){
   // Japan needs no consent form; if UMP itself failed (offline, misconfigured message),
   // ads may still be requested — the SDK only serves what the region allows.
   track('ad_error',{step:'init',msg:errText(e).slice(0,90)});
   adsInit=null;
  }
 })();
}
let rewardError='',rewardLoadedAt=0;
function preloadReward(){
 if(!adsAllowed||rewardLoaded)return Promise.resolve();
 return rewardLoading??=AdMob.prepareRewardVideoAd(adOptions(ids.rewardedId)).then(()=>{rewardLoaded=true;rewardLoadedAt=Date.now();rewardError='';},e=>{rewardLoaded=false;rewardError=errText(e).slice(0,90);track('ad_error',{step:'reward_load',msg:rewardError});}).finally(()=>{rewardLoading=null;});
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
  await withTimeout(initAds(),20000).catch(()=>{});
  if(!adsAllowed){track(event,{outcome:'failed',reason:'not_ready'});return 'failed';}
  // a loaded ad expires after an hour: load a fresh one instead of failing to show
  if(rewardLoaded&&Date.now()-rewardLoadedAt>50*60*1000)rewardLoaded=false;
  if(!rewardLoaded)await withTimeout(preloadReward(),20000).catch(()=>{});
  if(!rewardLoaded){track(event,{outcome:'failed',reason:rewardError||'load_timeout'});return 'failed';}
  let granted=false,showFailed=false,done!:()=>void;const closed=new Promise<void>(r=>{done=r;});
  handles.push(await AdMob.addListener(RewardAdPluginEvents.Dismissed,()=>done()));
  handles.push(await AdMob.addListener(RewardAdPluginEvents.FailedToShow,()=>{showFailed=true;done();}));
  rewardLoaded=false;fullscreen=true;
  // The reward is granted ONLY from the SDK's earned-reward callback (this promise
  // resolves from onUserEarnedReward / userDidEarnRewardHandler), and only once.
  AdMob.showRewardVideoAd().then(()=>{
   if(granted)return;granted=true;
   write(key,JSON.stringify(spendDaily(parseDaily(read(key)),localDay())));
   try{onReward(amount);}finally{emit();}
  },()=>{showFailed=true;done();});
  await Promise.race([closed,sleep(180000)]);
  await sleep(500);// a reward callback may land just after dismissal
  const outcome:RewardOutcome=granted?'rewarded':showFailed?'failed':'dismissed';
  track(event,{outcome,...(showFailed?{reason:'show_failed'}:{})});
  return outcome;
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
 if(!interstitialDue(reason,{premium:premium.owned,lastShownAt:Math.max(p.lastShownAt,lastFullscreenAt),now:Date.now(),scoutsSince:p.scoutsSince,launchedAt}))return false;
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
 refreshStore:(force?:boolean)=>refreshStore(!!force),
};

// Called synchronously from runtime.ts (native only) before the game renders.
export function installMonetize(){
 if(window.diamondMonetize)return;
 window.diamondMonetize=bridge;
 void refreshPremium();void refreshPacks();
 // Start the ad SDK after the first paint so the game appears without waiting.
 setTimeout(()=>{void initAds();},1500);
 // RevenueCat は記録だけ(購入・消費はこのファイルのまま)。
 setTimeout(()=>{void initRevenueCat();},2500);
 if(platform==='ios')void NativePurchases.addListener('transactionUpdated',()=>{void refreshPremium();}).catch(()=>{});
 let lastResume=0;
 void App.addListener('resume',()=>{
  const now=Date.now();if(now-lastResume<30000)return;lastResume=now;
  // never while a purchase sheet is open: a refresh would end the purchase's billing client
  if(!purchasing){void refreshPremium();void refreshPacks();}
  if(!adsAllowed)void initAds();else void preloadReward();
  emit();// emit: daily counters roll over at midnight
 }).catch(()=>{});
}
