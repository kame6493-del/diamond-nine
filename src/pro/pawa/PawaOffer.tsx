import {useEffect,useMemo,useState} from 'react';
import {X} from 'lucide-react';
import type {GameState} from '../engine';
import type {Player} from '../data';
import {ratingOverall} from '../development';
import {SCOUT_BANDS,SIMPLE_SCOUT_COST,scoutBandPools} from '../simple-game';
import {firstPack,packDraws,pointPacks,readOncePacks,type PointPack} from '../point-products';
import {useMonetize} from '../monetization';
import {track} from '../analytics';
import {noteReviewPaywall} from '../review';
import {expectedCount,type OfferMoment} from '../offer-moments';
import {PackShop,useFirstPackLeft,usePackBuy} from '../PackShop';
import {PawaCard} from './PawaCard';
import '../offer.css';

const count=(n:number)=>n.toLocaleString('ja-JP');
const rateOf=(ids:string[])=>SCOUT_BANDS.filter(b=>ids.includes(b.id)).reduce((n,b)=>n+b.rate,0);
const GOLD_UP=rateOf(['mlbRainbow','mlbGold','domRainbow','domGold']),RAINBOW=rateOf(['mlbRainbow','domRainbow']);
// 平均の枚数は小さい時に「約0枚」にならないよう、1未満は小数1桁。
const about=(n:number)=>n>=1?`約${count(Math.round(n))}`:`約${n.toFixed(1)}`;

/** 見本のカード: 実際にスカウトで出る虹1枚・金2枚(まだ持っていない選手から総合の高い順。全部持っていれば持っている選手)。 */
export function offerSamples(state:GameState):Player[]{
 const top=(ids:string[],n:number)=>{
  const list=ids.flatMap(id=>scoutBandPools[id as keyof typeof scoutBandPools]).sort((a,b)=>ratingOverall(b)-ratingOverall(a)||a.id.localeCompare(b.id));
  const fresh=list.filter(p=>!state.owned[p.id]);
  return (fresh.length>=n?fresh:list).slice(0,n);
 };
 return [...top(['domGold'],1),...top(['mlbRainbow','domRainbow'],1),...top(['mlbGold'],1)];
}

const HEAD:Record<OfferMoment,string>={short:'ポイントが足りません',hit:'いい流れです',loss:'あと一歩でした',season:'来季こそ優勝へ'};

/** 欲しくなる場面で出す購入の案内(2026-11-07)。本物の中身(実際に出る選手のカード・提供割合から出した平均の枚数)を見せる。
 *  値段はストアの表示価格だけ。閉じるボタンは上と下の2か所。はじめての購入だけのパックの残り時間は、はじめて見せた時から数える本物。 */
