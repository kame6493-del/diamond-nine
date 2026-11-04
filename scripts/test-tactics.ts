// 大事な試合の選び方・おまかせで観る・作戦(2026-11-04 vc43 の続き)の試験。
// 持ち主「CS とか日本シリーズとかもそうですが、一気に進めれるようにしてください。というか、選べるようにして。あと自動進行の試合ですが、
// さすがに結果しか表示されないのは味気なさすぎるので、ボールとかランナーとかは動いて…。あと監督では、長打狙い・ミート打ち・積極的に・慎重に
// とか、直球中心・変化球中心・ボール球中心・ストライク中心 などの指示を出せるようにしてください。試合中に」
// 1) 選ぶ画面は「監督して戦う」「おまかせで観る」「一気に進める」(短期決戦は「このシリーズの残りを一気に進める」も)。
// 2) おまかせで観る・一気に進める・シリーズを一気に・設定の「止まらない」は、どれも「1年進める」と1つも違わない。
// 3) 作戦は試合の計算に効き、効く向きが決まりどおり。 4) グラウンドの動きは結果・実況と食い違わない。
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialSandboxState,emptySeason,simulateDays,type GameResult,type GameState,type LiveSituation,type LiveEvent,type WatchOrder} from '../src/pro/engine';
import {finishPostseason,simulatePostseason} from '../src/pro/postseason';
import {type Circuit} from '../src/pro/leagues';
import {keyGameAhead,managedGame,advanceKeyDay,commitManaged,liveGame,finishLive,stopAt,readNoStop,saveNoStop,NO_STOP_KEY,readManage,saveManage,type ManagedGame,type StopRules} from '../src/pro/managed';
import {KeyGameStop} from '../src/pro/SimpleApp';
import {tacticRates,pitchFit,batTacticFor,emptyTactics,BAT_TACTICS,PITCH_TACTICS,type BatTactic,type PitchTactic} from '../src/pro/tactics';
import {fieldPlay,trackAt,BASES,HOME} from '../src/pro/watch-play';
import {callText,playWord,readSpeed,AUTO_SPEED_KEY,SPEED_KEY,pitchesFor} from '../src/pro/watch';
import {playerMap} from '../src/pro/data';

