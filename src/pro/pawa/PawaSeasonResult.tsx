import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Check,ChevronRight,X} from 'lucide-react';
import type {SeasonCard} from '../SimpleApp';
import {SIMPLE_SCOUT_COST} from '../simple-game';
import {battingAverage,rankings,type GameState} from '../engine';
import {formatAvg,playerMap} from '../data';
import {leagueFor} from '../leagues';
import {seasonGoals} from '../ambitions';
import {effectiveOverall} from '../engine';
import {monetizeBridge} from '../monetization';
import {PackShop} from '../PackShop';

// 2026-11-01 あと一歩で優勝を逃した年(2〜3位でゲーム差8以内、またはリーグ1位で日本一を逃した)だけ、補強の道を見せる。
// 押した時だけ一覧が開く。自動では開かない。
export function nearMiss(state:GameState,seasonNumber:number){
 const season=state.season.number===seasonNumber?state.season:state.history.find(s=>s.number===seasonNumber);
 if(!season?.completed)return null;
 const table=rankings(season,leagueFor(season,state.club)),rank=table.findIndex(t=>t.team===state.club)+1,mine=table[rank-1],top=table[0];
 if(!mine)return null;
 const behind=((top.w-mine.w)+(mine.l-top.l))/2,lostFinal=rank===1&&!!season.postseason&&season.postseason.stage==='complete'&&season.postseason.champion!==state.club;
 if(!(rank>=2&&rank<=3&&behind<=8)&&!lostFinal)return null;
 const regulars=[...state.lineup,...state.pitchers.slice(0,9)].map(id=>({id,o:effectiveOverall(playerMap[id],state.owned,state.training,state.careerGrowth)})).sort((a,b)=>a.o-b.o);
 return {rank,behind,lostFinal,weak:regulars.slice(0,2)};
}

