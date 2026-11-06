// 日程表の画面(2026-11-05)。一覧はスクロール、開いた時は次の試合(いまの位置)が見える所から。
// まだの試合を1つ選ぶと、下に「この試合の前まで進める」。押すと、そこまで止まらずに進めてホームの札で止まる。
import {useEffect,useMemo,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {teamById} from './data';
import type {GameState} from './engine';
import {scheduleRows,type ScheduleRow} from './schedule';
import './schedule.css';

export function ScheduleSheet({state,busy,onClose,onRunTo}:{state:GameState;busy:boolean;onClose:()=>void;onRunTo:(pos:string)=>void}){
 const rows=useMemo(()=>scheduleRows(state),[state]);
 const [pick,setPick]=useState<string|null>(null);
 const list=useRef<HTMLOListElement>(null);
 const name=(id:string)=>id===state.club?state.name:teamById(id,state.season).short;
 useEffect(()=>{
  // 次の試合を一覧の上から3行目あたりに(今の位置が分かるように)。
  const el=list.current?.querySelector<HTMLElement>('.sc-row.is-now')??list.current?.querySelector<HTMLElement>('.sc-row:not(.is-done)');
  if(el&&list.current)list.current.scrollTop=Math.max(0,el.offsetTop-list.current.offsetTop-el.offsetHeight*2);
 },[]);
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);
 const picked=rows.find(r=>r.pos===pick)??null;
 const played=rows.filter(r=>r.result),w=played.filter(r=>r.section==='regular'&&r.result!.mark==='W').length,l=played.filter(r=>r.section==='regular'&&r.result!.mark==='L').length;
 const row=(r:ScheduleRow,i:number)=>{
  const head=i===0||rows[i-1].group!==r.group;
  return <li key={r.pos} className={'sc-li'}>
   {head&&<h3 className="sc-sec">{r.group}</h3>}
   <button type="button" className={'sc-row'+(r.result?' is-done':'')+(r.now?' is-now':'')+(pick===r.pos?' is-pick':'')+(r.pickable?'':' is-locked')} disabled={!r.pickable} aria-pressed={pick===r.pos} onClick={()=>setPick(p=>p===r.pos?null:r.pos)}>
    <span className="sc-no">{r.label}</span>
    <span className="sc-vs">{r.result||r.section==='regular'?<i className={r.home?'is-home':'is-away'}>{r.home?'ホ':'ビ'}</i>:<i className="is-vs">vs</i>}<b>{name(r.opponent)}</b></span>
    <span className="sc-res">{r.result?<><em className={'sc-'+r.result.mark}>{r.result.mark==='W'?'勝':r.result.mark==='L'?'負':'分'}</em>{r.result.ours}-{r.result.theirs}</>:r.now?<em className="sc-next">次の試合</em>:''}</span>
   </button>
  </li>;
 };
 return <div className="sc-modal" role="dialog" aria-modal="true" aria-label="日程表" onClick={onClose}>
  <div className="sc-sheet" onClick={e=>e.stopPropagation()}>
   <header className="sc-top"><h2>日程表<small>{state.season.number}シーズン目 · {w}勝{l}敗</small></h2><button type="button" className="sc-x" aria-label="日程表を閉じる" onClick={onClose}><X size={20}/></button></header>
   <p className="sc-help">まだの試合を選ぶと、その試合の前まで一気に進めます(途中の大事な試合でも止まりません)。</p>
   <ol className="sc-list" ref={list}>{rows.map(row)}</ol>
   <footer className="sc-foot">{picked?<button type="button" className="sc-go" disabled={busy} onClick={()=>onRunTo(picked.pos)}>この試合の前まで進める<small>{picked.section==='post'?picked.group+' ':''}{picked.label} vs {name(picked.opponent)}</small></button>:null}</footer>
  </div>
 </div>;
}
