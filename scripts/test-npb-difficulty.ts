import assert from 'node:assert/strict';
import {players,playerMap} from '../src/pro/data';
import {initialState,emptySeason,simulateDays,playGame,rankings,rng,defenseAdjustment,fieldingErrorRate,validState,migrateState} from '../src/pro/engine';
import {leagueFor} from '../src/pro/leagues';
import {matchupProbabilities} from '../src/pro/matchup';
import {npbDifficultySquads} from './npb-difficulty-fixtures';

export function registerNpbDifficultyTests(test:(name:string,run:()=>void)=>void){
 test('NPB starts with attainable wins, recruitment improves results, and developed regulars can win the league',()=>{
  const baseline=JSON.stringify(players.map(p=>[p.ratings,p.batting,p.pitching]));
  const summaries=npbDifficultySquads().slice(0,4).map(([name,squad])=>{
   const saved=JSON.stringify(squad);let wins=0,titles=0,playoffs=0;
   for(let i=0;i<8;i++){
    const end=simulateDays({...squad,seed:39017+i*98881},143),s=end.season;
    const row=s.standings.find(t=>t.team===squad.club)!,rank=rankings(s,leagueFor(s,squad.club)).findIndex(t=>t.team===squad.club)+1;
    wins+=row.w;titles+=Number(rank===1);playoffs+=Number(rank<=3);
    assert.ok(validState(end));assert.deepEqual(end.owned,squad.owned);assert.deepEqual(end.training,squad.training);
   }
   assert.equal(JSON.stringify(squad),saved);return {name,wins:wins/8,titles,playoffs};
  });
  const [initial,recruited,developed,regulars]=summaries;
  // The deliberately weaker opening squad must grow through recruitment;
  // established regulars retain the same league and championship difficulty.
  assert.ok(initial.wins>=30&&initial.wins<=50,JSON.stringify(summaries));assert.equal(initial.titles,0);
  assert.ok(recruited.wins>=65&&recruited.wins<=82);assert.ok(recruited.wins>initial.wins+12);assert.ok(recruited.playoffs>=3);
  assert.ok(developed.wins>recruited.wins+5);assert.ok(developed.titles>=1&&developed.wins<100);
  assert.ok(regulars.titles>=4&&regulars.wins<100);
  assert.equal(JSON.stringify(players.map(p=>[p.ratings,p.batting,p.pitching])),baseline);
 });
 test('opponents do not get stronger when the user collects or awakens cards, in either league',()=>{
  for(const circuit of ['NPB','MLB'] as const){
   const base={...initialState(),season:emptySeason(5,circuit)};
   const rich={...base,owned:Object.fromEntries(players.map(p=>[p.id,6])),training:Object.fromEntries(players.map(p=>[p.id,5])),gems:1000000};
   const [home,away]=circuit==='NPB'?['g','d']:['mlb-119','mlb-147'];
   const before=JSON.stringify(base),after=JSON.stringify(rich);
   assert.deepEqual(playGame(structuredClone(base),home,away,rng(819273)),playGame(structuredClone(rich),home,away,rng(819273)));
   assert.equal(JSON.stringify(base),before);assert.equal(JSON.stringify(rich),after);
  }
 });
 test('negative CPU ability adjustments affect defense and errors too, without changing player cards or DH defense',()=>{
  const s=initialState(),snapshot=JSON.stringify(s),base=defenseAdjustment(s.lineup,s.defense),adjusted=defenseAdjustment(s.lineup,s.defense,{}, {},-4);
  assert.ok(adjusted<base);assert.ok(fieldingErrorRate(adjusted)>fieldingErrorRate(base));
  const b=playerMap[s.lineup[0]],p=playerMap[s.pitchers[0]];
  assert.ok(matchupProbabilities(b,p,0,0,adjusted).hit>matchupProbabilities(b,p,0,0,base).hit);
  const fielders=s.lineup.filter(id=>s.defense[id]!=='DH');
  assert.equal(defenseAdjustment(fielders,s.defense,{}, {},-4),adjusted);
  for(const bonus of [-1000,1000])assert.ok(Number.isFinite(defenseAdjustment(s.lineup,s.defense,{}, {},bonus)));
  assert.equal(JSON.stringify(s),snapshot);
 });
 test('NPB tuning preserves played games and saved progression when a season resumes',()=>{
  const played=simulateDays({...initialState(),seed:51072},6),saved=JSON.stringify(played),restored=migrateState(JSON.parse(saved))!;
  assert.deepEqual(restored,played);
  const resumed=simulateDays(restored,4);
  assert.deepEqual(resumed.season.results.slice(0,6),played.season.results);
  assert.deepEqual(resumed.owned,played.owned);assert.deepEqual(resumed.training,played.training);
  assert.equal(JSON.stringify(played),saved);
  assert.deepEqual(simulateDays(simulateDays(restored,2),2),resumed);
 });
}
