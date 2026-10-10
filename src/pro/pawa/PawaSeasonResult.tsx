import {useEffect,useRef} from 'react';
import {Check,ChevronRight,X} from 'lucide-react';
import type {SeasonCard} from '../SimpleApp';
import {SIMPLE_SCOUT_COST} from '../simple-game';

const count=(n:number)=>n.toLocaleString('ja-JP');
/** シーズン結果(ref_05 左)。中身は seasonCardFor() の値をそのまま出す。 */
export function PawaSeasonResult({card,gems,onScout,onClose}:{card:SeasonCard;gems:number;onScout:()=>void;onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const old=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';ref.current?.focus({preventScroll:true});
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close.current();}};
  document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);old?.focus({preventScroll:true});};
 },[]);
 const draws=Math.floor(gems/SIMPLE_SCOUT_COST);
 return <div className="nv-result-screen" role="dialog" aria-modal="true" aria-label={`SEASON ${String(card.number).padStart(2,'0')} 終了`} tabIndex={-1} ref={ref}>
  <button className="nv-close" onClick={onClose} aria-label="閉じる"><X size={22}/></button>
  <img className="nv-result-logo" src="/assets/pro/pawa/logo.webp" alt=""/>
  <p className="nv-result-kicker">シーズン結果</p>
  <h2 className="nv-result-title">SEASON {String(card.number).padStart(2,'0')} 終了</h2>
  <p className="nv-result-lead">最後まで戦い抜いたあなたのチームの記録です。</p>
  <div className="nv-result-grid">
   <div className="nv-final-rank"><small>最終ランキング</small><p><b>{card.rank}</b>位</p><span>{card.teams}チーム中</span></div>
   <div className="nv-result-tile"><small>勝敗</small><b>{card.w}勝 {card.l}敗{card.d?` ${card.d}分`:''}</b>{card.better!==null&&<em className={card.better>0?'up':card.better<0?'down':''}>{card.better>0?`昨季より ▲${card.better}勝`:card.better<0?`昨季より ▼${-card.better}勝`:'昨季と同じ勝ち数'}</em>}</div>
  </div>
  <div className="nv-result-tiles">
   <div className="nv-result-tile"><small>チーム本塁打王</small>{card.star?<><b>{card.star.name}</b><em>本塁打 {card.star.hr}本</em></>:<b>—</b>}</div>
   <div className="nv-result-tile"><small>獲得ポイント</small><img src="/assets/pro/pawa/coin.webp" alt=""/><b>＋{count(card.points)} pt</b>{card.goalPoints>0&&card.goalPoints<card.points&&<em>試合など ＋{count(card.points-card.goalPoints)} ・ 目標 ＋{count(card.goalPoints)}</em>}</div>
   <div className="nv-result-tile"><small>次の目標</small>{card.next?<><b>{card.next.title}</b><em>{card.next.detail}</em></>:<b>—</b>}</div>
  </div>
  {card.goals.length>0&&<ul className="nv-result-goals">{card.goals.map(g=><li key={g.title}><Check size={14}/>{g.title}<span>＋{count(g.reward)} pt</span></li>)}</ul>}
  <div className="nv-result-cards" aria-hidden="true"><img src="/assets/pro/pawa/card-back.webp" alt=""/><img src="/assets/pro/pawa/pack-scene.webp" alt=""/><img src="/assets/pro/pawa/card-back.webp" alt=""/></div>
  {draws>0?<button className="nv-gold nv-wide" onClick={onScout}>スカウトで補強する（{draws}回分）<ChevronRight size={18}/></button>:<p className="nv-note">次のスカウトまで あと{count(SIMPLE_SCOUT_COST-gems)} pt</p>}
  <button className="nv-link" onClick={onClose}>結果をくわしく見る</button>
 </div>;
}
