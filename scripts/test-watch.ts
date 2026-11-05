// 監督して戦う試合(2026-11-04 vc43 作り直し)の試験。
// 持ち主「今年の名場面を見るとかじゃなくて、CS、開幕戦、日本シリーズが出た場合、自分で監督操作が出来るみたいな感じにして」。
// 1) 「1年進める」は開幕戦・プレーオフ・王座決定戦の前で止まる。全部おまかせなら、止まらない1年と1つも違わない。
// 2) 監督して何も指示しなければ、おまかせと同じ結果。 3) 指示は結果に効き、その結果が勝敗・順位・成績・勝ち上がりに入る。
// 4) 途中で閉じても、覚えた指示の並びで続きから同じ試合になる。セーブは変わらない。 5) 速さの記憶・指示の決まり。 6) 画面。
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,initialSandboxState,emptySeason,simulateDays,substituteBlock,IBB_PER_INNING,type GameResult,type GameState,type LiveSituation,type LiveEvent,type WatchOrder} from '../src/pro/engine';
import {finishPostseason,simulatePostseason} from '../src/pro/postseason';
import {type Circuit} from '../src/pro/leagues';
import {playerMap,canBat} from '../src/pro/data';
import {readSpeed,saveSpeed,paMillis,homeRunMillis,SPEED_KEY,pitchesFor,countOf,gradeOf} from '../src/pro/watch';
import {keyGameAhead,managedGame,advanceKeyDay,commitManaged,liveGame,finishLive,readManage,saveManage,clearManage,manageKey,type ManagedGame} from '../src/pro/managed';
import {PawaSeason} from '../src/pro/pawa/PawaSeason';
import {KeyGameCard} from '../src/pro/SimpleApp';

type Orders=(s:LiveSituation,events:LiveEvent[])=>WatchOrder|null;
/** 画面と同じやり方で試合を回す(渡した値を全部覚える)。 */
function drive(g:ManagedGame,orders:Orders=()=>null,stopAfter=Infinity,start:(WatchOrder|null)[]=[]){
 const gen=liveGame(g),inputs:(WatchOrder|null)[]=[],events:LiveEvent[]=[];
 let step=gen.next(),guard=0;
 while(!step.done&&guard++<20000){
  const v=step.value;let x:WatchOrder|null=null;
  if(v.type==='event')events.push(v.e);
  if(inputs.length<start.length)x=start[inputs.length];
  else if(v.type==='decide'){if(inputs.length>=stopAfter)return {result:null,inputs,events};x=orders(v.s,events);}
  inputs.push(x);step=gen.next(x);
 }
 assert.ok(step.done,'試合が終わらない');
 return {result:step.value as GameResult,inputs,events};
}
type Choose=(g:ManagedGame,s:GameState)=>Orders|null;// null=おまかせ
/** アプリの「1年進める」と同じ進め方(大事な試合の前で止まり、選んだ方で進める)。 */
function runYear(state:GameState,choose:Choose=()=>null){
 let s=state;const stops:{g:ManagedGame;result?:GameResult;inputs?:(WatchOrder|null)[]}[]=[];let guard=0;
 while(guard++<3000){
  if(keyGameAhead(s)){const g=managedGame(s);if(g){const o=choose(g,s);
   if(!o){stops.push({g});s=advanceKeyDay(s);}else{const d=drive(g,o);stops.push({g,result:d.result!,inputs:d.inputs});s=commitManaged(s,g.control,d.inputs);}
   continue;}}
  if(!s.season.completed){s=simulateDays(s,7);continue;}
  if(s.season.postseason?.stage!=='complete'){s=simulatePostseason(s,1);continue;}
  break;
 }
 return {s,stops};
}
function plainYear(state:GameState){let s=state;while(!s.season.completed)s=simulateDays(s,7);return finishPostseason(s);}
const majorState=(seed:number,circuit:Circuit)=>{const s=initialState(seed);s.season=emptySeason(1,circuit,s.club);if(circuit!=='NPB')s.leagueProgress={basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:0};return s;};
const sandbox=(circuit:Circuit)=>{const s=initialSandboxState();if(circuit!=='NPB'){s.season=emptySeason(1,circuit,s.club);s.leagueProgress={basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:0};}return s;};
const bench=(s:GameState)=>Object.keys(s.owned).filter(id=>!s.lineup.includes(id)&&!s.pitchers.includes(id)&&canBat(playerMap[id]));
const sameBox=(a:GameResult,b:GameResult)=>JSON.stringify([a.home,a.away,a.homeRuns,a.awayRuns,a.line,a.errors,a.box])===JSON.stringify([b.home,b.away,b.homeRuns,b.awayRuns,b.line,b.errors,b.box]);
/** 試合で使う「勝ちに行く」指示: 攻撃は盗塁・送りバント、守りは敬遠。 */
const aggressive=(side:number):Orders=>s=>s.side===side?(s.bases[0]&&!s.bases[1]?{kind:'steal'}:s.outs<2&&(s.bases[0]||s.bases[1])?{kind:'bunt'}:null):(s.bases[1]&&!s.bases[0]?{kind:'ibb'}:null);

