import {useEffect,useMemo,useRef,useState,type JSX,type PointerEvent as RPointerEvent} from 'react';
import {AlertTriangle,BookOpen,ChevronRight,GripVertical,Search,Shuffle,X} from 'lucide-react';
import {canBat,fitsPosition,formatAvg,grade,matchesPlayerName,playerMap,teamById,type Player,type Ratings} from '../data';
import {effectiveOverall,type GameState} from '../engine';
import {buildByStrategy} from '../franchise';
import {reorderSimplePlayer,replacementPool,replaceSimplePlayer,swapDefense} from '../simple-game';
import {ownedRatings,playerAge} from '../development';
import {seasonConditions} from '../conditions';
import {battingAverage,era,ops} from '../engine';
import {pitcherRolePenalty,pitcherSlotRole,pitchingRatingsForRole,type PitcherRole} from '../pitcher-aptitude';
import {ageBands,cardTeams} from '../player-browser';
import {OvrBox,PosChip,Rank,RoleChip,fitName} from './PawaCard';

type Kind='bat'|'pit';
type Slot={kind:Kind;index:number};
type Drag={from:'slot'|'bench';kind:Kind;index:number;id:string};
const slotName=(kind:Kind,i:number)=>kind==='bat'?`${i+1}番`:i<6?`先発${i+1}`:i===13?'抑え':`中継ぎ${i-5}`;
const hiddenTraits=['暫定査定','基本能力型','実戦派'];
const traitsOf=(p:Player)=>p.traits.filter(t=>!hiddenTraits.includes(t));
const metalOf=(v:number,p:Player)=>v>=95?'rainbow':v>=85||p.mlb?'gold':v>=70?'silver':'bronze';

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

// 野手の今季の成績(打率・本塁打・打点・OPS)。打席が無い選手は「-」(2026-10-19 持ち主「チームの野手に打率・打点・本塁打・OPS」)。
export function BatLine({b,short=false}:{b?:{pa:number;ab:number;hr:number;rbi:number}&Parameters<typeof ops>[0];short?:boolean}){
 const has=!!b?.pa,avg=has&&b!.ab?formatAvg(battingAverage(b!)):'-',o=has?formatAvg(ops(b!)):'-',hr=has?String(b!.hr):'-',rbi=has?String(b!.rbi):'-';
 return short?<span className="pw-batline is-short" aria-label={`打率${avg} 本塁打${hr} 打点${rbi} OPS${o}`}><span>打率<b>{avg}</b></span><span><b>{hr}</b>本</span><span><b>{rbi}</b>点</span><span>OPS<b>{o}</b></span></span>
 :<span className="pw-batline"><span>打率<b>{avg}</b></span><span>本塁打<b>{hr}</b></span><span>打点<b>{rbi}</b></span><span>OPS<b>{o}</b></span></span>;
}

