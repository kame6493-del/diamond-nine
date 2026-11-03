import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DAILY_ALL_BONUS,DAILY_LOGIN_POINTS,DAILY_MISSIONS,LAUNCH_GIFT,claimLogin,claimMission,freshDay,launchGiftOpen,markMission,noteDailyMission,parseDailyRecord,takeDailyLogin,takeLaunchGift} from '../src/pro/daily';
import {DailyPanel} from '../src/pro/DailyPanel';
import {REVIEW_GAP_DAYS,REVIEW_MAX_ASKS,REVIEW_MIN_DAYS_INSTALLED,REVIEW_PAYWALL_QUIET_MIN,maybeAskReview,notePlayDay,noteReviewPaywall,parseReview,reviewDue,reviewMoment} from '../src/pro/review';
import {FEEDBACK_FORM,deviceLabel,feedbackUrl} from '../src/pro/feedback';
import {seasonGoals} from '../src/pro/ambitions';
import {AUTUMN_EVENT,autumnEventActive,claimAutumnBonus} from '../src/pro/autumn-event';
import {REMINDER_HOUR,nextReminders,reminderAskDue} from '../src/pro/reminder';
import {initialState,simulateDays} from '../src/pro/engine';
import {seasonGames} from '../src/pro/leagues';

const memoryStorage=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,String(v));},removeItem:(k:string)=>{m.delete(k);},clear:()=>m.clear(),key:()=>null,length:0};};
const withStorage=<T,>(run:()=>T)=>{const g=globalThis as {localStorage?:unknown};const old=g.localStorage;g.localStorage=memoryStorage();try{return run();}finally{g.localStorage=old;}};
const DAY=86400000;

