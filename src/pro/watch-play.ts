// グラウンドの動き(2026-11-04 vc43 追加)。持ち主「自動進行の試合ですが、さすがに結果しか表示されないのは味気なさすぎるので、
// ボールとかランナーとかは動いて試合の状況がある程度わかるようにしてください」。
// 打席の結果(LiveEvent)と、打席の前の塁から、ボール・守備・走者の動きを作る。向きは実況と同じ表(watch.ts の playWord)から
// 決めるので、見た目と実況・結果は食い違わない。試合の乱数は使わない(演出だけ)。座標はグラウンドの枠の % (左上 0,0)。
import type {LiveEvent,LiveKind} from './engine';
import {playWord} from './watch';

/** [x%, y%, 下へのずれ(px)]。ずれは捕手だけ: 本塁の板と人形は px の大きさなので、本塁の真後ろ(下)に px で置く(2026-11-04 持ち主「捕手の位置、ちょっとおかしい」)。 */
export type Pt=[number,number,number?];
export const HOME:Pt=[50,91],MOUND:Pt=[50,63];
export const BASES:Pt[]=[[78,68],[50,40],[22,68]];
/** 守備の立つ所。外野は打順に出てくる順に 外0(左)・外1(中)・外2(右)。 */
/** 捕手: 本塁(50,91)の真下。板の下の端(+8px)のすぐ下に頭が来る所(足元 +34px)。グラウンドの下に捕手の分の帯(24px)を足してある(watch.css .wt-dia)。 */
export const CATCHER_DROP=34;
export const SPOTS:Record<string,Pt>={捕:[50,91,CATCHER_DROP],一:[73,60],二:[63,45],三:[27,60],遊:[37,45],外0:[20,33],外1:[50,24],外2:[80,33],投:[50,63]};
const INFIELD=['一','二','三','遊','投'],OUTFIELD=['外0','外1','外2'];
/** 外野の打球の落ちる所(浅い・深い・スタンド)。 */
const OF:Record<string,{shallow:Pt;deep:Pt;stand:Pt}>={
 レフト:{shallow:[23,41],deep:[13,27],stand:[8,-2]},
 左中間:{shallow:[35,34],deep:[30,19],stand:[28,-6]},
 センター:{shallow:[50,35],deep:[50,19],stand:[50,-8]},
 右中間:{shallow:[65,34],deep:[70,19],stand:[72,-6]},
 ライト:{shallow:[77,41],deep:[87,27],stand:[92,-2]},
 三遊間:{shallow:[24,40],deep:[12,40],stand:[8,-2]},
 一二塁間:{shallow:[76,40],deep:[88,40],stand:[92,-2]},
};
const THROUGH:Record<string,Pt>={三遊間:[31,52],一二塁間:[69,52]};
const OUT_SPOT:Record<string,{type:'ground'|'fly';at:Pt}>={
 ショートゴロ:{type:'ground',at:[37,49]},セカンドゴロ:{type:'ground',at:[63,49]},サードゴロ:{type:'ground',at:[27,63]},ファーストゴロ:{type:'ground',at:[73,63]},ピッチャーゴロ:{type:'ground',at:[50,68]},
 センターフライ:{type:'fly',at:[50,27]},レフトフライ:{type:'fly',at:[21,35]},ライトフライ:{type:'fly',at:[79,35]},
};
const SF_SPOT:Record<string,Pt>={レフト:[17,29],センター:[50,21],ライト:[83,29]};
const ERR_SPOT:Record<string,{at:Pt;spot:string}>={ショート:{at:[37,49],spot:'遊'},セカンド:{at:[63,49],spot:'二'},サード:{at:[27,63],spot:'三'}};

export type BallType='ground'|'liner'|'fly'|'hr'|'bunt'|'walk'|'strikeout'|'steal'|'none';
/** who: 'ball' / 'f:守備の所' / 'r:選手id'。pts の上を t0→t1 の間に等速で動く。arc=山なりの高さ(%)、fade=消え始め→消えきる。 */
export interface Track {who:string;pts:Pt[];t0:number;t1:number;arc?:number;fade?:[number,number]}
export interface FieldPlay {kind:LiveKind;type:BallType;word:string;land:Pt|null;fielder:string|null;caught:boolean;tracks:Track[];length:number}

