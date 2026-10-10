import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,ArrowDown,ArrowUp,BookOpen,ChevronLeft,ChevronRight,Search,Shuffle,X} from 'lucide-react';
import {fitsPosition,playerMap,teamById,type Player} from '../data';
import {effectiveOverall,type GameState} from '../engine';
import {buildByStrategy} from '../franchise';
import {reorderSimplePlayer,replacementPool,replaceSimplePlayer,swapDefense} from '../simple-game';
import {ownedRatings,playerAge} from '../development';
import {pitcherRolePenalty,pitcherSlotRole,pitchingRatingsForRole,type PitcherRole} from '../pitcher-aptitude';
import {PawaCard,GradeRow} from './PawaCard';

type Kind='bat'|'pit';
type Slot={kind:Kind;index:number};
const slotLabel=(kind:Kind,i:number)=>kind==='bat'?`${i+1}番`:i<6?`先発${i+1}`:i===13?'抑え':`中継ぎ${i-5}`;
const posClass=(pos:string)=>pos==='捕'?'c':pos==='外'?'of':pos==='DH'?'dh':'if';
const avgOf=(ids:string[],f:(id:string)=>number)=>Math.round(ids.reduce((n,id)=>n+f(id),0)/Math.max(1,ids.length));

/** 適性の記号: 公開の評価(◎○△)があればそれ、無ければ起用時の補正から(0→○, 5→△, 12→－) */
export function aptitudeMark(p:Player,role:PitcherRole):string{
 const fit=p.wikiAssessment?.pitcherRoles?.[role];
 if(fit==='◎'||fit==='○'||fit==='△')return fit;
 const penalty=pitcherRolePenalty(p,role);
 return penalty===0?'○':penalty===5?'△':'－';
}
export function AptMark({mark}:{mark:string}){
 return mark==='－'?<i className="nv-apt nv-apt-none" aria-label="適性なし">－</i>:<i className="nv-apt" data-apt={mark} aria-label={mark==='◎'?'非常に適している':mark==='○'?'適している':'あまり適していない'}>{mark}</i>;
}