export function registerWatchTests(test:(name:string,run:()=>void)=>void){
 test('managed games: "1年進める" stops before opening day and the key games of each own series (game 1 and clinchers); choosing 一気に進める every time equals the unpaused year',()=>{
  for(const [circuit,state] of [['NPB',sandbox('NPB')],['MLB',sandbox('MLB')],['SPACE',sandbox('SPACE')],['NPB',majorState(77,'NPB')]] as [Circuit,GameState][]){
   const plain=plainYear(state),{s,stops}=runYear(state);
   assert.equal(JSON.stringify(s),JSON.stringify(plain),`おまかせの1年が違う ${circuit}`);
   assert.equal(stops[0].g.label,'開幕戦');assert.equal(stops[0].g.kind,'opening');
   // 止まった試合 = 開幕戦 + 自分のチームが出た短期決戦の大事な試合(各シリーズの第1戦と王手の試合。11/4 夜から。途中の試合は止まらない)
   const mineSeries=(plain.season.postseason?.series??[]).filter(x=>x.higher===plain.club||x.lower===plain.club);
   const own=mineSeries.flatMap(x=>x.results).length;
   assert.ok(stops.length-1>=mineSeries.length&&stops.length-1<=own,`止まった数 ${circuit} ${stops.length-1} / シリーズ ${mineSeries.length} / 試合 ${own}`);
   assert.ok(stops.slice(1).every(x=>!!x.g.reason),'なぜ大事かの一言');
   assert.ok(stops.slice(1).every(x=>x.g.kind==='post'&&/第\d+戦$/.test(x.g.label)));
   const top=circuit==='NPB'?'国内王座決定戦':circuit==='SPACE'?'宇宙王座決定戦':'世界王座決定戦';
   if((plain.season.postseason?.series??[]).some(x=>(x.stage==='japan'||x.stage==='world')&&[x.higher,x.lower].includes(plain.club)))assert.ok(stops.some(x=>x.g.label.startsWith(top)),top);
  }
  // 弱いチームでも開幕戦は止まる。まだ止まっていない日・終わったシーズンでは止まらない。
  const weak=majorState(5,'NPB');assert.equal(keyGameAhead(weak)?.label,'開幕戦');
  assert.equal(keyGameAhead(simulateDays(weak,1)),null);
  assert.equal(keyGameAhead(plainYear(weak)),null);
 });
 test('managed games: managing without orders gives exactly the おまかせ result, and the save is untouched until the result is committed',()=>{
  const state=sandbox('NPB'),before=JSON.stringify(state);
  const {s:managed,stops}=runYear(state,()=>()=>null),plain=plainYear(state);
  assert.equal(JSON.stringify(managed),JSON.stringify(plain),'指示なしの監督 = おまかせ');
  assert.ok(stops.length>=2&&stops.every(x=>x.result));
  const g=managedGame(state)!;drive(g);finishLive(g,[]);
  assert.equal(JSON.stringify(state),before,'止まって試合を回しても保存データは変わらない');
  // 画面で回した試合と、シーズンに入れた試合は同じ(その日の自分の試合)
  const first=commitManaged(state,stops[0].g.control,stops[0].inputs!);
  assert.ok(sameBox(first.season.results[0],stops[0].result!));
 });
 test('managed games: orders really change the game, and the managed result goes into wins/losses, standings, player stats, series and rewards',()=>{
  const state=sandbox('NPB'),g=managedGame(state)!,auto=finishLive(g,[]);
  const side=g.control,d=drive(g,aggressive(side));
  assert.ok(d.events.some(e=>e.order),'指示が通った');
  assert.ok(!sameBox(d.result!,auto),'指示で試合が変わる');
  const after=commitManaged(state,side,d.inputs),r=after.season.results[0];
  assert.ok(sameBox(r,d.result!),'観た試合がそのまま入る');
  const me=after.season.standings.find(t=>t.team===state.club)!,mine=side===0?[r.awayRuns,r.homeRuns]:[r.homeRuns,r.awayRuns];
  assert.equal(me.w+me.l+me.d,1);assert.equal(me.w,mine[0]>mine[1]?1:0);assert.equal(me.l,mine[0]<mine[1]?1:0);assert.equal(me.rf,mine[0]);assert.equal(me.ra,mine[1]);
  // 個人成績: 監督した試合の成績表の数がシーズンの成績に入る(バントは打数に数えない)
  for(const b of r.box!.batting.filter(b=>b.team===state.club))assert.equal(after.season.batting[`${state.club}|${b.playerId}`].pa,b.pa);
  const bunts=d.events.filter(e=>e.kind==='BUNT'||e.kind==='BUNT_FAIL').length,stole=d.events.filter(e=>e.kind==='SB'&&e.order).length;
  assert.ok(bunts+stole>0);
  if(stole)assert.ok(r.box!.batting.reduce((n,b)=>n+(b.team===state.club?b.sb:0),0)>=stole);
  // 1試合ぶんの報酬も入る(おまかせの時と同じ決まり)
  const autoDay=advanceKeyDay(state);assert.ok(after.gems>state.gems&&autoDay.gems>state.gems);
  // 短期決戦: 監督した試合が勝ち上がりに入る
  const {s:year,stops}=runYear(state,(x)=>x.kind==='post'?aggressive(x.control):null);
  const managedPost=stops.filter(x=>x.result);assert.ok(managedPost.length>0,'短期決戦で止まった');
  const series=year.season.postseason!.series;
  for(const x of managedPost){const found=series.flatMap(s=>s.results).some(r=>sameBox(r,x.result!));assert.ok(found,'監督した短期決戦の試合が記録にある '+x.g.label);}
  for(const s of series)assert.equal(s.wins[0]+s.wins[1]-s.advantage,s.results.filter(r=>r.homeRuns!==r.awayRuns).length,'勝ち数と試合が合う');
  assert.equal(year.season.postseason!.stage,'complete');assert.ok(year.season.postseason!.rewardClaimed);
 });
 test('managed games: closing the app mid-game keeps the orders on the device; resuming gives the same game and the save stays valid',()=>{
  const store=new Map<string,string>(),storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);},removeItem:(k:string)=>{store.delete(k);}};
  const state=sandbox('NPB'),before=JSON.stringify(state),g=managedGame(state)!,orders=aggressive(g.control);
  const whole=drive(g,orders);
  const half=drive(g,orders,Math.floor(whole.inputs.length/2));assert.equal(half.result,null);
  saveManage('career',{v:1,key:g.key,control:g.control,inputs:half.inputs},storage);
  assert.ok(store.has(manageKey('career')));
  assert.equal(JSON.stringify(state),before,'途中で閉じてもセーブは変わらない');
  // 開き直す: 同じ所で止まり、覚えた並びで続きから
  const again=managedGame(JSON.parse(before))!;assert.equal(again.key,g.key);
  const saved=readManage('career',again.key,storage)!;assert.deepEqual(saved.inputs,half.inputs);
  const resumed=drive(again,orders,Infinity,saved.inputs);
  assert.ok(sameBox(resumed.result!,whole.result!),'続きから = 通しで');
  assert.deepEqual(resumed.inputs,whole.inputs);
  // 別の試合・壊れた記録・別のセーブ枠は読まない
  assert.equal(readManage('career','other-key',storage),null);
  assert.equal(readManage('free',g.key,storage),null);
  store.set(manageKey('career'),'{"v":1,"key":"'+g.key+'","control":0,"inputs":[{"kind":"hack"}]}');assert.equal(readManage('career',g.key,storage),null);
  store.set(manageKey('career'),'not json');assert.equal(readManage('career',g.key,storage),null);
  clearManage('career',storage);assert.ok(!store.has(manageKey('career')));
  // やり直し(覚えた並びを捨てる)とおまかせも、同じ所から
  assert.ok(sameBox(finishLive(again,[]),finishLive(g,[])));
 });
 test('watch speed is remembered (1x/2x/4x) and one plate appearance takes 2.4s / 1.2s / 0.6s',()=>{
  const store=new Map<string,string>(),storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);}};
  assert.equal(readSpeed(storage),1);
  saveSpeed(4,storage);assert.equal(store.get(SPEED_KEY),'4');assert.equal(readSpeed(storage),4);
  saveSpeed(2,storage);assert.equal(readSpeed(storage),2);
  // 11/5: 8倍・16倍を足した(持ち主「4倍・8倍・16倍速も入れて」)。それ以外の数は1倍に戻す。
  saveSpeed(16,storage);assert.equal(readSpeed(storage),16);saveSpeed(8,storage);assert.equal(readSpeed(storage),8);
  store.set(SPEED_KEY,'3');assert.equal(readSpeed(storage),1);
  assert.equal(readSpeed({getItem:()=>{throw new Error('blocked');}}),1);
  assert.deepEqual([paMillis(1),paMillis(2),paMillis(4)],[2400,1200,600]);
  assert.deepEqual([homeRunMillis(1),homeRunMillis(2),homeRunMillis(4)],[2600,1300,650]);
  for(let i=1;i<200;i++){const bb=pitchesFor('BB',i),k=pitchesFor('K',i);assert.equal(bb.at(-1),'B');assert.equal(bb.filter(x=>x==='B').length,4);assert.equal(k.at(-1),'S');assert.ok(countOf(pitchesFor('1B',i)).b<=3);}
  assert.equal(gradeOf(100),'S+');assert.equal(gradeOf(95),'S');assert.equal(gradeOf(10),'G');
 });
 test('manager orders follow the rules: substitutions, bunt, steal, two intentional walks per inning, wrong-side orders do nothing',()=>{
  const state=sandbox('NPB'),g=managedGame(state)!,side=g.control,auto=finishLive(g,[]);
  const subs=bench(state);assert.ok(subs.length>=3,'ベンチに選手がいる');
  assert.equal(substituteBlock(state.lineup,[],state.lineup[0]),'この選手はもう試合に出ている');
  assert.equal(substituteBlock(state.lineup,[subs[0]],subs[0]),'この選手はもう出場した');
  assert.equal(substituteBlock(state.lineup,[],subs[0]),null);
  assert.equal(substituteBlock(state.lineup,[],state.pitchers[0]),'この選手は打てない');
  let pinched='',tried=false,back=false;
  const r1=drive(g,(s)=>{
   if(s.side!==side)return null;
   if(!pinched&&s.inning>=3){pinched=s.batter;return {kind:'pinch',slot:s.slot,id:subs[0]};}
   if(pinched&&!tried){tried=true;return {kind:'pinch',slot:s.slot,id:subs[0]};}
   if(pinched&&!back&&s.removed[side].includes(pinched)){back=true;return {kind:'pinch',slot:s.slot,id:pinched};}
   return null;
  });
  assert.equal(r1.events.filter(e=>e.kind==='PINCH').length,1,'代打は1回だけ通る');
  assert.ok(r1.result!.box!.batting.some(b=>b.playerId===subs[0]&&b.pa>0),'代打の選手が打席に立ち、成績に入る');
  assert.ok(back);
  let step2=0;
  const r2=drive(g,(s)=>{
   if(s.side===side)return null;const staff=s.pitchers[1-s.side];
   if(step2===0&&s.inning>=2){step2=1;return {kind:'pitcher',id:staff[10]};}
   if(step2===1&&s.inning>=4){step2=2;return {kind:'pitcher',id:staff[11]};}
   if(step2===2&&s.inning>=6){step2=3;return {kind:'pitcher',id:staff[10]};}
   return null;
  });
  assert.deepEqual(r2.events.filter(e=>e.kind==='PITCHER').map(e=>e.pitcher),[state.pitchers[10],state.pitchers[11]]);
  assert.ok(r2.result!.box!.pitching.some(p=>p.playerId===state.pitchers[10]&&p.outs>0),'替えた投手が投げ、成績に入る');
  let fielded=false;
  const r4=drive(g,(s)=>{if(!fielded&&s.side!==side&&s.inning>=6){fielded=true;const slot=s.lineups[side].findIndex(id=>!['DH','捕'].includes(s.defense[side][id]));return {kind:'field',slot,id:subs[2],position:'DH'};}return null;});
  assert.ok(r4.events.some(e=>e.kind==='FIELD'&&e.batter===subs[2]));
  // 11/5: 敬遠の回数の制限は無い(持ち主「回数制限あるの意味不明」)。1つの回に3回以上出せて、満塁で出すと押し出しで1点(打点も付く)。
  void IBB_PER_INNING;
  const asked=new Map<string,number>();
  const r5=drive(g,(s)=>{if(s.side===side)return null;const k=`${s.inning}|${s.side}`,n=asked.get(k)??0;if(s.inning>3||n>=4)return null;asked.set(k,n+1);return {kind:'ibb'};});
  const ibb=r5.events.filter(e=>e.kind==='IBB'),per=new Map<string,number>();
  for(const e of ibb)per.set(`${e.inning}|${e.side}`,(per.get(`${e.inning}|${e.side}`)??0)+1);
  assert.ok(ibb.length>0&&[...per.values()].some(n=>n>=3),'1つの回に3回以上の敬遠');
  assert.ok(ibb.some(e=>e.runs===1),'満塁の敬遠は押し出しで1点');
  const rbiFromIbb=ibb.filter(e=>e.runs===1).length,box=r5.result!.box!.batting.filter(b=>b.team!==(side===0?g.away:g.home));void rbiFromIbb;void box;
  const r6=drive(g,(s)=>s.side===side?{kind:'bunt'}:null);
  const bunts=r6.events.filter(e=>e.kind==='BUNT'||e.kind==='BUNT_FAIL');
  assert.ok(bunts.length>0&&bunts.every(e=>e.outs>=1));
  const r7=drive(g,(s)=>s.side===side?{kind:'steal'}:null);
  assert.ok(r7.events.filter(e=>(e.kind==='SB'||e.kind==='CS')&&e.order).length>0);
  // 攻撃側から敬遠・守備側からバントの指示は効かない(おまかせのまま)
  const r8=drive(g,(s)=>s.side===side?{kind:'ibb'}:{kind:'bunt'});
  assert.ok(sameBox(r8.result!,auto));
 });
 test('screens: no more "今年の名場面を観る"; the home card offers 監督して戦う / 一気に進める (and 続きから after closing mid-game)',()=>{
  const done=plainYear(sandbox('NPB'));
  const html=renderToStaticMarkup(createElement(PawaSeason,{state:done,busy:false,progress:0,onPlay:()=>{},onPost:()=>{},onNext:()=>{},onPlayer:()=>{},message:''}));
  assert.ok(!html.includes('今年の名場面を観る'));assert.ok(!html.includes('wt-watch-btn'));
  const state=sandbox('NPB'),g=managedGame(state)!;
  const card=(at:GameState,game:ManagedGame,saved:boolean)=>renderToStaticMarkup(createElement(KeyGameCard,{game,at,name:at.name,club:at.club,saved,onManage:()=>{},onRestart:()=>{},onAuto:()=>{}}));
  const stop=card(state,g,false);
  for(const x of ['開幕戦','監督して戦う','一気に進める'])assert.ok(stop.includes(x),x);
  assert.ok(!stop.includes('次の大事な試合'),'11/5 見出しは消した');
  assert.ok(!stop.includes('おまかせで観る'));assert.ok(!stop.includes('続きから'));
  const resume=card(state,g,true);
  assert.ok(resume.includes('続きから監督する'));assert.ok(resume.includes('やり直す'));
  // 短期決戦で止まった時は、試合の名前と相手だけ(11/5 説明の文は消した)
  const {stops}=runYear(state,()=>null);const post=stops.find(x=>x.g.kind==='post');
  if(post){let s=state;while(!s.season.completed)s=simulateDays(s,7);while(keyGameAhead(s)?.key!==post.g.key)s=simulatePostseason(s,1);
   const ph=card(s,managedGame(s)!,false);
   assert.ok(ph.includes(post.g.label));assert.ok(!ph.includes('止まっている間'));}
 });
}
