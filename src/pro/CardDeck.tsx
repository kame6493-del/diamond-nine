import {useEffect,useRef,useState,type CSSProperties,type DragEvent,type PointerEvent} from 'react';
import {ArrowDown,ArrowUp,BookOpen,Check,GripVertical,Layers3,RotateCcw,Search,Shuffle,Users,X,Zap} from 'lucide-react';
import confetti from 'canvas-confetti';
import {fitsPosition,playerMap,teamById,type Player} from './data';
import {effectiveOverall,type GameState} from './engine';
import {buildByStrategy} from './franchise';
import {reorderSimplePlayer,replacementPool,replaceSimplePlayer,swapDefense} from './simple-game';
import {pitchingRoleLabel} from './wiki-players';
import {ownedRatings,playerAge,ratingOverall} from './development';
import {CardAbilities} from './CardAbilities';
import {CardFilterControls} from './CardFilters';
import {browseCards,defaultCardFilters,type CardFilters} from './player-browser';
import './catalog.css';

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
  <div className="tc-top"><span>{slot??(player.mlb?.twoWay?'二刀流 · 投手 / DH':player.role==='pitcher'?pitchingRoleLabel(player):player.positions.join(' / ')||'DH')}</span><small>{player.mlb?'MLB':'2026'}</small></div>
  <div className="tc-art"><span className="tc-watermark">{team.mark}</span><JerseyArt player={player}/><div className="tc-overall"><small>総合</small><b>{ratingOverall(player,ratings)}</b></div><span className="tc-team">{team.short}</span></div>
  <div className="tc-name">{onPlayer?<button onClick={e=>{e.stopPropagation();onPlayer(player);}}>{player.name}</button>:<strong>{player.name}</strong>}{selected&&<Check size={15}/>}</div>
  <CardAbilities player={player} ratings={ratings}/>
  {player.mlb?.twoWay&&<CardAbilities player={player} mode="batter" ratings={ratings}/>}
  {level>0&&<div className="tc-awakening">{level===5?'完全覚醒':`覚醒 ${level} / 5`}</div>}
 </div>;
}
type Slot={kind:'bat'|'pit';index:number};
type Payload={mode:'order'|'defense'|'bench';id:string;kind:'bat'|'pit'};
export function DeckTeam({state,onChange,onPlayer,onImpact,onReset,onRestore,onCompleteReset,onCatalog,canRestore=false}:{state:GameState;onChange:(s:GameState)=>void;onPlayer:(p:Player)=>void;onImpact:()=>void;onReset?:()=>void;onRestore?:()=>void;onCompleteReset?:()=>void;onCatalog?:()=>void;canRestore?:boolean}){
 const [selected,setSelected]=useState<Slot|null>(null),[order,setOrder]=useState<Slot|null>(null),[defender,setDefender]=useState<string|null>(null),[hand,setHand]=useState<string|null>(null);
 const [filters,setFilters]=useState<CardFilters>({...defaultCardFilters}),[notice,setNotice]=useState('');
 const [dragging,setDragging]=useState<Payload|null>(null),[over,setOver]=useState(''),[ghost,setGhost]=useState<{x:number;y:number;name:string}|null>(null);
 const pointer=useRef<{payload:Payload;x:number;y:number;moved:boolean}|null>(null),ignoreClick=useRef(false);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3600);return()=>clearTimeout(timer);},[notice]);
 useEffect(()=>{if(!window.matchMedia('(max-width:760px)').matches)return;if(selected)document.getElementById('deck-hand')?.scrollIntoView({behavior:'smooth',block:'start'});else if(hand)document.getElementById(`slot-${playerMap[hand].role==='pitcher'?'pit':'bat'}-0`)?.scrollIntoView({behavior:'smooth',block:'start'});},[selected,hand]);
 const roster=new Set([...state.lineup,...state.pitchers]);
 const bench=Object.keys(state.owned).map(id=>playerMap[id]).filter(p=>!roster.has(p.id)||(selected&&p.mlb?.twoWay&&!(selected.kind==='bat'?state.lineup:state.pitchers).includes(p.id)));
 const eligible=selected?new Set(replacementPool(state,selected.kind,selected.index).map(p=>p.id)):null;
 const visible=browseCards(bench.filter(p=>!eligible||eligible.has(p.id)),state,filters);
 const clear=()=>{setSelected(null);setOrder(null);setDefender(null);setHand(null);};
 const commit=(next:GameState,message:string)=>{if(next===state)return;onChange(next);onImpact();clear();setNotice(message);};
 const replace=(slot:Slot,id:string)=>{
  const next=replaceSimplePlayer(state,slot.kind,slot.index,id);
  if(next===state){setNotice('この枠には起用できません。守備適性に合う枠を選んでください。');return;}
  commit(next,`${playerMap[id].name}を起用しました。`);
  if(window.matchMedia('(max-width:760px)').matches)requestAnimationFrame(()=>document.getElementById(`slot-${slot.kind}-${slot.index}`)?.scrollIntoView({behavior:'smooth',block:'center'}));
 };
 const drop=(payload:Payload,slot:Slot)=>{
  const ids=slot.kind==='bat'?state.lineup:state.pitchers,target=ids[slot.index];
  if(payload.mode==='bench')replace(slot,payload.id);
  else if(payload.mode==='defense'&&slot.kind==='bat')commit(swapDefense(state,payload.id,target),'守備位置を交換しました。');
  else if(payload.mode==='order'&&payload.kind===slot.kind)commit(reorderSimplePlayer(state,slot.kind,ids.indexOf(payload.id),slot.index),'順番を変更しました。');
 };
 const targetAt=(x:number,y:number)=>{const el=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-deck-kind]');return el?{kind:el.dataset.deckKind as Slot['kind'],index:Number(el.dataset.deckIndex)}:null;};
 const dragProps=(payload:Payload)=>({
  draggable:true,
  onDragStart:(e:DragEvent<HTMLElement>)=>{if(pointer.current){e.preventDefault();return;}e.dataTransfer.setData('text/plain',JSON.stringify(payload));e.dataTransfer.effectAllowed='move';setDragging(payload);},
  onDragEnd:()=>{setDragging(null);setOver('');},
  onPointerDown:(e:PointerEvent<HTMLElement>)=>{if(e.button!==0||((e.target as HTMLElement).closest('button')&&e.currentTarget.tagName!=='BUTTON'))return;e.preventDefault();ignoreClick.current=false;pointer.current={payload,x:e.clientX,y:e.clientY,moved:false};e.currentTarget.setPointerCapture(e.pointerId);},
  onPointerMove:(e:PointerEvent<HTMLElement>)=>{const p=pointer.current;if(!p)return;if(!p.moved&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<8)return;p.moved=true;setDragging(p.payload);setGhost({x:e.clientX,y:e.clientY,name:playerMap[p.payload.id].name});const t=targetAt(e.clientX,e.clientY);setOver(t?`${t.kind}-${t.index}`:'');},
  onPointerUp:(e:PointerEvent<HTMLElement>)=>{const p=pointer.current;pointer.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(p?.moved){ignoreClick.current=true;setTimeout(()=>{ignoreClick.current=false;},0);const t=targetAt(e.clientX,e.clientY);if(t)drop(p.payload,t);}setDragging(null);setOver('');setGhost(null);},
  onPointerCancel:()=>{pointer.current=null;setDragging(null);setOver('');setGhost(null);},
 });
 const tapOrder=(slot:Slot)=>{if(ignoreClick.current)return;if(order?.kind===slot.kind){drop({mode:'order',kind:slot.kind,id:(slot.kind==='bat'?state.lineup:state.pitchers)[order.index]},slot);setOrder(null);}else{clear();setOrder(slot);}};
 const tapDefense=(id:string)=>{if(ignoreClick.current)return;if(defender){commit(swapDefense(state,defender,id),'守備位置を交換しました。');setDefender(null);}else{clear();setDefender(id);}};
 const row=(id:string,index:number,kind:Slot['kind'])=>{
  const player=playerMap[id],age=playerAge(player),key=`${kind}-${index}`,active=selected?.kind===kind&&selected.index===index,slot={kind,index},overall=effectiveOverall(player,state.owned,state.training);
  const pos=state.defense[id],fit=kind==='pit'||fitsPosition(player,pos),role=kind==='bat'?`${index+1}番`:index<6?`先発${index+1}`:index===11?'抑え':`中継${index-5}`;
  const compatible=dragging&&(dragging.mode==='bench'?replacementPool(state,kind,index).some(p=>p.id===dragging.id):dragging.kind===kind);
  return <article key={id} id={`slot-${key}`} data-deck-kind={kind} data-deck-index={index} className={`lineup-row ${active?'active-row':''} ${over===key&&compatible?'drop-over':''}`} style={{'--team-tint':teamById(player.team).color} as CSSProperties}
   onDragOver={e=>{if(compatible){e.preventDefault();setOver(key);}}} onDragLeave={()=>setOver('')} onDrop={e=>{e.preventDefault();if(dragging)drop(dragging,slot);setDragging(null);setOver('');}}>
   <button {...dragProps({mode:'order',id,kind})} className={`order-handle ${order?.kind===kind&&order.index===index?'picked':''}`} aria-label={`${player.name}の${kind==='bat'?'打順':'投手順'}を移動`} aria-pressed={order?.kind===kind&&order.index===index} onClick={()=>tapOrder(slot)}><GripVertical size={14}/><b>{role}</b></button>
   {kind==='bat'&&<div className="position-cell"><button {...dragProps({mode:'defense',id,kind})} className={`position-handle ${defender===id?'picked':''} ${fit?'':'unfit'}`} aria-label={`${player.name}の守備位置 ${pos}を交換`} aria-pressed={defender===id} onClick={()=>tapDefense(id)}>{pos}</button>{defender===id&&<select aria-label={`${player.name}の変更先の守備位置`} value="" onChange={e=>{if(e.target.value)commit(swapDefense(state,id,e.target.value),'守備位置を交換しました。');}}><option value="">交換先</option>{state.lineup.filter(other=>other!==id).map(other=><option key={other} value={other}>{state.defense[other]} · {playerMap[other].name}</option>)}</select>}</div>}
   <div className="row-jersey"><JerseyArt player={player}/></div>
   <div className="row-identity"><div className="row-identity-meta"><small>{teamById(player.team).short}{!fit&&' · 適性外'}</small><span className="player-age" title="2026年9月20日時点">{age===null?'年齢未登録':`${age}歳`}</span></div><button data-player-id={id} onClick={()=>onPlayer(player)}>{player.name}</button>{(state.training[id]??0)>0&&<span>覚醒 {state.training[id]}/5</span>}</div>
   <div className={'row-overall'+(overall>=100?' triple-digit':'')} aria-label={`総合 ${overall}`}><small>総合</small><b>{overall}</b></div>
   <CardAbilities player={player} mode={kind==='bat'?'batter':'pitcher'} ratings={ownedRatings(player,state.owned,state.training)}/>
   <div className="row-actions"><button className="deck-card-button" aria-label={`${role} ${player.name}を入れ替える`} aria-pressed={active} onClick={()=>{if(hand)replace(slot,hand);else{clear();setSelected(active?null:slot);setFilters({...defaultCardFilters});}}}>{active?'選択中':'入替'}</button><div><button aria-label={`${player.name}を上へ`} disabled={index===0} onClick={()=>commit(reorderSimplePlayer(state,kind,index,index-1),'順番を変更しました。')}><ArrowUp size={13}/></button><button aria-label={`${player.name}を下へ`} disabled={index===(kind==='bat'?8:11)} onClick={()=>commit(reorderSimplePlayer(state,kind,index,index+1),'順番を変更しました。')}><ArrowDown size={13}/></button></div></div>
  </article>;
 };
 const selectionText=order?'移動先の打順番号をタップ。':defender?'交換先の守備位置をタップ。適性外では守備力が下がります。':selected?`${playerMap[(selected.kind==='bat'?state.lineup:state.pitchers)[selected.index]].name}と入れ替える控えを選んでください。`:hand?'起用するスタメンの「入替」をタップ。':'番号をドラッグで打順変更。守備位置もドラッグ・タップで交換。選手名で詳細。';
 return <><div className="s-page-title"><div><p className="s-kicker">MY TEAM</p><h1>チーム編成</h1></div><div className="team-title-actions">{onCatalog&&<button className="s-button catalog-open" onClick={onCatalog}><BookOpen size={16}/>カードカタログ</button>}<button className="s-button deck-auto" onClick={()=>commit(buildByStrategy(state,'balanced'),'編成しました。')}><Shuffle size={16}/>おまかせ編成</button></div></div>
 <div className={`deck-guide ${order||defender||selected||hand?'is-choosing':''}`}><Layers3 size={17}/><span>{selectionText}</span>{(order||defender||selected||hand)&&<button aria-label="編成の選択を解除" onClick={clear}><X size={18}/></button>}</div>
 <div className="deck-layout"><div className="deck-boards"><section className="deck-board"><header><h2><Users size={19}/>スターティング9</h2><span>打順 / 守備 / 選手 / 総合 / 能力</span></header><div className="lineup-list">{state.lineup.map((id,i)=>row(id,i,'bat'))}</div></section><section className="deck-board pitching-board"><header><h2><Zap size={19}/>投手デッキ</h2><span>先発6人・リリーフ6人</span></header><div className="lineup-list">{state.pitchers.map((id,i)=>row(id,i,'pit'))}</div></section></div>
 <aside className={`deck-hand ${selected?'choosing':''}`} id="deck-hand"><header><h2><Layers3 size={19}/>控えのカード</h2><span>{bench.length}人</span></header><p>{selected?'選んで入れ替え':'カードをドラッグ、または「起用」をタップ'}</p><label className="deck-search"><Search size={15}/><input aria-label="控えを選手名で検索" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} placeholder="選手名で探す"/></label><CardFilterControls prefix="控え" value={filters} onChange={setFilters}/><div className="bench-filter-result"><span role="status">{visible.length}人を表示</span>{(filters.search||filters.team!=="all"||filters.age!=="all"||filters.role!=="all")&&<button onClick={()=>setFilters({...defaultCardFilters})}>絞り込みを解除</button>}</div><div className="deck-hand-list">{visible.map(p=><article className="deck-hand-card" key={p.id} {...dragProps({mode:'bench',id:p.id,kind:p.role==='pitcher'?'pit':'bat'})}><div className="bench-card-meta"><span>{playerAge(p)===null?"年齢未登録":`${playerAge(p)}歳`}</span><span>{teamById(p.team).short}</span></div><TradingCard player={p} state={state} compact selected={hand===p.id} onPlayer={onPlayer}/><button className="hand-equip" onClick={()=>{if(ignoreClick.current)return;if(selected)replace(selected,p.id);else{clear();setHand(p.id);}}}>{selected?'この選手に入れ替え':hand===p.id?'起用先を選んでください':'この選手を起用'}</button></article>)}</div>{!visible.length&&<p className="deck-empty">条件に合う控えがいません。</p>}</aside></div>
 {onReset&&<details className="team-reset-panel"><summary><RotateCcw size={15}/>チームをリセット</summary><p>退避してやり直すか、獲得カードを含めて完全に消すか選べます。</p><button className="s-button reset-team" onClick={onReset}>退避してリセット</button>{canRestore&&onRestore&&<button className="s-button" onClick={onRestore}>リセット前のチームに戻す</button>}{onCompleteReset&&<button className="s-button complete-reset" onClick={onCompleteReset}>カードも消して完全リセット</button>}</details>}
 {notice&&<div className="deck-notice animate__animated animate__fadeInUp" role="status"><Check size={17}/>{notice}</div>}{ghost&&<div className="deck-drag-ghost" style={{left:ghost.x+14,top:ghost.y+10}}>{ghost.name}</div>}
 </>;
}
