import {playerMap} from './data';
import type {Season} from './engine';

export interface FieldingStats {
 playerId:string;team:string;games:number;ballsInPlay:number;
 rangeRuns:number;errorRuns:number;armRuns:number;
}
export interface FieldingSeason {version:1;games:Record<string,number>;players:Record<string,FieldingStats>}
export const emptyFielding=():FieldingSeason=>({version:1,games:{},players:{}});
export const fieldingRuns=(row:FieldingStats)=>row.rangeRuns+row.errorRuns+row.armRuns;
export function formatUZR(value:number|null):string{
 if(value===null)return '—';
 const rounded=Math.round(value*10)/10;
 return (rounded>0?'+':'')+(Object.is(rounded,-0)?0:rounded).toFixed(1);
}
export function playerSeasonUZR(season:Season,team:string,id:string):number|null{
 const row=season.fielding?.players[`${team}|${id}`];return row?fieldingRuns(row):null;
}
export function teamFieldingStats(season:Season,team:string){
 const games=season.fielding?.games[team]??0;
 const played=season.standings.find(t=>t.team===team),total=played?played.w+played.l+played.d:0;
 const runs=Object.values(season.fielding?.players??{}).filter(p=>p.team===team).reduce((n,p)=>n+fieldingRuns(p),0);
 return {uzr:games||total===0?runs:null,uzrGames:games};
}

// A game-only estimate, not a published UZR or a reconstruction of real batted
// ball zones. Accumulate the simulation's marginal defensive run prevention on
// actual balls in play / advancement attempts. Neutral fielding skill is 60;
// a hit/error prevented is valued at 0.75 runs. Range, error avoidance and arm
// are credited to the players actually fielding, with their current position
// penalties and development. No future ratings or real-world UZR are copied.
// No random draws: collecting this statistic must not change a game's outcome.
export function creditFieldingContact(row:FieldingStats,rangeDelta:number,errorDelta:number){
 row.ballsInPlay++;row.rangeRuns+=rangeDelta*.75;row.errorRuns+=errorDelta*.75;
}
export function validFieldingSeason(value:unknown,teams:string[],maxGames:number):boolean{
 if(value===undefined)return true; // Older saves have no fielding ledger.
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const f=value as FieldingSeason;
 const record=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v);
 if(f.version!==1||!record(f.games)||!record(f.players))return false;
 if(Object.entries(f.games).some(([team,n])=>!teams.includes(team)||!Number.isSafeInteger(n)||n<0||n>maxGames))return false;
 return Object.entries(f.players).every(([key,p])=>p&&!!playerMap[p.playerId]&&teams.includes(p.team)&&key===`${p.team}|${p.playerId}`&&Number.isSafeInteger(p.games)&&p.games>0&&p.games<=(f.games[p.team]??0)&&Number.isSafeInteger(p.ballsInPlay)&&p.ballsInPlay>=0&&['rangeRuns','errorRuns','armRuns'].every(k=>typeof p[k as keyof FieldingStats]==='number'&&Number.isFinite(p[k as keyof FieldingStats])));
}
