import {pitcherRolePenalty,pitcherSlotRole,pitchingRatingsForRole} from './pitcher-aptitude';
import {useEffect,useRef,useState,type CSSProperties,type DragEvent,type PointerEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown,ArrowUp,BookOpen,Check,GripVertical,Layers3,RotateCcw,Search,ShieldAlert,Shuffle,Play,Users,X,Zap} from 'lucide-react';
import confetti from 'canvas-confetti';
import {fitsPosition,playerMap,teamById,type Player} from './data';
import {effectiveOverall,type GameState} from './engine';
import {buildByStrategy} from './franchise';
import {reorderSimplePlayer,replacementPool,replaceSimplePlayer,swapDefense} from './simple-game';
import {pitchingRoleLabel} from './wiki-players';
import {ownedRatings,playerAge,ratingOverall} from './development';
import {CardAbilities} from './CardAbilities';
import {ReplacementPreview} from './ReplacementPreview';
import {CardFilterControls} from './CardFilters';
import {browseCards,defaultCardFilters,type CardFilters} from './player-browser';
import './catalog.css';
import './team-workspace.css';
import './team-pro.css';

export const cardBonus=(s:GameState,id:string)=>Math.min(5,Math.max(0,(s.owned[id]??1)-1));
export function Burst({kind='gold'}:{kind?:'gold'|'cyan'}){
 useEffect(()=>{void confetti({particleCount:kind==='gold'?110:45,spread:80,origin:{y:.58},colors:kind==='gold'?['#ffd04a','#ff5b91','#7761ff','#26cbe0']:['#22cbbb','#65a4ff','#c3f6ed'],disableForReducedMotion:true,zIndex:1200});},[kind]);
 return <span aria-hidden="true"/>;
}

