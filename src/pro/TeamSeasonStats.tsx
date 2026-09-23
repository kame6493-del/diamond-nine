import type {Season} from './engine';
import {formatAvg} from './data';
import {teamSeasonStats} from './team-stats';
import {teamSeasonRanks,leagueStatsNames,type TeamMetric} from './league-stats';
import {TeamUZR} from './TeamUZR';

export function TeamSeasonStats({season,club}:{season:Season;club:string}){
 const stats=teamSeasonStats(season,club),{league,ranks,uzrRank}=teamSeasonRanks(season,club);
 const values:[TeamMetric,string,string][]=[['avg','打率',stats.avg===null?'—':formatAvg(stats.avg)],['hr','本塁打',stats.hr.toLocaleString('ja-JP')],['rbi','打点',stats.rbi.toLocaleString('ja-JP')],['sb','盗塁',stats.sb.toLocaleString('ja-JP')],['obp','出塁率',stats.obp===null?'—':formatAvg(stats.obp)],['era','防御率',stats.era===null?'—':stats.era.toFixed(2)]];
 return <section className="s-team-stats" aria-label="チーム全体成績">
  <header><h2>チーム全体成績</h2><span>{league?`${leagueStatsNames[league]}内`:'レギュラーシーズン'} · {stats.games}試合</span></header>
  <dl>{values.map(([key,label,value])=><div key={key}><dt>{label}</dt><dd><span>{value}</span>{ranks[key]!==null&&<small className={'team-stat-rank'+(ranks[key]===1?' is-first':'')}>{ranks[key]}位</small>}</dd></div>)}</dl>
  <TeamUZR {...stats} rank={uzrRank}/>
 </section>;
}
