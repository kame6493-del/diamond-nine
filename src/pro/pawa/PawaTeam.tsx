import {useEffect,useMemo,useRef,useState,type PointerEvent as RPointerEvent} from 'react';
import {AlertTriangle,BookOpen,ChevronRight,GripVertical,Search,Shuffle,X} from 'lucide-react';
import {canBat,fitsPosition,matchesPlayerName,playerMap,teamById,type Player,type Ratings} from '../data';
import {effectiveOverall,type GameState} from '../engine';
import {buildByStrategy} from '../franchise';
import {reorderSimplePlayer,replacementPool,replaceSimplePlayer,swapDefense} from '../simple-game';
import {ownedRatings,playerAge} from '../development';
import {pitcherRolePenalty,pitcherSlotRole,pitchingRatingsForRole,type PitcherRole} from '../pitcher-aptitude';
import {ageBands,cardTeams} from '../player-browser';
import {OvrBox,PosChip,Rank,RoleChip} from './PawaCard';

type Kind='bat'|'pit';
type Slot={kind:Kind;index:number};
type Drag={from:'slot'|'bench';kind:Kind;index:number;id:string};
const slotName=(kind:Kind,i:number)=>kind==='bat'?`${i+1}番`:i<6?`先発${i+1}`:i===13?'抑え':`中継ぎ${i-5}`;
const hiddenTraits=['暫定査定','基本能力型','実戦派'];
const traitsOf=(p:Player)=>p.traits.filter(t=>!hiddenTraits.includes(t));

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

// ---- 控えの絞り込み・並べ替え(旧版 v18 の 検索・種類・年齢帯・球団・並べ替え6種 + 守備位置・役割適性・能力別の並べ替え・この枠に入れられる選手だけ) ----
type Sort='overall-desc'|'overall-asc'|'age-asc'|'age-desc'|'team'|'name'|'traits'|'awaken'|'contact'|'power'|'speed'|'arm'|'field'|'velocity'|'control'|'stamina'|'breaking';
type BenchFilter={search:string;role:'auto'|'all'|'batter'|'pitcher';pos:string;age:string;team:string;sort:Sort};
const defaultFilter:BenchFilter={search:'',role:'auto',pos:'all',age:'all',team:'all',sort:'overall-desc'};
const sortLabels:[Sort,string][]=[['overall-desc','総合が高い順'],['overall-asc','総合が低い順'],['age-asc','年齢が若い順'],['age-desc','年齢が高い順'],['team','球団順'],['name','名前順'],['traits','特殊能力が多い順'],['awaken','覚醒が進んだ順'],['contact','ミートが高い順'],['power','パワーが高い順'],['speed','走力が高い順'],['arm','肩が高い順'],['field','守備が高い順'],['velocity','球速が速い順'],['control','制球が高い順'],['stamina','スタミナが高い順'],['breaking','変化が高い順']];
const posOptions:[string,string][]=[['all','全ポジション'],['捕','捕手'],['一','一塁'],['二','二塁'],['三','三塁'],['遊','遊撃'],['外','外野'],['先','先発の適性'],['中','中継ぎの適性'],['抑','抑えの適性']];

