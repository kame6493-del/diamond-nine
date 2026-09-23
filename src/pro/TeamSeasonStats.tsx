import type {Season} from './engine';
import {formatAvg} from './data';
import {teamSeasonStats} from './team-stats';

export function TeamSeasonStats({season,club}:{season:Season;club:string}){
 const stats=teamSeasonStats(season,club);
 const values=[['打率',stats.avg===null?'—':formatAvg(stats.avg)],['本塁打',stats.hr.toLocaleString('ja-JP')],['打点',stats.rbi.toLocaleString('ja-JP')],['盗塁',stats.sb.toLocaleString('ja-JP')],['出塁率',stats.obp===null?'—':formatAvg(stats.obp)],['防御率',stats.era===null?'—':stats.era.toFixed(2)]];
 return <section className="s-team-stats" aria-label="チーム全体成績">
  <header><h2>チーム全体成績</h2><span>レギュラーシーズン · {stats.games}試合</span></header>
  <dl>{values.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
 </section>;
}
