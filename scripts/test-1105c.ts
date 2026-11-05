// 11/5 昼(vc43 / 1.5.0 のまま)の試験: 併殺・細かいプレー・ファインプレー・チームの色・敬遠の回数・速さ・演出。
// 持ち主「併殺とかも起こったら良い感じでアニメーションにして」「フォースアウトとかの細かいプレーも、ルール破綻せずに再現するようにして。
// ファインプレーとかなら『ファインプレー』とか出るように。守備能力とかで変わるように」「ユニの色とか良い感じにして。イメージカラーで」
// 「敬遠が回数制限あるの意味不明だから、なくして」「4倍・8倍・16倍速も入れて」「ドパガキが喜ぶような演出にして」。
import assert from 'node:assert/strict';
import {initialState,initialSandboxState,gameSteps,playGame,rng,sameGame,type GameState,type LiveEvent,type GameResult} from '../src/pro/engine';
import {resolveOut,hitPlay,fineChance,dpChance,type PlayCtx,type PlayDetail} from '../src/pro/plays';
import {teams} from '../src/pro/data';
import {mlbLeagueTeams} from '../src/pro/mlb-opponents';
import {teamColor,uniformsFor,colorDistance,TOO_CLOSE} from '../src/pro/team-colors';
import {speeds,pitchPlan,callText} from '../src/pro/watch';
import {fxFor} from '../src/pro/play-fx';
import {choreograph,endOf,BAGS,type V,type Choreo} from '../src/pro/field-sim';
import {simulateDays,nextSeason} from '../src/pro/engine';
import {simulatePostseason,finishPostseason} from '../src/pro/postseason';
import {SKIP_ALL_POST,stopAt,keyGameAhead,advanceKeyDay} from '../src/pro/managed';
import {postReach} from '../src/pro/SimpleApp';

let seed=1;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const ctxOf=(o:Partial<PlayCtx>={}):PlayCtx=>({rnd,speed:()=>55,power:55,contact:55,skill:()=>60,arm:()=>60,teamField:0,tactic:null,...o});
const forcedAt=(bases:(string|null)[],b:number)=>{for(let i=0;i<b;i++)if(!bases[i])return false;return true;};
/** 走者の並びの全部(8通り)×アウト(0〜2)。 */
const SITS:{bases:(string|null)[];outs:number}[]=[];
for(let m=0;m<8;m++)for(let o=0;o<3;o++)SITS.push({bases:[0,1,2].map(b=>m>>b&1?'r'+b:null),outs:o});

/** 試合を回して、出来事(打席の前の塁と回のアウトつき)を集める。指示は出さない(「1年進める」と同じ計算)。 */
function games(n:number,start=11){
 const state:GameState=initialState(start);const ids=teams.map(t=>t.id).filter(id=>id!==state.club);
 const out:{e:LiveEvent;before:(string|null)[];beforeOuts:number;beforeScore:number[]}[]=[];const results:GameResult[]=[];
 const random=rng(start*31+7);
 for(let g=0;g<n;g++){
  state.season.day=g%120;const home=ids[g%ids.length],away=ids[(g+3)%ids.length];
  const steps=gameSteps(state,home,away,random,{interactive:true,control:-1});let s=steps.next(),bases:(string|null)[]=[null,null,null],outs=0,key='',score=[0,0];
  while(!s.done){if(s.value.type==='event'){const e=s.value.e,k=`${e.inning}|${e.side}`;if(k!==key){key=k;bases=[null,null,null];outs=0;}
    out.push({e,before:bases,beforeOuts:outs,beforeScore:score});bases=e.bases;outs=e.outs;score=e.score;}
   s=steps.next(null);}
  results.push(s.value);
 }
 return {events:out,results,state};
}

