import type {Season} from './engine';
import {leagueTeams,standingOrder} from './leagues';
import {teamBattingStats} from './team-stats';
import {teamFieldingStats} from './fielding-stats';

export type LeagueStatsScope='ALL'|'CENTRAL'|'PACIFIC'|'AMERICAN'|'NATIONAL';
export const leagueStatsNames:Record<Exclude<LeagueStatsScope,'ALL'>,string>={CENTRAL:'セ・リーグ',PACIFIC:'パ・リーグ',AMERICAN:'ア・リーグ',NATIONAL:'ナ・リーグ'};

// Use all clubs' regular-season records, not the custom club's game log.
export function leagueSeasonStats(season:Season,scope:LeagueStatsScope='ALL'){
 const members=leagueTeams(season).filter(t=>scope==='ALL'||t.league===scope);
 const leagues=new Map(members.map(t=>[t.id,t.league]));
 const pitching=new Map<string,{outs:number;er:number;so:number;saves:number}>();
 for(const p of Object.values(season.pitching)){
  if(!leagues.has(p.team))continue;
  const total=pitching.get(p.team)??{outs:0,er:0,so:0,saves:0};total.outs+=p.outs;total.er+=p.er;total.so+=p.so;total.saves+=p.saves;pitching.set(p.team,total);
 }
 const rows=season.standings.filter(t=>leagues.has(t.team)).sort(standingOrder).map(t=>{
  const p=pitching.get(t.team)??{outs:0,er:0,so:0,saves:0};
  return {...t,...teamBattingStats(season,t.team),...teamFieldingStats(season,t.team),league:leagues.get(t.team)!,games:t.w+t.l+t.d,pct:t.w+t.l?t.w/(t.w+t.l):null,difference:t.rf-t.ra,outs:p.outs,earnedRuns:p.er,era:p.outs?p.er*27/p.outs:null,so:p.so,saves:p.saves};
 });
 const rankedRows=rows.map(t=>{
  const peers=rows.filter(r=>r.league===t.league),leader=peers[0];
  // Never award a rank to unrecorded defense or mix different recorded periods.
  const comparable=peers.filter(r=>r.games>0);
  const uzrRank=t.uzr===null||!t.uzrGames||comparable.some(r=>r.uzr===null||r.uzrGames!==t.uzrGames)?null:1+comparable.filter(r=>r.uzr!>t.uzr!+1e-10).length;
  return {...t,rank:t.games?peers.indexOf(t)+1:null,gamesBehind:t.games&&leader.games?((leader.w-t.w)+(t.l-leader.l))/2:null,uzrRank};
 });
 const totals=rows.reduce((sum,t)=>({runs:sum.runs+t.rf,allowed:sum.allowed+t.ra,teamGames:sum.teamGames+t.games,outs:sum.outs+t.outs,earnedRuns:sum.earnedRuns+t.earnedRuns}),{runs:0,allowed:0,teamGames:0,outs:0,earnedRuns:0});
 return {rows:rankedRows,...totals,runsPerTeamGame:totals.teamGames?totals.runs/totals.teamGames:null,era:totals.outs?totals.earnedRuns*27/totals.outs:null};
}

export type TeamMetric='avg'|'hr'|'rbi'|'sb'|'obp'|'era';
export type LeagueTeamStats=ReturnType<typeof leagueSeasonStats>['rows'][number];
export function teamSeasonRanks(season:Season,club:string){
 const league=leagueTeams(season).find(t=>t.id===club)?.league as Exclude<LeagueStatsScope,'ALL'>|undefined;
 const peers=leagueSeasonStats(season).rows.filter(t=>t.league===league&&t.games>0),mine=peers.find(t=>t.team===club);
 const ranks={} as Record<TeamMetric,number|null>;
 for(const metric of ['avg','hr','rbi','sb','obp','era'] as TeamMetric[]){
  const value=mine?.[metric];
  // Competition ranking: ties share a rank (1, 1, 3). Rate stats compare unrounded values.
  ranks[metric]=value==null?null:1+peers.filter(t=>t[metric]!==null&&(metric==='era'?value-t[metric]!:t[metric]!-value)>1e-10).length;
 }
 return {league,ranks,uzrRank:mine?.uzrRank??null};
}
