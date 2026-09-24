import type {Player,Ratings} from './data';

export type PitcherRole='先'|'中'|'抑';
export const pitcherSlotRole=(index:number):PitcherRole=>index<6?'先':index===11?'抑':'中';
export function pitcherRolePenalty(player:Player,role:PitcherRole):number{
 const roles=player.wikiAssessment?.pitcherRoles;
 if(roles&&Object.keys(roles).length){
  const fit=roles[role];
  return fit==='◎'||fit==='○'?0:fit==='△'?5:12;
 }
 // Missing published aptitudes use workload and relief experience, not age or overall.
 const q=player.pitching,starter=q&&q.games>0?q.outs/q.games>=12:player.ratings.stamina>=60;
 if(role==='先')return starter?0:12;
 if(role==='中')return starter?5:0;
 return (q?.saves??0)>0?0:starter?12:5;
}
export function pitchingRatingsForRole(player:Player,ratings:Ratings,role?:PitcherRole):Ratings{
 const penalty=role?pitcherRolePenalty(player,role):0;
 if(!penalty)return ratings;
 return {...ratings,control:Math.max(0,ratings.control-penalty),breaking:Math.max(0,ratings.breaking-penalty),stamina:Math.max(0,ratings.stamina-(role==='先'?penalty*2:penalty))};
}
