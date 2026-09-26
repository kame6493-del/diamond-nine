import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
for(const android of [false,true]){
 const out=resolve(`node_modules/.tmp/economy-${android}.mjs`);
 await build({stdin:{contents:"export * from './src/pro/progression';",resolveDir:process.cwd()},outfile:out,bundle:true,platform:'node',format:'esm',define:{__DIAMOND_ANDROID__:String(android)}});
 const {gameReward,seasonReward,postseasonReward}=await import(pathToFileURL(out).href);
 for(let stadium=1;stadium<=5;stadium++)for(const [homeRuns,awayRuns,bonus] of [[4,1,8],[1,1,4],[0,3,0]]){
  const s={club:'t',franchise:{stadium}};
  const expected=18+bonus+stadium-1;
  assert.equal(gameReward(s,{home:'t',away:'g',homeRuns,awayRuns}),android?Math.floor(expected*.8):expected);
  assert.equal(gameReward(s,{home:'g',away:'t',homeRuns:awayRuns,awayRuns:homeRuns}),android?Math.floor(expected*.8):expected);
  assert.equal(seasonReward(s),300);
  assert.equal(postseasonReward(s,true,true),600);
  assert.equal(postseasonReward(s,false,true),300);
  assert.equal(postseasonReward(s,false,false),150);
 }
 console.log(`${android?'Android':'Browser'} rewards: passed`);
}
// Typical 60-win domestic season: initial milestones and duplicate refunds are
// excluded. Goal rewards and completion bonuses remain unchanged.
const web=60*26+83*18+300+625+150;
const android=60*20+83*14+300+625+150;
assert.ok(android>=3000,'A normal season must still fund one scout');
assert.ok(android/web>=.8,'Total seasonal income must not fall by more than 20%');
console.log({web,android,ratio:android/web,scoutCost:3000,awakeningCosts:[600,1800,5400,16200,48600]});
