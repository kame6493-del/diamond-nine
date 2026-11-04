// スタメンを決める画面(2026-11-05)。「監督して戦う」を押した後、試合の前に出す。チームの「オーダー」の画面と同じ部品
// (守備位置の札 PosChip・能力の段 Rank・白い札)で、打順の並べ替え・守備位置・先発投手・控えとの入れ替えを決める。
// 決めなくても「このまま始める」で進める。「おすすめ」でふだんのオーダー(1年進める時の物)に戻す。
// 始めるボタンはいつも画面の下に見えている(この画面だけはスクロールしてよい)。始められない時は理由を一言出す。
import {useMemo,useState} from 'react';
import {formatAvg,playerMap} from './data';
import {battingAverage,era,type GameState} from './engine';
import {liveRatings} from './watch';
import {PosChip,Rank} from './pawa/PawaCard';
import {benchIn,benchOf,chooseStarter,formOf,isNative,orderBlock,posName,restDays,sameOrder,setPosition,starterOf,starterSlot,swapOrder,usesDH,usualOrder,type StartOrder} from './lineup';
import {throwHand} from './field-sim';
import './lineup.css';

const POSITIONS=['捕','一','二','三','遊','外'];
export function StartingLineup({base,label,rival,onStart,onCancel}:{base:GameState;label:string;rival:string;onStart:(o:StartOrder|null,keep:boolean)=>void;onCancel:()=>void}){
 const usual=useMemo(()=>usualOrder(base),[base]);
 const [o,setO]=useState<StartOrder>(usual),[keep,setKeep]=useState(false),[sel,setSel]=useState<number|null>(null),[posFor,setPosFor]=useState<number|null>(null),[note,setNote]=useState('');
 const club=base.club,season=base.season;
 const rate=(id:string)=>liveRatings(base,club,id,o.pitchers);
 const why=orderBlock(base,o),changed=!sameOrder(o,usual),dh=usesDH(base);
 const bench=benchOf(base,o).sort((a,b)=>(playerMap[a].name<playerMap[b].name?-1:1));
 const avg=(id:string)=>{const b=season.batting[`${club}|${id}`];return b&&b.ab?formatAvg(battingAverage(b)):'---';};
 const eraOf=(id:string)=>{const p=season.pitching[`${club}|${id}`];return p&&p.outs?era(p).toFixed(2):'-.--';};
 const form=(id:string)=>{const f=formOf(base,id);return f>=5?{t:'絶好調',c:'is-hot'}:f>0?{t:'好調',c:'is-good'}:f<0?{t:'不調',c:'is-bad'}:null;};
 const tapRow=(i:number)=>{setPosFor(null);
  if(sel===null){setSel(i);setNote(`${i+1}番 ${playerMap[o.lineup[i]].name}を選びました。入れ替える打順か、下の控えを押してください`);return;}
  if(sel===i){setSel(null);setNote('');return;}
  setO(swapOrder(o,sel,i));setNote(`${sel+1}番と${i+1}番を入れ替えました`);setSel(null);
 };
 const pickPos=(i:number,pos:string)=>{const id=o.lineup[i];setO(setPosition(o,id,pos));setPosFor(null);setNote(`${playerMap[id].name}を${posName(pos)}に${isNative(id,pos)?'':'(本職ではありません)'}`);};
 const takeBench=(id:string)=>{if(sel===null){setNote('先に、入れ替える打順の選手を押してください');return;}const out=o.lineup[sel];setO(benchIn(o,sel,id));setNote(`${playerMap[out].name}に代わって${playerMap[id].name}が${sel+1}番に入ります`);setSel(null);};
 const starter=starterOf(o,base),rotation=o.pitchers.slice(0,6);
 const reset=()=>{setO(usual);setSel(null);setPosFor(null);setNote('ふだんのオーダーに戻しました');};
 const start=()=>{if(why)return;onStart(changed?o:null,keep&&changed);};
 return <div className="lu-root" role="dialog" aria-modal="true" aria-label="スタメンを決める">
  <div className="lu-page">
   <header className="lu-head"><button className="pw-btn pw-white lu-back" onClick={onCancel}>戻る</button><div><h2>スタメンを決める</h2><p>{label} vs {rival}</p></div></header>
   <div className="lu-scroll">
    <div className="lu-keep" role="group" aria-label="このスタメンを使う範囲"><button className={keep?'':'is-on'} aria-pressed={!keep} onClick={()=>setKeep(false)}>この試合だけ</button><button className={keep?'is-on':''} aria-pressed={keep} onClick={()=>setKeep(true)}>ふだんのオーダーにも使う</button></div>
    <h3 className="lu-band">打順と守備位置<small>押して選び、もう1人を押すと入れ替え</small></h3>
    <ol className="lu-order">{o.lineup.map((id,i)=>{const p=playerMap[id],r=rate(id),pos=o.defense[id],native=isNative(id,pos),f=form(id);
     return <li key={id} className={'lu-row'+(sel===i?' is-sel':'')}>
      <button className="lu-row-main" onClick={()=>tapRow(i)} aria-pressed={sel===i} aria-label={`${i+1}番 ${p.name}`}>
       <b className="lu-no">{i+1}</b>
       <span className="lu-name"><b>{p.name}</b><small>打率 {avg(id)}{f&&<em className={f.c}>{f.t}</em>}</small></span>
       <span className="lu-abs"><Rank value={r.contact} label="ミート"/><Rank value={r.power} label="パワー"/><Rank value={r.speed} label="走力"/><Rank value={r.field} label="守備"/></span>
      </button>
      <button className={'lu-pos'+(native?'':' is-bad')} onClick={()=>{setSel(null);setPosFor(posFor===i?null:i);}} aria-label={`${p.name}の守備位置 ${posName(pos)}${native?'':' 本職ではありません'}`}><PosChip pos={pos}/>{!native&&<small>本職でない</small>}</button>
      {posFor===i&&<div className="lu-posbar" role="group" aria-label="守備位置を選ぶ">{[...POSITIONS,...(dh?['DH']:[])].map(x=><button key={x} className={(pos===x?'is-on':'')+(isNative(id,x)?'':' is-bad')} onClick={()=>pickPos(i,x)}><PosChip pos={x}/><small>{isNative(id,x)?posName(x):'本職ではありません'}</small></button>)}</div>}
     </li>;})}</ol>
    <p className="lu-legend">ミ=ミート・パ=パワー・走=走力・守=守備(本職でない位置は守備が下がります)</p>
    <h3 className="lu-band">先発投手<small>ローテーションの6人から</small></h3>
    <ul className="lu-pitchers">{rotation.map(id=>{const p=playerMap[id],r=rate(id),rest=restDays(base,usual,id),f=form(id),on=id===starter;
     const tired=rest!==null&&rest<4;
     return <li key={id}><button className={'lu-pit'+(on?' is-on':'')} aria-pressed={on} onClick={()=>{setO(chooseStarter(o,base,id));setNote(`先発は${p.name}`);}}>
      <span className="lu-name"><b>{p.name}</b><small>{throwHand(id)==='L'?'左投':'右投'} 防御率 {eraOf(id)}{f&&<em className={f.c}>{f.t}</em>}</small></span>
      <span className="lu-kmh">{Math.round(r.velocity)}<small>km</small></span>
      <span className="lu-abs is-3"><Rank value={r.control} label="制球"/><Rank value={r.stamina} label="スタミナ"/></span>
      <span className={'lu-rest'+(tired?' is-tired':'')}>{rest===null?'未登板':`中${rest}日`}{tired&&<small>疲れ</small>}</span>
      {on&&<i className="lu-mark">先発</i>}
     </button></li>;})}</ul>
    <p className="lu-legend">今日の枠は{starterSlot(base)+1}番目の投手です。中○日=前の登板からの日数(ふだんのローテーションで数えます)。</p>
    <h3 className="lu-band">控え<small>{sel===null?'打順の選手を選ぶと入れ替えられます':`${sel+1}番 ${playerMap[o.lineup[sel]].name}と入れ替え`}</small></h3>
    {bench.length?<ul className="lu-bench">{bench.map(id=>{const p=playerMap[id],r=rate(id),pos=sel!==null?o.defense[o.lineup[sel]]:p.position,native=sel===null||isNative(id,pos);
     return <li key={id}><button className={'lu-row-main lu-benchrow'+(sel===null?' is-idle':'')} onClick={()=>takeBench(id)} aria-label={`控え ${p.name}を入れる`}>
      <PosChip pos={p.position==='投'?'DH':p.position}/><span className="lu-name"><b>{p.name}</b><small>打率 {avg(id)}{sel!==null&&!native&&<em className="is-bad">{posName(pos)}は本職ではありません</em>}</small></span>
      <span className="lu-abs"><Rank value={r.contact} label="ミート"/><Rank value={r.power} label="パワー"/><Rank value={r.speed} label="走力"/><Rank value={r.field} label="守備"/></span>
     </button></li>;})}</ul>:<p className="lu-legend">控えの野手がいません。</p>}
   </div>
   <footer className="lu-foot">
    <p className={'lu-note'+(why?' is-why':'')} role="status">{why||note||(changed?(keep?'このスタメンをふだんのオーダーにもします':'このスタメンはこの試合だけ'):'ふだんのオーダーのままです')}</p>
    <div className="lu-btns"><button className="pw-btn pw-white" disabled={!changed} onClick={reset}>おすすめ</button><button className="pw-btn pw-yellow lu-start" aria-disabled={!!why} disabled={!!why} onClick={start}>{changed?'このスタメンで始める':'このまま始める'}</button></div>
   </footer>
  </div>
 </div>;
}