const dist=(a:Pt,b:Pt)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const nearest=(p:Pt,keys:string[])=>keys.reduce((best,k)=>dist(SPOTS[k],p)<dist(SPOTS[best],p)?k:best,keys[0]);
const toward=(a:Pt,b:Pt,f:number):Pt=>{const d=(a[2]??0)+((b[2]??0)-(a[2]??0))*f;return d?[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,d]:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];};
/** 塁の間の道(from=-1 は本塁から、to=3 は本塁まで)。 */
export function basePath(from:number,to:number):Pt[]{
 const at=(i:number)=>i<0||i>=3?HOME:BASES[i];
 const pts:Pt[]=[at(from)];for(let i=from+1;i<=to;i++)pts.push(at(i));return pts;
}
/** 走者(打者も)の動き。塁の前後の並びから、どこからどこへ進んだかを読む。 */
function runnerTracks(e:LiveEvent,before:(string|null)[],start:number,perBase:number):Track[]{
 const out:Track[]=[];
 const move=(id:string,from:number,to:number,fade?:boolean)=>{const n=Math.max(1,to-from),pts=basePath(from,to);out.push({who:'r:'+id,pts,t0:start,t1:Math.min(.98,start+perBase*n),fade:fade?[Math.min(.98,start+perBase*n),1]:undefined});};
 before.forEach((id,b)=>{
  if(!id)return;const to=e.bases.indexOf(id);
  if(e.kind==='CS'&&id===e.batter){move(id,b,b+1,true);return;}
  if(to>=0){if(to!==b)move(id,b,to);else out.push({who:'r:'+id,pts:[BASES[b]],t0:0,t1:1});}
  else move(id,b,3,true);// 本塁へ(得点)
 });
 if(['SB','CS'].includes(e.kind))return out;
 if(e.kind==='K')return out;
 const to=e.bases.indexOf(e.batter);
 if(to>=0)move(e.batter,-1,to);
 else if(e.kind==='HR')move(e.batter,-1,3,true);
 else out.push({who:'r:'+e.batter,pts:[HOME,toward(HOME,BASES[0],.55)],t0:start,t1:start+perBase*.55,fade:[start+perBase*.55,Math.min(1,start+perBase*.55+.15)]});// アウト: 一塁へ走りかけて消える
 return out;
}
/** 1つの出来事(打席・盗塁)の動き。before=その前の塁。 */
export function fieldPlay(e:LiveEvent,before:(string|null)[]):FieldPlay{
 const word=playWord(e.kind,e.inning,e.slot);
 const base={kind:e.kind,word,land:null as Pt|null,fielder:null as string|null,caught:false,tracks:[] as Track[],length:1};
 const k=e.kind;
 if(k==='SB'||k==='CS'){
  const tracks=runnerTracks(e,before,0,.8);
  tracks.push({who:'ball',pts:[SPOTS.捕,BASES[1]],t0:.35,t1:.78,arc:3});
  return {...base,type:'steal',land:BASES[1],fielder:'遊',caught:k==='CS',tracks:[...tracks,{who:'f:遊',pts:[SPOTS.遊,toward(SPOTS.遊,BASES[1],.9)],t0:.1,t1:.6}],length:.6};
 }
 if(k==='K')return {...base,type:'strikeout',length:0};
 if(k==='BB'||k==='HBP'||k==='IBB')return {...base,type:'walk',tracks:runnerTracks(e,before,0,.9),length:.5};
 if(['PINCH','RUNNER','FIELD','PITCHER'].includes(k))return {...base,type:'none',length:0};
 if(k==='BUNT'||k==='BUNT_FAIL'){
  const land:Pt=k==='BUNT'?[42,81]:[47,86],f=k==='BUNT'?nearest(land,['捕','投','三','一']):'捕';
  const tracks=runnerTracks(e,before,.12,.3);
  tracks.push({who:'ball',pts:[HOME,land],t0:0,t1:.3,arc:k==='BUNT'?0:9},{who:'f:'+f,pts:[SPOTS[f],land],t0:.05,t1:.32});
  if(k==='BUNT')tracks.push({who:'ball',pts:[land,BASES[0]],t0:.4,t1:.6,arc:2});
  return {...base,type:'bunt',land,fielder:f,caught:true,tracks,length:.8};
 }
 if(k==='HR'){
  const w=OF[word]??OF.センター,f=nearest(w.deep,OUTFIELD);
  const tracks=runnerTracks(e,before,.15,.2);
  tracks.push({who:'ball',pts:[HOME,w.stand],t0:0,t1:.62,arc:42,fade:[.55,.66]},{who:'f:'+f,pts:[SPOTS[f],toward(SPOTS[f],w.deep,.9)],t0:.05,t1:.45});
  return {...base,type:'hr',land:w.stand,fielder:f,tracks,length:1.15};
 }
 if(k==='1B'||k==='2B'||k==='3B'){
  const w=OF[word]??OF.センター,deep=k!=='1B',land=deep?w.deep:w.shallow,through=THROUGH[word],f=nearest(land,OUTFIELD);
  const type:BallType=through?'ground':k==='3B'?'fly':'liner';
  const tracks=runnerTracks(e,before,.12,k==='1B'?.24:.2);
  tracks.push({who:'ball',pts:through?[HOME,through,land]:[HOME,land],t0:0,t1:deep?.5:.4,arc:type==='fly'?16:type==='liner'?5:0});
  const reach=deep?.62:.48;
  tracks.push({who:'f:'+f,pts:[SPOTS[f],land],t0:.05,t1:reach});
  tracks.push({who:'ball',pts:[land,toward(land,BASES[1],.75)],t0:reach+.04,t1:Math.min(.95,reach+.26),arc:4});
  return {...base,type,land,fielder:f,tracks};
 }
 if(k==='SF'){
  const land=SF_SPOT[word]??SF_SPOT.センター,f=nearest(land,OUTFIELD);
  const tracks=runnerTracks(e,before,.6,.3);
  tracks.push({who:'ball',pts:[HOME,land],t0:0,t1:.55,arc:30},{who:'f:'+f,pts:[SPOTS[f],land],t0:.05,t1:.53},{who:'ball',pts:[land,toward(land,HOME,.85)],t0:.62,t1:.9,arc:5});
  return {...base,type:'fly',land,fielder:f,caught:true,tracks};
 }
 if(k==='E'){
  const x=ERR_SPOT[word]??ERR_SPOT.ショート,past:Pt=[x.at[0]+(x.at[0]<50?-7:7),x.at[1]-9];
  const tracks=runnerTracks(e,before,.12,.24);
  tracks.push({who:'ball',pts:[HOME,x.at,past],t0:0,t1:.5},{who:'f:'+x.spot,pts:[SPOTS[x.spot],x.at,past],t0:.05,t1:.62});
  return {...base,type:'ground',land:x.at,fielder:x.spot,tracks};
 }
 // 凡打(OUT)
 const o=OUT_SPOT[word]??OUT_SPOT.ショートゴロ,f=o.type==='fly'?nearest(o.at,OUTFIELD):nearest(o.at,INFIELD);
 const tracks=runnerTracks(e,before,.12,.3);
 if(o.type==='ground'){
  tracks.push({who:'ball',pts:[HOME,o.at],t0:0,t1:.32},{who:'f:'+f,pts:[SPOTS[f],o.at],t0:.04,t1:.3});
  if(f!=='一')tracks.push({who:'ball',pts:[o.at,BASES[0]],t0:.38,t1:.58,arc:3});
 }else tracks.push({who:'ball',pts:[HOME,o.at],t0:0,t1:.6,arc:28},{who:'f:'+f,pts:[SPOTS[f],o.at],t0:.05,t1:.56});
 return {...base,type:o.type,land:o.at,fielder:f,caught:true,tracks,length:o.type==='fly'?1:.8};
}
/** 道の上の位置(0〜1)。 */
export function along(pts:Pt[],f:number):Pt{
 if(pts.length===1||f<=0)return pts[0];
 if(f>=1)return pts[pts.length-1];
 const seg=pts.slice(1).map((p,i)=>dist(pts[i],p)),total=seg.reduce((a,b)=>a+b,0)||1;
 let d=Math.max(0,Math.min(1,f))*total;
 for(let i=0;i<seg.length;i++){if(d<=seg[i]||i===seg.length-1){const f=seg[i]?Math.min(1,d/seg[i]):1;return f>=1?pts[i+1]:toward(pts[i],pts[i+1],f);}d-=seg[i];}
 return pts[pts.length-1];
}
/** その時刻(0〜1)の、動く物の位置・高さ・見え方。 */
export function trackAt(t:Track,p:number):{x:number;y:number;dy:number;h:number;o:number;moving:boolean}{
 const f=t.t1>t.t0?(p-t.t0)/(t.t1-t.t0):p>=t.t0?1:0,c=Math.max(0,Math.min(1,f));
 const [x,y,dy=0]=along(t.pts,c),h=(t.arc??0)*4*c*(1-c);
 let o=1;if(t.fade){const [a,b]=t.fade;o=p<=a?1:p>=b?0:1-(p-a)/Math.max(1e-6,b-a);}
 return {x,y,dy,h,o,moving:f>0&&f<1};
}
