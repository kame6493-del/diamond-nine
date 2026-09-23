import assert from 'node:assert/strict';
import {findPlayer,players,type Player} from '../src/pro/data';
import {simulateDays,validState,migrateState,switchLeague} from '../src/pro/engine';
import {matchupProbabilities} from '../src/pro/matchup';
import {collectSimpleRewards} from '../src/pro/simple-game';
import {mlbDifficultySquads,mlbDifficultyStart,runMlbDifficultySeason} from './mlb-difficulty-fixtures';

export function registerMlbDifficultyTests(test:(name:string,run:()=>void)=>void){
 test('MLB remains tougher than NPB, while recruitment and deep development make the World Series attainable',()=>{
  const squads=mlbDifficultySquads(),snapshots=squads.map(([,s])=>JSON.stringify(s));
  const summaries=[0,2,4].map(index=>{
   const squad=squads[index][1],results=Array.from({length:8},(_,i)=>{
    const {end,metrics}=runMlbDifficultySeason(squad,i);
    assert.ok(validState(end));assert.equal(end.season.day,162);assert.equal(end.season.results.length,162);
    assert.deepEqual(end.owned,squad.owned);assert.deepEqual(end.training,squad.training);
    return metrics;
   });
   return {wins:results.reduce((n,r)=>n+r.wins,0)/8,titles:results.reduce((n,r)=>n+r.champion,0),finals:results.reduce((n,r)=>n+r.finals,0),playoffs:results.reduce((n,r)=>n+r.playoffs,0)};
  });
  const [promoted,stars,developed]=summaries;
  assert.ok(promoted.wins>=55&&promoted.wins<=78,JSON.stringify(summaries));assert.equal(promoted.titles,0);
  assert.ok(stars.wins>=85&&stars.wins<=115);assert.ok(stars.wins>promoted.wins+22);assert.ok(stars.playoffs>=4);
  assert.ok(developed.wins>stars.wins+5&&developed.wins<132);assert.ok(developed.finals>=2);assert.ok(developed.titles>=1&&developed.titles<8);
  const domestic=simulateDays({...squads[0][1],seed:39017},143).season.standings.find(r=>r.team===squads[0][1].club)!;
  assert.ok(promoted.wins/162<domestic.w/143-.10);
  assert.deepEqual(squads.map(([,s])=>JSON.stringify(s)),snapshots);
 });
 test('MLB translation keeps a modest batting/pitching penalty and never double-penalizes MLB cards',()=>{
  const bat=findPlayer('森下翔太'),pitch=findPlayer('才木浩人'),tag=players.find(p=>p.mlb)!.mlb;
  const taggedBat={...bat,mlb:tag},taggedPitch={...pitch,mlb:tag};
  const calc=(b:Player,p:Player,bs=0,ps=0)=>matchupProbabilities(b,p,0,0,0,{},bs,ps,'MLB');
  const baseline=calc(taggedBat,taggedPitch),batting=calc(bat,taggedPitch),pitching=calc(taggedBat,pitch);
  assert.ok(batting.strikeout>baseline.strikeout&&batting.strikeout<baseline.strikeout*1.10);
  assert.ok(batting.homeRun<baseline.homeRun&&batting.homeRun>baseline.homeRun*.90);
  assert.ok(batting.walk<baseline.walk&&batting.walk>baseline.walk*.96);
  assert.ok(batting.babip<baseline.babip&&baseline.babip-batting.babip<.006);
  assert.ok(pitching.strikeout<baseline.strikeout&&pitching.strikeout>baseline.strikeout*.94);
  assert.ok(pitching.homeRun>baseline.homeRun&&pitching.homeRun<baseline.homeRun*1.10);
  assert.ok(pitching.walk>baseline.walk&&pitching.walk<baseline.walk*1.06);
  assert.ok(pitching.babip>baseline.babip&&pitching.babip-baseline.babip<.004);
  assert.ok(calc(bat,taggedPitch,5).homeRun>batting.homeRun);assert.ok(calc(taggedBat,pitch,0,5).walk<pitching.walk);
  assert.deepEqual(matchupProbabilities(bat,pitch),matchupProbabilities(taggedBat,taggedPitch));
 });
 test('an ongoing MLB season keeps played results, balances and cards through reload and an NPB round trip',()=>{
  const end=collectSimpleRewards(simulateDays(mlbDifficultyStart(mlbDifficultySquads()[0][1],9),6)),saved=JSON.stringify(end);
  const restored=migrateState(JSON.parse(saved))!;assert.deepEqual(restored,end);
  const domestic=switchLeague(restored,'NPB'),returned=switchLeague(domestic,'MLB');
  assert.deepEqual(returned.season,end.season);assert.deepEqual(returned.owned,end.owned);assert.deepEqual(returned.training,end.training);assert.equal(returned.gems,end.gems);
  const resumed=simulateDays(returned,4);assert.deepEqual(resumed.season.results.slice(0,6),end.season.results);assert.equal(resumed.season.day,10);
  assert.equal(JSON.stringify(end),saved);
 });
}
