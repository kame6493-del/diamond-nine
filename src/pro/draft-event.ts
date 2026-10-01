import {players,type Player} from './data';
import {isRookie} from './development';

// Limited-time "draft week" around the real NPB draft meeting. While it runs, a
// domestic scout picks from last year's draft class with DRAFT_ROOKIE_CHANCE.
// Dates are the player's local calendar days, inclusive.
export const DRAFT_EVENT={id:'draft-2026',start:'2026-10-16',end:'2026-11-03',name:'ドラフト会議ウィーク',tag:'#ドラフト会議',campaignTag:'#DIAMONDNINEドラフト'} as const;
export const DRAFT_ROOKIE_CHANCE=.3;
export const draftRookiePool:Player[]=players.filter(p=>!p.mlb&&isRookie(p));

const localDay=(now:Date)=>`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
export function draftEventActive(now:Date|null=new Date()):boolean{
 if(!now||Number.isNaN(now.getTime()))return false;
 const day=localDay(now);
 return day>=DRAFT_EVENT.start&&day<=DRAFT_EVENT.end&&draftRookiePool.length>0;
}
export const draftEventEndLabel=()=>{const [,m,d]=DRAFT_EVENT.end.split('-').map(Number);return `${m}/${d}`;};
