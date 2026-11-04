// 試合の画面のグラウンド(2026-11-05 作り直し)。本物の縮尺のグラウンド(field-sim.ts、メートル)を、捕手の後ろの少し高い所から見た形でキャンバスに描く。
// 芝・土・線・塁は大きさが変わった時だけ裏のキャンバスに1回描き、動きの間は人形とボールだけを毎コマ描く(スマホで重くならないように)。
// 解像度は表示の最大3倍(端末の倍率まで)で持つ。人形は ChatGPT で今の絵柄に合わせて描いたコマ(sprite-atlas.ts)、無いコマは今の絵を回す・ずらすで補う。
// 11/5 朝: 打者と捕手は、捕手の後ろから見た向き(背中が見える)に描き直した。右打者は左の打席で一塁側を向き、左打者は左右を返す。
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {actorAt,ballAt,fenceAt,BAGS,PLATE,RUBBER,type ActorAt,type Choreo,type Pose,type V} from './field-sim';
import {ATLAS,type FrameName} from './sprite-atlas';

export type TeamColor='blue'|'red';
export interface FieldScene {
 /** 今の場面(打席の前の立ち位置)。clip が無い時はこれを描く。 */
 still:Choreo;
 /** 動いている所(投球・打球)。start=performance.now() の始まり、speed=倍速。 */
 clip:{c:Choreo;start:number;speed:number}|null;
 defColor:TeamColor;batColor:TeamColor;
 /** 投手が左投げ(投げる形を左右反転)。打者が左打ち。 */
 lefty:boolean;leftyBat:boolean;
}
/** カメラ(捕手の後ろの高い所から)。ふだんは内野と外野の手前を大きく、打球が外野へ飛ぶと、球と追う野手が入るまで引いて追いかける。
 *  x0〜x1・y0〜y1(m)が画面に入るように、大きさ S(px/m)と真ん中を決める。 */
const TILT=.8;
export interface Cam {x0:number;x1:number;y0:number;y1:number}
export const HOME_CAM:Cam={x0:-40,x1:40,y0:-6,y1:89};
export interface Projection {S:number;W:number;H:number;cx:number;bottom:number;camX:number;camY:number}
const depth=(y:number)=>1-y/420;
/** 背の低いグラウンド(360x640 など)では、下の端にカウントの札の分(padB)をあけて、本塁・打者・捕手が札に隠れないようにする。 */
export const padBottom=(H:number)=>H<320?42:0;
export function projection(W:number,H:number,c:Cam=HOME_CAM):Projection{
 const pb=padBottom(H),h=H-pb,kMid=depth((c.y0+c.y1)/2),S=Math.min(h/((c.y1-c.y0)*TILT),W/((c.x1-c.x0)*kMid));
 const spare=Math.max(0,h-(c.y1-c.y0)*TILT*S);
 return {S,W,H,cx:W/2,bottom:H-pb-spare*.35,camX:(c.x0+c.x1)/2,camY:c.y0};
}
/** メートル → 画面の点。 */
export function toScreen(pr:Projection,p:V,h=0):[number,number]{
 const k=depth(p[1]);return [pr.cx+(p[0]-pr.camX*k)*pr.S*k,pr.bottom-(p[1]-pr.camY)*pr.S*TILT-h*pr.S*.9];
}
/** 人形の高さ(px)。奥ほど少し小さい。 */
export const figH=(pr:Projection,y:number)=>Math.max(18,Math.min(44,pr.S*7.4))*(1-Math.max(0,y)/330);
/** その時刻に映したい範囲: ふだんの範囲 + これから球が行く所 + 追う野手。 */
function wantCam(c:Choreo,t:number):Cam{
 const box={...HOME_CAM};
 if(c.motion==='pitch'||c.motion==='none')return box;
 const grow=(p:V)=>{box.x0=Math.min(box.x0,p[0]-9);box.x1=Math.max(box.x1,p[0]+9);box.y1=Math.max(box.y1,p[1]+10);};
 for(const sgt of c.ball)if(sgt.t0<=t+.35&&sgt.kind!=='pitch'){grow(sgt.t1<=t?sgt.b:sgt.a);if(sgt.t0<=t)grow(lerpV(sgt.a,sgt.b,Math.min(1,(t-sgt.t0+.35)/Math.max(.01,sgt.t1-sgt.t0))));}
 if(c.chaser){const a=c.actors.find(x=>x.pos===c.chaser);if(a)grow(actorAt(a,t).p);}
 box.y1=Math.min(box.y1,128);box.x0=Math.max(box.x0,-95);box.x1=Math.min(box.x1,95);
 return box;
}
const lerpV=(a:V,b:V,f:number):V=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];

