import {pitcherSlotRole,pitchingRatingsForRole} from './pitcher-aptitude';
import {spaceUnlocked,circuitOf,seasonGames,leagueTeams,leagueFor,mlbSchedule,leagueProgress,settleLeagueProgress,standingOrder,NPB_TITLES_TO_MLB,type Circuit,type LeagueProgress} from './leagues';
import {mlbLeagueTeams,mlbOpponentPlayers} from './mlb-opponents';
import { autoLineup,autoPitchers,canBat,wasLegacyBatter,fitsPosition,clamp,contextFor,findPlayer,playerMap,players,rosterSlots,teams,type Player,type Rarity } from './data';
import { freshFranchise,type Franchise } from './franchise';
import type { Postseason } from './postseason';
import { validPostseason } from './postseason-valid';
import { seasonConditions } from './conditions';
import { gameRatings,matchupProbabilities,extraBaseChance,stealProbabilities } from './matchup';
import { gameReward,isCareer,seasonReward,type Profile } from './progression';
import { pitchingRoleLabel } from './wiki-players';
import {defenseAtPosition} from './position-defense';
import { validGameBox } from './game-log';
import {claimSeasonGoals} from './ambitions';
import {ownedRatings,ratingOverall} from './development';
import {recordAchievements,achievementNames,type Achievements} from './achievements';
import {captureSeasonTeam,validSeasonTeam,type SeasonTeamSnapshot} from './season-team';
import {createStarterScout,validStarterScout,type StarterScoutState} from './starter-scout';
import {emptyFielding,creditFieldingContact,validFieldingSeason,type FieldingSeason} from './fielding-stats';

