import {seasonGames} from './leagues';
import type { GameState } from './engine';
export interface Condition { playerId:string; boost:number; from:number; through:number }
// Independent deterministic stream: browsing, drawing cards, and batch size do not reroll form.
export function seasonConditions(state:GameState, day=state.season.day):Condition[] {
 const period=Math.floor(day/14), pool=[...new Set([...state.lineup,...state.pitchers])];
 let seed=((state.season.number*2654435761)^(period*2246822519))>>>0;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 const shuffled=[...pool];for(let i=shuffled.length-1;i>0;i--){const j=next()%(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 return shuffled.slice(0,3).map((playerId,i)=>({playerId,boost:i===2?-3:i===0?5:3,from:period*14+1,through:Math.min(seasonGames(state.season),(period+1)*14)}));
}