export function PawaTeam({state,onChange,onPlayer,onImpact,onReset,onRestore,onCompleteReset,onCatalog,canRestore=false,onSeason}:{state:GameState;onChange:(s:GameState)=>void;onPlayer:(p:Player)=>void;onImpact:()=>void;onReset?:()=>void;onRestore?:()=>void;onCompleteReset?:()=>void;onCatalog?:()=>void;canRestore?:boolean;onSeason?:()=>void}){
 const [tab,setTab]=useState<'bat'|'pit'|'bench'>('bat'),[picking,setPicking]=useState<Slot|null>(null),[hand,setHand]=useState<string|null>(null),[defender,setDefender]=useState<string|null>(null),[notice,setNotice]=useState(''),[search,setSearch]=useState('');
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3200);return()=>clearTimeout(t);},[notice]);
 const ovr=(id:string)=>effectiveOverall(playerMap[id],state.owned,state.training);
 const ratingsOf=(id:string)=>ownedRatings(playerMap[id],state.owned,state.training);
 const roster=new Set([...state.lineup,...state.pitchers]);
 const bench=Object.keys(state.owned).map(id=>playerMap[id]).filter(p=>p&&!roster.has(p.id)).sort((a,b)=>ovr(b.id)-ovr(a.id));
 const commit=(next:GameState,message:string)=>{if(next===state)return false;onChange(next);onImpact();setNotice(message);return true;};
 const replace=(slot:Slot,id:string)=>{
  if(!commit(replaceSimplePlayer(state,slot.kind,slot.index,id),`${playerMap[id].name}を起用しました。`))setNotice('この枠には起用できません。守備適性に合う枠を選んでください。');
  setPicking(null);setHand(null);
 };
 const auto=()=>{const next=buildByStrategy(state,'balanced');if(next===state)setNotice('適性のある投手が不足しています。先発6人・中継ぎ7人・抑え1人を揃えてください。');else commit(next,'おまかせ編成しました。');};
 const move=(kind:Kind,from:number,to:number)=>commit(reorderSimplePlayer(state,kind,from,to),'順番を変更しました。');
 const misplaced=state.lineup.filter(id=>!fitsPosition(playerMap[id],state.defense[id]));
 const unfit=state.pitchers.filter((id,i)=>pitcherRolePenalty(playerMap[id],pitcherSlotRole(i))>0);
 const bat=avgOf(state.lineup,ovr),pit=avgOf(state.pitchers,ovr);
 const batR=(k:'contact'|'power'|'speed'|'field')=>avgOf(state.lineup,id=>ratingsOf(id)[k]);
 const pitR=(k:'control'|'stamina'|'breaking')=>avgOf(state.pitchers,id=>ratingsOf(id)[k]);
 const pool=useMemo(()=>picking?replacementPool(state,picking.kind,picking.index).filter(p=>p.id!==(picking.kind==='bat'?state.lineup:state.pitchers)[picking.index]).sort((a,b)=>ovr(b.id)-ovr(a.id)):[],[picking,state]);
 const shown=pool.filter(p=>!search||p.name.includes(search));
 const handSlots=hand?([...state.lineup.map((_,i)=>({kind:'bat' as Kind,index:i})),...state.pitchers.map((_,i)=>({kind:'pit' as Kind,index:i}))]).filter(s=>replacementPool(state,s.kind,s.index).some(p=>p.id===hand)):[];

 const row=(id:string,i:number,kind:Kind)=>{
  const p=playerMap[id],age=playerAge(p),pos=state.defense[id],role=pitcherSlotRole(i);
  const fit=kind==='pit'?pitcherRolePenalty(p,role)===0:fitsPosition(p,pos);
  const ratings=kind==='pit'?pitchingRatingsForRole(p,ratingsOf(id),role):ratingsOf(id);
  return <li key={id} className={'nv-row'+(fit?'':' is-unfit')}>
   <div className="nv-row-left"><span className="nv-order">{kind==='bat'?i+1:i<6?i+1:i===13?1:i-5}</span>
   {kind==='bat'?<button className={'nv-pos nv-pos-'+posClass(pos)+(defender===id?' is-picked':'')} aria-pressed={defender===id} aria-label={`${p.name}の守備位置 ${pos}を交換`} onClick={()=>{if(defender&&defender!==id){commit(swapDefense(state,defender,id),'守備位置を交換しました。');setDefender(null);}else setDefender(defender===id?null:id);}}>{pos}</button>
    :<span className={'nv-role nv-role-'+role}>{role==='先'?'先発':role==='抑'?'抑え':'中継ぎ'}</span>}</div>
   <PawaCard player={p} state={state} size="s" onClick={()=>onPlayer(p)} label={`${p.name}の詳細`}/>
   <div className="nv-row-main">
    <div className="nv-row-head"><div className="nv-row-name"><button data-player-id={id} onClick={()=>onPlayer(p)}>{p.name}</button><small>{age===null?'':`${age}歳 · `}{teamById(p.team).short}{kind==='pit'?` · ${p.ratings.velocity}km/h`:''}{!fit&&<em>{kind==='pit'?'役割適性外':'適性外'}</em>}</small></div>
     <span className={'nv-ovr'+(ovr(id)>=80?' is-gold':ovr(id)>=60?' is-silver':'')}><small>OVR</small><b>{ovr(id)}</b></span></div>
    <GradeRow player={p} ratings={ratings} mode={kind==='bat'?'batter':'pitcher'}/>
    {kind==='pit'&&<div className="nv-apts"><span>先発<AptMark mark={aptitudeMark(p,'先')}/></span><span>中継ぎ<AptMark mark={aptitudeMark(p,'中')}/></span><span>抑え<AptMark mark={aptitudeMark(p,'抑')}/></span></div>}
   </div>
   <div className="nv-row-actions">
    <button className="nv-swap" onClick={()=>{if(hand)replace({kind,index:i},hand);else{setSearch('');setPicking({kind,index:i});}}} aria-label={`${slotLabel(kind,i)} ${p.name}を入れ替える`}>入替</button>
    <button aria-label={`${p.name}を上へ`} disabled={i===0} onClick={()=>move(kind,i,i-1)}><ArrowUp size={15}/></button><button aria-label={`${p.name}を下へ`} disabled={i===(kind==='bat'?8:13)} onClick={()=>move(kind,i,i+1)}><ArrowDown size={15}/></button>
   </div>
  </li>;
 };
 const pitchGroup=(title:string,from:number,to:number)=><section className="nv-panel nv-group"><header><h2>{title}<small>{to-from}人</small></h2></header><ol className="nv-rows">{state.pitchers.slice(from,to).map((id,k)=>row(id,from+k,'pit'))}</ol></section>;

 return <div className="nv-team">
  <section className="nv-hero nv-hero-team"><p className="nv-kicker">MY TEAM</p><h1>チーム編成</h1></section>
  <div className="nv-power">
   <div><p>打撃力 <b>{bat}</b></p><dl><div><dt>ミート</dt><dd>{batR('contact')}</dd></div><div><dt>パワー</dt><dd>{batR('power')}</dd></div><div><dt>走力</dt><dd>{batR('speed')}</dd></div><div><dt>守備</dt><dd>{batR('field')}</dd></div></dl></div>
   <div><p>投手力 <b>{pit}</b></p><dl><div><dt>制球</dt><dd>{pitR('control')}</dd></div><div><dt>スタミナ</dt><dd>{pitR('stamina')}</dd></div><div><dt>変化</dt><dd>{pitR('breaking')}</dd></div></dl></div>
  </div>
  <div className="nv-team-actions"><button className="nv-navy" onClick={auto}><Shuffle size={16}/>おまかせ編成</button>{onSeason&&<button className="nv-gold" onClick={onSeason}>試合へ進む<ChevronRight size={18}/></button>}</div>
  <div className="nv-tabs" role="tablist" aria-label="編成する選手">{([['bat','打線 9'],['pit','投手 14'],['bench',`控え ${bench.length}`]] as const).map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>{setTab(id);setDefender(null);}}>{label}</button>)}</div>
  {hand&&<div className="nv-hand" role="status"><span>{playerMap[hand].name}を起用する枠の「入替」をタップ（起用できる枠 {handSlots.length}）</span><button aria-label="選択を解除" onClick={()=>setHand(null)}><X size={18}/></button></div>}
  {defender&&<div className="nv-hand" role="status"><span>{state.defense[defender]}（{playerMap[defender].name}）と交換する守備位置をタップ</span><button aria-label="選択を解除" onClick={()=>setDefender(null)}><X size={18}/></button></div>}
  {tab==='bat'&&<>
   {misplaced.length>0&&<p className="nv-warn"><AlertTriangle size={18}/><b>守備適性外 {misplaced.length}人</b><span>被安打・失策が増え、失点しやすくなります。{misplaced.some(id=>state.defense[id]==='捕')&&'捕手の適性外は盗塁も許しやすくなります。'}</span></p>}
   <section className="nv-panel nv-group"><header><h2>スターティング9</h2><span>守備位置をタップで交換</span></header><ol className="nv-rows">{state.lineup.map((id,i)=>row(id,i,'bat'))}</ol></section>
  </>}
  {tab==='pit'&&<>
   {unfit.length>0&&<p className="nv-warn"><AlertTriangle size={18}/><b>投手の役割適性不足 {unfit.length}人</b><span>制球・変化球が低下し、四死球や失点が増えやすくなります。能力欄は起用時の補正後、総合値はカード本来の値です。</span></p>}
   {pitchGroup('先発ローテーション',0,6)}{pitchGroup('中継ぎ',6,13)}{pitchGroup('抑え',13,14)}
   <section className="nv-panel nv-legend"><h2>役割適性の見方</h2><p><AptMark mark="◎"/>非常に適している <AptMark mark="○"/>適している <AptMark mark="△"/>あまり適していない</p></section>
  </>}
  {tab==='bench'&&<section className="nv-panel nv-group"><header><h2>控え選手</h2><span>総合の高い順</span></header>{bench.length?<ul className="nv-bench">{bench.map(p=><li key={p.id}><PawaCard player={p} state={state} size="s" onClick={()=>onPlayer(p)}/><div><button onClick={()=>onPlayer(p)}>{p.name}</button><small>{teamById(p.team).short} · {p.role==='pitcher'?'投手':p.positions.join('/')||'DH'}</small></div><span className="nv-ovr"><small>OVR</small><b>{ovr(p.id)}</b></span><button className="nv-swap" onClick={()=>{setHand(p.id);setTab(p.role==='pitcher'?'pit':'bat');}}>起用</button></li>)}</ul>:<p className="nv-note">控えの選手はいません。スカウトで仲間を増やそう。</p>}</section>}

  <div className="nv-team-links">{onCatalog&&<button className="nv-navy" onClick={onCatalog}><BookOpen size={16}/>選手図鑑</button>}</div>
  {onReset&&<details className="nv-panel nv-reset"><summary>チームをリセット</summary><p>退避してやり直すか、獲得カードを含めて完全に消すか選べます。</p><button className="nv-navy" onClick={onReset}>退避してリセット</button>{canRestore&&onRestore&&<button className="nv-navy" onClick={onRestore}>リセット前のチームに戻す</button>}{onCompleteReset&&<button className="nv-navy nv-danger" onClick={onCompleteReset}>カードも消して完全リセット</button>}</details>}

  {picking&&<div className="nv-sheet-overlay" onClick={()=>setPicking(null)}><div className="nv-sheet" role="dialog" aria-modal="true" aria-label="入れ替える選手を選ぶ" onClick={e=>e.stopPropagation()}>
   <header><button aria-label="戻る" onClick={()=>setPicking(null)}><ChevronLeft size={22}/></button><h2>{slotLabel(picking.kind,picking.index)} {playerMap[(picking.kind==='bat'?state.lineup:state.pitchers)[picking.index]].name}と入替</h2></header>
   <label className="nv-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="選手名で検索" aria-label="選手名で検索"/></label>
   <p className="nv-note">{shown.length}人 · この枠に起用できる選手（総合の高い順）</p>
   <ul className="nv-bench">{shown.map(p=><li key={p.id}><PawaCard player={p} state={state} size="s" onClick={()=>onPlayer(p)}/><div><button onClick={()=>onPlayer(p)}>{p.name}</button><small>{teamById(p.team).short} · {p.role==='pitcher'?'投手':p.positions.join('/')||'DH'}</small><GradeRow player={p} ratings={ratingsOf(p.id)} mode={picking.kind==='bat'?'batter':'pitcher'}/></div><span className="nv-ovr"><small>OVR</small><b>{ovr(p.id)}</b></span><button className="nv-swap" onClick={()=>replace(picking,p.id)}>起用</button></li>)}</ul>
   {!shown.length&&<p className="nv-note">この枠に起用できる控えがいません。</p>}
  </div></div>}
  {notice&&<div className="nv-toast" role="status">{notice}</div>}
 </div>;
}