export function PawaTeam({state,onChange,onPlayer,onImpact,onReset,onRestore,onCompleteReset,onCatalog,canRestore=false,onSeason}:{state:GameState;onChange:(s:GameState)=>void;onPlayer:(p:Player)=>void;onImpact:()=>void;onReset?:()=>void;onRestore?:()=>void;onCompleteReset?:()=>void;onCatalog?:()=>void;canRestore?:boolean;onSeason?:()=>void}){
 const [tab,setTab]=useState<'bat'|'先'|'中'|'抑'|'bench'>('bat'),[hand,setHand]=useState<string|null>(null),[picked,setPicked]=useState<Slot|null>(null),[defender,setDefender]=useState<string|null>(null),[notice,setNotice]=useState('');
 const [filter,setFilter]=useState<BenchFilter>(defaultFilter),[slotOnly,setSlotOnly]=useState(true);
 const [drag,setDrag]=useState<Drag|null>(null),[over,setOver]=useState(''),[ghost,setGhost]=useState<{x:number;y:number;name:string}|null>(null);
 const pointer=useRef<{d:Drag;x:number;y:number;lastX:number;lastY:number;moved:boolean;touch:boolean;timer:number;el:HTMLElement;id:number}|null>(null),scroller=useRef(0),justDragged=useRef(false),benchRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3200);return()=>clearTimeout(t);},[notice]);
 // While a finger drag is live, the page must not pan under it.
 useEffect(()=>{const block=(e:TouchEvent)=>{if(pointer.current?.moved&&e.cancelable)e.preventDefault();};document.addEventListener('touchmove',block,{passive:false});return()=>{document.removeEventListener('touchmove',block);cancelAnimationFrame(scroller.current);};},[]);
 const ovr=(id:string)=>effectiveOverall(playerMap[id],state.owned,state.training);
 const ratingsOf=(id:string)=>ownedRatings(playerMap[id],state.owned,state.training);
 const roster=new Set([...state.lineup,...state.pitchers]);
 const benchAll=Object.keys(state.owned).map(id=>playerMap[id]).filter(p=>p&&!roster.has(p.id));
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
 // tap: the number picks the slot (then tap another number to swap, or choose a bench player for it)
 const tapOrder=(slot:Slot)=>{if(justDragged.current)return;
  if(hand){replace(slot,hand);return;}
  if(picked&&picked.kind===slot.kind&&picked.index!==slot.index){drop({from:'slot',kind:slot.kind,index:picked.index,id:(slot.kind==='bat'?state.lineup:state.pitchers)[picked.index]},slot);return;}
  setDefender(null);setPicked(picked&&picked.kind===slot.kind&&picked.index===slot.index?null:slot);};
 const tapDefense=(id:string)=>{if(defender&&defender!==id){commit(swapDefense(state,defender,id),'守備位置を交換しました。');setDefender(null);}else{setPicked(null);setDefender(defender===id?null:id);}};

 const misplaced=state.lineup.filter(id=>!fitsPosition(playerMap[id],state.defense[id]));
 const unfit=state.pitchers.filter((id,i)=>pitcherRolePenalty(playerMap[id],pitcherSlotRole(i))>0);
 const handSlots=hand?new Set([...state.lineup.map((_,i)=>`bat-${i}`),...state.pitchers.map((_,i)=>`pit-${i}`)].filter(k=>{const [kind,i]=k.split('-');return replacementPool(state,kind as Kind,Number(i)).some(p=>p.id===hand);})):null;

 // ---- bench list ----
 const role=filter.role==='auto'?(tab==='bat'?'batter':tab==='bench'?'all':'pitcher'):filter.role;
 const eligible=picked?new Set(replacementPool(state,picked.kind,picked.index).map(p=>p.id)):null;
 const visible=useMemo(()=>{
  const band=ageBands.find(b=>b.value===filter.age)??ageBands[0];
  const rows=benchAll.filter(p=>matchesPlayerName(p,filter.search)
   &&(role==='all'||(role==='batter'?canBat(p):p.role==='pitcher'))
   &&(filter.team==='all'||(filter.team==='mlb'?!!p.mlb:p.team===filter.team))
   &&(filter.pos==='all'||(['先','中','抑'].includes(filter.pos)?p.role==='pitcher'&&['◎','○'].includes(aptitudeMark(p,filter.pos as PitcherRole)):p.role!=='pitcher'&&fitsPosition(p,filter.pos)))
   &&(!eligible||!slotOnly||eligible.has(p.id)))
   .map(p=>({p,age:playerAge(p),overall:ovr(p.id),r:ratingsOf(p.id)}))
   .filter(x=>band.value==='all'||x.age!==null&&x.age>=band.min&&x.age<=band.max);
  const key=filter.sort;
  rows.sort((a,b)=>{
   let d=0;
   if(key==='overall-desc'||key==='overall-asc')d=(key==='overall-asc'?1:-1)*(a.overall-b.overall);
   else if(key==='age-asc'||key==='age-desc')d=a.age===null?(b.age===null?0:1):b.age===null?-1:(key==='age-asc'?1:-1)*(a.age-b.age);
   else if(key==='team')d=a.p.team.localeCompare(b.p.team);
   else if(key==='name')d=a.p.name.localeCompare(b.p.name,'ja');
   else if(key==='traits')d=traitsOf(b.p).length-traitsOf(a.p).length;
   else if(key==='awaken')d=(state.training[b.p.id]??0)-(state.training[a.p.id]??0);
   else{const v=(x:typeof a)=>{const isP=x.p.role==='pitcher',bat=['contact','power','speed','arm','field'].includes(key);return bat===isP&&!(bat&&canBat(x.p))?-1:(x.r[key as keyof Ratings] as number);};d=v(b)-v(a);}
   return d||b.overall-a.overall||a.p.id.localeCompare(b.p.id);
  });
  return rows.map(x=>x.p);
 },[filter,role,tab,state,picked,slotOnly]);
 const filtered=filter.search!==''||filter.pos!=='all'||filter.age!=='all'||filter.team!=='all'||filter.role!=='auto'||filter.sort!=='overall-desc';

 const ageText=(p:Player)=>{const a=playerAge(p);return a===null?'年齢—':`${a}歳`;};
 const awakenBadge=(id:string)=>(state.training[id]??0)>0&&<span className="pw-awk" aria-label={`覚醒${state.training[id]}段階`}>覚醒{state.training[id]}</span>;
 const batCells=(r:Ratings)=>([['ミート',r.contact],['パワー',r.power],['走力',r.speed],['肩',r.arm],['守備',r.field]] as const).map(([l,v])=><span key={l} className="pw-rcell"><small>{l}</small><Rank value={v} label={l} showValue/></span>);
 const pitCells=(p:Player,r:Ratings)=>[<span key="v" className="pw-rcell pw-velo-cell"><small>球速</small><b>{p.ratings.velocity}<em>km/h</em></b></span>,...([['制球',r.control],['スタミナ',r.stamina],['変化',r.breaking]] as const).map(([l,v])=><span key={l} className="pw-rcell"><small>{l}</small><Rank value={v} label={l} showValue/></span>)];

 const batRow=(id:string,i:number)=>{
  const p=playerMap[id],pos=state.defense[id],fit=fitsPosition(p,pos),r=ratingsOf(id),key=`bat-${i}`;
  const cls='pw-row pw-r2'+(fit?'':' is-unfit')+(over===key?' is-over':'')+(drag?.from==='slot'&&drag.kind==='bat'&&drag.index===i?' is-dragging':'')+(picked?.kind==='bat'&&picked.index===i?' is-picked':'')+(handSlots?.has(key)?' can-take':'');
  return <li key={id} className={cls} data-slot-kind="bat" data-slot-index={i} {...dragProps({from:'slot',kind:'bat',index:i,id})}>
   <div className="pw-r2-slot">
    <button className="pw-handle pw-order" aria-label={`${p.name}の打順 ${i+1}番(ドラッグで移動、タップで選ぶ)`} aria-pressed={picked?.kind==='bat'&&picked.index===i} onClick={()=>tapOrder({kind:'bat',index:i})}>{i+1}</button>
    <button className={'pw-posbtn'+(defender===id?' is-picked':'')} aria-label={`${p.name}の守備位置 ${pos}(タップで交換)`} aria-pressed={defender===id} onClick={()=>tapDefense(id)}><PosChip pos={pos}/></button>
   </div>
   <OvrBox value={ovr(id)} player={p}/>
   <div className="pw-r2-main">
    <div className="pw-r2-name"><button data-player-id={id} onClick={()=>onPlayer(p)}>{p.name}</button><span className="pw-age">{ageText(p)}</span>{awakenBadge(id)}{!fit&&<em className="pw-unfit-tag">適性外</em>}</div>
    <div className="pw-r2-ranks">{batCells(r)}</div>
   </div>
   <GripVertical className="pw-grip" size={18} aria-hidden="true"/>
  </li>;
 };
 const pitRow=(id:string,i:number)=>{
  const p=playerMap[id],role=pitcherSlotRole(i),fit=pitcherRolePenalty(p,role)===0,r=pitchingRatingsForRole(p,ratingsOf(id),role),key=`pit-${i}`;
  const cls='pw-row pw-r2 pw-r2-pit'+(fit?'':' is-unfit')+(over===key?' is-over':'')+(drag?.from==='slot'&&drag.kind==='pit'&&drag.index===i?' is-dragging':'')+(picked?.kind==='pit'&&picked.index===i?' is-picked':'')+(handSlots?.has(key)?' can-take':'');
  return <li key={id} className={cls} data-slot-kind="pit" data-slot-index={i} {...dragProps({from:'slot',kind:'pit',index:i,id})}>
   <div className="pw-r2-slot"><button className="pw-handle pw-order pw-order-role" aria-label={`${p.name} ${slotName('pit',i)}(ドラッグで移動、タップで選ぶ)`} aria-pressed={picked?.kind==='pit'&&picked.index===i} onClick={()=>tapOrder({kind:'pit',index:i})}><RoleChip role={role}/><small>{role==='先'?i+1:role==='中'?i-5:''}</small></button></div>
   <OvrBox value={ovr(id)} player={p}/>
   <div className="pw-r2-main">
    <div className="pw-r2-name"><button data-player-id={id} onClick={()=>onPlayer(p)}>{p.name}</button><span className="pw-age">{ageText(p)}</span>{awakenBadge(id)}{!fit&&<em className="pw-unfit-tag">役割適性外</em>}</div>
    <div className="pw-r2-ranks">{pitCells(p,r)}</div>
    <div className="pw-apts">{(['先','中','抑'] as const).map(x=><span key={x} className="pw-aptcell">{x==='先'?'先発':x==='中'?'中継ぎ':'抑え'}<AptMark mark={aptitudeMark(p,x)}/></span>)}</div>
   </div>
   <GripVertical className="pw-grip" size={18} aria-hidden="true"/>
  </li>;
 };
 const benchRow=(p:Player)=>{const pitcher=p.role==='pitcher',r=ratingsOf(p.id),traits=traitsOf(p),canTake=!!picked&&!!eligible?.has(p.id);
  return <li key={p.id} className={'pw-row pw-r2 pw-bench2'+(hand===p.id?' is-picked':'')} {...dragProps({from:'bench',kind:pitcher?'pit':'bat',index:-1,id:p.id})}>
   <OvrBox value={ovr(p.id)} player={p}/>
   <div className="pw-r2-main">
    <div className="pw-r2-name"><button data-player-id={p.id} onClick={()=>onPlayer(p)}>{p.name}</button><span className="pw-age">{ageText(p)}</span>{awakenBadge(p.id)}</div>
    <p className="pw-bench-sub">{pitcher?<RoleChip role={aptitudeMark(p,'先')==='◎'||aptitudeMark(p,'先')==='○'?'先':aptitudeMark(p,'抑')==='◎'?'抑':'中'}/>:<PosChip pos={p.positions[0]??'DH'}/>}<span>{teamById(p.team).short}{p.mlb?' · 海外':''} · {pitcher?(['先','中','抑'] as const).map(x=>`${x}${aptitudeMark(p,x)}`).join(' '):p.positions.join('・')||'DH'}</span></p>
    <div className="pw-r2-ranks">{pitcher?pitCells(p,r):batCells(r)}</div>
    {p.mlb?.twoWay&&<div className="pw-r2-ranks pw-r2-extra">{batCells(r)}</div>}
    {traits.length>0&&<ul className="pw-bench-traits" aria-label="特殊能力">{traits.slice(0,4).map((t,i)=><li key={t+i}>{t}</li>)}{traits.length>4&&<li className="is-more">ほか{traits.length-4}</li>}</ul>}
   </div>
   <button className={'pw-btn pw-mini '+(canTake?'pw-yellow':'pw-blue')} onClick={()=>{if(picked){if(eligible?.has(p.id))replace(picked,p.id);else setNotice(`${slotName(picked.kind,picked.index)}には入れられない選手です。`);return;}setDefender(null);setHand(hand===p.id?null:p.id);if(tab==='bench'||tab==='bat'&&pitcher||tab!=='bat'&&!pitcher)setTab(pitcher?'先':'bat');window.scrollTo({top:0,behavior:'smooth'});}}>{picked?(canTake?'ここに入れる':'入れられない'):hand===p.id?'選択中':'編成する'}</button>
  </li>;};
 const pitchGroup=(role:'先'|'中'|'抑')=>{const [from,to]=role==='先'?[0,6]:role==='中'?[6,13]:[13,14];return <ol className="pw-rows">{state.pitchers.slice(from,to).map((id,k)=>pitRow(id,from+k))}</ol>;};
 const select=(label:string,value:string,options:[string,string][],set:(v:string)=>void)=><label className="pw-filter"><span>{label}</span><select value={value} aria-label={`控えの${label}`} onChange={e=>set(e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>;

 return <div className="pw-team">
  <section className="pw-panel pw-team-head">
   <header><h2>{tab==='bat'?'スターティングメンバー':tab==='bench'?'控え選手':'投手陣'}</h2>
    {tab==='bat'&&misplaced.length>0&&<span className="pw-warn-pill"><AlertTriangle size={15}/>守備適性外 {misplaced.length}人</span>}
    {tab!=='bat'&&tab!=='bench'&&unfit.length>0&&<span className="pw-warn-pill"><AlertTriangle size={15}/>役割適性外 {unfit.length}人</span>}
   </header>
   <div className="pw-team-power" aria-label="チームの総合の平均"><span><small>打線</small><b>{Math.round(state.lineup.reduce((n,id)=>n+ovr(id),0)/Math.max(1,state.lineup.length))}</b></span><span><small>投手陣</small><b>{Math.round(state.pitchers.reduce((n,id)=>n+ovr(id),0)/Math.max(1,state.pitchers.length))}</b></span><span><small>所持カード</small><b>{Object.keys(state.owned).length}<em>枚</em></b></span></div>
   <div className="pw-team-actions"><button className="pw-btn pw-blue" onClick={auto}><Shuffle size={18}/>おまかせ編成</button>{onSeason&&<button className="pw-btn pw-yellow" onClick={onSeason}>試合へ進む<ChevronRight size={18}/></button>}</div>
   <div className="pw-tabs" role="tablist" aria-label="編成する選手">{([['bat','野手 9'],['先','先発 6'],['中','中継ぎ 7'],['抑','抑え 1'],['bench',`控え ${benchAll.length}`]] as const).map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'is-on':''} onClick={()=>{setTab(id);setPicked(null);setDefender(null);}}>{label}</button>)}</div>
  </section>

  {(hand||picked||defender)&&<div className="pw-hint" role="status"><span>{hand?`${playerMap[hand].name}を入れる枠の番号をタップ(光っている枠に入れられます)`:picked?<>{slotName(picked.kind,picked.index)}を選択中。ほかの番号で入れ替え、または下の控えから「ここに入れる」。{tab!=='bench'&&<button className="pw-hint-jump" onClick={()=>benchRef.current?.scrollIntoView({behavior:'smooth'})}>控えを見る</button>}</>:`${state.defense[defender!]}(${playerMap[defender!].name})と交換する守備位置をタップ`}</span><button aria-label="選択を解除" onClick={clear}><X size={20}/></button></div>}

  {tab==='bat'&&<section className="pw-panel pw-lineup">
   {misplaced.length>0&&<p className="pw-warn"><AlertTriangle size={18}/><b>守備適性外 {misplaced.length}人</b><span>被安打・失策が増え、失点しやすくなります。{misplaced.some(id=>state.defense[id]==='捕')&&'捕手の適性外は盗塁も許しやすくなります。'}</span></p>}
   <ol className="pw-rows">{state.lineup.map((id,i)=>batRow(id,i))}</ol>
   <p className="pw-tip">番号を長押ししてドラッグで打順を入れ替え。番号をタップして選ぶと、ほかの番号や控えと入れ替えられます。守備位置は2つタップで交換。</p>
  </section>}
  {tab!=='bat'&&tab!=='bench'&&<section className="pw-panel pw-lineup">
   {unfit.length>0&&<p className="pw-warn"><AlertTriangle size={18}/><b>投手の役割適性不足 {unfit.length}人</b><span>制球・変化球が低下し、四死球や失点が増えやすくなります。</span></p>}
   {pitchGroup(tab)}
   <p className="pw-tip">ドラッグで先発・中継ぎ・抑えの間も移動できます(ほかのタブの枠へは、番号のタップで交換)。</p>
   <div className="pw-legend"><span><AptMark mark="◎"/>最も適した役割</span><span><AptMark mark="○"/>適した役割</span><span><AptMark mark="△"/>やや不向き</span><span><AptMark mark="×"/>不向き</span></div>
  </section>}

  <section className="pw-panel pw-bench" ref={benchRef}>
   <header><h2>{picked?`${slotName(picked.kind,picked.index)}に入れる選手`:role==='batter'?'控え(野手)':role==='pitcher'?'控え(投手)':'控え選手'}</h2><span>{visible.length}人</span></header>
   <div className="pw-filters">
    <label className="pw-search"><Search size={18}/><input value={filter.search} onChange={e=>setFilter({...filter,search:e.target.value})} placeholder="選手名で探す" aria-label="控えを選手名で検索"/></label>
    <div className="pw-seg pw-role-seg" role="group" aria-label="控えの種類">{([['all','すべて'],['batter','野手'],['pitcher','投手']] as const).map(([v,l])=><button key={v} aria-pressed={role===v} className={role===v?'is-on':''} onClick={()=>setFilter({...filter,role:v,pos:'all'})}>{l}</button>)}</div>
    <div className="pw-filter-grid">
     {select('並べ替え',filter.sort,sortLabels,v=>setFilter({...filter,sort:v as Sort}))}
     {select('ポジション',filter.pos,posOptions,v=>setFilter({...filter,pos:v}))}
     {select('年齢',filter.age,ageBands.map(b=>[b.value,b.label] as [string,string]),v=>setFilter({...filter,age:v}))}
     {select('球団',filter.team,[['all','全球団'],['mlb','海外選手すべて'],...cardTeams.npb.map(t=>[t.id,t.short] as [string,string]),...cardTeams.mlb.map(t=>[t.id,t.short] as [string,string])],v=>setFilter({...filter,team:v}))}
    </div>
    {(picked||filtered)&&<div className="pw-filter-foot">{picked&&<label className="pw-check"><input type="checkbox" checked={slotOnly} onChange={e=>setSlotOnly(e.target.checked)}/>この枠に入れられる選手だけ</label>}{filtered&&<button className="pw-btn pw-white pw-mini" onClick={()=>setFilter(defaultFilter)}>条件を元に戻す</button>}</div>}
   </div>
   {visible.length?<ul className="pw-rows">{visible.map(benchRow)}</ul>:<p className="pw-note">{benchAll.length?'条件に合う選手はいません。':'控えの選手はいません。スカウトで仲間を増やそう。'}</p>}
   <p className="pw-tip">控えの選手は、長押しして上の枠へドラッグするか、「編成する」→ 入れたい枠の番号をタップ。</p>
  </section>

  <div className="pw-links">{onCatalog&&<button className="pw-btn pw-white" onClick={onCatalog}><BookOpen size={18}/>カード図鑑</button>}</div>
  {onReset&&<details className="pw-panel pw-reset"><summary>チームをリセット</summary><p>退避してやり直すか、獲得カードを含めて完全に消すか選べます。</p><button className="pw-btn pw-white" onClick={onReset}>退避してリセット</button>{canRestore&&onRestore&&<button className="pw-btn pw-white" onClick={onRestore}>リセット前のチームに戻す</button>}{onCompleteReset&&<button className="pw-btn pw-white pw-danger" onClick={onCompleteReset}>カードも消して完全リセット</button>}</details>}
  {ghost&&<div className="pw-ghost" style={{left:ghost.x+12,top:ghost.y+8}}>{ghost.name}</div>}
  {notice&&<div className="pw-toast" role="status">{notice}</div>}
 </div>;
}
