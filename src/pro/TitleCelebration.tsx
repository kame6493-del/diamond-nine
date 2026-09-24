import {useEffect,useId,useLayoutEffect,useRef} from 'react';
import {ArrowRight,Crown,Globe2,Star,Trophy,Volume2,VolumeX,X} from 'lucide-react';
import {gameSound,prepareGameAudio,stopGameAudio} from './game-audio';
import type {TitleCelebration as Celebration} from './title-celebration';
import './title-celebration.css';

export function TitleCelebration({celebration,sound,onToggleSound,onClose}:{celebration:Celebration;sound:boolean;onToggleSound:()=>void;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),closeButton=useRef<HTMLButtonElement>(null),id=useId();
 const space=celebration.kind==='space-champion',world=space||celebration.kind==='world-champion';
 useLayoutEffect(()=>{
  const dialog=ref.current!,previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';dialog.showModal();closeButton.current?.focus({preventScroll:true});
  return()=>{dialog.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[]);
 useEffect(()=>{
  stopGameAudio();
  if(sound){gameSound('impact');gameSound(world?'rainbow':'gold',.3);gameSound('voice',1.3);}
  return stopGameAudio;
 },[sound,world]);
 const mute=()=>{if(!sound)void prepareGameAudio();onToggleSound();};
 return <dialog ref={ref} className={`title-celebration ${world?'title-world':'title-unlock'}`} aria-labelledby={`${id}-heading`} aria-describedby={`${id}-description`} onCancel={e=>{e.preventDefault();onClose();}} onKeyDown={e=>{
  if(e.key!=='Tab')return;
  const buttons=Array.from(ref.current!.querySelectorAll<HTMLButtonElement>('button:not([disabled])')),first=buttons[0],last=buttons.at(-1)!;
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }}>
  <div className="title-aura animate__animated animate__fadeIn" aria-hidden="true"><div/><div/><div/></div>
  <div className="title-controls"><span>DIAMOND NINE</span><div><button type="button" onClick={mute} aria-label={sound?'効果音をオフにする':'効果音をオンにする'}>{sound?<Volume2 size={20}/>:<VolumeX size={20}/>}</button><button ref={closeButton} type="button" onClick={onClose} aria-label="お祝い演出を閉じる"><X size={23}/></button></div></div>
  <div className="title-stage">
   <p className="title-first animate__animated animate__fadeInDown">{space?'初の宇宙一':world?'初の世界一':'初のリーグ3連覇'}<span>FIRST ACHIEVEMENT</span></p>
   <div className="title-emblem animate__animated animate__zoomInDown" aria-hidden="true"><div className="title-emblem-frame"/>{world?<Trophy strokeWidth={1.25}/>:<Globe2 strokeWidth={1.2}/>}<span>{world?<Crown size={24}/>:<><Star/><Star/><Star/></>}</span></div>
   <p className="title-english animate__animated animate__backInDown" aria-hidden="true">{space?<>UNIVERSE<br/>CHAMPIONS</>:world?<>WORLD<br/>CHAMPIONS</>:<>WORLD<br/>UNLOCKED</>}</p>
   <div className="title-message animate__animated animate__fadeInUp">
    <p className="title-club">{celebration.clubName}</p>
    <h1 id={`${id}-heading`}>{space?<>宇宙王座決定戦<br/>初優勝おめでとう！</>:world?<>世界王座決定戦<br/>初優勝おめでとう！</>:<>おめでとう！<br/>海外リーグに挑戦する権利を<br className="title-small-break"/>手に入れた！</>}</h1>
    <p className="title-year"><strong>{celebration.year}</strong>年目で{space?'宇宙の頂点へ':world?'世界の頂点へ':'国内リーグ3連覇を達成'}</p>
    <p className="title-description" id={`${id}-description`}>{space?'育成と采配を極め、最高難易度を突破。':world?'宇宙リーグに挑戦する権利を手に入れた！':<>次の舞台は、世界。<br/>海外リーグへの挑戦はいつでも選べます。</>}</p>
   </div>
   <button type="button" className="title-continue animate__animated animate__fadeInUp" onClick={onClose}>{world?'優勝の記録を見る':'達成の記録を見る'}<ArrowRight size={20}/></button>
  </div>
 </dialog>;
}
