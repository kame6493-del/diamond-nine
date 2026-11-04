// 試合の画面のグラウンドの動き(2026-11-05 作り直し)。持ち主「1から別に試合画面作り直していいです。守備の動きに関しても、リアルにある程度再現してください」。
// 前の watch-play.ts(画面の % の上を、ボールと人形が真っすぐ動くだけ)はやめ、本物のグラウンドの縮尺(塁間 27.43m)の上で、
// 打球の種類・方向・強さから、追う野手・カバーに入る野手・走者・ボールの動きを組み立てる。
// 結果が先に決まっている(試合の計算=engine.ts の LiveEvent)。ここでは、その結果に合わせて見た目を作るだけ。試合の乱数は使わない。
//  - 打球の向き: 実況と同じ表(watch.ts の playWord)。安打・アウトの種類・進塁は LiveEvent のまま(打者と走者が最後に立つ塁は e.bases)。
//  - アウトは、送球が走者より先に着く。セーフは、走者が先に着く(きわどい時は滑り込む)。
//  - 試合の計算に併殺は無い(凡打は打者だけがアウトで、走者は進まない)ので、併殺の動きは出さない。
// 座標はメートル: 本塁が (0,0)、x は一塁側が +、y はセンター方向が +。時間は秒(1倍の時の、画面に出る秒)。
import type {LiveEvent,LiveKind} from './engine';
import {playWord} from './watch';
import {playerMap} from './data';

export type V=[number,number];
export const BASE_DIST=27.43;
const D=BASE_DIST/Math.SQRT2;
export const PLATE:V=[0,0],FIRST:V=[D,D],SECOND:V=[0,2*D],THIRD:V=[-D,D],RUBBER:V=[0,18.44];
/** 一塁・二塁・三塁・本塁(index 3)。 */
export const BAGS:V[]=[FIRST,SECOND,THIRD,PLATE];
/** 外野の塀(両翼 100m・中堅 122m)。角度(度、センターが0・左が負)の所の塀までの距離。 */
export const fenceAt=(deg:number)=>{const a=Math.min(1,Math.abs(deg)/45);return 122-22*a*a;};
export type Pos='P'|'C'|'1B'|'2B'|'3B'|'SS'|'LF'|'CF'|'RF';
export const POSITIONS:Pos[]=['P','C','1B','2B','3B','SS','LF','CF','RF'];
/** 守る位置(ふだんの所)。 */
export const READY:Record<Pos,V>={P:[0,18.3],C:[0,-3.3],'1B':[17.5,24.5],'2B':[9.5,35.5],'SS':[-10,35.5],'3B':[-17.5,23.5],LF:[-40,73],CF:[0,84],RF:[40,73]};
/** 打席(右打者は三塁側=x が負、左打者は一塁側)。 */
export const BOX_M:Record<'R'|'L',V>={R:[-1.9,.5],L:[1.9,.5]};
/** 試合のデータの守備位置(投・捕・一・二・三・遊・外)から、この画面の位置へ。外野は打順の並びで 左・中・右(画面の決まりと同じ)。 */
export function fieldMap(lineup:string[],defense:Record<string,string>,pitcher:string):Partial<Record<Pos,string>>{
 const out:Partial<Record<Pos,string>>={P:pitcher};let of=0;
 const m:Record<string,Pos>={捕:'C',一:'1B',二:'2B',三:'3B',遊:'SS'};
 for(const id of lineup){const p=defense[id];if(p==='外'){out[(['LF','CF','RF'] as Pos[])[of++%3]]=id;}else if(m[p])out[m[p]]=id;}
 return out;
}

// ---- 右打ち・左打ち・投手の左右(2026-11-04 夜 持ち主「右と左別に立つようにして」) ----
export type Hand='R'|'L';
const idHash=(id:string)=>{let h=2166136261;for(let i=0;i<id.length;i++){h^=id.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
/** 投手の投げる腕。選手データの throws。無い時だけ id から決まった形で(4人に1人が左)。 */
export function throwHand(id:string):Hand{const t=playerMap[id]?.throws;return t==='左'?'L':t==='右'?'R':idHash(id)%4===0?'L':'R';}
/** 打者が立つ打席。右打=R(三塁側)、左打=L(一塁側)。両打ちは投手の反対。 */
export function batSide(id:string,pitcher:string):Hand{
 const b=playerMap[id]?.bats;if(b==='左')return 'L';if(b==='右')return 'R';
 if(b==='両')return throwHand(pitcher)==='L'?'R':'L';
 return idHash(id)%4===0?'L':'R';
}

// ---- 動きの部品 ----
export type Pose='ready'|'run'|'grounder'|'fly'|'throw'|'dive'|'crouch'|'catch'|'cover'|'slide'|'cheer'|'sad'|'lead'|'stance'|'stride'|'swing'|'miss'|'bunt'|'set'|'windup'|'kick'|'release'|'follow'|'jog'|'ctrthrow'|'throw2';
interface Key {t:number;p:V;pose:Pose}
/** 動く人。role: f=守る側(pos あり)、b=打者、r=走者。keys の間はまっすぐ等速で動く。gone=その時刻から消え始める(打者のアウトなど)。 */
export interface Actor {id:string;role:'f'|'b'|'r';pos?:Pos;keys:Key[];gone?:number}
/** ボールの動き。ground=転がる(だんだん遅く)、air=山なり(peak=いちばん高い所の m)、throw=送球(少しだけ山なり)、hidden=手やグラブの中。 */
export interface BallSeg {t0:number;t1:number;a:V;b:V;peak:number;kind:'ground'|'air'|'throw'|'pitch'|'hidden';fade?:boolean}
/** what=見た目の種類(試験で結果と合っているか確かめる)。 */
export type Motion='pitch'|'ground-out'|'fly-out'|'tag-up'|'single'|'extra-base'|'home-run'|'error'|'bunt'|'bunt-pop'|'steal'|'caught-stealing'|'walk'|'strikeout'|'none';
export interface Choreo {kind:LiveKind|'PITCH';motion:Motion;word:string;len:number;actors:Actor[];ball:BallSeg[];banner?:{t:number;text:string}|null;fine?:boolean;chaser?:Pos|null;cover?:Partial<Record<number,Pos>>}
export interface SimCtx {
 /** 守る側の位置 → 選手 id。 */
 fielders:Partial<Record<Pos,string>>;
 /** 選手の速さ(走力 0〜120)と守備・肩。 */
 rate:(id:string)=>{speed:number;field:number;arm:number};
}

const add=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1]];
const sub=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1]];
const mul=(a:V,k:number):V=>[a[0]*k,a[1]*k];
const len=(a:V)=>Math.hypot(a[0],a[1]);
export const distM=(a:V,b:V)=>len(sub(a,b));
const lerp=(a:V,b:V,f:number):V=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
const polar=(deg:number,d:number):V=>[Math.sin(deg*Math.PI/180)*d,Math.cos(deg*Math.PI/180)*d];
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** 打球の向き(度)。 */
const ANGLE:Record<string,number>={レフト:-30,左中間:-16,センター:0,右中間:16,ライト:30,三遊間:-19,一二塁間:19,ショートゴロ:-12,セカンドゴロ:13,サードゴロ:-33,ファーストゴロ:34,ピッチャーゴロ:2,センターフライ:2,レフトフライ:-28,ライトフライ:28,ショート:-12,セカンド:13,サード:-33};

