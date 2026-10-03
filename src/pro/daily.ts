import {useSyncExternalStore} from 'react';

// Daily reasons to open the game: a login bonus and three small goals, reset on
// the player's local calendar day. Kept outside the club save (like the tutorial)
// so resets, imports and profile switches never re-grant a day's rewards.
export type DailyMission='play'|'scout'|'share';
export const DAILY_MISSIONS:{id:DailyMission;label:string;points:number}[]=[
 {id:'play',label:'試合を進める',points:300},
 {id:'scout',label:'スカウトを1回引く',points:300},
 {id:'share',label:'記録や当たりをシェア（画像の保存でもOK）',points:500},
];
export const DAILY_LOGIN_POINTS=500;
export const DAILY_ALL_BONUS=500;
// One-time gift for everyone who starts the game around the public launch.
export const LAUNCH_GIFT={id:'launch-2026',points:30000,until:'2026-11-30'} as const;

export interface DailyRecord {day:string;login:boolean;done:DailyMission[];claimed:DailyMission[];all:boolean}
const KEY='diamond-nine-daily',GIFT_KEY='diamond-nine-gift-'+LAUNCH_GIFT.id;
const ids=new Set<string>(DAILY_MISSIONS.map(m=>m.id));
export const localDay=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const freshDay=(day:string):DailyRecord=>({day,login:false,done:[],claimed:[],all:false});
export function parseDailyRecord(raw:string|null,day:string):DailyRecord{
 try{
  const v=raw?JSON.parse(raw):null;
  if(!v||v.day!==day||typeof v.login!=='boolean'||typeof v.all!=='boolean'||!Array.isArray(v.done)||!Array.isArray(v.claimed))return freshDay(day);
  const done=[...new Set(v.done.filter((m:string)=>ids.has(m)))] as DailyMission[];
  const claimed=[...new Set(v.claimed.filter((m:string)=>done.includes(m as DailyMission)))] as DailyMission[];
  return {day,login:v.login,done,claimed,all:v.all&&claimed.length===DAILY_MISSIONS.length};
 }catch{return freshDay(day);}
}
// Pure transitions. Each returns [next record, points to add]; points are 0 when nothing changes.
export const claimLogin=(r:DailyRecord):[DailyRecord,number]=>r.login?[r,0]:[{...r,login:true},DAILY_LOGIN_POINTS];
export const markMission=(r:DailyRecord,m:DailyMission):DailyRecord=>r.done.includes(m)?r:{...r,done:[...r.done,m]};
export function claimMission(r:DailyRecord,m:DailyMission):[DailyRecord,number]{
 if(!r.done.includes(m)||r.claimed.includes(m))return [r,0];
 const next={...r,claimed:[...r.claimed,m]},mission=DAILY_MISSIONS.find(x=>x.id===m)!;
 if(!next.all&&next.claimed.length===DAILY_MISSIONS.length)return [{...next,all:true},mission.points+DAILY_ALL_BONUS];
 return [next,mission.points];
}
export const launchGiftOpen=(now=new Date())=>localDay(now)<=LAUNCH_GIFT.until;

// ---- storage + subscription (browser) ----
const listeners=new Set<()=>void>();
let cache:{raw:string|null;day:string;value:DailyRecord}|null=null;
const read=(k:string)=>{try{return localStorage.getItem(k);}catch{return null;}};
const write=(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch{/* stays in memory this session */}};
export function dailySnapshot(now=new Date()):DailyRecord{
 const day=localDay(now),raw=read(KEY);
 if(!cache||cache.raw!==raw||cache.day!==day)cache={raw,day,value:parseDailyRecord(raw,day)};
 return cache.value;
}
function save(r:DailyRecord){const raw=JSON.stringify(r);write(KEY,raw);cache={raw,day:r.day,value:r};for(const l of listeners)l();}
export const subscribeDaily=(l:()=>void)=>{listeners.add(l);return()=>{listeners.delete(l);};};
export const useDaily=()=>useSyncExternalStore(subscribeDaily,()=>dailySnapshot(),()=>freshDay(localDay()));
// Called from game actions; safe outside the browser (tests, server render).
export function noteDailyMission(m:DailyMission){if(typeof localStorage==='undefined')return;const r=dailySnapshot();const n=markMission(r,m);if(n!==r)save(n);}
export function takeDailyLogin():number{if(typeof localStorage==='undefined')return 0;const [n,p]=claimLogin(dailySnapshot());if(p)save(n);return p;}
export function takeDailyMission(m:DailyMission):number{const [n,p]=claimMission(dailySnapshot(),m);if(p)save(n);return p;}
export function takeLaunchGift(now=new Date()):number{
 if(typeof localStorage==='undefined'||!launchGiftOpen(now)||read(GIFT_KEY))return 0;
 write(GIFT_KEY,localDay(now));return read(GIFT_KEY)?LAUNCH_GIFT.points:0;// no gift if it cannot be recorded
}
