import {players} from '../src/pro/data';
import {initialState,emptySeason,simulateDays,ops,era} from '../src/pro/engine';
import {buildByStrategy} from '../src/pro/franchise';
const cases=[['NPB主力・未覚醒',false,0],['NPB主力・覚醒2',false,2],['混成・覚醒2',true,2],['混成・覚醒5',true,5]] as const;
const rows=[];
for(const [name,major,stage] of cases){
 const base=initialState(),pool=players.filter(p=>major||!p.mlb),squad=buildByStrategy({...base,owned:Object.fromEntries(pool.map(p=>[p.id,1])),training:Object.fromEntries(pool.map(p=>[p.id,stage]))},'balanced');
 for(const circuit of ['NPB','MLB'] as const){
  const results=[];
  for(let i=0;i<Number(process.argv[2]??3);i++){
   const end=simulateDays({...squad,seed:39017+i*98881,season:emptySeason(6,circuit,base.club),leagueProgress:{basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:5}},circuit==='MLB'?162:143);
   const s=end.season,row=s.standings.find(t=>t.team===base.club)!,bats=Object.values(s.batting).filter(b=>b.team===base.club),pits=Object.values(s.pitching).filter(p=>p.team===base.club);
   const b=Object.assign({},bats[0]),p=Object.assign({},pits[0]);
   for(const key of ['ab','hits','doubles','triples','hr','bb','hbp','sf','pa'] as const)b[key]=bats.reduce((n,x)=>n+x[key],0);
   p.outs=pits.reduce((n,x)=>n+x.outs,0);p.er=pits.reduce((n,x)=>n+x.er,0);
   results.push({wins:row.w,winPct:row.w/(row.w+row.l),avg:b.hits/b.ab,hr:b.hr,ops:ops(b),era:era(p),rf:row.rf,ra:row.ra});
  }
  rows.push({name,circuit,...Object.fromEntries(Object.keys(results[0]).map(k=>[k,Math.round(results.reduce((n,r)=>n+r[k as keyof typeof r],0)/results.length*1000)/1000]))});
 }
}
console.log(JSON.stringify(rows,null,2));
