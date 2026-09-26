import { initialState,simulateDays,drawPlayers,effectiveOverall } from '../src/pro/engine';
import { players,playerMap } from '../src/pro/data';
import { buildByStrategy } from '../src/pro/franchise';
import { signContract,nextContract,contractPool } from '../src/pro/ambitions';
const summaries=[];
for(const count of [0,20,50]){
 let s=initialState();s.gems=count*300;s.seed=12345;
 for(let i=0;i<count;i++){s=drawPlayers(s,1);if(nextContract(s)){const best=contractPool(s).sort((a,b)=>b.overall-a.overall)[0];s=signContract(s,best.id);}}
 s=buildByStrategy(s,'balanced');
 const wins:number[]=[],runs:number[]=[],homers:number[]=[];let bytes=0;
 for(const seed of [99,2345,9876,2026,618]){const end=simulateDays({...s,seed},143),team=end.season.standings.find(t=>t.team===s.club)!;wins.push(team.w);runs.push(team.rf);homers.push(Object.values(end.season.batting).filter(b=>b.team===s.club).reduce((n,b)=>n+b.hr,0));bytes=JSON.stringify(end).length;}
 summaries.push({draws:count,ovr:Math.round([...s.lineup,...s.pitchers].reduce((n,id)=>n+effectiveOverall(playerMap[id],s.owned,s.training),0)/21),wins,runsPerGame:runs.map(n=>(n/143).toFixed(2)),homers,saveBytes:bytes});
}
console.log(JSON.stringify({players:players.length,summaries},null,2));
