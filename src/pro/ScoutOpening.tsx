import { useState,type CSSProperties,type ReactNode } from 'react';
import { ArrowRight,Diamond,Sparkles,Star,Zap } from 'lucide-react';
import { playerMap,type Player } from './data';
import type { Pull } from './engine';

export function Confetti(){return <div className="reward-confetti" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{'--i':i,'--x':`${(i*37)%100}%`,'--angle':`${i*47}deg`} as CSSProperties}/>)}</div>;}

export function ScoutOpening({pulls,renderCard,onClose,onTeam,onAgain,canAgain,onReveal}:{pulls:Pull[];renderCard:(p:Player)=>ReactNode;onClose:()=>void;onTeam:()=>void;onAgain:()=>void;canAgain:boolean;onReveal:()=>void}){
 const [started,setStarted]=useState(false),[opened,setOpened]=useState<number[]>([]),[spotlight,setSpotlight]=useState<number|null>(null);
 const complete=opened.length===pulls.length;
 const open=(index:number)=>{
  if(opened.includes(index))return;
  setOpened(v=>[...v,index]);
  if(playerMap[pulls[index].playerId].rarity==='UR'){setSpotlight(index);onReveal();}
 };
 const openAll=()=>{setStarted(true);setSpotlight(null);setOpened(pulls.map((_,i)=>i));onReveal();};
 const badge=(item:Pull)=>item.isNew?'NEW PLAYER':item.copies<=6?`覚醒 ${item.copies-2} → ${item.copies-1}`:'覚醒 MAX · コレクション追加';
 if(spotlight!==null){const item=pulls[spotlight],p=playerMap[item.playerId];return <div className="scout-spotlight"><Confetti/><div className="spotlight-rays" aria-hidden="true"/><div className="eyebrow">ULTIMATE RARE</div><h2>伝説級の出会い。</h2><div className="spotlight-card">{renderCard(p)}</div><strong className="spotlight-name">{p.name}</strong><span className="spotlight-badge"><Star size={15}/>{badge(item)}</span><button autoFocus className="btn gold" onClick={()=>setSpotlight(null)}>獲得！ 続ける <ArrowRight size={18}/></button><button className="text-button" onClick={openAll}>残りをすべて開封</button></div>;}
 return <section className={`scout-opening ${complete?'opening-complete':''}`}>
  <div className="eyebrow">{complete?'SCOUT COMPLETE':started?'WHO IS YOUR NEXT STAR?':'THE NEXT CHAPTER'}</div>
  <h2>{complete?'新戦力、獲得。':started?'その一枚を、めくれ。':'運命のパックが届いた。'}</h2>
  <p className="opening-caption">{complete?`${pulls.filter(x=>x.isNew).length}人が新加入 · ${pulls.filter(x=>!x.isNew).length}枚が重複獲得`:started?'カードをタップして開封。まとめて開けることもできます。':`${pulls.length}枚の選手カード。あなたのチームの、次の主役。`}</p>
  {!started?<div className="sealed-stage"><button className="sealed-pack" onClick={()=>setStarted(true)} aria-label="パックを開封"><span className="pack-seal">DIAMOND NINE</span><Diamond size={66} strokeWidth={1}/><strong>THE<br/>STARS</strong><small>2026 PLAYER COLLECTION</small><span className="pack-count">{pulls.length} PLAYERS</span></button><button className="btn gold" onClick={()=>setStarted(true)}><Sparkles size={18}/>パックを開封</button><button className="text-button" onClick={openAll}>演出をスキップ・結果を見る</button></div>:<>
   <div className="opening-progress"><span>{complete?'すべて開封済み':'OPENED'} <b>{opened.length}</b> / {pulls.length}</span><div><i style={{width:`${opened.length/pulls.length*100}%`}}/></div></div>
   <div className={`opening-grid ${pulls.length===1?'single':''}`}>{pulls.map((item,index)=>{
    const visible=opened.includes(index),p=playerMap[item.playerId];
    return <div key={index} className={`opening-slot ${visible?`is-open tier-${p.rarity}`:''}`}>
     {visible?<>{renderCard(p)}<span className={item.isNew?'new-chip':'duplicate-chip'}>{badge(item)}</span></>:<button className="opening-card-back" aria-label={`${index+1}枚目を開封`} onClick={()=>open(index)}><span>{String(index+1).padStart(2,'0')}</span><Diamond size={34} strokeWidth={1}/><strong>DN</strong><small>TAP TO REVEAL</small></button>}
    </div>;
   })}</div>
   {complete?<div className="opening-summary" aria-live="polite">{(['UR','SSR','SR','R'] as const).map(r=>{const count=pulls.filter(x=>playerMap[x.playerId].rarity===r).length;return count?<span className={`summary-${r}`} key={r}>{r} <b>×{count}</b></span>:null;})}</div>:<div className="opening-actions"><button className="btn gold" onClick={()=>open(pulls.findIndex((_,i)=>!opened.includes(i)))}><Zap size={17}/>次のカードを開封</button><button className="btn outline" onClick={openAll}>すべて開封</button></div>}
  </>}
  {complete&&<div className="opening-actions"><button className="btn primary" onClick={onTeam}>チームに編成 <ArrowRight size={16}/></button><button className="btn gold" disabled={!canAgain} onClick={onAgain}><Sparkles size={16}/>もう10連 · 2,700</button><button className="text-button" onClick={onClose}>結果を閉じる</button></div>}
  <p className="fine-print opening-save">選手はスカウト時に獲得・保存済みです。途中で閉じても全員受け取れます。</p>
 </section>;
}
