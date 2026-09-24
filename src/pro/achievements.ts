import type {GameState} from './engine';
import {circuitOf,wonNpbLeague} from './leagues';

export const achievementNames={npbLeague:'リーグ優勝',npbChampion:'日本一',mlbEntry:'海外リーグ挑戦',worldChampion:'世界王座決定戦優勝',spaceEntry:'宇宙リーグ挑戦',spaceChampion:'宇宙王座決定戦優勝'} as const;
export type AchievementId=keyof typeof achievementNames;
export type Achievements=Partial<Record<AchievementId,number>>;
// Keep milestones after the rolling season archive expires. Legacy saves only
// contribute verifiable seasons; do not claim an unknown earlier first title.
export function recordAchievements(input:GameState):GameState{
 const records:Achievements={...input.achievements};
 const add=(id:AchievementId,year:number)=>{records[id]=Math.min(records[id]??year,year);};
 for(const season of [...input.history,...(input.parkedSeason?[input.parkedSeason]:[]),...(input.additionalParkedSeasons??[]),input.season]){
  if(circuitOf(season)==='SPACE')add('spaceEntry',season.number);
  if(circuitOf(season)==='MLB')add('mlbEntry',season.number);
  if(wonNpbLeague(season,input.club))add('npbLeague',season.number);
  if(season.completed&&season.postseason?.stage==='complete'&&season.postseason.champion===input.club)add(circuitOf(season)==='SPACE'?'spaceChampion':circuitOf(season)==='MLB'?'worldChampion':'npbChampion',season.number);
 }
 return JSON.stringify(records)===JSON.stringify(input.achievements)?input:{...input,achievements:records};
}
