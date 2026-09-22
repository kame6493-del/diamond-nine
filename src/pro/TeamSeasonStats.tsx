import type {Season} from './engine';
import {formatAvg} from './data';
import {teamSeasonStats} from './team-stats';

export function TeamSeasonStats({season,club}:{season:Season;club:string}){
 const stats=teamSeasonStats(season,club),partial=stats.errorGames>0&&stats.errorGames<stats.games;
 const values=[['打率',stats.avg===null?'—':formatAvg(stats.avg)],['打点',stats.rbi.toLocaleString('ja-JP')],['失策',stats.errors===null?'未記録':stats.errors.toLocaleString('ja-JP')+(partial?' ※':'')],['防御率',stats.era===null?'—':stats.era.toFixed(2)]];
 return <section className="s-team-stats" aria-label="チーム全体成績">
  <header><h2>チーム全体成績</h2><span>レギュラーシーズン · {stats.games}試合</span></header>
  <dl>{values.map(([label,value])=><div key={label}><dt>{label}</dt><dd className={value==='未記録'?'unrecorded':''}>{value}</dd></div>)}</dl>
  {stats.errors===null?<p>失策は更新後の試合から記録されます。</p>:partial?<p>※ 失策は記録開始後の{stats.errorGames}試合分です。</p>:null}
 </section>;
}
