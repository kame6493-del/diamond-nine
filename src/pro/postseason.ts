import {circuitOf,settleLeagueProgress,type Circuit} from './leagues';
import {recordAchievements} from './achievements';
import {newMLBPostseason,simulateMLBPostseason} from './mlb-postseason';
import { postseasonReward } from './progression';
import { emptySeason,playGame,rankings,rng,winPct,type BatStats,type GameResult,type GameState,type PitStats,type Season,type Standing } from './engine';

export type PostStage='first'|'final'|'japan'|'wildcard'|'division'|'championship'|'world'|'complete';
export interface PostSeries { id:string;stage:Exclude<PostStage,'complete'>;league:'CENTRAL'|'PACIFIC'|'JAPAN'|'AMERICAN'|'NATIONAL'|'WORLD';higher:string;lower:string;wins:[number,number];advantage:number;target:number;maxGames:number|null;results:GameResult[];winner:string|null }
export interface Postseason { circuit?:Circuit;version:1;stage:PostStage;day:number;series:PostSeries[];batting:Record<string,BatStats>;pitching:Record<string,PitStats>;standings:Standing[];champion:string|null;rewardClaimed:boolean }
export const stageLabel=(stage:PostStage)=>({first:'プレーオフ 1回戦',final:'プレーオフ 最終戦',japan:'国内王座決定戦',wildcard:'ワイルドカード',division:'地区シリーズ',championship:'リーグ優勝決定戦',world:'世界王座決定戦',complete:'シーズン完結'}[stage]);
export function finalFormat(higher:Standing,lower:Standing) {
 const gap=(higher.w-lower.w+lower.l-higher.l)/2;
 const advantage=gap>=10||winPct(lower)<.5?2:1;
 return {advantage,target:advantage===2?5:4,maxGames:advantage===2?7:6};
}
function createSeries(stage:PostSeries['stage'],league:PostSeries['league'],higher:string,lower:string,season:Season):PostSeries {
 const format=stage==='first'?{advantage:0,target:2,maxGames:3}:stage==='japan'?{advantage:0,target:4,maxGames:null}:finalFormat(season.standings.find(t=>t.team===higher)!,season.standings.find(t=>t.team===lower)!);
 return {id:`${league}-${stage}`,stage,league,higher,lower,...format,wins:[format.advantage,0],results:[],winner:null};
}
export function newPostseason(season:Season):Postseason {
 if(circuitOf(season)==='MLB')return newMLBPostseason(season);
 return {version:1,stage:'first',day:0,series:(['CENTRAL','PACIFIC'] as const).map(league=>{const ranks=rankings(season,league);return createSeries('first',league,ranks[1].team,ranks[2].team,season);}),batting:{},pitching:{},standings:emptySeason().standings,champion:null,rewardClaimed:false};
}
export function seriesWinner(series:PostSeries):string|null {
 const [a,b]=series.wins;
 if(a>=series.target)return series.higher;if(b>=series.target)return series.lower;
 if(series.maxGames!==null){const remaining=series.maxGames-series.results.length;if(a>=b+remaining)return series.higher;if(b>a+remaining)return series.lower;}
 return null;
}
export function finishPostseason(input:GameState):GameState {
 let state=input;
 // Continue extra games after draws without requiring another click.
 while(state.season.completed&&state.season.postseason?.stage!=='complete')state=simulatePostseason(state,60);
 return state;
}
export function simulatePostseason(input:GameState,days=1):GameState {
 if(!input.season.completed||input.season.postseason?.stage==='complete')return input;
 if(circuitOf(input.season)==='MLB')return simulateMLBPostseason(input,days);
 const state=structuredClone(input),post=state.season.postseason??=newPostseason(state.season),random=rng(state.seed);
 const count=Math.min(60,Math.max(0,Math.floor(days)));
 for(let day=0;day<count&&post.stage!=='complete';day++) {
  const active=post.series.filter(s=>s.stage===post.stage&&!s.winner);
  for(const series of active){
   const gameIndex=series.results.length;
   // Japan Series: 2-3-2, alternating home after game 7 if draws require more games.
   const homeHigher=series.stage!=='japan'||[0,1,5,6].includes(gameIndex)||(gameIndex>=7&&gameIndex%2===0);
   const home=homeHigher?series.higher:series.lower,away=homeHigher?series.lower:series.higher;
   const scratch:GameState={...state,season:{...emptySeason(state.season.number),day:post.day,batting:post.batting,pitching:post.pitching,standings:post.standings}};
   const game=playGame(scratch,home,away,random);
   series.results.push(game);
   if(game.homeRuns!==game.awayRuns){const winner=game.homeRuns>game.awayRuns?home:away;series.wins[winner===series.higher?0:1]++;}
   series.winner=seriesWinner(series);
  }
  post.day++;
  if(post.series.filter(s=>s.stage===post.stage).every(s=>s.winner)){
   if(post.stage==='first'){
    for(const league of ['CENTRAL','PACIFIC'] as const){const first=post.series.find(s=>s.league===league&&s.stage==='first')!;post.series.push(createSeries('final',league,rankings(state.season,league)[0].team,first.winner!,state.season));}post.stage='final';
   }else if(post.stage==='final'){
    const central=post.series.find(s=>s.league==='CENTRAL'&&s.stage==='final')!.winner!,pacific=post.series.find(s=>s.league==='PACIFIC'&&s.stage==='final')!.winner!;
    post.series.push(createSeries('japan','JAPAN',central,pacific,state.season));post.stage='japan';
   }else{post.stage='complete';post.champion=post.series.find(s=>s.stage==='japan')!.winner;}
  }
 }
 if(post.stage==='complete'&&!post.rewardClaimed){
  const champion=post.champion===state.club,finalist=post.series.some(s=>s.stage==='japan'&&[s.higher,s.lower].includes(state.club));
  state.gems+=postseasonReward(state,champion,finalist);
  post.rewardClaimed=true;
 }
 state.seed=random.state;return post.stage==='complete'?recordAchievements(settleLeagueProgress(state)):state;
}
