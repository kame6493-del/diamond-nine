import snapshot from './wiki2026.json';
import type { Player, Ratings } from './data';

export interface WikiAssessment {
 id:string;name:string;team:string;sourceNumber:string;sourceName:string;sourceUrl:string;performanceYears:number[];
 ratings:Partial<Ratings>&{trajectory?:number};positionLevels:Record<string,number>;pitcherRoles:Record<string,string>;
 pitches:{name:string;level:number}[];secondFastball:string|null;traits:string[];
}
export const wikiInfo=snapshot;
export const wikiPlayerMap=new Map<string,WikiAssessment>((snapshot.entries as WikiAssessment[]).map(e=>[e.id,e]));
export const wikiBreaking=(pitches:WikiAssessment['pitches'])=>Math.min(99,Math.round(30+Math.max(0,...pitches.map(p=>p.level))*6+pitches.reduce((n,p)=>n+p.level,0)*2));
export function applyWikiAssessment(p:Player){
 if(p.dataYear!==2026)return;
 // Freeze the pre-Wiki calibration: replacing the display must change future
 // simulation probabilities, not silently reset the probability anchor.
 p.simulationBaseline={...p.ratings};
 const entry=wikiPlayerMap.get(p.id);if(!entry)return;
 p.wikiAssessment=entry;
 for(const key of Object.keys(p.ratings) as (keyof Ratings)[])if(entry.ratings[key]!==undefined)p.ratings[key]=entry.ratings[key]!;
 if(entry.pitches.length)p.ratings.breaking=wikiBreaking(entry.pitches);
 const positions=Object.keys(entry.positionLevels).sort((a,b)=>entry.positionLevels[b]-entry.positionLevels[a]);
 if(positions.length){p.positions=[...new Set([...(p.role==='pitcher'?['投']:[]),...positions])];if(p.role==='batter')p.position=positions[0];p.positionSource='wiki';}
 p.traits=entry.traits.length?[...entry.traits]:['基本能力型'];
 const r=p.ratings;
 // The collection tier stays compatible with existing saves; OVR represents
 // the newly adopted abilities and is not a multiplier in the match engine.
 p.overall=Math.round(p.role==='batter'?r.contact*.27+r.power*.30+r.speed*.12+r.arm*.10+r.field*.14+r.catching*.07:
  Math.max(15,Math.min(99,(r.velocity-125)*2.5))*.20+r.control*.30+r.stamina*.18+r.breaking*.32);
}
export const velocityLabel=(_p:Player)=>'球速';
export const velocitySource=(p:Player)=>p.wikiAssessment?.ratings.velocity!==undefined?p.wikiAssessment.sourceUrl:p.velocityRecord?.url;
export const wikiPositionPenalty=(p:Player,pos:string)=>p.wikiAssessment?.positionLevels[pos]===undefined?0:(7-p.wikiAssessment.positionLevels[pos])*6;
export const pitchingRoleLabel=(p:Player)=>p.wikiAssessment?.pitcherRoles['先']==='◎'?'先発':p.wikiAssessment?.pitcherRoles['中']==='◎'||p.wikiAssessment?.pitcherRoles['抑']==='◎'?'救援':!p.pitching?'投手':p.pitching.outs/Math.max(1,p.pitching.games)>=12?'先発':'救援';