/** 組み立て。時間は「本物の秒」で作り、最後に縮める(野球の1プレーは長いので、テンポよく見せる)。 */
class Plan {
 actors=new Map<string,Actor>();ball:BallSeg[]=[];
 constructor(public ctx:SimCtx){}
 put(id:string,role:Actor['role'],p:V,pose:Pose,pos?:Pos){const a:Actor={id,role,pos,keys:[{t:0,p,pose}]};this.actors.set(id,a);return a;}
 last(id:string){const a=this.actors.get(id)!;return a.keys[a.keys.length-1];}
 /** その時刻まで今の所に留まり、t から pose にする。 */
 pose(id:string,t:number,pose:Pose){const a=this.actors.get(id);if(!a)return;const k=a.keys[a.keys.length-1];if(t<=k.t){k.pose=pose;return;}a.keys.push({t,p:k.p,pose});}
 /** t0 から to まで speed(m/s)で動く。着いた時刻を返す。end=着いた後の形。 */
 go(id:string,to:V,t0:number,speed:number,end:Pose='ready',move:Pose='run'){
  const a=this.actors.get(id);if(!a)return t0;const k=a.keys[a.keys.length-1];
  const from=k.p,start=Math.max(t0,k.t);if(start>k.t)a.keys.push({t:start,p:from,pose:move});else k.pose=move;
  const t1=start+distM(from,to)/Math.max(.5,speed);a.keys.push({t:t1,p:to,pose:end});return t1;
 }
 /** 着く時刻を決めて動く(速さはなりゆき)。 */
 goBy(id:string,to:V,t0:number,t1:number,end:Pose='ready',move:Pose='run'){
  const a=this.actors.get(id);if(!a)return;const k=a.keys[a.keys.length-1];const start=Math.max(t0,k.t);
  if(start>k.t)a.keys.push({t:start,p:k.p,pose:move});else k.pose=move;a.keys.push({t:Math.max(start+.05,t1),p:to,pose:end});
 }
 at(id:string):V{return this.last(id).p;}
 b(seg:BallSeg){this.ball.push(seg);return seg.t1;}
 /** 守る人の足(m/s)。守備と走力から 6.3〜8.2。 */
 fv(pos:Pos){const id=this.ctx.fielders[pos];if(!id)return 7;const r=this.ctx.rate(id);return 6.3+clamp((r.speed*.6+r.field*.4)/100,0,1.15)*1.65;}
 /** 送球の速さ(m/s)。肩から 27〜38。 */
 arm(pos:Pos){const id=this.ctx.fielders[pos];if(!id)return 31;return 27+clamp(this.ctx.rate(id).arm/100,0,1.15)*9.5;}
 /** 走者の足(m/s)。走力から 6.6〜8.6。 */
 rv(id:string){return 6.6+clamp(this.ctx.rate(id).speed/100,0,1.2)*1.7;}
 /** 送球: from の人が t に投げる(振りかぶり 0.25 秒)。着いた時刻を返す。 */
 throwTo(from:Pos,to:V,t:number,receiver?:Pos){
  const fid='f:'+from,p=this.at(fid);this.pose(fid,t,'throw');
  const t0=t+.22,t1=t0+distM(p,to)/this.arm(from);this.pose(fid,t0-.04,'throw2');
  this.b({t0,t1,a:add(p,[0,.4]),b:to,peak:Math.min(4,distM(p,to)/18),kind:'throw'});
  this.pose(fid,t0+.25,'ready');
  if(receiver){this.pose('f:'+receiver,Math.max(t0,t1-.35),'catch');this.pose('f:'+receiver,t1+.3,'ready');}
  return t1;
 }
}

