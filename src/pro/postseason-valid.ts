import type {Season} from './engine';
import {circuitOf} from './leagues';
import {validMLBPostseason} from './mlb-postseason-valid';
import { teams } from './data';
import type { Postseason } from './postseason';
import { validGameBox } from './game-log';
export function validPostseason(p:Postseason,season?:Season):boolean {
 if(season&&circuitOf(season)==='MLB')return !!p&&validMLBPostseason(p,season);
 if(p?.circuit==='MLB')return false;
 const team=(id:unknown)=>typeof id==='string'&&teams.some(t=>t.id===id);
 const int=(n:unknown,max=10000)=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=max;
 if(!p||p.version!==1||!['first','final','japan','complete'].includes(p.stage)||!int(p.day)||!Array.isArray(p.series)||p.series.length<2||p.series.length>5||typeof p.rewardClaimed!=='boolean'||(p.champion!==null&&!team(p.champion)))return false;
 const expected=p.stage==='first'?2:p.stage==='final'?4:5;
 if(p.series.length!==expected||new Set(p.series.map(s=>s.id)).size!==expected)return false;
 for(const s of p.series){
  if(!s||!['first','final','japan'].includes(s.stage)||!['CENTRAL','PACIFIC','JAPAN'].includes(s.league)||s.id!==`${s.league}-${s.stage}`||!team(s.higher)||!team(s.lower)||s.higher===s.lower||!Array.isArray(s.wins)||s.wins.length!==2||!s.wins.every(w=>int(w,20))||!Array.isArray(s.results)||s.results.length>10000)return false;
  if(s.stage==='first'&&(s.advantage!==0||s.target!==2||s.maxGames!==3))return false;
  if(s.stage==='final'&&!((s.advantage===1&&s.target===4&&s.maxGames===6)||(s.advantage===2&&s.target===5&&s.maxGames===7)))return false;
  if(s.stage==='japan'&&(s.league!=='JAPAN'||s.advantage!==0||s.target!==4||s.maxGames!==null))return false;
  if(s.maxGames!==null&&s.results.length>s.maxGames)return false;
  const wins=[s.advantage,0];
  for(const g of s.results){
   if(!validGameBox(g))return false;
   if(!g||!int(g.day)||g.day<1||g.day>p.day||!int(g.homeRuns)||!int(g.awayRuns)||!int(g.innings,12)||g.innings<9||g.home===g.away||![s.higher,s.lower].includes(g.home)||![s.higher,s.lower].includes(g.away)||!Array.isArray(g.line)||g.line.length!==2||!g.line.every(l=>Array.isArray(l)&&l.length===g.innings&&l.every(v=>Number.isInteger(v)&&v>=-1&&v<=10000))||!Array.isArray(g.stars))return false;
   if(g.line[0].reduce((a,b)=>a+Math.max(0,b),0)!==g.awayRuns||g.line[1].reduce((a,b)=>a+Math.max(0,b),0)!==g.homeRuns)return false;
   if(g.homeRuns!==g.awayRuns)wins[(g.homeRuns>g.awayRuns?g.home:g.away)===s.higher?0:1]++;
  }
  if(wins.some((w,i)=>w!==s.wins[i]))return false;
  const remaining=s.maxGames===null?Infinity:s.maxGames-s.results.length;
  const winner=wins[0]>=s.target||wins[0]>=wins[1]+remaining?s.higher:wins[1]>=s.target||wins[1]>wins[0]+remaining?s.lower:null;
  if(s.winner!==winner)return false;
 }
 const japan=p.series.find(s=>s.stage==='japan');
 if(p.stage==='complete')return !!japan?.winner&&p.champion===japan.winner&&p.rewardClaimed;
 return p.champion===null&&!p.rewardClaimed;
}
