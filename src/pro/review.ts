import {track} from './analytics';

// Store rating prompt (App Store / Google Play in-app review). The native runtime
// sets window.diamondReview; the web build never asks. The window is the store's own
// (no star picker of ours, no reward for rating, no routing of low ratings elsewhere).
// 1.4.9 (vc42): we only ask right after a happy moment — a season title, or the first
// gold / first rainbow card ever drawn — and only when all of these hold:
// - 3+ days since the first launch we saw, and 2+ play days
// - 30+ days since the last ask, and fewer than REVIEW_MAX_ASKS asks in total
// - no purchase screen (point packs / premium pass) in the last REVIEW_PAYWALL_QUIET_MIN minutes
// The stores add their own caps and may show nothing; we never learn the result.
// The record lives on the device only (localStorage).
export interface ReviewBridge {request(): Promise<void>}
declare global {interface Window {diamondReview?: ReviewBridge}}
export type ReviewMoment='title'|'gold'|'rainbow';
export const REVIEW_GAP_DAYS=30;
export const REVIEW_MIN_DAYS_PLAYED=2;
export const REVIEW_MIN_DAYS_INSTALLED=3;
export const REVIEW_MAX_ASKS=3;
export const REVIEW_PAYWALL_QUIET_MIN=30;
const KEY='diamond-nine-review';
export interface ReviewRecord {
 days:string[];askedAt:number;
 /** first launch we saw (ms). Older saves: the first recorded play day */
 firstAt:number;
 /** asks so far. Older saves that already asked once count as 1 */
 asks:number;
 /** card tiers already drawn once ('gold' | 'rainbow'): only the first of each is a moment */
 tiers:string[];
 /** last time a purchase screen was shown (ms) */
 paywallAt:number;
}
const DAY=86400000,MIN=60000;
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:0;
const dayStart=(d:string)=>{const t=Date.parse(d+'T00:00:00');return Number.isFinite(t)?t:0;};

export function parseReview(raw:string|null):ReviewRecord{
 try{const v=raw?JSON.parse(raw):null;
  if(v&&Array.isArray(v.days)&&Number.isFinite(v.askedAt)){
   const days=v.days.filter((d:unknown)=>typeof d==='string').slice(-10) as string[],askedAt=num(v.askedAt);
   const firstAt=num(v.firstAt)||(days.length?dayStart(days[0]):0);
   const asks=Math.min(REVIEW_MAX_ASKS,Math.floor(num(v.asks))||(askedAt>0?1:0));
   const tiers=Array.isArray(v.tiers)?v.tiers.filter((t:unknown)=>t==='gold'||t==='rainbow'):[];
   return {days,askedAt,firstAt,asks,tiers,paywallAt:num(v.paywallAt)};
  }
 }catch{/* default */}
 return {days:[],askedAt:0,firstAt:0,asks:0,tiers:[],paywallAt:0};
}
export const reviewDue=(r:ReviewRecord,now:number)=>
 r.days.length>=REVIEW_MIN_DAYS_PLAYED&&
 r.firstAt>0&&now-r.firstAt>=REVIEW_MIN_DAYS_INSTALLED*DAY&&
 r.asks<REVIEW_MAX_ASKS&&
 now-r.askedAt>=REVIEW_GAP_DAYS*DAY&&
 (!r.paywallAt||now-r.paywallAt>=REVIEW_PAYWALL_QUIET_MIN*MIN);
export const notePlayDay=(r:ReviewRecord,day:string,now=Date.now()):ReviewRecord=>{
 const firstAt=r.firstAt||now;
 return r.days.includes(day)?(firstAt===r.firstAt?r:{...r,firstAt}):{...r,firstAt,days:[...r.days,day].slice(-10)};
};
/** Decide one moment. Returns the next record and whether to ask now. Gold/rainbow count only the first time. */
export function reviewMoment(r:ReviewRecord,moment:ReviewMoment,now:number):{record:ReviewRecord;ask:boolean}{
 let next=r,first=true;
 if(moment!=='title'){first=!r.tiers.includes(moment);if(first)next={...r,tiers:[...r.tiers,moment]};}
 const ask=first&&reviewDue(next,now);
 return {record:ask?{...next,askedAt:now,asks:next.asks+1}:next,ask};
}

const read=()=>{try{return parseReview(localStorage.getItem(KEY));}catch{return parseReview(null);}};
const write=(r:ReviewRecord)=>{try{localStorage.setItem(KEY,JSON.stringify(r));}catch{/* ask again later */}};
export function noteReviewPlayDay(day:string){if(typeof localStorage==='undefined')return;const r=read(),n=notePlayDay(r,day);if(n!==r)write(n);}
/** A purchase screen (point packs / premium pass) was shown: stay quiet for a while. */
export function noteReviewPaywall(now=Date.now()){if(typeof localStorage==='undefined')return;write({...read(),paywallAt:now});}
export function maybeAskReview(moment:ReviewMoment,now=Date.now()):boolean{
 if(typeof window==='undefined'||!window.diamondReview)return false;
 const r=read(),{record,ask}=reviewMoment(r,moment,now);
 if(record!==r)write(record);
 if(!ask)return false;
 track('review_prompt',{moment,n:record.asks});
 void window.diamondReview.request().catch(()=>{});
 return true;
}
