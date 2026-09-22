import snapshot from './growth-evidence2026.json';
import type {Player} from './data';

export interface GrowthBatting {pa:number;ab:number;hits:number;hr:number;bb:number;so:number;obp:number;slg:number}
export interface GrowthPitching {bf:number;outs:number;so:number;bb:number;hr:number;er:number}
export interface GrowthEvidence {
 id:string;source:string;birthDate:string;
 draft:{year:number|null;rank:number|null;type:string|null;league:string;pick:number|null};
 debutYear:number|null;batting:(GrowthBatting&{year:number})[];pitching:(GrowthPitching&{year:number})[];
 farmBatting:GrowthBatting|null;farmPitching:GrowthPitching|null;
}
export const growthEvidence=new Map<string,GrowthEvidence>((snapshot.entries as GrowthEvidence[]).map(e=>[e.id,e]));
export const evidenceFor=(p:Player)=>growthEvidence.get(p.mlb?`mlb-${p.mlb.id}`:p.id);
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function draftExpectation(d:GrowthEvidence['draft']|undefined):number{
 if(!d?.year)return .5; // An international signing is not a last-round pick.
 if(d.type==='priority')return .94;
 if(d.league==='MLB'){
  if(d.pick!==null)return d.pick<=15?.98:d.pick<=40?.89:d.pick<=100?.74:d.pick<=200?.61:d.pick<=350?.49:.4;
  return .5;
 }
 if(d.type==='developmental')return d.rank===1?.38:d.rank!==null&&d.rank<=3?.34:.28;
 return d.rank===1?.98:d.rank===2?.82:d.rank===3?.70:d.rank===4?.60:d.rank===5?.53:.47;
}
function battingSignal(b:GrowthBatting|undefined|null,level:'NPB'|'MLB'|'farm'){
 const sample=b?.pa??0;if(!b||!sample)return {value:.5,weight:0};
 const baseline=level==='MLB'?.73:level==='farm'?.68:.68;
 const quality=clamp(.5+(b.obp+b.slg-baseline)*1.65+(.2-b.so/sample)*.22,.05,.98);
 return {value:quality,weight:sample/(sample+(level==='farm'?180:280))};
}
function pitchingSignal(p:GrowthPitching|undefined|null,level:'NPB'|'MLB'|'farm'){
 const sample=p?.bf??0;if(!p||!sample||!p.outs)return {value:.5,weight:0};
 const kbb=(p.so-p.bb)/sample,era=p.er*27/p.outs,baseline=level==='MLB'?4.1:3.4;
 return {value:clamp(.5+(kbb-.14)*1.9+(baseline-era)/16,.05,.98),weight:sample/(sample+(level==='farm'?210:300))};
}
// Signals regress to neutral with small samples. Recent first-team results carry
// more weight; an older successful season only provides a conservative floor.
export function performanceExpectation(p:Player){
 const e=evidenceFor(p),level=p.mlb?'MLB':'NPB';
 const first=p.role==='pitcher'?pitchingSignal(p.pitching,level):battingSignal(p.batting,level);
 const farm=p.role==='pitcher'?pitchingSignal(e?.farmPitching,'farm'):battingSignal(e?.farmBatting,'farm');
 const recent=(s:{year:number})=>s.year<2026&&s.year>=2022;
 const past=p.role==='pitcher'?(e?.pitching??[]).filter(recent).map(s=>pitchingSignal(s,'NPB')):(e?.batting??[]).filter(recent).map(s=>battingSignal(s,'NPB'));
 const track=Math.max(0,...past.filter(s=>s.value>.5&&s.weight>=.25).map(s=>.5+(s.value-.5)*s.weight*.65));
 const firstValue=.5+(first.value-.5)*first.weight;
 const farmValue=.5+(farm.value-.5)*farm.weight;
 const value=firstValue+(farmValue-.5)*(1-first.weight)*.8;
 return {value:clamp(Math.max(value,track),.15,.95),firstWeight:first.weight,farmWeight:farm.weight};
}
