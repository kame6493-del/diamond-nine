// 人形のユニフォームをチームの色に塗り替える(2026-11-05)。絵柄は今のコマ(ChatGPT イメージで描いた atlas_blue)のまま、
// 「塗る所」の絵(atlas_mask: scripts/build-uniform-mask.py が青と赤の2枚の違いから作る)の所だけを、明るさを残して別の色にする。
// 帽子(マスクの G)と上着・靴下を別の色にできる(ビジター用の白い上着+チーム色の帽子)。色ごとに1回だけ作って覚える。
import type {Uniform} from './team-colors';
import {rgb} from './team-colors';

const cache=new Map<string,HTMLCanvasElement>();
let base:HTMLImageElement|null=null,mask:HTMLImageElement|null=null;
let baseData:ImageData|null=null,maskData:ImageData|null=null;
const waiters=new Set<()=>void>();
function load(src:string,done:(i:HTMLImageElement)=>void){const i=new Image();i.decoding='async';i.onload=()=>{done(i);};i.src=src;return i;}
function ensure(onReady:()=>void){
 if(baseData&&maskData)return true;
 waiters.add(onReady);
 if(!base){
  const ready=()=>{if(!base?.complete||!mask?.complete||!base.naturalWidth||!mask.naturalWidth)return;
   const read=(im:HTMLImageElement)=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d',{willReadFrequently:true})!;g.drawImage(im,0,0);return g.getImageData(0,0,c.width,c.height);};
   baseData=read(base);maskData=read(mask);for(const w of [...waiters])w();waiters.clear();};
  base=load('/assets/pro/watch/m/atlas_blue.webp',ready);mask=load('/assets/pro/watch/m/atlas_mask.webp',ready);
 }
 return false;
}
/** 1色を塗る: 明るさ s(128=ふつう)。暗い色(黒など)は影が見えるように少し持ち上げる。 */
function shade(c:number,s:number,dark:boolean){const f=s/128;let v=f<=1?c*f:c+(255-c)*Math.min(1,f-1);if(dark)v=c+70*f;return Math.max(0,Math.min(255,v));}
/** そのユニフォームの人形のコマの絵(まだ読み込み中なら null。読み終わると onReady を呼ぶ)。 */
export function tintedAtlas(u:Uniform,onReady:()=>void):HTMLCanvasElement|null{
 const key=u.body+'|'+u.cap;const hit=cache.get(key);if(hit)return hit;
 if(!ensure(onReady)||!baseData||!maskData)return null;
 const out=new ImageData(new Uint8ClampedArray(baseData.data),baseData.width,baseData.height),d=out.data,m=maskData.data;
 const body=rgb(u.body),cap=rgb(u.cap),dk=(c:number[])=>Math.max(...c)<40;
 const bd=dk(body),cd=dk(cap);
 for(let i=0;i<d.length;i+=4){
  const a=m[i+3];if(!a)continue;
  const s=m[i],isCap=m[i+1]>127,col=isCap?cap:body,dark=isCap?cd:bd,k=a/255;
  d[i]=d[i]*(1-k)+shade(col[0],s,dark)*k;d[i+1]=d[i+1]*(1-k)+shade(col[1],s,dark)*k;d[i+2]=d[i+2]*(1-k)+shade(col[2],s,dark)*k;
 }
 const c=document.createElement('canvas');c.width=out.width;c.height=out.height;c.getContext('2d')!.putImageData(out,0,0);
 cache.set(key,c);return c;
}
