export interface FieldingRecord { position:string;games:number;putouts:number;assists:number;errors:number;pct:number }
export interface DefenseEvidence { chances:number;errors:number;games:number;fieldingPct:number|null;positionPct:number|null;handling:number }
export interface UzrRecord { rank:number;team:string;name:string;outs:number;uzr:number|null;per1200:number|null;playerId:string|null;sourceFile:string;note?:string }
export const formatFieldInnings=(outs:number|null)=>outs===null?'—':`${Math.floor(outs/3)}${outs%3?` ${outs%3}/3`:''}`;

export function assessUZR(record:Pick<UzrRecord,'uzr'|'outs'>|null){
 const innings=record?record.outs/3:null;
 if(record?.uzr==null||innings===null||innings<=0)return {rating:60,per1200:null,adjusted1200:null,innings};
 // A game calibration, not a published talent estimate. Add 400 neutral innings
 // so a handful of innings cannot produce a top rating from an extreme rate.
 const per1200=record.uzr*1200/innings,adjusted1200=record.uzr*1200/(innings+400);
 return {rating:Math.round(Math.max(15,Math.min(99,60+adjusted1200*2))),per1200,adjusted1200,innings};
}

// Error avoidance is only one part of defense. Never infer range or throwing speed here.
export function assessHandling(record:FieldingRecord|undefined, peers:FieldingRecord[]):DefenseEvidence {
 const chances=record?record.putouts+record.assists+record.errors:0;
 const errors=record?.errors??0;
 const total=peers.reduce((s,p)=>s+p.putouts+p.assists+p.errors,0);
 const errorTotal=peers.reduce((s,p)=>s+p.errors,0);
 const baseline=total?errorTotal/total:null;
 // 250 chances of same-position prior limit small-sample/no-error overrating.
 const reg=baseline===null?null:(errors+250*baseline)/(chances+250);
 const handling=reg===null||baseline===null?60:Math.round(Math.max(40,Math.min(85,60+(baseline-reg)*1000)));
 return {chances,errors,games:record?.games??0,fieldingPct:chances?1-errors/chances:null,positionPct:baseline===null?null:1-baseline,handling};
}
