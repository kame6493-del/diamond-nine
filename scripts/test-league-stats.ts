import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {emptySeason,initialState,simulateDays,type PitStats} from '../src/pro/engine';
import {leagueTeams} from '../src/pro/leagues';
import {leagueSeasonStats} from '../src/pro/league-stats';
import {LeagueSeasonStats} from '../src/pro/LeagueSeasonStats';

export function registerLeagueStatsTests(test:(name:string,run:()=>void)=>void){
 test('league scoring sums all clubs, filters by league and weights ERA by actual outs, including interleague games',()=>{
  const season=emptySeason();
  Object.assign(season.standings.find(t=>t.team==='t')!,{w:2,rf:10,ra:3});
  Object.assign(season.standings.find(t=>t.team==='g')!,{w:1,l:1,rf:4,ra:9});
  Object.assign(season.standings.find(t=>t.team==='h')!,{l:2,rf:2,ra:4});
  season.pitching=Object.fromEntries([['t',30,1],['g',24,5],['h',27,2],['unrelated',27,99]].map(([team,outs,er],i)=>[String(i),{team,outs,er} as PitStats]));
  const snapshot=JSON.stringify(season),all=leagueSeasonStats(season),central=leagueSeasonStats(season,'CENTRAL'),pacific=leagueSeasonStats(season,'PACIFIC');
  assert.equal(all.rows.length,12);assert.equal(central.rows.length,6);assert.equal(pacific.rows.length,6);
  assert.equal(central.runs,14);assert.equal(central.allowed,12);assert.equal(central.teamGames,4);assert.equal(central.runsPerTeamGame,3.5);assert.equal(central.era,3);
  assert.equal(central.rows.find(t=>t.team==='t')!.era,.9);assert.equal(central.rows.find(t=>t.team==='t')!.difference,7);
  assert.equal(central.rows.find(t=>t.team==='g')!.era,5.625);assert.equal(central.rows.find(t=>t.team==='g')!.difference,-5);
  assert.equal(pacific.runs,2);assert.equal(pacific.allowed,4);assert.equal(pacific.era,2);
  assert.equal(all.runs,16);assert.equal(all.allowed,16);assert.equal(all.runsPerTeamGame,16/6);assert.equal(all.era,8*27/81);
  assert.notEqual(central.era,(.9+5.625)/2);assert.equal(JSON.stringify(season),snapshot);
 });
 test('MLB totals contain all 30 teams with the custom club in the American League once',()=>{
  const season=emptySeason(5,'MLB','db'),all=leagueSeasonStats(season),american=leagueSeasonStats(season,'AMERICAN'),national=leagueSeasonStats(season,'NATIONAL');
  assert.equal(all.rows.length,30);assert.equal(american.rows.length,15);assert.equal(national.rows.length,15);
  assert.equal(all.rows.filter(t=>t.team==='db').length,1);assert.ok(american.rows.some(t=>t.team==='db'));assert.ok(!national.rows.some(t=>t.team==='db'));
  assert.ok(!all.rows.some(t=>t.team==='mlb-133'));assert.equal(all.runsPerTeamGame,null);assert.equal(all.era,null);assert.equal(all.runs,0);assert.equal(all.allowed,0);
  const html=renderToStaticMarkup(createElement(LeagueSeasonStats,{season,club:'db',clubName:'テスト球団'}));
  for(const label of ['MLB全体','ア・リーグ','ナ・リーグ','得点','失点','得失点差','防御率','開幕前'])assert.ok(html.includes(label));
  assert.equal((html.match(/scope="row"/g)??[]).length,30);assert.equal((html.match(/class="s-mine"/g)??[]).length,1);assert.ok(!/NaN|Infinity/.test(html));
 });
 test('simulated league totals reconcile with scores and survive archived box-score removal without including postseason data',()=>{
  const state=simulateDays({...initialState(),seed:19017},10),season=state.season,stats=leagueSeasonStats(season);
  assert.equal(stats.teamGames,120);assert.equal(stats.runs,stats.allowed);assert.equal(stats.runs,season.standings.reduce((n,t)=>n+t.rf,0));
  assert.equal(stats.runsPerTeamGame,stats.runs/120);assert.equal(stats.era,Object.values(season.pitching).reduce((n,p)=>n+p.er,0)*27/Object.values(season.pitching).reduce((n,p)=>n+p.outs,0));
  for(const team of leagueTeams(season)){const batters=Object.values(season.batting).filter(b=>b.team===team.id);assert.equal(stats.rows.find(t=>t.team===team.id)!.rf,batters.reduce((n,b)=>n+b.runs,0));}
  const archive=JSON.parse(JSON.stringify(season));archive.results=archive.results.map(({box,...g}:typeof season.results[number])=>g);
  archive.postseason={pitching:{fake:{team:'t',outs:1,er:999}},standings:[{team:'t',rf:999,ra:999}]};
  assert.deepEqual(leagueSeasonStats(archive),stats);
  const html=renderToStaticMarkup(createElement(LeagueSeasonStats,{season,club:state.club,clubName:state.name}));
  assert.equal((html.match(/scope="row"/g)??[]).length,12);assert.ok(html.includes('平均得点 / 試合'));assert.ok(html.includes(stats.era!.toFixed(2)));
 });
}
