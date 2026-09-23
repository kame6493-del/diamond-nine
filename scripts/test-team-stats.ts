import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,emptySeason,simulateDays,playGame,nextSeason,migrateState,defenseAdjustment,fieldingErrorRate,type BatStats,type PitStats} from '../src/pro/engine';
import {finishPostseason} from '../src/pro/postseason';
import {teamSeasonStats} from '../src/pro/team-stats';
import {TeamSeasonStats} from '../src/pro/TeamSeasonStats';

export function registerTeamStatsTests(test:(name:string,run:()=>void)=>void){
 test('team averages use summed opportunities, include former starters, and exclude opponents and postseason stats',()=>{
  const s=initialState(),season=emptySeason();
  const bat=(id:string,team:string,ab:number,hits:number,rbi:number)=>({playerId:id,team,ab,hits,rbi} as BatStats);
  const pit=(id:string,team:string,outs:number,er:number)=>({playerId:id,team,outs,er} as PitStats);
  season.batting={a:bat(s.lineup[0],s.club,10,5,3),b:bat(s.lineup[1],s.club,90,15,7),opponent:bat(s.lineup[0],'g',100,99,99)};
  season.pitching={a:pit(s.pitchers[0],s.club,3,1),b:pit(s.pitchers[1],s.club,24,2),opponent:pit(s.pitchers[0],'g',27,99)};
  const stats=teamSeasonStats(season,s.club);assert.equal(stats.avg,.200);assert.equal(stats.rbi,10);assert.equal(stats.era,3);
  assert.notEqual(stats.avg,(.5+15/90)/2);assert.notEqual(stats.era,(9+2.25)/2);
  const html=renderToStaticMarkup(createElement(TeamSeasonStats,{season,club:s.club}));
  for(const text of ['チーム全体成績','打率','打点','失策','防御率','.200','3.00'])assert.ok(html.includes(text));assert.equal((html.match(/<dt>/g)??[]).length,4);
  const empty=teamSeasonStats(emptySeason(),s.club);assert.equal(empty.avg,null);assert.equal(empty.era,null);assert.equal(empty.rbi,0);assert.equal(empty.errors,0);
 });
 test('errors use the defensive side and count an at-bat without a hit, RBI or earned run on a direct error score',()=>{
  const state=initialState();
  // Three walks load the bases, then a misplay scores one run; all other plays are outs.
  const rolls=[.5,.5,0,.99,0,0,.999999];let i=0;
  const game=playGame(state,'t','g',{next:()=>rolls[i++]??.85,state:1});
  assert.deepEqual(game.errors,[0,1]);assert.equal(game.awayRuns,1);assert.equal(game.homeRuns,0);
  const bat=game.box!.batting.filter(b=>b.team==='g'),pit=game.box!.pitching.filter(p=>p.team==='t');
  assert.equal(bat.reduce((n,b)=>n+b.hits,0),0);assert.equal(bat.reduce((n,b)=>n+b.rbi,0),0);
  assert.equal(bat.reduce((n,b)=>n+b.runs,0),1);assert.equal(pit.reduce((n,p)=>n+p.er,0),0);
  assert.equal(bat.reduce((n,b)=>n+b.ab,0),28);assert.equal(bat.reduce((n,b)=>n+b.pa,0),31);
  assert.ok(game.box!.highlights.some(h=>h.play==='失策で得点'));
  state.season.results.push(game);assert.equal(teamSeasonStats(state.season,'t').errors,1);assert.equal(teamSeasonStats(state.season,'g').errors,0);
 });
 test('runs after an error should have ended the inning are unearned, while a later walk still gets an RBI',()=>{
  const state=initialState(),rolls=[.5,.5,.85,.85,.999999,.99,0,0,0,0];let i=0;
  const game=playGame(state,'t','g',{next:()=>rolls[i++]??.85,state:1});
  assert.deepEqual(game.errors,[0,1]);assert.equal(game.awayRuns,2);
  assert.equal(game.box!.pitching.filter(p=>p.team==='t').reduce((n,p)=>n+p.er,0),0);
  assert.equal(game.box!.batting.filter(b=>b.team==='g').reduce((n,b)=>n+b.rbi,0),2);
  const defense=defenseAdjustment(state.lineup,state.defense,state.owned),trained=defenseAdjustment(state.lineup,state.defense,state.owned,Object.fromEntries(state.lineup.map(id=>[id,5])));
  assert.ok(trained>defense);assert.ok(fieldingErrorRate(trained)<fieldingErrorRate(defense));
 });
 test('new errors are retained in archived and reloaded seasons, with no playoff contamination or legacy fabrication',()=>{
  const initial={...initialState(),seed:19017},start=simulateDays(initial,7),legacy=structuredClone(start);
  legacy.season.results.forEach(g=>delete g.errors);assert.ok(migrateState(legacy));
  assert.equal(teamSeasonStats(legacy.season,legacy.club).errors,null);
  const partial=simulateDays(legacy,2),partialStats=teamSeasonStats(partial.season,partial.club);
  assert.equal(partialStats.errorGames,2);assert.equal(partialStats.games,9);
  assert.ok(renderToStaticMarkup(createElement(TeamSeasonStats,{season:partial.season,club:partial.club})).includes('記録開始後の2試合分'));
  const regular=simulateDays(start,143),before=teamSeasonStats(regular.season,regular.club),done=finishPostseason(regular);
  assert.equal(before.errorGames,143);assert.ok(before.errors!>0);assert.deepEqual(teamSeasonStats(done.season,done.club),before);
  // Advancing with a prior archive exercises compacted game records without box scores.
  const next=nextSeason({...done,season:{...done.season,number:2},history:[done.season]}),saved=migrateState(JSON.parse(JSON.stringify(next)))!;
  assert.ok(saved);assert.ok(!saved.history[1].results[0].box);assert.deepEqual(teamSeasonStats(saved.history[1],saved.club),before);
  assert.equal(teamSeasonStats(saved.season,saved.club).errors,0);
  for(const errors of [[-1,0],[0],[0,1.5],[0,NaN]]){const bad=structuredClone(done);bad.season.results[0].errors=errors as [number,number];assert.equal(migrateState(bad),null);}
 });
}
