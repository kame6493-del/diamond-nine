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
import {finishPostseason,simulatePostseason,newPostseason} from '../src/pro/postseason';
import {type Circuit} from '../src/pro/leagues';
import {keyGameAhead,managedGame,advanceKeyDay,commitManaged,liveGame,finishLive,stopAt,keyReason,readNoStop,saveNoStop,NO_STOP_KEY,readManage,saveManage,type ManagedGame,type StopRules} from '../src/pro/managed';
import {KeyGameCard} from '../src/pro/SimpleApp';
import {tacticRates,pitchFit,batTacticFor,emptyTactics,BAT_TACTICS,PITCH_TACTICS,type BatTactic,type PitchTactic} from '../src/pro/tactics';
import {choreograph,endOf,ballAt,BAGS,PLATE,type V} from '../src/pro/field-sim';
import {callText,playWord,readSpeed,SPEED_KEY,pitchesFor} from '../src/pro/watch';
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
const cardHtml=(at:GameState,g:ManagedGame,saved=false)=>renderToStaticMarkup(createElement(KeyGameCard,{game:g,at,name:at.name,club:at.club,saved,onManage:()=>{},onRestart:()=>{},onAuto:()=>{},onSeries:()=>{}}));
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
 test('key game card (11/4 夜): no forced choice window; the home card offers 監督して戦う / 一気に進める (no おまかせで観る); short series also "このシリーズの残りを一気に進める"; 続きから after closing',()=>{
  const state=sandbox('NPB'),g=managedGame(state)!;
  const open=cardHtml(state,g);
  for(const x of ['開幕戦','監督して戦う','一気に進める','「1年進める」と同じ結果'])assert.ok(open.includes(x),x);
  // 11/5 持ち主「『監督して戦う』だけでいいです。作戦うんちゃらかんちゃらはいらない」「止まっている間は…こういう文言はいらない」
  for(const x of ['大事な試合でも止まらない','止まっている間','作戦・バント','次の大事な試合'])assert.ok(!open.includes(x),x);
  assert.ok(!open.includes('おまかせで観る'),'おまかせで観るは無い');
  assert.ok(!open.includes('このシリーズの残りを一気に進める'),'開幕戦にシリーズの選択は無い');
  assert.ok(!open.includes('続きから'));
  assert.ok(cardHtml(state,g,true).includes('続きから監督する'));assert.ok(cardHtml(state,g,true).includes('この試合を最初からやり直す'));
  assert.ok(!open.includes('wt-stop'),'全画面の選ぶ窓ではない');
  // 短期決戦で止まった所(第1戦)
  let s=state;while(!s.season.completed)s=simulateDays(s,7);
  let guard=0;while(!keyGameAhead(s)&&s.season.postseason?.stage!=='complete'&&guard++<200)s=simulatePostseason(s,1);
  const pg=managedGame(s);assert.ok(pg&&pg.kind==='post'&&pg.series,'短期決戦で止まる');
  const post=cardHtml(s,pg!);
  for(const x of ['監督して戦う','一気に進める','このシリーズの残りを一気に進める','プレーオフ進出!',pg!.label])assert.ok(post.includes(x),x);
  assert.ok(!post.includes('止まっている間'));
  assert.ok(!post.includes('おまかせで観る'));
 });
 test('key games in short series (11/4 夜): only game 1 of each series and games where either side is one win away (advantage wins count) stop; the middle games run on; results equal the plain "1年進める" year',()=>{
  let middle=0,keys=0,reach=0;
  for(const circuit of ['NPB','MLB','SPACE'] as Circuit[]){
   const state=sandbox(circuit),plain=JSON.stringify(plainYear(state));
   // 一気に進める(止まるたびに)= 1年進める
   const auto=runYear(state,()=>'auto');
   assert.equal(JSON.stringify(auto.s),plain,`一気に進める ${circuit}`);
   assert.ok(auto.stops.length>=1&&auto.stops[0].g.label==='開幕戦');
   // 1日ずつ: 自分のシリーズの試合の前で、止まる = 第1戦か王手
   let x=state;while(!x.season.completed)x=simulateDays(x,7);
   let g2=0;while(x.season.postseason?.stage!=='complete'&&g2++<300){
    const post=x.season.postseason??newPostseason(x.season),ser=post.series.find(q=>q.stage===post.stage&&!q.winner&&(q.higher===x.club||q.lower===x.club));
    if(ser){const expected=ser.results.length===0||ser.wins[0]>=ser.target-1||ser.wins[1]>=ser.target-1;const k=stopAt(x,{noStop:false,skipSeries:null});
     assert.equal(!!k,expected,`${circuit} ${ser.id} 第${ser.results.length+1}戦 ${ser.wins.join('-')}/${ser.target}`);
     if(k){keys++;assert.ok(k.reason&&k.reason.length>0,'なぜ大事かの一言');if(ser.results.length>0){reach++;assert.ok(/王手|負ければ終わり|最終決戦/.test(k.reason!),k.reason);}}else middle++;}
    x=simulatePostseason(x,1);
   }
   void x;
   if(circuit!=='NPB')continue;
   const sk=runYear(state,g=>g.kind==='post'?'series':'auto');
   assert.equal(JSON.stringify(sk.s),plain,`シリーズを一気に ${circuit}`);
   const perSeries=new Map<string,number>();for(const y of sk.stops)if(y.g.series)perSeries.set(y.g.series,(perSeries.get(y.g.series)??0)+1);
   assert.ok([...perSeries.values()].every(n=>n===1),'1つのシリーズで止まるのは最初の1回だけ');
   const ns=runYear(state,()=>'manage',{noStop:true});
   assert.equal(ns.stops.length,0,'止まらない');assert.equal(JSON.stringify(ns.s),plain);
   // 監督して何も指示しない試合も、1年進めると同じ(おまかせで観るの代わりの一致の試験)
   assert.equal(JSON.stringify(runYear(state,()=>'manage').s),plain,'監督して指示なし = 1年進める');
  }
  assert.ok(keys>0&&middle>0,`途中の試合(止まらない)も、止まる試合もある middle=${middle} keys=${keys}`);
  // 王手の言葉(アドバンテージの勝ちも数える)
  const base={stage:'final' as const,target:4,higher:'A',results:[1] as unknown as GameResult[]};
  assert.equal(keyReason({...base,wins:[3,0]},'A','NPB',false),'王手! 勝てば勝ち抜け');
  assert.equal(keyReason({...base,wins:[3,3]},'A','NPB',false),'最終決戦! 勝てば勝ち抜け');
  assert.equal(keyReason({...base,wins:[1,3]},'A','NPB',false),'負ければ終わり');
  assert.equal(keyReason({...base,wins:[2,1]},'A','NPB',false),'');
  assert.equal(keyReason({...base,stage:'japan',wins:[3,1]},'A','NPB',false),'王手! 勝てば国内王座');
  assert.equal(keyReason({...base,stage:'world',wins:[1,3]},'B','SPACE',false),'王手! 勝てば宇宙王座');
  assert.equal(keyReason({stage:'final',target:4,higher:'A',results:[],wins:[3,0]},'A','NPB',false),'王手! 勝てば勝ち抜け','アドバンテージ3勝(仮)の第1戦は王手');
  assert.equal(keyReason({stage:'first',target:2,higher:'A',results:[],wins:[0,0]},'B','NPB',true),'プレーオフ進出!');
  void reach;
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
  const sp=memory();assert.equal(readSpeed(sp,SPEED_KEY,1),1);
  // 前の版で「おまかせで観る」のまま閉じた試合も読める(監督の試合として続きから)
  const g=managedGame(state)!,store=memory();saveManage('career',{v:1,key:g.key,control:g.control,inputs:[null,null],mode:'watch'},store);
  assert.deepEqual(readManage('career',g.key,store)?.inputs,[null,null]);
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
    if(['PINCH','RUNNER','FIELD','PITCHER','MOVE'].includes(e.kind))continue;
    const ctx={fielders:{P:e.pitcher,C:'c','1B':'a','2B':'b','3B':'d',SS:'e',LF:'f',CF:'g',RF:'h'},rate:()=>({speed:60,field:60,arm:60})};
    const p=choreograph(e,before,ctx);kinds.add(e.kind);checked++;
    // 実況の向きと打球の向きは同じ言葉
    const word=playWord(e.kind,e.inning,e.slot);assert.equal(p.word,word);
    if(word)assert.ok(callText(e.kind,'x',e.slot,e.runs,e.inning).includes(word),`実況に ${word}`);
    const hit=p.ball.find(b=>b.kind!=='throw'&&b.kind!=='pitch')??null,land=hit?.b??null;
    const near=(a:V,b:V,m=1.2)=>Math.hypot(a[0]-b[0],a[1]-b[1])<=m;
    if(e.kind==='HR'){assert.equal(p.motion,'home-run');assert.ok(land![1]>100,'ホームランは塀の向こうへ');assert.equal(ballAt(p,hit!.t1)?.o??0,0,'スタンドに消える');}
    if(e.kind==='OUT'){if(word.endsWith('ゴロ')){assert.equal(p.motion,'ground-out');assert.equal(hit!.kind,'ground');assert.ok(land![1]<40,'ゴロは内野');}else{assert.equal(p.motion,'fly-out');assert.equal(hit!.kind,'air');assert.ok(land![1]>55,'フライは外野');}}
    if(['1B','2B','3B'].includes(e.kind)){assert.ok(['single','extra-base'].includes(p.motion));assert.ok(p.ball.some(b=>b.b[1]>50),'安打は外野へ抜ける');}
    if(['レフト','三遊間','左中間'].includes(word)&&land)assert.ok(land[0]<0,`${word} は左`);
    if(['ライト','一二塁間','右中間'].includes(word)&&land)assert.ok(land[0]>0,`${word} は右`);
    if(e.kind==='K')assert.equal(p.motion,'strikeout');
    // 走者と打者: 終わった時の位置 = 結果の塁(得点は本塁、アウトは消える)
    for(const a of p.actors.filter(x=>x.role!=='f')){
     const id=a.id.slice(2),end=endOf(p,a.id)!,at=e.bases.indexOf(id);
     if(a.role==='b'&&['SB','CS'].includes(e.kind))continue;
     if(a.role==='b'&&e.kind==='HR'){assert.ok(Math.hypot(end.p[0]-PLATE[0],end.p[1]-PLATE[1])<7,'本塁打の打者は一周して本塁へ');continue;}
     if(at>=0){assert.ok(near(end.p,BAGS[at]),`${e.kind} 走者の塁 ${JSON.stringify(end.p)}`);assert.equal(end.o,1);}
     else if(a.role==='r'&&e.kind!=='CS'&&before.includes(id))assert.ok(Math.hypot(end.p[0]-PLATE[0],end.p[1]-PLATE[1])<7,'得点は本塁へ');
     else assert.equal(end.o,0,`${e.kind} 塁にいない打者・走者は消える`);
    }
    for(const id of e.bases)if(id)assert.ok(p.actors.some(a=>a.id==='r:'+id||a.id==='b:'+id),`${e.kind} 塁の走者が描かれる`);
   }
  }
  assert.ok(checked>1500);
  for(const k of ['1B','2B','HR','OUT','K','BB','SB'])assert.ok(kinds.has(k),k);
  void playerMap;void BAGS;
 });
}
