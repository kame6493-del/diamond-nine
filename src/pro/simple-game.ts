import {canBat,fitsPosition,playerMap,players,type Player} from './data';
import {rng,type GameState} from './engine';
import {claimAllMilestones} from './franchise';
import {claimSeasonGoals} from './ambitions';
import {ratingOverall} from './development';

export const SIMPLE_SCOUT_COST=3000;
export const DUPLICATE_POINTS=300;
// 2026-11-03 vc41 持ち主「高レア選手に関してはもうちょいガチャから低確率で出るように」「海外選手に関しては確定までのガチャは無いように」
// 「ルーキーとかは無くして・ドラフト会議ウィークはなくして」。
// 段(レア度は覚醒前のカードの総合で決める。演出の 虹=95以上・金=85以上と海外 と同じ線)ごとに確率を決め、段の中は全員同じ確率。
// 前(vc33〜40): 国内98%を全員同じ・海外2%・30回ごとに未所持の海外選手が確定。後: 下の表。30回ごとの確定は無い。
export const SCOUT_BANDS=[
 {id:'mlbRainbow',label:'海外・虹カード',detail:'海外リーグ・総合95以上',rate:.0025},
 {id:'mlbGold',label:'海外・金カード',detail:'海外リーグ・総合94以下',rate:.01},
 {id:'domRainbow',label:'国内・虹カード',detail:'国内リーグ・総合95以上',rate:.0005},
 {id:'domGold',label:'国内・金カード',detail:'国内リーグ・総合85〜94',rate:.0135},
 {id:'domStandard',label:'国内・カード',detail:'国内リーグ・総合84以下',rate:.9735},
] as const;
export type ScoutBandId=typeof SCOUT_BANDS[number]['id'];
export const scoutBandOf=(p:Player):ScoutBandId=>{const o=ratingOverall(p);return p.mlb?(o>=95?'mlbRainbow':'mlbGold'):o>=95?'domRainbow':o>=85?'domGold':'domStandard';};
export const scoutBandPools:Record<ScoutBandId,Player[]>={mlbRainbow:[],mlbGold:[],domRainbow:[],domGold:[],domStandard:[]};
for(const p of players)scoutBandPools[scoutBandOf(p)].push(p);
/** 海外の合計(1.25%)。 */
export const MLB_SCOUT_CHANCE=SCOUT_BANDS.filter(b=>b.id.startsWith('mlb')).reduce((n,b)=>n+b.rate,0);
// Existing saves keep their players, training, results and reward claim IDs.
// The simplified game never consults card rarity, pity or scout themes.
export function collectSimpleRewards(input:GameState):GameState {
 const state=claimSeasonGoals(claimAllMilestones(input));
 // Retire saved free-scout stock without changing the wallet or owned cards.
 return state.franchise.tickets?{...state,franchise:{...state.franchise,tickets:0}}:state;
}

// 2026-11-01 持ち主「補強ブーストみたいなのはやめて」: 補強チャンス(35%)と野手寄せ(60/40)は外したまま。チームの強さ・課金・パスで確率は変わらない。
// Average overall of the regulars (used by the scout screen's "補強したい所" list only; it does not change the odds).
export const upgradeFloor=(state:GameState,arm:boolean)=>{const o=(arm?state.pitchers:state.lineup).map(id=>playerMap[id]?.overall??0);return o.reduce((n,x)=>n+x,0)/Math.max(1,o.length);};
/** 提供割合。抽選(drawSimplePlayer)と表示の両方がこれを使う。引数は前の形のまま(どの状態・日時でも同じ数)。 */
export function scoutOdds(_state?:GameState,_now?:Date|null){
 const bands=SCOUT_BANDS.map(b=>({...b,count:scoutBandPools[b.id].length,each:b.rate/Math.max(1,scoutBandPools[b.id].length)}));
 return {guaranteed:false as const,mlb:MLB_SCOUT_CHANCE,domestic:1-MLB_SCOUT_CHANCE,bands};
}
/** 選手1人ごとの確率(テストで表示と突き合わせる)。 */
export function scoutPlayerOdds(state?:GameState,now?:Date|null):Map<string,number>{
 const m=new Map<string,number>();
 for(const b of scoutOdds(state,now).bands)for(const p of scoutBandPools[b.id])m.set(p.id,b.each);
 return m;
}
export function drawSimplePlayer(input:GameState,_now:Date|null=null):GameState {
 if(input.gems<SIMPLE_SCOUT_COST)return input;
 const state=structuredClone(input),random=rng(state.seed);
 let roll=random.next(),band:ScoutBandId='domStandard';
 for(const b of SCOUT_BANDS){if(roll<b.rate){band=b.id;break;}roll-=b.rate;}
 const from=scoutBandPools[band];
 const player=from[Math.floor(random.next()*from.length)];
 // 2026-10-30 夜: 7枚目以降の換金 80 → 300pt(たくさん引くと重なるため)。
 const copies=(state.owned[player.id]??0)+1,trainingReward=copies>6?DUPLICATE_POINTS:0;
 state.gems-=SIMPLE_SCOUT_COST;state.pulls++;state.franchise.tickets=0;
 state.owned[player.id]=copies;state.gems+=trainingReward;
 // 古いセーブの pity(前の版の天井の数)は読めるが使わない。毎回0にする。
 state.seed=random.state;state.pity=0;
 state.lastPulls=[{playerId:player.id,copies,isNew:copies===1,guaranteed:false,trainingReward}];
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
