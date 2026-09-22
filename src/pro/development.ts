import type {Player,Ratings} from './data';
import rookies from './rookies2026.json';
import {draftExpectation,evidenceFor,performanceExpectation} from './growth-evidence';

const rookieIds=new Set(rookies.entries.map(p=>p.id));
const bound=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export const isRookie=(p:Player)=>rookieIds.has(p.id);
// Fixed to the roster snapshot; advancing a game season does not change potential.
export function playerAge(p:Player):number|null{
 const birth=p.mlb?.birthDate||p.roster?.birthDate||evidenceFor(p)?.birthDate;if(!birth||!/^\d{4}-\d{2}-\d{2}$/.test(birth))return null;
 return 2026-Number(birth.slice(0,4))-(birth.slice(5)>'09-20'?1:0);
}
// Keep the growth input independent from the displayed OVR scale.
export function baseAbilityScore(p:Player,r:Ratings=p.ratings):number{
 return Math.round(bound(p.role==='batter'?r.contact*.27+r.power*.30+r.speed*.12+r.arm*.10+r.field*.14+r.catching*.07:
 bound((r.velocity-125)*2.5,15,99)*.20+r.control*.30+r.stamina*.18+r.breaking*.32,1,99));
}
export function ratingOverall(p:Player,r:Ratings=p.ratings):number{
 // Ordinary cards keep their existing scale. Elite ability combinations keep
 // gaining OVR beyond 100 instead of flattening out at the old ceiling.
 const raw=overallAbilityScore(p,r),scale=[[0,1],[40,50],[55,72],[65,84],[75,98],[85,110],[99,124]];
 for(let i=1;i<scale.length;i++){
  const [end,high]=scale[i],[start,low]=scale[i-1];
  if(raw<=end)return Math.round(Math.max(1,low+(raw-start)/(end-start)*(high-low)));
 }
 return 124;
}
// Pitch velocity and the combined breaking-ball index have higher floors than
// batting abilities. Calibrate their weighted score before the shared OVR scale.
// Fixed against the 2026 Wiki roster distribution; acquiring or training another
// card must never change this player's score. Raw skills and growth stay intact.
export function overallAbilityScore(p:Player,r:Ratings=p.ratings):number{
 const raw=baseAbilityScore(p,r);
 if(p.role!=='pitcher')return raw;
 const scale=[[0,0],[40,32],[66,58],[80,76],[90,84],[99,99]];
 for(let i=1;i<scale.length;i++){
  const [end,high]=scale[i],[start,low]=scale[i-1];
  if(raw<=end)return low+(raw-start)/(end-start)*(high-low);
 }
 return 99;
}
// Late stages require several seasons of investment, while the first stage
// remains attainable in the opening season. Existing stages are never repriced.
export const awakeningCosts=[600,1800,5400,16200,48600] as const;
export const stageNames=['未覚醒','芽生え','躍進','開花','飛躍','完全覚醒'];
export function growthProfile(p:Player){
 const age=playerAge(p),rookie=isRookie(p),ovr=baseAbilityScore(p),evidence=evidenceFor(p);
 const ageCurve=[[18,1],[21,.96],[23,.86],[25,.72],[27,.54],[29,.36],[31,.20],[33,.10],[36,.05],[50,.03]];
 let youth=age===null?.28:1;
 if(age!==null)for(let i=1;i<ageCurve.length;i++){const [end,high]=ageCurve[i],[start,low]=ageCurve[i-1];if(age<=end){youth=low+(bound(age,start,end)-start)/(end-start)*(high-low);break;}youth=.03;}
 const yearsSinceDraft=evidence?.draft.year?Math.max(0,2026-evidence.draft.year-1):null;
 const draftWeight=yearsSinceDraft===null?0:Math.max(.08,1-yearsSinceDraft/9);
 const draft=draftExpectation(evidence?.draft),performance=performanceExpectation(p).value;
 const tools=p.role==='pitcher'?[bound((p.ratings.velocity-125)*2.5,15,99),p.ratings.control,p.ratings.breaking]:[p.ratings.contact,p.ratings.power,p.ratings.speed,p.ratings.arm,p.ratings.field];
 tools.sort((a,b)=>b-a);const toolSignal=bound((tools[0]*.6+tools[1]*.4-35)/60,0,1);
 const expectation=bound(.5+(draft-.5)*.64*draftWeight+(performance-.5)*.6+(toolSignal-.5)*.14,.15,.96);
 const experience=p.role==='pitcher'?(evidence?.pitching.reduce((n,s)=>n+s.bf,0)??p.pitching?.bf??0):(evidence?.batting.reduce((n,s)=>n+s.pa,0)??p.batting?.pa??0);
 const established=bound(experience/(p.role==='pitcher'?6000:4000),0,1);
 const room=bound((88-ovr)/40,.05,1),factor=bound(youth*(.25+.85*expectation)*(.6+.4*room)*(1-established*.12),.015,.96);
 return {age,rookie,factor,expectation,draft,performance,label:rookie?'ルーキー':age!==null&&age<=25?'若手':age!==null&&age>=32?'ベテラン':'中堅'};
}
export function developedRatings(p:Player,stage=0,bonus=0):Ratings{
 const r={...p.ratings},progress=[0,.12,.28,.48,.72,1][bound(Math.trunc(stage),0,5)],{factor,expectation}=growthProfile(p);
 // A small late-stage breakthrough rewards strong draft/performance evidence.
 // It affects real match abilities, while preserving role and physical tools.
 const breakthrough=bound((expectation-.70)/.20,0,1)*factor*5*progress*progress;
 const relevant:(keyof Ratings)[]=p.role==='batter'?['contact','power','speed','arm','field','catching']:p.mlb?.twoWay?['control','stamina','breaking','contact','power','speed','field','arm','catching']:['control','stamina','breaking','field','arm','catching'];
 const peak=Math.max(...relevant.map(k=>r[k]));
 const relief=p.role==='pitcher'&&(p.wikiAssessment?p.wikiAssessment.pitcherRoles['先']!=='◎'&&p.wikiAssessment.pitcherRoles['先']!=='○':(p.pitching?.outs??0)/Math.max(1,p.pitching?.games??0)<12)&&p.ratings.stamina<60;
 for(const key of Object.keys(r) as (keyof Ratings)[]){
  if(key==='velocity')continue; // Keep the researched km/h value.
  // Physical tools and a reliever's workload retain their identity after growth.
  const target=bound(94-(peak-r[key])*.48,60,96),specialty=key==='speed'?.4:key==='arm'?.55:key==='stamina'&&relief?.35:key==='field'||key==='catching'?.9:1;
  const growth=relevant.includes(key)?Math.max(1,(target-r[key])*factor*specialty):1;
  r[key]=bound(Math.round(r[key]+Math.max(0,growth)*progress+(relevant.includes(key)?breakthrough*specialty:0))+bonus,0,99);
 }
 return r;
}
export function ownedRatings(p:Player,owned:Record<string,number>,training:Record<string,number>={}):Ratings{
 return developedRatings(p,training[p.id]??0,Math.min(5,Math.max(0,(owned[p.id]??1)-1)));
}
