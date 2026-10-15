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
  return {stage:'mlb',title:'宇宙リーグに挑戦',condition:'海外リーグで世界王座決定戦に優勝',value:0,goal:1,ready:false,
   note:circuit==='NPB'?'海外リーグに挑戦できます(メニューのリーグ挑戦から)':'海外リーグで頂点を目指そう'};
 }
 if(records.spaceChampion===undefined){
  return {stage:'space',title:'宇宙の頂点へ',condition:'宇宙リーグで宇宙王座決定戦に優勝',value:0,goal:1,ready:false,
   note:circuit==='SPACE'?'宇宙リーグで頂点を目指そう':'宇宙リーグに挑戦できます'};
 }
 return {stage:'done',title:'すべてのリーグを制覇',condition:'宇宙王座決定戦 優勝済み',value:1,goal:1,ready:true,note:`${records.spaceChampion}年目に宇宙一`};
}
