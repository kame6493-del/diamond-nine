import {Capacitor,registerPlugin} from '@capacitor/core';
import type {AndroidPointStore} from '../src/pro/point-products';
import {Filesystem,Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Browser} from '@capacitor/browser';
import {App} from '@capacitor/app';
import type {NativeFiles} from '../src/pro/native-files';
import type {} from '../src/pro/review';
import type {} from '../src/pro/feedback';
import {installMonetize} from './monetize';
import {installAnalytics} from './analytics';
import {InAppReview} from '@capacitor-community/in-app-review';
const toBase64=(file:File)=>new Promise<string>((resolve,reject)=>{
 const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);
});
if(Capacitor.isNativePlatform()){
 if(Capacitor.getPlatform()==='android')window.diamondPointStore=registerPlugin<AndroidPointStore>('PointStore');
 try{installAnalytics();}catch{/* analytics is optional */}
 try{installMonetize();}catch{/* ads and the pass are optional; the game must still start */}
 const bridge:NativeFiles={async share({files,text,title}){
  const paths:string[]=[],uris:string[]=[];
  try{
   for(const file of files){
    const path=`share/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const saved=await Filesystem.writeFile({path,directory:Directory.Cache,data:await toBase64(file),recursive:true});paths.push(path);uris.push(saved.uri);
   }
   await Share.share({title,text,files:uris,dialogTitle:'保存・共有先を選ぶ'});
  }finally{
   // Give the recipient time to read content URIs before removing temporary files.
   setTimeout(()=>{for(const path of paths)void Filesystem.deleteFile({path,directory:Directory.Cache}).catch(()=>{});},300000);
  }
 }};
 window.diamondNativeFiles=bridge;
 window.diamondReview={request:()=>InAppReview.requestReview()};
 void App.getInfo().then(i=>{window.diamondAppVersion=`${i.version} (${i.build})`;}).catch(()=>{});
 // Android back: close the top dialog, then return to the first tab, then background the
 // app. Without this the system back gesture quit the app while a dialog was open.
 void App.addListener('backButton',()=>{
  const dialogs=Array.prototype.filter.call(document.querySelectorAll('[role=dialog]'),(d:Element)=>d.getClientRects().length>0) as HTMLElement[];
  const top=dialogs[dialogs.length-1];
  if(top){
   const close=top.querySelector('button[aria-label*="閉じる"]') as HTMLButtonElement|null;
   if(close){close.click();return;}
   top.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   return;
  }
  const firstTab=document.querySelector('.s-nav button') as HTMLButtonElement|null;
  if(firstTab&&!firstTab.disabled&&firstTab.getAttribute('aria-current')!=='page'){firstTab.click();window.scrollTo({top:0});return;}
  void App.minimizeApp();
 });
 document.addEventListener('click',event=>{
  const anchor=(event.target as Element)?.closest?.('a');if(!anchor)return;
  const url=new URL(anchor.href,location.href);
  if(['http:','https:'].includes(url.protocol)&&url.origin!==location.origin){event.preventDefault();void Browser.open({url:url.href}).catch(()=>alert('リンクを開けませんでした。'));}
 });
}
