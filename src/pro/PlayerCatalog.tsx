import {useMemo,useRef,useState} from 'react';
import {ArrowLeft,BookOpen,ChevronLeft,ChevronRight,Search} from 'lucide-react';
import {players,type Player} from './data';
import type {GameState} from './engine';
import {playerAge} from './development';
import {TradingCard} from './CardDeck';
import {CardFilterControls} from './CardFilters';
import {browseCatalogCards,collectionProgress,defaultCardFilters,type CardFilters,type CollectionFilter} from './player-browser';
import './catalog.css';

export const CATALOG_PAGE_SIZE=24;
const pools={NPB:players.filter(p=>!p.mlb),MLB:players.filter(p=>p.mlb)};
export function PlayerCatalog({state,onBack,onPlayer}:{state:GameState;onBack:()=>void;onPlayer:(p:Player)=>void}){
 const [circuit,setCircuit]=useState<'NPB'|'MLB'>('NPB'),[filters,setFilters]=useState<CardFilters>({...defaultCardFilters,sort:'team'}),[collection,setCollection]=useState<CollectionFilter>('all'),[page,setPage]=useState(0);
 const heading=useRef<HTMLDivElement>(null);
 const filtered=useMemo(()=>browseCatalogCards(pools[circuit],state.owned,filters,collection),[circuit,state.owned,filters,collection]);
 const progress=collectionProgress(players,state.owned);
 const pages=Math.max(1,Math.ceil(filtered.length/CATALOG_PAGE_SIZE)),current=Math.min(page,pages-1),start=current*CATALOG_PAGE_SIZE,visible=filtered.slice(start,start+CATALOG_PAGE_SIZE);
 const update=(next:CardFilters)=>{setFilters(next);setPage(0);};
 const turnPage=(next:number)=>{setPage(next);heading.current?.scrollIntoView({block:'start',behavior:'auto'});};
 const pagination=(label:string)=><nav className="catalog-pagination" aria-label={label}><button className="s-button" aria-label="カタログの前のページ" disabled={!current} onClick={()=>turnPage(current-1)}><ChevronLeft size={16}/></button><span>{current+1} / {pages}</span><button className="s-button" aria-label="カタログの次のページ" disabled={current>=pages-1} onClick={()=>turnPage(current+1)}><ChevronRight size={16}/></button></nav>;
 return <section className="player-catalog">
  <div className="s-page-title"><div><p className="s-kicker">CARD CATALOG</p><h1><BookOpen size={23}/>カードカタログ</h1><p>入手時の能力を表示 · 選手名から詳細へ</p></div><button className="s-button" onClick={onBack}><ArrowLeft size={16}/>チームへ戻る</button></div>
  <div className={'catalog-collection '+(progress.complete?'collection-complete':'')}><div><span>{progress.complete?'コンプリート！':'カード収集'}</span><strong>{progress.collected.toLocaleString('ja-JP')}<small> / {progress.total.toLocaleString('ja-JP')} 人</small></strong><b>{Math.floor(progress.collected/progress.total*100)}%</b></div><div className="catalog-collection-track" role="progressbar" aria-label="カード収集率" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.collected}><i style={{width:`${progress.collected/progress.total*100}%`}}/></div></div>
  <div className="catalog-circuits" role="group" aria-label="カタログのリーグ">{(['NPB','MLB'] as const).map(league=>{const owned=collectionProgress(pools[league],state.owned);return <button key={league} aria-pressed={circuit===league} onClick={()=>{setCircuit(league);update({...defaultCardFilters,sort:'team'});}}><strong>{league==='NPB'?'NPB':'日本人MLB選手'}</strong><span>{owned.complete?'✓ ':''}{owned.collected.toLocaleString('ja-JP')} / {owned.total.toLocaleString('ja-JP')}人</span></button>;})}</div>
  <div className="catalog-ownership" role="group" aria-label="カタログの入手状況">{([['all','すべて'],['owned','入手済み'],['missing','未入手']] as const).map(([value,label])=><button key={value} aria-pressed={collection===value} onClick={()=>{setCollection(value);setPage(0);}}>{label}</button>)}</div>
  <div className="catalog-controls"><div className="catalog-search-row"><label className="deck-search"><Search size={16}/><input aria-label="カタログを選手名で検索" placeholder="選手名で探す" value={filters.search} onChange={e=>update({...filters,search:e.target.value})}/></label><CardFilterControls prefix="カタログ" value={filters} onChange={update} circuit={circuit} fields={['team']}/></div><details className="catalog-extra-filters"><summary>絞り込み・並べ替え{(filters.role!=='all'||filters.age!=='all')&&<span>設定中</span>}</summary><CardFilterControls prefix="カタログ" value={filters} onChange={update} circuit={circuit} fields={['role','age','sort']}/></details></div>
  <div className="catalog-results-heading" ref={heading}><p role="status">{filtered.length?`${start+1}〜${Math.min(start+CATALOG_PAGE_SIZE,filtered.length)} / ${filtered.length.toLocaleString('ja-JP')}人`:'条件に合う選手はいません。'}</p>{pagination('カタログのページ')}</div>
  <div className="catalog-grid">{visible.map(p=>{const age=playerAge(p),collected=(state.owned[p.id]??0)>0;return <article className="catalog-card" data-collected={collected} key={p.id} aria-label={`${p.name}のカード · ${collected?'入手済み':'未入手'}`}><div className="catalog-card-meta"><span>{age===null?'年齢未登録':`${age}歳`}</span><span className={collected?'catalog-owned':''}>{collected?'✓ 入手済み':'未入手'}</span></div><TradingCard player={p} state={state} onPlayer={onPlayer} baseOnly/></article>;})}</div>
  {!filtered.length&&<div className="catalog-empty"><BookOpen size={30}/><p>入手状況・球団・年齢・選手名の条件を変えて探してみよう。</p><button className="s-button" onClick={()=>{setCollection('all');update({...defaultCardFilters,sort:'team'});}}>絞り込みを解除</button></div>}
  {pages>1&&<div className="catalog-bottom">{pagination('カタログ下部のページ')}</div>}
 </section>;
}
