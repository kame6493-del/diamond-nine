// 試合中の成績(2026-11-04 vc43、持ち主「試合中に1打席の結果が出た際に、打率とか防御率とか動くようにしてください」)の試験。
// 1) 打席ごとに、その打者・投手の今季の成績(試合前の表+この試合のここまで)が、その打席の分だけ変わる。
// 2) 試合の終わりの画面の数 = 試合の結果を入れた後のシーズン(短期決戦は短期決戦)の表。二重に数えない。
// 3) 投球回0の時の防御率は「-」。変わった向き(良くなった/悪くなった)の決まり。
import assert from 'node:assert/strict';
import {initialSandboxState,emptySeason,simulateDays,era,type BatStats,type GameResult,type GameState,type LiveEvent,type PitStats,type WatchOrder} from '../src/pro/engine';
import {simulatePostseason} from '../src/pro/postseason';
import {type Circuit} from '../src/pro/leagues';
import {keyGameAhead,managedGame,advanceKeyDay,commitManaged,liveGame,type ManagedGame} from '../src/pro/managed';
import {batLine,pitLine,batMove,pitMove,avgText,eraText,snapshot} from '../src/pro/live-stats';
import {isPlateAppearance} from '../src/pro/watch';
import {SPOTS,HOME,MOUND,CATCHER_DROP,fieldPlay,trackAt} from '../src/pro/watch-play';

const sandbox=(circuit:Circuit)=>{const s=initialSandboxState();if(circuit!=='NPB'){s.season=emptySeason(1,circuit,s.club);s.leagueProgress={basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:0};}return s;};
/** 開幕戦の前に、今季の成績が既にある形にする(試合前の表+この試合、を確かめるため)。 */
function withSeasonStats(s:GameState){
 const t=structuredClone(s);
 t.lineup.forEach((id,i)=>{t.season.batting[`${t.club}|${id}`]={playerId:id,team:t.club,games:40,pa:160,ab:140,hits:38+i,doubles:7,triples:1,hr:4+i,rbi:20+i,runs:18,bb:15,so:30,sb:3,hbp:2,sf:3};});
 t.pitchers.forEach((id,i)=>{t.season.pitching[`${t.club}|${id}`]={playerId:id,team:t.club,games:12,starts:i<6?12:0,wins:5,losses:4,saves:i===13?6:0,outs:200+i*3,hits:70,er:25+i,bb:20,so:60+i,hr:8,hbp:2,bf:300};});
 return t;
}
interface Seen {e:LiveEvent[];bat:Record<string,BatStats>;pit:Record<string,PitStats>}
/** 画面と同じ回し方: 打席の前(decide)ごとに、そこまでの出来事と、この試合の成績の写しを残す。 */
function watchSteps(g:ManagedGame,orders:(i:number)=>WatchOrder|null=()=>null){
 const gen=liveGame(g),inputs:(WatchOrder|null)[]=[],seen:Seen[]=[];let events:LiveEvent[]=[];
 let step=gen.next(),guard=0,tables:{bat:Record<string,BatStats>;pit:Record<string,PitStats>}|null=null;
 while(!step.done&&guard++<20000){
  const v=step.value;let x:WatchOrder|null=null;
  if(v.type==='event')events.push(v.e);
  else{tables={bat:v.s.batToday,pit:v.s.pitToday};seen.push({e:events,bat:snapshot(v.s.batToday),pit:snapshot(v.s.pitToday)});events=[];x=orders(seen.length);}
  inputs.push(x);step=gen.next(x);
 }
 assert.ok(step.done,'試合が終わらない');
 seen.push({e:events,bat:snapshot(tables!.bat),pit:snapshot(tables!.pit)});// 試合の終わり
 return {result:step.value as GameResult,inputs,seen};
}
const sides=(g:ManagedGame,e:LiveEvent)=>{const bt=e.side===0?g.away:g.home,pt=e.side===0?g.home:g.away;return {bk:`${bt}|${e.batter}`,pk:`${pt}|${e.pitcher}`};};
const numeric=<T extends object>(o:T)=>Object.entries(o).filter(([,v])=>typeof v==='number') as [keyof T,number][];
/** 試合前の表 + この試合 = 入れた後の表(数の項目すべて)。 */
function assertCommitted(label:string,before:{batting:Record<string,BatStats>;pitching:Record<string,PitStats>},result:GameResult,after:{batting:Record<string,BatStats>;pitching:Record<string,PitStats>}){
 let n=0;
 for(const b of result.box!.batting){const k=`${b.team}|${b.playerId}`,pre=before.batting[k],post=after.batting[k];assert.ok(post,`${label}: ${k} がシーズンに無い`);
  for(const [f,v] of numeric(b))assert.equal((pre?.[f] as number??0)+v,post[f],`${label}: 打者 ${k} ${String(f)}`);
  assert.deepEqual(batLine(pre,b),batLine(post),`${label}: 画面の打者の今季 ${k}`);assert.equal(avgText(batLine(pre,b)),avgText(batLine(post)));n++;}
 for(const p of result.box!.pitching){const k=`${p.team}|${p.playerId}`,pre=before.pitching[k],post=after.pitching[k];assert.ok(post,`${label}: ${k} がシーズンに無い`);
  for(const [f,v] of numeric(p))assert.equal((pre?.[f] as number??0)+v,post[f],`${label}: 投手 ${k} ${String(f)}`);
  const line=pitLine(pre,p);assert.deepEqual(line,pitLine(post));assert.equal(eraText(line),post.outs?era(post).toFixed(2):'-',`${label}: 防御率 ${k}`);n++;}
 return n;
}