export function register1105cTests(test:(name:string,run:()=>void)=>void){
 test('plays (11/5): a double play needs a runner on first with fewer than two outs on a grounder; it adds two outs (lead runner forced, batter out at first) and never puts two runners on one base',()=>{
  let dps=0;
  for(const {bases,outs} of SITS)for(let i=0;i<4000;i++){
   const d=resolveOut(bases,outs,'bat',ctxOf());
   const outsAdded=d.fates.filter(f=>f.to===-1).length;
   assert.ok(outs+outsAdded<=3,'アウトは3つまで');
   const occ=d.fates.filter(f=>f.to>=0&&f.to<=2).map(f=>f.to);assert.equal(new Set(occ).size,occ.length,'同じ塁に2人いない');
   assert.equal(d.fates.length,bases.filter(Boolean).length+1,'打者と走者の全員の行き先がある');
   if(d.kind==='DP'&&d.bb==='gb'){
    dps++;assert.ok(bases[0]&&outs<2,'併殺は一塁に走者・2アウト未満');assert.equal(outsAdded,2);
    assert.ok(d.fates.every(f=>f.to!==-1||f.out==='force'),'ゴロの併殺はフォース');assert.ok(/^\d-\d-\d$/.test(d.seq!),d.seq);
   }
   if(d.kind==='TP'){assert.equal(outs,0);assert.equal(outsAdded,3);}
  }
  assert.ok(dps>500,`${dps}`);
 });
 test('plays (11/5): force outs only for forced runners, tag outs for the others (first and second: step on third; second only: third needs a tag); fly balls: runners return, doubled-off runners are out, tag-ups leave after the catch',()=>{
  let forceThird=0,tagThird=0,doubled=0,tagHome=0;
  for(const {bases,outs} of SITS)for(let i=0;i<3000;i++){
   const d=resolveOut(bases,outs,'bat',ctxOf());if(d.kind==='1B')continue;
   for(const f of d.fates){if(f.from<0||f.to!==-1)continue;
    if(d.bb==='gb'){
     assert.equal(f.out,forcedAt(bases,f.from)?'force':'tag',`${JSON.stringify(bases)} ${f.from}→${f.at} ${f.out}`);
     if(f.at===2&&f.out==='force')forceThird++;if(f.at===2&&f.out==='tag')tagThird++;
    }else{assert.ok(f.out==='doubled'||f.out==='tag');if(f.out==='doubled')doubled++;if(f.out==='tag')tagHome++;}
   }
  }
  assert.ok(forceThird>0&&tagThird>0&&doubled>0&&tagHome>0,`${forceThird} ${tagThird} ${doubled} ${tagHome}`);
 });
 test('rules (11/5): a run does not count when the third out is a force out (or the batter-runner before first); runs before a tag-out third out count; GIDP gets no RBI',()=>{
  const {events}=games(160);let cancelled=0,timePlay=0,gidp=0;
  for(const {e,beforeOuts,beforeScore} of events){
   const p=e.play;if(!p)continue;
   const scored=p.fates.filter(f=>f.to===3).length,outs=p.fates.filter(f=>f.to===-1).length;
   const gained=e.score[e.side]-beforeScore[e.side];
   if(beforeOuts+outs>=3&&p.fates.some(f=>f.to===-1&&(f.out==='force'||f.out==='doubled'))){assert.equal(gained,0,'3つ目がフォースなら得点なし');if(scored)cancelled++;}
   else if(e.kind!=='HR'&&!(e.inning>=9&&e.side===1)){assert.equal(gained,scored,`${e.kind} 得点の数`);if(beforeOuts+outs>=3&&scored)timePlay++;}
   if((e.kind==='DP'||e.kind==='TP')&&p.bb==='gb')gidp++;
  }
  assert.ok(gidp>50,`${gidp}`);void cancelled;void timePlay;
 });
 test('stats (11/5): sacrifice flies and sacrifice bunts are not at-bats, the failed bunt is, errors make unearned runs, GIDP is counted per batter',()=>{
  const {events,results}=games(160,23);
  const sh=new Map<string,number>();for(const {e} of events)if(e.kind==='BUNT')sh.set(e.batter,(sh.get(e.batter)??0)+1);
  let gdpEvents=0;for(const {e} of events)if((e.kind==='DP'||e.kind==='TP')&&e.play?.bb==='gb')gdpEvents++;
  let gdp=0,runs=0,er=0;
  for(const r of results){
   for(const b of r.box!.batting){gdp+=b.gdp??0;}
   runs+=r.homeRuns+r.awayRuns;er+=r.box!.pitching.reduce((n,p)=>n+p.er,0);
   for(const b of r.box!.batting)assert.ok(b.ab+b.bb+b.hbp+b.sf<=b.pa,'打数+四死球+犠飛 ≦ 打席');
  }
  // 1試合ずつの表で: 打席 = 打数 + 四死球 + 犠飛 + 犠打(バントは指示が無いので 0)
  for(const r of results)for(const b of r.box!.batting)assert.equal(b.pa,b.ab+b.bb+b.hbp+b.sf,`${b.playerId} 打席の内訳`);
  assert.equal(gdp,gdpEvents,'併殺打の数');assert.ok(er<=runs&&er>runs*.8,`${er}/${runs}`);
 });
 test('invariants (11/5): 10,000 plate appearances never put two runners on one base, never pass three outs, and the score always matches the runs of each play',()=>{
  let pa=0,gi=0;
  while(pa<10000){const {events,results}=games(20,100+gi++);
   for(const {e} of events){
    const ids=e.bases.filter(Boolean);assert.equal(new Set(ids).size,ids.length,'同じ選手が2つの塁に');
    assert.ok(e.outs<=3);if(!['SB','CS','PINCH','RUNNER','FIELD','PITCHER','MOVE'].includes(e.kind))pa++;
   }
   for(const r of results){assert.equal(r.line[0].reduce((a,b)=>a+Math.max(0,b),0),r.awayRuns);assert.equal(r.line[1].reduce((a,b)=>a+Math.max(0,b),0),r.homeRuns);}
  }
 });
 test('same result (11/5): managing with no orders and "advance one year" give the same game, with double plays and fine plays in it',()=>{
  const state=initialSandboxState();
  for(let i=0;i<6;i++){
   const a=structuredClone(state),b=structuredClone(state);
   const r1=playGame(a,a.club,teams[1].id,rng(500+i));
   const steps=gameSteps(b,b.club,teams[1].id,rng(500+i),{interactive:true,control:1});let s=steps.next();while(!s.done)s=steps.next(null);
   assert.ok(sameGame(r1,s.value),'同じ試合');
  }
 });
 test('balance (11/5): 300 games stay in a professional range (runs, average, ERA, errors, GIDP) and better defence allows fewer runs',()=>{
  const {results,state}=games(300,41);
  const B=Object.values(state.season.batting),P=Object.values(state.season.pitching);
  const sum=(a:Record<string,number|string|undefined>[],k:string)=>a.reduce((n,x)=>n+Number(x[k]??0),0);
  const rpg=results.reduce((n,r)=>n+r.homeRuns+r.awayRuns,0)/results.length/2,avg=sum(B as never,'hits')/sum(B as never,'ab'),era=sum(P as never,'er')*27/sum(P as never,'outs');
  const epg=results.reduce((n,r)=>n+(r.errors?.[0]??0)+(r.errors?.[1]??0),0)/results.length/2,gdp=sum(B as never,'gdp')/results.length/2;
  assert.ok(rpg>3.0&&rpg<4.3,`得点 ${rpg}`);assert.ok(avg>.225&&avg<.265,`打率 ${avg}`);assert.ok(era>2.7&&era<4.1,`防御率 ${era}`);
  assert.ok(epg>.3&&epg<.8,`失策 ${epg}`);assert.ok(gdp>.45&&gdp<1.0,`併殺打 ${gdp}`);
 });
 test('fine plays (11/5): the higher the fielder\'s defence, the more hits he turns into outs; low defence lets more balls through; double plays drop with a fast batter',()=>{
  const rate=(skill:number)=>{let fine=0,n=0;for(let i=0;i<20000;i++){const h=hitPlay(1,[null,null,null],0,'b',ctxOf({skill:()=>skill}));n++;if(h.fine)fine++;}return fine/n;};
  const lo=rate(40),mid=rate(60),hi=rate(85);assert.ok(lo<mid&&mid<hi,`${lo} ${mid} ${hi}`);assert.equal(lo,0);
  assert.ok(fineChance(90,'in')>fineChance(60,'in'));
  const miss=(skill:number)=>{let m=0;for(let i=0;i<20000;i++)if(resolveOut([null,null,null],0,'b',ctxOf({skill:()=>skill})).miss)m++;return m;};
  assert.ok(miss(30)>miss(60),'守備が低いと届かずに安打');assert.equal(miss(80),0);
  assert.ok(dpChance({speed:90,power:55,fielderSkill:60,pivotSkill:60,teamField:0,fielder:6})<dpChance({speed:35,power:55,fielderSkill:60,pivotSkill:60,teamField:0,fielder:6}));
 });
 test('picture (11/5): double plays throw to second then first before each runner arrives; force-outs and tag-outs get the ball there first; a laser throw beats the runner home',()=>{
  const {events}=games(120,57);let dp=0,laser=0,forced=0;
  const ctx={fielders:{P:'p',C:'c','1B':'a','2B':'b','3B':'d',SS:'e',LF:'f',CF:'g',RF:'h'},rate:(id:string)=>({speed:id.length*9%100,field:60,arm:55+id.length*3%30})};
  for(const {e,before} of events){
   if(!e.play||!['DP','FC','TP','OUT','SF','1B','2B','3B'].includes(e.kind))continue;
   const c:Choreo=choreograph(e,before,ctx);
   for(const f of e.play.fates){if(f.to!==-1||f.out==='fly')continue;
    const id=f.from<0?'b:'+e.batter:'r:'+f.id,at=f.out==='doubled'?(f.at??f.from):(f.at??0),bag:V=BAGS[at];
    const ball=c.ball.filter(b=>Math.hypot(b.b[0]-bag[0],b.b[1]-bag[1])<2.2).map(b=>b.t1);
    const a=c.actors.find(x=>x.id===id);assert.ok(a,id);
    const arrive=a!.keys.find(k=>Math.hypot(k.p[0]-bag[0],k.p[1]-bag[1])<.2)?.t??Infinity;
    if(ball.length)assert.ok(Math.min(...ball)<arrive,`${e.kind} ${e.play.seq} 送球が先 ${at}`);
    assert.equal(endOf(c,id)!.o,0,'アウトの走者は消える');
    if(e.kind==='DP'||e.kind==='TP')dp++;else forced++;if(e.play.laser)laser++;
   }
  }
  assert.ok(dp>20&&forced>10,`${dp} ${forced} ${laser}`);
 });
 test('team colours (11/5): every club has its own image colour; close colours make the visitors wear white with a coloured cap',()=>{
  const all=[...teams.map(t=>t.id),...mlbLeagueTeams.map(t=>t.id)];
  for(const id of all){const c=teamColor(id);assert.match(c.main,/^#[0-9a-f]{6}$/i);}
  const npb=teams.map(t=>teamColor(t.id).main);assert.equal(new Set(npb).size,npb.length,'国内12球団は全部ちがう色');
  const space=mlbLeagueTeams.map(t=>teamColor(t.id,{circuit:'SPACE'}).main);assert.equal(new Set(space).size,space.length,'宇宙人の30球団も全部ちがう色');
  // 阪神風(黄)と ソフトバンク風(黄): 近い → ビジターは白い上着+差し色の帽子
  const [away,home]=uniformsFor(teamColor('t'),teamColor('h'));
  assert.ok(colorDistance(teamColor('t').main,teamColor('h').main)<TOO_CLOSE);
  assert.equal(away.away,true);assert.ok(colorDistance(away.body,home.body)>=TOO_CLOSE,'見分けられる');
  // 読売風(オレンジ)と 広島風(赤): ちがう → 両方ホームの色
  const [a2,h2]=uniformsFor(teamColor('g'),teamColor('c'));assert.equal(a2.away,false);assert.equal(a2.body,teamColor('g').main);assert.equal(h2.body,teamColor('c').main);
  // 自分のチームは作った時の色
  assert.equal(teamColor('t',{club:'t',clubColor:'#123456'}).main,'#123456');
 });
 test('speed and effects (11/5): 1x to 16x, intentional walks throw no pitches, big plays get bigger effects, at 8x and up only home runs and walk-offs stay',()=>{
  assert.deepEqual([...speeds],[1,2,4,8,16]);
  assert.equal(pitchPlan('IBB',3).length,0,'申告敬遠は球数が増えない');
  // 球の並びは速さに関係しない(16倍でも1倍と同じ球数・成績)
  for(let n=1;n<40;n++)assert.deepEqual(pitchPlan('OUT',n),pitchPlan('OUT',n));
  const ev=(kind:LiveEvent['kind'],runs=0,play?:PlayDetail):LiveEvent=>({kind,inning:5,side:0,batter:'x',slot:0,pitcher:'y',runs,outs:1,bases:[null,null,null],score:[0,0],line:[[],[]],hits:[0,0],errors:[0,0],play});
  const dp:PlayDetail={bb:'gb',fielder:6,word:'ショートゴロ',seq:'6-4-3',dp:true,fates:[]};
  const o={comeback:false,walkoff:false,speed:1,level:'flashy' as const};
  assert.equal(fxFor(ev('DP',0,dp),o)?.title,'ゲッツー!');assert.equal(fxFor(ev('DP',0,dp),o)?.sub,'6-4-3');
  assert.equal(fxFor(ev('HR',1),o)?.tier,'mid');assert.equal(fxFor(ev('HR',4),o)?.tier,'big');
  assert.equal(fxFor(ev('1B',1),{...o,walkoff:true})?.title,'サヨナラ!');
  assert.ok(fxFor(ev('1B',1),{...o,walkoff:true})!.ms>fxFor(ev('HR',1),o)!.ms);
  assert.equal(fxFor(ev('DP',0,dp),{...o,speed:8}),null);assert.ok(fxFor(ev('HR',1),{...o,speed:16}));
  assert.ok(fxFor(ev('HR',1),{...o,speed:4})!.ms<fxFor(ev('HR',1),o)!.ms,'倍速は短い');
  assert.equal(fxFor(ev('K'),{...o,level:'normal'}),null);assert.equal(fxFor(ev('DP',0,dp),{...o,level:'calm'}),null);
  assert.match(callText('DP','x',2,0,5,{call:'ショートゴロ、6-4-3 のダブルプレー!'}),/6-4-3 のダブルプレー/);
 }); test('season end in one go (11/5): one press runs the whole rest of the postseason (CS, Japan Series / title series) without stopping, gives the same result as "advance one year", and the next stop is the opening game of next year',()=>{
  const state=initialSandboxState();let s=state;while(!s.season.completed)s=simulateDays(s,7);
  let guard=0;while(!keyGameAhead(s)&&s.season.postseason?.stage!=='complete'&&guard++<300)s=simulatePostseason(s,1);
  assert.ok(keyGameAhead(s)?.kind==='post','ポストシーズンの札で止まっている');
  s=advanceKeyDay(s);let stops=0;guard=0;
  while(s.season.postseason?.stage!=='complete'&&guard++<500){if(stopAt(s,{noStop:false,skipSeries:SKIP_ALL_POST}))stops++;s=simulatePostseason(s,1);}
  assert.equal(stops,0,'どこにも止まらない');assert.equal(s.season.postseason?.stage,'complete');
  let plain=state;while(!plain.season.completed)plain=simulateDays(plain,7);plain=finishPostseason(plain);
  assert.equal(JSON.stringify(s.season.postseason),JSON.stringify(plain.season.postseason),'1年進めると同じ結果');
  assert.ok(postReach(s).length>0,postReach(s));
  assert.equal(stopAt(nextSeason(s),{noStop:false,skipSeries:SKIP_ALL_POST})?.label,'開幕戦','次に止まるのは翌年の開幕戦');
 });

}
