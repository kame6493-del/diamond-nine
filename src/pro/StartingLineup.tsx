// スタメンを決める画面(2026-11-05)。「監督して戦う」を押した後、試合の前に出す。チームの「オーダー」の画面と同じ部品
// (守備位置の札 PosChip・能力の段 Rank・白い札)で、打順の並べ替え・守備位置・先発投手・控えとの入れ替えを決める。
// 決めなくても「このまま始める」で進める。「おすすめ」でふだんのオーダー(1年進める時の物)に戻す。
// 始めるボタンはいつも画面の下に見えている(この画面だけはスクロールしてよい)。始められない時は理由を一言出す。
import {useMemo,useState} from 'react';
import {formatAvg,playerMap} from './data';
import {battingAverage,era,type GameState} from './engine';
import {liveRatings} from './watch';
import {PosChip} from './pawa/PawaCard';
import {AbilityTag,GRADE_GUIDE,VelocityTag} from './AbilityTag';
import {defenseAtPosition} from './position-defense';
import {benchIn,benchOf,chooseStarter,formOf,isNative,orderBlock,posFit,posFitLine,posName,roleFits,restDays,sameOrder,setPosition,starterOf,starterSlot,swapOrder,usesDH,usualOrder,type FitMark,type StartOrder} from './lineup';
import {throwHand} from './field-sim';
import './lineup.css';

