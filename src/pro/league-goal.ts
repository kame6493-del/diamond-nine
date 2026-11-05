import type {GameState} from './engine';
import {circuitOf,leagueProgress,NPB_TITLES_TO_MLB,spaceUnlocked} from './leagues';
import {recordAchievements} from './achievements';

/** 上のリーグへの挑戦の目標(国内 → 海外 → 宇宙)。表示だけで、解放の判定は leagues.ts の仕組みそのもの。 */
export interface LeagueGoal {
 stage:'npb'|'mlb'|'space'|'done';
 title:string;      // 例: 海外リーグに挑戦
 condition:string;  // 例: 国内リーグで3年連続優勝
 value:number;goal:number;
 note:string;       // 今の進み具合の一言
 ready:boolean;     // 条件を満たし、挑戦を選べる
}

export function leagueGoal(state:GameState):LeagueGoal{
 const progress=leagueProgress(state),circuit=circuitOf(state.season),records=recordAchievements(state).achievements??{};
 if(!progress.mlbUnlocked){
  const streak=progress.npbStreak;
  return {stage:'npb',title:'海外リーグに挑戦',condition:`国内リーグで${NPB_TITLES_TO_MLB}年連続優勝`,value:streak,goal:NPB_TITLES_TO_MLB,ready:false,
   note:streak?`いま${streak}年連続優勝中。あと${NPB_TITLES_TO_MLB-streak}回`:'リーグ優勝(レギュラーシーズン1位)を続けよう'};
 }
 if(!spaceUnlocked(state)){
  return {stage:'mlb',title:'宇宙リーグに挑戦',condition:'海外リーグで世界一決定戦に優勝',value:0,goal:1,ready:false,
   note:circuit==='NPB'?'海外リーグに挑戦できます(メニューのリーグ挑戦から)':'海外リーグで頂点を目指そう'};
 }
 if(records.spaceChampion===undefined){
  return {stage:'space',title:'宇宙の頂点へ',condition:'宇宙リーグで宇宙一決定戦に優勝',value:0,goal:1,ready:false,
   note:circuit==='SPACE'?'宇宙リーグで頂点を目指そう':'宇宙リーグに挑戦できます'};
 }
 return {stage:'done',title:'すべてのリーグを制覇',condition:'宇宙一決定戦 優勝済み',value:1,goal:1,ready:true,note:`${records.spaceChampion}年目に宇宙一`};
}

// ---- ホームの一番上の大きな目標(2026-11-05 持ち主「目標は大きく書いて。目的が分かるように。例えば国内リーグなら3年連続優勝とか」) ----
// 中身は上の leagueGoal(=ゲームの中の昇格・解放の条件)そのもの。言葉だけ分かりやすくする。新しい条件は作らない。
export interface GoalHeadline {stage:LeagueGoal['stage'];title:string;sub:string;meterLabel:string;value:number;goal:number;done:boolean;left:number|null;unit:string}
export function goalHeadline(state:GameState):GoalHeadline{
 const g=leagueGoal(state),circuit=circuitOf(state.season);
 if(g.stage==='npb'){
  const left=Math.max(0,g.goal-g.value);
  return {stage:g.stage,title:`国内リーグ ${g.goal}年連続優勝`,sub:'レギュラーシーズン1位を3年続けると、海外リーグに挑戦できます',meterLabel:'連続優勝',value:g.value,goal:g.goal,done:false,left,unit:'年'};
 }
 if(g.stage==='mlb')return {stage:g.stage,title:'世界一決定戦で優勝して宇宙リーグへ',sub:circuit==='NPB'?'海外リーグに挑戦できます(メニューのリーグ挑戦から)':'海外リーグのポストシーズンを勝ち抜こう',meterLabel:'世界一',value:0,goal:1,done:false,left:null,unit:''};
 if(g.stage==='space')return {stage:g.stage,title:'宇宙一決定戦で優勝',sub:circuit==='SPACE'?'宇宙リーグのポストシーズンを勝ち抜こう':'宇宙リーグに挑戦できます(メニューのリーグ挑戦から)',meterLabel:'宇宙一',value:0,goal:1,done:false,left:null,unit:''};
 return {stage:g.stage,title:'すべてのリーグを制覇',sub:g.note,meterLabel:'制覇',value:1,goal:1,done:true,left:null,unit:''};
}
/** 目標の一覧(いまの段階・次・その先)。押すと見られる。 */
export function goalLadder(state:GameState):{stage:'npb'|'mlb'|'space';title:string;reward:string;status:'done'|'now'|'next'}[]{
 const order=['npb','mlb','space','done'] as const,now=order.indexOf(leagueGoal(state).stage);
 const list=[{stage:'npb' as const,title:`国内リーグ ${NPB_TITLES_TO_MLB}年連続優勝`,reward:'海外リーグに挑戦できる'},{stage:'mlb' as const,title:'海外リーグで世界一決定戦に優勝',reward:'宇宙リーグに挑戦できる'},{stage:'space' as const,title:'宇宙リーグで宇宙一決定戦に優勝',reward:'すべてのリーグを制覇'}];
 return list.map((x,i)=>({...x,status:i<now?'done':i===now?'now':'next'}));
}