// ---- 絵 ----
const BASE_IMG:Record<string,string>={batter:'batter',fielder:'fielder',pitcher:'pitcher',runner:'runner'};
const cache=new Map<string,HTMLImageElement>();
function img(src:string,onload:()=>void){let i=cache.get(src);if(!i){i=new Image();i.decoding='async';i.src=src;cache.set(src,i);}if(!i.complete)i.addEventListener('load',onload,{once:true});return i;}

/** 形 → 描くコマ。コマが無い時は、今の4枚の絵を回す・ずらす(fallback)。 */
interface Draw {frame?:FrameName;base:'batter'|'fielder'|'pitcher'|'runner';rot?:number;dy?:number;sy?:number;sx?:number}
function drawFor(a:ActorAt,t:number):Draw{
 const step=Math.sin(t*16+(a.id.length*1.7));
 if(a.role==='b'&&['stance','stride','swing','miss','follow','bunt'].includes(a.pose)){
  const m:Record<string,Draw>={stance:{frame:'bat_stance',base:'batter'},stride:{frame:'bat_stride',base:'batter',rot:-6},swing:{frame:'bat_contact',base:'batter',rot:24},miss:{frame:'bat_miss',base:'batter',rot:40},follow:{frame:'bat_follow',base:'batter',rot:34},bunt:{frame:'bat_bunt',base:'batter',rot:-22,dy:2}};
  return m[a.pose];
 }
 if(a.pos==='P'&&['set','windup','kick','release','follow'].includes(a.pose)){
  const m:Record<string,Draw>={set:{frame:'pitch_set',base:'pitcher',rot:-4},windup:{frame:'pitch_windup',base:'pitcher',rot:-10,dy:-1},kick:{frame:'pitch_kick',base:'pitcher',rot:-16,dy:-2},release:{frame:'pitch_release',base:'pitcher',rot:14},follow:{frame:'pitch_follow',base:'pitcher',rot:22,dy:1}};
  return m[a.pose];
 }
 const runner=a.role!=='f';
 // 捕手は本塁の後ろで、投手の方を向いている(見る人には背中)。11/5 朝 持ち主「捕手の向きがおかしい」→ ChatGPT で後ろ姿を描き直した。
 if(a.pos==='C'&&Math.hypot(a.p[0],a.p[1])<4.5&&['crouch','catch','ready','cover','ctrthrow'].includes(a.pose))return a.pose==='catch'?{frame:'catch_catch',base:'fielder'}:a.pose==='ctrthrow'?{frame:'catch_throw',base:'fielder'}:{frame:'catch_crouch',base:'fielder'};
 switch(a.pose){
  case 'run':case 'jog':return runner?{frame:step>0?'run_run1':'run_run2',base:'runner',dy:Math.abs(step)*-1.5}:{frame:step>0?'field_run1':'field_run2',base:'fielder',rot:step*5,dy:Math.abs(step)*-1.5};
  case 'lead':return {frame:'run_lead',base:'runner',rot:-4,sy:.94};
  case 'slide':return {frame:'run_slide',base:'runner',rot:a.face<0?62:-62,dy:4};
  case 'cheer':return {frame:'run_cheer',base:'runner',dy:-Math.abs(Math.sin(t*9))*4};
  case 'sad':return {frame:'run_sad',base:runner?'runner':'fielder',rot:8,sy:.93};
  case 'grounder':return {frame:'field_grounder',base:'fielder',sy:.88};
  case 'fly':return {frame:'field_fly',base:'fielder',sy:1.05,rot:-4};
  case 'catch':return {frame:'field_fly',base:'fielder'};
  case 'throw':return {frame:'field_throw1',base:'fielder',rot:-12};
  case 'throw2':return {frame:'field_throw2',base:'fielder',rot:16};
  case 'ctrthrow':return {frame:'catch_throw',base:'fielder',rot:14};
  case 'dive':return {frame:'field_dive',base:'fielder',rot:a.face<0?-78:78,dy:6};
  case 'crouch':return {frame:'catch_crouch',base:'fielder',sy:.9};
  case 'cover':return {frame:'field_ready',base:'fielder'};
  case 'set':case 'windup':case 'kick':case 'release':case 'follow':return {frame:'pitch_set',base:'pitcher'};
  default:return a.pos==='P'?{frame:'pitch_set',base:'pitcher'}:{frame:runner?'run_lead':'field_ready',base:runner?'runner':'fielder'};
 }
}

