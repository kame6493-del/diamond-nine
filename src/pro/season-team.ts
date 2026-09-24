import {playerMap,rosterSlots,type Ratings} from './data';
import {ownedRatings,ratingOverall} from './development';
import type {GameState} from './engine';

export interface SnapshotPlayer {id:string;position:string;overall:number;ratings:Ratings}
export interface SeasonTeamSnapshot {version:1;name:string;batters:SnapshotPlayer[];pitchers:SnapshotPlayer[]}
export function captureSeasonTeam(state:GameState):SeasonTeamSnapshot{
 const card=(id:string,position:string):SnapshotPlayer=>{const p=playerMap[id],ratings=ownedRatings(p,state.owned,state.training);return {id,position,overall:ratingOverall(p,ratings),ratings};};
 return {version:1,name:state.name,batters:state.lineup.map(id=>card(id,state.defense[id])),pitchers:state.pitchers.map(id=>card(id,'投'))};
}
export function validSeasonTeam(value:unknown):value is SeasonTeamSnapshot{
 if(!value||typeof value!=='object')return false;
 const s=value as SeasonTeamSnapshot;
 const group=(rows:SnapshotPlayer[],length:number)=>Array.isArray(rows)&&rows.length===length&&new Set(rows.map(r=>r?.id)).size===length&&rows.every(r=>r&&playerMap[r.id]&&!playerMap[r.id].opponentOnly&&Number.isInteger(r.overall)&&r.overall>=1&&r.overall<=150&&r.ratings&&Object.keys(playerMap[r.id].ratings).every(k=>{const v=r.ratings[k as keyof Ratings];return Number.isFinite(v)&&v>=0&&v<=(k==='velocity'?170:99);}));
 return s.version===1&&typeof s.name==='string'&&s.name.length>0&&s.name.length<=30&&group(s.batters,9)&&(group(s.pitchers,12)||group(s.pitchers,14))&&s.batters.map(r=>r.position).sort().join(',')===[...rosterSlots].sort().join(',')&&s.pitchers.every(r=>r.position==='投'&&playerMap[r.id].role==='pitcher');
}
