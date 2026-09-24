import {emptySeason,playGame,rng,type GameState,type Season} from './engine';
import type {Postseason,PostSeries} from './postseason';
import {circuitOf,playoffSeeds,standingOrder,settleLeagueProgress} from './leagues';
import {postseasonReward} from './progression';
import {recordAchievements} from './achievements';

const leagues=['AMERICAN','NATIONAL'] as const;
export function mlbSeries(stage:PostSeries['stage'],league:PostSeries['league'],slot:number,higher:string,lower:string):PostSeries{
 const target=stage==='wildcard'?2:stage==='division'?3:4;
 return {id:`${league}-${stage}-${slot}`,stage,league,higher,lower,target,maxGames:target*2-1,advantage:0,wins:[0,0],results:[],winner:null};
}
export function newMLBPostseason(season:Season):Postseason{
 return {version:1,circuit:circuitOf(season),stage:'wildcard',day:0,series:leagues.flatMap(league=>{const seeds=playoffSeeds(season,league);return [mlbSeries('wildcard',league,0,seeds[2].team,seeds[5].team),mlbSeries('wildcard',league,1,seeds[3].team,seeds[4].team)];}),batting:{},pitching:{},standings:emptySeason(season.number,circuitOf(season),season.club).standings,champion:null,rewardClaimed:false};
}
export function advanceMLBBracket(post:Postseason,season:Season){
 const winner=(id:string)=>post.series.find(s=>s.id===id)!.winner!;
 if(post.stage==='wildcard'){
  for(const league of leagues){const seeds=playoffSeeds(season,league);post.series.push(mlbSeries('division',league,0,seeds[0].team,winner(`${league}-wildcard-1`)),mlbSeries('division',league,1,seeds[1].team,winner(`${league}-wildcard-0`)));}post.stage='division';
 }else if(post.stage==='division'){
  for(const league of leagues){const seeds=playoffSeeds(season,league).map(s=>s.team),pair=[winner(`${league}-division-0`),winner(`${league}-division-1`)].sort((a,b)=>seeds.indexOf(a)-seeds.indexOf(b));post.series.push(mlbSeries('championship',league,0,pair[0],pair[1]));}post.stage='championship';
 }else if(post.stage==='championship'){
  const finalists=leagues.map(l=>winner(`${l}-championship-0`)).map(id=>season.standings.find(s=>s.team===id)!).sort(standingOrder);
  post.series.push(mlbSeries('world','WORLD',0,finalists[0].team,finalists[1].team));post.stage='world';
 }else{post.stage='complete';post.champion=winner('WORLD-world-0');}
}
export function simulateMLBPostseason(input:GameState,days:number):GameState{
 let state=structuredClone(input);const post=state.season.postseason??=newMLBPostseason(state.season),random=rng(state.seed);
 for(let day=0;day<Math.min(60,Math.max(0,Math.floor(days)))&&post.stage!=='complete';day++){
  for(const series of post.series.filter(s=>s.stage===post.stage&&!s.winner)){
   const index=series.results.length,high=series.stage==='wildcard'||(series.stage==='division'?[0,1,4]:[0,1,5,6]).includes(index);
   const scratch:GameState={...state,season:{...emptySeason(state.season.number,circuitOf(state.season),state.club),day:post.day,postseason:post,batting:post.batting,pitching:post.pitching,standings:post.standings}};
   const game=playGame(scratch,high?series.higher:series.lower,high?series.lower:series.higher,random);
   if(game.homeRuns===game.awayRuns)throw new Error('MLB playoff game must have a winner');
   series.results.push(game);const win=game.homeRuns>game.awayRuns?game.home:game.away;series.wins[win===series.higher?0:1]++;
   if(series.wins[0]===series.target)series.winner=series.higher;else if(series.wins[1]===series.target)series.winner=series.lower;
  }
  post.day++;if(post.series.filter(s=>s.stage===post.stage).every(s=>s.winner))advanceMLBBracket(post,state.season);
 }
 if(post.stage==='complete'&&!post.rewardClaimed){
  const champion=post.champion===state.club,finalist=post.series.some(s=>s.stage==='world'&&[s.higher,s.lower].includes(state.club));
  state.gems+=postseasonReward(state,champion,finalist);post.rewardClaimed=true;
  state=recordAchievements(settleLeagueProgress(state));
 }
 state.seed=random.state;return state;
}