export function PawaOffer({moment,state,lead,onClose}:{moment:OfferMoment;state:GameState;lead?:string;onClose:(bought:boolean)=>void}){
 const m=useMonetize(),prices=m?.packs?.prices??{},busy=!!m?.packs?.busy;
 const [all,setAll]=useState(false),[began,setBegan]=useState(false);
 const {note,buy,ask}=usePackBuy(id=>{setBegan(true);track('offer_buy_begin',{moment,id});});
 const firstPriced=!!prices[firstPack.id]&&!readOncePacks().includes(firstPack.id),first72=useFirstPackLeft(firstPriced),firstOpen=firstPriced&&first72.open;
 useEffect(()=>{noteReviewPaywall();track('offer_show',{moment,first:firstOpen?1:0});},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const samples=useMemo(()=>offerSamples(state),[state.owned]);// eslint-disable-line react-hooks/exhaustive-deps
 const close=(how:string)=>{track('offer_close',{moment,how,began:began?1:0});onClose(how==='done');};
 const need=Math.max(0,SIMPLE_SCOUT_COST-state.gems);
 const sub=lead??(moment==='short'?`次の1枚まで あと ${count(need)} pt`:moment==='hit'?'この流れで、もう1枚。':moment==='loss'?'打線と投手陣を強くする近道':'優勝するチームを、スカウトで');
 const same=pointPacks.find(p=>p.priceYen===firstPack.priceYen);
 const message=note||m?.packs?.message||'';
 const got=/受け取りました/.test(message);
 const packRow=(p:PointPack)=>{const price=prices[p.id],d=packDraws(p);return <li key={p.id}>
  <span className="dn-offer-pk"><b>スカウト{count(d)}回分</b><small>{count(p.points)} pt ・ 金・虹カード 平均{about(expectedCount(d,GOLD_UP))}枚</small></span>
  <button type="button" className="dn-offer-buy is-small" disabled={!price||busy} onClick={()=>buy(p.id)}>{price??'読み込めません'}</button>
 </li>;};
 return <div className="dn-offer-modal" onClick={()=>close('backdrop')}>
  <div className={'dn-offer dn-offer-'+moment} role="dialog" aria-modal="true" aria-label="ポイント購入のご案内" onClick={e=>e.stopPropagation()}>
   <header className="dn-offer-head"><div><h2>{HEAD[moment]}</h2><p>{sub}</p></div><button className="dn-offer-x" onClick={()=>close('x')} aria-label="閉じる"><X size={22}/></button></header>
   {all?<PackShop/>:<>
   <section className="dn-offer-cards" aria-label="スカウトで出る選手の例">
    <div className="dn-offer-fan">{samples.map((p,i)=><div key={p.id} className={'dn-offer-c dn-offer-c'+i}><PawaCard player={p} state={state} base size="m"/></div>)}</div>
    <p>このクラスの選手が、ふつうのスカウトで出ます（例）</p>
   </section>
   {firstOpen?<section className="dn-offer-hero">
    <span className="dn-offer-ribbon">はじめての購入だけ・1回限り</span>
    <p className="dn-offer-big"><b>スカウト{count(packDraws(firstPack))}回分</b><small>{count(firstPack.points)} pt</small></p>
    <ul className="dn-offer-facts">
     {same&&<li>同じ値段のいつものパック（スカウト{count(packDraws(same))}回分）の <b>{firstPack.points/same.points}倍</b></li>}
     <li>{count(packDraws(firstPack))}回引くと、金・虹カードは平均 <b>{about(expectedCount(packDraws(firstPack),GOLD_UP))}枚</b>（うち虹 {about(expectedCount(packDraws(firstPack),RAINBOW))}枚）</li>
     <li>{state.gems>=SIMPLE_SCOUT_COST?<>いまの {count(state.gems)} pt では あと {count(Math.floor(state.gems/SIMPLE_SCOUT_COST))}回</>:<>いまの {count(state.gems)} pt では、次の1回まで あと {count(need)} pt</>}</li>
    </ul>
    <button type="button" className="dn-offer-buy" disabled={busy||got} onClick={()=>buy(firstPack.id)}>{busy?'購入画面を開いています…':`${prices[firstPack.id]} で購入する`}</button>
    <p className="dn-offer-left" role="timer">このパックは あと <b>{first72.left}</b>（はじめて表示してから72時間。過ぎると出なくなります）</p>
   </section>:<section className="dn-offer-list">
    <h3>ポイントを補充する</h3>
    <ul>{[pointPacks[1],pointPacks[2]].map(packRow)}</ul>
   </section>}
   </>}
   {ask}
   {message&&<p className="dn-offer-msg" role="status">{message}</p>}
   <div className="dn-offer-foot">
    {!all&&<button type="button" className="dn-offer-more" onClick={()=>{setAll(true);track('offer_all',{moment});}}>ほかのパックを見る</button>}
    <button type="button" className="dn-offer-later" onClick={()=>close(got?'done':'later')}>{got?'閉じてスカウトへ':'今はいい'}</button>
    {!all&&<p className="dn-offer-fine">スカウトの確率は買っても変わりません（金・虹カード 合わせて {(GOLD_UP*100).toFixed(2)}%）。平均の枚数は提供割合から出した目安で、必ず出る数ではありません。未成年の方は保護者の同意を得てから購入してください。<a href="/legal.html" target="_blank" rel="noopener noreferrer">特定商取引法・資金決済法に基づく表示</a></p>}
   </div>
  </div>
 </div>;
}
