// スタメンを決める画面(2026-11-05)。「監督して戦う」を押した後、試合の前に出す。チームの「オーダー」の画面と同じ部品
// (守備位置の札 PosChip・能力の段・白い札)で、打順の並べ替え・守備位置・先発投手・控えとの入れ替えを決める。
// 決めなくても「このまま始める」で進める。「おすすめ」でふだんのオーダー(1年進める時の物)に戻す。
// 始めるボタンはいつも画面の下に見えている。始められない時は理由を一言出す。
// 11/5 昼(持ち主「スタメン野手は画面ひと枠に収まる感じにして」): ChatGPT の案(gpt_ui_1105/d9gpt1105_lineup_1・2)を元に、
// 「野手 / 投手 / 控え」のタブと、1人1行の詰めた表にした。表の上に見出しの1行(ミート パワー 走力 守備)、各行は段の1文字だけ。
// 行の右側(段と打率の所)を押すと、その行の下に詳しい能力(項目名と棒)と守れる位置(捕◎ 一○ 三△)が開く。
// 番号か名前を押すと選択(もう1人を押すと入れ替え)。守備位置の札を押すと位置を選べる。360x640 でも野手9人と始めるボタンが1画面に入る。
import {useMemo,useState} from 'react';
import {formatAvg,gradeColor,playerMap} from './data';
import {battingAverage,era,type GameState} from './engine';
import {gradeOf,liveRatings} from './watch';
import {PosChip} from './pawa/PawaCard';
import {AbilityTag,GRADE_GUIDE,VelocityTag} from './AbilityTag';
import {defenseAtPosition} from './position-defense';
import {benchIn,benchOf,chooseStarter,formOf,isNative,orderBlock,posFit,posFitLine,posName,roleFits,restDays,sameOrder,setPosition,starterOf,starterSlot,swapOrder,usesDH,usualOrder,type FitMark,type StartOrder} from './lineup';
import {throwHand} from './field-sim';
import {teamColorIn,rgb} from './team-colors';
import './lineup.css';