export function registerLiveStatsTests(test:(name:string,run:()=>void)=>void){
 test('live stats: each plate appearance moves the batter and pitcher season lines by exactly that plate appearance',()=>{
  let pas=0,hits=0,ks=0,hrs=0,flashes=0;
  for(const [circuit,seed] of [['NPB',0],['MLB',0],['SPACE',0]] as [Circuit,number][]){
   const state=withSeasonStats(sandbox(circuit)),g=managedGame(state)!;assert.ok(g,'開幕戦で止まる');void seed;
   const {seen}=watchSteps(g),season=g.base.season;
   for(let i=1;i<seen.length;i++){
    const prev=seen[i-1],cur=seen[i],pa=cur.e.filter(e=>isPlateAppearance(e.kind));
    // 打者ごと・投手ごとに、この間の打席の数だけ打席数・対戦打者数が増える(他の選手は変わらない)。
    const wantPa:Record<string,number>={},wantBf:Record<string,number>={};
    for(const e of pa){const {bk,pk}=sides(g,e);wantPa[bk]=(wantPa[bk]??0)+1;wantBf[pk]=(wantBf[pk]??0)+1;}
    for(const k of new Set([...Object.keys(prev.bat),...Object.keys(cur.bat)]))assert.equal((cur.bat[k]?.pa??0)-(prev.bat[k]?.pa??0),wantPa[k]??0,`${circuit} 打席数 ${k}`);
    for(const k of new Set([...Object.keys(prev.pit),...Object.keys(cur.pit)]))assert.equal((cur.pit[k]?.bf??0)-(prev.pit[k]?.bf??0),wantBf[k]??0,`${circuit} 対戦打者 ${k}`);
    if(pa.length!==1)continue;
    const e=pa[0],{bk,pk}=sides(g,e);pas++;
    const b0=batLine(season.batting[bk],prev.bat[bk]),b1=batLine(season.batting[bk],cur.bat[bk]),p0=pitLine(season.pitching[pk],prev.pit[pk]),p1=pitLine(season.pitching[pk],cur.pit[pk]);
    const hit=['1B','2B','3B','HR'].includes(e.kind);
    assert.equal(b1.hits-b0.hits,hit?1:0,`${circuit} 安打 ${e.kind}`);
    assert.equal(b1.hr-b0.hr,e.kind==='HR'?1:0);
    assert.equal(p1.so-p0.so,e.kind==='K'?1:0);
    if(e.kind==='HR')assert.equal(b1.rbi-b0.rbi,e.runs,'本塁打の打点');
    // 試合前の表があるので、打率は「試合前+ここまで」(試合の分だけの打率ではない)。
    assert.equal(avgText(b1),b1.ab?(b1.hits/b1.ab).toFixed(3).replace(/^0/,''):'---');
    if(bk.startsWith(state.club+'|'))assert.ok(b1.ab>=140,'試合前の表が入っている(打者)');
    if(pk.startsWith(state.club+'|'))assert.ok(p1.outs>=200,'試合前の表が入っている(投手)');
    const bm=batMove(b0,b1),pm=pitMove(p0,p1);
    if(hit&&b0.hits<b0.ab){assert.ok(bm&&bm.avg==='up',`${circuit} 安打で打率が上がる ${avgText(b0)}→${avgText(b1)}`);}
    if(e.kind==='K'){assert.ok(bm?.avg==='down'||avgText(b0)===avgText(b1),'三振で打率が下がる');assert.equal(pm?.so,'up');}
    if(p0.outs>0&&p1.outs>p0.outs&&p1.er===p0.er)assert.ok(!pm?.era||pm.era==='up','無失点のアウトで防御率は下がる(良くなる)');
    if(p1.er>p0.er)assert.ok(pm&&pm.er==='down'&&(!pm.era||pm.era==='down'),'自責点で防御率が上がる(悪くなる)');
    if(bm||pm)flashes++;
    hits+=hit?1:0;ks+=e.kind==='K'?1:0;hrs+=e.kind==='HR'?1:0;
   }
  }
  assert.ok(pas>150&&hits>20&&ks>10&&flashes>pas*.8,`打席 ${pas} 安打 ${hits} 三振 ${ks} 本塁打 ${hrs} 光る ${flashes}`);
 });
 test('live stats: at the end of the game the screen numbers equal the season after the result is committed (opening and postseason, no double counting)',()=>{
  let checked=0,post=0;
  for(const circuit of ['NPB','MLB','SPACE'] as Circuit[]){
   // 開幕戦(試合前の表あり): 監督して何も指示しない試合と、盗塁などの指示を出した試合。
   const state=withSeasonStats(sandbox(circuit)),g=managedGame(state)!;
   for(const orders of [()=>null,(i:number)=>i%5===0?{kind:'steal'} as WatchOrder:null]){
    const {result,inputs,seen}=watchSteps(g,orders),after=commitManaged(state,g.control,inputs);
    // 画面の最後の写し(seen の最後)と試合の成績表が同じ数。
    const last=seen[seen.length-1];
    for(const b of result.box!.batting)assert.deepEqual(batLine(undefined,last.bat[`${b.team}|${b.playerId}`]),batLine(undefined,b));
    checked+=assertCommitted(`${circuit} 開幕戦`,g.base.season,result,after.season);
    // 出なかった選手は変わらない。
    for(const [k,v] of Object.entries(state.season.batting))if(!result.box!.batting.some(b=>`${b.team}|${b.playerId}`===k))assert.deepEqual(after.season.batting[k],v);
   }
   // 短期決戦(2戦目以降は短期決戦の表に前の試合の分がある)。
   let s=state,guard=0,stops=0;
   while(guard++<3000){
    const k=keyGameAhead(s);
    if(k){
     if(k.kind==='post'){const g2=managedGame(s)!;stops++;const before=structuredClone(g2.base.season),{result,inputs}=watchSteps(g2),after=commitManaged(s,g2.control,inputs);
      checked+=assertCommitted(`${circuit} ${k.label}`,before,result,after.season.postseason!);post++;
      // レギュラーシーズンの表は短期決戦の試合で変わらない(二重に入らない)。
      assert.deepEqual(after.season.batting,s.season.batting,`${circuit} ${k.label}: レギュラーシーズンの表が変わった`);
      s=after;if(stops>=3)break;continue;}
     s=advanceKeyDay(s);continue;}
    if(!s.season.completed){s=simulateDays(s,7);continue;}
    if(s.season.postseason?.stage!=='complete'){s=simulatePostseason(s,1);continue;}
    break;
   }
  }
  assert.ok(checked>200&&post>=3,`確かめた選手 ${checked}・短期決戦 ${post}試合`);
 });
 test('live stats: ERA shows "-" with zero innings, and the up/down rules',()=>{
  assert.equal(eraText(pitLine()),'-');
  assert.equal(eraText(pitLine(undefined,{playerId:'x',team:'t',games:1,starts:0,wins:0,losses:0,saves:0,outs:0,hits:2,er:3,bb:1,so:0,hr:0,hbp:0,bf:4})),'-','0回で3失点でも「-」');
  assert.equal(eraText({outs:27,er:3}),'3.00');assert.equal(eraText({outs:1,er:1}),'27.00');assert.equal(eraText({outs:200,er:25}),(25*27/200).toFixed(2));
  // 0回のまま自責点が増えた: 防御率は「-」のまま、自責点だけ悪くなった印。
  const z0={outs:0,er:0,so:0,wins:0,saves:0},z1={...z0,er:2},m0=pitMove(z0,z1)!;
  assert.equal(m0.era,undefined);assert.equal(m0.er,'down');
  // 「-」から初めてのアウト: 0.00 は良くなった、自責点があれば悪くなった。
  assert.equal(pitMove(z0,{...z0,outs:1})!.era,'up');assert.equal(pitMove(z1,{...z1,outs:1})!.era,'down');
  // 打率: .250(1/4)→ 安打 .400 は上がる、凡退 .200 は下がる。打席が増えても表示の桁が同じなら動かさない。
  const b=(ab:number,hits:number)=>({ab,hits,hr:0,rbi:0,pa:ab,sb:0});
  assert.equal(batMove(b(4,1),b(5,2))!.avg,'up');assert.equal(batMove(b(4,1),b(5,1))!.avg,'down');
  assert.equal(batMove(b(400,100),b(400,100)),null);assert.equal(avgText(b(0,0)),'---');
  assert.equal(batMove(b(0,0),b(1,1))!.avg,'up');assert.equal(batMove(b(0,0),b(1,0))!.avg,'down');
  // 防御率: 3.00(27回で9自責=81アウト)→ 無失点の1アウトで下がる=良くなった。
  const p=(outs:number,er:number)=>({outs,er,so:0,wins:0,saves:0});
  assert.equal(pitMove(p(81,9),p(82,9))!.era,'up');assert.equal(pitMove(p(81,9),p(81,10))!.era,'down');assert.equal(pitMove(p(81,9),p(82,9))!.ip,'up');
 });
 test('watch field: the catcher stands right behind home plate on the pitcher-home line, inside the field, and moves from there',()=>{
  // 2026-11-04 持ち主「試合中の捕手の位置、ちょっとおかしいので良い感じにしてください」(前は 57%,101% で枠の下で切れていた)。
  const [x,y,dy=0]=SPOTS.捕;
  assert.equal(x,HOME[0]);assert.equal(x,MOUND[0],'投手と本塁を結ぶ線の上');assert.equal(y,HOME[1]);assert.equal(dy,CATCHER_DROP);
  // 大きさは watch.css と同じ: 人形 28px 幅(115x128 → 高さ 31px、足元から上に 80%)、本塁の板 20px 幅(77x64 → 高さ 16.6px)、捕手の帯 24px。
  const figH=28*128/115,plateHalf=20*64/77/2,band=24;
  for(const H of [190,220,274,300]){
   const feet=H*y/100+dy,top=feet-figH*.8,bottom=feet+figH*.2,plateBottom=H*HOME[1]/100+plateHalf;
   assert.ok(top>=plateBottom,`板と重ならない H=${H}`);assert.ok(bottom<=H+band,`枠の中に収まる H=${H}`);
   // 打者(41%・足元 93%・34px 幅)とは横で重ならない(枠の幅 336px〜392px)。
   for(const W of [336,392])assert.ok(W*.5-14>=W*.41+17-2,`打者と横に重ならない W=${W}`);
  }
  const ev=(kind:LiveEvent['kind'],bases:(string|null)[]):LiveEvent=>({kind,inning:3,side:0,batter:'b',slot:2,pitcher:'p',runs:0,outs:0,bases,score:[0,0],line:[[],[]],hits:[0,0],errors:[0,0]});
  // 盗塁の送球は捕手の所から、バント失敗の小フライは捕手が本塁の前まで出て捕る。
  const steal=fieldPlay(ev('SB',[null,'r',null]),['r',null,null]),ball=steal.tracks.find(t=>t.who==='ball')!;
  const a=trackAt(ball,ball.t0);assert.deepEqual([a.x,a.y,a.dy],[50,91,CATCHER_DROP]);assert.equal(trackAt(ball,1).dy,0,'二塁に着く時はずれ無し');
  const bunt=fieldPlay(ev('BUNT_FAIL',['r',null,null]),['r',null,null]),c=bunt.tracks.find(t=>t.who==='f:捕')!;
  assert.ok(c,'捕手が捕る');const c0=trackAt(c,0),c1=trackAt(c,1);assert.equal(c0.dy,CATCHER_DROP);assert.equal(c1.dy,0);assert.ok(c1.y<HOME[1],'本塁の前まで出る');
 });
}
