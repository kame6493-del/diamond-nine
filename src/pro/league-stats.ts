import type {Season} from './engine';
import {leagueTeams,standingOrder} from './leagues';

export type LeagueStatsScope='ALL'|'CENTRAL'|'PACIFIC'|'AMERICAN'|'NATIONAL';
export const leagueStatsNames:Record<Exclude<LeagueStatsScope,'ALL'>,string>={CENTRAL:'セ・リーグ',PACIFIC:'パ・リーグ',AMERICAN:'ア・リーグ',NATIONAL:'ナ・リーグ'};

// Use all clubs' regular-season records, not the custom club's game log.
export function leagueSeasonStats(season:Season,scope:LeagueStatsScope='ALL'){
 const members=leagueTeams(season).filter(t=>scope==='ALL'||t.league===scope);
 const leagues=new Map(members.map(t=>[t.id,t.league]));
 const pitching=new Map<string,{outs:number;er:number}>();
 for(const p of Object.values(season.pitching)){
  if(!leagues.has(p.team))continue;
  const total=pitching.get(p.team)??{outs:0,er:0};total.outs+=p.outs;total.er+=p.er;pitching.set(p.team,total);
 }
 const rows=season.standings.filter(t=>leagues.has(t.team)).sort(standingOrder).map(t=>{
  const p=pitching.get(t.team)??{outs:0,er:0};
  return {...t,league:leagues.get(t.team)!,games:t.w+t.l+t.d,difference:t.rf-t.ra,outs:p.outs,earnedRuns:p.er,era:p.outs?p.er*27/p.outs:null};
 });
 const totals=rows.reduce((sum,t)=>({runs:sum.runs+t.rf,allowed:sum.allowed+t.ra,teamGames:sum.teamGames+t.games,outs:sum.outs+t.outs,earnedRuns:sum.earnedRuns+t.earnedRuns}),{runs:0,allowed:0,teamGames:0,outs:0,earnedRuns:0});
 return {rows,...totals,runsPerTeamGame:totals.teamGames?totals.runs/totals.teamGames:null,era:totals.outs?totals.earnedRuns*27/totals.outs:null};
}