const sandbox=(circuit:Circuit)=>{const s=initialSandboxState();if(circuit!=='NPB'){s.season=emptySeason(1,circuit,s.club);s.leagueProgress={basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:0};}return s;};
function plainYear(state:GameState){let s=state;while(!s.season.completed)s=simulateDays(s,7);return finishPostseason(s);}
type Orders=(s:LiveSituation,events:LiveEvent[])=>WatchOrder|null;
function drive(g:ManagedGame,orders:Orders=()=>null){
 const gen=liveGame(g),inputs:(WatchOrder|null)[]=[],events:LiveEvent[]=[];
 let step=gen.next(),guard=0;
 while(!step.done&&guard++<20000){const v=step.value;let x:WatchOrder|null=null;if(v.type==='event')events.push(v.e);else x=orders(v.s,events);inputs.push(x);step=gen.next(x);}
 assert.ok(step.done);return {result:step.value as GameResult,inputs,events};
}
type Choice='manage'|'watch'|'auto'|'series';
/** アプリと同じ進め方。choose が選び方を返す(watch=画面で観る=指示なしで回してシーズンに入れる)。 */
function runYear(state:GameState,choose:(g:ManagedGame)=>Choice,rules:Partial<StopRules>={},orders:Orders=()=>null){
 let s=state,skip:string|null=null;const stops:{g:ManagedGame;choice:Choice}[]=[];let guard=0;
 while(guard++<3000){
  if(stopAt(s,{noStop:!!rules.noStop,skipSeries:skip})){const g=managedGame(s)!;const c=choose(g);stops.push({g,choice:c});
   if(c==='auto')s=advanceKeyDay(s);
   else if(c==='series'){skip=g.series??null;s=advanceKeyDay(s);}
   else{const d=drive(g,c==='watch'?()=>null:orders);s=commitManaged(s,g.control,d.inputs);}
   continue;}
  if(!s.season.completed){s=simulateDays(s,7);continue;}
  if(s.season.postseason?.stage!=='complete'){s=simulatePostseason(s,1);continue;}
  break;
 }
 return {s,stops};
}
const memory=()=>{const store=new Map<string,string>();return {store,getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);},removeItem:(k:string)=>{store.delete(k);}};};
const stopHtml=(at:GameState,g:ManagedGame,saved:unknown[]|null=null,mode?:'manage'|'watch')=>renderToStaticMarkup(createElement(KeyGameStop,{stop:{at,game:g,saved,mode},name:at.name,club:at.club,onManage:()=>{},onRestart:()=>{},onWatch:()=>{},onAuto:()=>{},onSeries:()=>{}}));
/** 自分の側の作戦を最初の判断で出し、そのまま最後まで。 */
const withTactic=(scope:'team'|'pitch',tactic:string):Orders=>{let sent=false;return ()=>{if(sent)return null;sent=true;return {kind:'tactic',scope,tactic};};};
/** 同じ試合を乱数の位置だけ変えて何試合も回し、自分のチーム(打撃)と相手(打撃=自分の投手の結果)の打席の結果を数える。 */
function tally(g:ManagedGame,orders:()=>Orders,n:number){
 const t={own:{pa:0,bb:0,k:0,hr:0,xbh:0,single:0},opp:{pa:0,bb:0,k:0,hr:0,xbh:0,single:0},wins:0,runs:0,allowed:0};
 for(let i=0;i<n;i++){
  const d=drive({...g,rng:(g.rng+i*7919)>>>0},orders());
  for(const e of d.events){
   if(!['BB','HBP','K','OUT','SF','E','1B','2B','3B','HR'].includes(e.kind))continue;
   const x=e.side===g.control?t.own:t.opp;x.pa++;
   if(e.kind==='BB')x.bb++;else if(e.kind==='K')x.k++;else if(e.kind==='HR')x.hr++;else if(e.kind==='2B'||e.kind==='3B')x.xbh++;else if(e.kind==='1B')x.single++;
  }
  const r=d.result,mine=g.control===0?[r.awayRuns,r.homeRuns]:[r.homeRuns,r.awayRuns];
  t.runs+=mine[0];t.allowed+=mine[1];if(mine[0]>mine[1])t.wins++;
 }
 return t;
}
const rate=(x:{pa:number},k:number)=>k/Math.max(1,x.pa);