// Team-inspired palettes; these are original illustrations, not official uniforms.
export const uniformColors:Record<string,[string,string,string]>={t:['#ffe136','#141820','#141820'],g:['#252a31','#ff822e','#fff'],db:['#006bd8','#fff','#fff'],c:['#e52f43','#fff','#fff'],s:['#163966','#99e838','#fff'],d:['#0d4bc6','#fff','#fff'],h:['#fff','#ffbb19','#1a2535'],f:['#138cda','#fff','#fff'],m:['#262731','#bbbfc9','#fff'],e:['#8d2440','#ffbf4a','#fff'],b:['#122441','#c9a15d','#fff'],l:['#143552','#7cc6d8','#fff']};
Object.assign(uniformColors,{'mlb-119':['#f9fcff','#005a9c','#005a9c'],'mlb-112':['#0e3386','#cc3433','#fff'],'mlb-117':['#002d62','#eb6e1f','#fff'],'mlb-108':['#ba0021','#003263','#fff'],'mlb-135':['#fdf8e4','#2f241d','#9c6c13'],'mlb-145':['#272c35','#c4ced4','#fff'],'mlb-141':['#134a8e','#fdfdff','#fff'],'mlb-121':['#002d72','#ff5910','#ff5910'],'mlb-115':['#f1edf8','#333366','#694899'],'mlb-111':['#bd3039','#0c2340','#fff']});
export function JerseyArt({player}:{player:Player}){
 const [main,trim,number]=uniformColors[player.team]??['#355cbb','#fff','#fff'];
 return <svg className="deck-jersey" viewBox="0 0 160 148" aria-hidden="true" data-uniform={player.team}><path d="m49 18 18-7q13 15 26 0l18 7 37 26-22 34-19-15 7 73q-34 10-68 0l7-73-19 15-22-34Z" fill={main} stroke={trim} strokeWidth="3"/><path d="m49 18 18-7 13 17 13-17 18 7-20 29H69Z" fill={trim}/><path d="M80 39v101M18 46l20 14M142 46l-20 14" stroke={trim} strokeWidth="5"/><text x="80" y="81" textAnchor="middle" fill={number} fontSize="13" fontWeight="900">{teamById(player.team).mark}</text><text x="80" y="115" textAnchor="middle" fill={number} fontSize="30" fontWeight="900">{player.mlb?.number??player.roster?.number??'9'}</text></svg>;
}
export function TradingCard({player,state,slot,selected=false,compact=false,onPlayer,baseOnly=false}:{player:Player;state:GameState;slot?:string;selected?:boolean;compact?:boolean;onPlayer?:(p:Player)=>void;baseOnly?:boolean}){
 const team=teamById(player.team),level=baseOnly?0:state.training[player.id]??0,ratings=baseOnly?player.ratings:ownedRatings(player,state.owned,state.training);
 return <div className={`trading-card ${player.mlb?'mlb-card':''} ${player.role==='pitcher'?'arm-card':'bat-card'} ${selected?'selected':''} ${compact?'compact-card':''}`} style={{'--team-tint':team.color} as CSSProperties}>
  <div className="tc-top"><span>{slot??(player.mlb?.twoWay?'二刀流 · 投手 / DH':player.role==='pitcher'?pitchingRoleLabel(player):player.positions.join(' / ')||'DH')}</span><small>{player.mlb?'海外':'2026'}</small></div>
  <div className="tc-art"><span className="tc-watermark">{team.mark}</span><JerseyArt player={player}/><div className="tc-overall"><small>総合</small><b>{ratingOverall(player,ratings)}</b></div><span className="tc-team">{team.short}</span></div>
  <div className="tc-name">{onPlayer?<button onClick={e=>{e.stopPropagation();onPlayer(player);}}>{player.name}</button>:<strong>{player.name}</strong>}{selected&&<Check size={15}/>}</div>
  <CardAbilities player={player} ratings={ratings}/>
  {player.mlb?.twoWay&&<CardAbilities player={player} mode="batter" ratings={ratings}/>}
  {level>0&&<div className="tc-awakening">{level===5?'完全覚醒':`覚醒 ${level} / 5`}</div>}
 </div>;
}
type Slot={kind:'bat'|'pit';index:number};
type Payload={mode:'order'|'defense'|'bench';id:string;kind:'bat'|'pit'};
function BenchDialog({title,onClose,returnSlot,children}:{title:string;onClose:()=>void;returnSlot?:Slot|null;children:ReactNode}){
 const panel=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';panel.current?.focus({preventScroll:true});
  const key=(event:KeyboardEvent)=>{
   if(!panel.current?.contains(document.activeElement))return;
   if(event.key==='Escape'){event.preventDefault();close.current();}
   if(event.key==='Tab'){
    const nodes=Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,summary,a[href]')).filter(node=>node.getClientRects().length);
    if(!nodes.length){event.preventDefault();return;}
    if(event.shiftKey&&(document.activeElement===nodes[0]||document.activeElement===panel.current)){event.preventDefault();nodes.at(-1)?.focus();}
    else if(!event.shiftKey&&document.activeElement===nodes.at(-1)){event.preventDefault();nodes[0].focus();}
   }
  };
  document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);const target=previous?.isConnected?previous:returnSlot?document.getElementById(`slot-${returnSlot.kind}-${returnSlot.index}`)?.querySelector<HTMLElement>('.deck-card-button'):null;target?.focus({preventScroll:true});};
 },[]);
 return createPortal(<div className="deck-picker-overlay" onClick={onClose}><div ref={panel} className="deck-picker" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={e=>e.stopPropagation()}><header><div><small>控えから選ぶ</small><h2>{title}</h2></div><button aria-label="控えを閉じる" className="s-icon" onClick={onClose}><X size={20}/></button></header>{children}</div></div>,document.body);
}
export function DeckTeam({state,onChange,onPlayer,onImpact,onReset,onRestore,onCompleteReset,onCatalog,canRestore=false,onSeason}:{state:GameState;onChange:(s:GameState)=>void;onPlayer:(p:Player)=>void;onImpact:()=>void;onReset?:()=>void;onRestore?:()=>void;onCompleteReset?:()=>void;onCatalog?:()=>void;canRestore?:boolean;onSeason?:()=>void}){
 const [selected,setSelected]=useState<Slot|null>(null),[order,setOrder]=useState<Slot|null>(null),[defender,setDefender]=useState<string|null>(null),[hand,setHand]=useState<string|null>(null);
 const [filters,setFilters]=useState<CardFilters>({...defaultCardFilters}),[notice,setNotice]=useState('');
 const [view,setView]=useState<Slot['kind']>('bat'),[showAbilities,setShowAbilities]=useState(true),[benchOpen,setBenchOpen]=useState(false);
 const [dragging,setDragging]=useState<Payload|null>(null),[over,setOver]=useState(''),[ghost,setGhost]=useState<{x:number;y:number;name:string}|null>(null);
 const pointer=useRef<{payload:Payload;x:number;y:number;lastX:number;lastY:number;moved:boolean;touch:boolean;timer:number;el:HTMLElement;id:number}|null>(null),ignoreClick=useRef(false),autoScroll=useRef(0);
 // While a finger drag is live, stop the page from panning under it (touch-action is pan-y so a plain swipe still scrolls).
 useEffect(()=>{const block=(e:TouchEvent)=>{if(pointer.current?.moved&&e.cancelable)e.preventDefault();};document.addEventListener('touchmove',block,{passive:false});return()=>document.removeEventListener('touchmove',block);},[]);
 useEffect(()=>()=>{cancelAnimationFrame(autoScroll.current);if(pointer.current)clearTimeout(pointer.current.timer);},[]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3600);return()=>clearTimeout(timer);},[notice]);
 const roster=new Set([...state.lineup,...state.pitchers]);
 const bench=Object.keys(state.owned).map(id=>playerMap[id]).filter(p=>!roster.has(p.id)||(selected&&p.mlb?.twoWay&&!(selected.kind==='bat'?state.lineup:state.pitchers).includes(p.id)));
 const eligible=selected?new Set(replacementPool(state,selected.kind,selected.index).map(p=>p.id)):null;
 const visible=browseCards(bench.filter(p=>!eligible||eligible.has(p.id)),state,filters);
 const clear=()=>{setSelected(null);setOrder(null);setDefender(null);setHand(null);setBenchOpen(false);};
 const commit=(next:GameState,message:string)=>{if(next===state)return;onChange(next);onImpact();clear();setNotice(message);};
 const replace=(slot:Slot,id:string)=>{
  const next=replaceSimplePlayer(state,slot.kind,slot.index,id);
  if(next===state){setNotice('この枠には起用できません。守備適性に合う枠を選んでください。');return;}
  commit(next,`${playerMap[id].name}を起用しました。`);
 };
 const drop=(payload:Payload,slot:Slot)=>{
  const ids=slot.kind==='bat'?state.lineup:state.pitchers,target=ids[slot.index];
  if(payload.mode==='bench')replace(slot,payload.id);
  else if(payload.mode==='defense'&&slot.kind==='bat')commit(swapDefense(state,payload.id,target),'守備位置を交換しました。');
  else if(payload.mode==='order'&&payload.kind===slot.kind)commit(reorderSimplePlayer(state,slot.kind,ids.indexOf(payload.id),slot.index),'順番を変更しました。');
 };
 const targetAt=(x:number,y:number)=>{const el=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-deck-kind]');return el?{kind:el.dataset.deckKind as Slot['kind'],index:Number(el.dataset.deckIndex)}:null;};
 // Near the top or bottom edge the page scrolls by itself, faster the closer the finger is to the edge.
 const edgeScroll=()=>{const p=pointer.current;if(!p?.moved){autoScroll.current=0;return;}
  const top=120,bottom=innerHeight-160;const speed=p.lastY<top?-Math.min(22,4+(top-p.lastY)/5):p.lastY>bottom?Math.min(22,4+(p.lastY-bottom)/5):0;
  if(speed){const before=scrollY;scrollBy(0,speed);if(scrollY!==before){const t=targetAt(p.lastX,p.lastY);setOver(t?`${t.kind}-${t.index}`:'');}}
  autoScroll.current=requestAnimationFrame(edgeScroll);};
 const beginDrag=(p:NonNullable<typeof pointer.current>)=>{p.moved=true;setDragging(p.payload);setGhost({x:p.lastX,y:p.lastY,name:playerMap[p.payload.id].name});if(!autoScroll.current)autoScroll.current=requestAnimationFrame(edgeScroll);};
 const endDrag=()=>{const p=pointer.current;if(p)clearTimeout(p.timer);pointer.current=null;cancelAnimationFrame(autoScroll.current);autoScroll.current=0;setDragging(null);setOver('');setGhost(null);};
 const dragProps=(payload:Payload)=>({
  draggable:true,
  onDragStart:(e:DragEvent<HTMLElement>)=>{if(pointer.current){e.preventDefault();return;}e.dataTransfer.setData('text/plain',JSON.stringify(payload));e.dataTransfer.effectAllowed='move';setDragging(payload);},
  onDragEnd:()=>{setDragging(null);setOver('');},
  onPointerDown:(e:PointerEvent<HTMLElement>)=>{if(e.button!==0||((e.target as HTMLElement).closest('button')&&e.currentTarget.tagName!=='BUTTON'))return;
   const touch=e.pointerType!=='mouse',el=e.currentTarget,id=e.pointerId;ignoreClick.current=false;
   if(!touch){e.preventDefault();el.setPointerCapture(id);}
   const p={payload,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,touch,el,id,timer:0};
   // On a phone a drag starts after a short hold, so a quick swipe on the handle scrolls the page instead.
   if(touch)p.timer=window.setTimeout(()=>{if(pointer.current!==p)return;try{el.setPointerCapture(id);}catch{}navigator.vibrate?.(12);beginDrag(p);},220);
   pointer.current=p;},
  onPointerMove:(e:PointerEvent<HTMLElement>)=>{const p=pointer.current;if(!p)return;p.lastX=e.clientX;p.lastY=e.clientY;
   if(!p.moved){if(Math.hypot(e.clientX-p.x,e.clientY-p.y)<8)return;if(p.touch){clearTimeout(p.timer);pointer.current=null;return;}beginDrag(p);}
   setGhost({x:e.clientX,y:e.clientY,name:playerMap[p.payload.id].name});const t=targetAt(e.clientX,e.clientY);setOver(t?`${t.kind}-${t.index}`:'');},
  onPointerUp:(e:PointerEvent<HTMLElement>)=>{const p=pointer.current;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(p?.moved){ignoreClick.current=true;setTimeout(()=>{ignoreClick.current=false;},0);const t=targetAt(e.clientX,e.clientY);if(t)drop(p.payload,t);}endDrag();},
  onPointerCancel:()=>endDrag(),
  onContextMenu:(e:{preventDefault:()=>void})=>{if(pointer.current)e.preventDefault();},
 });
 const tapOrder=(slot:Slot)=>{if(ignoreClick.current)return;if(order?.kind===slot.kind){drop({mode:'order',kind:slot.kind,id:(slot.kind==='bat'?state.lineup:state.pitchers)[order.index]},slot);setOrder(null);}else{clear();setOrder(slot);}};
 const tapDefense=(id:string)=>{if(ignoreClick.current)return;if(defender){commit(swapDefense(state,defender,id),'守備位置を交換しました。');setDefender(null);}else{clear();setDefender(id);}};
 const row=(id:string,index:number,kind:Slot['kind'])=>{
  const player=playerMap[id],age=playerAge(player),key=`${kind}-${index}`,active=selected?.kind===kind&&selected.index===index,slot={kind,index},overall=effectiveOverall(player,state.owned,state.training);
  const pos=state.defense[id],fit=kind==='pit'?pitcherRolePenalty(player,pitcherSlotRole(index))===0:fitsPosition(player,pos),role=kind==='bat'?`${index+1}番`:index<6?`先発${index+1}`:index===13?'抑え':`中継${index-5}`;
  const compatible=dragging&&(dragging.mode==='bench'?replacementPool(state,kind,index).some(p=>p.id===dragging.id):dragging.kind===kind);
  const handFits=hand&&replacementPool(state,kind,index).some(p=>p.id===hand);
  return <article key={id} id={`slot-${key}`} data-deck-kind={kind} data-deck-index={index} className={`lineup-row ${active?'active-row':''} ${over===key&&compatible?'drop-over':''} ${handFits?'can-equip':''}`} style={{'--team-tint':teamById(player.team).color} as CSSProperties}
   onDragOver={e=>{if(compatible){e.preventDefault();setOver(key);}}} onDragLeave={()=>setOver('')} onDrop={e=>{e.preventDefault();if(dragging)drop(dragging,slot);setDragging(null);setOver('');}}>
   <button {...dragProps({mode:'order',id,kind})} className={`order-handle ${order?.kind===kind&&order.index===index?'picked':''}`} aria-label={`${player.name}の${kind==='bat'?'打順':'投手順'}を移動`} aria-pressed={order?.kind===kind&&order.index===index} onClick={()=>tapOrder(slot)}><GripVertical size={14}/><b>{role}</b></button>
   {kind==='bat'&&<div className="position-cell"><button {...dragProps({mode:'defense',id,kind})} className={`position-handle pos-${pos==='捕'?'c':pos==='外'?'of':pos==='DH'?'dh':'if'} ${defender===id?'picked':''} ${fit?'':'unfit'}`} aria-label={`${player.name}の守備位置 ${pos}を交換`} aria-pressed={defender===id} onClick={()=>tapDefense(id)}>{pos}</button>{defender===id&&<select aria-label={`${player.name}の変更先の守備位置`} value="" onChange={e=>{if(e.target.value)commit(swapDefense(state,id,e.target.value),'守備位置を交換しました。');}}><option value="">交換先</option>{state.lineup.filter(other=>other!==id).map(other=><option key={other} value={other}>{state.defense[other]} · {playerMap[other].name}</option>)}</select>}</div>}
   <div className="row-jersey"><JerseyArt player={player}/></div>
   <div className="row-identity"><div className="row-identity-meta"><small>{teamById(player.team).short}{!fit&&' · 適性外'}</small><span className="player-age" title="2026年9月20日時点">{age===null?'年齢未登録':`${age}歳`}</span></div><button title={player.name} data-player-id={id} onClick={()=>onPlayer(player)}>{player.name}</button>{(state.training[id]??0)>0&&<span>覚醒 {state.training[id]}/5</span>}</div>
   <div className={'row-overall '+(overall>=80?'ovr-gold':overall>=60?'ovr-silver':'ovr-bronze')+(overall>=100?' triple-digit':'')} aria-label={`総合 ${overall}`}><small>総合</small><b>{overall}</b></div>
   <CardAbilities player={player} mode={kind==='bat'?'batter':'pitcher'} ratings={kind==='pit'?pitchingRatingsForRole(player,ownedRatings(player,state.owned,state.training),pitcherSlotRole(index)):ownedRatings(player,state.owned,state.training)}/>
   <div className="row-actions"><button className="deck-card-button" aria-label={`${role} ${player.name}を入れ替える`} aria-pressed={active} onClick={()=>{if(hand)replace(slot,hand);else{clear();setSelected(slot);setView(kind);setFilters({...defaultCardFilters});setBenchOpen(true);}}}>{active?'選択中':'入替'}</button><div><button aria-label={`${player.name}を上へ`} disabled={index===0} onClick={()=>commit(reorderSimplePlayer(state,kind,index,index-1),'順番を変更しました。')}><ArrowUp size={13}/></button><button aria-label={`${player.name}を下へ`} disabled={index===(kind==='bat'?8:13)} onClick={()=>commit(reorderSimplePlayer(state,kind,index,index+1),'順番を変更しました。')}><ArrowDown size={13}/></button></div></div>
  </article>;
 };
 const unfitPitchers=state.pitchers.filter((id,index)=>pitcherRolePenalty(playerMap[id],pitcherSlotRole(index))>0);
 const misplaced=state.lineup.filter(id=>!fitsPosition(playerMap[id],state.defense[id]));
 const selectionText=order?(order.kind==='bat'?'移動先の打順番号をタップ。':'移動先の投手枠をタップ。'):defender?'交換先の守備位置をタップ。適性外では失点が増えやすくなります。':selected?`${playerMap[(selected.kind==='bat'?state.lineup:state.pitchers)[selected.index]].name}と入れ替える控えを選んでください。`:hand?'起用する枠の「入替」をタップ。':'番号・守備位置をタップして交換。選手名で詳細。';
 const autoBuild=()=>{const next=buildByStrategy(state,'balanced');if(next===state)setNotice('適性のある投手が不足しています。先発6人・中継ぎ7人・抑え1人を揃えてください。');else commit(next,'編成しました。');};
 const avg=(ids:string[])=>Math.round(ids.reduce((sum,id)=>sum+effectiveOverall(playerMap[id],state.owned,state.training),0)/Math.max(1,ids.length));
 const teamOverall=avg(state.lineup),staffOverall=avg(state.pitchers);
 return <div className={'compact-team team-pro'+(showAbilities?' show-abilities':'')}><div className="team-pro-summary"><div><small>打線</small><b>{teamOverall}</b></div><div className="team-pro-staff"><small>投手陣</small><b>{staffOverall}</b></div><div><strong>{state.name}</strong><span>総合の平均</span></div></div><div className="team-pro-bar"><button className="team-pro-auto" onClick={autoBuild}><Shuffle size={17}/>おまかせ編成</button>{onSeason&&<button className="team-pro-play" onClick={onSeason}>試合へ進む<Play size={16}/></button>}</div><div className="s-page-title"><div><p className="s-kicker">MY TEAM</p><h1>チーム編成</h1></div><div className="team-title-actions">{onCatalog&&<button className="s-button catalog-open" onClick={onCatalog}><BookOpen size={16}/>カードカタログ</button>}<button className="s-button deck-auto" onClick={()=>{const next=buildByStrategy(state,'balanced');if(next===state)setNotice('適性のある投手が不足しています。先発6人・中継ぎ7人・抑え1人を揃えてください。');else commit(next,'編成しました。');}}><Shuffle size={16}/>おまかせ編成</button></div></div>
 <div className="deck-toolbar"><div className="deck-view-switch" role="group" aria-label="編成する選手"><button aria-pressed={view==='bat'} onClick={()=>{clear();setView('bat');}}><Users size={16}/>打線 9</button><button aria-pressed={view==='pit'} onClick={()=>{clear();setView('pit');}}><Zap size={16}/>投手 12</button></div><button className="deck-ability-toggle" aria-pressed={showAbilities} onClick={()=>setShowAbilities(v=>!v)}>{showAbilities?'能力を隠す':'能力を表示'}</button><button className="deck-bench-open" onClick={()=>{clear();setFilters({...defaultCardFilters});setBenchOpen(true);}}><Layers3 size={16}/>控え {bench.length}</button></div>
 <div className={`deck-guide ${order||defender||selected||hand?'is-choosing':''}`}><Layers3 size={17}/><span>{selectionText}</span>{(order||defender||selected||hand)&&<button aria-label="編成の選択を解除" onClick={clear}><X size={18}/></button>}</div>
 {unfitPitchers.length>0&&<div className="deck-defense-warning" role="status"><ShieldAlert size={18}/><div><strong>投手の役割適性不足 {unfitPitchers.length}人</strong><span>制球・変化球が低下し、四死球や失点が増えやすくなります。能力欄は起用時の補正後、総合値はカード本来の値です。</span></div></div>}
 {misplaced.length>0&&<div className="deck-defense-warning" role="status"><ShieldAlert size={18} aria-hidden="true"/><div><strong>守備適性外 {misplaced.length}人</strong><span>被安打・失策が増え、失点しやすくなります。{misplaced.some(id=>state.defense[id]==='捕')&&'捕手の適性外は盗塁も許しやすくなります。'}</span></div></div>}
 <div className="deck-layout"><div className="deck-boards"><section className={'deck-board'+(view==='bat'?' is-active':'')} aria-label="打線の編成"><header><h2><Users size={19}/>スターティング9</h2><span>打順 / 守備 / 選手 / 総合 / 能力</span></header><div className="lineup-list">{state.lineup.map((id,i)=>row(id,i,'bat'))}</div></section><section className={'deck-board pitching-board'+(view==='pit'?' is-active':'')} aria-label="投手の編成"><header><h2><Zap size={19}/>投手デッキ</h2><span>先発6人・リリーフ6人</span></header><div className="lineup-list">{state.pitchers.map((id,i)=>row(id,i,'pit'))}</div></section></div>
 </div>
 {benchOpen&&<BenchDialog title={selected?`${selected.kind==='bat'?`${selected.index+1}番`:selected.index<6?`先発${selected.index+1}`:selected.index===13?'抑え':`中継${selected.index-5}`} ${playerMap[(selected.kind==='bat'?state.lineup:state.pitchers)[selected.index]].name}と入替`:'控えの選手'} onClose={clear} returnSlot={selected}>
  {selected&&<div className="deck-picker-current"><ReplacementPreview player={playerMap[(selected.kind==='bat'?state.lineup:state.pitchers)[selected.index]]} state={state} position={selected.kind==='bat'?`${selected.index+1}番 · ${state.defense[state.lineup[selected.index]]}`:selected.index<6?`先発${selected.index+1}`:selected.index===13?'抑え':`中継${selected.index-5}`} mode={selected.kind==='bat'?'batter':'pitcher'} onPlayer={onPlayer}/></div>}
  <div className="deck-picker-tools"><label className="deck-search"><Search size={15}/><input aria-label="控えを選手名で検索" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} placeholder="選手名で探す"/></label><details className="deck-picker-filters"><summary>絞り込み・並べ替え</summary><CardFilterControls prefix="控え" value={filters} onChange={setFilters}/></details><div className="bench-filter-result"><span role="status">{visible.length}人{selected?' · この枠に起用できる選手':''}</span>{(filters.search||filters.team!=='all'||filters.age!=='all'||filters.role!=='all')&&<button onClick={()=>setFilters({...defaultCardFilters})}>絞り込みを解除</button>}</div></div>
  <div className="deck-picker-list">{visible.map(p=><article className="deck-hand-card" key={p.id} style={{'--team-tint':teamById(p.team).color} as CSSProperties}><div className="bench-choice-heading"><JerseyArt player={p}/><div className="bench-choice-name"><button onClick={()=>onPlayer(p)}>{p.name}</button><small>{playerAge(p)===null?'年齢未登録':`${playerAge(p)}歳`} · {teamById(p.team).short} · {p.role==='pitcher'?pitchingRoleLabel(p):p.positions.join('/')}</small></div><div className="bench-choice-overall"><small>総合</small><b>{effectiveOverall(p,state.owned,state.training)}</b></div><button className="hand-equip" aria-label={`${p.name}を起用`} onClick={()=>{if(selected)replace(selected,p.id);else{clear();setHand(p.id);setView(p.role==='pitcher'?'pit':'bat');}}}>起用</button></div><CardAbilities player={p} mode={selected?.kind==='bat'?'batter':p.role} ratings={ownedRatings(p,state.owned,state.training)}/></article>)}</div>
  {!visible.length&&<p className="deck-picker-empty">{eligible&&eligible.size===0?'この枠に起用できる控えがいません。':'条件に合う控えがいません。'}</p>}
 </BenchDialog>}
 {onReset&&<details className="team-reset-panel"><summary><RotateCcw size={15}/>チームをリセット</summary><p>退避してやり直すか、獲得カードを含めて完全に消すか選べます。</p><button className="s-button reset-team" onClick={onReset}>退避してリセット</button>{canRestore&&onRestore&&<button className="s-button" onClick={onRestore}>リセット前のチームに戻す</button>}{onCompleteReset&&<button className="s-button complete-reset" onClick={onCompleteReset}>カードも消して完全リセット</button>}</details>}
 {notice&&<div className="deck-notice animate__animated animate__fadeInUp" role="status"><Check size={17}/>{notice}</div>}{ghost&&<div className="deck-drag-ghost" style={{left:ghost.x+14,top:ghost.y+10}}>{ghost.name}</div>}
 </div>;
}
