import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DAILY_ALL_BONUS,DAILY_LOGIN_POINTS,DAILY_MISSIONS,LAUNCH_GIFT,claimLogin,claimMission,freshDay,launchGiftOpen,markMission,noteDailyMission,parseDailyRecord,takeDailyLogin,takeLaunchGift} from '../src/pro/daily';
import {DailyPanel} from '../src/pro/DailyPanel';
import {REVIEW_GAP_DAYS,maybeAskReview,notePlayDay,parseReview,reviewDue} from '../src/pro/review';
import {FEEDBACK_FORM,deviceLabel,feedbackUrl} from '../src/pro/feedback';

const memoryStorage=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,String(v));},removeItem:(k:string)=>{m.delete(k);},clear:()=>m.clear(),key:()=>null,length:0};};
const withStorage=<T,>(run:()=>T)=>{const g=globalThis as {localStorage?:unknown};const old=g.localStorage;g.localStorage=memoryStorage();try{return run();}finally{g.localStorage=old;}};
const DAY=86400000;

export function registerRetentionTests(test:(name:string,run:()=>void)=>void){
 test('daily goals pay each reward once per local day, add the all-clear bonus once, and reset the next day',()=>{
  let r=freshDay('2026-10-20'),total=0,p=0;
  [r,p]=claimLogin(r);total+=p;[r,p]=claimLogin(r);total+=p;assert.equal(total,DAILY_LOGIN_POINTS);
  [r,p]=claimMission(r,'play');assert.equal(p,0,'cannot claim before doing it');
  for(const m of DAILY_MISSIONS){r=markMission(markMission(r,m.id),m.id);}
  assert.equal(r.done.length,3);
  const perMission=DAILY_MISSIONS.map(m=>{const got=claimMission(r,m.id);r=got[0];return got[1];});
  assert.deepEqual(perMission,[300,300,500+DAILY_ALL_BONUS]);assert.equal(r.all,true);
  assert.equal(claimMission(r,'share')[1],0);
  const saved=JSON.stringify(r);assert.deepEqual(parseDailyRecord(saved,'2026-10-20'),r);assert.deepEqual(parseDailyRecord(saved,'2026-10-21'),freshDay('2026-10-21'));
  for(const bad of ['{bad',JSON.stringify({day:'2026-10-20',login:'yes',done:[],claimed:[],all:false}),JSON.stringify({...r,claimed:['play','x'],done:['scout']})]){
   const parsed=parseDailyRecord(bad,'2026-10-20');assert.ok(parsed.claimed.every(c=>parsed.done.includes(c)));assert.ok(!parsed.all||parsed.claimed.length===3);
  }
  const max=DAILY_LOGIN_POINTS+DAILY_MISSIONS.reduce((n,m)=>n+m.points,0)+DAILY_ALL_BONUS;assert.equal(max,2100);
 });
 test('storage-backed daily helpers are idempotent and silent outside the browser',()=>{
  assert.equal(takeDailyLogin(),0);assert.doesNotThrow(()=>noteDailyMission('play'));assert.equal(takeLaunchGift(),0);
  withStorage(()=>{
   assert.equal(takeDailyLogin(),DAILY_LOGIN_POINTS);assert.equal(takeDailyLogin(),0);
   const inWindow=new Date(2026,10,30,23,0),after=new Date(2026,11,1,0,5);
   assert.equal(launchGiftOpen(inWindow),true);assert.equal(launchGiftOpen(after),false);
   assert.equal(takeLaunchGift(after),0);assert.equal(takeLaunchGift(inWindow),LAUNCH_GIFT.points);assert.equal(takeLaunchGift(inWindow),0);
  });
 });
 test('daily panel lists three goals and only shows a claim button for finished, unclaimed ones',()=>{
  withStorage(()=>{
   const html=renderToStaticMarkup(createElement(DailyPanel,{onReward:()=>{}}));
   for(const m of DAILY_MISSIONS)assert.ok(html.includes(m.label));assert.ok(!html.includes('daily-claim'));assert.ok(html.includes('あと3つ'));
  });
 });
 test('the rating prompt waits for two play days and a happy moment, then stays quiet for the gap',()=>{
  const now=Date.UTC(2026,9,20);let r=parseReview(null);
  assert.equal(reviewDue(r,now),false);r=notePlayDay(notePlayDay(r,'2026-10-19'),'2026-10-19');assert.equal(reviewDue(r,now),false);
  r=notePlayDay(r,'2026-10-20');assert.equal(reviewDue(r,now),true);
  assert.equal(reviewDue({...r,askedAt:now},now+(REVIEW_GAP_DAYS-1)*DAY),false);assert.equal(reviewDue({...r,askedAt:now},now+REVIEW_GAP_DAYS*DAY),true);
  assert.deepEqual(parseReview('{bad'),{days:[],askedAt:0});
  const g=globalThis as {window?:unknown;localStorage?:unknown},oldW=g.window;let asked=0;
  assert.equal(maybeAskReview('title',now),false,'no bridge on the web');
  withStorage(()=>{
   g.window={diamondReview:{request:async()=>{asked++;}}};
   try{
    assert.equal(maybeAskReview('title',now),false);
    (g.localStorage as Storage).setItem('diamond-nine-review',JSON.stringify(r));
    assert.equal(maybeAskReview('rainbow',now),true);assert.equal(maybeAskReview('title',now+DAY),false);assert.equal(asked,1);
   }finally{g.window=oldW;}
  });
 });
 test('feedback form link names the build and device and nothing else',()=>{
  const android=deviceLabel({Capacitor:{getPlatform:()=>'android'},diamondAppVersion:'1.1 (11)',navigator:{userAgent:'Mozilla/5.0 (Linux; Android 15; 2506BPN68R) Chrome/130'}});
  assert.equal(android,'Androidアプリ / 1.1 (11) / Android 15');
  assert.equal(deviceLabel({navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)'}}),'ブラウザ版 / iPhone; CPU iPhone OS 18.1');
  const url=new URL(feedbackUrl(android));assert.equal(url.origin+url.pathname,FEEDBACK_FORM);assert.equal(url.searchParams.get('entry.896994809'),android);
  assert.deepEqual([...url.searchParams.keys()].sort(),['entry.896994809','usp']);
 });
}
