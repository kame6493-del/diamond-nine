// Sends play events to Google Analytics 4 over the Measurement Protocol.
// No native SDK and no config files: plain HTTPS from the web view. Imported from
// runtime.ts only on native platforms. The install id is random, kept in local
// storage, and removed with the app; nothing from the save (team or player
// names) is sent. Every failure is silent: analytics must never block the game.
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import config from './analytics-config.json';
import type {AnalyticsBridge,AnalyticsValue} from '../src/pro/analytics';

const KEY={install:'diamond-nine-install-id',first:'diamond-nine-first-launch',session:'diamond-nine-analytics-session'};
const SESSION_GAP_MS=30*60*1000,MAX_BATCH=25,FLUSH_MS=5000;
const read=(k:string)=>{try{return localStorage.getItem(k);}catch{return null;}};
const write=(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch{/* this session still reports */}};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

type Pending={name:string;params:Record<string,AnalyticsValue>;timestamp_micros:number};
export function installAnalytics():void{
 if(!config.measurementId||!config.apiSecret)return;
 const platform=Capacitor.getPlatform();
 let install=read(KEY.install),firstLaunch=read(KEY.first);
 const isNew=!install;
 if(!install){install=`${Math.floor(Math.random()*2**31)}.${Math.floor(Date.now()/1000)}`;write(KEY.install,install);}
 if(!firstLaunch){firstLaunch=today();write(KEY.first,firstLaunch);}
 let appVersion='';
 let session:{id:string;last:number;count:number}=(()=>{try{return JSON.parse(read(KEY.session)??'')}catch{return {id:'',last:0,count:0};}})();
 let lastEvent=Date.now(),queue:Pending[]=[],timer:ReturnType<typeof setTimeout>|null=null;
 const url=`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(config.measurementId)}&api_secret=${encodeURIComponent(config.apiSecret)}`;
 // Only "simple" cross-origin requests reach GA from the web view. With an
 // application/json body the browser sends a CORS preflight, the collect endpoint
 // answers it with 405, and no event was ever sent (found 2026-10-03). Measured in
 // Chrome: no-cors text/plain fetch and sendBeacon arrive; the same fetch with
 // keepalive did not. GA accepts the JSON body as text.
 const send=(body:string,leaving:boolean)=>{
  if(leaving&&typeof navigator.sendBeacon==='function'&&navigator.sendBeacon(url,new Blob([body],{type:'text/plain;charset=UTF-8'})))return;
  void fetch(url,{method:'POST',body,mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'}}).catch(()=>{});
 };
 const flush=(leaving=false)=>{
  if(timer){clearTimeout(timer);timer=null;}
  while(queue.length){
   const events=queue.splice(0,MAX_BATCH).map(e=>({name:e.name,params:e.params,timestamp_micros:e.timestamp_micros}));
   send(JSON.stringify({client_id:install,user_properties:{
    app_platform:{value:platform},app_version:{value:appVersion||'unknown'},first_launch_day:{value:firstLaunch}},events}),leaving);
  }
 };
 const schedule=()=>{if(queue.length>=MAX_BATCH)flush();else if(!timer)timer=setTimeout(()=>flush(),FLUSH_MS);};
 const push=(name:string,params:Record<string,AnalyticsValue>={})=>{
  const now=Date.now();
  if(!session.id||now-session.last>SESSION_GAP_MS){
   session={id:String(Math.floor(now/1000)),last:now,count:session.count+1};
   queue.push({name:'app_session',timestamp_micros:now*1000,params:{session_id:session.id,session_number:session.count,engagement_time_msec:1}});
  }
  // GA4 counts a user as active only when events carry engagement time.
  const engaged=Math.max(1,Math.min(60000,now-lastEvent));lastEvent=now;session.last=now;write(KEY.session,JSON.stringify(session));
  queue.push({name,timestamp_micros:now*1000,params:{...params,session_id:session.id,session_number:session.count,engagement_time_msec:engaged}});
  schedule();
 };
 const bridge:AnalyticsBridge={track:(name,params)=>{try{push(name,params);}catch{/* ignore */}}};
 window.diamondAnalytics=bridge;
 void App.getInfo().then(info=>{appVersion=`${info.version} (${info.build})`;}).catch(()=>{});
 if(isNew)push('app_first_launch',{first_launch_day:firstLaunch});
 push('app_open',{});
 void App.addListener('appStateChange',({isActive})=>{
  if(isActive){lastEvent=Date.now();push('app_resume',{});}
  else{push('app_background',{});flush(true);}
 }).catch(()=>{});
}
