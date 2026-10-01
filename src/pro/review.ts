import {track} from './analytics';

// Store rating prompt (App Store / Google Play in-app review). The native runtime
// sets window.diamondReview; the web build never asks. We only ask right after a
// happy moment, never in the first days, and at most once per REVIEW_GAP_DAYS.
// The stores add their own caps and may show nothing; we never learn the result.
export interface ReviewBridge {request(): Promise<void>}
declare global {interface Window {diamondReview?: ReviewBridge}}
export type ReviewMoment='title'|'rainbow';
export const REVIEW_GAP_DAYS=60;
export const REVIEW_MIN_DAYS_PLAYED=2;
const KEY='diamond-nine-review';
interface ReviewRecord {days:string[];askedAt:number}
const DAY=86400000;

export function parseReview(raw:string|null):ReviewRecord{
 try{const v=raw?JSON.parse(raw):null;
  if(v&&Array.isArray(v.days)&&Number.isFinite(v.askedAt))return {days:v.days.filter((d:unknown)=>typeof d==='string').slice(-10),askedAt:v.askedAt};
 }catch{/* default */}
 return {days:[],askedAt:0};
}
export const reviewDue=(r:ReviewRecord,now:number)=>r.days.length>=REVIEW_MIN_DAYS_PLAYED&&now-r.askedAt>=REVIEW_GAP_DAYS*DAY;
export const notePlayDay=(r:ReviewRecord,day:string):ReviewRecord=>r.days.includes(day)?r:{...r,days:[...r.days,day].slice(-10)};

const read=()=>{try{return parseReview(localStorage.getItem(KEY));}catch{return parseReview(null);}};
const write=(r:ReviewRecord)=>{try{localStorage.setItem(KEY,JSON.stringify(r));}catch{/* ask again later */}};
export function noteReviewPlayDay(day:string){if(typeof localStorage==='undefined')return;const r=read(),n=notePlayDay(r,day);if(n!==r)write(n);}
export function maybeAskReview(moment:ReviewMoment,now=Date.now()):boolean{
 if(typeof window==='undefined'||!window.diamondReview)return false;
 const r=read();if(!reviewDue(r,now))return false;
 write({...r,askedAt:now});track('review_prompt',{moment});
 void window.diamondReview.request().catch(()=>{});
 return true;
}
