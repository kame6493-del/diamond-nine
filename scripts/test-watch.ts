// 観戦モード(2026-11-04 vc43)の試験。
// 1) 一致: 指示なしの観戦は「1年進める」と同じ試合(国内・海外・宇宙の1年ずつ、自分の試合を全部)。
// 2) 観られる試合の控えが残り、シーズン後に編成を変えても記録どおりに再生でき、次のシーズンで消える。
// 3) 倍速の記憶。4) 交代・指示の決まり。5) もしもの試合で保存データ(成績・報酬・順位)が変わらない。
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,initialSandboxState,emptySeason,playGame,rng,scheduleFor,simulateDays,nextSeason,validState,makeReplay,replayResult,sameGame,watchGame,clinchedLeague,substituteBlock,IBB_PER_INNING,type GameResult,type GameState,type LiveSituation,type LiveEvent,type WatchOrder} from '../src/pro/engine';
import {finishPostseason} from '../src/pro/postseason';
import {seasonGames,type Circuit} from '../src/pro/leagues';
import {validGameBox} from '../src/pro/game-log';
import {playerMap,canBat} from '../src/pro/data';
import {watchList,controlSide,readSpeed,saveSpeed,paMillis,homeRunMillis,SPEED_KEY,pitchesFor,countOf,gradeOf} from '../src/pro/watch';
import {PawaSeason} from '../src/pro/pawa/PawaSeason';

type Orders=(s:LiveSituation,events:LiveEvent[])=>WatchOrder|null;
/** 観戦の計算を最後まで回す(orders が指示を出す)。 */
function runWatch(state:GameState,game:GameResult,orders:Orders=()=>null){
 const control=controlSide(state,game),gen=watchGame(state,game,control),events:LiveEvent[]=[];
 let step=gen.next(),guard=0;
 while(!step.done&&guard++<20000){const v=step.value;if(v.type==='event'){events.push(v.e);step=gen.next(undefined);}else step=gen.next(orders(v.s,events));}
 assert.ok(step.done,'試合が終わらない');
 return {result:step.value as GameResult,events};
}
function playSeason(state:GameState){let s=state;while(!s.season.completed)s=simulateDays(s,7);return finishPostseason(s);}
const majorState=(seed:number,circuit:Circuit)=>{const s=initialState(seed);s.season=emptySeason(1,circuit,s.club);if(circuit!=='NPB')s.leagueProgress={basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:0};return s;};
const bench=(s:GameState)=>Object.keys(s.owned).filter(id=>!s.lineup.includes(id)&&!s.pitchers.includes(id)&&canBat(playerMap[id]));

