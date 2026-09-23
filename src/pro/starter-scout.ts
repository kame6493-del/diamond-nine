import {players,playerMap} from './data';
import {ratingOverall} from './development';
import type {GameState} from './engine';

export interface StarterScoutState {version:1;choices:string[];selected:string|null;completed:boolean}
export const STARTER_MIN_OVERALL=85;
// Strong NPB cards preserve the value of later MLB recruitment and awakening.
export const starterScoutPool=players.filter(p=>!p.mlb&&!p.provisional&&ratingOverall(p)>=STARTER_MIN_OVERALL);
const eligible=new Set(starterScoutPool.map(p=>p.id));

export function createStarterScout(seed:number):StarterScoutState {
 // Independent RNG: preparing the welcome offer does not consume paid draws.
 let random=(seed^0x9e3779b9)>>>0;
 const pool=starterScoutPool.map(p=>p.id),choices:string[]=[];
 for(let i=0;i<3;i++){
  random=(Math.imul(random,1664525)+1013904223)>>>0;
  choices.push(pool.splice(Math.floor(random/4294967296*pool.length),1)[0]);
 }
 return {version:1,choices,selected:null,completed:false};
}
export function validStarterScout(value:unknown,owned:Record<string,number>|undefined):value is StarterScoutState {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const s=value as StarterScoutState;
 return s.version===1&&Array.isArray(s.choices)&&s.choices.length===3&&new Set(s.choices).size===3&&s.choices.every(id=>eligible.has(id))&&typeof s.completed==='boolean'&&(s.selected===null?!s.completed:typeof s.selected==='string'&&s.choices.includes(s.selected)&&!!owned?.[s.selected]&&!!playerMap[s.selected]);
}
export const starterScoutActive=(state:GameState)=>!!state.starterScout&&!state.starterScout.completed;
export function pickStarterCard(state:GameState,index:number):GameState {
 const offer=state.starterScout;
 if(!offer||!validStarterScout(offer,state.owned)||offer.completed||offer.selected!==null||!Number.isInteger(index)||index<0||index>2)return state;
 const id=offer.choices[index];
 return {...state,owned:{...state.owned,[id]:(state.owned[id]??0)+1},starterScout:{...offer,selected:id}};
}
export function finishStarterScout(state:GameState):GameState {
 if(!state.starterScout?.selected||state.starterScout.completed)return state;
 return {...state,starterScout:{...state.starterScout,completed:true}};
}
