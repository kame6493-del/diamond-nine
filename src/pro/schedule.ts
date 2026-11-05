// 日程表(2026-11-05 持ち主「日程表を選択肢として入れて、ここまでスキップみたいなのを指定できるようにして」)。
// シーズンの全試合と、自分のチームが出たポストシーズンの試合の一覧。まだの試合を1つ選ぶと、その試合の前まで止まらずに進める(managed.ts の pin)。
// 表示だけの計算で、セーブデータは変えない。
import {scheduleFor,type GameState} from './engine';
import {seasonGames,circuitOf} from './leagues';
import {seriesName} from './watch';
import {ownPosition,pinReachable} from './managed';

export interface ScheduleRow {
 pos:string;            // managed.ts の ownPosition と同じ印(r12 / CENTRAL-first#1)
 section:'regular'|'post';
 group:string;          // 見出し(レギュラーシーズン / ポストシーズン ファイナル など)
 label:string;          // 第12戦 / ポストシーズン 1st 第2戦
 opponent:string;home:boolean;
 result:{ours:number;theirs:number;mark:'W'|'L'|'D'}|null;
 now:boolean;           // 次の試合(いまの位置)
 pickable:boolean;      // 「この試合の前まで進める」を選べる
}

export function scheduleRows(state:GameState):ScheduleRow[]{
 const season=state.season,club=state.club,total=seasonGames(season),fixtures=scheduleFor(state),here=ownPosition(state);
 const mine=season.results.filter(g=>g.home===club||g.away===club);
 const res=(home:boolean,hr:number,ar:number)=>{const ours=home?hr:ar,theirs=home?ar:hr;return {ours,theirs,mark:(ours>theirs?'W':ours<theirs?'L':'D') as 'W'|'L'|'D'};};
 const rows:ScheduleRow[]=[];
 for(let d=0;d<total;d++){
  const g=mine[d],pair=fixtures[d]?.find(p=>p.includes(club));
  const home=g?g.home===club:pair?pair[0]===club:true,opponent=g?(home?g.away:g.home):pair?(pair[0]===club?pair[1]:pair[0]):'';
  const pos=`r${d}`;
  rows.push({pos,section:'regular',group:'レギュラーシーズン',label:`第${d+1}戦`,opponent,home,result:g?res(home,g.homeRuns,g.awayRuns):null,now:pos===here,pickable:!g&&pinReachable(state,pos)});
 }
 const post=season.postseason,space=circuitOf(season)==='SPACE';
 for(const s of post?.series??[]){
  if(s.higher!==club&&s.lower!==club)continue;
  const name=seriesName(s,space);
  // 先のまだの試合: 決着していないシリーズは、最大の試合数(引き分けで延びる日本一決定戦は7)まで並べる。
  const upTo=s.winner?s.results.length:Math.max(s.results.length+1,s.maxGames??Math.max(7,s.target*2-1));
  for(let i=0;i<upTo;i++){
   const g=s.results[i],homeHigher=s.stage!=='japan'||[0,1,5,6].includes(i)||(i>=7&&i%2===0);
   const homeTeam=g?g.home:homeHigher?s.higher:s.lower,home=homeTeam===club,opponent=s.higher===club?s.lower:s.higher;
   const pos=`${s.id}#${i}`;
   rows.push({pos,section:'post',group:name,label:`第${i+1}戦`,opponent,home,result:g?res(g.home===club,g.homeRuns,g.awayRuns):null,now:pos===here,pickable:!g&&pinReachable(state,pos)});
  }
 }
 return rows;
}
