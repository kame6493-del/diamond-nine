import type {Season} from './engine';
import {formatAvg} from './data';
import {teamSeasonStats} from './team-stats';
import {formatUZR} from './fielding-stats';

export function TeamSeasonStats({season,club}:{season:Season;club:string}){
 const stats=teamSeasonStats(season,club),partial=stats.uzrGames>0&&stats.uzrGames<stats.games;
 const values=[['打率',stats.avg===null?'—':formatAvg(stats.avg)],['打点',stats.rbi.toLocaleString('ja-JP')],['UZR',formatUZR(stats.uzr)],['防御率',stats.era===null?'—':stats.era.toFixed(2)]];
 return <section className="s-team-stats" aria-label="チーム全体成績">
  <header><h2>チーム全体成績</h2><span>レギュラーシーズン · {stats.games}試合</span></header>
  <dl>{values.map(([label,value])=><div key={label}><dt>{label}{label==='UZR'&&partial?' ※':''}</dt><dd className={label==='UZR'?'team-uzr-value':''}>{value}</dd></div>)}</dl>
  {stats.uzr===null?<p>UZRは更新後の試合から記録されます。</p>:partial?<p>※ UZRは記録開始後の{stats.uzrGames}試合分です。</p>:null}
 </section>;
}