export function PawaTeam({state,onChange,onPlayer,onImpact,onReset,onRestore,onCompleteReset,onCatalog,canRestore=false,onSeason}:{state:GameState;onChange:(s:GameState)=>void;onPlayer:(p:Player)=>void;onImpact:()=>void;onReset?:()=>void;onRestore?:()=>void;onCompleteReset?:()=>void;onCatalog?:()=>void;canRestore?:boolean;onSeason?:()=>void}){
 const [tab,setTab]=useState<'bat'|'先'|'中'|'抑'|'bench'>('bat'),[hand,setHand]=useState<string|null>(null),[picked,setPicked]=useState<Slot|null>(null),[defender,setDefender]=useState<string|null>(null),[notice,setNotice]=useState('');
 const [filter,setFilter]=useState<BenchFilter>(defaultFilter),[slotOnly,setSlotOnly]=useState(true);
 const [boardTab,setBoardTab]=useState<'bat'|'pit'>('bat');
 const [wide,setWide]=useState(()=>typeof matchMedia==='function'&&matchMedia('(min-width:1000px)').matches);
 useEffect(()=>{if(typeof matchMedia!=='function')return;const m=matchMedia('(min-width:1000px)'),f=()=>setWide(m.matches);m.addEventListener?.('change',f);return()=>m.removeEventListener?.('change',f);},[]);
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
 const role=filter.role==='auto'?'all':filter.role;
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
 },[filter,role,state,picked,slotOnly]);
 const filtered=filter.search!==''||filter.pos!=='all'||filter.age!=='all'||filter.team!=='all'||filter.role!=='auto'||filter.sort!=='overall-desc';

 const ageText=(p:Player)=>{const a=playerAge(p);return a===null?'年齢—':`${a}歳`;};
 const awakenBadge=(id:string)=>(state.training[id]??0)>0&&<span className="pw-awk" aria-label={`覚醒${state.training[id]}段階`}>覚醒{state.training[id]}</span>;
 const batCells=(r:Ratings)=>([['ミート',r.contact],['パワー',r.power],['走力',r.speed],['肩',r.arm],['守備',r.field]] as const).map(([l,v])=><span key={l} className="pw-rcell"><small>{l}</small><Rank value={v} label={l} showValue/></span>);
 const pitCells=(p:Player,r:Ratings)=>[<span key="v" className="pw-rcell pw-velo-cell"><small>球速</small><b>{p.ratings.velocity}<em>km/h</em></b></span>,...([['制球',r.control],['スタミナ',r.stamina],['変化',r.breaking]] as const).map(([l,v])=><span key={l} className="pw-rcell"><small>{l}</small><Rank value={v} label={l} showValue/></span>)];

 // ---- 1画面の編成ボード: 左に打順1〜9、右に投手14人。行を押すと、その枠の入れ替えシートが開く ----
 const rowState=(kind:Kind,i:number)=>{const key=`${kind}-${i}`;return (over===key?' is-over':'')+(drag?.from==='slot'&&drag.kind===kind&&drag.index===i?' is-dragging':'')+(picked?.kind===kind&&picked.index===i?' is-picked':'')+(handSlots?.has(key)?' can-take':'');};
 const tapRow=(slot:Slot)=>{if(justDragged.current)return;if(hand){replace(slot,hand);return;}setDefender(null);setPicked(slot);};
 // 各行: 名前を押すと選手の詳細、それ以外の所を押すと入れ替えシート。能力は控えの一覧と同じ「項目名・ランク・数値」、下に今季の成績。
 const conds=new Map((state.season.completed?[]:seasonConditions(state)).map(c=>[c.playerId,c.boost]));
 const condChip=(id:string)=>{const b=conds.get(id);return b===undefined||state.season.day===0?null:<i className={'pw-cond '+(b<0?'is-cold':'is-hot')}>{b===5?'絶好調':b>0?'好調':'不調'}</i>;};
 const tileItems=(vals:[string,number][],label=true)=>vals.map(([l,v])=>{const x=Math.min(99,v);return <span key={l} className="pw-b4-t" title={`${l} ${x}`}>{label&&<small>{l}</small>}<i data-rank={grade(x)} aria-label={`${l} ${grade(x)}`}>{grade(x)}</i><b>{x}</b></span>;});
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
   <button className={'pw-btn pw-mini '+(canTake?'pw-yellow':'pw-blue')} onClick={()=>{if(picked){if(eligible?.has(p.id))replace(picked,p.id);else setNotice(`${slotName(picked.kind,picked.index)}には入れられない選手です。`);return;}setDefender(null);setHand(hand===p.id?null:p.id);window.scrollTo({top:0,behavior:'smooth'});}}>{picked?(canTake?'ここに入れる':'入れられない'):hand===p.id?'選択中':'編成する'}</button>
  </li>;};
 // ---- 2タブの編成(野手/投手)。1行にゆとりを持たせ、能力はランクと数値、今季の成績、調子まで ----
 const row5=(kind:Kind,i:number,id:string,extra:string,label:string,left:JSX.Element,tilesEl:JSX.Element,stat:JSX.Element,topStat?:JSX.Element)=>{
  const p=playerMap[id];
  return <li key={id} className={'pw-b5'+extra+rowState(kind,i)} data-slot-kind={kind} data-slot-index={i} {...dragProps({from:'slot',kind,index:i,id})}>
   <div className="pw-b5-row" role="button" tabIndex={0} aria-label={`${label}(押すと入れ替え、長押しでドラッグ)`} onClick={()=>tapRow({kind,index:i})} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tapRow({kind,index:i});}}}>
    <span className="pw-b5-left">{left}</span>
    <span className="pw-b5-main">
     <span className="pw-b5-top"><button className="pw-b4-name" style={fitName(p.name,kind==='pit'?96:108,15)} data-player-id={id} aria-label={`${p.name}の詳細`} onClick={e=>{e.stopPropagation();onPlayer(p);}}>{p.name}</button><small>{ageText(p)}</small>{condChip(id)}{awakenBadge(id)}{topStat&&<span className="pw-b5-topstat">{topStat}</span>}</span>
     <span className="pw-b5-sub">{tilesEl}<span className="pw-b5-stat">{stat}</span></span>
    </span>
    <span className="pw-b4-ovr pw-b5-ovr" data-metal={metalOf(ovr(id),p)}>{ovr(id)}</span>
   </div>
  </li>;
 };
 const bat5=(id:string,i:number)=>{const p=playerMap[id],pos=state.defense[id],fit=fitsPosition(p,pos),r=ratingsOf(id),b=state.season.batting[`${state.club}|${id}`];
  return row5('bat',i,id,fit?'':' is-unfit',`${i+1}番 ${pos} ${p.name} 総合${ovr(id)}`,<><span className="pw-b3-no">{i+1}</span><PosChip pos={pos}/></>,
   <span className="pw-b4-tiles">{tileItems([['ミート',r.contact],['パワー',r.power],['走力',r.speed],['肩',r.arm],['守備',r.field]],false)}</span>,
   <>{!fit&&<em>適性外 </em>}<BatLine b={b}/></>,<BatLine b={b} short/>);};
 const pit5=(id:string,i:number)=>{const p=playerMap[id],role=pitcherSlotRole(i),fit=pitcherRolePenalty(p,role)===0,r=pitchingRatingsForRole(p,ratingsOf(id),role),q=state.season.pitching[`${state.club}|${id}`];
  return row5('pit',i,id,' pw-b5-p'+(fit?'':' is-unfit'),`${slotName('pit',i)} ${p.name} 総合${ovr(id)}`,<span className={'pw-b3-no pw-b3-role pw-role-'+role}>{role==='先'?`先${i+1}`:role==='中'?`中${i-5}`:'抑'}</span>,
   <span className="pw-b4-tiles"><span className="pw-b4-t pw-b4-velo" title={`球速 ${p.ratings.velocity}km/h`}><b>{p.ratings.velocity}</b><em>km</em></span>{tileItems([['制球',r.control],['スタミナ',r.stamina],['変化',r.breaking]],false)}</span>,
   q?.outs?<>{!fit&&<em>適性外 </em>}<span className="pw-b5-k">防<b>{era(q).toFixed(2)}</b></span><span className="pw-b5-more"><b>{q.wins}</b>勝<b>{q.losses}</b>敗<b>{q.saves}</b>S<b>{q.so}</b>K</span></>:<>{!fit&&<em>適性外 </em>}今季の登板なし</>);};
 const head5=(labels:string[],stat:string)=><li className="pw-b5-head" aria-hidden="true"><span className="pw-b5-left"/><span className="pw-b5-main"><span className="pw-b5-sub"><span className="pw-b4-tiles">{labels.map(l=><small key={l}>{l}</small>)}</span><small className="pw-b5-stat">{stat}</small></span></span><span className="pw-b5-ovr-sp">総合</span></li>;
 const sec5=(title:string,extra?:JSX.Element)=><li className="pw-b5-sec" aria-hidden="true"><b>{title}</b>{extra}</li>;
 const avg5=(ids:string[])=>Math.round(ids.reduce((n,id)=>n+ovr(id),0)/Math.max(1,ids.length));
 const batList=<ol className="pw-b5-list" aria-label="野手(打順)">{sec5('打順',<small>打線 総合 {avg5(state.lineup)}</small>)}{head5(['ミート','パワー','走力','肩','守備'],'今季')}{state.lineup.map((id,i)=>bat5(id,i))}</ol>;
 const pitList=<ol className="pw-b5-list pw-b5-plist" aria-label="投手">{sec5('先発',<small>投手 総合 {avg5(state.pitchers)}</small>)}{head5(['球速','制球','スタミナ','変化'],'今季')}{state.pitchers.slice(0,6).map((id,i)=>pit5(id,i))}{sec5('中継ぎ')}{state.pitchers.slice(6,13).map((id,k)=>pit5(id,6+k))}{sec5('抑え')}{state.pitchers[13]&&pit5(state.pitchers[13],13)}</ol>;
 const actions=<div className="pw-board-actions"><button className="pw-btn pw-blue" onClick={auto}><Shuffle size={18}/>おまかせ編成</button><button className="pw-btn pw-white" onClick={()=>benchRef.current?.scrollIntoView({behavior:'smooth'})}>控え {benchAll.length}人</button>{onSeason&&<button className="pw-btn pw-yellow" onClick={onSeason}>試合へ<ChevronRight size={18}/></button>}</div>;
 const sheetId=picked?(picked.kind==='bat'?state.lineup:state.pitchers)[picked.index]:null,sheetPlayer=sheetId?playerMap[sheetId]:null;
 const candidates=picked?replacementPool(state,picked.kind,picked.index).filter(p=>p.id!==sheetId).sort((a,b)=>ovr(b.id)-ovr(a.id)):[];
 const select=(label:string,value:string,options:[string,string][],set:(v:string)=>void)=><label className="pw-filter"><span>{label}</span><select value={value} aria-label={`控えの${label}`} onChange={e=>set(e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>;

 return <div className="pw-team pw-team3">
  {(misplaced.length>0||unfit.length>0)&&<p className="pw-warn-pill pw-t3-warn"><AlertTriangle size={14}/>{misplaced.length>0&&`守備適性外 ${misplaced.length}人`}{misplaced.length>0&&unfit.length>0&&' · '}{unfit.length>0&&`役割適性外 ${unfit.length}人`}(赤い行)</p>}
  {hand&&<div className="pw-hint pw-hint-float" role="status"><span>{playerMap[hand].name}を入れる枠を押してください(光っている枠)</span><button aria-label="選択を解除" onClick={clear}><X size={20}/></button></div>}
  {wide?<div className="pw-board5 is-wide"><section aria-label="野手">{batList}</section><section aria-label="投手">{pitList}{actions}</section></div>
  :<div className="pw-board5"><div className="pw-seg pw-b5-tabs" role="tablist" aria-label="野手と投手">{([['bat','野手'],['pit','投手']] as const).map(([v,l])=><button key={v} role="tab" aria-selected={boardTab===v} className={boardTab===v?'is-on':''} onClick={()=>setBoardTab(v)}>{l}<small>{v==='bat'?'打順9人':'先発・中継ぎ・抑え 14人'}</small></button>)}</div>{boardTab==='bat'?batList:pitList}</div>}
  {!wide&&actions}

  {picked&&sheetPlayer&&<div className="pw-modal pw-sheet-modal" onClick={clear}><div className="pw-sheet pw-slot-sheet" role="dialog" aria-modal="true" aria-label={`${slotName(picked.kind,picked.index)}の入れ替え`} onClick={e=>e.stopPropagation()}>
   <header className="pw-sheet-head"><h2>{slotName(picked.kind,picked.index)}{picked.kind==='bat'&&` · ${state.defense[sheetId!]}`} {sheetPlayer.name} <small>総合{ovr(sheetId!)}</small></h2><button className="pw-close" onClick={clear} aria-label="閉じる"><X size={22}/></button></header>
   <div className="pw-slot-acts"><button className="pw-btn pw-white pw-mini" onClick={()=>{const p=sheetPlayer;clear();onPlayer(p);}}>この選手の詳細</button></div>
   <h4>控えから入れる({candidates.length}人)</h4>
   {candidates.length?<ul className="pw-slot-cands">{candidates.map(p=>{const r=ratingsOf(p.id),pit=p.role==='pitcher';return <li key={p.id} className="pw-cand"><span className="pw-b3-ovr" data-metal={metalOf(ovr(p.id),p)}>{ovr(p.id)}</span><span className="pw-cand-main"><span className="pw-b4-top"><button className="pw-b4-name" data-player-id={p.id} aria-label={`${p.name}の詳細`} onClick={()=>{clear();onPlayer(p);}}>{p.name}</button><small>{ageText(p)} · {pit?(['先','中','抑'] as const).map(x=>`${x}${aptitudeMark(p,x)}`).join(' '):p.positions.join('・')||'DH'}</small></span><span className="pw-b4-tiles">{pit&&<span className="pw-b4-t pw-b4-velo"><small>球速</small><b>{p.ratings.velocity}</b><em>km</em></span>}{tileItems(pit?[['制球',r.control],['スタミナ',r.stamina],['変化',r.breaking]]:[['ミート',r.contact],['パワー',r.power],['走力',r.speed],['肩',r.arm],['守備',r.field]])}</span></span><button className="pw-btn pw-yellow pw-mini pw-cand-in" onClick={()=>replace(picked,p.id)}>入れる</button></li>;})}</ul>:<p className="pw-note">この枠に入れられる控えはいません。</p>}
   <h4>{picked.kind==='bat'?'打順を入れ替える':'投手の枠を入れ替える'}</h4>
   <div className="pw-slot-grid">{(picked.kind==='bat'?state.lineup:state.pitchers).map((id,i)=>i===picked.index?null:<button key={id} className="pw-btn pw-white pw-mini" onClick={()=>drop({from:'slot',kind:picked.kind,index:picked.index,id:sheetId!},{kind:picked.kind,index:i})}><b>{slotName(picked.kind,i)}</b>{playerMap[id].name}</button>)}</div>
   {picked.kind==='bat'&&<><h4>守備位置を入れ替える</h4><div className="pw-slot-grid">{state.lineup.filter(id=>id!==sheetId).map(id=><button key={id} className="pw-btn pw-white pw-mini" onClick={()=>{commit(swapDefense(state,sheetId!,id),'守備位置を交換しました。');clear();}}><b>{state.defense[id]}</b>{playerMap[id].name}</button>)}</div></>}
  </div></div>}

  <section className="pw-panel pw-bench" ref={benchRef}>
   <header><h2>{role==='batter'?'控え(野手)':role==='pitcher'?'控え(投手)':'控え選手'}</h2><span>{visible.length}人</span></header>
   <div className="pw-filters">
    <label className="pw-search"><Search size={18}/><input value={filter.search} onChange={e=>setFilter({...filter,search:e.target.value})} placeholder="選手名で探す" aria-label="控えを選手名で検索"/></label>
    <div className="pw-seg pw-role-seg" role="group" aria-label="控えの種類">{([['all','すべて'],['batter','野手'],['pitcher','投手']] as const).map(([v,l])=><button key={v} aria-pressed={role===v} className={role===v?'is-on':''} onClick={()=>setFilter({...filter,role:v,pos:'all'})}>{l}</button>)}</div>
    <div className="pw-filter-grid">
     {select('並べ替え',filter.sort,sortLabels,v=>setFilter({...filter,sort:v as Sort}))}
     {select('ポジション',filter.pos,posOptions,v=>setFilter({...filter,pos:v}))}
     {select('年齢',filter.age,ageBands.map(b=>[b.value,b.label] as [string,string]),v=>setFilter({...filter,age:v}))}
     {select('球団',filter.team,[['all','全球団'],['mlb','海外選手すべて'],...cardTeams.npb.map(t=>[t.id,t.short] as [string,string]),...cardTeams.mlb.map(t=>[t.id,t.short] as [string,string])],v=>setFilter({...filter,team:v}))}
    </div>
    {filtered&&<div className="pw-filter-foot"><button className="pw-btn pw-white pw-mini" onClick={()=>setFilter(defaultFilter)}>条件を元に戻す</button></div>}
   </div>
   {visible.length?<ul className="pw-rows">{visible.map(benchRow)}</ul>:<p className="pw-note">{benchAll.length?'条件に合う選手はいません。':'控えの選手はいません。スカウトで仲間を増やそう。'}</p>}
   <p className="pw-tip">控えの選手は「編成する」→ 入れたい枠を押す。上の枠を押して、その枠に入れられる控えから選ぶこともできます。長押しでドラッグも可。</p>
  </section>

  <div className="pw-links">{onCatalog&&<button className="pw-btn pw-white" onClick={onCatalog}><BookOpen size={18}/>カード図鑑</button>}</div>
  {onReset&&<details className="pw-panel pw-reset"><summary>チームをリセット</summary><p>退避してやり直すか、獲得カードを含めて完全に消すか選べます。</p><button className="pw-btn pw-white" onClick={onReset}>退避してリセット</button>{canRestore&&onRestore&&<button className="pw-btn pw-white" onClick={onRestore}>リセット前のチームに戻す</button>}{onCompleteReset&&<button className="pw-btn pw-white pw-danger" onClick={onCompleteReset}>カードも消して完全リセット</button>}</details>}
  {ghost&&<div className="pw-ghost" style={{left:ghost.x+12,top:ghost.y+8}}>{ghost.name}</div>}
  {notice&&<div className="pw-toast" role="status">{notice}</div>}
 </div>;
}
