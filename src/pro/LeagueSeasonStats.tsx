import {useState} from 'react';
import type {Season} from './engine';
import {teamById} from './data';
import {circuitOf,leagueFor,playoffSeeds} from './leagues';
import {leagueSeasonStats,leagueStatsNames,type LeagueStatsScope} from './league-stats';
import './league-stats.css';

export function LeagueSeasonStats({season,club,clubName}:{season:Season;club:string;clubName:string}){
 const [scope,setScope]=useState<LeagueStatsScope>('ALL'),major=circuitOf(season)==='MLB';
 const leagues:Exclude<LeagueStatsScope,'ALL'>[]=major?['AMERICAN','NATIONAL']:['CENTRAL','PACIFIC'];
 const data=leagueSeasonStats(season,scope),count=(n:number)=>n.toLocaleString('ja-JP');
 const values=[['総得点',count(data.runs)],['総失点',count(data.allowed)],['平均得点 / 試合',data.runsPerTeamGame?.toFixed(2)??'—'],['リーグ防御率',data.era?.toFixed(2)??'—']];
 return <details className="s-fold league-stats-panel">
  <summary>リーグ順位・全体成績を見る</summary>
  <div className="league-stats-tabs" aria-label="集計するリーグ">
   {(['ALL',...leagues] as LeagueStatsScope[]).map(value=><button key={value} aria-pressed={scope===value} onClick={()=>setScope(value)}>{value==='ALL'?`${circuitOf(season)}全体`:leagueStatsNames[value]}</button>)}
  </div>
  <p className="league-stats-caption">{data.rows.length}球団 · レギュラーシーズン</p>
  <dl className="league-stat-totals">{values.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  <p className="league-stats-note">平均得点は1球団・1試合あたり。交流戦を含みます。<span className="league-stats-swipe">比較表は横にスワイプできます。</span></p>
  {major&&<p className="league-rules">地区優勝3球団とワイルドカード3球団が進出。自チームの進出圏：{!season.day?'開幕前':playoffSeeds(season,leagueFor(season,club)).some(t=>t.team===club)?'圏内':'圏外'}</p>}
  {leagues.filter(league=>scope==='ALL'||scope===league).map(league=><section className="league-stats-group" key={league}>
   <h3>{leagueStatsNames[league]}</h3>
   <div className="league-stats-scroll" role="region" aria-label={`${leagueStatsNames[league]}のチーム成績（横スクロール可能）`} tabIndex={0}>
    <table className="s-stats league-stats-table"><caption className="league-stats-sr">{leagueStatsNames[league]}の順位とチーム成績</caption><thead><tr>{['チーム','得点','失点','防御率','得失点差','勝','敗','分'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>{data.rows.filter(t=>t.league===league).map((t,i)=><tr key={t.team} className={t.team===club?'s-mine':''}><th scope="row"><span className="league-stats-rank">{i+1}</span>{t.team===club?clubName:teamById(t.team).short}</th><td>{count(t.rf)}</td><td>{count(t.ra)}</td><td>{t.era?.toFixed(2)??'—'}</td><td className={t.difference>0?'positive':t.difference<0?'negative':''}>{t.difference>0?'+':''}{count(t.difference)}</td><td>{t.w}</td><td>{t.l}</td><td>{t.d}</td></tr>)}</tbody></table>
   </div>
  </section>)}
 </details>;
}
