import {playerMap} from '../src/pro/data';
import {simulateDays,rankings,effectiveOverall} from '../src/pro/engine';
import {leagueFor} from '../src/pro/leagues';
import {npbDifficultySquads} from './npb-difficulty-fixtures';

const count=Number(process.argv[2]??6);
for(const [name,squad] of npbDifficultySquads()){
 const results=[];
 for(let i=0;i<count;i++){
  const end=simulateDays({...squad,seed:39017+i*98881},143),s=end.season,row=s.standings.find(t=>t.team===squad.club)!;
  const bats=Object.values(s.batting).filter(b=>b.team===squad.club),arms=Object.values(s.pitching).filter(p=>p.team===squad.club);
  const rank=rankings(s,leagueFor(s,squad.club)).findIndex(t=>t.team===squad.club)+1;
  results.push({w:row.w,rank,champion:Number(rank===1),playoffs:Number(rank<=3),rf:row.rf,ra:row.ra,avg:bats.reduce((n,b)=>n+b.hits,0)/bats.reduce((n,b)=>n+b.ab,0),era:arms.reduce((n,p)=>n+p.er,0)*27/arms.reduce((n,p)=>n+p.outs,0)});
 }
 const ids=[...squad.lineup,...squad.pitchers];
 console.log(JSON.stringify({name,samples:count,ovr:Math.round(ids.reduce((n,id)=>n+effectiveOverall(playerMap[id],squad.owned,squad.training),0)/ids.length),...Object.fromEntries(Object.keys(results[0]).map(k=>[k,Math.round(results.reduce((n,r)=>n+r[k as keyof typeof r],0)/count*1000)/1000]))}));
}