/** 走者の並び: 前の塁(before)と後の塁(e.bases)から、誰がどこからどこへ進んだか。to=3 は本塁(得点)、-1 はアウトで消える。 */
function advances(e:LiveEvent,before:(string|null)[]):{id:string;from:number;to:number}[]{
 const out:{id:string;from:number;to:number}[]=[];
 before.forEach((id,b)=>{if(!id)return;const to=e.bases.indexOf(id);out.push({id,from:b,to:to>=0?to:e.kind==='CS'?-1:3});});
 return out;
}
const pathPts=(from:number,to:number,box?:V):V[]=>{const pts:V[]=[from<0?(box??PLATE):BAGS[from]];for(let i=from+1;i<=to;i++)pts.push(BAGS[Math.min(3,i)]);return pts;};
/** 塁を回る道(角で少しふくらむ)。 */
function runPath(P:Plan,id:string,pts:V[],t0:number,v:number,slideAtEnd=false,endPose:Pose='ready'){
 let t=t0;
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],last=i===pts.length-1;
  // 塁を回る時は外へふくらむ(本物の走り方)
  if(!last){const out=mul(sub(b,[0,D]),.08);const mid=add(b,out);t=P.go(id,mid,t,v,'run');}
  else if(slideAtEnd){const pre=lerp(a,b,.82);t=P.go(id,pre,t,v,'run');t=P.go(id,b,t,v*.85,'slide','slide');P.pose(id,t+.45,endPose);}
  else t=P.go(id,b,t,v,endPose);
 }
 return t;
}
/** ふだんの立ち位置に全員を置く。 */
function setup(P:Plan,e:{batter:string;pitcher:string},before:(string|null)[],hand:Hand,lead=true){
 for(const pos of POSITIONS)if(P.ctx.fielders[pos]||pos==='P')P.put('f:'+pos,'f',READY[pos],pos==='C'?'crouch':pos==='P'?'set':'ready',pos);
 P.put('b:'+e.batter,'b',BOX_M[hand],'stance');
 before.forEach((id,b)=>{if(id)P.put('r:'+id,'r',lead?leadOff(b):BAGS[b],'lead');});
}
/** リードの位置(一塁は二塁方向へ 3m、二塁は 4m、三塁はファウルの所で 2.5m)。 */
export function leadOff(b:number):V{return b===0?lerp(FIRST,SECOND,.11):b===1?lerp(SECOND,THIRD,.14):lerp(THIRD,PLATE,.09);}

/** 縮める: 本物の秒 → 画面の秒。最大 cap 秒に収める(1倍)。 */
function finish(P:Plan,base:Omit<Choreo,'actors'|'ball'|'len'>,realLen:number,cap=4.6,k=.58):Choreo{
 const f=Math.min(k,cap/Math.max(.1,realLen));
 const actors=[...P.actors.values()].map(a=>({...a,keys:a.keys.map(x=>({...x,t:x.t*f})),gone:a.gone!==undefined?a.gone*f:undefined}));
 const ball=P.ball.map(s=>({...s,t0:s.t0*f,t1:s.t1*f}));
 return {...base,actors,ball,len:realLen*f,banner:base.banner?{...base.banner,t:base.banner.t*f}:null};
}

const toward=(a:V,b:V,m:number):V=>{const d=distM(a,b);return d<=m?b:lerp(a,b,m/d);};
/** 守る側のほかの人の動き(カバー・バックアップ)。全員が棒立ちにならないように。 */
function backups(P:Plan,ballAt:V,t:number,skip:Pos[]){
 const left=ballAt[0]<0;
 const plan:Partial<Record<Pos,V>>={
  C:lerp(PLATE,FIRST,.35),// 一塁のバックアップへ
  P:left?lerp(THIRD,PLATE,.55):lerp(FIRST,PLATE,.45),
  LF:toward(READY.LF,ballAt,6),CF:toward(READY.CF,ballAt,6),RF:toward(READY.RF,ballAt,6),
  '3B':ballAt[0]<-8?READY['3B']:lerp(READY['3B'],THIRD,.7),
 };
 for(const [k,to] of Object.entries(plan) as [Pos,V][])if(!skip.includes(k)&&P.actors.has('f:'+k))P.go('f:'+k,to,t+.15,P.fv(k)*.7,'ready');
}