function paintField(g:CanvasRenderingContext2D,pr:Projection){
 const P=(p:V)=>toScreen(pr,p);
 g.fillStyle='#14233f';g.fillRect(0,0,pr.W,pr.H);
 // スタンドの影(塀の外)
 const fence:V[]=[];for(let d=-45;d<=45;d+=3)fence.push([Math.sin(d*Math.PI/180)*fenceAt(d),Math.cos(d*Math.PI/180)*fenceAt(d)]);
 // 芝(しま模様)。フェアの外(ファウルの所)も芝で、少し暗い。
 for(let i=0;i<18;i++){const y0=i*8-10;const a=P([-140,y0]),b=P([140,y0+8]);g.fillStyle=i%2?'#27753a':'#236d35';g.fillRect(0,b[1],pr.W,a[1]-b[1]+1);}
 g.save();g.beginPath();let [x,y]=P(PLATE);g.moveTo(x,y);for(const f of fence){[x,y]=P(f);g.lineTo(x,y);}g.closePath();g.clip();
 for(let i=0;i<18;i++){const y0=i*8-10;const a=P([-140,y0]),b=P([140,y0+8]);g.fillStyle=i%2?'#2f8a45':'#2a7f3f';g.fillRect(0,b[1],pr.W,a[1]-b[1]+1);}
 // 内野の土(マウンドの前から 29m の円の内側)
 g.fillStyle='#b9824e';g.beginPath();for(let d=-50;d<=50;d+=4){const p:V=[RUBBER[0]+Math.sin(d*Math.PI/180)*29,RUBBER[1]+Math.cos(d*Math.PI/180)*29];[x,y]=P(p);d===-50?g.moveTo(x,y):g.lineTo(x,y);}
 [x,y]=P([22,22]);g.lineTo(x,y);[x,y]=P(PLATE);g.lineTo(x,y);[x,y]=P([-22,22]);g.lineTo(x,y);g.closePath();g.fill();
 // 内野の芝(塁の内側)
 const inset=(p:V,k:number):V=>[p[0]*k,(p[1]-19.4)*k+19.4];
 g.fillStyle='#2e8743';g.beginPath();const sq=[PLATE,BAGS[0],BAGS[1],BAGS[2]].map(p=>inset(p,.8));sq.forEach((p,i)=>{[x,y]=P(p);i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();g.fill();
 g.restore();
 // 塀の外(スタンド)は塀の線より奥を暗く
 g.save();g.beginPath();[x,y]=P([-200,-20]);g.moveTo(x,y);for(const f of fence){[x,y]=P(f);g.lineTo(x,y);}[x,y]=P([200,-20]);g.lineTo(x,y);g.lineTo(pr.W,0);g.lineTo(0,0);g.closePath();g.fillStyle='#14233f';g.fill();g.restore();
 // 塀
 g.strokeStyle='#0f3d22';g.lineWidth=Math.max(2,pr.S*1.1);g.beginPath();fence.forEach((f,i)=>{[x,y]=P(f);i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();
 g.strokeStyle='#e9d36a';g.lineWidth=1;g.stroke();
 // マウンドと本塁の円
 const ell=(c:V,r:number,fill:string)=>{const [cx,cy]=P(c),k=depth(c[1]);g.fillStyle=fill;g.beginPath();g.ellipse(cx,cy,r*pr.S*k,r*pr.S*TILT,0,0,Math.PI*2);g.fill();};
 ell(RUBBER,2.9,'#c38d58');ell(PLATE,4,'#b9824e');
 // ファウルライン
 g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=Math.max(1,pr.S*.35);
 for(const s of [-1,1]){const a=P(PLATE),b=P([s*fenceAt(45)*Math.SQRT1_2,fenceAt(45)*Math.SQRT1_2]);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}
 // 塁
 for(const b of BAGS.slice(0,3)){const [bx,by]=P(b),s=Math.max(3.5,pr.S*1.3);g.fillStyle='#fff';g.beginPath();g.moveTo(bx,by-s*.6);g.lineTo(bx+s,by);g.lineTo(bx,by+s*.6);g.lineTo(bx-s,by);g.closePath();g.fill();}
 {const [hx,hy]=P(PLATE),s=Math.max(3.5,pr.S*1.2);g.fillStyle='#fff';g.beginPath();g.moveTo(hx-s,hy-s*.35);g.lineTo(hx+s,hy-s*.35);g.lineTo(hx+s,hy+s*.1);g.lineTo(hx,hy+s*.5);g.lineTo(hx-s,hy+s*.1);g.closePath();g.fill();}
 {const [rx,ry]=P(RUBBER);g.fillStyle='#fff';g.fillRect(rx-pr.S*.5,ry-1,pr.S,2);}
 // 打席の線
 g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=1;for(const s of [-1,1]){const a=P([s*.6,-1]),b=P([s*1.8,1]);g.strokeRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));}
}

/** 投げる・送球の時は、ボールの行く方を向く。 */
function faceOf(a:ActorAt,c:Choreo,t:number){
 if(a.pose==='throw'||a.pose==='throw2'||a.pose==='ctrthrow'){const s=c.ball.find(x=>x.t0>=t-.05&&x.t0<=t+.5&&Math.hypot(x.a[0]-a.p[0],x.a[1]-a.p[1])<4);if(s)return s.b[0]>=a.p[0]?1:-1;}
 return a.face;
}

export function FieldCanvas({scene,className='',children,onSize}:{scene:FieldScene;className?:string;children?:React.ReactNode;onSize?:(pr:Projection)=>void}){
 const wrap=useRef<HTMLDivElement|null>(null),cv=useRef<HTMLCanvasElement|null>(null);
 const sc=useRef(scene);sc.current=scene;
 const [size,setSize]=useState<{w:number;h:number}>({w:0,h:0});
 const [,setLoaded]=useState(0);
 useLayoutEffect(()=>{const el=wrap.current;if(!el)return;const measure=()=>{const r=el.getBoundingClientRect();setSize(s=>Math.abs(s.w-r.width)<1&&Math.abs(s.h-r.height)<1?s:{w:r.width,h:r.height});};
  measure();if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}
  const ro=new ResizeObserver(measure);ro.observe(el);return()=>ro.disconnect();},[]);
 const dpr=typeof window==='undefined'?1:Math.min(3,Math.max(1,window.devicePixelRatio||1));
 const pr=projection(size.w,size.h);
 const cam=useRef<{c:Cam;at:number}>({c:{...HOME_CAM},at:0});
 useEffect(()=>{if(size.w>0)onSize?.(pr);// eslint-disable-next-line react-hooks/exhaustive-deps
 },[size.w,size.h]);
 useEffect(()=>{if(!size.w||!size.h)return;cam.current={c:{...HOME_CAM},at:0};draw(performance.now());// eslint-disable-next-line react-hooks/exhaustive-deps
 },[size.w,size.h,dpr]);
 const draw=(now:number)=>{
  const c=cv.current;if(!c||!size.w)return false;const g=c.getContext('2d');if(!g)return false;
  const cw=Math.round(size.w*dpr),chh=Math.round(size.h*dpr);if(c.width!==cw||c.height!==chh){c.width=cw;c.height=chh;}
  g.setTransform(dpr,0,0,dpr,0,0);
  {const s0=sc.current,cl=s0.clip,t0=cl?Math.max(0,(now-cl.start)/1000*cl.speed):0;
   const want=cl?wantCam(cl.c,t0):HOME_CAM,cur=cam.current,dt=cur.at?Math.min(.1,(now-cur.at)/1000):1,f=1-Math.exp(-dt*(cl?3.2:6)*(cl?.6+cl.speed*.4:1));
   const k=cur.at?f:1;cur.c={x0:cur.c.x0+(want.x0-cur.c.x0)*k,x1:cur.c.x1+(want.x1-cur.c.x1)*k,y0:cur.c.y0+(want.y0-cur.c.y0)*k,y1:cur.c.y1+(want.y1-cur.c.y1)*k};cur.at=now;}
  const pr=projection(size.w,size.h,cam.current.c);
  paintField(g,pr);
  const s=sc.current,clip=s.clip,ch=clip?.c??s.still,t=clip?Math.max(0,(now-clip.start)/1000*clip.speed):0;
  const list=ch.actors.map(a=>actorAt(a,t)).filter(a=>a.o>0).sort((a,b)=>b.p[1]-a.p[1]);
  const reload=()=>setLoaded(n=>n+1);
  // 影
  g.fillStyle='rgba(0,0,0,.22)';
  for(const a of list){const [x,y]=toScreen(pr,a.p),h=figH(pr,a.p[1]);g.globalAlpha=a.o;g.beginPath();g.ellipse(x,y,h*.32,h*.09,0,0,Math.PI*2);g.fill();}
  g.globalAlpha=1;
  for(const a of list){
   const color=a.role==='f'?s.defColor:s.batColor,d=drawFor(a,t),[x,y]=toScreen(pr,a.p),h=figH(pr,a.p[1]);
   let face=faceOf(a,ch,t);
   // 打者・投手の左右(絵は右打ち・右投げ)
   const flipBase=(a.role==='b'&&s.leftyBat&&['stance','stride','swing','miss','follow','bunt'].includes(a.pose))||(a.pos==='P'&&s.lefty&&['set','windup','kick','release','follow'].includes(a.pose));
   const fr=d.frame?ATLAS.frames[d.frame]:undefined;
   const sheet=fr?img(`/assets/pro/watch/m/atlas_${color}.webp`,reload):null;
   const useFrame=!!(fr&&sheet&&sheet.complete&&sheet.naturalWidth);
   const im=useFrame?sheet!:img(`/assets/pro/watch/${BASE_IMG[d.base]}_${color}.webp`,reload);
   if(!im.complete||!im.naturalWidth)continue;
   const sw=useFrame?fr![2]:im.naturalWidth,sh=useFrame?fr![3]:im.naturalHeight,sx0=useFrame?fr![0]:0,sy0=useFrame?fr![1]:0;
   const hh=h*(useFrame?(fr![4]??1):1)*(useFrame?1:(d.sy??1)),ww=hh*sw/sh;
   g.save();g.globalAlpha=a.o;g.translate(x,y+(d.dy??0)*h/30);
   // 捕手の後ろ姿は左右を返さない(返すとミットと投げる手が入れ替わる)。
   let flip=flipBase?-1:1;if(face<0&&!d.frame?.startsWith('catch_')&&!(a.role==='b'&&['stance','stride','swing','miss','follow','bunt'].includes(a.pose))&&!(a.pos==='P'&&['set','windup','kick','release','follow'].includes(a.pose)))flip*=-1;
   void face;face=0;
   g.scale(flip,1);
   if(!useFrame&&d.rot)g.rotate(d.rot*Math.PI/180);
   g.drawImage(im,sx0,sy0,sw,sh,-ww/2,-hh,ww,hh);
   g.restore();
  }
  // ボール
  const bl=ballAt(ch,t);
  if(bl){const [x,y]=toScreen(pr,bl.p),[,yb]=toScreen(pr,bl.p,bl.h),r=Math.max(2.2,pr.S*.75)*(1+Math.min(1.2,bl.h/28));
   g.globalAlpha=bl.o*.4;g.fillStyle='#000';g.beginPath();g.ellipse(x,y,r*.9,r*.35,0,0,Math.PI*2);g.fill();
   g.globalAlpha=bl.o;g.fillStyle='#fff';g.strokeStyle='#c53';g.lineWidth=.8;g.beginPath();g.arc(x,yb,r,0,Math.PI*2);g.fill();g.stroke();g.globalAlpha=1;}
  const settled=Math.abs(cam.current.c.y1-HOME_CAM.y1)<.3&&Math.abs(cam.current.c.x0-HOME_CAM.x0)<.3;
  return (!!clip&&t<ch.len+.05)||!settled;
 };
 // 動いている間だけ毎コマ描く
 useEffect(()=>{if(!size.w)return;let raf=0,alive=true;const tick=(now:number)=>{if(!alive)return;const more=draw(now);if(more)raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>{alive=false;cancelAnimationFrame(raf);};});
 return <div ref={wrap} className={'fc-wrap '+className}><canvas ref={cv} className="fc-canvas" style={{width:size.w,height:size.h}} aria-hidden="true"/>{children}</div>;
}
