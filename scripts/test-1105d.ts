// 11/5 夕方(vc43 / 1.5.0 のまま)の試験: 大会の名前・王手まで進める・日程表の「この試合の前まで進める」・次のイニングへ・
// 効果音の時刻・ホームの大きな目標・指さしの案内の順番。
// 持ち主「日本一決定戦、CS はポストシーズンに変えてください」「4勝で勝ち抜けのシリーズだと思いますが、直前まで、どっちかの王手までスキップ出来るようにして」
// 「日程表を選択肢として入れて、ここまでスキップみたいなのを指定できるようにして」「イニングスキップも出来るようにして」「ボールを捕った音とか、良い感じに入れるようにして」
// 「目標は大きく書いて。目的が分かるように」「チュートリアルとかも、どこをどこ押せばいいとか、ある程度分かりやすくして」。
import assert from 'node:assert/strict';
import {initialSandboxState,initialState,emptySeason,simulateDays,gameSteps,rng,type GameState,type GameResult,type WatchOrder,type LiveEvent} from '../src/pro/engine';
import {teams} from '../src/pro/data';
import {simulatePostseason,finishPostseason,stageLabel,newPostseason} from '../src/pro/postseason';
import {stopAt,managedGame,ownPosition,ownSeries,seriesAtReach,seriesKey,pinReachable,advanceKeyDay,keyGameAhead,type StopRules} from '../src/pro/managed';
import {seriesName} from '../src/pro/watch';
import {scheduleRows} from '../src/pro/schedule';
import {goalHeadline,goalLadder} from '../src/pro/league-goal';
import {MAIN_GUIDE,MATCH_GUIDE,nextGuide,readGuide,saveGuide,resetGuides,guideKey,readMatchGuide,saveMatchGuideDone} from '../src/pro/guide';
import {soundCues,thinCues} from '../src/pro/play-sounds';
import {choreograph,pitchClip,type Choreo} from '../src/pro/field-sim';
import {soundFiles} from '../src/pro/game-audio';
import {titleFor,type Circuit} from '../src/pro/leagues';
import {readFileSync} from 'node:fs';

const sandbox=(circuit:Circuit='NPB')=>{const s=initialSandboxState();if(circuit!=='NPB'){s.season=emptySeason(1,circuit,s.club);s.leagueProgress={basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:0};}return s;};
function plainYear(state:GameState){let s=state;while(!s.season.completed)s=simulateDays(s,7);return finishPostseason(s);}
/** アプリと同じ進め方(止まったら、その日を「一気に進める」と同じ計算で1日進める)。 */
function run(state:GameState,rules:Partial<StopRules>,until?:(s:GameState)=>boolean){
 let s=state;const stops:{pos:string|null;label:string;reason?:string}[]=[];let guard=0,first=true;
 while(guard++<4000){
  if(until&&until(s))break;
  const k=first?null:stopAt(s,{noStop:false,skipSeries:null,...rules});first=false;
  if(k){stops.push({pos:ownPosition(s),label:k.label,reason:k.reason});return {s,stops};}
  if(!s.season.completed){s=simulateDays(s,1);continue;}
  if(s.season.postseason?.stage!=='complete'){s=simulatePostseason(s,1);continue;}
  break;
 }
 return {s,stops};
}
const memory=()=>{const store=new Map<string,string>();return {store,getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);},removeItem:(k:string)=>{store.delete(k);}};};
const OLD=/日本シリーズ|ワールドシリーズ|クライマックス|World Series|王座決定戦|プレーオフ/;

