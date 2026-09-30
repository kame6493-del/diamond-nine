import {useState} from 'react';
import {Crown,PlayCircle} from 'lucide-react';
import {INTERSTITIAL_EVERY_SCOUTS,PREMIUM_DAILY_POINTS,monetizeBridge,useMonetize} from './monetization';
import {PREMIUM_MATCH_MULTIPLIER} from './platform-economy';
import './monetize.css';

const count=(n:number)=>n.toLocaleString('ja-JP');

// Rewarded ad near the scout wallet. Renders nothing in the browser build.
export function RewardAdButton({disabled,onStart,onReward,onEnd}:{disabled:boolean;onStart:()=>void;onReward:(points:number)=>void;onEnd:()=>void}){
 const m=useMonetize(),[note,setNote]=useState('');
 if(!m)return null;
 const {reward}=m,none=reward.left<=0;
 const watch=async()=>{
  const bridge=monetizeBridge();if(!bridge||disabled||reward.busy||none)return;
  setNote('');onStart();
  try{
   const result=await bridge.showRewardAd(onReward);
   setNote(result==='rewarded'?`＋${count(reward.points)} pt を受け取りました。`:result==='dismissed'?'最後まで視聴すると受け取れます。':result==='limit'?'今日の上限に達しました。':result==='failed'?'広告を読み込めませんでした。時間をおいてお試しください。':'');
  }finally{onEnd();}
 };
 return <div className="reward-ad">
  <button type="button" className="s-button reward-ad-button" disabled={disabled||reward.busy||none} onClick={()=>void watch()}>
   <PlayCircle size={18}/>{reward.busy?'広告を読み込み中…':none?'今日の広告ボーナスは終了':`広告を見て ＋${count(reward.points)} pt`}
   <small>今日あと {reward.left} / {reward.limit} 回</small>
  </button>
  {note&&<p role="status">{note}</p>}
 </div>;
}

// Premium pass purchase / restore. Price comes only from the store; never invented.
export function PremiumPassCard(){
 const m=useMonetize();
 if(!m)return null;
 const {premium}=m,bridge=monetizeBridge();
 return <section className="premium-pass" aria-labelledby="premium-pass-title">
  <h3 id="premium-pass-title"><Crown size={18}/>プレミアムパス<small>買い切り</small></h3>
  <ul>
   <li>試合で獲得するポイントが {PREMIUM_MATCH_MULTIPLIER} 倍</li>
   <li>毎日のログインで ＋{count(PREMIUM_DAILY_POINTS)} pt（1日1回）</li>
   <li>シーズン終了時・スカウト{INTERSTITIAL_EVERY_SCOUTS}回ごとの広告を表示しない</li>
  </ul>
  <p className="premium-pass-note">スカウトの抽選確率・試合の結果は変わりません。「広告を見て ＋pt」はパス購入後も任意で使えます。1回だけの購入で、定期購入ではありません。</p>
  {premium.owned?<p className="premium-pass-owned" role="status">購入済み・有効です{premium.verified?'':'（前回の確認結果）'}</p>:
   <button type="button" className="s-primary premium-pass-buy" disabled={premium.status!=='ready'||premium.busy} onClick={()=>void bridge?.buyPremium()}>
    {premium.status==='checking'?'ストアを確認中…':premium.status==='ready'&&premium.price?`${premium.price} で購入する`:'販売準備中'}
   </button>}
  {premium.status==='unavailable'&&!premium.owned&&<p className="premium-pass-note">ストアでの販売開始をお待ちください。</p>}
  <button type="button" className="s-button" disabled={premium.busy} onClick={()=>void bridge?.restorePremium()}>購入を復元</button>
  {premium.message&&<p role="status">{premium.message}</p>}
  {m.privacyOptions&&<button type="button" className="s-button" onClick={()=>void bridge?.showPrivacyOptions()}>広告のプライバシー設定</button>}
 </section>;
}
