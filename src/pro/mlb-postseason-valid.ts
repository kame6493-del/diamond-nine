import type {Postseason} from './postseason';
import type {Season} from './engine';
import {circuitOf,leagueTeams} from './leagues';
import {newMLBPostseason,advanceMLBBracket} from './mlb-postseason';
import {validGameBox} from './game-log';

export function validMLBPostseason(p:Postseason,season:Season):boolean{
 const stages=['wildcard','division','championship','world','complete'],counts=[4,8,10,11,11],stage=stages.indexOf(p.stage),members=leagueTeams(season);
 const int=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
 if(stage<0||p.version!==1||p.circuit!==circuitOf(season)||!int(p.day)||p.day>22||!Array.isArray(p.series)||p.series.length!==counts[stage]||typeof p.rewardClaimed!=='boolean')return false;
 if(new Set(p.series.map(s=>s.id)).size!==p.series.length)return false;
 // Rebuild the bracket from regular-season seeds and validated earlier winners.
 const expected=newMLBPostseason(season);
 for(const stageName of stages.slice(0,Math.min(stage+1,4))){
  for(const node of expected.series.filter(s=>s.stage===stageName)){
   const actual=p.series.find(s=>s.id===node.id);if(!actual)return false;
   for(const key of ['stage','league','higher','lower','target','advantage','maxGames'] as const)if(actual[key]!==node[key])return false;
   if(!members.some(t=>t.id===actual.higher)||!members.some(t=>t.id===actual.lower)||!Array.isArray(actual.results)||actual.results.length>node.maxGames!||!Array.isArray(actual.wins)||actual.wins.length!==2)return false;
   const wins=[0,0];let winner:string|null=null;
   for(const game of actual.results){
    if(winner||!validGameBox(game)||!int(game.day)||game.day<1||game.day>p.day||!int(game.homeRuns)||!int(game.awayRuns)||game.homeRuns===game.awayRuns||!int(game.innings)||game.innings<9||game.innings>100||game.home===game.away||![actual.higher,actual.lower].includes(game.home)||![actual.higher,actual.lower].includes(game.away)||!Array.isArray(game.line)||game.line.length!==2||!game.line.every(line=>Array.isArray(line)&&line.length===game.innings&&line.every(v=>Number.isInteger(v)&&v>=-1)))return false;
    if(game.line[0].reduce((a,b)=>a+Math.max(0,b),0)!==game.awayRuns||game.line[1].reduce((a,b)=>a+Math.max(0,b),0)!==game.homeRuns)return false;
    wins[(game.homeRuns>game.awayRuns?game.home:game.away)===actual.higher?0:1]++;
    winner=wins[0]===node.target?actual.higher:wins[1]===node.target?actual.lower:null;
   }
   if(actual.wins.some((w,i)=>w!==wins[i])||actual.winner!==winner)return false;
   Object.assign(node,actual);
  }
  if(stageName!==p.stage){if(!expected.series.filter(s=>s.stage===stageName).every(s=>s.winner))return false;advanceMLBBracket(expected,season);}
 }
 if(p.stage==='complete')return p.rewardClaimed&&p.champion===expected.champion&&!!p.champion;
 return !p.rewardClaimed&&p.champion===null;
}
