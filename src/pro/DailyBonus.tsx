import {useEffect} from 'react';
import confetti from 'canvas-confetti';
import {Gift} from 'lucide-react';
import './season-result.css';

export const DAILY_BONUS=300;
const keyFor=(profile:string)=>'diamond-nine-daily-bonus-'+profile;
const today=()=>new Date().toLocaleDateString('sv-SE');

// Returns true once per calendar day per profile and records the claim.
export function claimDailyBonus(profile:string,storage:Storage=localStorage){
 try{
  if(storage.getItem(keyFor(profile))===today())return false;
  storage.setItem(keyFor(profile),today());
  return true;
 }catch{return false;}
}

export function DailyBonusPopup({amount,onClose}:{amount:number;onClose:()=>void}){
 useEffect(()=>{void confetti({particleCount:70,spread:90,startVelocity:35,origin:{y:.4},colors:['#ffd04a','#fff2b3','#ffffff'],zIndex:1300,disableForReducedMotion:true});},[]);
 return <div className="season-result-backdrop" role="dialog" aria-modal="true" aria-label="ログインボーナス" onClick={onClose}>
  <div className="season-result tone-gold" onClick={e=>e.stopPropagation()}>
   <p className="sr-kicker">DAILY BONUS</p>
   <div className="sr-badge"><Gift size={36}/></div>
   <h2 className="sr-headline">ログインボーナス</h2>
   <p className="sr-team">今日も来てくれてありがとう!</p>
   <div className="sr-earned"><span>獲得ポイント</span><b>+{amount.toLocaleString('ja-JP')}</b><small>pt</small></div>
   <p className="sr-team">毎日ひらくと受け取れます</p>
   <button className="s-primary sr-ok" onClick={onClose}>受け取る</button>
  </div>
 </div>;
}
