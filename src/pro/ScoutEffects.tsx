import {Crown,Sparkles,Zap} from 'lucide-react';
import type {CSSProperties} from 'react';
import {scoutDuration,type ScoutTier} from './scout-presentation';
export {scoutDuration} from './scout-presentation';

export function ScoutCharge({tier='standard',onSkip}:{tier?:ScoutTier;onSkip?:()=>void}){
 const premium=tier!=='standard';
 return <div className={'scout-charge neon-scout scout-tier-'+tier} style={{'--scout-time':`${scoutDuration(tier,false)}ms`,'--burst-delay':`${scoutDuration(tier,false)-450}ms`} as CSSProperties} role="status" aria-label="スカウト演出中">
  {premium&&<><div className="scout-spotlight animate__animated animate__rotateIn" aria-hidden="true"/><div className="scout-ring-outer animate__animated animate__zoomIn" aria-hidden="true"/></>}
  <div className="neon-orbit animate__animated animate__rotateIn" aria-hidden="true"/>
  <div className="scout-energy animate__animated animate__zoomIn" aria-hidden="true"/>
  <div className={'neon-pack animate__animated '+(premium?'animate__rubberBand':'animate__tada')} aria-hidden="true">{tier==='rainbow'?<Crown size={42}/>:premium?<Zap size={42}/>:<Sparkles size={42}/>}<b>9</b><span>DIAMOND NINE</span></div>
  <div className="scout-flash animate__animated animate__zoomIn" aria-hidden="true"/>
  <strong>SCOUT</strong>
  {onSkip&&<button className="scout-skip" onClick={onSkip}>演出をスキップ</button>}
 </div>;
}

export function ScoutArrival({tier,overall,major}:{tier:ScoutTier;overall:number;major:boolean}){
 if(tier==='standard')return null;
 return <>
  <div className="scout-arrival-rays animate__animated animate__rotateIn" aria-hidden="true"/>
  <div className="scout-shockwave animate__animated animate__zoomOut" aria-hidden="true"/>
  <div className={'scout-arrival animate__animated '+(tier==='rainbow'?'animate__backInDown':'animate__bounceIn')}>
   <span>{major?'MLB選手を獲得！':'選手獲得！'}</span>
   <div><small>総合</small><strong>{overall}</strong>{tier==='rainbow'?<Crown aria-hidden="true" size={27}/>:<Zap aria-hidden="true" size={23}/>}</div>
  </div>
 </>;
}
