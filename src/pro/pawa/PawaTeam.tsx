import {useEffect,useMemo,useRef,useState,type PointerEvent as RPointerEvent} from 'react';
import {AlertTriangle,BookOpen,ChevronRight,GripVertical,Search,Shuffle,X} from 'lucide-react';
import {fitsPosition,playerMap,teamById,type Player} from '../data';
import {effectiveOverall,type GameState} from '../engine';
import {buildByStrategy} from '../franchise';
import {reorderSimplePlayer,replacementPool,replaceSimplePlayer,swapDefense} from '../simple-game';
import {ownedRatings,playerAge} from '../development';
import {pitcherRolePenalty,pitcherSlotRole,pitchingRatingsForRole,type PitcherRole} from '../pitcher-aptitude';
import {OvrShield,PosChip,Rank,RoleChip} from './PawaCard';

type Kind='bat'|'pit';
type Slot={kind:Kind;index:number};
type Drag={from:'slot'|'bench';kind:Kind;index:number;id:string};
const slotName=(kind:Kind,i:number)=>kind==='bat'?`${i+1}番`:i<6?`先発${i+1}`:i===13?'抑え':`中継ぎ${i-5}`;

/** 適性の記号: 公開の評価(◎○△)があればそれ、無ければ起用時の補正から(0→○, 5→△, 12→×) */
export function aptitudeMark(p:Player,role:PitcherRole):string{
 const fit=p.wikiAssessment?.pitcherRoles?.[role];
 if(fit==='◎'||fit==='○'||fit==='△')return fit;
 const penalty=pitcherRolePenalty(p,role);
 return penalty===0?'○':penalty===5?'△':'×';
}
export function AptMark({mark}:{mark:string}){
 const label=mark==='◎'?'最も適した役割':mark==='○'?'適した役割':mark==='△'?'やや不向き':'不向き';
 return mark==='×'?<i className="pw-apt pw-apt-none" aria-label={label}>×</i>:<i className="pw-apt" data-apt={mark} aria-label={label}>{mark}</i>;
}

