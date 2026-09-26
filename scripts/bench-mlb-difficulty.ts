import {playerMap} from '../src/pro/data';
import {effectiveOverall} from '../src/pro/engine';
import {mlbDifficultySquads,runMlbDifficultySeason} from './mlb-difficulty-fixtures';

const count=Number(process.argv[2]??8),offset=Number(process.argv[3]??0);
for(const [name,squad] of mlbDifficultySquads()){
 const results=Array.from({length:count},(_,i)=>runMlbDifficultySeason(squad,offset+i).metrics);
 const ids=[...squad.lineup,...squad.pitchers];
 console.log(JSON.stringify({name,samples:count,ovr:Math.round(ids.reduce((n,id)=>n+effectiveOverall(playerMap[id],squad.owned,squad.training),0)/ids.length),...Object.fromEntries(Object.keys(results[0]).map(k=>[k,Math.round(results.reduce((n,r)=>n+r[k as keyof typeof r],0)/count*1000)/1000]))}));
}
