import {useEffect} from 'react';
import confetti from 'canvas-confetti';
import {Crown,Trophy,X} from 'lucide-react';
import {formatAvg,playerMap,teamById} from './data';
import {battingAverage,era,ops,rankings,type GameState} from './engine';
import {circuitLabel,circuitOf,leagueFor,titleFor} from './leagues';
import './season-result.css';

// Summary card shown once when a season finishes (night-stadium theme only).
export function SeasonResult({state,earned,onClose}:{state:GameState;earned:number;onClose:()=>void}){
 const season=state.season,club=state.club;
 const table=rankings(season,leagueFor(season,club));
 const rank=table.findIndex(t=>t.team===club)+1;
 const me=table.find(t=>t.team===club)!;
 const champion=season.postseason?.champion===club;
 const bats=Object.values(season.batting).filter(s=>s.team===club&&s.pa>=100);
 const mvp=[...bats].sort((a,b)=>ops(b)-ops(a))[0];
 const arms=Object.values(season.pitching).filter(s=>s.team===club&&s.outs>=90);
 const ace=[...arms].sort((a,b)=>b.wins-a.wins||era(a)-era(b))[0];
 const homer=[...bats].sort((a,b)=>b.hr-a.hr)[0];
 const headline=champion?titleFor(season)+'!':rank===1?'リーグ優勝!':rank<=3?`${rank}位でフィニッシュ`:'シーズン終了';
 const tone=champion||rank===1?'gold':rank<=3?'silver':'plain';
 useEffect(()=>{
  if(tone==='plain')return;
  void confetti({particleCount:tone==='gold'?180:80,spread:110,startVelocity:45,origin:{y:.3},colors:['#ffd04a','#fff2b3','#ffffff','#6d8bff'],zIndex:1300,disableForReducedMotion:true});
 },[tone]);
 const name=(id?:string)=>id?playerMap[id]?.name??'—':'—';
 return <div className="season-result-backdrop" role="dialog" aria-modal="true" aria-label="シーズン結果" onClick={onClose}>
  <div className={'season-result tone-'+tone} onClick={e=>e.stopPropagation()}>
   <button className="season-result-close" aria-label="閉じる" onClick={onClose}><X size={20}/></button>
   <p className="sr-kicker">{circuitLabel(circuitOf(season))} · SEASON {String(season.number).padStart(2,'0')}</p>
   <div className="sr-badge">{champion?<Crown size={38}/>:<Trophy size={34}/>}</div>
   <h2 className="sr-headline">{headline}</h2>
   <p className="sr-team">{state.name||teamById(club,season).short}</p>
   <div className="sr-record">
    <div><b>{rank}</b><span>位</span></div>
    <div><b>{me.w}</b><span>勝</span></div>
    <div><b>{me.l}</b><span>敗</span></div>
    <div><b>{me.d}</b><span>分</span></div>
   </div>
   <div className="sr-awards">
    {mvp&&<div><small>チームMVP</small><strong>{name(mvp.playerId)}</strong><em>打率 {formatAvg(battingAverage(mvp))} · {mvp.hr}本 · OPS {ops(mvp).toFixed(3)}</em></div>}
    {ace&&<div><small>エース</small><strong>{name(ace.playerId)}</strong><em>{ace.wins}勝{ace.losses}敗 · 防御率 {era(ace).toFixed(2)}</em></div>}
    {homer&&homer.hr>0&&homer!==mvp&&<div><small>本塁打王(チーム)</small><strong>{name(homer.playerId)}</strong><em>{homer.hr}本塁打 · {homer.rbi}打点</em></div>}
   </div>
   {earned>0&&<div className="sr-earned"><span>獲得ポイント</span><b>+{earned.toLocaleString('ja-JP')}</b><small>pt</small></div>}
   <button className="s-primary sr-ok" onClick={onClose}>OK</button>
  </div>
 </div>;
}
