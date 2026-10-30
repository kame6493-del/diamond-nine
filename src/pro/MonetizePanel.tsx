import {useState} from 'react';
import {Crown,PlayCircle} from 'lucide-react';
import {PREMIUM_DAILY_POINTS,monetizeBridge,useMonetize} from './monetization';
import {PREMIUM_MATCH_MULTIPLIER} from './platform-economy';
import {PASS_STAMINA_MAX,PASS_STAMINA_REGEN_MS,STAMINA_MAX,STAMINA_REGEN_MS,regenLabel} from './stamina';
import {canSpend,monthlyLimit,PREMIUM_PASS_PRICE_YEN,readAgeBand,readSpent,saveAgeBand,type AgeBand} from './point-products';
import {AgeAsk} from './PackShop';
import './point-shop.css';
import './monetize.css';

const count=(n:number)=>n.toLocaleString('ja-JP');

// Rewarded ad: 見終わったら1回引く。スカウト画面・ホーム・シーズン結果に置く。Renders nothing in the browser build.
// label: ボタンの文言(ホーム・結果は「動画を見てスカウト1回」)。hideWhenNone: 今日の分が終わったら出さない(スカウト画面以外)。
export function RewardAdButton({disabled,onStart,onReward,onEnd,label='広告を見て1回引く',hideWhenNone=false,className=''}:{disabled:boolean;onStart:()=>void;onReward:(points:number)=>void;onEnd:()=>void;label?:string;hideWhenNone?:boolean;className?:string}){
 const m=useMonetize(),[note,setNote]=useState('');
 if(!m)return null;
 const {reward}=m,none=reward.left<=0;
 if(none&&hideWhenNone&&!note)return null;
 const watch=async()=>{
  const bridge=monetizeBridge();if(!bridge||disabled||reward.busy||none)return;
  setNote('');onStart();
  try{
   const result=await bridge.showRewardAd(onReward);
   setNote(result==='rewarded'?'視聴ありがとうございます。スカウトを1回引きます。':result==='dismissed'?'最後まで視聴すると受け取れます。':result==='limit'?'今日の上限に達しました。':result==='failed'?'広告を読み込めませんでした。少し待ってから、もう一度押してください。':result==='busy'?'ほかの広告を表示中です。閉じてからもう一度押してください。':'');
  }finally{onEnd();}
 };
 return <div className={'reward-ad '+className}>
  <button type="button" className="s-button reward-ad-button" disabled={disabled||reward.busy||none} onClick={()=>void watch()}>
   <PlayCircle size={18}/>{reward.busy?'広告を読み込み中…':none?'今日の広告で引ける分は終了':label}
   <small>今日あと {reward.left} / {reward.limit} 回</small>
  </button>
  {note&&<p role="status">{note}</p>}
 </div>;
}

// Premium pass purchase / restore. Price comes only from the store; never invented.
export function PremiumPassCard(){
 const m=useMonetize(),[asking,setAsking]=useState(false),[note,setNote]=useState('');
 if(!m)return null;
 const {premium}=m,bridge=monetizeBridge();
 // 未成年の月の上限にパスも数える(パックと同じ記録)。年齢が未回答なら先に聞く。
 const buy=(band:AgeBand|null=readAgeBand())=>{
  if(!band){setAsking(true);return;}
  if(!canSpend(band,readSpent(),PREMIUM_PASS_PRICE_YEN)){setNote(`今月の購入の上限（${count(monthlyLimit(band)??0)}円）を超えるため購入できません。来月またご利用ください。`);return;}
  setNote('');void bridge?.buyPremium();
 };
 return <section className="premium-pass" aria-labelledby="premium-pass-title">
  <h3 id="premium-pass-title"><Crown size={18}/>プレミアムパス<small>買い切り</small></h3>
  <ul>
   <li>試合で獲得するポイントが {PREMIUM_MATCH_MULTIPLIER} 倍</li>
   <li>毎日のログインで ＋{count(PREMIUM_DAILY_POINTS)} pt（1日1回）</li>
   <li>行動力の上限 {STAMINA_MAX}→{PASS_STAMINA_MAX}、回復 {regenLabel(STAMINA_REGEN_MS)}→{regenLabel(PASS_STAMINA_REGEN_MS)}ごと</li>
   <li>シーズン終了後の全画面広告を表示しない</li>
  </ul>
  <p className="premium-pass-note">スカウトの抽選確率・試合の結果は変わりません。「広告を見て1回引く」はパス購入後も任意で使えます。1回だけの購入で、定期購入ではありません。</p>
  {premium.owned?<p className="premium-pass-owned" role="status">購入済み・有効です{premium.verified?'':'（前回の確認結果）'}</p>:
   <button type="button" className="s-primary premium-pass-buy" disabled={premium.status!=='ready'||premium.busy} onClick={()=>buy()}>
    {premium.status==='checking'?'ストアを確認中…':premium.status==='ready'&&premium.price?`${premium.price} で購入する`:'読み込めません'}
   </button>}
  {premium.status==='unavailable'&&!premium.owned&&<div className="pack-retry" role="status"><p>ストアに接続できませんでした。通信状態を確認して、もう一度読み込んでください。</p><button type="button" className="s-button" onClick={()=>bridge?.refreshStore?.(true)}>もう一度読み込む</button></div>}
  <button type="button" className="s-button" disabled={premium.busy} onClick={()=>void bridge?.restorePremium()}>購入を復元</button>
  {asking&&<AgeAsk onChoose={band=>{saveAgeBand(band);setAsking(false);buy(band);}} onCancel={()=>setAsking(false)}/>}
  {(note||premium.message)&&<p role="status">{note||premium.message}</p>}
  {m.privacyOptions&&<button type="button" className="s-button" onClick={()=>void bridge?.showPrivacyOptions()}>広告のプライバシー設定</button>}
 </section>;
}
