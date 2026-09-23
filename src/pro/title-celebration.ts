import type {GameState} from './engine';
import {recordAchievements} from './achievements';
import {circuitOf,leagueProgress,NPB_TITLES_TO_MLB,wonNpbLeague} from './leagues';

export interface TitleCelebration {
 kind:'mlb-unlocked'|'world-champion';
 year:number;
 clubName:string;
}

// Called only after playing games, never when loading a save or viewing an archive.
// Durable achievement/access records prevent repeat ceremonies even after old
// seasons leave the rolling archive. The presentation does not alter game state.
export function firstTitleCelebration(before:GameState,after:GameState):TitleCelebration|null{
 if(before.club!==after.club||before.season.number!==after.season.number||circuitOf(before.season)!==circuitOf(after.season))return null;
 const season=after.season,common={year:season.number,clubName:after.name};
 if(circuitOf(season)==='MLB'){
  const alreadyWon=recordAchievements(before).achievements?.worldChampion!==undefined;
  if(!alreadyWon&&season.completed&&season.postseason?.stage==='complete'&&season.postseason.champion===after.club)return {...common,kind:'world-champion'};
 }else{
  const previous=leagueProgress(before),current=leagueProgress(after);
  if(!previous.mlbUnlocked&&current.mlbUnlocked&&current.npbStreak>=NPB_TITLES_TO_MLB&&wonNpbLeague(season,after.club))return {...common,kind:'mlb-unlocked'};
 }
 return null;
}
