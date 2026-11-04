import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import {playerMap,type Player} from '../data';
import type {GameState,Pull} from '../engine';
import {scoutPresentation,type ScoutTier} from '../scout-presentation';
import {multiChargeSounds,multiDealSounds,multiFlipSounds,stopGameAudio} from '../game-audio';
import {PawaCard} from './PawaCard';

// 2026-11-04 vc43 持ち主「まとめて引くんなら引くやつ付けて良いけど、ちゃんと演出付けてください。まとめて引く用の」。
// 10回まとめて引く専用の演出: 10枚を裏のまま並べる → 金・虹はめくる前から光り方が違う → 1枚ずつ順にめくる
// (金・虹はめくる前に溜めて、めくったら大きく見せる) → 最後に10枚の一覧。どこを押しても次へ、「全部めくる」で飛ばせる。
// 引く処理(ポイント・確率・能力アップ)は先に済んでいる(simple-game の drawSimplePlayers)。ここは見せるだけ。

export type MultiItem={pull:Pull;player:Player;tier:ScoutTier;overall:number;index:number};
const tierRank=(t:ScoutTier)=>t==='rainbow'?2:t==='gold'?1:0;
/** 10枚の見た目(段と総合)。段・総合は引いた後のカード(重複の能力アップ込み)で決める。1回引く時と同じ決め方。 */
export function multiItems(state:GameState,pulls:Pull[]=state.lastPulls):MultiItem[]{
 return pulls.map((pull,index)=>{const player=playerMap[pull.playerId];const {tier,overall}=scoutPresentation(player,state.owned,state.training);return {pull,player,tier,overall,index};});
}
/** いちばん良かった1枚: 段(虹>金>ふつう) → 総合 → 新しく入った選手 → 先に出た方。 */
export function bestOfMulti(items:MultiItem[]):MultiItem|null{
 let best:MultiItem|null=null;
 for(const x of items){if(!best){best=x;continue;}
  const d=tierRank(x.tier)-tierRank(best.tier)||x.overall-best.overall||Number(x.pull.isNew)-Number(best.pull.isNew);
  if(d>0)best=x;}
 return best;
}
/** 1枚ごとの札: NEW / 能力+1(2〜6枚目) / +300pt(7枚目から)。1回引く時の札と同じ決まり。 */
export function multiTag(pull:Pull):{kind:'new'|'up'|'pts';label:string}{
 if(pull.isNew)return {kind:'new',label:'NEW'};
 if(pull.copies<=6)return {kind:'up',label:'能力+1'};
 return {kind:'pts',label:`+${(pull.trainingReward??0).toLocaleString('ja-JP')}pt`};
}
export function multiSummary(items:MultiItem[]){
 return {fresh:items.filter(x=>x.pull.isNew).length,up:items.filter(x=>!x.pull.isNew&&x.pull.copies<=6).length,points:items.reduce((n,x)=>n+(x.pull.trainingReward??0),0),
  rainbow:items.filter(x=>x.tier==='rainbow').length,gold:items.filter(x=>x.tier==='gold').length};
}

const reduced=()=>typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// 長さ(ms)。ふつうのカードは軽く続け、金・虹は溜め(charge)とめくった後の見せ場(spot)を長くとる。
export const MULTI_TIMES={deal:1150,first:250,gap:{standard:320,gold:200,rainbow:200},charge:{standard:0,gold:900,rainbow:1500},spot:{standard:0,gold:1150,rainbow:1800},end:1000,skipEnd:700};
type Step={kind:'deal'}|{kind:'wait';i:number;gap:number}|{kind:'charge';i:number}|{kind:'spot';i:number}|{kind:'end';ms:number};

const label=(t:ScoutTier,mlb:boolean)=>t==='rainbow'?'虹カード':t==='gold'?(mlb?'海外・金カード':'金カード'):'カード';