export function registerRetentionTests(test:(name:string,run:()=>void)=>void){
 test('daily goals pay each reward once per local day, add the all-clear bonus once, and reset the next day',()=>{
  let r=freshDay('2026-10-20'),total=0,p=0;
  [r,p]=claimLogin(r);total+=p;[r,p]=claimLogin(r);total+=p;assert.equal(total,DAILY_LOGIN_POINTS);
  [r,p]=claimMission(r,'play');assert.equal(p,0,'cannot claim before doing it');
  for(const m of DAILY_MISSIONS){r=markMission(markMission(r,m.id),m.id);}
  assert.equal(r.done.length,5);
  const perMission=DAILY_MISSIONS.map(m=>{const got=claimMission(r,m.id);r=got[0];return got[1];});
  assert.deepEqual(perMission,[100,100,150,150,100+DAILY_ALL_BONUS]);assert.equal(r.all,true);
  assert.equal(claimMission(r,'share')[1],0);
  const saved=JSON.stringify(r);assert.deepEqual(parseDailyRecord(saved,'2026-10-20'),r);assert.deepEqual(parseDailyRecord(saved,'2026-10-21'),freshDay('2026-10-21'));
  for(const bad of ['{bad',JSON.stringify({day:'2026-10-20',login:'yes',done:[],claimed:[],all:false}),JSON.stringify({...r,claimed:['play','x'],done:['scout']})]){
   const parsed=parseDailyRecord(bad,'2026-10-20');assert.ok(parsed.claimed.every(c=>parsed.done.includes(c)));assert.ok(!parsed.all||parsed.claimed.length===3);
  }
  const max=DAILY_LOGIN_POINTS+DAILY_MISSIONS.reduce((n,m)=>n+m.points,0)+DAILY_ALL_BONUS;assert.equal(max,900);// 2026-11-02 vc36: 2,000 → 900
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
 test('daily panel lists five goals and only shows a claim button for finished, unclaimed ones',()=>{
  withStorage(()=>{
   const html=renderToStaticMarkup(createElement(DailyPanel,{onReward:()=>{}}));
   for(const m of DAILY_MISSIONS)assert.ok(html.includes(m.label));assert.ok(!html.includes('daily-claim'));assert.ok(html.includes('あと5つ'));
  });
 });
 test('the rating prompt waits 3 days from install and two play days, then stays quiet 30 days, at most 3 times (vc42)',()=>{
  const t0=Date.UTC(2026,9,20,3);let r=parseReview(null);
  assert.deepEqual([REVIEW_GAP_DAYS,REVIEW_MIN_DAYS_INSTALLED,REVIEW_MAX_ASKS,REVIEW_PAYWALL_QUIET_MIN],[30,3,3,30]);
  assert.equal(reviewDue(r,t0),false);
  r=notePlayDay(notePlayDay(r,'2026-10-20',t0),'2026-10-20',t0+1000);assert.equal(r.firstAt,t0,'first launch is kept');
  r=notePlayDay(r,'2026-10-21',t0+DAY);
  assert.equal(reviewDue(r,t0+DAY),false,'two play days but only 1 day since install');
  assert.equal(reviewDue(r,t0+3*DAY-1),false);assert.equal(reviewDue(r,t0+3*DAY),true);
  // one play day only: not yet, even after a week
  assert.equal(reviewDue(notePlayDay(parseReview(null),'2026-10-20',t0),t0+7*DAY),false);
  // ask -> 29 days quiet -> 30th day ok -> 3 asks max
  const now=t0+3*DAY;let x=reviewMoment(r,'title',now);assert.equal(x.ask,true);assert.equal(x.record.asks,1);
  assert.equal(reviewMoment(x.record,'title',now+29*DAY).ask,false);
  x=reviewMoment(x.record,'title',now+30*DAY);assert.equal(x.ask,true);assert.equal(x.record.asks,2);
  x=reviewMoment(x.record,'title',now+60*DAY);assert.equal(x.ask,true);assert.equal(x.record.asks,3);
  assert.equal(reviewMoment(x.record,'title',now+3000*DAY).ask,false,'never a 4th time');
  // a moment that does not ask does not count
  assert.deepEqual(reviewMoment(r,'title',t0+DAY).record,r);
 });
 test('gold and rainbow count only the first card of each tier; a title counts every time',()=>{
  const t0=Date.UTC(2026,9,20,3),now=t0+5*DAY;
  const r=notePlayDay(notePlayDay(parseReview(null),'2026-10-20',t0),'2026-10-21',t0+DAY);
  // first gold on day 1 (too early): no ask, but the first gold is used up
  let x=reviewMoment(r,'gold',t0+DAY);assert.equal(x.ask,false);assert.deepEqual(x.record.tiers,['gold']);
  assert.equal(reviewMoment(x.record,'gold',now).ask,false,'second gold is not a first');
  x=reviewMoment(x.record,'rainbow',now);assert.equal(x.ask,true,'first rainbow after day 3');assert.deepEqual(x.record.tiers,['gold','rainbow']);
  const later=reviewMoment(x.record,'rainbow',now+40*DAY);assert.equal(later.ask,false);
  assert.equal(reviewMoment(x.record,'title',now+40*DAY).ask,true);
 });
 test('no rating prompt within 30 minutes of a purchase screen',()=>{
  const t0=Date.UTC(2026,9,20,3),now=t0+5*DAY;
  const r={...notePlayDay(notePlayDay(parseReview(null),'2026-10-20',t0),'2026-10-21',t0+DAY),paywallAt:now-29*60000};
  assert.equal(reviewMoment(r,'title',now).ask,false);
  assert.equal(reviewMoment(r,'title',now+60000).ask,true);
 });
 test('older saves keep working: first play day becomes the install day and a past ask counts once',()=>{
  const r=parseReview(JSON.stringify({days:['2026-10-01','2026-10-02'],askedAt:Date.UTC(2026,9,5)}));
  assert.equal(r.firstAt,Date.parse('2026-10-01T00:00:00'));assert.equal(r.asks,1);assert.deepEqual(r.tiers,[]);assert.equal(r.paywallAt,0);
  assert.deepEqual(parseReview('{bad'),{days:[],askedAt:0,firstAt:0,asks:0,tiers:[],paywallAt:0});
  assert.equal(parseReview(JSON.stringify({days:[],askedAt:0,asks:9})).asks,REVIEW_MAX_ASKS);
  assert.deepEqual(parseReview(JSON.stringify({days:[],askedAt:0,tiers:['gold','x',1]})).tiers,['gold']);
 });
 test('the bridge is the store window only: web never asks, the app asks once and remembers it on the device',()=>{
  const t0=Date.UTC(2026,9,20,3),now=t0+5*DAY;
  const r=notePlayDay(notePlayDay(parseReview(null),'2026-10-20',t0),'2026-10-21',t0+DAY);
  const g=globalThis as {window?:unknown;localStorage?:unknown},oldW=g.window;let asked=0;
  assert.equal(maybeAskReview('title',now),false,'no bridge on the web');
  withStorage(()=>{
   g.window={diamondReview:{request:async()=>{asked++;}}};
   try{
    assert.equal(maybeAskReview('title',now),false,'nothing recorded yet');
    (g.localStorage as Storage).setItem('diamond-nine-review',JSON.stringify(r));
    noteReviewPaywall(now-60000);assert.equal(maybeAskReview('title',now),false,'right after the shop');
    assert.equal(maybeAskReview('rainbow',now+31*60000),true);assert.equal(maybeAskReview('title',now+DAY),false);assert.equal(asked,1);
    const saved=parseReview((g.localStorage as Storage).getItem('diamond-nine-review'));
    assert.equal(saved.asks,1);assert.deepEqual(saved.tiers,['rainbow']);assert.equal(saved.askedAt,now+31*60000);
   }finally{g.window=oldW;}
  });
 });
 test('the rating prompt is wired only to happy moments: a won title, first gold/rainbow card; the shop marks the quiet time',()=>{
  const app=readFileSync('src/pro/SimpleApp.tsx','utf8'),calls=app.match(/maybeAskReview\([^)]*\)/g)??[];
  assert.deepEqual([...calls].sort(),["maybeAskReview('title')","maybeAskReview(tier)"]);
  assert.ok(app.includes("if(tier==='rainbow'||tier==='gold')setTimeout(()=>maybeAskReview(tier),1800);"));
  assert.ok(/next\.season\.postseason\.champion===next\.club\)setTimeout\(\(\)=>maybeAskReview\('title'\)/.test(app),'title: right after the season is won');
  assert.ok(!/onNext=\{[^}]*maybeAskReview/.test(app),'not on the next-season button (the interstitial ad shows there)');
  for(const f of ['src/pro/PackShop.tsx','src/pro/MonetizePanel.tsx'])assert.ok(readFileSync(f,'utf8').includes('noteReviewPaywall()'),f);
  const src=readFileSync('src/pro/review.ts','utf8');assert.ok(!/星|★|stars?\b|rating\s*[<>]/i.test(src.replace(/\/\/.*$/gm,'')),'no star picker or rating filter of our own');
 });
 test('feedback form link names the build and device and nothing else',()=>{
  const android=deviceLabel({Capacitor:{getPlatform:()=>'android'},diamondAppVersion:'1.1 (11)',navigator:{userAgent:'Mozilla/5.0 (Linux; Android 15; 2506BPN68R) Chrome/130'}});
  assert.equal(android,'Androidアプリ / 1.1 (11) / Android 15');
  assert.equal(deviceLabel({navigator:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)'}}),'ブラウザ版 / iPhone; CPU iPhone OS 18.1');
  const url=new URL(feedbackUrl(android));assert.equal(url.origin+url.pathname,FEEDBACK_FORM);assert.equal(url.searchParams.get('entry.896994809'),android);
  assert.deepEqual([...url.searchParams.keys()].sort(),['entry.896994809','usp']);
 });
 test('rank goals wait for the end of the regular season and match the final table',()=>{
  const start=initialState(7),mid=simulateDays(start,40),end=simulateDays(start,seasonGames(start.season));
  const rankGoals=['out-of-last','winning-record','a-class'],pick=(st:typeof start)=>Object.fromEntries(seasonGoals(st).filter(g=>rankGoals.includes(g.key)).map(g=>[g.key,g.value]));
  assert.deepEqual(pick(mid),{'out-of-last':0,'winning-record':0,'a-class':0});
  assert.equal(end.season.completed,true);
  const me=end.season.standings.find(t=>t.team===end.club)!;assert.equal(pick(end)['winning-record'],me.w>me.l?1:0);
  assert.ok(seasonGoals(end).every(g=>g.id.startsWith('season-1-')));
 });
 test('daily reminders land at 19:00 tomorrow and three days out, and the ask waits for a native app and a finished season',()=>{
  const now=new Date(2026,9,31,23,50),[a,b]=nextReminders(now);
  assert.deepEqual([a.at.getMonth(),a.at.getDate(),a.at.getHours(),a.at.getMinutes()],[10,1,REMINDER_HOUR,0]);
  assert.deepEqual([b.at.getMonth(),b.at.getDate(),b.at.getHours()],[10,3,REMINDER_HOUR]);
  assert.ok(a.at>now&&b.at>a.at);assert.ok(a.body.includes(`${DAILY_LOGIN_POINTS}pt`));assert.ok(!a.body.includes('ドリンク')&&!a.body.includes('行動力'),'vc39: 行動力とドリンクは無い');
  assert.equal(reminderAskDue(3),false,'no bridge outside the app');
 });
 test('autumn showdown week pays its bonus once a day when a season ends, only inside the window',()=>{
  assert.equal(autumnEventActive(new Date(2026,10,3,23,59)),false);assert.equal(autumnEventActive(new Date(2026,10,4,0,0)),true);
  assert.equal(autumnEventActive(new Date(2026,10,16,23,59)),true);assert.equal(autumnEventActive(new Date(2026,10,17,0,0)),false);assert.equal(autumnEventActive(null),false);
  const inside=new Date(2026,10,10,12),start=initialState(5),mid=simulateDays(start,30),end=simulateDays(start,seasonGames(start.season));
  assert.deepEqual(claimAutumnBonus(mid,inside)[1],0,'not before the season ends');
  assert.equal(claimAutumnBonus(end,new Date(2026,10,20))[1],0,'not after the window');
  const [paid,pts]=claimAutumnBonus(end,inside);assert.equal(pts,AUTUMN_EVENT.bonus);assert.equal(paid.gems,end.gems+AUTUMN_EVENT.bonus);
  assert.equal(claimAutumnBonus(paid,inside)[1],0,'once a day');assert.equal(claimAutumnBonus(paid,new Date(2026,10,11,12))[1],AUTUMN_EVENT.bonus,'again the next day');assert.equal(JSON.stringify(end.franchise.claimed).includes('autumn'),false,'input untouched');
 });
}