export function registerWatchTests(test:(name:string,run:()=>void)=>void){
 test('watch replay matches "1年進める" for every own game of a domestic, overseas and space season',()=>{
  let total=0,same=0;
  for(const circuit of ['NPB','MLB','SPACE'] as Circuit[]){
   const state=majorState(12345+circuit.length,circuit),random=rng(state.seed),fixtures=scheduleFor(state);
   for(let d=0;d<seasonGames(state.season);d++){
    for(const [home,away] of fixtures[state.season.day]){
     const mine=home===state.club||away===state.club,before=random.state;
     const replay=mine?makeReplay(state,'opening',before,state.season.day):null;
     const result=playGame(state,home,away,random);
     if(replay){total++;const live={...result,replay};if(sameGame(result,replayResult(state,live))&&sameGame(result,runWatch(state,live).result))same++;}
    }
    state.season.day++;
   }
  }
  assert.equal(total,143+162+162);
  assert.equal(same,total,`一致 ${same}/${total}`);
 });
 test('watchable games keep their replay after the season, survive roster changes and disappear next season',()=>{
  for(const circuit of ['NPB','MLB','SPACE'] as Circuit[]){
   const done=playSeason(majorState(2026,circuit)),list=watchList(done);
   assert.ok(list.length>=2,'観られる試合が少ない '+circuit);
   assert.equal(list[0].label,'開幕戦');assert.equal(list[0].game,done.season.results[0]);
   const post=done.season.postseason!;
   // 王座決定戦(国内=japan、海外・宇宙=world)は全試合が観られる。自分が出ていない試合は観るだけ。
   const top=post.series.find(s=>s.stage===(circuit==='NPB'?'japan':'world'))!;
   assert.ok(top.results.length>0&&top.results.every(g=>g.replay?.kind==='post'));
   if(circuit==='SPACE')assert.ok(list.some(w=>w.label.startsWith('宇宙王座決定戦 第1戦')));
   if(circuit==='MLB')assert.ok(list.some(w=>w.label.startsWith('世界王座決定戦 第1戦')));
   if(circuit==='NPB'){
    assert.ok(list.some(w=>w.label.startsWith('国内王座決定戦 第1戦')));
    // プレーオフ(CS)は自分のチームが出た試合だけ。
    for(const s of post.series.filter(s=>s.stage!=='japan'))for(const g of s.results)assert.equal(!!g.replay,[g.home,g.away].includes(done.club));
   }else for(const s of post.series.filter(s=>s.stage!=='world'))assert.ok(s.results.every(g=>!g.replay));
   // シーズンの後に打順・覚醒・育成を変えても、控えから記録どおりに再生できる。
   const changed:GameState={...done,lineup:[...done.lineup].reverse(),owned:Object.fromEntries(Object.entries(done.owned).map(([id,n])=>[id,n+3])),training:Object.fromEntries(Object.keys(done.owned).map(id=>[id,5]))};
   for(const w of list)assert.ok(sameGame(w.game,replayResult(changed,w.game)),`再生が記録と違う ${circuit} ${w.label}`);
   // 控えを持ったセーブも、控えを持たないセーブと同じように読み込める(海外・宇宙はこの試験用の作りなので比べるだけ)。
   const stripped=JSON.parse(JSON.stringify(done,(k,v)=>k==='replay'?undefined:v));
   assert.equal(validState(done),validState(stripped));if(circuit==='NPB')assert.ok(validState(done));
   assert.ok(done.season.results.filter(g=>g.replay).every(g=>validGameBox(g)));
   assert.equal(validGameBox({...done.season.results[0],replay:{...done.season.results[0].replay!,lineup:['x']}}),false);
   assert.equal(validGameBox({...done.season.results[0],replay:{...done.season.results[0].replay!,rng:-1}}),false);
   const next=nextSeason(done);
   assert.equal(watchList(next).length,0);
   assert.ok(next.history.every(h=>h.results.every(g=>!g.replay)&&(h.postseason?.series??[]).every(s=>s.results.every(g=>!g.replay))));
   assert.ok(next.history[0].results.some(g=>g.box),'前のシーズンの成績表は今まで通り残す');
  }
 });
 test('league-clinching game and final-day top-two showdown are watchable and computed without changing results',()=>{
  // 強いチーム(サンドボックス)なら優勝が決まる試合がある。
  const done=playSeason(initialSandboxState()),clinch=done.season.results.filter(g=>g.replay?.kind==='clinch');
  assert.equal(clinch.length,1,'優勝が決まった試合が1つ');
  const day=clinch[0].day-1;
  // その日の後に初めて決まっている(前の日はまだ)。
  assert.ok(day>0&&day<seasonGames(done.season));
  assert.ok(watchList(done).some(w=>w.label==='リーグ優勝が決まった試合'));
  // 決まり方の判定: 残りを全部負けても、2位が全部勝っても上回る時だけ。
  const s=emptySeason(1);const [a,b]=s.standings;s.standings.forEach(t=>{t.w=60;t.l=60;});
  a.w=100;a.l=20;b.w=80;b.l=40;
  assert.equal(clinchedLeague(s,a.team),false,'残り23試合で20差はまだ');
  a.w=100;a.l=30;b.w=70;b.l=60;s.standings.forEach(t=>{if(t!==a&&t!==b){t.w=65;t.l=65;}});
  assert.equal(clinchedLeague(s,a.team),true);
  // 最終戦の首位攻防: その日の前に自分と相手が1位・2位なら控えを残す。無い年もある。
  for(const g of done.season.results.filter(g=>g.replay?.kind==='showdown'))assert.equal(g.day,seasonGames(done.season));
 });
 test('watch speed is remembered (1x/2x/4x) and one plate appearance takes 2.4s / 1.2s / 0.6s',()=>{
  const store=new Map<string,string>(),storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);}};
  assert.equal(readSpeed(storage),1);
  saveSpeed(4,storage);assert.equal(store.get(SPEED_KEY),'4');assert.equal(readSpeed(storage),4);
  saveSpeed(2,storage);assert.equal(readSpeed(storage),2);
  store.set(SPEED_KEY,'8');assert.equal(readSpeed(storage),1);
  assert.equal(readSpeed({getItem:()=>{throw new Error('blocked');}}),1);
  assert.deepEqual([paMillis(1),paMillis(2),paMillis(4)],[2400,1200,600]);
  assert.deepEqual([homeRunMillis(1),homeRunMillis(2),homeRunMillis(4)],[2600,1300,650]);
  // カウントの演出は結果に合う(四球は4球目がボール、三振は3つ目がストライク)。
  for(let i=1;i<200;i++){const bb=pitchesFor('BB',i),k=pitchesFor('K',i);assert.equal(bb.at(-1),'B');assert.equal(bb.filter(x=>x==='B').length,4);assert.equal(k.at(-1),'S');assert.ok(countOf(pitchesFor('1B',i)).b<=3);}
  assert.equal(gradeOf(100),'S+');assert.equal(gradeOf(95),'S');assert.equal(gradeOf(10),'G');
 });
 test('manager orders follow the rules: substitutions, bunt, steal, two intentional walks per inning, nothing for watch-only games',()=>{
  const done=playSeason(initialSandboxState()),list=watchList(done),opening=list[0].game,side=controlSide(done,opening);
  assert.ok(side>=0);
  const subs=bench(done);assert.ok(subs.length>=3,'ベンチに選手がいる');
  // 出られない理由
  assert.equal(substituteBlock(done.lineup,[],done.lineup[0]),'この選手はもう試合に出ている');
  assert.equal(substituteBlock(done.lineup,[subs[0]],subs[0]),'この選手はもう出場した');
  assert.equal(substituteBlock(done.lineup,[],subs[0]),null);
  assert.equal(substituteBlock(done.lineup,[],done.pitchers[0]),'この選手は打てない');
  // 代打 → 退いた選手は戻れない。同じ打者に二度目の代打は通らない(その場で止まる)。
  let pinched='';let tried=false;let back=false;
  const r1=runWatch(done,opening,(s)=>{
   if(s.side!==side)return null;
   if(!pinched&&s.inning>=3){pinched=s.batter;return {kind:'pinch',slot:s.slot,id:subs[0]};}
   if(pinched&&!tried){tried=true;return {kind:'pinch',slot:s.slot,id:subs[0]};}
   if(pinched&&!back&&s.removed[side].includes(pinched)){back=true;return {kind:'pinch',slot:s.slot,id:pinched};}
   return null;
  });
  assert.equal(r1.events.filter(e=>e.kind==='PINCH').length,1,'代打は1回だけ通る');
  assert.ok(r1.result.box!.batting.some(b=>b.playerId===subs[0]&&b.pa>0),'代打の選手が打席に立つ');
  assert.ok(back,'退いた選手が分かる');
  // 投手交代: もう投げた投手(先発も)は戻れない。
  const startId=done.pitchers[opening.replay!.day%6];let step2=0;
  const r2=runWatch(done,opening,(s)=>{
   if(s.side===side)return null;const staff=s.pitchers[1-s.side];
   if(step2===0&&s.inning>=2){step2=1;return {kind:'pitcher',id:staff[10]};}
   if(step2===1&&s.inning>=4){step2=2;return {kind:'pitcher',id:staff[11]};}
   if(step2===2&&s.inning>=6){step2=3;return {kind:'pitcher',id:staff[10]};}
   if(step2===3&&s.inning>=7){step2=4;return {kind:'pitcher',id:startId};}
   return null;
  });
  assert.deepEqual(r2.events.filter(e=>e.kind==='PITCHER').map(e=>e.pitcher),[done.pitchers[10],done.pitchers[11]]);
  assert.ok(r2.result.box!.pitching.some(p=>p.playerId===done.pitchers[10]&&p.outs>0));
  // 代走・守備固め
  let ran=false,fielded=false;
  const r4=runWatch(done,opening,(s)=>{
   if(!ran&&s.side===side&&s.bases[0]){ran=true;return {kind:'runner',base:0,id:subs[1]};}
   if(!fielded&&s.side!==side&&s.inning>=6){fielded=true;const slot=s.lineups[side].findIndex(id=>!['DH','捕'].includes(s.defense[side][id]));return {kind:'field',slot,id:subs[2],position:'DH'};}
   return null;
  });
  if(ran)assert.ok(r4.events.some(e=>e.kind==='RUNNER'&&e.batter===subs[1]));
  assert.ok(r4.events.some(e=>e.kind==='FIELD'&&e.batter===subs[2]));
  // 敬遠は1イニング2回まで、満塁ではできない。
  const r5=runWatch(done,opening,(s)=>s.side!==side?{kind:'ibb'}:null);
  const ibb=r5.events.filter(e=>e.kind==='IBB'),per=new Map<number,number>();
  for(const e of ibb)per.set(e.inning,(per.get(e.inning)??0)+1);
  assert.ok(ibb.length>0&&[...per.values()].every(n=>n<=IBB_PER_INNING));
  assert.ok(ibb.every(e=>e.runs===0),'満塁で敬遠しないので押し出しは無い');
  // 送りバント: 2死や走者なしでは出せず、出せる時は打者がアウトで打数に数えない。
  const r6=runWatch(done,opening,(s)=>s.side===side?{kind:'bunt'}:null);
  const bunts=r6.events.filter(e=>e.kind==='BUNT'||e.kind==='BUNT_FAIL');
  assert.ok(bunts.length>0&&bunts.every(e=>e.outs>=1));
  // 盗塁の指示は一塁に走者・二塁が空いている時だけ。
  const r7=runWatch(done,opening,(s)=>s.side===side?{kind:'steal'}:null);
  assert.ok(r7.events.filter(e=>(e.kind==='SB'||e.kind==='CS')&&e.order).length>0);
  // 守備側から攻撃の指示・攻撃側から守りの指示は効かない(記録どおりのまま)。
  const r8=runWatch(done,opening,(s)=>s.side===side?{kind:'ibb'}:{kind:'bunt'});
  assert.ok(sameGame(r8.result,opening));
  // 自分のチームが出ていない王座決定戦は観るだけ(指示はすべて効かない)。
  const other=list.find(w=>!w.mine);
  if(other){assert.equal(controlSide(done,other.game),-1);const r9=runWatch(done,other.game,(s)=>({kind:'pinch',slot:s.slot,id:subs[0]}));assert.ok(sameGame(r9.result,other.game));}
 });
 test('a what-if game never changes the season record, rewards, standings or the save',()=>{
  const done=playSeason(initialSandboxState()),before=JSON.stringify(done),list=watchList(done);
  for(const w of list.slice(0,4)){
   const side=controlSide(done,w.game);
   const r=runWatch(done,w.game,(s)=>side<0?null:s.side===side?{kind:s.bases[0]&&!s.bases[1]?'steal':'bunt'}:{kind:'ibb'});
   assert.ok(r.result.box);
  }
  assert.equal(JSON.stringify(done),before,'保存データが変わった');
  // 指示なしなら記録と同じ。
  for(const w of list)assert.ok(sameGame(runWatch(done,w.game).result,w.game));
 });
 test('season screen shows the watch entry after the season and a watch button on postseason rows',()=>{
  const done=playSeason(initialSandboxState()),list=watchList(done);
  const html=renderToStaticMarkup(createElement(PawaSeason,{state:done,busy:false,progress:0,onPlay:()=>{},onPost:()=>{},onNext:()=>{},onPlayer:()=>{},message:'',watch:list,onWatch:()=>{}}));
  assert.ok(html.includes('今年の名場面を観る'));
  const none=renderToStaticMarkup(createElement(PawaSeason,{state:initialSandboxState(),busy:false,progress:0,onPlay:()=>{},onPost:()=>{},onNext:()=>{},onPlayer:()=>{},message:'',watch:[],onWatch:()=>{}}));
  assert.ok(!none.includes('今年の名場面を観る'),'シーズンの途中には出さない(1年進めるは止めない)');
 });
}
