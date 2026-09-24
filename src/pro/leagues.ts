import {teams} from './data';
import {mlbLeagueTeams} from './mlb-opponents';
import {spaceTeams} from './display-names';
import type {GameState,Season,Standing} from './engine';

export type Circuit='NPB'|'MLB'|'SPACE';
// Keep persisted circuit IDs stable; public league names are presentation only.
export const circuitLabel=(circuit:Circuit)=>circuit==='SPACE'?'宇宙リーグ':circuit==='MLB'?'海外リーグ':'国内リーグ';
export const NPB_TITLES_TO_MLB=3;
export interface LeagueProgress {basis?:'league';npbStreak:number;mlbUnlocked:boolean;lastSettledSeason:number}
export const circuitOf=(s:Season):Circuit=>s.circuit??'NPB';
export const seasonGames=(s:Season)=>circuitOf(s)!=='NPB'?162:143;
export const titleFor=(s:Season)=>circuitOf(s)==='SPACE'?'宇宙王座決定戦優勝':circuitOf(s)==='MLB'?'世界王座決定戦優勝':'日本一';
// The custom club occupies the Athletics' AL West slot. The other 29 clubs
// retain their real divisions. This is a game schedule, not the official slate.
export const leagueTeams=(s:Season)=>circuitOf(s)!=='NPB'?mlbLeagueTeams.map(t=>t.id==='mlb-133'?{...t,id:s.club??'t'}:circuitOf(s)==='SPACE'?{...t,...spaceTeams[t.id]}:t):teams.map(t=>({...t,division:t.league==='CENTRAL'?1:2}));
export const leagueFor=(s:Season,id:string)=>leagueTeams(s).find(t=>t.id===id)!.league;
const roundRobin=(ids:string[])=>{
 const ring=[...ids],rounds:[string,string][][]=[];
 for(let r=0;r<ids.length-1;r++){rounds.push(Array.from({length:ids.length/2},(_,i)=>[ring[i],ring[ids.length-1-i]]));ring.splice(1,0,ring.pop()!);}
 return rounds;
};
const majorRounds=roundRobin(mlbLeagueTeams.map(t=>t.id));
const majorSchedule=(()=>{
 const days=Array.from({length:162},(_,day)=>majorRounds[day%29].map(pair=>[...pair] as [string,string]));
 const edges=days.flat(),adj=new Map<string,{id:number;other:string}[]>();
 edges.forEach(([a,b],id)=>{for(const [from,other] of [[a,b],[b,a]]){const list=adj.get(from)??[];list.push({id,other});adj.set(from,list);}});
 const used=new Set<number>(),stack=[edges[0][0]];
 // Orient the even-degree multigraph so every club has 81 home / 81 away.
 while(stack.length){const at=stack.at(-1)!,list=adj.get(at)!;while(list.length&&used.has(list.at(-1)!.id))list.pop();const edge=list.pop();if(!edge){stack.pop();continue;}used.add(edge.id);edges[edge.id]=[at,edge.other];stack.push(edge.other);}
 return days.map((_,day)=>edges.slice(day*15,day*15+15));
})();
export const mlbSchedule=(club:string)=>majorSchedule.map(day=>day.map(pair=>pair.map(id=>id==='mlb-133'?club:id) as [string,string]));
export const standingOrder=(a:Standing,b:Standing)=>b.w/Math.max(1,b.w+b.l)-a.w/Math.max(1,a.w+a.l)||b.w-a.w||(b.rf-b.ra)-(a.rf-a.ra)||a.team.localeCompare(b.team);
export function wonNpbLeague(season:Season,club:string):boolean{
 if(circuitOf(season)!=='NPB'||!season.completed||season.day!==seasonGames(season))return false;
 const league=leagueFor(season,club),members=leagueTeams(season).filter(t=>t.league===league);
 const table=season.standings.filter(t=>members.some(m=>m.id===t.team)).sort(standingOrder);
 // Only final, fully played standings establish a league title. Postseason
 // winners and an old Japan-Series streak are not evidence of a league title.
 return table.length===members.length&&table.every(t=>t.w+t.l+t.d===seasonGames(season))&&table[0].team===club;
}
export function playoffSeeds(s:Season,league:string):Standing[]{
 const members=leagueTeams(s).filter(t=>t.league===league),rows=s.standings.filter(t=>members.some(m=>m.id===t.team)).sort(standingOrder);
 const winners=[...new Set(members.map(t=>t.division))].map(d=>rows.find(r=>members.some(m=>m.id===r.team&&m.division===d))!).sort(standingOrder);
 return [...winners,...rows.filter(r=>!winners.includes(r)).slice(0,3)];
}
export function leagueProgress(state:GameState):LeagueProgress{
 const saved=state.leagueProgress;
 const progress:LeagueProgress=saved?.basis==='league'?{...saved}:{basis:'league',npbStreak:0,mlbUnlocked:saved?.mlbUnlocked??false,lastSettledSeason:0};
 const seasons=[...state.history,state.season].filter(s=>s.completed&&s.day===seasonGames(s)).sort((a,b)=>a.number-b.number);
 // Rebuild legacy progress from retained regular-season standings, while
 // preserving MLB access already earned under earlier rules.
 let archivedRun=0,previousSeason=0;
 for(const season of seasons){
  const won=wonNpbLeague(season,state.club);
  archivedRun=won?(season.number===previousSeason+1?archivedRun:0)+1:0;
  previousSeason=season.number;
  progress.mlbUnlocked||=archivedRun>=NPB_TITLES_TO_MLB;
  if(season.number<=progress.lastSettledSeason)continue;
  if(circuitOf(season)==='NPB'){
   const consecutive=season.number===progress.lastSettledSeason+1;
   progress.npbStreak=won?Math.min(NPB_TITLES_TO_MLB,(consecutive?progress.npbStreak:0)+1):0;
   progress.mlbUnlocked||=progress.npbStreak>=NPB_TITLES_TO_MLB;
  }else progress.mlbUnlocked=true;
  progress.lastSettledSeason=season.number;
 }
 return progress;
}
export function settleLeagueProgress(state:GameState):GameState {
 const next=leagueProgress(state);if(state.leagueProgress&&JSON.stringify(next)===JSON.stringify(state.leagueProgress))return state;
 return {...state,leagueProgress:next};
}

export function spaceUnlocked(state:GameState):boolean{
 return !!state.achievements?.worldChampion||[...(Array.isArray(state.history)?state.history:[]),...(state.parkedSeason?[state.parkedSeason]:[]),...(state.additionalParkedSeasons??[]),state.season].some(s=>s&&circuitOf(s)==='MLB'&&s.completed&&s.postseason?.stage==='complete'&&s.postseason.champion===state.club);
}
