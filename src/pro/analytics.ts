// Play analytics for the app. The native runtime (mobile/analytics.ts) sets
// window.diamondAnalytics; the browser build never has it, so track() is a no-op
// on the web and in tests. Event parameters are game facts only: no names, no
// free text, no identifiers other than the random install id the bridge keeps.
export type AnalyticsValue = string | number | boolean;
export interface AnalyticsBridge {track(name: string, params?: Record<string, AnalyticsValue>): void}
declare global {interface Window {diamondAnalytics?: AnalyticsBridge}}

const NAME=/^[a-z][a-z0-9_]{0,39}$/;
export function cleanParams(params:Record<string,AnalyticsValue|null|undefined>={}):Record<string,AnalyticsValue>{
 const out:Record<string,AnalyticsValue>={};
 for(const [key,value] of Object.entries(params)){
  if(!NAME.test(key)||value===null||value===undefined)continue;
  if(typeof value==='number'){if(Number.isFinite(value))out[key]=value;}
  else out[key]=typeof value==='string'?value.slice(0,100):value;
 }
 return out;
}
export function track(name:string,params:Record<string,AnalyticsValue|null|undefined>={}):void{
 if(!NAME.test(name))return;
 try{window.diamondAnalytics?.track(name,cleanParams(params));}catch{/* analytics must never break the game */}
}
