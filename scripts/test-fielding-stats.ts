import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,initialSandboxState,emptySeason,simulateDays,nextSeason,migrateState,validState,switchLeague} from '../src/pro/engine';
import {finishPostseason} from '../src/pro/postseason';
import {fieldingRuns,formatUZR,playerSeasonUZR,teamFieldingStats} from '../src/pro/fielding-stats';
import {teamSeasonStats} from '../src/pro/team-stats';
import {SimpleStats} from '../src/pro/SimpleApp';
import {trainPlayer} from '../src/pro/franchise';
import {leagueTeams} from '../src/pro/leagues';

export function registerFieldingStatsTests(test:(name:string,run:()=>void)=>void){
 test('extreme defensive deficits soften without caps, lost ledger data or lost league centering',()=>{
  const season=simulateDays(initialState(812),2).season,rows=Object.values(season.fielding!.players);
  for(const row of rows){row.ballsInPlay=4000;row.rangeRuns=0;row.errorRuns=0;row.armRuns=0;}
  const row=rows[0];row.rangeRuns=-80;const before=JSON.stringify(season);
  const value=playerSeasonUZR(season,row.team,row.playerId)!;
  assert.ok(value<0&&value>-40);assert.equal(JSON.stringify(season),before);
  const double=structuredClone(season);for(const p of Object.values(double.fielding!.players)){p.ballsInPlay*=2;p.rangeRuns*=2;}
  assert.ok(Math.abs(playerSeasonUZR(double,row.team,row.playerId)!-value*2)<1e-9);
  row.rangeRuns=-120;assert.ok(playerSeasonUZR(season,row.team,row.playerId)!<value);
  for(const league of new Set(leagueTeams(season).map(t=>t.league))){
   const total=leagueTeams(season).filter(t=>t.league===league).reduce((n,t)=>n+teamFieldingStats(season,t.id).uzr!,0);assert.ok(Math.abs(total)<1e-8);
  }
 });
 test('UZR is zero-centered separately in every domestic and overseas league and preserves saved events',()=>{
  const start=initialState(4617),unlocked={...start,leagueProgress:{npbStreak:3,mlbUnlocked:true,lastSettledSeason:0,basis:'league' as const}};
  for(const base of [start,switchLeague(unlocked,'MLB')]){
   const state=simulateDays(base,5),season=state.season,before=JSON.stringify(season),teams=leagueTeams(season);
   for(const league of new Set(teams.map(t=>t.league))){
    const peers=teams.filter(t=>t.league===league),totals=peers.map(t=>teamFieldingStats(season,t.id).uzr!);
    assert.ok(Math.abs(totals.reduce((a,b)=>a+b,0))<1e-8);
    assert.ok(totals.some(n=>n>0)&&totals.some(n=>n<0));
    for(const team of peers){
     const rows=Object.values(season.fielding!.players).filter(p=>p.team===team.id);
     assert.equal(teamFieldingStats(season,team.id).uzr,rows.reduce((n,p)=>n+playerSeasonUZR(season,team.id,p.playerId)!,0));
    }
   }
   assert.equal(JSON.stringify(season),before);
   assert.equal(teamFieldingStats(JSON.parse(before),state.club).uzr,teamFieldingStats(season,state.club).uzr);
  }
 });
 test('UZR centers uniformly negative ledgers by defensive exposure, not equal shares per player',()=>{
  const state=simulateDays(initialState(113),2),season=state.season;
  for(const row of Object.values(season.fielding!.players)){
   row.ballsInPlay=row.games*100;row.rangeRuns=-row.ballsInPlay*.02;row.errorRuns=0;row.armRuns=0;
  }
  // Half the exposure must get half the correction, including legacy partial records.
  const first=Object.values(season.fielding!.players)[0];first.ballsInPlay/=2;first.rangeRuns/=2;
  for(const row of Object.values(season.fielding!.players))assert.ok(Math.abs(playerSeasonUZR(season,row.team,row.playerId)!)<1e-9);
  first.rangeRuns+=5;
  assert.ok(playerSeasonUZR(season,first.team,first.playerId)!>0);
 });
 test('UZR records the actual fielding roster and in-play exposure, sums individual contributions and excludes DH',()=>{
  const state=simulateDays(initialState(34856),7),f=state.season.fielding!,rows=Object.values(f.players).filter(p=>p.team===state.club);
  assert.equal(rows.length,8);assert.equal(f.games[state.club],7);assert.ok(rows.every(p=>p.games===7&&p.ballsInPlay>0));
  const dh=state.lineup.find(id=>state.defense[id]==='DH')!;assert.equal(playerSeasonUZR(state.season,state.club,dh),null);
  const team=teamSeasonStats(state.season,state.club);assert.equal(team.uzr,rows.reduce((sum,p)=>sum+playerSeasonUZR(state.season,state.club,p.playerId)!,0));
  assert.ok(rows.some(p=>fieldingRuns(p)<0));assert.ok(validState(state));
  // Every in-play ball is one exposure for each of the eight defenders.
  const oppositionBip=state.season.results.flatMap(g=>g.box!.batting).filter(b=>b.team!==state.club).reduce((n,b)=>n+b.ab+b.sf-b.so-b.hr,0);
  assert.ok(rows.every(p=>p.ballsInPlay===oppositionBip));
  const html=renderToStaticMarkup(createElement(SimpleStats,{season:state.season,club:state.club,onPlayer:()=>{},lineup:state.lineup,pitchers:state.pitchers}));
  for(const row of rows)assert.ok(html.includes(formatUZR(playerSeasonUZR(state.season,state.club,row.playerId))));
 });
 test('UZR reacts to position penalties and awakening without rewriting already played defense',()=>{
  const base={...initialSandboxState(),seed:87642},catcher=base.lineup.find(id=>base.defense[id]==='捕')!,outfielder=base.lineup.find(id=>base.defense[id]==='外')!;
  const normal=simulateDays(base,14),misplaced=simulateDays({...base,defense:{...base.defense,[catcher]:'外',[outfielder]:'捕'}},14);
  const rate=(s:typeof base,id:string)=>{const r=s.season.fielding!.players[`${s.club}|${id}`];return r.rangeRuns/r.ballsInPlay;};
  assert.ok(rate(misplaced,outfielder)<rate(normal,outfielder));
  const id=normal.lineup.find(id=>normal.defense[id]!=='DH')!,trained=trainPlayer({...normal,gems:600},id);
  assert.deepEqual(trained.season.fielding,normal.season.fielding);
  const continued=simulateDays(trained,1),untrained=simulateDays(normal,1);
  const previous=normal.season.fielding!.players[`${normal.club}|${id}`];
  const deltaRate=(s:typeof base)=>{const row=s.season.fielding!.players[`${s.club}|${id}`];return (row.rangeRuns-previous.rangeRuns)/(row.ballsInPlay-previous.ballsInPlay);};
  assert.ok(deltaRate(continued)>=deltaRate(untrained));
  const nextDH={...normal,defense:{...normal.defense}},oldDH=normal.lineup.find(p=>normal.defense[p]==='DH')!;
  [nextDH.defense[id],nextDH.defense[oldDH]]=[nextDH.defense[oldDH],nextDH.defense[id]];
  const switched=simulateDays(nextDH,1);assert.deepEqual(switched.season.fielding!.players[`${normal.club}|${id}`],previous);
 });
 test('legacy UZR is not invented and mixed seasons retain their recorded game count',()=>{
  const old=simulateDays(initialState(7125),3);delete old.season.fielding;
  const loaded=migrateState(JSON.parse(JSON.stringify(old)))!;assert.ok(loaded);assert.equal(teamFieldingStats(loaded.season,loaded.club).uzr,null);
  const partial=simulateDays(loaded,2),summary=teamSeasonStats(partial.season,partial.club);
  assert.equal(summary.games,5);assert.equal(summary.uzrGames,2);assert.ok(summary.uzr!==null);
  assert.equal(teamFieldingStats(emptySeason(),loaded.club).uzr,0);
 });
 test('UZR survives saves and archived box-score compaction with no postseason contamination',()=>{
  const regular=simulateDays(initialState(8359),143),before=structuredClone(regular.season.fielding),done=finishPostseason(regular);
  assert.deepEqual(done.season.fielding,before);
  const next=nextSeason({...done,season:{...done.season,number:2},history:[done.season]}),saved=migrateState(JSON.parse(JSON.stringify(next)))!;
  assert.ok(saved);assert.deepEqual(saved.history[1].fielding,before);assert.ok(!saved.history[1].results[0].box);
  assert.deepEqual(saved.season.fielding,emptySeason().fielding);
 });
 test('UZR supports MLB and survives parking and resuming a league',()=>{
  const start=initialState(4617),unlocked={...start,leagueProgress:{npbStreak:3,mlbUnlocked:true,lastSettledSeason:0,basis:'league' as const}};
  const major=simulateDays(switchLeague(unlocked,'MLB'),2),before=structuredClone(major.season.fielding);
  assert.equal(Object.keys(before!.games).length,30);assert.ok(validState(major));
  assert.deepEqual(switchLeague(switchLeague(major,'NPB'),'MLB').season.fielding,before);
 });
 test('UZR saves reject malformed ledgers while allowing signed fractional run values',()=>{
  const state=simulateDays(initialState(4285),1);assert.ok(migrateState(state));
  for(const mutate of [
   (s:typeof state)=>{s.season.fielding!.version=2 as 1;},
   (s:typeof state)=>{s.season.fielding!.games[s.club]=-1;},
   (s:typeof state)=>{Object.values(s.season.fielding!.players)[0].rangeRuns=NaN;},
   (s:typeof state)=>{Object.values(s.season.fielding!.players)[0].ballsInPlay=-1;},
   (s:typeof state)=>{Object.values(s.season.fielding!.players)[0].team='invalid';},
  ]){const bad=structuredClone(state);mutate(bad);assert.equal(migrateState(bad),null);}
  assert.equal(formatUZR(-.001),'0.0');assert.equal(formatUZR(3.25),'+3.3');assert.equal(formatUZR(-5.14),'-5.1');assert.equal(formatUZR(null),'—');
 });
}
