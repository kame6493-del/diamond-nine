import {Crown,Sparkles,Zap} from 'lucide-react';
import {useEffect,useState,type CSSProperties} from 'react';
import confetti from 'canvas-confetti';
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

// Night-stadium theme only: flash, camera shake and a confetti burst for gold/rainbow pulls.
function StadiumBurst({tier}:{tier:ScoutTier}){
 const [flash,setFlash]=useState(true);
 useEffect(()=>{
  const app=document.querySelector('.simple-app.stadium');
  if(!app||window.matchMedia('(prefers-reduced-motion: reduce)').matches){setFlash(false);return;}
  app.classList.add('sd-shake');
  const colors=tier==='rainbow'?['#ff7ad9','#7fe3ff','#fff59a','#b58cff','#ffffff']:['#ffd04a','#fff2b3','#ffffff','#ffb52e'];
  const shot=(angle:number,x:number)=>void confetti({particleCount:tier==='rainbow'?140:90,angle,spread:70,startVelocity:55,origin:{x,y:.75},colors,zIndex:1200,disableForReducedMotion:true});
  shot(60,0);shot(120,1);
  const later=setTimeout(()=>{void confetti({particleCount:tier==='rainbow'?200:120,spread:120,startVelocity:38,origin:{y:.35},colors,zIndex:1200,disableForReducedMotion:true});},350);
  const off=setTimeout(()=>{app.classList.remove('sd-shake');setFlash(false);},750);
  return()=>{clearTimeout(later);clearTimeout(off);app.classList.remove('sd-shake');};
 },[tier]);
 return flash?<div className={'sd-flash '+tier} aria-hidden="true"/>:null;
}

export function ScoutArrival({tier,overall,major}:{tier:ScoutTier;overall:number;major:boolean}){
 if(tier==='standard')return null;
 return <>
  <StadiumBurst tier={tier}/>
  <div className="scout-arrival-rays animate__animated animate__rotateIn" aria-hidden="true"/>
  <div className="scout-shockwave animate__animated animate__zoomOut" aria-hidden="true"/>
  <div className={'scout-arrival animate__animated '+(tier==='rainbow'?'animate__backInDown':'animate__bounceIn')}>
   <span>{major?'海外選手を獲得！':'選手獲得！'}</span>
   <div><small>総合</small><strong>{overall}</strong>{tier==='rainbow'?<Crown aria-hidden="true" size={27}/>:<Zap aria-hidden="true" size={23}/>}</div>
  </div>
 </>;
}