export function register1105dTests(test:(name:string,run:()=>void)=>void){
 test('names (11/5): series are called ポストシーズン 1st / 2nd / ファイナル, 日本一決定戦, 世界一決定戦 and 宇宙一決定戦; no trademarked or old names remain in labels, titles or the guide',()=>{
  assert.equal(stageLabel('first'),'ポストシーズン 1st');assert.equal(stageLabel('final'),'ポストシーズン ファイナル');
  assert.equal(stageLabel('japan'),'日本一決定戦');assert.equal(stageLabel('world'),'世界一決定戦');
  assert.equal(stageLabel('wildcard'),'ポストシーズン 1st');assert.equal(stageLabel('division'),'ポストシーズン 2nd');assert.equal(stageLabel('championship'),'ポストシーズン ファイナル');
  assert.equal(seriesName({stage:'world'},true),'宇宙一決定戦');
  for(const st of ['first','final','japan','wildcard','division','championship','world','complete'] as const)assert.ok(!OLD.test(stageLabel(st)),st);
  for(const c of ['NPB','MLB','SPACE'] as Circuit[])assert.ok(!OLD.test(titleFor(emptySeason(1,c))),c);
  const guide=readFileSync('public/guide.html','utf8');assert.ok(!OLD.test(guide),'遊び方のページ');
 });
 test('old saves (11/5): saves keep only the stage ids, so a postseason saved before the rename shows the new names after loading',()=>{
  let s=sandbox();while(!s.season.completed)s=simulateDays(s,7);s=simulatePostseason(s,40);
  const back=JSON.parse(JSON.stringify(s)) as GameState;// 保存して読み込み直したのと同じ
  const raw=JSON.stringify(back);assert.ok(!OLD.test(raw),'保存の中に大会の名前の文字は入らない');
  for(const x of back.season.postseason!.series)assert.ok(!OLD.test(seriesName(x,false)));
 });
 test('reach (11/5): "王手まで進める" runs the short series on without stopping until the game where either side is one win away, and the year ends exactly like "1年進める"',()=>{
  let checked=0;
  for(const circuit of ['NPB','MLB'] as Circuit[]){
   const state=sandbox(circuit),plain=JSON.stringify(plainYear(state));
   let s=state;while(!s.season.completed)s=simulateDays(s,7);
   // 自分のシリーズの第1戦の札まで
   let g=0;while(!(ownSeries(s)&&ownSeries(s)!.results.length===0)&&s.season.postseason?.stage!=='complete'&&g++<50)s=simulatePostseason(s,1);
   const ser=ownSeries(s);if(!ser)continue;
   assert.ok(!seriesAtReach(ser)||ser.advantage>0,'第1戦はまだ王手でないことが多い');
   const key=seriesKey(s,ser.id),r=run(s,{untilReach:key});
   const at=ownSeries(r.s);
   if(at&&at.id===ser.id){assert.ok(seriesAtReach(at),`${circuit} 止まったのは王手の試合 ${at.wins.join('-')}/${at.target}`);assert.ok(r.stops.length===1);checked++;}
   // そこから先も同じ計算: 最後まで進めると「1年進める」と1つも違わない
   assert.equal(JSON.stringify(finishPostseason(r.s)),plain,`${circuit} 結果は1年進めると同じ`);
  }
  assert.ok(checked>=1,'王手で止まった');
 });
 test('schedule (11/5): the list has every regular-season game with opponent and result, marks the next game, and "この試合の前まで進める" stops exactly before the chosen game without stopping at key games on the way',()=>{
  const state=sandbox(),rows=scheduleRows(state);
  assert.equal(rows.filter(r=>r.section==='regular').length,143);assert.equal(rows.filter(r=>r.now).length,1);assert.equal(rows[0].now,true);
  assert.ok(rows.every(r=>r.opponent&&r.opponent!==state.club));
  // 開幕戦(大事な試合)も止まらずに、第51戦の前まで
  const r=run(state,{pin:'r50'},);
  assert.equal(r.s.season.day,50);assert.equal(r.stops.length,1);assert.equal(r.stops[0].pos,'r50');
  const g=managedGame(r.s,true);assert.ok(g);assert.equal(g!.label,'第51戦');assert.equal(keyGameAhead(r.s),null,'ふだんは止まらない試合');
  const after=scheduleRows(r.s);assert.equal(after.filter(x=>x.result).length,50);assert.ok(after[50].now);assert.ok(!after[49].pickable,'終わった試合は選べない');
  // そこから一気に進めても「1年進める」と同じ
  assert.equal(JSON.stringify(plainYear(r.s)),JSON.stringify(plainYear(state)));
  // ポストシーズンの試合も選べる(今のシリーズの、まだの試合)
  let s=state;while(!s.season.completed)s=simulateDays(s,7);let k=0;while(!ownSeries(s)&&s.season.postseason?.stage!=='complete'&&k++<40)s=simulatePostseason(s,1);
  const ser=ownSeries(s);
  if(ser){const pos=`${ser.id}#${ser.results.length+1}`;assert.ok(pinReachable(s,pos));
   const pr=scheduleRows(s).find(x=>x.pos===pos)!;assert.ok(pr.pickable&&pr.section==='post'&&!OLD.test(pr.group)&&pr.group===seriesName(ser,false)&&pr.label===`第${ser.results.length+2}戦`);
   const rr=run(s,{pin:pos});const at=ownSeries(rr.s);
   if(at&&at.id===ser.id)assert.equal(ownPosition(rr.s),pos,'選んだ第何戦の前で止まる');
   else assert.equal(pinReachable(rr.s,pos),false,'先に決着したら、もう届かない');}
 });
 test('inning skip (11/5): "次のイニングへ" gives the same game as pressing "次の打席へ" through the inning, with an order given once',()=>{
  const state=initialState(7),ids=teams.map(t=>t.id).filter(id=>id!==state.club);
  for(let n=0;n<6;n++){
   const order:WatchOrder={kind:'tactic',scope:'team',tactic:'power'} as WatchOrder;
   // 1打席ずつ: 最初の判断で作戦を出し、あとは何もしない
   const one=gameSteps(state,state.club,ids[n],rng(100+n),{interactive:true,control:1});
   let a=one.next(),sent=false,inputsA:(WatchOrder|null)[]=[];
   while(!a.done){if(a.value.type==='decide'){const v=sent?null:order;sent=true;inputsA.push(v);a=one.next(v);}else a=one.next(null);}
   // イニングごと: 回が替わるまで止まらず回す(画面の skipInning と同じ渡し方)
   const two=gameSteps(state,state.club,ids[n],rng(100+n),{interactive:true,control:1});
   let b=two.next(),pending:WatchOrder|null=order,inning=0;const inputsB:(WatchOrder|null)[]=[];
   while(!b.done){if(b.value.type==='decide'){const s=b.value.s;if(s.inning!==inning)inning=s.inning;const v=pending;pending=null;inputsB.push(v);b=two.next(v);}else b=two.next(null);}
   const ra=a.value as GameResult,rb=b.value as GameResult;
   assert.equal(JSON.stringify([ra.homeRuns,ra.awayRuns,ra.line]),JSON.stringify([rb.homeRuns,rb.awayRuns,rb.line]));
   assert.deepEqual(inputsA,inputsB);
  }
  const src=readFileSync('src/pro/WatchScreen.tsx','utf8');
  assert.ok(src.includes('次の<br/>イニングへ')&&src.includes('次の<br/>打席へ')&&src.includes('試合<br/>終了まで'),'3つの飛ばすボタン');
  assert.ok(/const skipInning=.*l\.sit\.inning===inning/s.test(src),'回が替わるまで');
 });
 test('sounds (11/5): the mitt pops when the pitch reaches the catcher, fouls sound on contact, catches sound when the ball reaches the glove, throws and slides at their moments; fast speeds thin them out; every new file is a credited recording',()=>{
  const ctx={fielders:{P:'p',C:'c','1B':'a','2B':'b','3B':'d',SS:'e',LF:'f',CF:'g',RF:'h'},rate:()=>({speed:60,field:60,arm:60})};
  const e={batter:'x1',pitcher:'p'};
  const ball=pitchClip(ctx,e,[null,null,null],'B'),pb=ball.ball.find(s=>s.kind==='pitch')!;
  const cb=soundCues(ball);assert.equal(cb.length,1);assert.equal(cb[0].kind,'mitt');assert.ok(Math.abs(cb[0].t-pb.t1)<1e-9,'ミットに届いた瞬間');
  const k=soundCues(pitchClip(ctx,e,[null,null,null],'S',{last:true}),{lastK:true});assert.equal(k[0].kind,'strikeout');
  const foul=pitchClip(ctx,e,[null,null,null],'F'),pf=foul.ball.find(s=>s.kind==='pitch')!;const cf=soundCues(foul);
  assert.equal(cf.length,1);assert.equal(cf[0].kind,'foul');assert.ok(Math.abs(cf[0].t-pf.t1)<1e-9,'打った瞬間(前は球の動きが終わってから鳴っていた)');
  assert.equal(soundCues(pitchClip(ctx,e,[null,null,null],'X')).length,0,'打った球は打球音だけ');
  // 実際の試合の出来事で: 捕る音は球が届いた時刻、その前には鳴らない
  const state=initialState(9),ids=teams.map(t=>t.id).filter(id=>id!==state.club);let outs=0,throws=0,slides=0,steps=0;
  for(let n=0;n<30;n++){
   const it=gameSteps(state,ids[n%ids.length],ids[(n+4)%ids.length],rng(300+n),{interactive:true,control:-1});let s=it.next(),bases:(string|null)[]=[null,null,null],key='';
   while(!s.done){if(s.value.type==='event'){const ev=s.value.e as LiveEvent,kk=`${ev.inning}|${ev.side}`;if(kk!==key){key=kk;bases=[null,null,null];}
     if(ev.play||['SB','CS','1B','2B','3B','OUT','DP','FC','SF'].includes(ev.kind)){const c:Choreo=choreograph(ev,bases,ctx),cues=soundCues(c);
      for(const q of cues){assert.ok(q.t>=0&&q.t<=c.len+.2);
       if(q.kind==='glove'||q.kind==='infield'){const seg=c.ball.find(b=>Math.abs(b.t1-q.t)<1e-9);assert.ok(seg,'捕る音は球が着いた時刻');outs++;}
       if(q.kind==='throw'){assert.ok(c.ball.some(b=>b.kind==='throw'&&Math.abs(b.t0-q.t)<1e-9));throws++;}
       if(q.kind==='slide')slides++;if(q.kind==='step')steps++;}
      const order=cues.map(q=>q.t);assert.deepEqual(order,[...order].sort((x,y)=>x-y));}
     bases=ev.bases;}
    s=it.next(null);}
  }
  assert.ok(outs>50&&throws>20&&steps>10,`${outs} ${throws} ${slides} ${steps}`);
  // 倍速の間引き: 8倍以上は鳴らさない、4倍は捕る音1つだけ、2倍は足音・送球の風切りを外す
  const many=[{t:.1,kind:'throw'},{t:.3,kind:'infield'},{t:.32,kind:'infield'},{t:.4,kind:'step'},{t:.7,kind:'step'},{t:1.0,kind:'step'},{t:1.3,kind:'step'},{t:1.5,kind:'glove'}] as const;
  assert.equal(thinCues([...many],8).length,0);assert.deepEqual(thinCues([...many],4).map(x=>x.kind),['infield']);
  assert.ok(thinCues([...many],2).every(x=>x.kind!=='step'&&x.kind!=='throw'));
  const one=thinCues([...many],1);assert.equal(one.filter(x=>x.kind==='infield').length,1,'同じ音が重なりすぎない');assert.equal(one.filter(x=>x.kind==='step').length,3,'足音は3つまで');
  // 新しい音のファイルがあり、出典が書いてある
  const credits=readFileSync('public/THIRD_PARTY_ASSETS.txt','utf8')+readFileSync('public/audio/freesound/field-LICENSE.txt','utf8');
  for(const k of ['glove','infield','throw','step','slide','bounce']){const f=soundFiles[k];assert.ok(f&&readFileSync('public/audio/'+f).length>1000,k);assert.ok(credits.includes(f.split('/').pop()!),`出典 ${k}`);}
 });
 test('goal (11/5): the home shows one big current goal with progress (国内リーグ 3年連続優勝, あと○年), then switches to the next goal by itself; the list shows now / next / later',()=>{
  const s=sandbox();s.leagueProgress={basis:'league',npbStreak:1,mlbUnlocked:false,lastSettledSeason:0};
  const g=goalHeadline(s);assert.equal(g.title,'国内リーグ 3年連続優勝');assert.equal(g.meterLabel,'連続優勝');assert.equal(g.value,1);assert.equal(g.goal,3);assert.equal(g.left,2);
  assert.deepEqual(goalLadder(s).map(x=>x.status),['now','next','next']);
  s.leagueProgress={basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:0};
  const m=goalHeadline(s);assert.equal(m.stage,'mlb');assert.ok(m.title.includes('世界一決定戦'));assert.deepEqual(goalLadder(s).map(x=>x.status),['done','now','next']);
  for(const x of [g,m])assert.ok(!OLD.test(x.title+x.sub));
  const src=readFileSync('src/pro/HomeGoal.tsx','utf8');assert.ok(src.includes('2400'),'達成の帯は約2.4秒で自然に消える(タップ待ちにしない)');assert.ok(!/onClick=\{[^}]*setFlash\(null\)/.test(src));
 });
 test('guide (11/5): the pointer guide goes scout → team → おまかせ編成 → 試合・成績 → 1年進める → 監督して戦う, the match guide shows 作戦 → 速さ → 交代 → 飛ばす → 次へ; skipping and replaying from the settings work, and players who finished the old tutorial are not interrupted',()=>{
  assert.deepEqual(MAIN_GUIDE.map(x=>x.id),['starter','team-tab','order','season-tab','year','manage']);
  assert.deepEqual(MATCH_GUIDE.map(x=>x.id),['tactic','speed','sub','skip','next']);
  let id:string|null='starter';const seen:string[]=[];while(id){seen.push(id);id=nextGuide(id);}assert.equal(seen.length,MAIN_GUIDE.length);
  assert.ok([...MAIN_GUIDE,...MATCH_GUIDE].every(x=>x.text.length<=40&&!/。.+。/.test(x.text)),'各段は1文で短く');
  assert.ok(MATCH_GUIDE.slice(0,4).every(x=>!x.pass),'試合中の説明は、押しても作戦の窓などを開かない');
  const mem=memory();
  assert.equal(readGuide('career',true,mem),'starter');assert.equal(readGuide('career',false,mem),'team-tab');
  saveGuide('career','year',mem);assert.equal(readGuide('career',false,mem),'year');saveGuide('career',null,mem);assert.equal(readGuide('career',false,mem),null);
  const old=memory();old.setItem('diamond-nine-tutorial-v1-career','done');assert.equal(readGuide('career',false,old),null,'前の版のチュートリアルを終えた人');
  resetGuides('career',mem);assert.equal(mem.getItem(guideKey('career')),null);assert.equal(readGuide('career',false,mem),'team-tab','設定からもう一度');
  assert.equal(readMatchGuide(mem),true);saveMatchGuideDone(mem);assert.equal(readMatchGuide(mem),false);
  const app=readFileSync('src/pro/SimpleApp.tsx','utf8');
  for(const sel of ['data-guide={\'tab-\'+t.id}','data-guide="year"'])assert.ok(app.includes(sel),sel);
  assert.ok(readFileSync('src/pro/pawa/PawaTeam.tsx','utf8').includes('data-guide="auto-order"'));
  assert.ok(readFileSync('src/pro/GuideCoach.tsx','utf8').includes('飛ばす'));
 });
}
void advanceKeyDay;void newPostseason;
