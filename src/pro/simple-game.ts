import {canBat,fitsPosition,playerMap,players,type Player} from './data';
import {rng,type GameState} from './engine';
import {claimAllMilestones} from './franchise';
import {claimSeasonGoals} from './ambitions';
import {DRAFT_ROOKIE_CHANCE,draftEventActive,draftRookiePool} from './draft-event';

export const SIMPLE_SCOUT_COST=3000;
export const MLB_SCOUT_CHANCE=.02;
export const MLB_GUARANTEE_EVERY=30;
export const mlbScoutCountdown=(s:GameState)=>MLB_GUARANTEE_EVERY-s.pulls%MLB_GUARANTEE_EVERY;
const majorPool=players.filter(p=>p.mlb),domesticPool=players.filter(p=>!p.mlb);

// Existing saves keep their players, training, results and reward claim IDs.
// The simplified game never consults card rarity, pity or scout themes.
export function collectSimpleRewards(input:GameState):GameState {
 const state=claimSeasonGoals(claimAllMilestones(input));
 // Retire saved free-scout stock without changing the wallet or owned cards.
 return state.franchise.tickets?{...state,franchise:{...state.franchise,tickets:0}}:state;
}

// `now` enables the limited-time draft event; tests and old callers pass nothing and keep the normal odds.
export function drawSimplePlayer(input:GameState,now:Date|null=null):GameState {
 if(input.gems<SIMPLE_SCOUT_COST)return input;
 const state=structuredClone(input),random=rng(state.seed);
 const guaranteed=(state.pulls+1)%MLB_GUARANTEE_EVERY===0;
 const major=guaranteed||random.next()<MLB_SCOUT_CHANCE;
 const missing=majorPool.filter(p=>!state.owned[p.id]);
 const rookie=!major&&draftEventActive(now)&&random.next()<DRAFT_ROOKIE_CHANCE;
 const pool=major?(guaranteed&&missing.length?missing:majorPool):rookie?draftRookiePool:domesticPool;
 const player=pool[Math.floor(random.next()*pool.length)];
 const copies=(state.owned[player.id]??0)+1,trainingReward=copies>6?80:0;
 state.gems-=SIMPLE_SCOUT_COST;state.pulls++;state.franchise.tickets=0;
 state.owned[player.id]=copies;state.gems+=trainingReward;
 state.seed=random.state;state.pity=0;
 state.lastPulls=[{playerId:player.id,copies,isNew:copies===1,guaranteed,trainingReward}];
 return collectSimpleRewards(state);
}

export function replacementPool(state:GameState,kind:'bat'|'pit',slot:number):Player[]{
 const ids=kind==='bat'?state.lineup:state.pitchers,current=ids[slot];
 if(!current)return [];
 return Object.keys(state.owned).map(id=>playerMap[id]).filter(p=>p.id===current||(!ids.includes(p.id)&&(kind==='pit'?p.role==='pitcher':canBat(p)&&fitsPosition(p,state.defense[current]))));
}
export function replaceSimplePlayer(input:GameState,kind:'bat'|'pit',slot:number,id:string):GameState {
 if(!replacementPool(input,kind,slot).some(p=>p.id===id))return input;
 const ids=kind==='bat'?input.lineup:input.pitchers,old=ids[slot];
 if(old===id)return input;
 if(kind==='pit')return {...input,pitchers:ids.map((v,i)=>i===slot?id:v)};
 const defense={...input.defense,[id]:input.defense[old]};delete defense[old];
 return {...input,lineup:ids.map((v,i)=>i===slot?id:v),defense};
}

export function equipTwoWayPlayer(input:GameState,id:string):GameState {
 if(!input.owned[id]||!playerMap[id]?.mlb?.twoWay)return input;
 let state=input;
 const dh=state.lineup.findIndex(other=>state.defense[other]==='DH');
 if(!state.lineup.includes(id))state=replaceSimplePlayer(state,'bat',dh,id);
 else if(state.defense[id]!=='DH')state=swapDefense(state,id,state.lineup[dh]);
 if(!state.pitchers.includes(id))state=replaceSimplePlayer(state,'pit',0,id);
 return state;
}
export function moveSimplePlayer(input:GameState,kind:'bat'|'pit',from:number,to:number):GameState {
 const ids=[...(kind==='bat'?input.lineup:input.pitchers)];
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=ids.length||to>=ids.length)return input;
 [ids[from],ids[to]]=[ids[to],ids[from]];
 return kind==='bat'?{...input,lineup:ids}:{...input,pitchers:ids};
}

// Reordering changes batting order only; field assignments travel with the player.
export function reorderSimplePlayer(input:GameState,kind:'bat'|'pit',from:number,to:number):GameState{
 const ids=[...(kind==='bat'?input.lineup:input.pitchers)];
 if(!Number.isInteger(from)||!Number.isInteger(to)||from===to||from<0||to<0||from>=ids.length||to>=ids.length)return input;
 const [id]=ids.splice(from,1);ids.splice(to,0,id);
 return kind==='bat'?{...input,lineup:ids}:{...input,pitchers:ids};
}
// Both roles are exchanged so the field always contains a complete nine.
export function swapDefense(input:GameState,first:string,second:string):GameState{
 if(first===second||!input.lineup.includes(first)||!input.lineup.includes(second))return input;
 return {...input,defense:{...input.defense,[first]:input.defense[second],[second]:input.defense[first]}};
}