const POSITIONS=['捕','一','二','三','遊','外'];
const markClass=(m:FitMark)=>m==='◎'?'is-main':m==='○'?'is-ok':m==='△'?'is-weak':'is-no';
/** 守れる位置の一覧(「捕◎ 一○ 三△」)。 */
function Fits({id}:{id:string}){const f=posFitLine(id);return <span className="lu-fits" aria-label={'守れる位置 '+f.map(x=>posName(x.pos)+(x.main?'(本職)':x.mark==='△'?'(苦手)':'')).join('、')}>{f.map(x=><i key={x.pos} className={markClass(x.mark)}>{x.pos}{x.mark}</i>)}</span>;}
/** 投手の役割の適性と利き腕(「右投 先◎ 中○ 抑×」)。 */
function Roles({id}:{id:string}){const r=roleFits(id);return <span className="lu-fits is-roles" aria-label={'適性 '+r.map(x=>x.name+x.mark).join('、')}>{r.map(x=><i key={x.role} className={markClass(x.mark)}>{x.name}{x.mark}</i>)}</span>;}
/** 段の1文字の四角(色は試合の画面と同じ)。項目名は表の見出しの1行にある。 */
function G({v,label}:{v:number;label:string}){const g=gradeOf(v);return <i className="lu-g" style={{background:gradeColor(Math.min(99,v))}} aria-label={`${label} ${g}`}>{g}</i>;}
const handName=(b:string|null|undefined)=>b==='左'?'左打':b==='両'?'両打':'右打';
/** 色の上に載せる文字の色(暗い色なら白)。 */
const inkOn=(hex:string)=>{const [r,g,b]=rgb(hex);return .299*r+.587*g+.114*b<150?'#fff':'#14213d';};
export type LineupTab='bat'|'pit'|'bench';
export function StartingLineup({base,label,rival,rivalId,onStart,onCancel,tab:firstTab='bat'}:{base:GameState;label:string;rival:string;rivalId?:string;onStart:(o:StartOrder|null,keep:boolean)=>void;onCancel:()=>void;tab?:LineupTab}){
 const usual=useMemo(()=>usualOrder(base),[base]);
 const [o,setO]=useState<StartOrder>(usual),[keep,setKeep]=useState(false),[sel,setSel]=useState<number|null>(null),[posFor,setPosFor]=useState<number|null>(null),[note,setNote]=useState('');
 const [tab,setTab]=useState<LineupTab>(firstTab),[open,setOpen]=useState<number|null>(null);
 const club=base.club,season=base.season;
 const mine=teamColorIn(base,club).main,rivalColor=rivalId?teamColorIn(base,rivalId).main:null;
 const rate=(id:string)=>liveRatings(base,club,id,o.pitchers);
 /** その位置で守った時の守備(試合の計算と同じ defenseAtPosition。本職でなければ下がる)。 */
 const fieldAt=(id:string,pos:string)=>{const p=playerMap[id];return !p||!pos||pos==='DH'?rate(id).field:defenseAtPosition(p,pos,rate(id)).field;};
 /** 選んだ位置の適性を大きく出す。 */
 const PosBig=({id,pos}:{id:string;pos:string})=>{const fx=posFit(id,pos);return <div className={'lu-posbig '+markClass(fx.mark)} role="status"><span className="lu-pbm">{pos==='DH'?'指':fx.mark}</span><span><b>{playerMap[id].name}・{posName(pos)}</b><em>{pos==='DH'?'打つだけ(守らない)':fx.main?'本職です':fx.text}</em></span>{pos!=='DH'&&<AbilityTag v={fieldAt(id,pos)} label={`守備(${pos})`}/>}</div>;};
 const why=orderBlock(base,o),changed=!sameOrder(o,usual),dh=usesDH(base);
 const bench=benchOf(base,o).sort((a,b)=>(playerMap[a].name<playerMap[b].name?-1:1));
 // 11/6 持ち主「スタメンを決める際、打率・本塁打・打点も見れるように」: 今季の成績。今季まだ打席が無ければ前の年(灰色):
 // このチームの昨季、それも無ければ選手の実際の前の年の成績(カードの記録)。どれも無ければ「―」。
 const last=base.history?.[0];
 type BatL={avg:string;hr:number;rbi:number;prev:boolean};type PitL={era:string;w:number;l:number;sv:number;prev:boolean};
 const batRow=(id:string):BatL|null=>{
  const now=season.batting[`${club}|${id}`];if(now&&now.pa)return {avg:now.ab?formatAvg(battingAverage(now)):'―',hr:now.hr,rbi:now.rbi,prev:false};
  const old=last?.batting?.[`${club}|${id}`];if(old&&old.pa)return {avg:old.ab?formatAvg(battingAverage(old)):'―',hr:old.hr,rbi:old.rbi,prev:true};
  const rec=playerMap[id]?.batting;return rec&&rec.pa?{avg:rec.ab?formatAvg(rec.hits/rec.ab):'―',hr:rec.hr,rbi:rec.rbi,prev:true}:null;};
 const pitRow=(id:string):PitL|null=>{
  const now=season.pitching[`${club}|${id}`];if(now&&now.bf)return {era:now.outs?era(now).toFixed(2):'―',w:now.wins,l:now.losses,sv:now.saves,prev:false};
  const old=last?.pitching?.[`${club}|${id}`];if(old&&old.bf)return {era:old.outs?era(old).toFixed(2):'―',w:old.wins,l:old.losses,sv:old.saves,prev:true};
  const rec=playerMap[id]?.pitching;return rec&&rec.bf?{era:rec.outs?(rec.er*27/rec.outs).toFixed(2):'―',w:rec.wins,l:rec.losses,sv:rec.saves,prev:true}:null;};
 const avg=(id:string)=>batRow(id)?.avg??'―';
 /** 打率・本塁打・打点(2段)。 */
 const BatLine=({id}:{id:string})=>{const r=batRow(id);return <span className={'lu-stat'+(r?.prev?' is-prev':'')} aria-label={r?`${r.prev?'前の年 ':''}打率${r.avg} ${r.hr}本塁打 ${r.rbi}打点`:'成績なし'}><b>{r?.avg??'―'}</b><small>{r?`${r.hr}本${r.rbi}点`:'―'}</small></span>;};
 /** 防御率・勝敗・セーブ。 */
 const pitLine=(id:string)=>{const r=pitRow(id);return r?`防御率${r.era} ${r.w}勝${r.l}敗${r.sv?` ${r.sv}S`:''}${r.prev?'(前年)':''}`:'成績なし';};
 const form=(id:string)=>{const f=formOf(base,id);return f>=5?{t:'絶好調',c:'is-hot'}:f>0?{t:'好調',c:'is-good'}:f<0?{t:'不調',c:'is-bad'}:null;};
 const tapRow=(i:number)=>{setPosFor(null);
  if(sel===null){setSel(i);setNote(`${i+1}番 ${playerMap[o.lineup[i]].name}を選びました。入れ替える打順か、控えのタブの選手を押してください`);return;}
  if(sel===i){setSel(null);setNote('');return;}
  setO(swapOrder(o,sel,i));setNote(`${sel+1}番と${i+1}番を入れ替えました`);setSel(null);
 };
 const pickPos=(i:number,pos:string)=>{const id=o.lineup[i];setO(setPosition(o,id,pos));setPosFor(null);{const fx=posFit(id,pos);setNote(`${playerMap[id].name}を${posName(pos)}に${pos==='DH'?'':fx.main?'(本職)':`(${fx.mark} 本職ではありません)`}`);}};
 const takeBench=(id:string)=>{if(sel===null){setNote('先に、野手のタブで入れ替える打順の選手を押してください');return;}const out=o.lineup[sel];setO(benchIn(o,sel,id));setNote(`${playerMap[out].name}に代わって${playerMap[id].name}が${sel+1}番に入ります`);setSel(null);setTab('bat');};
 const starter=starterOf(o,base),rotation=o.pitchers.slice(0,6);
 const relief=o.pitchers.slice(6).map((id,i)=>({id,role:i+6===13?'抑え':i+6===12?'セット':'中継ぎ'})).filter(x=>playerMap[x.id]);
 const reset=()=>{setO(usual);setSel(null);setPosFor(null);setOpen(null);setNote('ふだんのオーダーに戻しました');};
 const start=()=>{if(why)return;onStart(changed?o:null,keep&&changed);};
 const tabs:[LineupTab,string][]=[['bat','野手'],['pit','投手'],['bench','控え']];
 return <div className="lu-root" role="dialog" aria-modal="true" aria-label="スタメンを決める">
  <div className="lu-page">
   <header className="lu-head" style={{background:mine,color:inkOn(mine)}}><button className="pw-btn pw-white lu-back" onClick={onCancel}>戻る</button><div><h2>スタメンを決める</h2><p>{label} vs <span className="lu-rival" style={rivalColor?{background:rivalColor,color:inkOn(rivalColor)}:undefined}>{rival}</span></p></div></header>
   <div className="lu-ctl">
    <div className="lu-keep" role="group" aria-label="このスタメンを使う範囲"><button className={keep?'':'is-on'} aria-pressed={!keep} onClick={()=>setKeep(false)}>この試合だけ</button><button className={keep?'is-on':''} aria-pressed={keep} onClick={()=>setKeep(true)}>ふだんのオーダーにも使う</button></div>
    <div className="lu-tabs" role="tablist" aria-label="野手・投手・控え">{tabs.map(([k,t])=><button key={k} role="tab" aria-selected={tab===k} className={tab===k?'is-on':''} onClick={()=>{setTab(k);setPosFor(null);}}>{t}{k==='bench'&&sel!==null&&<small>入れ替え</small>}</button>)}</div>
   </div>
   <div className="lu-scroll">
    <section className="lu-sec" hidden={tab!=='bat'} aria-label="打順と守備位置">
     <h3 className="lu-band">打順と守備位置<small>{sel===null?'番号か名前を押して選び、もう1人を押すと入れ替え':`${sel+1}番を選択中。入れ替える相手を押す`}</small></h3>
     <div className="lu-thead" aria-hidden="true"><span>打順</span><span>選手名</span><span>守</span><span className="lu-th-g">ミート</span><span className="lu-th-g">パワー</span><span className="lu-th-g">走力</span><span className="lu-th-g">守備</span><span className="lu-th-st">打率<br/>本 点</span></div>
     <ol className="lu-order">{o.lineup.map((id,i)=>{const p=playerMap[id],r=rate(id),pos=o.defense[id],native=isNative(id,pos),f=form(id),fx=posFit(id,pos),op=open===i;
      return <li key={id} className={'lu-row'+(sel===i?' is-sel':'')+(op?' is-open':'')}>
       <button className="lu-no" onClick={()=>tapRow(i)} aria-pressed={sel===i} aria-label={`${i+1}番 ${p.name}を選ぶ`}>{i+1}</button>
       <button className="lu-name" tabIndex={-1} onClick={()=>tapRow(i)} aria-hidden="true"><b>{p.name}</b><small>{handName(p.bats)}{f&&<em className={f.c}>{f.t}</em>}</small></button>
       <button className={'lu-pos'+(native?'':' is-bad')+' '+markClass(fx.mark)} onClick={()=>{setSel(null);setPosFor(posFor===i?null:i);}} aria-label={`${p.name}の守備位置 ${posName(pos)} ${fx.text}`}><PosChip pos={pos}/>{pos!=='DH'&&!fx.main&&<b className="lu-posmark">{fx.mark}</b>}</button>
       <button className="lu-open" onClick={()=>setOpen(op?null:i)} aria-expanded={op} aria-label={`${p.name}の詳しい能力と守れる位置を${op?'閉じる':'開く'}`}>
        <G v={r.contact} label="ミート"/><G v={r.power} label="パワー"/><G v={r.speed} label="走力"/><G v={fieldAt(id,pos)} label="守備"/><BatLine id={id}/><span className="lu-chev" aria-hidden="true">{op?'∧':'∨'}</span>
       </button>
       {posFor===i&&<div className="lu-posbar" role="group" aria-label="守備位置を選ぶ">
        <PosBig id={id} pos={pos}/>
        {[...POSITIONS,...(dh?['DH']:[])].map(x=>{const fx=posFit(id,x);return <button key={x} className={(pos===x?'is-on ':'')+markClass(fx.mark)+(isNative(id,x)?'':' is-bad')} aria-label={`${posName(x)} ${fx.text}`} onClick={()=>pickPos(i,x)}><span className="lu-pb-top"><PosChip pos={x}/>{x!=='DH'&&<b>{fx.mark}</b>}</span><small>{x==='DH'?'指名打者':fx.main?'本職':fx.mark==='○'?'守れる':fx.mark==='△'?'苦手':'本職でない'}</small></button>;})}
       </div>}
       <div className="lu-detail" hidden={!op}>
        <div className="lu-abs"><AbilityTag v={r.contact} label="ミート"/><AbilityTag v={r.power} label="パワー"/><AbilityTag v={r.speed} label="走力"/><AbilityTag v={fieldAt(id,pos)} label={pos&&pos!=='DH'?`守備(${pos})`:'守備'}/></div>
        <div className="lu-dfit"><small>守れる位置</small><Fits id={id}/><small className="lu-dnote">{pos==='DH'?'指名打者':fx.main?'本職':native?'守れる':'本職でない'}・{handName(p.bats)}・打率 {avg(id)}</small></div>
        <p className="ab-guide">{GRADE_GUIDE}</p>
       </div>
      </li>;})}</ol>
    </section>
    <section className="lu-sec" hidden={tab!=='pit'} aria-label="先発投手">
     <h3 className="lu-band">先発投手(先発)<small>ローテーションの6人から。今日の枠は{starterSlot(base)+1}番目</small></h3>
     <ul className="lu-pitchers">{rotation.map(id=>{const p=playerMap[id],r=rate(id),rest=restDays(base,usual,id),f=form(id),on=id===starter;
      const tired=rest!==null&&rest<4;
      return <li key={id}><button className={'lu-pit'+(on?' is-on':'')} aria-pressed={on} onClick={()=>{setO(chooseStarter(o,base,id));setNote(`先発は${p.name}`);}}>
       <span className="lu-body">
        <span className="lu-top"><span className="lu-pname"><b>{p.name}</b><small>{throwHand(id)==='L'?'左投':'右投'} {pitLine(id)}{f&&<em className={f.c}>{f.t}</em>}</small></span><Roles id={id}/></span>
        <span className="lu-abs is-p"><VelocityTag kmh={r.velocity} id={id}/><AbilityTag v={r.control} label="制球"/><AbilityTag v={r.stamina} label="スタミナ"/>{r.breaking>0&&<AbilityTag v={r.breaking} label="変化"/>}</span>
       </span>
       <span className={'lu-rest'+(tired?' is-tired':'')}>{rest===null?'未登板':`中${rest}日`}{tired&&<small>疲れ</small>}</span>
       {on&&<i className="lu-mark">先発</i>}
      </button></li>;})}</ul>
     <p className="lu-legend">中○日=前の登板からの日数(ふだんのローテーションで数えます)。成績は今季(今季まだ無い時は前の年)。</p>
     {relief.length>0&&<><h3 className="lu-band">救援<small>中継ぎ・セットアッパー・抑え(試合中に交代できます)</small></h3>
     <ul className="lu-pitchers">{relief.map(({id,role})=>{const p=playerMap[id],r=rate(id),f=form(id);
      return <li key={id}><div className="lu-pit is-relief">
       <span className="lu-body">
        <span className="lu-top"><span className="lu-pname"><b>{p.name}</b><small>{throwHand(id)==='L'?'左投':'右投'} {pitLine(id)}{f&&<em className={f.c}>{f.t}</em>}</small></span><Roles id={id}/></span>
        <span className="lu-abs is-p"><VelocityTag kmh={r.velocity} id={id}/><AbilityTag v={r.control} label="制球"/><AbilityTag v={r.stamina} label="スタミナ"/>{r.breaking>0&&<AbilityTag v={r.breaking} label="変化"/>}</span>
       </span>
       <span className="lu-rest is-role">{role}</span>
      </div></li>;})}</ul></>}
    </section>
    <section className="lu-sec" hidden={tab!=='bench'} aria-label="控え">
     <h3 className="lu-band">控え<small>{sel===null?'野手のタブで打順の選手を選ぶと入れ替えられます':`${sel+1}番 ${playerMap[o.lineup[sel]].name}と入れ替え`}</small></h3>
     {bench.length?<ul className="lu-bench">{bench.map(id=>{const p=playerMap[id],r=rate(id),pos=sel!==null?o.defense[o.lineup[sel]]:p.position,native=sel===null||isNative(id,pos);
      return <li key={id}><button className={'lu-benchrow'+(sel===null?' is-idle':'')} onClick={()=>takeBench(id)} aria-label={`控え ${p.name}を入れる`}>
       <PosChip pos={p.position==='投'?'DH':p.position}/>
       <span className="lu-body">
        <span className="lu-top"><span className="lu-pname"><b>{p.name}</b><small>{handName(p.bats)} 打率{avg(id)}{(r2=>r2?` ${r2.hr}本 ${r2.rbi}点${r2.prev?'(前年)':''}`:'')(batRow(id))}{sel!==null&&<em className={native?'is-good':'is-bad'}>{posName(pos)}{native?'○':'は本職ではありません'}</em>}</small></span><Fits id={id}/></span>
        <span className="lu-abs"><AbilityTag v={r.contact} label="ミート"/><AbilityTag v={r.power} label="パワー"/><AbilityTag v={r.speed} label="走力"/><AbilityTag v={sel!==null?fieldAt(id,pos):r.field} label={sel!==null&&pos!=='DH'?`守備(${pos})`:'守備'}/></span>
       </span>
      </button></li>;})}</ul>:<p className="lu-legend">控えの野手がいません。</p>}
    </section>
   </div>
   <footer className="lu-foot">
    <p className={'lu-note'+(why?' is-why':'')} role="status">{why||note||(changed?(keep?'このスタメンをふだんのオーダーにもします':'このスタメンはこの試合だけ'):'ふだんのオーダーのままです')}</p>
    <div className="lu-btns"><button className="pw-btn pw-white" disabled={!changed} onClick={reset}>おすすめ</button><button className="pw-btn pw-yellow lu-start" aria-disabled={!!why} disabled={!!why} onClick={start}>{changed?'このスタメンで始める':'このまま始める'}</button></div>
   </footer>
  </div>
 </div>;
}
