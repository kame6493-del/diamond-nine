export interface AdSenseConfig {enabled:boolean;publisherId:string;seasonResultSlotId:string}
export const validPublisherId=(id:string)=>/^ca-pub-\d{16}$/.test(id);
export const adsEnabled=(config:AdSenseConfig)=>config.enabled&&validPublisherId(config.publisherId)&&/^\d{10}$/.test(config.seasonResultSlotId);
let scriptLoad:Promise<void>|undefined;
// Nothing is loaded until the owner configures an approved account and slot.
export function loadAdSense(publisherId:string):Promise<void>{
 if(!validPublisherId(publisherId))return Promise.reject(new Error('Invalid publisher ID'));
 if(!scriptLoad)scriptLoad=new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';
  script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(publisherId);
  script.onload=()=>resolve();script.onerror=()=>reject(new Error('Ad unavailable'));document.head.appendChild(script);
 });
 return scriptLoad;
}
