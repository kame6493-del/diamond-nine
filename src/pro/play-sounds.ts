// 試合の動きに合わせた効果音の時刻(2026-11-05 持ち主「ボールを捕った音とか、良い感じに入れるようにして。ちょっと不自然なところあるから、見直して作ってみて」)。
// 動き(field-sim.ts の Choreo)から、球が手に届いた瞬間・投げた瞬間・走者が塁に着いた瞬間・滑り込みの始まり・外野で球が弾んだ瞬間を拾う。
// 時刻は動きの秒(1倍)。画面は速さで割って鳴らす。倍速の時の間引きは thinCues。
import {BAGS,PLATE,distM,type Choreo,type V} from './field-sim';

// 11/6 持ち主「凡退した時かな。なんか変な音がする」: 大きなフライの「おお」(人の声 ooh)は外した。凡退はミット・グラブの捕球の音だけ。
export type CueKind='mitt'|'strikeout'|'glove'|'infield'|'throw'|'step'|'slide'|'bounce'|'foul';
export interface Cue {t:number;kind:CueKind}
const CATCH_POSES=new Set(['catch','grounder','fly','dive']);
const near=(a:V,b:V,m:number)=>distM(a,b)<=m;
/** その時刻・その場所で、守る人が球を受けているか(捕る形の人が近くにいる)。 */
function caughtBy(c:Choreo,t:number,at:V):boolean{
 for(const a of c.actors){
  if(a.role!=='f')continue;
  for(const k of a.keys)if(CATCH_POSES.has(k.pose)&&Math.abs(k.t-t)<=.45&&near(k.p,at,4.5))return true;
 }
 return false;
}
const outfield=(p:V)=>distM(p,PLATE)>42;

/** 1つの動き(投球の1球、または打球・盗塁などのプレー)の音。opts.lastK=三振の最後の球(ミットの音を強い物に)。 */
export function soundCues(c:Choreo,opts:{lastK?:boolean}={}):Cue[]{
 const cues:Cue[]=[];
 const segs=[...c.ball].sort((a,b)=>a.t0-b.t0);
 segs.forEach((s,i)=>{
  const next=segs.find((x,j)=>j>i&&Math.abs(x.t0-s.t1)<.08);
  if(s.kind==='pitch'){
   // 打たなかった球は、捕手のミットに届いた瞬間に「パシッ」。打った球・ファウルは打球音(別に鳴らす)。
   const caught=c.actors.some(a=>a.pos==='C'&&a.keys.some(k=>k.pose==='catch'&&Math.abs(k.t-s.t1)<=.3));
   const hitAfter=segs.some(x=>x!==s&&x.t0>=s.t1-.02&&x.t0<=s.t1+.05&&x.kind==='air'&&x.fade);
   if(hitAfter)cues.push({t:s.t1,kind:'foul'});
   else if(caught)cues.push({t:s.t1,kind:opts.lastK?'strikeout':'mitt'});
   return;
  }
  if(s.kind==='throw'){
   cues.push({t:s.t0,kind:'throw'});
   if(caughtBy(c,s.t1,s.b)||!next)cues.push({t:s.t1,kind:outfield(s.b)?'glove':'infield'});
   return;
  }
  if(s.kind==='air'){
   if(s.fade)return;// 本塁打・ファウルはスタンドへ
   if(next&&next.kind==='ground'){if(outfield(s.b))cues.push({t:s.t1,kind:'bounce'});return;}
   if(caughtBy(c,s.t1,s.b)){cues.push({t:s.t1,kind:outfield(s.b)?'glove':'infield'});}
   return;
  }
  if(s.kind==='ground'){
   if(next&&next.kind==='ground')return;// 転がり続ける
   if(caughtBy(c,s.t1,s.b))cues.push({t:s.t1,kind:outfield(s.b)?'glove':'infield'});
  }
 });
 // 走者・打者: 塁に着いた瞬間(滑り込みは滑り始めた瞬間)。
 for(const a of c.actors){
  if(a.role==='f')continue;
  a.keys.forEach((k,i)=>{
   const prev=a.keys[i-1];if(!prev)return;
   if(k.pose==='slide'&&prev.pose!=='slide'){cues.push({t:k.t,kind:'slide'});return;}
   if(prev.pose==='slide')return;
   if(prev.pose==='run'&&k.pose!=='run'&&k.pose!=='slide'&&BAGS.some(b=>near(k.p,b,.8)))cues.push({t:k.t,kind:'step'});
  });
 }
 return cues.filter(x=>x.t>=0&&x.t<=c.len+.2).sort((a,b)=>a.t-b.t);
}

const CATCHES=new Set<CueKind>(['mitt','strikeout','glove','infield']);
/** 倍速の時は間引く(前の決まり: 4倍以上は重ならないように、8倍以上は試合の終わりと歓声だけ)。同じ音が続けて重なる時も1つに。 */
export function thinCues(cues:Cue[],speed:number):Cue[]{
 if(speed>=8)return [];
 let list=cues;
 if(speed>=4){const first=list.find(x=>CATCHES.has(x.kind)||x.kind==='foul');return first?[first]:[];}
 if(speed>=2)list=list.filter(x=>x.kind!=='step'&&x.kind!=='throw');
 const out:Cue[]=[];let steps=0;
 for(const x of list){
  if(out.some(y=>y.kind===x.kind&&Math.abs(y.t-x.t)<.18))continue;
  if(x.kind==='step'&&++steps>3)continue;
  out.push(x);
 }
 return out;
}
