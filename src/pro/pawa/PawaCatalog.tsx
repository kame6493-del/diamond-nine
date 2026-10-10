import {useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Search} from 'lucide-react';
import {players,type Player} from '../data';
import type {GameState} from '../engine';
import {CardFilterControls} from '../CardFilters';
import {browseCatalogCards,collectionProgress,defaultCardFilters,type CardFilters,type CollectionFilter} from '../player-browser';
import {PawaCard} from './PawaCard';

const PAGE=24;
const pools={NPB:players.filter(p=>!p.mlb),MLB:players.filter(p=>p.mlb)};

/** 選手図鑑(ref_04 右)。絞り込みと並びは PlayerCatalog と同じ関数。 */
export function PawaCatalog({state,onBack,onPlayer}:{state:GameState;onBack:()=>void;onPlayer:(p:Player)=>void}){
 const [circuit,setCircuit]=useState<'NPB'|'MLB'>('NPB'),[filters,setFilters]=useState<CardFilters>({...defaultCardFilters,sort:'team'}),[collection,setCollection]=useState<CollectionFilter>('all'),[page,setPage]=useState(0);
 const top=useRef<HTMLDivElement>(null);
 const filtered=useMemo(()=>browseCatalogCards(pools[circuit],state.owned,filters,collection),[circuit,state.owned,filters,collection]);
 const progress=collectionProgress(pools[circuit],state.owned),all=collectionProgress(players,state.owned);
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE)),current=Math.min(page,pages-1),visible=filtered.slice(current*PAGE,current*PAGE+PAGE);
 const update=(next:CardFilters)=>{setFilters(next);setPage(0);};
 const turn=(n:number)=>{setPage(n);top.current?.scrollIntoView({block:'start',behavior:'auto'});};
 const pager=<nav className="nv-pager" aria-label="図鑑のページ"><button aria-label="前のページ" disabled={!current} onClick={()=>turn(current-1)}><ChevronLeft size={20}/></button><span>{current+1} / {pages}</span><button aria-label="次のページ" disabled={current>=pages-1} onClick={()=>turn(current+1)}><ChevronRight size={20}/></button></nav>;
 return <div className="nv-catalog">
  <section className="nv-hero nv-hero-small"><button className="nv-back" onClick={onBack} aria-label="チームへ戻る"><ChevronLeft size={26}/></button><h1>選手図鑑</h1></section>
  <div className="nv-tabs" role="tablist" aria-label="図鑑のリーグ">{(['NPB','MLB'] as const).map(c=><button key={c} role="tab" aria-selected={circuit===c} onClick={()=>{setCircuit(c);update({...defaultCardFilters,sort:'team'});}}>{c==='NPB'?'国内':'海外'}</button>)}</div>
  <div className="nv-chips" role="group" aria-label="入手状況">{([['all','すべて'],['owned','入手済み'],['missing','未入手']] as const).map(([v,l])=><button key={v} aria-pressed={collection===v} onClick={()=>{setCollection(v);setPage(0);}}>{l}</button>)}</div>
  <section className="nv-panel nv-collect"><p>コレクション達成率</p><div><b>{progress.collected.toLocaleString('ja-JP')}<small> / {progress.total.toLocaleString('ja-JP')} 人</small></b><strong>{(progress.collected/Math.max(1,progress.total)*100).toFixed(1)}<small>%</small></strong></div><div className="nv-bar"><i style={{width:`${progress.collected/Math.max(1,progress.total)*100}%`}}/></div><small>全体 {all.collected.toLocaleString('ja-JP')} / {all.total.toLocaleString('ja-JP')} 人</small></section>
  <div className="nv-filters"><label className="nv-search"><Search size={16}/><input aria-label="図鑑を選手名で検索" placeholder="選手名で検索" value={filters.search} onChange={e=>update({...filters,search:e.target.value})}/></label><CardFilterControls prefix="図鑑" value={filters} onChange={update} circuit={circuit} fields={['team','role','sort']}/></div>
  <div ref={top} className="nv-catalog-head"><p role="status">{filtered.length?`${filtered.length.toLocaleString('ja-JP')}人`:'条件に合う選手はいません。'}</p>{pages>1&&pager}</div>
  <ul className="nv-grid">{visible.map(p=>{const got=(state.owned[p.id]??0)>0;return <li key={p.id} className={got?'':'is-missing'}><PawaCard player={p} state={state} size="s" base onClick={()=>onPlayer(p)} label={`${p.name} · ${got?'入手済み':'未入手'}`}/><small>{p.name}</small></li>;})}</ul>
  {pages>1&&<div className="nv-catalog-foot">{pager}<small>1ページ {PAGE}人表示</small></div>}
 </div>;
}
