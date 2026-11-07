import {useEffect,useState} from 'react';
import {AGE_BANDS,allPointPacks,canSpend,firstPack,monthlyLimit,packBonusPercent,packDraws,pointPacks,readAgeBand,readOncePacks,readSpent,saveAgeBand,yenPerDraw,type AgeBand} from './point-products';
import {monetizeBridge,useMonetize} from './monetization';
import {noteReviewPaywall} from './review';
import {STAMINA_ENABLED,STAMINA_PT_FULL_COST} from './stamina';
import {firstPackWindowNow,formatLeft,startFirstPackWindow} from './offer-moments';

const count=(n:number)=>n.toLocaleString('ja-JP');
const drawsLabel=(n:number)=>Number.isInteger(n)?`${count(n)}回分`:`${count(Math.floor(n))}回分＋α`;

/** はじめての購入の前に年齢の区分を聞く(パックとプレミアムパスで共通)。 */
export function AgeAsk({onChoose,onCancel}:{onChoose:(band:AgeBand)=>void;onCancel:()=>void}){
 return <div className="pack-age" role="group" aria-label="年齢の確認"><p>はじめての購入の前に、年齢を教えてください。未成年の方は月の上限があります（15歳以下 5,000円・16〜17歳 10,000円。プレミアムパスも含みます）。</p><div>{AGE_BANDS.map(b=><button key={b.id} type="button" onClick={()=>onChoose(b.id)}>{b.label}</button>)}</div><button type="button" className="pack-age-cancel" onClick={onCancel}>やめる</button></div>;
}

/** パックを買う手順(年齢の確認・未成年の月の上限)。PackShop と購入の案内(PawaOffer)で同じ物を使う。 */
export function usePackBuy(onBegin?:(id:string)=>void){
 const bridge=monetizeBridge();
 const [age,setAge]=useState<AgeBand|null>(()=>readAgeBand()),[asking,setAsking]=useState<string|null>(null),[note,setNote]=useState('');
 const buy=(id:string,band=age)=>{
  const pack=allPointPacks.find(p=>p.id===id);if(!pack||!bridge?.buyPack)return;
  if(!band){setAsking(id);return;}
  if(!canSpend(band,readSpent(),pack.priceYen)){setNote(`今月の購入の上限（${count(monthlyLimit(band)??0)}円）を超えるため購入できません。来月またご利用ください。`);return;}
  setNote('');onBegin?.(id);void bridge.buyPack(id);
 };
 const choose=(band:AgeBand)=>{saveAgeBand(band);setAge(band);const id=asking;setAsking(null);if(id)buy(id,band);};
 return {age,asking,note,buy,ask:asking?<AgeAsk onChoose={choose} onCancel={()=>setAsking(null)}/>:null};
}

/** はじめての購入だけのパックの残り時間(はじめて見せた時から72時間。1分ごとに数え直す)。 */
export function useFirstPackLeft(show:boolean){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{if(!show)return;startFirstPackWindow();setNow(Date.now());const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t);},[show]);
 const w=firstPackWindowNow(now);
 return {open:w.open,left:formatLeft(w.leftMs)};
}

/** ポイントのパック一覧。スカウト画面のシートと設定画面で同じ物を出す。
 *  価格はストアの表示価格。ブラウザ版は「アプリ版で使えます」で押せない。
 *  初めて買う前に年齢の区分を聞き、未成年は月の上限を超える購入を止める。 */
export function PackShop(){
 const m=useMonetize(),bridge=monetizeBridge();
 useEffect(()=>{noteReviewPaywall();},[]);// 購入画面の前後30分は評価の窓を出さない
 const {age,asking,note,buy,ask}=usePackBuy();
 const packs=m?.packs,limit=monthlyLimit(age),offline=!!m&&packs?.status==='unavailable';
 const firstPriced=!!packs?.prices[firstPack.id]&&!readOncePacks().includes(firstPack.id),first72=useFirstPackLeft(firstPriced),firstOpen=firstPriced&&first72.open;
 // 開いた時にストアにつながっていなければ読み直す(起動時の通信の失敗で「販売準備中」のままにしない)。
 useEffect(()=>{if(packs?.status==='unavailable')bridge?.refreshStore?.();},[]);// eslint-disable-line react-hooks/exhaustive-deps
 return <section className="pack-shop" aria-label="ポイントのパック">
  <p className="pack-lead">スカウト1回 3,000pt{STAMINA_ENABLED?<>・行動力の満タン回復 {count(STAMINA_PT_FULL_COST)}pt</>:null}。いちばん小さいパックでもスカウト{count(packDraws(pointPacks[0]))}回分、大きいパックほど1回あたりがおトクです。</p>
  <ul className="pack-list">{[...(firstOpen?[firstPack]:[]),...[...pointPacks].reverse()].map(p=>{
   const price=packs?.prices[p.id],bonus=packBonusPercent(p),best=p===pointPacks[pointPacks.length-1],first=p===firstPack;
   // 1回だけのパックはストアに登録が無い間(価格が取れない間)は出さない。
   const label=!m?'アプリ版で':packs?.status==='checking'?'確認中…':price?price:offline?'読み込めません':'販売準備中';
   if(first&&!price)return null;
   return <li key={p.id} className={best?'is-best':first?'is-first':''}>
    <span className="pack-pt"><b>{count(p.points)}</b><small>pt</small></span>
    <span className="pack-info"><em>{p.tag??`スカウト${drawsLabel(packDraws(p))}`}</em>{first&&<small className="pack-left">残り {first72.left}（はじめて表示してから72時間）</small>}{p.tag&&<small className="pack-stamina">スカウト{drawsLabel(packDraws(p))}</small>}{STAMINA_ENABLED&&p.points>=STAMINA_PT_FULL_COST&&<small className="pack-stamina">{first?`スカウト${drawsLabel(packDraws(p))}・`:'または '}行動力の満タン回復 {Math.floor(p.points/STAMINA_PT_FULL_COST)}回分</small>}<small>{bonus>0?<>1回 約{yenPerDraw(p)}円 <i>+{bonus}%おトク</i></>:`1回 ${yenPerDraw(p)}円`}</small></span>
    <button type="button" className="pack-buy" disabled={!m||!price||!!packs?.busy} onClick={()=>buy(p.id)}>{!m&&<small>¥{count(p.priceYen)}</small>}{label}{!m&&<small>使えます</small>}</button>
   </li>;})}</ul>
  {offline&&<div className="pack-retry" role="status"><p>ストアに接続できませんでした。通信状態を確認して、もう一度読み込んでください。</p><button type="button" className="s-button" onClick={()=>bridge?.refreshStore?.(true)}>もう一度読み込む</button></div>}
  {asking&&ask}
  {(note||packs?.message)&&<p className="pack-msg" role="status">{note||packs?.message}</p>}
  <p className="pack-fine">{!m?'ブラウザ版では購入できません。価格はアプリ版（日本）の予定です。':limit!==null?`今月の購入 ${count(readSpent())}円／上限 ${count(limit)}円。`:''}未成年の方は保護者の同意を得てから購入してください。買ったポイントはこの端末のセーブに入ります（完全リセットや削除で消えます）。スカウトの確率は買っても変わりません。<a className="pack-legal" href="/legal.html" target="_blank" rel="noopener noreferrer">特定商取引法・資金決済法に基づく表示</a></p>
 </section>;
}
