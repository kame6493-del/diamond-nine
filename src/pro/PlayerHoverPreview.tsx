import {ownedRatings} from './development';
import { useEffect,useId,useLayoutEffect,useRef,useState } from 'react';
import { createPortal } from 'react-dom';
import { grade,gradeColor,playerMap,teamById,uzrInfo } from './data';
import { velocityLabel } from './wiki-players';

type Preview={playerId:string;anchor:HTMLElement;left:number;top:number};
const battingAbilities=[['contact','ミート'],['power','パワー'],['speed','走力'],['arm','肩力'],['field','守備力']] as const;
const pitchingAbilities=[['control','コントロール'],['stamina','スタミナ'],['breaking','変化球総合']] as const;

export function PlayerHoverPreview({owned,training}:{owned:Record<string,number>;training:Record<string,number>}){
 const [preview,setPreview]=useState<Preview|null>(null);
 const popup=useRef<HTMLDivElement>(null),anchor=useRef<HTMLElement|null>(null);
 const hideTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const tooltipId=useId();

 useEffect(()=>{
  const cancelHide=()=>{if(hideTimer.current!==null){clearTimeout(hideTimer.current);hideTimer.current=null;}};
  const hide=()=>{cancelHide();anchor.current=null;setPreview(null);};
  const hideSoon=()=>{cancelHide();hideTimer.current=setTimeout(hide,160);};
  const inside=(target:EventTarget|null)=>target instanceof Node&&(anchor.current?.contains(target)||popup.current?.contains(target));
  const show=(target:EventTarget|null)=>{
   cancelHide();
   if(target instanceof Node&&popup.current?.contains(target))return;
   const trigger=target instanceof Element?target.closest<HTMLElement>('[data-player-id]'):null;
   const playerId=trigger?.dataset.playerId;
   if(!trigger||!playerId||!playerMap[playerId]){hideSoon();return;}
   if(anchor.current===trigger)return;
   anchor.current=trigger;
   const rect=trigger.getBoundingClientRect(),width=Math.min(282,window.innerWidth-20);
   const left=rect.right+12+width<=window.innerWidth-10?rect.right+12:rect.left-width-12>=10?rect.left-width-12:Math.max(10,(window.innerWidth-width)/2);
   setPreview({playerId,anchor:trigger,left,top:Math.max(10,rect.top)});
  };
  const enter=(event:PointerEvent)=>{if(event.pointerType!=='touch')show(event.target);};
  const leave=(event:PointerEvent)=>{if(!inside(event.relatedTarget))hideSoon();};
  const focus=(event:FocusEvent)=>show(event.target);
  const blur=(event:FocusEvent)=>{if(!inside(event.relatedTarget))hide();};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')hide();};
  document.addEventListener('pointerover',enter);
  document.addEventListener('pointerout',leave);
  document.addEventListener('focusin',focus);
  document.addEventListener('focusout',blur);
  document.addEventListener('click',hide,true);
  document.addEventListener('keydown',key);
  window.addEventListener('scroll',hide,true);
  window.addEventListener('resize',hide);
  return()=>{
   cancelHide();document.removeEventListener('pointerover',enter);document.removeEventListener('pointerout',leave);
   document.removeEventListener('focusin',focus);document.removeEventListener('focusout',blur);
   document.removeEventListener('click',hide,true);document.removeEventListener('keydown',key);
   window.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide);
  };
 },[]);

 useLayoutEffect(()=>{
  if(!preview||!popup.current)return;
  const height=popup.current.getBoundingClientRect().height;
  const top=Math.max(10,Math.min(preview.top,window.innerHeight-height-10));
  if(top!==preview.top)setPreview({...preview,top});
 },[preview]);
 useEffect(()=>{
  if(!preview)return;
  const trigger=preview.anchor,previous=trigger.getAttribute('aria-describedby');
  trigger.setAttribute('aria-describedby',[previous,tooltipId].filter(Boolean).join(' '));
  return()=>{if(previous===null)trigger.removeAttribute('aria-describedby');else trigger.setAttribute('aria-describedby',previous);};
 },[preview?.anchor,tooltipId]);

 if(!preview)return null;
 const player=playerMap[preview.playerId],ratings=ownedRatings(player,owned,training),level=training[player.id]??0;
 const isPitcher=player.role==='pitcher',abilities=player.mlb?.twoWay?[...pitchingAbilities,...battingAbilities]:isPitcher?pitchingAbilities:battingAbilities;
 return createPortal(<div ref={popup} id={tooltipId} role="tooltip" className={`player-hover-preview ${isPitcher?'pitcher':''}`} style={{left:preview.left,top:preview.top}}>
  <div className="player-hover-heading"><div><small>{teamById(player.team).short} · {player.dataYear}</small><strong>{player.name}</strong></div></div>
  {isPitcher&&<div className="player-hover-velocity"><span>{velocityLabel(player)}</span><strong>{player.ratings.velocity}<small>km/h</small></strong></div>}
  <div className="player-hover-abilities">{abilities.map(([key,label])=>{
   const value=ratings[key],color=gradeColor(value);
   return <div className="player-hover-ability" key={key}><span>{label}</span><div className="player-hover-bar"><i style={{width:`${value}%`,background:color}}/></div><b style={{color}}>{grade(value)}</b><strong>{value}</strong></div>;
  })}</div>
  <div className="player-hover-foot">{level?`覚醒 ${level} / 5 を反映`:'現在の選手能力'}<span>クリックで詳細</span></div>
 </div>,document.body);
}
