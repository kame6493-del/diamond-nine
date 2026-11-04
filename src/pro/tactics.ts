// 監督の作戦(2026-11-04 vc43 追加)。持ち主「長打狙い・ミート打ち・積極的に・慎重に とか、直球中心・変化球中心・ボール球中心・ストライク中心
// などの指示を出せるようにしてください。試合中に」。
// 作戦は、その打席の確率(matchupProbabilities の結果)に倍率を掛けるだけ。乱数は使わない(作戦を出さなければ、おまかせと1打席も違わない)。
// 効く大きさは数%〜十数%。どの作戦も勝率を大きく崩さないことを scripts/balance-tactics.ts で確かめた(BALANCE_1101.md)。
import {clamp} from './data';

export type BatTactic='power'|'contact'|'aggressive'|'patient';
export type PitchTactic='fastball'|'breaking'|'ball'|'strike';
export const BAT_TACTICS:BatTactic[]=['power','contact','aggressive','patient'];
export const PITCH_TACTICS:PitchTactic[]=['fastball','breaking','ball','strike'];
export const batTacticLabel:Record<BatTactic,string>={power:'長打狙い',contact:'ミート打ち',aggressive:'積極的に',patient:'慎重に'};
export const pitchTacticLabel:Record<PitchTactic,string>={fastball:'直球中心',breaking:'変化球中心',ball:'ボール球中心',strike:'ストライク中心'};
export const batTacticNote:Record<BatTactic,string>={
 power:'長打と三振が増え、単打が減る',
 contact:'三振が減り、長打が減る',
 aggressive:'早いカウントから打つ。四球が減る',
 patient:'よく見る。四球と三振が増え、球数を投げさせる',
};
export const pitchTacticNote:Record<PitchTactic,string>={
 fastball:'投手の球速が変化球より上なら三振が増え、打たれにくい(逆なら打たれやすい)',
 breaking:'投手の変化球が球速より上なら三振が増え、打たれにくい(逆なら打たれやすい)',
 ball:'四球が増えるが、長打を打たれにくい',
 strike:'四球が減るが、打たれやすい',
};
/** 試合の中の作戦(自分のチームの分だけ)。team=チーム全体の打撃、batter=打者ごと(選手の id。チーム全体より優先)、pitch=投手への指示。 */
/** pitcher=投手ごと(選手の id。チーム全体の投手の作戦より優先。11/4 夜)。 */
export interface Tactics {team:BatTactic|null;batter:Record<string,BatTactic>;pitch:PitchTactic|null;pitcher:Record<string,PitchTactic>}
export const emptyTactics=():Tactics=>({team:null,batter:{},pitch:null,pitcher:{}});
export const batTacticFor=(t:Tactics,id:string):BatTactic|null=>t.batter[id]??t.team;
export const pitchTacticFor=(t:Tactics,id:string):PitchTactic|null=>t.pitcher?.[id]??t.pitch;
export const isBatTactic=(x:unknown):x is BatTactic=>typeof x==='string'&&(BAT_TACTICS as string[]).includes(x);
export const isPitchTactic=(x:unknown):x is PitchTactic=>typeof x==='string'&&(PITCH_TACTICS as string[]).includes(x);