/** 投球の1球(1倍で約 0.8 秒)。pitch: B=ボール、S=ストライク(最後の S は空振り)、F=ファウル、X=打った。 */
export function pitchClip(ctx:SimCtx,e:{batter:string;pitcher:string},before:(string|null)[],pitch:string,opts:{last?:boolean;bunt?:boolean;steal?:boolean}={}):Choreo{
 const hand=batSide(e.batter,e.pitcher),P=new Plan(ctx);setup(P,e,before,hand);
 const bid='b:'+e.batter;
 // 投手: セット → 振りかぶり → 足を上げる → 投げる → 投げ終わり
 P.pose('f:P',.05,'windup');P.pose('f:P',.2,'kick');P.pose('f:P',.36,'release');P.pose('f:P',.46,'follow');
 const rel:V=[throwHand(e.pitcher)==='L'?.6:-.6,17.2],arrive=.46+.24;
 P.b({t0:.4,t1:arrive,a:rel,b:[0,-.6],peak:.4,kind:'pitch'});
 if(opts.bunt)P.pose(bid,.12,'bunt');else P.pose(bid,.3,'stride');
 const swing=pitch==='F'||pitch==='X'||(pitch==='S'&&(opts.last||((e.batter.length+before.filter(Boolean).length)%2===0)));
 if(swing&&!opts.bunt){P.pose(bid,arrive-.06,'swing');if(pitch==='S')P.pose(bid,arrive+.12,'miss');else P.pose(bid,arrive+.14,'follow');}
 else if(!opts.bunt)P.pose(bid,arrive+.1,'stance');
 if(pitch!=='X'&&pitch!=='F'){P.pose('f:C',arrive-.08,'catch');P.pose('f:C',arrive+.3,'crouch');}
 if(pitch==='F'){// ファウル: 後ろかファウルゾーンへ
  const side=hand==='R'?1:-1;P.b({t0:arrive,t1:arrive+.55,a:[0,0],b:[side*18,-8],peak:9,kind:'air',fade:true});
 }
 // 走者は投げた瞬間に二次リード
 before.forEach((id,b)=>{if(id)P.go('r:'+id,lerp(leadOff(b),BAGS[b+1>2?3:b+1],.06),.4,3,'lead','jog');});
 if(pitch!=='X'&&pitch!=='F')before.forEach((id,b)=>{if(id)P.go('r:'+id,leadOff(b),arrive+.15,4,'lead','jog');});
 return {kind:'PITCH',motion:'pitch',word:'',len:pitch==='X'?arrive:arrive+.35,actors:[...P.actors.values()],ball:P.ball,banner:null};
}