const POSITIONS=['捕','一','二','三','遊','外'];
const markClass=(m:FitMark)=>m==='◎'?'is-main':m==='○'?'is-ok':m==='△'?'is-weak':'is-no';
/** 守れる位置の一覧(「捕◎ 一○ 三△」)。 */
function Fits({id}:{id:string}){const f=posFitLine(id);return <span className="lu-fits" aria-label={'守れる位置 '+f.map(x=>posName(x.pos)+(x.main?'(本職)':x.mark==='△'?'(苦手)':'')).join('、')}>{f.map(x=><i key={x.pos} className={markClass(x.mark)}>{x.pos}{x.mark}</i>)}</span>;}
/** 投手の役割の適性と利き腕(「右投 先◎ 中○ 抑×」)。 */
function Roles({id}:{id:string}){const r=roleFits(id);return <span className="lu-fits is-roles" aria-label={'適性 '+r.map(x=>x.name+x.mark).join('、')}>{r.map(x=><i key={x.role} className={markClass(x.mark)}>{x.name}{x.mark}</i>)}</span>;}
export function StartingLineup({base,label,rival,onStart,onCancel}:{base:GameState;label:string;rival:string;onStart:(o:StartOrder|null,keep:boolean)=>void;onCancel:()=>void}){
 const usual=useMemo(()=>usualOrder(base),[base]);
 const [o,setO]=useState<StartOrder>(usual),[keep,setKeep]=useState(false),[sel,setSel]=useState<number|null>(null),[posFor,setPosFor]=useState<number|null>(null),[note,setNote]=useState('');
 const club=base.club,season=base.season;
 const rate=(id:string)=>liveRatings(base,club,id,o.pitchers);
 /** その位置で守った時の守備(試合の計算と同じ defenseAtPosition。本職でなければ下がる)。 */
 const fieldAt=(id:string,pos:string)=>{const p=playerMap[id];return !p||!pos||pos==='DH'?rate(id).field:defenseAtPosition(p,pos,rate(id)).field;};
 /** 選んだ位置の適性を大きく出す。 */
 const PosBig=({id,pos}:{id:string;pos:string})=>{const fx=posFit(id,pos);return <div className={'lu-posbig '+markClass(fx.mark)} role="status"><span className="lu-pbm">{pos==='DH'?'指':fx.mark}</span><span><b>{playerMap[id].name}・{posName(pos)}</b><em>{pos==='DH'?'打つだけ(守らない)':fx.main?'本職です':fx.text}</em></span>{pos!=='DH'&&<AbilityTag v={fieldAt(id,pos)} label={`守備(${pos})`}/>}</div>;};
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
 const pickPos=(i:number,pos:string)=>{const id=o.lineup[i];setO(setPosition(o,id,pos));setPosFor(null);{const fx=posFit(id,pos);setNote(`${playerMap[id].name}を${posName(pos)}に${pos==='DH'?'':fx.main?'(本職)':`(${fx.mark} 本職ではありません)`}`);}};
 const takeBench=(id:string)=>{if(sel===null){setNote('先に、入れ替える打順の選手を押してください');return;}const out=o.lineup[sel];setO(benchIn(o,sel,id));setNote(`${playerMap[out].name}に代わって${playerMap[id].name}が${sel+1}番に入ります`);setSel(null);};
 const starter=starterOf(o,base),rotation=o.pitchers.slice(0,6);
 const reset=()=>{setO(usual);setSel(null);setPosFor(null);setNote('ふだんのオーダーに戻しました');};
 const start=()=>{if(why)return;onStart(changed?o:null,keep&&changed);};
 return <div className="lu-root" role="dialog" aria-modal="true" aria-label="スタメンを決める">
  <div className="lu-page">
   <header className="lu-head"><button className="pw-btn pw-white lu-back" onClick={onCancel}>戻る</button><div><h2>スタメンを決める</h2><p>{label} vs {rival}</p></div></header>
   <div className="lu-scroll">
    <div className="lu-keep" role="group" aria-label="このスタメンを使う範囲"><button className={keep?'':'is-on'} aria-pressed={!keep} onClick={()=>setKeep(false)}>この試合だけ</button><button className={keep?'is-on':''} aria-pressed={keep} onClick={()=>setKeep(true)}>ふだんのオーダーにも使う</button></div>
    <p className="ab-guide">{GRADE_GUIDE}</p>
    <h3 className="lu-band">打順と守備位置<small>押して選び、もう1人を押すと入れ替え</small></h3>
    <ol className="lu-order">{o.lineup.map((id,i)=>{const p=playerMap[id],r=rate(id),pos=o.defense[id],native=isNative(id,pos),f=form(id);
     return <li key={id} className={'lu-row'+(sel===i?' is-sel':'')}>
      <button className="lu-row-main" onClick={()=>tapRow(i)} aria-pressed={sel===i} aria-label={`${i+1}番 ${p.name}`}>
       <b className="lu-no">{i+1}</b>
       <span className="lu-body">
        <span className="lu-top"><span className="lu-name"><b>{p.name}</b><small>{p.bats==='左'?'左打':p.bats==='両'?'両打':'右打'} 打率 {avg(id)}{f&&<em className={f.c}>{f.t}</em>}</small></span><Fits id={id}/></span>
        <span className="lu-abs"><AbilityTag v={r.contact} label="ミート"/><AbilityTag v={r.power} label="パワー"/><AbilityTag v={r.speed} label="走力"/><AbilityTag v={fieldAt(id,pos)} label={pos&&pos!=='DH'?`守備(${pos})`:'守備'}/></span>
       </span>
      </button>
      <button className={'lu-pos'+(native?'':' is-bad')+' '+markClass(posFit(id,pos).mark)} onClick={()=>{setSel(null);setPosFor(posFor===i?null:i);}} aria-label={`${p.name}の守備位置 ${posName(pos)} ${posFit(id,pos).text}`}><PosChip pos={pos}/><b className="lu-posmark">{pos==='DH'?'':posFit(id,pos).mark}</b><small>{pos==='DH'?'指名打者':posFit(id,pos).main?'本職':'本職でない'}</small></button>
      {posFor===i&&<div className="lu-posbar" role="group" aria-label="守備位置を選ぶ">
       <PosBig id={id} pos={pos}/>
       {[...POSITIONS,...(dh?['DH']:[])].map(x=>{const fx=posFit(id,x);return <button key={x} className={(pos===x?'is-on ':'')+markClass(fx.mark)+(isNative(id,x)?'':' is-bad')} aria-label={`${posName(x)} ${fx.text}`} onClick={()=>pickPos(i,x)}><span className="lu-pb-top"><PosChip pos={x}/>{x!=='DH'&&<b>{fx.mark}</b>}</span><small>{x==='DH'?'指名打者':fx.main?'本職':fx.mark==='○'?'守れる':fx.mark==='△'?'苦手':'本職でない'}</small></button>;})}
      </div>}
     </li>;})}</ol>
    <p className="lu-legend">◎=本職 ○=守れる △=苦手 守備(位置)は、その位置で守った時の段です。本職でない位置は守備が下がります。</p>
    <h3 className="lu-band">先発投手<small>ローテーションの6人から</small></h3>
    <ul className="lu-pitchers">{rotation.map(id=>{const p=playerMap[id],r=rate(id),rest=restDays(base,usual,id),f=form(id),on=id===starter;
     const tired=rest!==null&&rest<4;
     return <li key={id}><button className={'lu-pit'+(on?' is-on':'')} aria-pressed={on} onClick={()=>{setO(chooseStarter(o,base,id));setNote(`先発は${p.name}`);}}>
      <span className="lu-body">
       <span className="lu-top"><span className="lu-name"><b>{p.name}</b><small>{throwHand(id)==='L'?'左投':'右投'} 防御率 {eraOf(id)}{f&&<em className={f.c}>{f.t}</em>}</small></span><Roles id={id}/></span>
       <span className="lu-abs is-p"><VelocityTag kmh={r.velocity} id={id}/><AbilityTag v={r.control} label="制球"/><AbilityTag v={r.stamina} label="スタミナ"/>{r.breaking>0&&<AbilityTag v={r.breaking} label="変化"/>}</span>
      </span>
      <span className={'lu-rest'+(tired?' is-tired':'')}>{rest===null?'未登板':`中${rest}日`}{tired&&<small>疲れ</small>}</span>
      {on&&<i className="lu-mark">先発</i>}
     </button></li>;})}</ul>
    <p className="lu-legend">今日の枠は{starterSlot(base)+1}番目の投手です。中○日=前の登板からの日数(ふだんのローテーションで数えます)。</p>
    <h3 className="lu-band">控え<small>{sel===null?'打順の選手を選ぶと入れ替えられます':`${sel+1}番 ${playerMap[o.lineup[sel]].name}と入れ替え`}</small></h3>
    {bench.length?<ul className="lu-bench">{bench.map(id=>{const p=playerMap[id],r=rate(id),pos=sel!==null?o.defense[o.lineup[sel]]:p.position,native=sel===null||isNative(id,pos);
     return <li key={id}><button className={'lu-row-main lu-benchrow'+(sel===null?' is-idle':'')} onClick={()=>takeBench(id)} aria-label={`控え ${p.name}を入れる`}>
      <PosChip pos={p.position==='投'?'DH':p.position}/>
      <span className="lu-body">
       <span className="lu-top"><span className="lu-name"><b>{p.name}</b><small>{p.bats==='左'?'左打':p.bats==='両'?'両打':'右打'} 打率 {avg(id)}{sel!==null&&<em className={native?'is-good':'is-bad'}>{posName(pos)}{native?'○':'は本職ではありません'}</em>}</small></span><Fits id={id}/></span>
       <span className="lu-abs"><AbilityTag v={r.contact} label="ミート"/><AbilityTag v={r.power} label="パワー"/><AbilityTag v={r.speed} label="走力"/><AbilityTag v={sel!==null?fieldAt(id,pos):r.field} label={sel!==null&&pos!=='DH'?`守備(${pos})`:'守備'}/></span>
      </span>
     </button></li>;})}</ul>:<p className="lu-legend">控えの野手がいません。</p>}
   </div>
   <footer className="lu-foot">
    <p className={'lu-note'+(why?' is-why':'')} role="status">{why||note||(changed?(keep?'このスタメンをふだんのオーダーにもします':'このスタメンはこの試合だけ'):'ふだんのオーダーのままです')}</p>
    <div className="lu-btns"><button className="pw-btn pw-white" disabled={!changed} onClick={reset}>おすすめ</button><button className="pw-btn pw-yellow lu-start" aria-disabled={!!why} disabled={!!why} onClick={start}>{changed?'このスタメンで始める':'このまま始める'}</button></div>
   </footer>
  </div>
 </div>;
}
