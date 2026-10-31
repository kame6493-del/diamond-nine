// RevenueCat, record-only (observer mode, 2026-11-01).
// Purchases are still made, acknowledged and consumed by monetize.ts through
// @capgo/native-purchases. RevenueCat never buys, finishes or consumes anything here
// (purchasesAreCompletedBy: MY_APP); it is only told about purchases so the RevenueCat
// dashboard shows revenue. Every call is wrapped and time-limited: a RevenueCat failure
// must never stop or delay a purchase for long, and never throws into the game.
import {Capacitor} from '@capacitor/core';
import {Purchases,LOG_LEVEL,PURCHASES_ARE_COMPLETED_BY_TYPE,STOREKIT_VERSION} from '@revenuecat/purchases-capacitor';
import keys from './revenuecat-config.json';

const platform=Capacitor.getPlatform()==='ios'?'ios':'android';
const apiKey=String((keys as Record<string,unknown>)[platform]??'');
const SYNCED_KEY='diamond-nine-rc-synced';
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
const capped=(p:Promise<unknown>,ms:number)=>Promise.race([p.then(()=>true,()=>false),sleep(ms).then(()=>false)]);

let ready:Promise<boolean>|null=null;
export function initRevenueCat():Promise<boolean>{
 return ready??=(async()=>{
  if(!apiKey)return false;
  try{
   await Purchases.setLogLevel({level:LOG_LEVEL.WARN}).catch(()=>{});
   await Purchases.configure({apiKey,purchasesAreCompletedBy:{type:PURCHASES_ARE_COMPLETED_BY_TYPE.MY_APP,storeKitVersion:STOREKIT_VERSION.STOREKIT_2}});
   // Once per install (Android): send purchases that are still on the device, such as a
   // premium pass bought before this version. Consumed point packs are no longer on the device.
   if(platform==='android'){
    let done=false;try{done=localStorage.getItem(SYNCED_KEY)==='1';}catch{/* no storage */}
    if(!done)void Purchases.syncPurchases().then(()=>{try{localStorage.setItem(SYNCED_KEY,'1');}catch{/* next start */}},()=>{});
   }
   return true;
  }catch{ready=null;return false;}
 })();
}

// One RevenueCat call at a time, like the store queue in monetize.ts.
let chain:Promise<unknown>=Promise.resolve();
// Tell RevenueCat about one purchase. Call it BEFORE the purchase is consumed (Android) or
// finished (iOS): a consumed Play purchase can no longer be found on the device.
// Waits at most `ms`; the purchase flow continues either way.
export function recordPurchase(productId:string,ms=6000):Promise<boolean>{
 const run=chain.then(async()=>{
  if(!await capped(initRevenueCat().then(ok=>{if(!ok)throw new Error('off');}),3000))return false;
  // Android: sync reads the device's purchases with RevenueCat's own billing client.
  // iOS (StoreKit 2): record the newest transaction of that product.
  return capped(platform==='android'?Purchases.syncPurchases():Purchases.recordPurchase({productID:productId}),ms);
 });
 chain=run.catch(()=>{});
 return Promise.race([run.catch(()=>false),sleep(ms+3500).then(()=>false)]);
}