export function PawaTeam({state,onChange,onPlayer,onImpact,onReset,onRestore,onCompleteReset,onCatalog,canRestore=false,onSeason}:{state:GameState;onChange:(s:GameState)=>void;onPlayer:(p:Player)=>void;onImpact:()=>void;onReset?:()=>void;onRestore?:()=>void;onCompleteReset?:()=>void;onCatalog?:()=>void;canRestore?:boolean;onSeason?:()=>void}){
 const [tab,setTab]=useState<'bat'|'先'|'中'|'抑'|'bench'>('bat'),[hand,setHand]=useState<string|null>(null),[picked,setPicked]=useState<Slot|null>(null),[defender,setDefender]=useState<string|null>(null),[notice,setNotice]=useState(''),[search,setSearch]=useState('');
 const [drag,setDrag]=useState<Drag|null>(null),[over,setOver]=useState(''),[ghost,setGhost]=useState<{x:number;y:number;name:string}|null>(null);
 const pointer=useRef<{d:Drag;x:number;y:number;lastX:number;lastY:number;moved:boolean;touch:boolean;timer:number;el:HTMLElement;id:number}|null>(null),scroller=useRef(0),justDragged=useRef(false);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3200);return()=>clearTimeout(t);},[notice]);
 // While a finger drag is live, the page must not pan under it.
 useEffect(()=>{const block=(e:TouchEvent)=>{if(pointer.current?.moved&&e.cancelable)e.preventDefault();};document.addEventListener('touchmove',block,{passive:false});return()=>{document.removeEventListener('touchmove',block);cancelAnimationFrame(scroller.current);};},[]);
 const ovr=(id:string)=>effectiveOverall(playerMap[id],state.owned,state.training);
 const ratingsOf=(id:string)=>ownedRatings(playerMap[id],state.owned,state.training);
 const roster=new Set([...state.lineup,...state.pitchers]);
 const benchAll=Object.keys(state.owned).map(id=>playerMap[id]).filter(p=>p&&!roster.has(p.id)).sort((a,b)=>ovr(b.id)-ovr(a.id));
 const commit=(next:GameState,message:string)=>{if(next===state)return false;onChange(next);onImpact();setNotice(message);return true;};
 const clear=()=>{setHand(null);setPicked(null);setDefender(null);};
 const replace=(slot:Slot,id:string)=>{
  if(!commit(replaceSimplePlayer(state,slot.kind,slot.index,id),`${playerMap[id].name}を${slotName(slot.kind,slot.index)}に起用しました。`))setNotice(slot.kind==='bat'?'この打順の守備位置を守れない選手です。守備位置に合う枠へ入れてください。':'投手の枠には投手だけを起用できます。');
  clear();
 };
 const auto=()=>{const next=buildByStrategy(state,'balanced');if(next===state)setNotice('適性のある投手が不足しています。先発6人・中継ぎ7人・抑え1人を揃えてください。');else commit(next,'おまかせ編成しました。役割と守備位置に合う選手だけで組んでいます。');clear();};
 const drop=(d:Drag,slot:Slot)=>{
  if(d.from==='bench')return replace(slot,d.id);
  if(d.kind!==slot.kind){setNotice('野手と投手は入れ替えられません。');return;}
  if(d.index===slot.index)return;
  commit(reorderSimplePlayer(state,slot.kind,d.index,slot.index),slot.kind==='bat'?'打順を変更しました。':'投手の順番を変更しました。');clear();
 };
 // ---- drag & drop (mouse: drag at once / touch: hold briefly, then drag) ----
 const targetAt=(x:number,y:number)=>{const el=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-slot-kind]');return el?{kind:el.dataset.slotKind as Kind,index:Number(el.dataset.slotIndex)}:null;};
 const edge=()=>{const p=pointer.current;if(!p?.moved){scroller.current=0;return;}const top=110,bottom=innerHeight-150;const v=p.lastY<top?-Math.min(20,4+(top-p.lastY)/5):p.lastY>bottom?Math.min(20,4+(p.lastY-bottom)/5):0;if(v){scrollBy(0,v);const t=targetAt(p.lastX,p.lastY);setOver(t?`${t.kind}-${t.index}`:'');}scroller.current=requestAnimationFrame(edge);};
 const begin=(p:NonNullable<typeof pointer.current>)=>{p.moved=true;try{p.el.setPointerCapture(p.id);}catch{}setDrag(p.d);setGhost({x:p.lastX,y:p.lastY,name:playerMap[p.d.id].name});clear();if(!scroller.current)scroller.current=requestAnimationFrame(edge);};
 const end=()=>{const p=pointer.current;if(p)clearTimeout(p.timer);pointer.current=null;cancelAnimationFrame(scroller.current);scroller.current=0;setDrag(null);setOver('');setGhost(null);};
 const dragProps=(d:Drag)=>({
  onPointerDown:(e:RPointerEvent<HTMLElement>)=>{if(e.button!==0)return;if((e.target as HTMLElement).closest('button:not(.pw-handle),input,select'))return;
   const touch=e.pointerType!=='mouse',el=e.currentTarget,id=e.pointerId;
   const p={d,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,touch,el,id,timer:0};
   if(touch)p.timer=window.setTimeout(()=>{if(pointer.current!==p)return;try{el.setPointerCapture(id);}catch{}navigator.vibrate?.(12);begin(p);},230);
   pointer.current=p;},
  onPointerMove:(e:RPointerEvent<HTMLElement>)=>{const p=pointer.current;if(!p)return;p.lastX=e.clientX;p.lastY=e.clientY;
   if(!p.moved){if(Math.hypot(e.clientX-p.x,e.clientY-p.y)<8)return;if(p.touch){clearTimeout(p.timer);pointer.current=null;return;}begin(p);}
   setGhost({x:e.clientX,y:e.clientY,name:playerMap[p.d.id].name});const t=targetAt(e.clientX,e.clientY);setOver(t?`${t.kind}-${t.index}`:'');},
  onPointerUp:(e:RPointerEvent<HTMLElement>)=>{const p=pointer.current;try{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}catch{}
   if(p?.moved){justDragged.current=true;setTimeout(()=>{justDragged.current=false;},0);const t=targetAt(e.clientX,e.clientY);if(t)drop(p.d,t);}end();},
  onPointerCancel:()=>end(),
  onContextMenu:(e:{preventDefault:()=>void})=>{if(pointer.current)e.preventDefault();},
 });
 // tap fallback: tap the number, then tap another number to swap the order
 const tapOrder=(slot:Slot)=>{if(justDragged.current)return;const id=(slot.kind==='bat'?state.lineup:state.pitchers)[slot.index];
  if(hand){replace(slot,hand);return;}
  if(picked&&picked.kind===slot.kind&&picked.index!==slot.index){drop({from:'slot',kind:slot.kind,index:picked.index,id:(slot.kind==='bat'?state.lineup:state.pitchers)[picked.index]},slot);return;}
  setDefender(null);setPicked(picked&&picked.kind===slot.kind&&picked.index===slot.index?null:slot);void id;};
 const tapDefense=(id:string)=>{if(defender&&defender!==id){commit(swapDefense(state,defender,id),'守備位置を交換しました。');setDefender(null);}else{setPicked(null);setDefender(defender===id?null:id);}};

 const misplaced=state.lineup.filter(id=>!fitsPosition(playerMap[id],state.defense[id]));
 const unfit=state.pitchers.filter((id,i)=>pitcherRolePenalty(playerMap[id],pitcherSlotRole(i))>0);
 const benchBat=benchAll.filter(p=>p.role!=='pitcher'||p.mlb?.twoWay),benchPit=benchAll.filter(p=>p.role==='pitcher');
 const pool=useMemo(()=>{const list=tab==='bench'?benchAll:tab==='bat'?benchBat:benchPit;return list.filter(p=>!search||p.name.includes(search));},[tab,search,state]);
 const handSlots=hand?new Set([...state.lineup.map((_,i)=>`bat-${i}`),...state.pitchers.map((_,i)=>`pit-${i}`)].filter(k=>{const [kind,i]=k.split('-');return replacementPool(state,kind as Kind,Number(i)).some(p=>p.id===hand);})):null;

 const batRow=(id:string,i:number)=>{
  const p=playerMap[id],age=playerAge(p),pos=state.defense[id],fit=fitsPosition(p,pos),r=ratingsOf(id),key=`bat-${i}`;
  const cls='pw-row'+(fit?'':' is-unfit')+(over===key?' is-over':'')+(drag?.from==='slot'&&drag.kind==='bat'&&drag.index===i?' is-dragging':'')+(picked?.kind==='bat'&&picked.index===i?' is-picked':'')+(handSlots?.has(key)?' can-take':'');
  return <li key={id} className={cls} data-slot-kind="bat" data-slot-index={i} {...dragProps({from:'slot',kind:'bat',index:i,id})}>
   <button className="pw-handle pw-order" aria-label={`${p.name}の打順 ${i+1}番(ドラッグで移動、タップで交換)`} aria-pressed={picked?.kind==='bat'&&picked.index===i} onClick={()=>tapOrder({kind:'bat',index:i})}>{i+1}</button>
   <button className={'pw-posbtn'+(defender===id?' is-picked':'')} aria-label={`${p.name}の守備位置 ${pos}(タップで交換)`} aria-pressed={defender===id} onClick={()=>tapDefense(id)}><PosChip pos={pos}/></button>
   <div className="pw-name"><button data-player-id={id} onClick={()=>onPlayer(p)}>{p.name}</button><small>{age===null?'':`${age}歳`}{!fit&&<em> 適性外</em>}</small></div>
   <OvrShield value={ovr(id)} size="s"/>
   <div className="pw-ranks">{([['ミート',r.contact],['パワー',r.power],['走力',r.speed],['肩',r.arm],['守備',r.field]] as const).map(([l,v])=><Rank key={l} value={v} label={l}/>)}</div>
   <GripVertical className="pw-grip" size={16} aria-hidden="true"/>
  </li>;
 };
 const pitRow=(id:string,i:number)=>{
  const p=playerMap[id],role=pitcherSlotRole(i),fit=pitcherRolePenalty(p,role)===0,r=pitchingRatingsForRole(p,ratingsOf(id),role),key=`pit-${i}`;
  const cls='pw-row pw-prow'+(fit?'':' is-unfit')+(over===key?' is-over':'')+(drag?.from==='slot'&&drag.kind==='pit'&&drag.index===i?' is-dragging':'')+(picked?.kind==='pit'&&picked.index===i?' is-picked':'')+(handSlots?.has(key)?' can-take':'');
  return <li key={id} className={cls} data-slot-kind="pit" data-slot-index={i} {...dragProps({from:'slot',kind:'pit',index:i,id})}>
   <button className="pw-handle pw-order pw-order-role" aria-label={`${p.name} ${slotName('pit',i)}(ドラッグで移動、タップで交換)`} onClick={()=>tapOrder({kind:'pit',index:i})}><RoleChip role={role}/><small>{role==='先'?i+1:role==='中'?i-5:''}</small></button>
   <div className="pw-name"><button data-player-id={id} onClick={()=>onPlayer(p)}>{p.name}</button><small>{p.ratings.velocity}km/h{!fit&&<em> 役割適性外</em>}</small></div>
   <OvrShield value={ovr(id)} size="s"/>
   <div className="pw-ranks pw-ranks-3">{([['制球',r.control],['スタミナ',r.stamina],['変化',r.breaking]] as const).map(([l,v])=><Rank key={l} value={v} label={l}/>)}</div>
   <div className="pw-apts">{(['先','中','抑'] as const).map(x=><AptMark key={x} mark={aptitudeMark(p,x)}/>)}</div>
  </li>;
 };
 const benchRow=(p:Player)=>{const pitcher=p.role==='pitcher',r=ratingsOf(p.id);
  return <li key={p.id} className={'pw-row pw-bench-row'+(hand===p.id?' is-picked':'')} {...dragProps({from:'bench',kind:pitcher?'pit':'bat',index:-1,id:p.id})}>
   <span className="pw-handle pw-bench-grip" aria-hidden="true"><GripVertical size={16}/></span>
   <div className="pw-name"><button onClick={()=>onPlayer(p)}>{p.name}</button><small>{teamById(p.team).short} · {pitcher?`${p.ratings.velocity}km/h`:p.positions.join('/')||'DH'}</small></div>
   {pitcher?<RoleChip role={aptitudeMark(p,'先')==='◎'||aptitudeMark(p,'先')==='○'?'先':aptitudeMark(p,'抑')==='◎'?'抑':'中'}/>:<PosChip pos={p.positions[0]??'DH'}/>}
   <OvrShield value={ovr(p.id)} size="s"/>
   <div className="pw-ranks pw-ranks-3">{(pitcher?[['制球',r.control],['スタミナ',r.stamina],['変化',r.breaking]] as const:[['ミート',r.contact],['パワー',r.power],['守備',r.field]] as const).map(([l,v])=><Rank key={l} value={v} label={l}/>)}</div>
   <button className="pw-btn pw-blue pw-mini" onClick={()=>{setPicked(null);setDefender(null);setHand(hand===p.id?null:p.id);if(tab==='bench'||tab==='bat'&&pitcher||tab!=='bat'&&!pitcher)setTab(pitcher?'先':'bat');}}>{hand===p.id?'選択中':'編成する'}</button>
  </li>;};
 const pitchGroup=(role:'先'|'中'|'抑')=>{const [from,to]=role==='先'?[0,6]:role==='中'?[6,13]:[13,14];return <ol className="pw-rows">{state.pitchers.slice(from,to).map((id,k)=>pitRow(id,from+k))}</ol>;};
 const bench=tab==='bat'?benchBat:tab==='bench'?benchAll:benchPit;

 return <div className="pw-team">
  <section className="pw-panel pw-team-head">
   <header><h2>{tab==='bat'?'スターティングメンバー':tab==='bench'?'控え選手':'投手陣'}</h2>
    {tab==='bat'&&misplaced.length>0&&<span className="pw-warn-pill"><AlertTriangle size={15}/>守備適性外 {misplaced.length}人</span>}
    {tab!=='bat'&&tab!=='bench'&&unfit.length>0&&<span className="pw-warn-pill"><AlertTriangle size={15}/>役割適性外 {unfit.length}人</span>}
   </header>
   <div className="pw-team-actions"><button className="pw-btn pw-blue" onClick={auto}><Shuffle size={18}/>おまかせ編成</button>{onSeason&&<button className="pw-btn pw-yellow" onClick={onSeason}>試合へ進む<ChevronRight size={18}/></button>}</div>
   <div className="pw-tabs" role="tablist" aria-label="編成する選手">{([['bat','野手 9'],['先','先発 6'],['中','中継ぎ 7'],['抑','抑え 1'],['bench',`控え ${benchAll.length}`]] as const).map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'is-on':''} onClick={()=>{setTab(id);setPicked(null);setDefender(null);}}>{label}</button>)}</div>
  </section>

  {(hand||picked||defender)&&<div className="pw-hint" role="status"><span>{hand?`${playerMap[hand].name}を入れる枠をタップ(光っている枠に入れられます)`:picked?`入れ替える相手の番号をタップ`:`${state.defense[defender!]}(${playerMap[defender!].name})と交換する守備位置をタップ`}</span><button aria-label="選択を解除" onClick={clear}><X size={18}/></button></div>}

  {tab==='bat'&&<section className="pw-panel pw-lineup">
   {misplaced.length>0&&<p className="pw-warn"><AlertTriangle size={18}/><b>守備適性外 {misplaced.length}人</b><span>被安打・失策が増え、失点しやすくなります。{misplaced.some(id=>state.defense[id]==='捕')&&'捕手の適性外は盗塁も許しやすくなります。'}</span></p>}
   <div className="pw-thead" aria-hidden="true"><span>打順</span><span>守備</span><span>選手名</span><span>OVR</span><span className="pw-thead-ranks"><i>ミ</i><i>パ</i><i>走</i><i>肩</i><i>守</i></span></div>
   <ol className="pw-rows">{state.lineup.map((id,i)=>batRow(id,i))}</ol>
   <p className="pw-tip">番号を長押ししてドラッグで打順を入れ替え。番号どうしのタップでも交換できます。守備位置は2つタップで交換。</p>
  </section>}
  {tab!=='bat'&&tab!=='bench'&&<section className="pw-panel pw-lineup">
   {unfit.length>0&&<p className="pw-warn"><AlertTriangle size={18}/><b>投手の役割適性不足 {unfit.length}人</b><span>制球・変化球が低下し、四死球や失点が増えやすくなります。</span></p>}
   <div className="pw-thead pw-thead-p" aria-hidden="true"><span>役割</span><span>選手名</span><span>OVR</span><span className="pw-thead-ranks pw-thead-3"><i>制</i><i>ス</i><i>変</i></span><span className="pw-thead-apts"><i>先</i><i>中</i><i>抑</i></span></div>
   {pitchGroup(tab)}
   <p className="pw-tip">ドラッグで先発・中継ぎ・抑えの間も移動できます(ほかのタブの枠へは、番号のタップで交換)。</p>
   <div className="pw-legend"><span><AptMark mark="◎"/>最も適した役割</span><span><AptMark mark="○"/>適した役割</span><span><AptMark mark="△"/>やや不向き</span><span><AptMark mark="×"/>不向き</span></div>
  </section>}

  <section className="pw-panel pw-bench">
   <header><h2>{tab==='bat'?'ベンチメンバー(野手)':tab==='bench'?'控え選手':'控え投手'}</h2><span>{bench.length}人</span></header>
   <label className="pw-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="選手名で検索" aria-label="控えを選手名で検索"/></label>
   {pool.length?<ul className="pw-rows">{pool.map(benchRow)}</ul>:<p className="pw-note">{search?'該当する選手はいません。':'控えの選手はいません。スカウトで仲間を増やそう。'}</p>}
   <p className="pw-tip">控えの選手は、長押しして上の枠へドラッグするか、「編成する」→ 入れたい枠の番号をタップ。</p>
  </section>

  <div className="pw-links">{onCatalog&&<button className="pw-btn pw-white" onClick={onCatalog}><BookOpen size={18}/>カード図鑑</button>}</div>
  {onReset&&<details className="pw-panel pw-reset"><summary>チームをリセット</summary><p>退避してやり直すか、獲得カードを含めて完全に消すか選べます。</p><button className="pw-btn pw-white" onClick={onReset}>退避してリセット</button>{canRestore&&onRestore&&<button className="pw-btn pw-white" onClick={onRestore}>リセット前のチームに戻す</button>}{onCompleteReset&&<button className="pw-btn pw-white pw-danger" onClick={onCompleteReset}>カードも消して完全リセット</button>}</details>}
  {ghost&&<div className="pw-ghost" style={{left:ghost.x+12,top:ghost.y+8}}>{ghost.name}</div>}
  {notice&&<div className="pw-toast" role="status">{notice}</div>}
 </div>;
}
