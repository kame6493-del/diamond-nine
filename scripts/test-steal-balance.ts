import assert from 'node:assert/strict';
import {findPlayer,playerMap} from '../src/pro/data';
import {initialSandboxState,simulateDays,validState} from '../src/pro/engine';
import {stealProbabilities} from '../src/pro/matchup';

export function registerStealBalanceTests(test:(name:string,run:()=>void)=>void){
 test('steal tendencies retain runner and catcher skills with bounded growth and small-sample estimates',()=>{
  const runner=findPlayer('周東佑京');
  const ordinary=stealProbabilities(runner,0,66,60),grown=stealProbabilities(runner,5,66,60,5),strongCatcher=stealProbabilities(runner,0,90,90);
  assert.ok(grown.attempt>=ordinary.attempt);assert.ok(grown.attempt<=ordinary.attempt*1.7+1e-9);
  assert.ok(grown.success<=.92);assert.ok(strongCatcher.success<ordinary.success);
  const newcomer={...runner,batting:undefined,ratings:{...runner.ratings,speed:70}};
  const chances=stealProbabilities(newcomer,0,66,60);
  assert.ok(chances.attempt>0&&chances.attempt<.1);assert.ok(chances.success>.5&&chances.success<.9);
 });
 test('complete seasons keep ordinary and awakened stolen bases plausible and preserve accounting',()=>{
  const summaries=[];
  for(const stage of [0,5]){
   let total=0,max=0,leagueMax=0;
   for(let sample=0;sample<4;sample++){
    const base=initialSandboxState(),start={...base,seed:9017+sample*9891,training:Object.fromEntries(Object.keys(base.owned).map(id=>[id,stage]))};
    const before=JSON.stringify(start),end=simulateDays(start,143);assert.ok(validState(end));assert.equal(JSON.stringify(start),before);
    const rows=Object.values(end.season.batting),mine=rows.filter(b=>b.team===end.club);
    total+=mine.reduce((n,b)=>n+b.sb,0);max=Math.max(max,...mine.map(b=>b.sb));leagueMax=Math.max(leagueMax,...rows.map(b=>b.sb));
    assert.ok(rows.every(b=>Number.isInteger(b.sb)&&b.sb>=0&&b.sb<=b.hits+b.bb+b.hbp+143));
    assert.ok(mine.some(b=>playerMap[b.playerId].ratings.speed>=70&&b.sb>=10));
   }
   summaries.push({stage,teamAverage:total/4,max,leagueMax});
   assert.ok(total/4>=30&&total/4<=100);assert.ok(max<=70);assert.ok(leagueMax<=90);
  }
  console.log('Stolen-base balance (4 seasons per stage):',JSON.stringify(summaries));
 });
}