/** 10枚をめくる演出。終わったら(飛ばしても)onDone。 */
export function PawaMultiReveal({state,sound,onDone}:{state:GameState;sound:boolean;onDone:()=>void}){
 const items=useMemo(()=>multiItems(state),[state]);
 const fast=useMemo(reduced,[]);
 const [step,setStep]=useState<Step>({kind:'deal'}),[open,setOpen]=useState(0);
 const flip=(i:number)=>{setOpen(n=>Math.max(n,i+1));if(sound)multiFlipSounds(items[i].tier);};
 const advance=()=>{
  if(step.kind==='deal'){setStep({kind:'wait',i:0,gap:MULTI_TIMES.first});return;}
  if(step.kind==='wait'){
   const i=step.i;if(i>=items.length){setStep({kind:'end',ms:MULTI_TIMES.end});return;}
   const t=items[i].tier;
   if(t==='standard'||fast){flip(i);setStep(t==='standard'||!fast?{kind:'wait',i:i+1,gap:MULTI_TIMES.gap.standard}:{kind:'spot',i});}
   else{if(sound)multiChargeSounds(t);setStep({kind:'charge',i});}
   return;
  }
  if(step.kind==='charge'){flip(step.i);setStep({kind:'spot',i:step.i});return;}
  if(step.kind==='spot'){setStep({kind:'wait',i:step.i+1,gap:MULTI_TIMES.gap[items[step.i].tier]});return;}
  onDone();
 };
 const skipAll=()=>{
  if(step.kind==='end')return onDone();
  stopGameAudio();setOpen(items.length);
  const best=bestOfMulti(items);if(sound&&best)multiFlipSounds(best.tier);
  setStep({kind:'end',ms:MULTI_TIMES.skipEnd});
 };
 useEffect(()=>{if(sound)multiDealSounds();},[]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  const k=fast?.25:1;
  const ms=step.kind==='deal'?MULTI_TIMES.deal:step.kind==='wait'?step.gap:step.kind==='charge'?MULTI_TIMES.charge[items[step.i].tier]:step.kind==='spot'?MULTI_TIMES.spot[items[step.i].tier]:step.ms;
  const id=setTimeout(advance,Math.round(ms*k));
  return ()=>clearTimeout(id);
 });// advance は毎回の描画の step を見る
 const charging=step.kind==='charge'?step.i:-1,spot=step.kind==='spot'?items[step.i]:null;
 const stageTier=charging>=0?items[charging].tier:spot?spot.tier:'standard';
 return <div className={'pw-mx'+(charging>=0?' is-charge pw-mx-c-'+stageTier:'')+(spot?' is-spot':'')} role="status" aria-label={`10回スカウト ${open}枚目 / ${items.length}枚`} onClick={advance}>
  <img className="pw-mx-bg" src="/assets/pro/pawa/draw-stage.webp" alt=""/>
  <header className="pw-mx-head" aria-hidden="true"><b>10回スカウト</b><span><em>{open}</em> / {items.length}</span></header>
  <ol className="pw-mx-grid">{items.map((x,i)=>{const isOpen=i<open;
   return <li key={i} className={'pw-mx-card pw-mx-t-'+x.tier+(isOpen?' is-open':'')+(i===charging?' is-charge':'')+(step.kind==='wait'&&step.i===i&&!isOpen?' is-next':'')} style={{'--i':i} as CSSProperties} aria-label={isOpen?`${i+1}枚目 ${x.player.name}`:`${i+1}枚目 まだ裏`}>
    <span className="pw-mx-glow" aria-hidden="true"/>
    <div className="pw-mx-flip"><img className="pw-mx-back" src="/assets/pro/pawa/draw-card-back.webp" alt=""/><div className="pw-mx-front">{isOpen&&<PawaCard player={x.player} state={state} size="s"/>}{isOpen&&<i className={'pw-mx-tag is-'+multiTag(x.pull).kind}>{multiTag(x.pull).label}</i>}</div></div>
   </li>;})}</ol>
  {spot&&<div className={'pw-mx-spot pw-tier-'+spot.tier} aria-hidden="true">
   <img className="pw-mx-burst" src="/assets/pro/pawa/draw-burst.webp" alt=""/>
   {spot.tier==='rainbow'&&<span className="pw-mx-ring"/>}
   <span className="pw-mx-sparks">{Array.from({length:spot.tier==='rainbow'?18:10},(_,i)=><i key={i} style={{'--i':i,'--n':spot.tier==='rainbow'?18:10} as CSSProperties}/>)}</span>
   <div className="pw-mx-big"><PawaCard player={spot.player} state={state} size="l"/></div>
   <p className="pw-mx-spotchips"><span className="pw-tierchip">{label(spot.tier,!!spot.player.mlb)}</span><span className={'pw-mx-tag is-'+multiTag(spot.pull).kind}>{multiTag(spot.pull).label}</span></p>
  </div>}
  <span className="pw-mx-flash" key={'f'+open} aria-hidden="true" data-tier={open>0?items[open-1].tier:'none'}/>
  {step.kind!=='end'&&<button className="pw-skip pw-mx-skip" onClick={e=>{e.stopPropagation();skipAll();}}>全部めくる ▶▶</button>}
 </div>;
}