const count=(n:number)=>n.toLocaleString('ja-JP');
/** シーズン終了(ref_04)。中身は seasonCardFor() の値と、保存済みのシーズン成績から出す。 */
export function PawaSeasonResult({card,state,onScout,onClose,adSlot}:{card:SeasonCard;state:GameState;onScout:()=>void;onClose:()=>void;adSlot?:ReactNode}){
 const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const old=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';ref.current?.focus({preventScroll:true});
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close.current();}};
  document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);old?.focus({preventScroll:true});};
 },[]);
 const draws=Math.floor(state.gems/SIMPLE_SCOUT_COST);
 const season=state.season.number===card.number?state.season:state.history.find(s=>s.number===card.number)??state.season;
 const mine=season.standings.find(t=>t.team===state.club);
 const prev=state.history.find(s=>s.number===card.number-1);
 const prevRow=prev?.standings.find(t=>t.team===state.club),prevRank=prev?rankings(prev,leagueFor(prev,state.club)).findIndex(t=>t.team===state.club)+1:0;
 const star=Object.values(season.batting).filter(b=>b.team===state.club).sort((a,b)=>b.hr-a.hr)[0];
 const nextGoals=seasonGoals(state).filter(g=>!g.claimed).slice(0,4);
 const miss=nearMiss(state,card.number),app=!!monetizeBridge(),[shop,setShop]=useState(false);
 return <div className="pw-result-screen" role="dialog" aria-modal="true" aria-label={`SEASON ${String(card.number).padStart(2,'0')} 終了`} tabIndex={-1} ref={ref}>
  <div className="pw-rs-head"><img src="/assets/pro/pawa/logo.webp" alt="DIAMOND NINE"/><button className="pw-close" onClick={onClose} aria-label="閉じる"><X size={22}/></button></div>
  <h2 className="pw-rs-title">シーズン終了</h2><p className="pw-rs-lead">SEASON {String(card.number).padStart(2,'0')} の結果を確認しましょう！</p>

  <section className="pw-panel pw-rs-summary"><header><h3>シーズン結果サマリー</h3></header>
   <div className="pw-rs-rank"><img src="/assets/pro/pawa/trophy.webp" alt=""/><p><small>今シーズンの最終順位</small><b>{card.rank}<span>位</span></b><em>{card.teams}チーム中</em></p></div>
   <dl className="pw-rs-rows">
    <div><dt>リーグ成績</dt><dd>{card.w}勝 {card.l}敗{card.d?` ${card.d}分`:''}</dd></div>
    {mine&&<div><dt>総得点 / 総失点</dt><dd>{mine.rf} / {mine.ra}</dd></div>}
    <div><dt>シーズン獲得ポイント</dt><dd className="pw-plus">＋{count(card.points)} pt</dd></div>
   </dl>
   {card.goalPoints>0&&card.goalPoints<card.points&&<p className="pw-note">試合など ＋{count(card.points-card.goalPoints)} ・ 目標達成 ＋{count(card.goalPoints)}</p>}
  </section>

  {prevRow&&<section className="pw-panel pw-rs-compare"><header><h3>前シーズンとの比較</h3></header>
   <div className="pw-rs-vs"><div><small>前シーズン</small><b>{prevRank}<span>位</span></b><em>{prevRow.w}勝 {prevRow.l}敗 {prevRow.d}分</em></div><span aria-hidden="true">➜</span><div className="is-now"><small>今シーズン</small><b>{card.rank}<span>位</span></b><em>{card.w}勝 {card.l}敗 {card.d}分</em></div></div>
   {card.better!==null&&<p className={'pw-rs-diff '+(card.better>0?'up':card.better<0?'down':'')}>{card.better>0?`勝ち数 ▲${card.better}`:card.better<0?`勝ち数 ▼${-card.better}`:'勝ち数は昨季と同じ'}{prevRank&&prevRank!==card.rank?` ・ 順位 ${prevRank}位 → ${card.rank}位`:''}</p>}
  </section>}

  <div className="pw-two">
   <section className="pw-panel pw-rs-hr"><header><h3>ホームラン王</h3><span>チーム内</span></header>
    <img src="/assets/pro/pawa/hr-king.webp" alt=""/>
    {star&&star.hr>0?<div><b>{playerMap[star.playerId]?.name}</b><p><span>本塁打</span><strong>{star.hr}</strong>本</p><p><span>打率</span>{star.ab?formatAvg(battingAverage(star)):'—'}<span>打点</span>{star.rbi}</p></div>:<p className="pw-note">本塁打はありませんでした</p>}
   </section>
   <section className="pw-panel pw-rs-next"><header><h3>次の目標</h3></header>
    {card.next&&<p className="pw-rs-next-main"><b>{card.next.title}</b><small>{card.next.detail}</small></p>}
    <ul>{nextGoals.map(g=><li key={g.id}><span>{g.detail}</span><i aria-hidden="true">○</i></li>)}</ul>
   </section>
  </div>

  {card.goals.length>0&&<section className="pw-panel"><header><h3>今シーズンの主な達成</h3></header><ul className="pw-rs-goals">{card.goals.map(g=><li key={g.title}><Check size={16}/>{g.title}<span>＋{count(g.reward)} pt</span></li>)}</ul></section>}

  {miss&&<section className="pw-panel pw-rs-miss"><header><h3>{miss.lostFinal?'リーグ優勝、日本一まであと一歩':`優勝まで あと ${miss.behind} ゲーム`}</h3></header>
   <p className="pw-note">補強したい所: {miss.weak.map(w=>`${playerMap[w.id]?.name}（総合${w.o}）`).join('・')}。</p>
   {app&&<button type="button" className="pw-btn pw-white pw-wide" aria-expanded={shop} onClick={()=>setShop(v=>!v)}>{shop?'ポイント購入を閉じる':'ポイント購入を見る'}</button>}
   {app&&shop&&<PackShop/>}
  </section>}
  {draws>0?<button className="pw-btn pw-green pw-wide" onClick={onScout}><span className="pw-cap" aria-hidden="true"/>スカウトで補強する（{draws}回分）<ChevronRight size={22}/></button>:<p className="pw-note">次のスカウトまで あと{count(SIMPLE_SCOUT_COST-state.gems)} pt</p>}
  {adSlot&&<div className="pw-rs-ad">{adSlot}</div>}
  <button className="pw-link" onClick={onClose}>結果をくわしく見る</button>
 </div>;
}
