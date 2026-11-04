// 作戦の効き方のシミュレーション(2026-11-04 vc43)。npm test には入れない。
// node scripts/balance-tactics.mjs [試合数] > mobile/balance-1104/vc43/tactics.txt
// 同じ試合(開幕戦)を乱数の位置だけ変えて N 試合ずつ回し、作戦ごとの勝率・得点・失点・打席の結果の割合を、作戦なしと比べる。
import {initialSandboxState,initialState,emptySeason,type GameState,type LiveEvent,type WatchOrder} from '../src/pro/engine';
import {managedGame,liveGame,type ManagedGame} from '../src/pro/managed';
import type {Circuit} from '../src/pro/leagues';
const N=Number(process.argv[2]??400);
const sandbox=(c:Circuit)=>{const s=initialSandboxState();if(c!=='NPB'){s.season=emptySeason(1,c,s.club);s.leagueProgress={basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:0};}return s;};
const weak=()=>{const s=initialState(5);return s;};
function game(g:ManagedGame,order:WatchOrder|null){
 const gen=liveGame(g),ev:LiveEvent[]=[];let step=gen.next(),sent=false;
 while(!step.done){let x:WatchOrder|null=null;if(step.value.type==='event')ev.push(step.value.e);else if(!sent){sent=true;x=order;}step=gen.next(x);}
 return {r:step.value,ev};
}
const configs:[string,WatchOrder|null][]=[['作戦なし',null],['長打狙い',{kind:'tactic',scope:'team',tactic:'power'}],['ミート打ち',{kind:'tactic',scope:'team',tactic:'contact'}],['積極的に',{kind:'tactic',scope:'team',tactic:'aggressive'}],['慎重に',{kind:'tactic',scope:'team',tactic:'patient'}],
 ['直球中心',{kind:'tactic',scope:'pitch',tactic:'fastball'}],['変化球中心',{kind:'tactic',scope:'pitch',tactic:'breaking'}],['ボール球中心',{kind:'tactic',scope:'pitch',tactic:'ball'}],['ストライク中心',{kind:'tactic',scope:'pitch',tactic:'strike'}]];
const pct=(a:number,b:number)=>(100*a/Math.max(1,b)).toFixed(1);
for(const [name,state] of [['国内(強いチーム)',sandbox('NPB')],['国内(始めたばかり)',weak()],['海外',sandbox('MLB')],['宇宙',sandbox('SPACE')]] as [string,GameState][]){
 const g0=managedGame(state)!;
 console.log(`\n## ${name} 開幕戦 ${N}試合ずつ(乱数の位置だけ変える)`);
 console.log('作戦 | 勝率 | 得点/試合 | 失点/試合 | 自分の打席 四球% 三振% 本塁打% 長打% 単打% | 相手の打席 四球% 三振% 本塁打% 長打% 単打%');
 let base=0;
 for(const [label,order] of configs){
  let w=0,l=0,rf=0,ra=0;const c=[[0,0,0,0,0,0],[0,0,0,0,0,0]];
  for(let i=0;i<N;i++){
   const g={...g0,rng:(g0.rng+i*7919)>>>0},{r,ev}=game(g,order);
   const mine=g.control===0?[r.awayRuns,r.homeRuns]:[r.homeRuns,r.awayRuns];rf+=mine[0];ra+=mine[1];if(mine[0]>mine[1])w++;else if(mine[0]<mine[1])l++;
   for(const e of ev){if(!['BB','HBP','K','OUT','SF','E','1B','2B','3B','HR'].includes(e.kind))continue;const x=c[e.side===g.control?0:1];x[0]++;
    if(e.kind==='BB')x[1]++;else if(e.kind==='K')x[2]++;else if(e.kind==='HR')x[3]++;else if(e.kind==='2B'||e.kind==='3B')x[4]++;else if(e.kind==='1B')x[5]++;}
  }
  const wp=w/Math.max(1,w+l);if(!order)base=wp;
  const row=(x:number[])=>[1,2,3,4,5].map(i=>pct(x[i],x[0])).join(' ');
  console.log(`${label} | ${(wp*100).toFixed(1)}%${order?` (${wp-base>=0?'+':''}${((wp-base)*100).toFixed(1)})`:''} | ${(rf/N).toFixed(2)} | ${(ra/N).toFixed(2)} | ${row(c[0])} | ${row(c[1])}`);
 }
}
