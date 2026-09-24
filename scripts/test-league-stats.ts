import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {emptySeason,initialState,simulateDays,type BatStats,type PitStats} from '../src/pro/engine';
import {leagueFor,leagueTeams} from '../src/pro/leagues';
import {leagueSeasonStats,teamSeasonRanks} from '../src/pro/league-stats';
import {LeagueSeasonStats,TeamStatsDetail} from '../src/pro/LeagueSeasonStats';
import {TeamSeasonStats} from '../src/pro/TeamSeasonStats';
import {fieldingRuns,formatUZR} from '../src/pro/fielding-stats';

export function registerLeagueStatsTests(test:(name:string,run:()=>void)=>void){
 test('league scoring sums all clubs, filters by league and weights ERA by actual outs, including interleague games',()=>{
  const season=emptySeason();
  Object.assign(season.standings.find(t=>t.team==='t')!,{w:2,rf:10,ra:3});
  Object.assign(season.standings.find(t=>t.team==='g')!,{w:1,l:1,rf:4,ra:9});
  Object.assign(season.standings.find(t=>t.team==='h')!,{l:2,rf:2,ra:4});
  season.pitching=Object.fromEntries([['t',30,1],['g',24,5],['h',27,2],['unrelated',27,99]].map(([team,outs,er],i)=>[String(i),{team,outs,er,so:4,saves:1} as PitStats]));
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
  for(const label of ['海外リーグ全体','海外Aリーグ','海外Bリーグ','得点','失点','勝率','ゲーム差','防御率','開幕前'])assert.ok(html.includes(label));
  assert.equal((html.match(/scope="row"/g)??[]).length,15);assert.equal((html.match(/class="s-mine"/g)??[]).length,1);assert.ok(!/NaN|Infinity/.test(html));
  assert.ok(all.rows.every(t=>t.rank===null&&t.gamesBehind===null&&t.pct===null));
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
  assert.equal((html.match(/scope="row"/g)??[]).length,6);assert.ok(html.includes('平均得点 / 試合'));assert.ok(html.includes(leagueSeasonStats(season,leagueFor(season,state.club)).era!.toFixed(2)));
  const mine=stats.rows.find(t=>t.team===state.club)!,detail=renderToStaticMarkup(createElement(TeamStatsDetail,{team:mine,name:state.name}));
  for(const text of ['打率','本塁打','打点','盗塁','出塁率','得点','防御率','奪三振','セーブ','投球回','失点','得失点差'])assert.ok(detail.includes(text));
  const batters=Object.values(season.batting).filter(b=>b.team===state.club),pitchers=Object.values(season.pitching).filter(p=>p.team===state.club);
  assert.equal(mine.hr,batters.reduce((n,b)=>n+b.hr,0));assert.equal(mine.sb,batters.reduce((n,b)=>n+b.sb,0));assert.equal(mine.so,pitchers.reduce((n,p)=>n+p.so,0));assert.equal(mine.saves,pitchers.reduce((n,p)=>n+p.saves,0));
  assert.equal(mine.uzr,Object.values(season.fielding!.players).filter(p=>p.team===state.club).reduce((n,p)=>n+fieldingRuns(p),0));
  assert.ok(detail.includes('チームUZR'));assert.ok(detail.includes(formatUZR(mine.uzr)));assert.ok(!/NaN|Infinity|FIP|WAR/.test(detail));
 });
 test('team metric ranks use only the same league, allow ties, reverse ERA and leave unplayed rates unranked',()=>{
  const season=emptySeason();
  for(const id of ['t','g','db','h'])Object.assign(season.standings.find(t=>t.team===id)!,{w:3,l:1,d:1});
  const bat=(team:string,ab:number,hits:number,hr:number,rbi:number,sb:number,bb:number)=>({team,ab,hits,hr,rbi,sb,bb,hbp:0,sf:0} as BatStats);
  season.batting={t:bat('t',100,30,10,20,5,10),g:bat('g',200,60,10,25,7,20),db:bat('db',100,29,5,5,1,0),h:bat('h',100,90,50,100,30,0)};
  season.pitching=Object.fromEntries([['t',10],['g',20],['db',5],['h',0]].map(([team,er])=>[team,{team,er,outs:90,so:10,saves:2} as PitStats]));
  const ranks=teamSeasonRanks(season,'t');assert.equal(ranks.league,'CENTRAL');assert.deepEqual(ranks.ranks,{avg:1,hr:1,rbi:2,sb:2,obp:1,era:2});
  assert.equal(teamSeasonRanks(season,'db').ranks.hr,3);assert.equal(teamSeasonRanks(season,'db').ranks.avg,3);
  const html=renderToStaticMarkup(createElement(TeamSeasonStats,{season,club:'t'}));assert.ok(html.includes('国内Aリーグ内'));assert.equal((html.match(/team-stat-rank/g)??[]).length,6);
  assert.ok(Object.values(teamSeasonRanks(emptySeason(),'t').ranks).every(r=>r===null));
  delete season.pitching.t;assert.equal(teamSeasonRanks(season,'t').ranks.era,null);
 });
 test('games behind is measured against each league leader, handles half games and excludes draws from win percentage',()=>{
  const season=emptySeason();
  for(const [id,w,l,d,rf] of [['t',40,20,3,100],['g',39,20,0,90],['db',38,21,1,80],['c',40,20,0,90],['h',48,12,0,200]] as const)Object.assign(season.standings.find(t=>t.team===id)!,{w,l,d,rf});
  const all=leagueSeasonStats(season),row=(id:string)=>all.rows.find(t=>t.team===id)!;
  assert.equal(row('t').rank,1);assert.equal(row('t').pct,40/60);assert.equal(row('t').games,63);assert.equal(row('t').gamesBehind,0);
  assert.equal(row('g').gamesBehind,.5);assert.equal(row('db').gamesBehind,1.5);assert.equal(row('c').gamesBehind,0);assert.equal(row('h').gamesBehind,0);
  assert.deepEqual(leagueSeasonStats(season,'CENTRAL').rows,all.rows.filter(t=>t.league==='CENTRAL'));
 });
 test('MLB metric ranks compare 15 clubs in the correct league including the custom club',()=>{
  const season=emptySeason(7,'MLB','db'),members=leagueTeams(season),american=members.filter(t=>t.league==='AMERICAN');
  for(const t of season.standings){t.w=1;season.batting[t.team]={team:t.team,ab:100,hits:t.team==='db'?50:20,hr:t.team==='db'?10:20,rbi:20,sb:2,bb:0,hbp:0,sf:0} as BatStats;}
  // Better National League hitters cannot lower the custom club's American League batting rank.
  for(const t of members.filter(t=>t.league==='NATIONAL'))season.batting[t.id].hits=90;
  assert.equal(american.length,15);assert.equal(teamSeasonRanks(season,'db').ranks.avg,1);assert.equal(teamSeasonRanks(season,'db').ranks.hr,15);
 });
 test('team UZR ranks sum actual fielders, allow ties and never rank missing or mismatched recording periods',()=>{
  const state=simulateDays(initialState(9284),2),season=state.season,totals:Record<string,number>={t:5.25,g:5.25,db:-2,c:0,d:-3,s:-4,h:99};
  const assigned=new Set<string>();
  for(const row of Object.values(season.fielding!.players)){row.rangeRuns=assigned.has(row.team)?0:totals[row.team]??0;row.armRuns=0;row.errorRuns=0;assigned.add(row.team);}
  assert.equal(teamSeasonRanks(season,'t').uzrRank,1);assert.equal(teamSeasonRanks(season,'g').uzrRank,1);assert.equal(teamSeasonRanks(season,'db').uzrRank,4);
  const rows=leagueSeasonStats(season).rows,t=rows.find(t=>t.team==='t')!,db=rows.find(t=>t.team==='db')!;
  assert.equal(t.uzr,5.25);assert.equal(db.uzr,-2);
  const positive=renderToStaticMarkup(createElement(TeamStatsDetail,{team:t,name:'テスト'})),negative=renderToStaticMarkup(createElement(TeamSeasonStats,{season,club:'db'}));
  assert.ok(positive.includes('team-uzr-summary positive'));assert.ok(positive.includes('+5.3'));assert.ok(positive.includes('1位'));
  assert.ok(negative.includes('team-uzr-summary negative'));assert.ok(negative.includes('-2.0'));assert.ok(negative.includes('4位'));
  season.fielding!.games.t=1;assert.equal(teamSeasonRanks(season,'t').uzrRank,null);assert.equal(teamSeasonRanks(season,'g').uzrRank,null);
  assert.ok(renderToStaticMarkup(createElement(TeamSeasonStats,{season,club:'t'})).includes('記録開始後の1試合分'));
  delete season.fielding;assert.equal(teamSeasonRanks(season,'t').uzrRank,null);
  const legacy=renderToStaticMarkup(createElement(TeamSeasonStats,{season,club:'t'}));assert.ok(legacy.includes('未記録'));assert.ok(!legacy.includes('team-uzr-rank'));
 });
}
