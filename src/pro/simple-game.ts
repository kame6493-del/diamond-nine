import {canBat,fitsPosition,playerMap,players,type Player} from './data';
import {rng,type GameState} from './engine';
import {claimAllMilestones} from './franchise';
import {claimSeasonGoals} from './ambitions';
import {DRAFT_ROOKIE_CHANCE,draftEventActive,draftRookiePool} from './draft-event';
import {scoutPresentation} from './scout-presentation';

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
export const SCOUT_BATTER_SHARE=.6;
export const SCOUT_BATCH_MAX=10;
export const SCOUT_UPGRADE_CHANCE=.35;
// Average overall of the regulars: the nine-man lineup for batters, the 14-arm staff for pitchers.
export const upgradeFloor=(state:GameState,arm:boolean)=>{const o=(arm?state.pitchers:state.lineup).map(id=>playerMap[id]?.overall??0);return o.reduce((n,x)=>n+x,0)/Math.max(1,o.length);};
// 10連(2026-10-16): 10回分の 30,000pt で10枚。1〜9枚目に金カード以上が無ければ、10枚目は
// 金カード以上が確定(海外2%の抽選は通常どおり先に行い、外れたら総合85以上の国内選手から同じ確率)。
// 1枚ごとの確率・海外確定(30回ごと)の数え方は1枚引くと同じ。値引きはしない(得は確定枠)。
export const SCOUT_TEN_COUNT=10;
export const SCOUT_TEN_COST=SIMPLE_SCOUT_COST*SCOUT_TEN_COUNT;
// 印刷される総合(重複・覚醒なし)で金カード以上になる国内選手。
export const domesticGoldPool=domesticPool.filter(p=>scoutPresentation(p).tier!=='standard');
export const isGoldOrBetter=(state:GameState,id:string)=>scoutPresentation(playerMap[id]??null,state.owned,state.training).tier!=='standard';
export function drawSimplePlayer(input:GameState,now:Date|null=null,goldFloor=false):GameState {
 if(input.gems<SIMPLE_SCOUT_COST)return input;
 const state=structuredClone(input),random=rng(state.seed);
 const guaranteed=(state.pulls+1)%MLB_GUARANTEE_EVERY===0;
 const major=guaranteed||random.next()<MLB_SCOUT_CHANCE;
 const missing=majorPool.filter(p=>!state.owned[p.id]);
 const rookie=!major&&draftEventActive(now)&&random.next()<DRAFT_ROOKIE_CHANCE;
 const gold=goldFloor&&!major&&domesticGoldPool.length>0;
 const pool=major?(guaranteed&&missing.length?missing:majorPool):gold?domesticGoldPool:rookie?draftRookiePool:domesticPool;
 // Starting clubs are weakest at the plate, and half of the domestic pool is arms,
 // so ordinary draws lean toward batters. Guaranteed and rookie draws keep their pools.
 const wantArm=random.next()>=SCOUT_BATTER_SHARE,leaned=major||rookie||gold?pool:pool.filter(p=>(p.role==='pitcher')===wantArm);
 // An upgrade draw picks only from players better than the club's weakest regular
 // of that kind, so scouting keeps paying off after the roster stops being bad.
 const upgrade=!major&&!rookie&&!gold&&random.next()<SCOUT_UPGRADE_CHANCE,floor=upgradeFloor(state,wantArm);
 const better=upgrade?leaned.filter(p=>p.overall>floor):[];
 const from=better.length?better:leaned.length?leaned:pool,player=from[Math.floor(random.next()*from.length)];
 const copies=(state.owned[player.id]??0)+1,trainingReward=copies>6?80:0;
 state.gems-=SIMPLE_SCOUT_COST;state.pulls++;state.franchise.tickets=0;
 state.owned[player.id]=copies;state.gems+=trainingReward;
 state.seed=random.state;state.pity=0;
 state.lastPulls=[{playerId:player.id,copies,isNew:copies===1,guaranteed:guaranteed||gold,trainingReward}];
 return collectSimpleRewards(state);
}
// 30,000pt が無ければ何もしない(途中で足りなくなって9枚で止まることはない)。
export function drawTenPlayers(input:GameState,now:Date|null=null):GameState {
 if(input.gems<SCOUT_TEN_COST)return input;
 let state=input,hit=false;const pulls:GameState['lastPulls']=[];
 for(let i=0;i<SCOUT_TEN_COUNT;i++){
  // 引いたその時のカードの色で数える(画面の演出と同じ)。
  state=drawSimplePlayer(state,now,i===SCOUT_TEN_COUNT-1&&!hit);pulls.push(state.lastPulls[0]);
  hit=hit||isGoldOrBetter(state,state.lastPulls[0].playerId);
 }
 return {...state,lastPulls:pulls};
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
