import {Capacitor} from '@capacitor/core';
import {Filesystem,Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Browser} from '@capacitor/browser';
import type {NativeFiles} from '../src/pro/native-files';
const toBase64=(file:File)=>new Promise<string>((resolve,reject)=>{
 const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);
});
if(Capacitor.isNativePlatform()){
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
 document.addEventListener('click',event=>{
  const anchor=(event.target as Element)?.closest?.('a');if(!anchor)return;
  const url=new URL(anchor.href,location.href);
  if(['http:','https:'].includes(url.protocol)&&url.origin!==location.origin){event.preventDefault();void Browser.open({url:url.href}).catch(()=>alert('リンクを開けませんでした。'));}
 });
}