interface Mult {walk:number;k:number;hr:number;xbh:number;single:number}
const one=():Mult=>({walk:1,k:1,hr:1,xbh:1,single:1});
const batMult:Record<BatTactic,Mult>={
 power:{walk:1,k:1.12,hr:1.15,xbh:1.10,single:.92},
 contact:{walk:1,k:.85,hr:.85,xbh:.90,single:1.06},
 aggressive:{walk:.80,k:.96,hr:1,xbh:1,single:1.03},
 patient:{walk:1.18,k:1.10,hr:1,xbh:1,single:.98},
};
/** 直球・変化球の向き(-1〜1)。球速(120〜165km を 0〜99 に)と変化球の差で決まる。プラス=その作戦が投手に合っている。 */
export function pitchFit(tactic:'fastball'|'breaking',velocity:number,breaking:number):number{
 const speed=clamp((velocity-120)/45*99,0,110),d=clamp((speed-breaking)/25,-1,1);
 return tactic==='fastball'?d:-d;
}
function pitchMult(tactic:PitchTactic,velocity:number,breaking:number):Mult{
 if(tactic==='ball')return {walk:1.20,k:1,hr:.88,xbh:.92,single:.97};
 if(tactic==='strike')return {walk:.80,k:1,hr:1.06,xbh:1.04,single:1.03};
 const d=pitchFit(tactic,velocity,breaking);
 return {walk:tactic==='fastball'?.96:1.04,k:1+.08*d,hr:1-.06*d,xbh:1-.04*d,single:1-.03*d};
}
export interface PaRates {walk:number;hbp:number;strikeout:number;homeRun:number;hit:number;triple:number;double:number;babip:number}
/** 作戦の倍率を掛けた打席の確率。bat=打つ側の作戦、pitch=投げる側の作戦(どちらも null なら元のまま)。 */
export function tacticRates<T extends PaRates>(r:T,bat:BatTactic|null,pitch:PitchTactic|null,pitcher?:{velocity:number;breaking:number}):T{
 if(!bat&&!pitch)return r;
 const a=bat?batMult[bat]:one(),b=pitch?pitchMult(pitch,pitcher?.velocity??145,pitcher?.breaking??60):one();
 const walk=clamp(r.walk*a.walk*b.walk,.005,.30);
 let k=r.strikeout*a.k*b.k,hr=r.homeRun*a.hr*b.hr,triple=r.triple*a.xbh*b.xbh,double=r.double*a.xbh*b.xbh;
 let single=Math.max(0,r.hit-r.homeRun-r.triple-r.double)*a.single*b.single;
 // 確率の合計が1を超えないように(安打+三振は 0.95 まで)
 const total=k+hr+triple+double+single;if(total>.95){const f=.95/total;k*=f;hr*=f;triple*=f;double*=f;single*=f;}
 return {...r,walk,strikeout:k,homeRun:hr,triple,double,hit:hr+triple+double+single};
}
/** 球数の演出の向き(慎重=粘る、積極的=早いカウントで打つ)。試合の計算には使わない。 */
export const pitchLength=(bat:BatTactic|null)=>bat==='patient'?2:bat==='aggressive'?-1:0;

/** 結果の一文に足す、作戦が効いたかの言葉(11/4 夜 持ち主「長打狙いが当たった!二塁打」「ボール球中心で空振り三振」のように)。
 * kind=打席の結果(LiveKind)。bat=打った側の作戦(自分の攻撃の時)、pitch=投げた側の作戦(自分の守りの時)。言葉が無い組は null。
 * good=自分のチームに良い向き(緑)、悪い向き(赤)。試合の計算には使わない(見せるだけ)。 */
export function tacticNote(kind:string,bat:BatTactic|null,pitch:PitchTactic|null):{text:string;good:boolean}|null{
 const hit=['1B','2B','3B','HR'].includes(kind),xbh=['2B','3B','HR'].includes(kind),walk=kind==='BB'||kind==='HBP',out=['OUT','SF'].includes(kind);
 if(bat){
  const L=batTacticLabel[bat];
  if(bat==='power'){if(xbh)return {text:`${L}が当たった!`,good:true};if(kind==='K')return {text:`${L}が裏目に`,good:false};}
  if(bat==='contact'){if(kind==='1B')return {text:`${L}が決まった!`,good:true};if(hit)return {text:`${L}で鋭い当たり!`,good:true};}
  if(bat==='aggressive'){if(hit)return {text:`${L}打って出た!`,good:true};if(out)return {text:'早打ちで凡打',good:false};}
  if(bat==='patient'){if(walk)return {text:'慎重に見て四球を選んだ!',good:true};if(kind==='K')return {text:'見すぎた',good:false};}
 }
 if(pitch){
  const L=pitchTacticLabel[pitch];
  if(pitch==='fastball'){if(kind==='K')return {text:`${L}で三振!`,good:true};if(xbh)return {text:'直球を狙われた',good:false};}
  if(pitch==='breaking'){if(kind==='K')return {text:`${L}で空振り三振!`,good:true};if(xbh)return {text:'変化球を狙われた',good:false};}
  if(pitch==='ball'){if(kind==='K')return {text:`${L}で空振り三振!`,good:true};if(out)return {text:'ボール球を打たせて打ち取った!',good:true};if(walk)return {text:`${L}が裏目、四球`,good:false};}
  if(pitch==='strike'){if(kind==='K')return {text:`${L}で見逃し三振!`,good:true};if(out)return {text:'ストライク先行で打ち取った!',good:true};if(xbh)return {text:'ストライクを狙われた',good:false};}
 }
 return null;
}
