import snapshot from './mlb-opponents2026.json';
import {batting,pitching,mlbPlayers,mlbTeams} from './mlb-players';
import type {Player,Ratings} from './data';
import {maskPlayerName,teamLocation} from './display-names';

export const mlbLeagueTeams=snapshot.teams.map(t=>({id:`mlb-${t.id}`,...teamLocation(`mlb-${t.id}`),league:t.league,division:t.division,color:mlbTeams.find(m=>m.id===`mlb-${t.id}`)?.color??'#174a85'}));
const bound=(v:number,min=35,max=92)=>Math.round(Math.max(min,Math.min(max,v)));
const n=(s:Record<string,unknown>|null,k:string)=>Number(s?.[k])||0;
const pos:Record<string,string>={P:'投',TWP:'投',C:'捕','1B':'一','2B':'二','3B':'三',SS:'遊',LF:'外',CF:'外',RF:'外',OF:'外',DH:'DH'};
export const mlbOpponentInfo={asOf:snapshot.asOf,count:snapshot.entries.length};
// Opponent-only estimates: actual roster/stat snapshots plus a modest league
// translation. These cards never enter the user's collection or scouting pool.
export const mlbOpponentPlayers:Player[]=snapshot.entries.map(e=>{
 const b=e.batting as Record<string,unknown>|null,q=e.pitching as Record<string,unknown>|null;
 const known=mlbPlayers.find(p=>p.mlb?.id===e.id),position=pos[e.position]??'内',role=position==='投'?'pitcher':'batter';
 const pa=n(b,'plateAppearances'),ab=n(b,'atBats'),bf=n(q,'battersFaced'),ip=n(q,'outs')/3;
 const avg=(n(b,'hits')+.25*160)/(ab+160),iso=(n(b,'totalBases')-n(b,'hits')+.16*160)/(ab+160);
 const k=(n(b,'strikeOuts')+36.8)/(pa+160),bb9=(n(q,'baseOnBalls')+12)/(ip+36)*9,k9=(n(q,'strikeOuts')+34)/(ip+36)*9;
 const ratings:Ratings=known?{...known.ratings}:{contact:bound(69+(avg-.25)*260-(k-.23)*50),power:bound(43+iso*190+n(b,'homeRuns')/(pa+160)*180),speed:bound(45+n(b,'stolenBases')*.9,35,90),arm:position==='捕'?78:position==='遊'?77:70,field:position==='DH'?48:position==='遊'?77:70,catching:70,velocity:role==='pitcher'?bound(148+k9*.7,145,163):145,control:bound(91-bb9*6,45,90),stamina:bound(45+n(q,'gamesStarted')*1.4,42,86),breaking:bound(52+k9*3,60,92)};
 const positions=known?.positions??[position];
 return {id:`rival-${e.team}-${e.id}`,name:maskPlayerName(known?.name??e.name),team:`mlb-${e.team}`,role,position,positions,bats:known?.bats??'右',throws:known?.throws??'右',batting:b?batting(b):undefined,pitching:q?pitching(q):undefined,fielding:[],ratings,overall:role==='batter'?ratings.contact*.45+ratings.power*.4+ratings.field*.15:ratings.control*.4+ratings.breaking*.4+ratings.stamina*.2,rarity:'UR',traits:known?.traits??[],dataYear:2026,uzr:null,war:null,uzrRecord:null,roster:null,active:false,provisional:false,positionSource:'registration',velocityRecord:null,opponentOnly:true,
  defenseEvidence:{chances:0,errors:0,games:0,fieldingPct:null,positionPct:null,handling:ratings.catching},
  simulationBaseline:known?.simulationBaseline?{...known.simulationBaseline}:{...ratings},
  mlb:{id:e.id,birthDate:known?.mlb?.birthDate??'',number:e.number,profileUrl:`https://www.mlb.com/player/${e.id}`,asOf:snapshot.asOf,assignment:mlbLeagueTeams.find(t=>t.id===`mlb-${e.team}`)!.name,twoWay:positions.includes('DH')&&role==='pitcher',statsYear:{hitting:pa?2026:null,pitching:bf?2026:null},pitches:known?.mlb?.pitches??[]},
 };
});