/** 1つの出来事(打席の結果・盗塁)の動き。before=その前の塁。 */
export function choreograph(e:LiveEvent,before:(string|null)[],ctx:SimCtx):Choreo{
 const word=playWord(e.kind,e.inning,e.slot),k=e.kind,hand=batSide(e.batter,e.pitcher),P=new Plan(ctx);
 const bid='b:'+e.batter,base={kind:k,word,motion:'none' as Motion,banner:null as Choreo['banner'],fine:false,chaser:null as Pos|null,cover:{} as Partial<Record<number,Pos>>};
 const steal=k==='SB'||k==='CS';
 setup(P,e,before,hand);
 const adv=advances(e,before);
 const fine=(e.inning*5+e.slot*3)%7===0;// 好守の見せ場(見た目だけ。決まった打席で)

 if(['PINCH','RUNNER','FIELD','PITCHER','MOVE'].includes(k))return finish(P,{...base,motion:'none'},.1);
 if(k==='K'){
  // 三振: 打者はがっかり、投手は小さく喜ぶ。捕手は球を返す。
  P.pose(bid,.05,'sad');P.go(bid,add(BOX_M[hand],[hand==='R'?-6:6,-4]),.6,2.2,'sad','jog');P.actors.get(bid)!.gone=1.3;
  P.pose('f:P',.05,'cheer');P.pose('f:P',1.1,'set');P.pose('f:C',.3,'ready');
  for(const r of adv)P.go('r:'+r.id,BAGS[r.from],.2,4,'ready','jog');// 走者は塁に戻る
  P.b({t0:.6,t1:1.0,a:[0,-1],b:[0,17.6],peak:1.5,kind:'throw'});
  return finish(P,{...base,motion:'strikeout'},1.6,1.6,1);
 }
 if(k==='BB'||k==='HBP'||k==='IBB'){
  // 四死球: 打者は一塁へ小走り、押し出される走者も小走り。
  const v=4.2;runPath(P,bid,[BOX_M[hand],FIRST],.2,v);
  for(const a of adv)if(a.to!==a.from)runPath(P,'r:'+a.id,pathPts(a.from,a.to).map((p,i)=>i===0?leadOff(a.from):p),.2,v);else P.go('r:'+a.id,BAGS[a.from],.2,3,'ready','jog');
  P.go('f:1B',lerp(READY['1B'],FIRST,.6),.3,3);
  const len_=27.43/v+.6;
  for(const a of adv)if(a.to===3)P.pose('r:'+a.id,len_-.1,'cheer');
  return finish(P,{...base,motion:'walk'},len_,2.2,.5);
 }
 if(steal){
  // 盗塁: 投手が投げる → 走者がスタート → 捕手が捕って立ち上がり二塁へ → 二塁手か遊撃手が入る。
  const cover:Pos=hand==='R'?'2B':'SS',runner=adv.find(a=>a.from===0)??adv[0];
  if(!runner)return finish(P,{...base,motion:'none'},.1);
  P.pose('f:P',.05,'kick');P.pose('f:P',.35,'release');P.pose('f:P',.5,'follow');
  P.b({t0:.35,t1:.75,a:[0,17.2],b:[0,-.8],peak:.4,kind:'pitch'});
  P.pose('f:C',.7,'catch');P.pose('f:C',.85,'ctrthrow');
  const rid='r:'+runner.id,rv=P.rv(runner.id);
  const tagT=P.go('f:'+cover,add(SECOND,[cover==='2B'?.8:-.8,-.6]),.3,P.fv(cover),'cover');void tagT;
  const throwT=1.05,arr=throwT+.15+distM(PLATE,SECOND)/P.arm('C');
  P.b({t0:throwT+.15,t1:arr,a:[0,0],b:SECOND,peak:1.6,kind:'throw'});P.pose('f:C',throwT+.4,'ready');
  P.pose('f:'+cover,arr-.2,'catch');
  // 走者が着く時刻: 成功なら球より少し先、失敗なら後(結果どおり)
  const want=k==='SB'?arr-.12:arr+.25,from=leadOff(0),pre=lerp(from,SECOND,.85);
  P.goBy(rid,pre,.42,.42+(want-.42)*.84,'run');P.goBy(rid,SECOND,0,want,'slide','slide');
  if(k==='CS'){P.pose('f:'+cover,arr+.05,'grounder');P.actors.get(rid)!.gone=want+.5;P.pose('f:'+cover,arr+.6,'cheer');}
  else P.pose(rid,want+.6,'ready');
  void rv;
  for(const a of adv)if(a!==runner)P.go('r:'+a.id,BAGS[a.from],0,3,'ready','jog');
  P.pose(bid,.4,'stance');
  return finish(P,{...base,motion:k==='SB'?'steal':'caught-stealing',chaser:'C',cover:{1:cover}},want+.8,2.6,.8);
 }
 if(k==='BUNT'||k==='BUNT_FAIL'){
  // バント: 投手・捕手・一三塁手が前へ。二塁手が一塁、遊撃手が二塁へ入る。
  const left=(e.inning+e.slot)%2===0,spot:V=k==='BUNT'?[left?-5.5:5.5,9.5]:[left?-2:2,4.5];
  P.pose(bid,0,'bunt');
  P.go('f:3B',lerp(READY['3B'],spot,.6),.05,P.fv('3B'));P.go('f:1B',lerp(READY['1B'],spot,.6),.05,P.fv('1B'));
  P.go('f:2B',FIRST,.1,P.fv('2B'),'cover');P.go('f:SS',SECOND,.1,P.fv('SS'),'cover');
  if(k==='BUNT_FAIL'){
   // 小フライ: 捕手が前に出て捕る。走者は戻る。
   P.b({t0:0,t1:1.3,a:[0,.5],b:spot,peak:6,kind:'air'});P.go('f:C',spot,.15,P.fv('C'),'fly');P.pose('f:C',1.25,'catch');
   P.go(bid,lerp(PLATE,FIRST,.25),.25,5,'sad');P.actors.get(bid)!.gone=1.7;
   for(const a of adv)P.go('r:'+a.id,BAGS[a.from],.2,4,'ready','jog');
   return finish(P,{...base,motion:'bunt-pop',chaser:'C'},2.2,2.2,.8);
  }
  const fielder:Pos=left?'3B':'P',ballT=P.b({t0:0,t1:1.25,a:[0,.6],b:spot,peak:0,kind:'ground'});
  P.go('f:'+fielder,add(spot,[0,.5]),.08,P.fv(fielder),'grounder');P.pose('f:'+fielder,ballT,'grounder');
  P.go('f:C',lerp(PLATE,spot,.4),.1,5);
  const bv=P.rv(e.batter),runT=.35+27.43/bv;
  const throwAt=ballT+.25,arr=throwAt+.22+distM(spot,FIRST)/P.arm(fielder);
  P.throwTo(fielder,FIRST,throwAt,'2B');
  const tOut=Math.max(arr+.25,runT);runPath(P,bid,[BOX_M[hand],lerp(PLATE,FIRST,.25)],.3,bv);P.goBy(bid,FIRST,0,tOut,'jog');P.actors.get(bid)!.gone=tOut+.3;
  for(const a of adv){const rid='r:'+a.id;
   if(a.to===a.from){P.go(rid,BAGS[a.from],.2,4,'ready','jog');continue;}
   const t=runPath(P,rid,pathPts(a.from,a.to).map((p,i)=>i===0?leadOff(a.from):p),a.to===3?0:.35,P.rv(a.id),a.to===3);
   if(a.to===3)P.pose(rid,t+.5,'cheer');}
  return finish(P,{...base,motion:'bunt',chaser:fielder,cover:{0:'2B',1:'SS'}},tOut+.9,3.4,.6);
 }
 if(k==='HR'){
  // 本塁打: 打球はスタンドへ。外野手は塀まで追って見上げる。打者と走者は回って本塁へ、還ったら喜ぶ。
  const deg=ANGLE[word]??0,fence=fenceAt(deg),land=polar(deg,fence+14),of:Pos=deg<-9?'LF':deg>9?'RF':'CF';
  P.pose(bid,0,'follow');
  const ballT=P.b({t0:0,t1:2.6,a:[0,.8],b:land,peak:32,kind:'air',fade:true});
  P.go('f:'+of,polar(deg,fence-1.5),.1,P.fv(of),'fly');P.pose('f:'+of,ballT-.3,'sad');
  const v=6.4;
  // 走者は先に還る。打者は一周(長いので、本塁打の演出の間に回り終わる所まで)。
  let lastHome=0;
  for(const a of adv){const t=runPath(P,'r:'+a.id,pathPts(a.from,3).map((p,i)=>i===0?leadOff(a.from):p),.6,v);P.pose('r:'+a.id,t,'cheer');P.go('r:'+a.id,add(PLATE,[a.from===2?-5:5,-3]),t+.6,2,'cheer','jog');lastHome=Math.max(lastHome,t);}
  const tb=runPath(P,bid,[BOX_M[hand],...pathPts(-1,3).slice(1)],.35,v);P.pose(bid,tb,'cheer');
  return finish(P,{...base,motion:'home-run',chaser:of,banner:{t:ballT*.92,text:'ホームラン!'}},Math.min(tb+.5,ballT+3.2),4.4,.62);
 }
 if(k==='1B'||k==='2B'||k==='3B'){
  const deg=ANGLE[word]??0,through=word==='三遊間'||word==='一二塁間';
  const of:Pos=deg<-9?'LF':deg>9?'RF':'CF';
  const dist=k==='1B'?(through?58:60):k==='2B'?Math.min(fenceAt(deg)-6,92):fenceAt(deg)-3;
  const land=polar(deg,k==='1B'?dist:dist-10),stop=polar(deg,dist);
  let pickT:number,pickAt:V;
  P.pose(bid,0,'follow');
  if(through||k==='1B'&&(e.inning+e.slot)%2===0){
   // ゴロで内野を抜ける: 内野手が飛びつくが届かない
   const by:Pos=deg<0?'SS':'2B',hole=polar(deg,33);
   const tHole=P.b({t0:0,t1:.95,a:[0,.6],b:hole,peak:0,kind:'ground'});
   P.go('f:'+by,lerp(READY[by],hole,.75),.05,P.fv(by),'dive');P.pose('f:'+by,tHole+.6,'ready');
   P.go('f:'+(deg<0?'3B':'1B'),lerp(READY[deg<0?'3B':'1B'],hole,.3),.05,P.fv(deg<0?'3B':'1B'),'ready');
   const tLand=P.b({t0:tHole,t1:tHole+1.3,a:hole,b:stop,peak:0,kind:'ground'});
   pickAt=stop;P.go('f:'+of,add(stop,[0,1]),.05,P.fv(of),'grounder');pickT=Math.max(tLand,P.last('f:'+of).t)+.15;
  }else{
   // ライナー・フライで外野へ。外野手は落ちる所へ走るが届かず、跳ねた球を拾う。
   const hang=k==='1B'?1.25:2.0,tLand=P.b({t0:0,t1:hang,a:[0,.8],b:land,peak:k==='1B'?3:k==='2B'?9:14,kind:'air'});
   const tRoll=P.b({t0:tLand,t1:tLand+(k==='1B'?.6:1.4),a:land,b:stop,peak:0,kind:'ground'});
   const reach=P.go('f:'+of,lerp(READY[of],land,.8),.1,P.fv(of),'run');void reach;
   const arrive=P.go('f:'+of,add(stop,[0,1]),P.last('f:'+of).t,P.fv(of),'grounder');
   pickT=Math.max(tRoll,arrive)+.15;pickAt=stop;
   // もう1人の外野手もバックアップに走る
   const help:Pos=of==='CF'?(deg<0?'LF':'RF'):'CF';P.go('f:'+help,lerp(READY[help],stop,.6),.2,P.fv(help));
  }
  P.pose('f:'+of,pickT,'grounder');
  // 打者と走者(結果の塁まで)
  const bv=P.rv(e.batter),bTo=e.bases.indexOf(e.batter);
  const bpts=[BOX_M[hand],...pathPts(-1,Math.max(0,bTo)).slice(1)];
  // 中継: 長打は外野 → 中継(遊撃か二塁)→ 塁。単打は外野 → 二塁(入った人)へ。
  const cutoff:Pos=deg<=0?'SS':'2B',other:Pos=cutoff==='SS'?'2B':'SS';
  const bArrive=runPath(P,bid,bpts,.3,bv,bTo>=1&&k!=='1B',bTo===0?'ready':'ready');
  // 一塁を回ってから戻る(単打)
  if(bTo===0){P.go(bid,lerp(FIRST,SECOND,.14),bArrive,bv*.6,'ready');P.go(bid,FIRST,P.last(bid).t+.1,3,'ready','jog');}
  let lastT=bArrive;
  for(const a of adv){const rid='r:'+a.id;if(a.to===a.from){P.go(rid,BAGS[a.from],.2,4,'ready','jog');continue;}
   const t=runPath(P,rid,pathPts(a.from,a.to).map((p,i)=>i===0?leadOff(a.from):p),.15,P.rv(a.id),a.to===3);
   if(a.to===3)P.pose(rid,t+.45,'cheer');lastT=Math.max(lastT,t);}
  // 返球は走者が着いた後(全員セーフの結果どおり)
  // 送球は、その塁に走者が着いた後に着く(全員セーフ)。flight=投げてから着くまで。
  const after=(bag:number,from:Pos,at:V,t:number)=>{let need=0;for(const a of adv)if(a.to===bag)need=Math.max(need,P.last('r:'+a.id).t);if(bTo===bag)need=Math.max(need,bArrive);
   const flight=.22+distM(at,BAGS[bag])/P.arm(from);return Math.max(t,need+.12-flight);};
  if(k==='1B'){
   P.go('f:'+other,SECOND,.2,P.fv(other),'cover');P.go('f:1B',FIRST,.2,P.fv('1B'),'cover');
   P.go('f:'+cutoff,lerp(SECOND,pickAt,.3),.3,P.fv(cutoff),'ready');
   P.throwTo(of,SECOND,after(1,of,pickAt,pickT+.2),other);
  }else{
   const bag=Math.min(2,Math.max(1,bTo)),relay=lerp(BAGS[bag],pickAt,.42);
   P.go('f:'+cutoff,relay,.3,P.fv(cutoff),'ready');
   const toBag:Pos=bag===2?'3B':other;P.go('f:'+toBag,BAGS[bag],.3,P.fv(toBag),'cover');
   const t1=P.throwTo(of,relay,pickT+.2,cutoff);
   P.throwTo(cutoff,BAGS[bag],after(bag,cutoff,relay,t1+.2),toBag);
  }
  backups(P,pickAt,.3,[of,cutoff,other,'1B','3B']);
  const end=Math.max(lastT,P.ball.at(-1)!.t1)+.5;
  return finish(P,{...base,motion:k==='1B'?'single':'extra-base',chaser:of,cover:{1:k==='1B'?other:(k==='2B'?other:'3B')}},end,k==='1B'?3.6:4.6,.6);
 }
 if(k==='SF'||(k==='OUT'&&/フライ/.test(word))){
  // 外野フライ: 落下点に入って捕る。タッチアップは、捕ってから走る。外野から中継へ返す。
  const deg=ANGLE[word]??0,of:Pos=deg<-9?'LF':deg>9?'RF':'CF',deep=k==='SF'?84:(e.inning+e.slot)%3===0?66:76;
  const land=polar(deg,deep),hang=k==='SF'?3.6:3.2;
  P.pose(bid,0,'follow');
  const tC=P.b({t0:0,t1:hang,a:[0,.8],b:land,peak:k==='SF'?30:26,kind:'air'});
  const dive=fine&&k==='OUT'&&deep<70;
  if(dive){P.go('f:'+of,lerp(READY[of],land,.82),.25,P.fv(of)*.8,'run');P.go('f:'+of,land,tC-.35,8,'dive','dive');P.pose('f:'+of,tC+.7,'ready');}
  else{P.go('f:'+of,add(land,[0,.6]),.15,P.fv(of)*.85,'fly');P.pose('f:'+of,tC-.25,'catch');P.pose('f:'+of,tC+.2,'ready');}
  // 打者: 一塁へ走り、捕られたら戻る(消える)
  const bv=P.rv(e.batter);P.go(bid,lerp(PLATE,FIRST,.82),.3,bv*.85);P.pose(bid,tC,'sad');P.actors.get(bid)!.gone=tC+.4;
  // 走者: 三塁(と二塁)は塁に戻ってタッチアップの構え、一塁は少し出て戻る
  let lastT=tC;
  for(const a of adv){const rid='r:'+a.id;
   if(a.to===3&&k==='SF'){P.go(rid,THIRD,.1,4,'lead','jog');const t=runPath(P,rid,[THIRD,PLATE],tC+.05,P.rv(a.id),true);P.pose(rid,t+.45,'cheer');lastT=Math.max(lastT,t);continue;}
   if(a.from>=1){P.go(rid,BAGS[a.from],.1,4,'lead','jog');}
   else{P.go(rid,lerp(FIRST,SECOND,.35),.2,5,'ready');P.go(rid,FIRST,tC+.05,6,'ready');}
  }
  const cutoff:Pos=deg<=0?'SS':'2B';
  if(k==='SF'){P.go('f:C',add(PLATE,[0,.6]),.3,3,'cover');P.go('f:1B',lerp(PLATE,RUBBER,.55),.4,P.fv('1B'));P.pose('f:C',lastT-.4,'catch');
   const t1=P.throwTo(of,add(PLATE,[0,1]),tC+.35);void t1;}
  else{P.go('f:'+cutoff,lerp(SECOND,land,.3),.4,P.fv(cutoff),'ready');P.throwTo(of,lerp(SECOND,land,.3),tC+.45,cutoff);}
  P.go('f:'+(cutoff==='SS'?'2B':'SS'),SECOND,.4,P.fv(cutoff==='SS'?'2B':'SS'),'cover');
  P.go('f:1B',FIRST,.3,P.fv('1B'),'cover');
  backups(P,land,.2,[of,cutoff,'2B','SS','1B','C']);
  const end=Math.max(lastT,P.ball.at(-1)!.t1)+.4;
  return finish(P,{...base,motion:k==='SF'?'tag-up':'fly-out',chaser:of,fine:dive,banner:dive?{t:tC,text:'ファインプレー!'}:null},end,k==='SF'?4.4:3.6,.62);
 }
 // ゴロ(凡打・失策)
 const err=k==='E',deg=ANGLE[word]??0;
 const posOf:Record<string,Pos>={ショートゴロ:'SS',セカンドゴロ:'2B',サードゴロ:'3B',ファーストゴロ:'1B',ピッチャーゴロ:'P',ショート:'SS',セカンド:'2B',サード:'3B'};
 const f:Pos=posOf[word]??'SS',r0=READY[f];
 const spot:V=f==='P'?[.6,15]:add(polar(deg,len(r0)-1),[0,0]);
 const dive=!err&&fine&&f!=='P'&&f!=='1B';
 const spot2:V=dive?add(spot,[deg<0?-3.5:3.5,0]):spot;
 P.pose(bid,0,'follow');
 const tB=P.b({t0:0,t1:f==='P'?.55:Math.max(.7,len(spot2)/31),a:[0,.6],b:spot2,peak:0,kind:'ground'});
 if(dive){P.go('f:'+f,lerp(r0,spot2,.4),.08,P.fv(f),'run');P.go('f:'+f,spot2,tB-.25,8,'dive','dive');P.pose('f:'+f,tB+.45,'ready');}
 else P.go('f:'+f,spot2,.08,P.fv(f)*.8,'grounder');
 P.pose('f:'+f,tB-.15,'grounder');
 let pickT=tB+(dive?.55:.2);
 if(err){// はじく: 球が前にこぼれて、拾い直す
  const loose=add(spot2,[deg<0?-4:4,-3]);P.b({t0:tB,t1:tB+.6,a:spot2,b:loose,peak:.6,kind:'ground'});
  P.go('f:'+f,loose,tB+.2,P.fv(f)*.8,'grounder');pickT=tB+.95;
 }
 // 一塁: 一塁手が入る(一塁ゴロは投手が入って、一塁手がトス)
 const recv:Pos=f==='1B'?'P':'1B';
 const tCover=P.go('f:'+recv,add(FIRST,[f==='1B'?-.5:.6,-.3]),.12,P.fv(recv),'cover');void tCover;
 const bv=P.rv(e.batter),bRun=.3+distM(BOX_M[hand],FIRST)/bv;
 // 送球の着く時刻(アウトは打者より先、失策は打者より後)
 let arr=pickT+.22+.22+distM(P.at('f:'+f),FIRST)/P.arm(f);
 if(f==='1B'){arr=pickT+.6;}
 const outT=err?Math.max(arr+.3,bRun):Math.max(arr+.18,bRun);
 if(err){P.pose('f:'+f,pickT,'ready');}
 else P.throwTo(f,FIRST,pickT,recv);
 P.go(bid,lerp(BOX_M[hand],FIRST,.8),.3,bv);P.goBy(bid,FIRST,0,outT,'run');
 if(!err){P.go(bid,add(FIRST,[3.5,2.5]),outT,bv*.6,'sad');P.actors.get(bid)!.gone=outT+.35;}
 else P.pose(bid,outT+.1,'ready');
 // 走者: 失策は1つ進む(結果どおり)、凡打は塁に戻る
 let lastT=outT;
 for(const a of adv){const rid='r:'+a.id;
  if(a.to===a.from){P.go(rid,lerp(leadOff(a.from),BAGS[Math.min(3,a.from+1)],.12),.2,4,'run');P.go(rid,BAGS[a.from],P.last(rid).t+.15,5,'ready');continue;}
  const t=runPath(P,rid,pathPts(a.from,a.to).map((p,i)=>i===0?leadOff(a.from):p),.2,P.rv(a.id),a.to===3);if(a.to===3)P.pose(rid,t+.4,'cheer');lastT=Math.max(lastT,t);}
 // ほかの野手: 二塁に入る・バックアップ
 const mid:Pos=f==='SS'||f==='3B'?'2B':'SS';P.go('f:'+mid,SECOND,.15,P.fv(mid),'cover');
 backups(P,spot2,.1,[f,recv,mid,'1B']);
 const banner=err?{t:tB+.1,text:'エラー!'}:dive?{t:tB,text:'ファインプレー!'}:null;
 return finish(P,{...base,motion:err?'error':'ground-out',chaser:f,fine:dive,cover:{0:recv},banner},Math.max(lastT,outT)+.5,3.2,.62);
}

