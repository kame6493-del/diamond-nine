import {mlbLeagueTeams} from './mlb-opponents';
import { playerMap,teams } from './data';
import type { GameResult } from './engine';
export function validGameBox(g:GameResult):boolean{
 if(!g||typeof g!=='object')return false;
 if(g.errors!==undefined&&(!Array.isArray(g.errors)||g.errors.length!==2||!g.errors.every(n=>Number.isSafeInteger(n)&&n>=0)))return false;
 if(g.box===undefined)return true;
 const box=g.box;if(!box||!Array.isArray(box.batting)||!Array.isArray(box.pitching)||!Array.isArray(box.highlights)||box.batting.length>30||box.pitching.length>30||box.highlights.length>400)return false;
 const team=(id:unknown)=>typeof id==='string'&&[g.home,g.away].includes(id)&&[...teams,...mlbLeagueTeams].some(t=>t.id===id);
 const validRow=(r:Record<string,unknown>)=>r&&typeof r.playerId==='string'&&!!playerMap[r.playerId]&&team(r.team)&&Object.entries(r).every(([k,v])=>k==='playerId'||k==='team'||typeof v==='number'&&Number.isSafeInteger(v)&&v>=0);
 if(!box.batting.every(b=>validRow(b as unknown as Record<string,unknown>)&&['games','pa','ab','hits','hr','rbi','bb','so','runs','doubles','triples','sb','hbp','sf'].every(k=>typeof b[k as keyof typeof b]==='number'))||!box.pitching.every(p=>validRow(p as unknown as Record<string,unknown>)&&['games','starts','wins','losses','saves','outs','hits','er','bb','so','hr','hbp','bf'].every(k=>typeof p[k as keyof typeof p]==='number')))return false;
 return box.highlights.every(h=>h&&team(h.team)&&!!playerMap[h.batter]&&!!playerMap[h.pitcher]&&typeof h.play==='string'&&h.play.length<40&&typeof h.turningPoint==='boolean'&&Number.isInteger(h.inning)&&h.inning>=1&&h.inning<=100&&['runs','awayScore','homeScore'].every(k=>typeof h[k as keyof typeof h]==='number'&&Number.isSafeInteger(h[k as keyof typeof h])&&(h[k as keyof typeof h] as number)>=0));
}