/** 10回の結果の一覧: 新しく入った選手・能力が上がった選手・いちばん良かった1枚が分かるように。 */
export function PawaMultiResult({state,onPlayer}:{state:GameState;onPlayer?:(p:Player)=>void}){
 const items=multiItems(state),best=bestOfMulti(items),sum=multiSummary(items);
 if(!best)return null;
 const bt=multiTag(best.pull);
 return <section className="pw-mx-result" aria-live="polite" aria-label="10回スカウトの結果">
  <header className="pw-mx-rhead"><h2>10回スカウトの結果</h2>
   <p className="pw-mx-sum"><span className="is-new">NEW <b>{sum.fresh}</b>人</span><span className="is-up">能力アップ <b>{sum.up}</b>人</span>{sum.points>0&&<span className="is-pts">ポイント <b>+{sum.points.toLocaleString('ja-JP')}</b></span>}</p>
  </header>
  <div className={'pw-mx-best pw-tier-'+best.tier}>
   <p className="pw-mx-best-h">いちばん良かった1枚</p>
   <div className="pw-mx-best-body">
    <button className="pw-sc-card" onClick={()=>onPlayer?.(best.player)} aria-label={`${best.player.name}の詳細`}><PawaCard player={best.player} state={state} size="m"/></button>
    <div className="pw-mx-best-id">
     <p className="pw-sc-chips"><span className="pw-tierchip">{label(best.tier,!!best.player.mlb)}</span><span className={'pw-mx-tag is-'+bt.kind}>{bt.label}</span></p>
     <h3>{best.player.name}</h3>
     <p className="pw-sc-meta">{best.player.role==='pitcher'?'投手':best.player.positions.join('・')||'DH'}{best.player.mlb?' · 海外':''}</p>
     <p className="pw-sc-ovr"><small>総合</small><b>{best.overall}</b></p>
    </div>
   </div>
  </div>
  <ol className="pw-mx-list" aria-label="引いた10枚">{items.map(x=>{const t=multiTag(x.pull),isBest=x===best;
   return <li key={x.index} className={'pw-mx-t-'+x.tier+(isBest?' is-best':'')}>
    <button onClick={()=>onPlayer?.(x.player)} aria-label={`${x.index+1}枚目 ${x.player.name} 総合${x.overall} ${t.label}${isBest?' いちばん良かった1枚':''}`}>
     {isBest&&<span className="pw-mx-crown" aria-hidden="true">★</span>}
     <PawaCard player={x.player} state={state} size="s"/>
    </button>
    <i className={'pw-mx-tag is-'+t.kind}>{t.label}</i>
   </li>;})}</ol>
  <p className="pw-mx-legend"><span className="pw-mx-tag is-new">NEW</span>新しく入った選手 <span className="pw-mx-tag is-up">能力+1</span>同じ選手が出て能力が上がった</p>
  <p className="pw-sc-note">引いた選手は控えに入りました。入れ替えはチーム画面でできます。</p>
 </section>;
}