// ---- その時刻の姿 ----
export interface ActorAt {id:string;role:Actor['role'];pos?:Pos;p:V;pose:Pose;face:number;o:number;moving:boolean}
export function actorAt(a:Actor,t:number):ActorAt{
 const ks=a.keys;let i=0;while(i+1<ks.length&&ks[i+1].t<=t)i++;
 const k=ks[i],n=ks[i+1];let p=k.p,face=0,moving=false;
 if(n&&t>k.t){const f=(t-k.t)/Math.max(1e-6,n.t-k.t);p=lerp(k.p,n.p,f);const dx=n.p[0]-k.p[0];face=dx>.05?1:dx<-.05?-1:0;moving=distM(k.p,n.p)>.05;}
 else if(n){const dx=n.p[0]-k.p[0];face=dx>.05?1:dx<-.05?-1:0;}
 else if(i>0){const dx=k.p[0]-ks[i-1].p[0];face=dx>.05?1:dx<-.05?-1:0;}
 let o=1;if(a.gone!==undefined&&t>a.gone)o=Math.max(0,1-(t-a.gone)/.35);
 return {id:a.id,role:a.role,pos:a.pos,p,pose:moving&&k.pose==='ready'?'run':k.pose,face,o,moving};
}
/** その時刻のボール。h=高さ(m)。null=見えない。 */
export function ballAt(c:Pick<Choreo,'ball'>,t:number):{p:V;h:number;o:number;kind:BallSeg['kind']}|null{
 let s:BallSeg|null=null;for(const x of c.ball)if(t>=x.t0)s=x;
 if(!s||s.kind==='hidden')return null;
 const f=clamp((t-s.t0)/Math.max(1e-6,s.t1-s.t0),0,1);
 if(t>s.t1+.05&&s.kind!=='ground'&&!c.ball.some(x=>x.t0>s!.t0))return null;// 捕った後は見せない
 const g=s.kind==='ground'?1-(1-f)*(1-f):f;// 転がる球はだんだん遅く
 const p=lerp(s.a,s.b,g),h=(s.kind==='air'||s.kind==='throw'||s.kind==='pitch'?s.peak*4*f*(1-f):0)+(s.kind==='pitch'?1.2:s.kind==='throw'?1.4*(1-f)+1.1*f:0);
 const o=s.fade&&f>.8?(f>=1?0:Math.max(0,1-(f-.8)/.2)):1;
 return {p,h,o,kind:s.kind};
}
/** 最後に人が立つ所(試験と、動きの後の場面に使う)。 */
export function endOf(c:Choreo,id:string):ActorAt|null{const a=c.actors.find(x=>x.id===id);return a?actorAt(a,c.len+10):null;}
/** 打席の前の立ち位置(動かない場面)。 */
export function stillScene(ctx:SimCtx,e:{batter:string;pitcher:string},bases:(string|null)[]):Choreo{
 const P=new Plan(ctx);setup(P,e,bases,batSide(e.batter,e.pitcher));
 return {kind:'PITCH',motion:'none',word:'',len:0,actors:[...P.actors.values()],ball:[],banner:null};
}
