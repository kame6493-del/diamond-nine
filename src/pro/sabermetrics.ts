import type { BattingRecord, PitchingRecord } from './data';

export const ratio=(a:number,b:number):number|null=>b>0?a/b:null;
export function battingMetrics(b:Pick<BattingRecord,'ab'|'pa'|'hits'|'doubles'|'triples'|'hr'|'bb'|'hbp'|'sf'|'so'>){
 const avg=ratio(b.hits,b.ab), obp=ratio(b.hits+b.bb+b.hbp,b.ab+b.bb+b.hbp+b.sf);
 const slg=ratio(b.hits+b.doubles+2*b.triples+3*b.hr,b.ab);
 return {avg,obp,slg,ops:obp!==null&&slg!==null?obp+slg:null,iso:slg!==null&&avg!==null?slg-avg:null,
  babip:ratio(b.hits-b.hr,b.ab-b.so-b.hr+b.sf),kPct:ratio(b.so,b.pa),bbPct:ratio(b.bb,b.pa)};
}
export function fip(q:Pick<PitchingRecord,'outs'|'hr'|'bb'|'hbp'|'so'>,constant:number){
 return q.outs>0?(13*q.hr+3*(q.bb+q.hbp)-2*q.so)/(q.outs/3)+constant:null;
}
export function pitchingMetrics(q:Pick<PitchingRecord,'outs'|'hr'|'bb'|'hbp'|'so'|'bf'|'hits'|'er'>,constant:number){
 const kPct=ratio(q.so,q.bf),bbPct=ratio(q.bb,q.bf);
 return {fip:fip(q,constant),whip:ratio((q.hits+q.bb)*3,q.outs),kPct,bbPct,
  kMinusBb:kPct!==null&&bbPct!==null?kPct-bbPct:null,era:ratio(q.er*27,q.outs),hr9:ratio(q.hr*27,q.outs)};
}
export function leagueContext(records:{batting?:Parameters<typeof battingMetrics>[0];pitching?:Parameters<typeof pitchingMetrics>[0]}[]){
 const b={ab:0,pa:0,hits:0,doubles:0,triples:0,hr:0,bb:0,hbp:0,sf:0,so:0};
 const p={outs:0,hr:0,bb:0,hbp:0,so:0,bf:0,hits:0,er:0};
 for(const r of records){if(r.batting)for(const k of Object.keys(b) as (keyof typeof b)[])b[k]+=r.batting[k];if(r.pitching)for(const k of Object.keys(p) as (keyof typeof p)[])p[k]+=r.pitching[k];}
 const era=p.outs?p.er*27/p.outs:3.1;
 const constant=era-(fip(p,0)??0);
 return {batting:battingMetrics(b),pitching:pitchingMetrics(p,constant),fipConstant:constant,b,p};
}
export const displayMetric=(value:number|null|undefined,decimals=3)=>value==null||!Number.isFinite(value)?'—':value.toFixed(decimals);
export const displayPercent=(value:number|null|undefined)=>value==null?'—':`${(value*100).toFixed(1)}%`;
