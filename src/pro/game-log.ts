import {mlbLeagueTeams} from './mlb-opponents';
import { playerMap,teams } from './data';
import type { GameResult,WatchReplay } from './engine';
export function validGameBox(g:GameResult):boolean{
 if(!g||typeof g!=='object')return false;
 if(g.errors!==undefined&&(!Array.isArray(g.errors)||g.errors.length!==2||!g.errors.every(n=>Number.isSafeInteger(n)&&n>=0)))return false;
 if(g.replay!==undefined&&!validReplay(g.replay))return false;
 if(g.box===undefined)return true;
 const box=g.box;if(!box||!Array.isArray(box.batting)||!Array.isArray(box.pitching)||!Array.isArray(box.highlights)||box.batting.length>30||box.pitching.length>30||box.highlights.length>400)return false;
 const team=(id:unknown)=>typeof id==='string'&&[g.home,g.away].includes(id)&&[...teams,...mlbLeagueTeams].some(t=>t.id===id);
 const validRow=(r:Record<string,unknown>)=>r&&typeof r.playerId==='string'&&!!playerMap[r.playerId]&&team(r.team)&&Object.entries(r).every(([k,v])=>k==='playerId'||k==='team'||typeof v==='number'&&Number.isSafeInteger(v)&&v>=0);
 if(!box.batting.every(b=>validRow(b as unknown as Record<string,unknown>)&&['games','pa','ab','hits','hr','rbi','bb','so','runs','doubles','triples','sb','hbp','sf'].every(k=>typeof b[k as keyof typeof b]==='number'))||!box.pitching.every(p=>validRow(p as unknown as Record<string,unknown>)&&['games','starts','wins','losses','saves','outs','hits','er','bb','so','hr','hbp','bf'].every(k=>typeof p[k as keyof typeof p]==='number')))return false;
 return box.highlights.every(h=>h&&team(h.team)&&!!playerMap[h.batter]&&!!playerMap[h.pitcher]&&typeof h.play==='string'&&h.play.length<40&&typeof h.turningPoint==='boolean'&&Number.isInteger(h.inning)&&h.inning>=1&&h.inning<=100&&['runs','awayScore','homeScore'].every(k=>typeof h[k as keyof typeof h]==='number'&&Number.isSafeInteger(h[k as keyof typeof h])&&(h[k as keyof typeof h] as number)>=0));
}

// 観戦モードの控え(2026-11-04 vc43)。形が違えば読み込まない(観戦の入口が出ないだけで済むよう、値の範囲も見る)。
export function validReplay(r:WatchReplay):boolean{
 if(!r||typeof r!=='object'||r.v!==1||!['opening','clinch','showdown','post'].includes(r.kind)||typeof r.post!=='boolean')return false;
 if(!Number.isSafeInteger(r.rng)||r.rng<0||r.rng>0xffffffff||!Number.isSafeInteger(r.day)||r.day<0||r.day>400)return false;
 const ids=(a:unknown,max:number)=>Array.isArray(a)&&a.length>0&&a.length<=max&&a.every(id=>typeof id==='string'&&!!playerMap[id])&&new Set(a).size===a.length;
 if(!ids(r.lineup,9)||r.lineup.length!==9||!ids(r.pitchers,14))return false;
 if(!r.defense||typeof r.defense!=='object'||Object.keys(r.defense).length!==9||!r.lineup.every(id=>typeof r.defense[id]==='string'&&r.defense[id].length<=3))return false;
 const roster=new Set([...r.lineup,...r.pitchers]);
 const small=(m:unknown,max:number)=>!!m&&typeof m==='object'&&!Array.isArray(m)&&Object.entries(m as Record<string,unknown>).every(([id,v])=>roster.has(id)&&Number.isInteger(v)&&(v as number)>=0&&(v as number)<=max);
 return small(r.owned,6)&&small(r.training,5)&&small(r.growth,20);
}