export function registerTacticTests(test:(name:string,run:()=>void)=>void){
 test('key game choice (11/4): the stop screen offers 監督して戦う / おまかせで観る / 一気に進める; short series also offer "このシリーズの残りを一気に進める"; opening day the same three',()=>{
  const state=sandbox('NPB'),g=managedGame(state)!;
  const open=stopHtml(state,g);
  for(const x of ['開幕戦','監督して戦う','おまかせで観る','一気に進める','大事な試合でも止まらない'])assert.ok(open.includes(x),x);
  assert.ok(!open.includes('このシリーズの残りを一気に進める'),'開幕戦にシリーズの選択は無い');
  assert.ok(!open.includes('続きから'));
  assert.ok(stopHtml(state,g,[null],'watch').includes('続きから観る'));
  assert.ok(stopHtml(state,g,[null],'manage').includes('続きから監督する'));
  // 短期決戦で止まった所
  let s=state;while(!s.season.completed)s=simulateDays(s,7);
  let guard=0;while(!keyGameAhead(s)&&s.season.postseason?.stage!=='complete'&&guard++<200)s=simulatePostseason(s,1);
  const pg=managedGame(s);assert.ok(pg&&pg.kind==='post'&&pg.series,'短期決戦で止まる');
  const post=stopHtml(s,pg!);
  for(const x of ['監督して戦う','おまかせで観る','一気に進める','このシリーズの残りを一気に進める','勝ち抜け'])assert.ok(post.includes(x),x);
 });
 test('key game choice: おまかせで観る, 一気に進める, the series skip and the 止まらない setting all equal the plain "1年進める" year',()=>{
  for(const circuit of ['NPB','MLB','SPACE'] as Circuit[]){
   const state=sandbox(circuit),plain=JSON.stringify(plainYear(state));
   const watched=runYear(state,()=>'watch');
   assert.equal(JSON.stringify(watched.s),plain,`おまかせで観る ${circuit}`);
   assert.ok(watched.stops.length>=1&&watched.stops[0].g.label==='開幕戦');
   if(circuit!=='NPB')continue;// 一気に進める・シリーズ・止まらないは国内で(どれも同じ計算の道を通る。時間を短くする)
   assert.equal(JSON.stringify(runYear(state,()=>'auto').s),plain,`一気に進める ${circuit}`);
   // シリーズの残りを一気に: そのシリーズでは2度と止まらない(次のシリーズではまた止まる)
   const sk=runYear(state,g=>g.kind==='post'?'series':'auto');
   assert.equal(JSON.stringify(sk.s),plain,`シリーズを一気に ${circuit}`);
   const perSeries=new Map<string,number>();for(const x of sk.stops)if(x.g.series)perSeries.set(x.g.series,(perSeries.get(x.g.series)??0)+1);
   assert.ok([...perSeries.values()].every(n=>n===1),'1つのシリーズで止まるのは最初の1回だけ');
   const all=runYear(state,()=>'auto').stops.filter(x=>x.g.kind==='post').length;
   assert.ok(perSeries.size<=all);
   // 設定「大事な試合でも止まらない」
   const ns=runYear(state,()=>'manage',{noStop:true});
   assert.equal(ns.stops.length,0,'止まらない');assert.equal(JSON.stringify(ns.s),plain);
  }
 });
 test('settings: 大事な試合でも止まらない is off (stops) by default, is remembered on the device, and only skips the stop',()=>{
  const st=memory();
  assert.equal(readNoStop(st),false,'最初は止まる');
  saveNoStop(true,st);assert.equal(st.store.get(NO_STOP_KEY),'1');assert.equal(readNoStop(st),true);
  saveNoStop(false,st);assert.equal(st.store.has(NO_STOP_KEY),false);assert.equal(readNoStop(st),false);
  assert.equal(readNoStop({getItem:()=>{throw new Error('blocked');}}),false,'読めない時は止まる');
  const state=sandbox('NPB');
  assert.equal(stopAt(state,{noStop:false,skipSeries:null})?.label,'開幕戦');
  assert.equal(stopAt(state,{noStop:true,skipSeries:null}),null);
  // 観戦の速さ: おまかせで観るは最初2倍(監督の速さとは別に覚える)
  const sp=memory();assert.equal(readSpeed(sp,AUTO_SPEED_KEY,2),2);assert.equal(readSpeed(sp,SPEED_KEY,1),1);
  sp.setItem(AUTO_SPEED_KEY,'4');assert.equal(readSpeed(sp,AUTO_SPEED_KEY,2),4);assert.equal(readSpeed(sp,SPEED_KEY,1),1);
  // 途中で閉じた「おまかせで観る」は、観る形のまま続きから
  const g=managedGame(state)!,store=memory();saveManage('career',{v:1,key:g.key,control:g.control,inputs:[null,null],mode:'watch'},store);
  assert.equal(readManage('career',g.key,store)?.mode,'watch');
  store.setItem('diamond-nine-managed-career',JSON.stringify({v:1,key:g.key,control:0,inputs:[],mode:'hack'}));assert.equal(readManage('career',g.key,store),null);
 });
 test('tactics: the multipliers move the plate-appearance odds the stated way and stay within a few to about fifteen percent',()=>{
  const base={walk:.08,hbp:.008,strikeout:.20,homeRun:.025,babip:.29,hit:.25,triple:.004,double:.045};
  const single=(r:typeof base)=>r.hit-r.homeRun-r.double-r.triple,ratio=(a:number,b:number)=>a/b;
  assert.equal(tacticRates(base,null,null),base,'作戦なしは元のまま');
  const p=tacticRates(base,'power',null);assert.ok(p.homeRun>base.homeRun&&p.strikeout>base.strikeout&&single(p)<single(base)&&p.double>base.double,'長打狙い');
  const c=tacticRates(base,'contact',null);assert.ok(c.strikeout<base.strikeout&&c.homeRun<base.homeRun&&c.double<base.double&&single(c)>single(base),'ミート打ち');
  const a=tacticRates(base,'aggressive',null);assert.ok(a.walk<base.walk,'積極的に: 四球が減る');
  const t=tacticRates(base,'patient',null);assert.ok(t.walk>base.walk&&t.strikeout>base.strikeout,'慎重に: 四球と三振が増える');
  assert.ok(pitchesFor('1B',7,2).length>=pitchesFor('1B',7,0).length,'慎重に: 球数が増える(演出)');
  const ball=tacticRates(base,null,'ball');assert.ok(ball.walk>base.walk&&ball.homeRun<base.homeRun&&ball.double<base.double,'ボール球中心');
  const strike=tacticRates(base,null,'strike');assert.ok(strike.walk<base.walk&&strike.hit>base.hit,'ストライク中心');
  // 直球中心・変化球中心: 投手に合っていれば三振が増えて打たれにくい、合っていなければ逆
  const fast={velocity:156,breaking:45},bend={velocity:138,breaking:80};
  assert.ok(pitchFit('fastball',fast.velocity,fast.breaking)>0&&pitchFit('breaking',fast.velocity,fast.breaking)<0);
  assert.ok(pitchFit('breaking',bend.velocity,bend.breaking)>0&&pitchFit('fastball',bend.velocity,bend.breaking)<0);
  const good=tacticRates(base,null,'fastball',fast),bad=tacticRates(base,null,'fastball',bend);
  assert.ok(good.strikeout>base.strikeout&&good.hit<base.hit,'速球派に直球中心');assert.ok(bad.strikeout<base.strikeout&&bad.hit>base.hit,'技巧派に直球中心');
  const goodB=tacticRates(base,null,'breaking',bend),badB=tacticRates(base,null,'breaking',fast);
  assert.ok(goodB.strikeout>base.strikeout&&goodB.hit<base.hit,'技巧派に変化球中心');assert.ok(badB.strikeout<base.strikeout&&badB.hit>base.hit,'速球派に変化球中心');
  // 大きさ: どの作戦も、どの確率も 0.78〜1.25 倍の中
  for(const b of [null,...BAT_TACTICS] as (BatTactic|null)[])for(const q of [null,...PITCH_TACTICS] as (PitchTactic|null)[])for(const arm of [fast,bend]){
   // 打撃の作戦は自分の打席、投手の作戦は相手の打席に効く(相手は作戦を出さない)ので、1つの打席に効くのはどちらか1つ。
   if(b!==null&&q!==null)continue;const r=tacticRates(base,b,q,arm);
   for(const k of ['walk','strikeout','homeRun','hit'] as const){const m=ratio(r[k],base[k]);assert.ok(m>=.78&&m<=1.25,`単独 ${b}/${q} ${k} ${m.toFixed(2)}`);}
  }
  // 打者ごとの作戦はチーム全体より優先
  const tt=emptyTactics();tt.team='power';tt.batter.x='contact';assert.equal(batTacticFor(tt,'x'),'contact');assert.equal(batTacticFor(tt,'y'),'power');
 });
 test('tactics: orders really change the managed game the stated way (same game, many RNG positions), the result goes into the season, and no tactic = おまかせ',()=>{
  const state=sandbox('NPB'),g=managedGame(state)!,N=90;
  const none=tally(g,()=>()=>null,N);
  const T=(scope:'team'|'pitch',t:string)=>tally(g,()=>withTactic(scope,t),N);
  const power=T('team','power'),contact=T('team','contact'),aggr=T('team','aggressive'),pat=T('team','patient');
  assert.ok(rate(power.own,power.own.hr+power.own.xbh)>rate(none.own,none.own.hr+none.own.xbh),'長打狙い: 長打が増える');
  assert.ok(rate(power.own,power.own.k)>rate(none.own,none.own.k),'長打狙い: 三振が増える');
  assert.ok(rate(contact.own,contact.own.k)<rate(none.own,none.own.k),'ミート打ち: 三振が減る');
  assert.ok(rate(contact.own,contact.own.hr+contact.own.xbh)<rate(none.own,none.own.hr+none.own.xbh),'ミート打ち: 長打が減る');
  assert.ok(rate(aggr.own,aggr.own.bb)<rate(none.own,none.own.bb),'積極的に: 四球が減る');
  assert.ok(rate(pat.own,pat.own.bb)>rate(none.own,none.own.bb)&&rate(pat.own,pat.own.k)>rate(none.own,none.own.k),'慎重に: 四球と三振が増える');
  const ball=T('pitch','ball'),strike=T('pitch','strike');
  assert.ok(rate(ball.opp,ball.opp.bb)>rate(none.opp,none.opp.bb),'ボール球中心: 四球を出す');
  assert.ok(rate(strike.opp,strike.opp.bb)<rate(none.opp,none.opp.bb),'ストライク中心: 四球が減る');
  assert.ok(rate(strike.opp,strike.opp.single+strike.opp.xbh+strike.opp.hr)>rate(none.opp,none.opp.single+none.opp.xbh+none.opp.hr),'ストライク中心: 打たれやすい');
  // 打撃の作戦は相手の打席、投手の作戦は自分の打席には効かない(相手の作戦は無い)
  for(const e of drive(g,withTactic('team','power')).events)if(e.tactic)assert.deepEqual(e.tactic,e.side===g.control?['power',null]:[null,null],'打撃の作戦は自分の打席だけ');
  for(const e of drive(g,withTactic('pitch','ball')).events)if(e.tactic)assert.deepEqual(e.tactic,e.side===g.control?[null,null]:[null,'ball'],'投手の作戦は相手の打席だけ');
  // 作戦を出した試合の結果がそのままシーズンに入る。作戦を「なし」に戻せば、その後はおまかせと同じ確率。
  const d=drive(g,withTactic('team','power'));
  const after=commitManaged(state,g.control,d.inputs);
  assert.equal(JSON.stringify(after.season.results[0].box),JSON.stringify(d.result.box),'作戦の試合がシーズンに入る');
  assert.ok(d.events.some(e=>e.tactic?.[0]==='power'));
  const cleared=drive(g,(()=>{let n=0;return ()=>n++===0?{kind:'tactic',scope:'team',tactic:'power'}:n===2?{kind:'tactic',scope:'team',tactic:null}:null;})());
  assert.equal(JSON.stringify(cleared.result.box),JSON.stringify(finishLive(g,[]).box),'打席の前に取り消せば、おまかせと同じ');
  // 打者ごと: その選手の打席だけに効く
  const target=state.lineup[3];
  const one=drive(g,(()=>{let sent=false;return ()=>{if(sent)return null;sent=true;return {kind:'tactic',scope:'batter',id:target,tactic:'patient'};};})());
  for(const e of one.events)if(e.tactic&&e.side===g.control&&['BB','K','OUT','1B','2B','3B','HR','SF','E','HBP'].includes(e.kind))assert.equal(e.tactic[0],e.batter===target?'patient':null);
  // 変な作戦の値は効かない(おまかせのまま)
  const junk=drive(g,(()=>{let sent=false;return ()=>{if(sent)return null;sent=true;return {kind:'tactic',scope:'team',tactic:'cheat'};};})());
  assert.equal(JSON.stringify(junk.result.box),JSON.stringify(finishLive(g,[]).box));
 });
 test('field animation (11/4): the ball, fielders and runners agree with the result and the commentary (direction, caught or not, where each runner ends)',()=>{
  const state=sandbox('NPB'),g=managedGame(state)!;let checked=0;const kinds=new Set<string>();
  for(let i=0;i<25;i++){
   const d=drive({...g,rng:(g.rng+i*104729)>>>0},s=>s.side===g.control&&s.bases[0]&&!s.bases[1]&&i%3===0?{kind:'steal'}:null);
   let bases:(string|null)[]=[null,null,null],inning=0,side=-1;
   for(const e of d.events){
    if(e.inning!==inning||e.side!==side){bases=[null,null,null];inning=e.inning;side=e.side;if(e.inning>=10&&e.kind!=='PINCH'){/* タイブレークは無い(国内) */}}
    const before=bases;bases=e.bases;
    if(['PINCH','RUNNER','FIELD','PITCHER'].includes(e.kind))continue;
    const p=fieldPlay(e,before);kinds.add(e.kind);checked++;
    // 実況の向きと打球の向きは同じ言葉
    const word=playWord(e.kind,e.inning,e.slot);assert.equal(p.word,word);
    if(word)assert.ok(callText(e.kind,'x',e.slot,e.runs,e.inning).includes(word),`実況に ${word}`);
    const ball=p.tracks.filter(t=>t.who==='ball'),first=ball[0];
    if(e.kind==='HR'){assert.equal(p.type,'hr');assert.ok(first.pts.at(-1)![1]<0,'ホームランはスタンドへ');assert.ok(trackAt(first,1).o===0,'スタンドに消える');}
    if(e.kind==='OUT'){assert.ok(p.caught);if(word.endsWith('ゴロ')){assert.equal(p.type,'ground');assert.ok(p.land![1]>44,'ゴロは内野');}else{assert.equal(p.type,'fly');assert.ok(p.land![1]<40,'フライは外野');}}
    if(['1B','2B','3B'].includes(e.kind)){assert.ok(!p.caught,'安打は捕られない');assert.ok(p.land![1]<44,'安打は外野へ抜ける');}
    if(['レフト','三遊間','左中間'].includes(word))assert.ok(p.land![0]<50,`${word} は左`);
    if(['ライト','一二塁間','右中間'].includes(word))assert.ok(p.land![0]>50,`${word} は右`);
    if(e.kind==='K')assert.equal(p.tracks.length,0);
    // 走者: 終わった時の位置 = 結果の塁(得点・アウトは消える)
    for(const t of p.tracks.filter(t=>t.who.startsWith('r:'))){
     const id=t.who.slice(2),end=trackAt(t,1),at=e.bases.indexOf(id);
     if(at>=0){assert.deepEqual([end.x,end.y],BASES[at],`${e.kind} 走者の塁`);assert.equal(end.o,1);}
     else{assert.equal(end.o,0,`${e.kind} 塁にいない走者は消える`);if(e.kind!=='CS'&&before.includes(id))assert.deepEqual([end.x,end.y],HOME,'得点は本塁へ');}
    }
    for(const id of e.bases)if(id)assert.ok(p.tracks.some(t=>t.who==='r:'+id)||['K'].includes(e.kind)&&before.includes(id),`${e.kind} 塁の走者が描かれる`);
   }
  }
  assert.ok(checked>1500);
  for(const k of ['1B','2B','HR','OUT','K','BB','SB'])assert.ok(kinds.has(k),k);
  void playerMap;
 });
}