export interface BatStats { playerId:string;team:string;games:number;pa:number;ab:number;hits:number;doubles:number;triples:number;hr:number;rbi:number;runs:number;bb:number;so:number;sb:number;hbp:number;sf:number }
export interface PitStats { playerId:string;team:string;games:number;starts:number;wins:number;losses:number;saves:number;outs:number;hits:number;er:number;bb:number;so:number;hr:number;hbp:number;bf:number }
export interface Standing { team:string;w:number;l:number;d:number;rf:number;ra:number;form:string[] }
export interface PlayHighlight { inning:number;team:string;batter:string;pitcher:string;play:string;runs:number;awayScore:number;homeScore:number;turningPoint:boolean }
export interface GameBox { batting:BatStats[];pitching:PitStats[];highlights:PlayHighlight[] }
export interface GameResult { day:number;home:string;away:string;homeRuns:number;awayRuns:number;innings:number;line:number[][];stars:string[];errors?:[number,number];box?:GameBox }
export interface Season { fielding?:FieldingSeason;shareTeam?:SeasonTeamSnapshot;circuit?:Circuit;club?:string;number:number;day:number;standings:Standing[];batting:Record<string,BatStats>;pitching:Record<string,PitStats>;results:GameResult[];trend:number[];completed:boolean;rewardClaimed:boolean;model?:'2026-dips'|'2025-basic';postseason?:Postseason }
export interface GameState { starterScout?:StarterScoutState;achievements?:Achievements;additionalParkedSeasons?:Season[];parkedSeason?:Season;leagueChoice?:Circuit;leagueProgress?:LeagueProgress;version:1;mode?:Profile;name:string;club:string;gems:number;owned:Record<string,number>;lineup:string[];defense:Record<string,string>;pitchers:string[];season:Season;history:Season[];pulls:number;pity:number;seed:number;lastPulls:Pull[];franchise:Franchise;training:Record<string,number> }
export interface Pull { playerId:string;isNew:boolean;copies:number;guaranteed:boolean;trainingReward?:number;contract?:boolean }
export const SAVE_KEY='diamond-dynasty-v1';
export const CAREER_SAVE_KEY='diamond-dynasty-career-v1';
export const saveKeyFor=(profile:Profile)=>profile==='career'?CAREER_SAVE_KEY:SAVE_KEY;
export const emptySeason=(number=1,circuit:Circuit='NPB',club='t'):Season=>({...(circuit!=='NPB'?{circuit,club}:{}),number,day:0,model:'2026-dips',standings:leagueTeams({circuit,club} as Season).map(t=>({team:t.id,w:0,l:0,d:0,rf:0,ra:0,form:[]})),batting:{},pitching:{},fielding:emptyFielding(),results:[],trend:[],completed:false,rewardClaimed:false});
export function initialSandboxState():GameState{
 const names=['坂倉将吾','大山悠輔','中野拓夢','清宮幸太郎','宗山塁','近本光司','森下翔太','西川愛也','佐野恵太','村上頌樹','才木浩人','東克樹','大関友久','隅田知一郎','九里亜蓮','桐敷拓馬','藤嶋健人','杉浦稔大','木浪聖也','藤原恭大','梅野隆太郎','清水達也','田中正義','杉山一樹'];
 const pool=names.map(n=>findPlayer(n)).filter(Boolean);
 const owned=Object.fromEntries(pool.map(p=>[p.id,1]));
 const order=['近本光司','中野拓夢','森下翔太','大山悠輔','清宮幸太郎','佐野恵太','坂倉将吾','西川愛也','宗山塁'].map(name=>findPlayer(name).id);
 const defense=Object.fromEntries(order.map((id,i)=>[id,['外','二','外','一','三','DH','捕','外','遊'][i]]));
 return {achievements:{},version:1,name:'東京スターズ',club:'t',gems:15600,owned,lineup:order,defense,pitchers:autoPitchers(pool),season:emptySeason(),history:[],pulls:0,pity:0,seed:Math.floor(Math.random()*0xffffffff)||428374,lastPulls:[],franchise:freshFranchise(),training:{}};
}
export function initialState(seed=Math.floor(Math.random()*0xffffffff)||428374):GameState {
 // Use a separate stream for the starting roster so it cannot advance scouts
 // or game results. Shuffle candidates, not their abilities or the shared data.
 const random=rng(seed^0x85ebca6b);
 const shuffle=(pool:Player[])=>{
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random.next()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool;
 };
 // Cap the displayed rating, with no lower cutoff that would exclude the
 // weakest cards. Starters need a slightly wider pool to fill six unique slots.
 const batters=shuffle(players.filter(p=>!p.mlb&&p.role==='batter'&&!p.provisional&&ratingOverall(p)<=52));
 const lineup:string[]=[],defense:Record<string,string>={};
 for(const slot of rosterSlots){const p=batters.find(p=>!lineup.includes(p.id)&&fitsPosition(p,slot));if(!p)throw new Error('Missing starter position '+slot);lineup.push(p.id);defense[p.id]=slot;}
 const arms=shuffle(players.filter(p=>!p.mlb&&p.role==='pitcher'&&!p.provisional&&(p.pitching?.outs??0)>=30&&ratingOverall(p)<=(pitchingRoleLabel(p)==='先発'?57:54)));
 const starters=arms.filter(p=>pitchingRoleLabel(p)==='先発').slice(0,6);
 const relief=arms.filter(p=>pitchingRoleLabel(p)==='救援').slice(0,6);
 if(starters.length!==6||relief.length!==6)throw new Error('Missing starter pitchers');
 const pitchers=[...starters,...relief].map(p=>p.id),bench=batters.filter(p=>!lineup.includes(p.id)).slice(0,3);
 return {starterScout:createStarterScout(seed),achievements:{},version:1,mode:'career',name:'東京ルーキーズ',club:'t',gems:0,owned:Object.fromEntries([...lineup,...pitchers,...bench.map(p=>p.id)].map(id=>[id,1])),lineup,defense,pitchers,season:emptySeason(),history:[],pulls:0,pity:0,seed,lastPulls:[],franchise:{...freshFranchise(),established:true,tickets:0,points:0,motto:'一枚ずつ、強くなる。'},training:{}};
}
export function validState(value:unknown):value is GameState{
 if(!value||typeof value!=='object')return false;
 const s=value as GameState;
 if(!s.season||typeof s.season!=='object'||!Array.isArray(s.history))return false;
 if(s.starterScout!==undefined&&!validStarterScout(s.starterScout,s.owned))return false;
 const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 if(s.additionalParkedSeasons!==undefined&&(!Array.isArray(s.additionalParkedSeasons)||s.additionalParkedSeasons.length>1||s.additionalParkedSeasons.some(x=>!x||typeof x!=='object')))return false;
 const progress=s.leagueProgress;
 const latestSeason=Math.max(s.season?.number??0,s.parkedSeason?.number??0,...(s.additionalParkedSeasons??[]).map(x=>x.number),...(Array.isArray(s.history)?s.history.map(h=>h?.number??0):[]));
 if(s.leagueChoice!==undefined&&s.leagueChoice!=='NPB'&&s.leagueChoice!=='MLB'&&s.leagueChoice!=='SPACE')return false;
 if((s.leagueChoice==='MLB'||s.parkedSeason?.circuit==='MLB')&&!progress?.mlbUnlocked)return false;
 if(s.achievements!==undefined&&(!s.achievements||typeof s.achievements!=='object'||Array.isArray(s.achievements)||Object.entries(s.achievements).some(([id,year])=>!Object.hasOwn(achievementNames,id)||!Number.isSafeInteger(year)||year<1||year>latestSeason)))return false;
 if(progress&&(!Number.isInteger(progress.npbStreak)||progress.npbStreak<0||progress.npbStreak>5||typeof progress.mlbUnlocked!=='boolean'||!Number.isInteger(progress.lastSettledSeason)||progress.lastSettledSeason<0||progress.lastSettledSeason>latestSeason||progress.npbStreak===5&&!progress.mlbUnlocked))return false;
 if(progress&&((progress.basis!==undefined&&progress.basis!=='league')||(progress.basis==='league'&&(progress.npbStreak>NPB_TITLES_TO_MLB||progress.npbStreak===NPB_TITLES_TO_MLB&&!progress.mlbUnlocked))))return false;
 if(s.season?.circuit==='MLB'&&!progress?.mlbUnlocked)return false;
 if([s.season,s.parkedSeason,...(s.additionalParkedSeasons??[])].some(x=>x?.circuit==='SPACE')||s.leagueChoice==='SPACE'){if(!progress?.mlbUnlocked||!spaceUnlocked(s))return false;}
 const f=s.franchise;
 if(!f||!Number.isSafeInteger(f.tickets)||f.tickets<0||typeof f.established!=='boolean'||typeof f.city!=='string'||f.city.length>12||!['★','D','⚡','W','S','N'].includes(f.mark)||!/^#[0-9a-fA-F]{6}$/.test(f.color)||typeof f.motto!=='string'||f.motto.length>40||!finite(f.xp)||!finite(f.points)||!Number.isInteger(f.stadium)||f.stadium<1||f.stadium>5||!Array.isArray(f.claimed)||!f.claimed.every(x=>typeof x==='string')||(f.captain!==null&&!playerMap[f.captain])||!s.training||Object.entries(s.training).some(([id,v])=>!s.owned?.[id]||!Number.isInteger(v)||v<0||v>5))return false;
 const validSeason=(x:Season):boolean=>x&&(x.shareTeam===undefined||x.completed&&validSeasonTeam(x.shareTeam))&&(x.circuit===undefined||x.circuit==='NPB'||x.circuit==='MLB'||x.circuit==='SPACE')&&(circuitOf(x)==='NPB'||x.club===s.club)&&validCampaign(x)&&finite(x.number)&&Number.isInteger(x.day)&&x.day>=0&&x.day<=seasonGames(x)&&Array.isArray(x.results)&&x.results.every(validGameBox)&&Array.isArray(x.trend)&&Array.isArray(x.standings)&&x.standings.length===leagueTeams(x).length&&new Set(x.standings.map(t=>t.team)).size===leagueTeams(x).length&&x.standings.every(t=>leagueTeams(x).some(y=>y.id===t.team)&&['w','l','d','rf','ra'].every(k=>finite(t[k as keyof Standing]))&&Array.isArray(t.form))&&x.batting&&Object.values(x.batting).every(b=>b&&playerMap[b.playerId]&&['games','pa','ab','hits','hr','rbi','runs','bb','so','sb','doubles','triples','hbp','sf'].every(k=>finite(b[k as keyof BatStats])))&&x.pitching&&Object.values(x.pitching).every(p=>p&&playerMap[p.playerId]&&['games','starts','wins','losses','saves','outs','hits','er','bb','so','hr','hbp','bf'].every(k=>finite(p[k as keyof PitStats])));
 function validCampaign(x:Season):boolean {if(!validFieldingSeason(x.fielding,leagueTeams(x).map(t=>t.id),seasonGames(x)))return false;const p=x.postseason;if(!p)return true;if(!x.completed||!validPostseason(p,x))return false;return validSeason({...x,postseason:undefined,batting:p.batting,pitching:p.pitching,standings:p.standings});}
 if(s.parkedSeason&&(!validSeason(s.parkedSeason)||circuitOf(s.parkedSeason)===circuitOf(s.season)||s.parkedSeason.number===s.season.number||s.history?.some(h=>h.number===s.parkedSeason!.number)))return false;
 const parked=[...(s.parkedSeason?[s.parkedSeason]:[]),...(s.additionalParkedSeasons??[])];
 if(parked.some(x=>!validSeason(x)||circuitOf(x)===circuitOf(s.season)||s.history?.some(h=>h.number===x.number))||new Set([s.season.number,...parked.map(x=>x.number)]).size!==parked.length+1||new Set(parked.map(circuitOf)).size!==parked.length)return false;
 return s.version===1&&(s.mode===undefined||s.mode==='career'||s.mode==='free')&&typeof s.name==='string'&&s.name.length>0&&s.name.length<=30&&teams.some(t=>t.id===s.club)&&finite(s.gems)&&finite(s.pulls)&&finite(s.pity)&&s.pity<50&&finite(s.seed)&&!!s.owned&&typeof s.owned==='object'&&Object.entries(s.owned).every(([id,c])=>!!playerMap[id]&&!playerMap[id].opponentOnly&&Number.isInteger(c)&&c>0)&&Array.isArray(s.lineup)&&s.lineup.length===9&&new Set(s.lineup).size===9&&s.lineup.every(id=>s.owned[id]&&(canBat(playerMap[id])||wasLegacyBatter(id)))&&!!s.defense&&s.lineup.map(id=>s.defense[id]).sort().join(',')===[...rosterSlots].sort().join(',')&&Array.isArray(s.pitchers)&&s.pitchers.length===12&&new Set(s.pitchers).size===12&&s.pitchers.every(id=>s.owned[id]&&playerMap[id]?.role==='pitcher')&&!!validSeason(s.season)&&Array.isArray(s.history)&&s.history.length<=8&&s.history.every(validSeason)&&Array.isArray(s.lastPulls)&&s.lastPulls.length<=10&&s.lastPulls.every(p=>playerMap[p.playerId]&&finite(p.copies));
}
export function migrateState(value:unknown):GameState|null{
 if(!value||typeof value!=='object')return null;
 const data=structuredClone(value) as GameState;
 if(data.additionalParkedSeasons!==undefined&&(!Array.isArray(data.additionalParkedSeasons)||data.additionalParkedSeasons.length>1||data.additionalParkedSeasons.some(x=>!x||typeof x!=='object')))return null;
 data.franchise??=freshFranchise();
 if(typeof data.franchise==='object'&&!Array.isArray(data.franchise)&&data.franchise.tickets===undefined)data.franchise.tickets=1;
 data.training??={};
 if(data.season&&Array.isArray(data.history))for(const season of [data.season,...data.history,...(data.parkedSeason?[data.parkedSeason]:[]),...(data.additionalParkedSeasons??[])]){
  season.model??=season.day===0?'2026-dips':'2025-basic';
  if(season.batting)for(const b of Object.values(season.batting)){b.hbp??=0;b.sf??=0;}
  if(season.pitching)for(const p of Object.values(season.pitching)){p.hbp??=0;p.hr??=0;p.bf??=0;}
 }
 if(!validState(data))return null;
 // Fold the legacy training balance into the visible wallet, then clear it.
 // Re-reading, importing, or syncing the migrated save cannot credit it twice.
 const balance=data.gems+data.franchise.points;if(!Number.isFinite(balance))return null;
 data.gems=balance;data.franchise.points=0;
 // Re-evaluate saved streaks against the current promotion requirement.
 return recordAchievements(data.leagueProgress||data.season.completed||data.history.some(s=>s.completed)?settleLeagueProgress(data):data);
}
export function loadState(profile:Profile='career'):{state:GameState;warning:string}{
 const fresh=profile==='career'?initialState:initialSandboxState;
 try {const raw=localStorage.getItem(saveKeyFor(profile));if(!raw)return {state:fresh(),warning:''};const data=migrateState(JSON.parse(raw));if(data&&(isCareer(data)===(profile==='career')))return {state:data,warning:''};return {state:fresh(),warning:'保存データを読み込めませんでした。新しいゲームを開始しました。'};}
 catch{return {state:fresh(),warning:'保存機能が利用できないか、データが破損しています。設定からデータを書き出せます。'};}
}
export const battingAverage=(s:BatStats)=>s.ab?s.hits/s.ab:0;
export const ops=(s:BatStats)=>(s.ab?(s.hits+s.doubles+2*s.triples+3*s.hr)/s.ab:0)+(s.ab+s.bb+s.hbp+s.sf?(s.hits+s.bb+s.hbp)/(s.ab+s.bb+s.hbp+s.sf):0);
export const era=(s:PitStats)=>s.outs?s.er*27/s.outs:0;
export const winPct=(t:Standing)=>t.w+t.l?t.w/(t.w+t.l):0;
export const rankings=(season:Season,league='CENTRAL')=>season.standings.filter(s=>leagueFor(season,s.team)===league).sort(standingOrder);
export function rng(seed:number){let state=seed>>>0;return {next(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},get state(){return state;}};}
export const effectiveOverall=(p:Player,owned:Record<string,number>,training:Record<string,number>={})=>ratingOverall(p,ownedRatings(p,owned,training));
export function defenseAdjustment(lineup:string[],positions:Record<string,string>,owned:Record<string,number>={},training:Record<string,number>={},abilityAdjustment=0){
 const ratings=lineup.filter(id=>positions[id]!=='DH').map(id=>{const p=playerMap[id],r=ownedRatings(p,owned,training);return defenseAtPosition(p,positions[id],{...r,field:r.field+abilityAdjustment,catching:r.catching+abilityAdjustment}).skill;});
 return (ratings.reduce((a,b)=>a+b,0)/Math.max(1,ratings.length)-60)*.0012;
}
// Per at-bat probability of reaching on an error; higher defensive skill lowers it.
export const fieldingErrorRate=(defense:number)=>clamp(.013-defense*.2,.004,.03);

function roundRobin(ids:string[]):[string,string][][]{
 const ring=[...ids];const rounds:[string,string][][]=[];
 for(let r=0;r<5;r++){
  rounds.push(Array.from({length:3},(_,i)=>[ring[i],ring[5-i]] as [string,string]));
  ring.splice(1,0,ring.pop()!);
 }return rounds;
}
const c=teams.filter(t=>t.league==='CENTRAL').map(t=>t.id);
const p=teams.filter(t=>t.league==='PACIFIC').map(t=>t.id);
const cr=roundRobin(c),pr=roundRobin(p);
const leagueDays=Array.from({length:125},(_,day)=>[...cr[day%5],...pr[day%5]].map(([a,b])=>Math.floor(day/5)%2?[b,a] as [string,string]:[a,b] as [string,string]));
const interDays=Array.from({length:18},(_,day)=>c.map((id,i)=>day%2?[p[(i+Math.floor(day/3))%6],id] as [string,string]:[id,p[(i+Math.floor(day/3))%6]] as [string,string]));
export const schedule=[...leagueDays.slice(0,45),...interDays,...leagueDays.slice(45)];
const defaultTeams=Object.fromEntries([...teams,...mlbLeagueTeams].map(t=>{const pool=(t.id.startsWith('mlb-')?mlbOpponentPlayers:players).filter(p=>p.team===t.id).map(p=>({...p,overall:ratingOverall(p)}));const lineup=autoLineup(pool);return [t.id,{lineup,pitchers:autoPitchers(pool),defense:Object.fromEntries(lineup.map((id,i)=>[id,rosterSlots[i]]))}];}));
const batKey=(team:string,id:string)=>`${team}|${id}`;
export const scheduleFor=(state:GameState)=>circuitOf(state.season)!=='NPB'?mlbSchedule(state.club):schedule;
export function nextMatchPreview(state:GameState){
 if(state.season.completed)return null;
 const [home,away]=scheduleFor(state)[state.season.day].find(pair=>pair.includes(state.club))!,opponent=home===state.club?away:home;
 return {home,away,opponent,mine:state.pitchers[state.season.day%6],theirs:defaultTeams[opponent].pitchers[state.season.day%6]};
}

export function playGame(state:GameState,home:string,away:string,random:ReturnType<typeof rng>):GameResult{
 const season=state.season;
 const beforeBat=new Map(Object.entries(season.batting).filter(([,v])=>v.team===home||v.team===away).map(([key,value])=>[key,{...value}]));
 const beforePit=new Map(Object.entries(season.pitching).filter(([,v])=>v.team===home||v.team===away).map(([key,value])=>[key,{...value}]));
 const highlights:PlayHighlight[]=[];
 const forms=new Map(seasonConditions(state).map(c=>[c.playerId,c.boost]));
 const ids=[away,home];
 const rosters=ids.map(id=>id===state.club?{lineup:state.lineup,pitchers:state.pitchers,defense:state.defense}:defaultTeams[id]);
 const opponentTraining=circuitOf(season)==='SPACE'?Object.fromEntries(rosters.flatMap(r=>r.lineup).map(id=>[id,4])):{};
 const line:number[][]=[[],[]];const scores=[0,0];const errors:[number,number]=[0,0];const battingOrder=[0,0];
 const usedPitchers=[new Set<string>(),new Set<string>()];const outsByPitcher=new Map<string,number>();
 const start=rosters.map(r=>r.pitchers[season.day%6]);
 // Fixed CPU adjustments keep NPB approachable and soften the jump to MLB.
 // Space uses the same 30-club schedule with fixed stage-4 opponents and +4 abilities.
 // Their strength is independent of the player, keeping maximum development viable.
 // MLB's own opponents, run environment and NPB transition still make it harder.
 // Apply it to all CPU matchups, including the postseason. Never scale rivals
 // with the user's record or collection, or alter the source/card abilities.
 const opponentAdjustment=circuitOf(season)==='SPACE'?4:circuitOf(season)==='NPB'?-4:-2;
 const bonusFor=(side:number,id:string)=>ids[side]===state.club?Math.min(5,Math.max(0,(state.owned[id]??1)-1))+(forms.get(id)??0):opponentAdjustment;
 const stageFor=(side:number,id:string)=>ids[side]===state.club?(state.training[id]??0):circuitOf(season)==='SPACE'?4:0;
 const fielding=season.fielding??=emptyFielding();
 const defenses=rosters.map((r,side)=>{
  const mine=ids[side]===state.club;
  const f=defenseAdjustment(r.lineup,r.defense,mine?state.owned:{},mine?state.training:opponentTraining,mine?0:opponentAdjustment);
  fielding.games[ids[side]]=(fielding.games[ids[side]]??0)+1;
  const fielders=r.lineup.filter(id=>r.defense[id]!=='DH').map(id=>{
   const player=playerMap[id],ratings=ownedRatings(player,mine?state.owned:{},mine?state.training:opponentTraining),adjustment=mine?0:opponentAdjustment;
   const skill=defenseAtPosition(player,r.defense[id],{...ratings,field:ratings.field+adjustment,catching:ratings.catching+adjustment}).skill;
   const arm=defenseAtPosition(player,r.defense[id],gameRatings(player,bonusFor(side,id),stageFor(side,id))).arm;
   const row=fielding.players[batKey(ids[side],id)]??={playerId:id,team:ids[side],games:0,ballsInPlay:0,rangeRuns:0,errorRuns:0,armRuns:0};row.games++;
   return {id,position:r.defense[id],skill,arm,row};
  });
  const outfield=fielders.filter(p=>p.position==='外');
  const catcherId=r.lineup.find(id=>r.defense[id]==='捕')!,catcher=defenseAtPosition(playerMap[catcherId],'捕',gameRatings(playerMap[catcherId],bonusFor(side,catcherId),stageFor(side,catcherId)));
  return {field:f,fielders,outfield,catcherRow:fielders.find(p=>p.id===catcherId)!.row,arm:outfield.reduce((n,p)=>n+p.arm,0)/Math.max(1,outfield.length),catcherArm:catcher.arm,catcherField:catcher.field};
 });
 const matchupCache=new Map<string,ReturnType<typeof matchupProbabilities>&{rangeSlope:number;errorSlope:number}>();
 let winningPitcher=start[0],losingPitcher=start[1],winningSide=0;
 const starterLimit=start.map((id,side)=>Math.floor(clamp(4.5+pitchingRatingsForRole(playerMap[id],gameRatings(playerMap[id],bonusFor(side,id),stageFor(side,id)),'先').stamina/55+random.next()*1.6,5,8)));
 const latestPitcher=[start[0],start[1]];const enteringLead=new Map<string,number>();
 const getB=(side:number,id:string)=>{
  const key=batKey(ids[side],id);
  return season.batting[key]??=( {playerId:id,team:ids[side],games:0,pa:0,ab:0,hits:0,doubles:0,triples:0,hr:0,rbi:0,runs:0,bb:0,so:0,sb:0,hbp:0,sf:0} );
 };
 const getP=(side:number,id:string)=>{
  const key=batKey(ids[side],id);
  return season.pitching[key]??=({playerId:id,team:ids[side],games:0,starts:0,wins:0,losses:0,saves:0,outs:0,hits:0,er:0,bb:0,so:0,hr:0,hbp:0,bf:0});
 };
 rosters.forEach((r,side)=>r.lineup.forEach(id=>getB(side,id).games++));
 type Runner={id:string;pitcher:string;unearned?:boolean};
 for(let inning=0;inning<(circuitOf(season)!=='NPB'?100:12);inning++){
  for(let side=0;side<2;side++){
   if(side===1&&inning>=8&&scores[1]>scores[0]){line[1].push(-1);break;}
   const defense=1-side;
   const starterDone=inning>=starterLimit[defense]||(inning>=4&&scores[side]>=5);
   const lead=scores[defense]-scores[side];
   const reliefOffset=inning===8&&lead>0&&lead<=3?5:inning===7&&lead>=0&&lead<=3?4:(season.day+Math.max(0,inning-4))%4;
   const preferred=rosters[defense].pitchers[6+reliefOffset];
   const alreadyOut=usedPitchers[defense].has(preferred)&&latestPitcher[defense]!==preferred;
   const relief=alreadyOut?(rosters[defense].pitchers.slice(6).find(id=>!usedPitchers[defense].has(id))??latestPitcher[defense]):preferred;
   const pitcherId=!starterDone?start[defense]:relief;
   const pitcherRole=pitcherSlotRole(rosters[defense].pitchers.indexOf(pitcherId));
   const pitcher=playerMap[pitcherId];const ps=getP(defense,pitcherId);
   if(!usedPitchers[defense].has(pitcherId)){ps.games++;if(inning===0)ps.starts++;usedPitchers[defense].add(pitcherId);enteringLead.set(`${defense}|${pitcherId}`,scores[defense]-scores[side]);}
   latestPitcher[defense]=pitcherId;
   const pitchBonus=bonusFor(defense,pitcherId);
   let out=0,errorOuts=0;let bases:(Runner|null)[]=[null,null,null];let runs=0;
   if(circuitOf(season)!=='NPB'&&!season.postseason&&inning>=9)bases[1]={id:rosters[side].lineup[(battingOrder[side]+8)%9],pitcher:pitcherId,unearned:true};
   const run=(runner:Runner,batter:BatStats,homeRun=false,creditRbi=true)=>{
    if(side===1&&inning>=8&&scores[1]>scores[0]&&!homeRun)return;
    getB(side,runner.id).runs++;if(!runner.unearned&&out+errorOuts<3)getP(defense,runner.pitcher).er++;if(creditRbi)batter.rbi++;scores[side]++;runs++;
    if(scores[side]===scores[defense]+1){winningSide=side;winningPitcher=latestPitcher[side];losingPitcher=runner.pitcher;}
   };
   while(out<3){
    const beforeRuns=scores[side],beforeLead=scores[side]-scores[defense];let play='';
    const id=rosters[side].lineup[battingOrder[side]%9];battingOrder[side]++;
    const pl=playerMap[id],bs=getB(side,id);bs.pa++;ps.bf++;
    const scoringPosition=!!(bases[1]||bases[2]);
    const cacheKey=side+'|'+id+'|'+pitcherId+'|'+Number(scoringPosition);
    let rates=matchupCache.get(cacheKey);if(!rates){
     const field=defenses[defense].field;
     const current=matchupProbabilities(pl,pitcher,bonusFor(side,id),pitchBonus,field,{scoringPosition},stageFor(side,id),stageFor(defense,pitcherId),circuitOf(season),pitcherRole);
     const neutral=matchupProbabilities(pl,pitcher,bonusFor(side,id),pitchBonus,0,{scoringPosition},stageFor(side,id),stageFor(defense,pitcherId),circuitOf(season),pitcherRole);
     const rangeSlope=Math.abs(field)>1e-10?(neutral.babip-current.babip)/field:current.babip>.18&&current.babip<.41?1:0;
     const errorSlope=Math.abs(field)>1e-10?(fieldingErrorRate(0)-fieldingErrorRate(field))/field:.2;
     rates={...current,rangeSlope,errorSlope};matchupCache.set(cacheKey,rates);
    }
    const {walk:walkRate,hbp:hbpRate,strikeout:kRate,homeRun:hrRate,hit:hitRate}=rates;
    const recordContact=()=>{for(const f of defenses[defense].fielders){const share=(f.skill-60)*.0012/defenses[defense].fielders.length;creditFieldingContact(f.row,share*rates.rangeSlope,share*rates.errorSlope/(1-kRate-hrRate));}};
    const roll=random.next();
    if(roll<walkRate+hbpRate){
     if(roll<walkRate){bs.bb++;ps.bb++;play='押し出し四球';}else{bs.hbp++;ps.hbp++;play='押し出し死球';}
     if(bases[0]){if(bases[1]){if(bases[2])run(bases[2],bs);bases[2]=bases[1];}bases[1]=bases[0];}bases[0]={id,pitcher:pitcherId};
    }else{
     bs.ab++;const outcome=(roll-walkRate-hbpRate)/(1-walkRate-hbpRate);
     if(outcome<hitRate){
      bs.hits++;ps.hits++;
      const hitRoll=random.next();let amount=1;
      if(hitRoll<hrRate/hitRate)amount=4;
      else if(hitRoll<hrRate/hitRate+rates.triple/hitRate)amount=3;
      else if(hitRoll<hrRate/hitRate+(rates.triple+rates.double)/hitRate)amount=2;
      play=['','タイムリーヒット','タイムリー二塁打','タイムリー三塁打','本塁打'][amount];
      if(amount===4){bs.hr++;ps.hr++;for(const runner of bases)if(runner)run(runner,bs,true);run({id,pitcher:pitcherId},bs,true);bases=[null,null,null];}
      else{
       recordContact();
       if(amount===3)bs.triples++;if(amount===2)bs.doubles++;
       const advanced:(Runner|null)[]=[null,null,null];
       for(let base=2;base>=0;base--){const runner=bases[base];if(!runner)continue;const bonus=amount===1&&base>=1&&random.next()<extraBaseChance(playerMap[runner.id],bonusFor(side,runner.id),defenses[defense].arm,stageFor(side,runner.id))?1:0;let target=base+amount+bonus;
        if(amount===1&&base===1){
         const d=defenses[defense],current=extraBaseChance(playerMap[runner.id],bonusFor(side,runner.id),d.arm,stageFor(side,runner.id)),neutral=extraBaseChance(playerMap[runner.id],bonusFor(side,runner.id),61,stageFor(side,runner.id));
         const slope=Math.abs(d.arm-61)>1e-10?(neutral-current)/(d.arm-61):current>.12&&current<.75?.003:0;
         for(const f of d.outfield)f.row.armRuns+=(f.arm-61)/d.outfield.length*slope*.3;
        }
        if(target>=3)run(runner,bs);else{while(advanced[target]&&target>0)target--;advanced[target]=runner;}}
       advanced[amount-1]={id,pitcher:pitcherId};bases=advanced;
      }
     }else if(outcome>=Math.max(hitRate+kRate,1-fieldingErrorRate(defenses[defense].field))){
      // A misplayed ball advances each runner one base. It is an AB, not a hit;
      // runs directly caused by the error get neither an RBI nor an earned run.
      errors[defense]++;errorOuts++;play='失策で得点';
      recordContact();
      if(bases[2])run({...bases[2],unearned:true},bs,false,false);
      bases=[{id,pitcher:pitcherId,unearned:true},bases[0],bases[1]];
     }else{
      out++;ps.outs++;outsByPitcher.set(`${defense}|${pitcherId}`,(outsByPitcher.get(`${defense}|${pitcherId}`)??0)+1);
      if(outcome<hitRate+kRate){bs.so++;ps.so++;}
      else recordContact();
     }
    }
    if(scores[side]>beforeRuns)highlights.push({inning:inning+1,team:ids[side],batter:id,pitcher:pitcherId,play,runs:scores[side]-beforeRuns,awayScore:scores[0],homeScore:scores[1],turningPoint:beforeLead<=0&&scores[side]>=scores[defense]});
    if(side===1&&inning>=8&&scores[1]>scores[0])break;
    if(bases[0]&&!bases[1]&&out<3){
     const runner=playerMap[bases[0].id];
     const {attempt:stealChance,success:successRate}=stealProbabilities(runner,bonusFor(side,runner.id),defenses[defense].catcherArm,defenses[defense].catcherField,stageFor(side,runner.id));
     if(random.next()<stealChance){
      const neutral=stealProbabilities(runner,bonusFor(side,runner.id),66,60,stageFor(side,runner.id));defenses[defense].catcherRow.armRuns+=(neutral.success-successRate)*.65;
      if(random.next()<successRate){getB(side,runner.id).sb++;bases[1]=bases[0];}else{out++;ps.outs++;outsByPitcher.set(`${defense}|${pitcherId}`,(outsByPitcher.get(`${defense}|${pitcherId}`)??0)+1);}bases[0]=null;
     }
    }
   }
   line[side].push(runs);
  }
  if(inning>=8&&scores[0]!==scores[1])break;
 }
 const tied=scores[0]===scores[1];
 if(!tied){
  if(winningPitcher===start[winningSide]&&(outsByPitcher.get(`${winningSide}|${winningPitcher}`)??0)<15){winningPitcher=[...usedPitchers[winningSide]].filter(id=>id!==start[winningSide]).sort((a,b)=>(outsByPitcher.get(`${winningSide}|${b}`)??0)-(outsByPitcher.get(`${winningSide}|${a}`)??0))[0]??winningPitcher;}
  getP(winningSide,winningPitcher).wins++;getP(1-winningSide,losingPitcher).losses++;
  const finisher=latestPitcher[winningSide];const lead=enteringLead.get(`${winningSide}|${finisher}`)??0;
  if(finisher!==winningPitcher&&lead>0&&lead<=3&&(outsByPitcher.get(`${winningSide}|${finisher}`)??0)>=3)getP(winningSide,finisher).saves++;
 }
 for(let side=0;side<2;side++){
  const row=season.standings.find(t=>t.team===ids[side])!;row.rf+=scores[side];row.ra+=scores[1-side];
  const result=tied?'D':scores[side]>scores[1-side]?'W':'L';if(result==='W')row.w++;else if(result==='L')row.l++;else row.d++;row.form=[...row.form,result].slice(-5);
 }
 const delta=<T extends BatStats|PitStats>(now:T,previous:T|undefined):T=>Object.fromEntries(Object.entries(now).map(([key,value])=>[key,typeof value==='number'?value-((previous?.[key as keyof T] as number)??0):value])) as unknown as T;
 const batting=rosters.flatMap((r,side)=>r.lineup.map(id=>delta(getB(side,id),beforeBat.get(batKey(ids[side],id)))));
 const pitching=rosters.flatMap((_,side)=>[...usedPitchers[side]].map(id=>delta(getP(side,id),beforePit.get(batKey(ids[side],id)))));
 const winner=tied?null:ids[winningSide];
 const stars=[...batting].filter(b=>!winner||b.team===winner).sort((a,b)=>(b.hits+b.hr*2+b.rbi+b.bb*.25)-(a.hits+a.hr*2+a.rbi+a.bb*.25)).slice(0,1).map(b=>b.playerId);
 return {day:season.day+1,home,away,homeRuns:scores[1],awayRuns:scores[0],innings:line[0].length,line,stars,errors,box:{batting,pitching,highlights}};
}
export function simulateDays(input:GameState,days:number):GameState{
 const state=structuredClone(input);if(state.season.completed)return state;
 const random=rng(state.seed);const end=Math.min(seasonGames(state.season),state.season.day+Math.max(0,Math.floor(days)));
 const fixtures=scheduleFor(state);
 while(state.season.day<end){
  for(const [home,away] of fixtures[state.season.day]){
   const result=playGame(state,home,away,random);
   if(home===state.club||away===state.club)state.season.results.push(result);
  }
  state.season.day++;
  const rank=rankings(state.season,leagueFor(state.season,state.club)).findIndex(t=>t.team===state.club)+1;
  state.season.trend.push(rank);state.gems+=gameReward(state,state.season.results[state.season.results.length-1]);
  state.franchise.xp+=20;
 }
 if(state.season.day===seasonGames(state.season)){state.season.completed=true;state.season.shareTeam=captureSeasonTeam(state);if(!state.season.rewardClaimed){state.gems+=seasonReward(state);state.season.rewardClaimed=true;}}
 state.seed=random.state;return state.season.completed?recordAchievements(settleLeagueProgress(state)):state;
}
export function nextSeason(input:GameState):GameState{
 if(!input.season.completed||input.season.postseason?.stage!=='complete')return input;
 const settled=settleLeagueProgress(claimSeasonGoals(input));
 const compact=(season:Season):Season=>({...season,results:season.results.map(({box,...g})=>g),postseason:season.postseason?{...season.postseason,series:season.postseason.series.map(s=>({...s,results:s.results.map(({box,...g})=>g)}))}:undefined});
 const number=nextSeasonNumber(settled),circuit=settled.leagueChoice??(circuitOf(settled.season)==='SPACE'?'SPACE':leagueProgress(settled).mlbUnlocked?'MLB':'NPB');
 return recordAchievements({...settled,season:emptySeason(number,circuit,input.club),history:[input.season,...input.history.filter(s=>s.number!==input.season.number).map(compact)].sort((a,b)=>b.number-a.number).slice(0,8)});
}
const nextSeasonNumber=(state:GameState)=>Math.max(state.season.number,state.parkedSeason?.number??0,...(state.additionalParkedSeasons??[]).map(s=>s.number),...state.history.map(s=>s.number))+1;
export function switchLeague(input:GameState,target:Circuit):GameState{
 if((target!=='NPB'&&target!=='MLB'&&target!=='SPACE')||target===circuitOf(input.season)||target==='SPACE'&&!spaceUnlocked(input)||target==='MLB'&&!leagueProgress(input).mlbUnlocked)return input;
 const settled=recordAchievements(settleLeagueProgress(claimSeasonGoals(input)));
 const parked=[...(settled.parkedSeason?[settled.parkedSeason]:[]),...(settled.additionalParkedSeasons??[])];
 const season=parked.find(s=>circuitOf(s)===target)??emptySeason(nextSeasonNumber(settled),target,settled.club);
 return recordAchievements({...settled,season,parkedSeason:settled.season,additionalParkedSeasons:parked.filter(s=>circuitOf(s)!==target),leagueChoice:target});
}
export type ScoutFocus='all'|'power'|'pitching'|'defense';
export function scoutWeight(p:Player,focus:ScoutFocus){return (focus==='power'&&p.role==='batter'&&p.ratings.power>=70)||(focus==='pitching'&&p.role==='pitcher')||(focus==='defense'&&p.role==='batter'&&p.ratings.field>=70)?3:1;}
export function drawPlayers(input:GameState,count:1|10,focus:ScoutFocus='all'):GameState{
 if(isCareer(input)&&count!==1)return input;
 const cost=count===10?2700:300;if(input.gems<cost)return input;
 const state=structuredClone(input);const random=rng(state.seed);const pulls:Pull[]=[];let hasHigh=false;
 for(let i=0;i<count;i++){
  const roll=random.next();let rarity:Rarity=roll<.03?'UR':roll<.15?'SSR':roll<.5?'SR':'R';
  let guaranteed=false;state.pity++;
  if(state.pity>=50){rarity='UR';guaranteed=true;}
  if(isCareer(state)&&rarity!=='UR'){const number=state.pulls+i+1;if(number%10===0&&(rarity==='R'||rarity==='SR')){rarity='SSR';guaranteed=true;}else if(number%5===0&&rarity==='R'){rarity='SR';guaranteed=true;}}
  if(count===10&&i===9&&!hasHigh&&rarity==='R'){const r=random.next();rarity=r<.06?'UR':r<.30?'SSR':'SR';guaranteed=true;}
  if(rarity!=='R')hasHigh=true;if(rarity==='UR')state.pity=0;
  const pool=players.filter(p=>p.rarity===rarity);let cursor=random.next()*pool.reduce((n,p)=>n+scoutWeight(p,focus),0);
  const pl=pool.find(p=>{cursor-=scoutWeight(p,focus);return cursor<0;})??pool[pool.length-1];
  const copies=(state.owned[pl.id]??0)+1,trainingReward=copies>6?80:0;state.owned[pl.id]=copies;state.gems+=trainingReward;pulls.push({playerId:pl.id,isNew:copies===1,copies,guaranteed,trainingReward});
 }
 state.gems-=cost;state.pulls+=count;state.lastPulls=pulls;state.seed=random.state;return state;
}

export function redeemURTicket(input:GameState):GameState {
 if(input.franchise.tickets<1)return input;
 const state=structuredClone(input),random=rng(state.seed),pool=players.filter(p=>p.rarity==='UR');
 const player=pool[Math.floor(random.next()*pool.length)],copies=(state.owned[player.id]??0)+1;
 state.franchise.tickets--;state.owned[player.id]=copies;state.seed=random.state;
 const trainingReward=copies>6?80:0;state.gems+=trainingReward;
 state.lastPulls=[{playerId:player.id,copies,isNew:copies===1,guaranteed:true,trainingReward}];
 return state;
}

