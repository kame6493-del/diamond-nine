import {useEffect,useRef,useState} from 'react';
import config from './adsense-config.json';
import {adsEnabled,loadAdSense} from './adsense';
import './season-ad.css';

export function SeasonAd(){
 const slot=useRef<HTMLModElement>(null),[unavailable,setUnavailable]=useState(false);
 const enabled=adsEnabled(config);
 useEffect(()=>{
  if(!enabled||!slot.current)return;
  const element=slot.current;let cancelled=false;
  const observer=new MutationObserver(()=>{if(element.getAttribute('data-ad-status')==='unfilled')setUnavailable(true);});
  observer.observe(element,{attributes:true,attributeFilter:['data-ad-status']});
  void loadAdSense(config.publisherId).then(()=>{
   if(cancelled||!element.isConnected||element.dataset.requested)return;
   element.dataset.requested='true';
   const adWindow=window as Window&{adsbygoogle?:unknown[]};(adWindow.adsbygoogle??=[]).push({});
  }).catch(()=>{if(!cancelled)setUnavailable(true);});
  return()=>{cancelled=true;observer.disconnect();};
 },[enabled]);
 if(!enabled||unavailable)return null;
 return <aside className="season-ad" aria-label="広告"><p>広告</p><ins ref={slot} className="adsbygoogle" style={{display:'block'}} data-ad-client={config.publisherId} data-ad-slot={config.seasonResultSlotId} data-ad-format="auto" data-full-width-responsive="true"/></aside>;
}
