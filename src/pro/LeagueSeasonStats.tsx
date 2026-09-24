import {Fragment,useId,useState} from 'react';
import type {Season} from './engine';
import {formatAvg,formatIP,teamById} from './data';
import {circuitLabel,circuitOf,leagueFor,playoffSeeds} from './leagues';
import {leagueSeasonStats,leagueStatsNames,type LeagueStatsScope,type LeagueTeamStats} from './league-stats';
import {TeamUZR} from './TeamUZR';
import './league-stats.css';

const count=(n:number)=>n.toLocaleString('ja-JP');
export function TeamStatsDetail({team,name}:{team:LeagueTeamStats;name:string}){
 const batting=[['打率',team.avg===null?'—':formatAvg(team.avg)],['本塁打',count(team.hr)],['打点',count(team.rbi)],['盗塁',count(team.sb)],['出塁率',team.obp===null?'—':formatAvg(team.obp)],['得点',count(team.rf)]];
 const pitching=[['防御率',team.era?.toFixed(2)??'—'],['奪三振',count(team.so)],['セーブ',count(team.saves)],['投球回',team.outs?formatIP(team.outs):'—'],['失点',count(team.ra)],['得失点差',`${team.difference>0?'+':''}${count(team.difference)}`]];
 const groups:[string,string[][]][]=[['打撃',batting],['投手・失点',pitching]];
 return <section className="league-team-detail" aria-label={`${name}の詳細成績`}>
  <header><h4>{name}</h4><span>{team.games}試合</span></header>
  {groups.map(([label,values])=><div className="league-detail-group" key={label}><h5>{label}</h5><dl>{values.map(([metric,value])=><div key={metric}><dt>{metric}</dt><dd>{value}</dd></div>)}</dl></div>)}
  <TeamUZR {...team} rank={team.uzrRank}/>
 </section>;
}

export function LeagueSeasonStats({season,club,clubName}:{season:Season;club:string;clubName:string}){
 const [scope,setScope]=useState<LeagueStatsScope>(()=>leagueFor(season,club) as LeagueStatsScope),[expandedTeam,setExpandedTeam]=useState<string|null>(null),detailId=useId(),major=circuitOf(season)!=='NPB';
 const leagues:Exclude<LeagueStatsScope,'ALL'>[]=major?['AMERICAN','NATIONAL']:['CENTRAL','PACIFIC'];
 const data=leagueSeasonStats(season,scope);
 const values=[['総得点',count(data.runs)],['総失点',count(data.allowed)],['平均得点 / 試合',data.runsPerTeamGame?.toFixed(2)??'—'],['リーグ防御率',data.era?.toFixed(2)??'—']];
 return <details className="s-fold league-stats-panel">
  <summary>リーグ順位・全体成績を見る</summary>
  <div className="league-stats-tabs" aria-label="集計するリーグ">
   {([...leagues,'ALL'] as LeagueStatsScope[]).map(value=><button key={value} aria-pressed={scope===value} onClick={()=>{setScope(value);setExpandedTeam(null);}}>{value==='ALL'?`${circuitLabel(circuitOf(season))}全体`:leagueStatsNames[value]}</button>)}
  </div>
  <p className="league-stats-caption">チーム名をタップで詳細表示。差はリーグ首位との差。</p>
  {leagues.filter(league=>scope==='ALL'||scope===league).map(league=><section className="league-stats-group" key={league}>
   <h3>{leagueStatsNames[league]}</h3>
   <table className="s-stats league-stats-table"><caption className="league-stats-sr">{leagueStatsNames[league]}の順位とチーム成績</caption><thead><tr><th scope="col">チーム</th><th scope="col">勝-敗-分</th><th scope="col">勝率</th><th scope="col" title="リーグ首位とのゲーム差">差</th></tr></thead>
    <tbody>{data.rows.filter(t=>t.league===league).map(t=>{
     const name=t.team===club?clubName:teamById(t.team).short,expanded=expandedTeam===t.team,id=`${detailId}-${t.team}`;
     return <Fragment key={t.team}><tr className={t.team===club?'s-mine':''}><th scope="row"><button className="league-team-toggle" onClick={()=>setExpandedTeam(expanded?null:t.team)} aria-expanded={expanded} aria-controls={id} aria-label={`${name}の詳細成績`} title={name}><span className="league-stats-rank">{t.rank??'—'}</span><span className="league-team-name">{name}</span><span className="league-team-chevron" aria-hidden="true">{expanded?'−':'＋'}</span></button></th><td>{t.w}-{t.l}-{t.d}</td><td>{t.pct===null?'—':formatAvg(t.pct)}</td><td>{t.gamesBehind===null||t.rank===1?'—':t.gamesBehind.toFixed(1)}</td></tr>
     {expanded&&<tr className="league-detail-row"><td colSpan={4} id={id}><TeamStatsDetail team={t} name={name}/></td></tr>}</Fragment>;
    })}</tbody>
   </table>
  </section>)}
  {major&&<p className="league-rules">地区優勝3球団とワイルドカード3球団が進出。自チームの進出圏：{!season.day?'開幕前':playoffSeeds(season,leagueFor(season,club)).some(t=>t.team===club)?'圏内':'圏外'}</p>}
  <div className="league-overview"><h3>リーグ全体の成績 <small>{data.rows.length}球団</small></h3><dl className="league-stat-totals">{values.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   <p className="league-stats-note">レギュラーシーズンの集計。平均得点は1球団・1試合あたり。交流戦を含みます。</p>
  </div>
 </details>;
}
