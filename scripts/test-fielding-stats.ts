import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,initialSandboxState,emptySeason,simulateDays,nextSeason,migrateState,validState,switchLeague} from '../src/pro/engine';
import {finishPostseason} from '../src/pro/postseason';
import {fieldingRuns,formatUZR,playerSeasonUZR,teamFieldingStats} from '../src/pro/fielding-stats';
import {teamSeasonStats} from '../src/pro/team-stats';
import {TeamSeasonStats} from '../src/pro/TeamSeasonStats';
import {SimpleStats} from '../src/pro/SimpleApp';
import {trainPlayer} from '../src/pro/franchise';

export function registerFieldingStatsTests(test:(name:string,run:()=>void)=>void){
 test('UZR records the actual fielding roster and in-play exposure, sums individual contributions and excludes DH',()=>{
  const state=simulateDays(initialState(34856),7),f=state.season.fielding!,rows=Object.values(f.players).filter(p=>p.team===state.club);
  assert.equal(rows.length,8);assert.equal(f.games[state.club],7);assert.ok(rows.every(p=>p.games===7&&p.ballsInPlay>0));
  const dh=state.lineup.find(id=>state.defense[id]==='DH')!;assert.equal(playerSeasonUZR(state.season,state.club,dh),null);
  const team=teamSeasonStats(state.season,state.club);assert.equal(team.uzr,rows.reduce((sum,p)=>sum+fieldingRuns(p),0));
  assert.ok(rows.some(p=>fieldingRuns(p)<0));assert.ok(validState(state));
  // Every in-play ball is one exposure for each of the eight defenders.
  const oppositionBip=state.season.results.flatMap(g=>g.box!.batting).filter(b=>b.team!==state.club).reduce((n,b)=>n+b.ab-b.so-b.hr,0);
  assert.ok(rows.every(p=>p.ballsInPlay===oppositionBip));
  const html=renderToStaticMarkup(createElement(SimpleStats,{season:state.season,club:state.club,onPlayer:()=>{},lineup:state.lineup,pitchers:state.pitchers}));
  for(const row of rows)assert.ok(html.includes(formatUZR(fieldingRuns(row))));
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
 test('legacy UZR is not invented and mixed seasons explicitly identify their recorded game count',()=>{
  const old=simulateDays(initialState(7125),3);delete old.season.fielding;
  const loaded=migrateState(JSON.parse(JSON.stringify(old)))!;assert.ok(loaded);assert.equal(teamFieldingStats(loaded.season,loaded.club).uzr,null);
  assert.ok(renderToStaticMarkup(createElement(TeamSeasonStats,{season:loaded.season,club:loaded.club})).includes('更新後の試合から'));
  const partial=simulateDays(loaded,2),summary=teamSeasonStats(partial.season,partial.club);
  assert.equal(summary.games,5);assert.equal(summary.uzrGames,2);assert.ok(summary.uzr!==null);
  assert.ok(renderToStaticMarkup(createElement(TeamSeasonStats,{season:partial.season,club:partial.club})).includes('記録開始後の2試合分'));
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
