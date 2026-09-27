import {pitcherRolePenalty,pitcherSlotRole} from './pitcher-aptitude';
import {mlbLeagueTeams,mlbOpponentPlayers} from './mlb-opponents';
import { assessHandling,assessUZR,type DefenseEvidence,type UzrRecord } from './defense';
import uzrSnapshot from './uzr2026-screenshots.json';
import database from './npb2026.json';
import rosterDatabase from './rosters2026.json';
import velocityDatabase from './velocity2026.json';
import previous from './npb2025.json';
import delta from './delta2026.json';
import { battingMetrics,leagueContext,pitchingMetrics } from './sabermetrics';
import { assessBatting,assessPitching } from './wiki-assessment';
import { applyWikiAssessment,wikiPositionPenalty,type WikiAssessment } from './wiki-players';
import {mlbInfo,mlbPlayers,mlbTeams} from './mlb-players';
import {maskPlayerName,teamLocation,spaceTeams} from './display-names';

export type Rarity = 'UR' | 'SSR' | 'SR' | 'R';
export interface BattingRecord { games:number;pa:number;ab:number;runs:number;hits:number;doubles:number;triples:number;hr:number;tb:number;rbi:number;sb:number;cs:number;sh:number;sf:number;bb:number;ibb:number;hbp:number;so:number;gidp:number;avg:number;slg:number;obp:number }
export interface PitchingRecord { games:number;wins:number;losses:number;saves:number;holds:number;hp:number;cg:number;sho:number;noWalk:number;winPct:number;bf:number;outs:number;hits:number;hr:number;bb:number;ibb:number;hbp:number;so:number;wp:number;balk:number;runs:number;er:number;era:number }
export interface Ratings { contact:number;power:number;speed:number;arm:number;field:number;catching:number;control:number;stamina:number;velocity:number;breaking:number }
export interface Player {
 id:string;name:string;team:string;role:'batter'|'pitcher';position:string;positions:string[];bats:string;throws:string|null;
 batting?:BattingRecord;pitching?:PitchingRecord;fielding:{position:string;games:number;putouts:number;assists:number;errors:number;pct:number}[];
 defenseEvidence:DefenseEvidence;uzrRecord:UzrRecord|null;ratings:Ratings;overall:number;rarity:Rarity;traits:string[];dataYear:number;uzr:number|null;war:number|null;
 roster:(typeof rosterDatabase.players)[number]|null;active:boolean;provisional:boolean;positionSource:'first-team'|'farm'|'registration'|'wiki';velocityRecord:(typeof velocityDatabase.entries)[number]|null;
 opponentOnly?:boolean;wikiAssessment?:WikiAssessment;simulationBaseline?:Ratings;
 mlb?:{id:number;birthDate:string;number:string;profileUrl:string;asOf:string;assignment:string;twoWay:boolean;statsYear:{hitting:number|null;pitching:number|null};pitches:{name:string;level:number}[]};
}
export const teams=database.teams.map(team=>({...team,...teamLocation(team.id)}));
export const sourceInfo=database;
export const rosterInfo=rosterDatabase;
export const velocityInfo=velocityDatabase;
const velocityMap=new Map(velocityDatabase.entries.filter(p=>p.maximum!==null).map(p=>[p.id,p]));
const rosterMap=new Map(rosterDatabase.players.map(p=>[p.id,p]));
export const rosterCoverage={total:rosterDatabase.players.length,registered:rosterDatabase.players.filter(p=>p.registration==='registered').length,developmental:rosterDatabase.players.filter(p=>p.registration==='developmental').length,added:rosterDatabase.players.filter(p=>!p.statsId).length};
export const deltaInfo=delta;
export const uzrInfo=uzrSnapshot;
export const uzrCoverage={numeric:uzrSnapshot.entries.filter(e=>e.playerId&&e.uzr!==null).length,explicitMissing:uzrSnapshot.entries.filter(e=>e.playerId&&e.uzr===null).length,unmatched:uzrSnapshot.entries.filter(e=>!e.playerId).length};
const uzrMap=new Map<string,UzrRecord>(uzrSnapshot.entries.filter(e=>e.playerId).map(e=>[e.playerId!,e]));
export const normalizeName=(name:string)=>name.normalize('NFKC').replace(/[\s　]/g,'').replaceAll('髙','高').replaceAll('﨑','崎');
const deltaMap=new Map(delta.entries.map(x=>[normalizeName(x.name),x as {name:string;uzr?:number;war?:number}]));
export const contexts=Object.fromEntries(['CENTRAL','PACIFIC'].map(league=>[league,leagueContext(database.players.filter(p=>teams.some(t=>t.id===p.team&&t.league===league)) as Player[])]));
const previousContexts=Object.fromEntries(['CENTRAL','PACIFIC'].map(league=>[league,leagueContext(previous.players.filter(p=>teams.some(t=>t.id===p.team&&t.league===league)) as Player[])]));
export const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const scale=(n:number)=>Math.round(clamp(n,15,99));
export const grade=(n:number)=>n>=90?'S':n>=80?'A':n>=70?'B':n>=60?'C':n>=50?'D':n>=40?'E':n>=20?'F':'G';
export const gradeColor=(n:number)=>n>=90?'#a84ad0':n>=80?'#bf7f00':n>=70?'#cf3f5c':n>=60?'#2878c2':n>=50?'#23915f':'#667780';
export const teamById=(id:string,season?:{circuit?:string})=>{
 const team=teams.find(t=>t.id===id)??mlbTeams.find(t=>t.id===id)??mlbLeagueTeams.find(t=>t.id===id)!;
 return season?.circuit==='SPACE'&&spaceTeams[id]?{...team,...spaceTeams[id]}:team;
};

const additions=rosterDatabase.players.filter(p=>!p.statsId).map(p=>({id:p.id,name:p.name,team:p.team,role:p.registeredPosition==='投手'?'pitcher':'batter',position:({'投手':'投','捕手':'捕','内野手':'内','外野手':'外'}[p.registeredPosition]??'DH'),positions:[] as string[],fielding:[],bats:p.bats,throws:p.throws}));
const legacy=previous.players.filter(p=>!database.players.some(q=>q.id===p.id)&&!additions.some(q=>q.id===p.id));
const originalRoles=new Map(database.players.map(p=>[p.id,p.role]));
const rarityScores=new Map<string,number>();
const mapped:Player[]=[...database.players,...legacy,...additions].map(raw=>{
 const p=raw as Omit<Player,'ratings'|'overall'|'rarity'|'traits'|'defenseEvidence'|'uzrRecord'>;
 const b=p.batting; const q=p.pitching; const f=p.fielding.find(x=>x.position===p.position);
 const ab=b?.ab??0; const ip=(q?.outs??0)/3;
 const dataYear=legacy.some(x=>x===raw)?2025:2026;
 const roster=dataYear===2026?rosterMap.get(p.id)??null:null;
 const velocityRecord=dataYear===2026?velocityMap.get(p.id)??null:null;
 const role=roster?(roster.registeredPosition==='投手'?'pitcher':'batter'):p.role;
 const context=(dataYear===2026?contexts:previousContexts)[teamById(p.team).league];
 const bm=b?battingMetrics(b):null,pm=q?pitchingMetrics(q,context.fipConstant):null;
 const publicData=dataYear===2026?deltaMap.get(normalizeName(p.name)):undefined;
 const uzrRecord=dataYear===2026?uzrMap.get(p.id)??null:null;
 const uzr=uzrRecord?.uzr??null,war=publicData?.war??null;
 const avg=((b?.hits??0)+.242*130)/(ab+130);
 const hrRate=((b?.hr??0)+.021*100)/(ab+100);
 const bb9=((q?.bb??0)+3*10/9)/(ip+10)*9;
 const fipReg=((pm?.fip??context.pitching.era??3.1)*ip+(context.pitching.era??3.1)*40)/(ip+40);
 const k9=((q?.so??0)+8*8/9)/(ip+8)*9;
 const peers=(dataYear===2026?database:previous).players.filter(x=>teamById(x.team).league===teamById(p.team).league).flatMap(x=>x.fielding).filter(x=>x.position===p.position);
 const defenseEvidence=assessHandling(f,peers);
 const ratings:Ratings={
  contact:scale(57+(avg-.240)*290+(.20-((b?.so??0)+24)/((b?.pa??0)+120))*32), power:scale(35+hrRate*650+((bm?.iso??.1)*ab+.11*130)/(ab+130)*65),
  speed:scale(41+(b?.sb??0)*1.3+(b?.triples??0)*2),
  arm:scale(52+(p.position==='捕'?14:p.position==='遊'?13:p.position==='外'?9:3)+(f?.assists??0)/70),
  field:assessUZR(uzrRecord).rating,
  catching:defenseEvidence.handling,
  control:scale(94-bb9*5),stamina:scale(36+ip*.28),velocity:velocityRecord?.maximum??Math.round(clamp(140+k9*.9,140,160)),breaking:scale(45+k9*3.2),
 };
 const obpReg=((bm?.obp??.31)*(b?.pa??0)+.31*150)/((b?.pa??0)+150);
 const overall=role==='pitcher'?scale(80-(fipReg-(context.pitching.era??3.1))*10+Math.min(ip,200)*.04-12*(1-Math.min(ip/70,1))):scale(ratings.contact*.27+ratings.power*.32+ratings.speed*.10+ratings.field*.13+obpReg*30+Math.min(ab,500)*.012);
 // Preserve existing card tiers and scout pools while updating actual game abilities.
 const previousField=scale(publicData?.uzr==null?60:60+publicData.uzr*1.65);
 rarityScores.set(p.id,p.role==='pitcher'?overall:scale(ratings.contact*.27+ratings.power*.32+ratings.speed*.10+previousField*.13+obpReg*30+Math.min(ab,500)*.012));
 const traits:string[]=[];
 if(p.role==='batter'){
  if((b?.hr??0)>=20)traits.push('長距離砲'); if((b?.avg??0)>=.280&&ab>=200)traits.push('巧打者');
  if((b?.sb??0)>=15)traits.push('韋駄天');if((b?.bb??0)/Math.max(1,b?.pa??0)>.105)traits.push('選球眼');
  if(ratings.field>=73)traits.push('堅守'); if((b?.doubles??0)>=25)traits.push('ギャップヒッター');
 }else{
  if(k9>=9)traits.push('奪三振');if(bb9<=2.3)traits.push('精密制球');
  if((q?.saves??0)>=20)traits.push('守護神');if((q?.holds??0)>=20)traits.push('鉄腕リリーフ');
  if(ip>=150)traits.push('エース');
 }
 const provisional=role==='pitcher'?!(q?.bf):!(b?.pa);
 return {...p,role,dataYear,uzr,war,uzrRecord,velocityRecord,defenseEvidence,ratings,overall,rarity:'R' as Rarity,traits:provisional?['暫定査定']:traits.length?traits:['実戦派'],roster,active:!!roster,provisional,positionSource:'first-team'};
});
for(const role of ['batter','pitcher']){
 const ordered=mapped.filter(p=>originalRoles.get(p.id)===role&&p.dataYear===2026).sort((a,b)=>rarityScores.get(b.id)!-rarityScores.get(a.id)!);
 ordered.forEach((p,i)=>p.rarity=i<12?'UR':i<55?'SSR':i<165?'SR':'R');
}
// Keep existing card IDs/tiers; the official registration supplies roles even without pitching outs.
for(const p of mapped){
 const r=p.roster;if(!r)continue;
 p.bats=r.bats;p.throws=r.throws;
 p.role=r.registeredPosition==='投手'?'pitcher':'batter';
 p.provisional=p.role==='pitcher'?!(p.pitching?.bf):!(p.batting?.pa);
 if(p.role==='pitcher'){p.position='投';p.positions=[...new Set(['投',...p.positions])];}
 else if(!p.positions.some(pos=>pos!=='投')){
  const farm=r.farmPositions.filter(f=>f.position!=='投');
  p.positions=farm.length?farm.map(f=>f.position):[{'捕手':'捕','内野手':'内','外野手':'外'}[r.registeredPosition]??'DH'];
  p.position=p.positions[0];p.positionSource=farm.length?'farm':'registration';
 }
 if(p.provisional)p.traits=['暫定査定'];
}
// Apply the reference guideline after freezing existing card tiers. Raw records,
// card identities, fielding evidence and published velocities remain intact.
const assessmentContext=Object.fromEntries(teams.map(team=>{
 const leagueBatters=database.players.filter(p=>p.role==='batter'&&teamById(p.team).league===team.league&&p.batting);
 const hits=leagueBatters.reduce((n,p)=>n+(p.batting?.hits??0),0),ab=leagueBatters.reduce((n,p)=>n+(p.batting?.ab??0),0);
 const games=Math.max(1,...database.players.filter(p=>p.team===team.id).map(p=>p.batting?.games??0));
 return [team.id,{average:ab?hits/ab:.25,games}];
}));
for(const p of mapped){
 if(p.dataYear!==2026)continue;
 const before={...p.ratings},context=assessmentContext[p.team];
 if(p.role==='batter'){
  Object.assign(p.ratings,assessBatting(p.batting,context.average,context.games));
  p.overall=scale(p.overall+(p.ratings.contact-before.contact)*.27+(p.ratings.power-before.power)*.32);
 }else{
  Object.assign(p.ratings,assessPitching(p.pitching));
  const skills=clamp((p.ratings.velocity-130)*3,15,99)*.15+p.ratings.control*.30+p.ratings.stamina*.20+p.ratings.breaking*.35;
  p.overall=scale(p.overall*.7+skills*.3);
 }
}
mapped.forEach(applyWikiAssessment);
// Finish all reference matching before applying display aliases. Canonical names
// remain searchable and keep setup/fixtures compatible without exposing them in UI.
const canonicalNames=new Map([...mapped.map(p=>[p.id,p.name] as const),...mlbInfo.entries.map(p=>[`mlb-${p.mlbId}`,p.name] as const)]);
const displayPlayers=mapped.map(p=>({...p,name:maskPlayerName(p.name)}));
export const npbPlayers=displayPlayers.filter(p=>p.active);
export const players=[...npbPlayers,...mlbPlayers];
export const activeUzrCount=players.filter(p=>p.uzr!==null).length;
export const canBat=(p:Player)=>p.role==='batter'||((p.batting?.pa??0)>0&&p.positions.some(pos=>pos!=='投'));
// Old versions misclassified five pitchers with zero recorded outs as batters.
export const wasLegacyBatter=(id:string)=>originalRoles.get(id)==='batter';
export const fitsPosition=(p:Player,pos:string)=>pos==='DH'||p.positions.includes(pos)||(p.positions.includes('内')&&['一','二','三','遊'].includes(pos));
export const playerMap=Object.fromEntries([...displayPlayers,...mlbPlayers,...mlbOpponentPlayers].map(p=>[p.id,p]));
export const findPlayer=(name:string)=>{
 const query=normalizeName(name),pool=[...players,...displayPlayers];
 return (pool.find(p=>normalizeName(canonicalNames.get(p.id)??p.name)===query)??pool.find(p=>normalizeName(p.name)===query))!;
};
export const matchesPlayerName=(p:Player,search:string)=>{
 const query=normalizeName(search);
 return normalizeName(p.name).includes(query)||normalizeName(canonicalNames.get(p.id)??p.name).includes(query);
};
export const contextFor=(p:Player)=>p.mlb?contexts.CENTRAL:(p.dataYear===2026?contexts:previousContexts)[teamById(p.team).league];
export const saberFor=(p:Player)=>({batting:p.batting?battingMetrics(p.batting):null,pitching:p.pitching?pitchingMetrics(p.pitching,contextFor(p).fipConstant):null});
export const positionLabel=(pos:string)=>({投:'投手',捕:'捕手',一:'一塁手',二:'二塁手',三:'三塁手',遊:'遊撃手',外:'外野手',内:'内野手',DH:'指名打者'}[pos]??pos);
export const formatAvg=(n:number)=>n.toFixed(3).replace(/^0/,'');
export const formatIP=(outs:number)=>`${Math.floor(outs/3)}.${outs%3}`;
export const rosterSlots=['捕','一','二','三','遊','外','外','外','DH'];
export function autoLineup(pool:Player[]):string[]{
 const used=new Set<string>();
 return rosterSlots.map(pos=>{
  const available=pool.filter(p=>canBat(p)&&!used.has(p.id));
  const fit=available.filter(p=>fitsPosition(p,pos));
  const best=(fit.length?fit:available).sort((a,b)=>(b.overall-wikiPositionPenalty(b,pos)*.14)-(a.overall-wikiPositionPenalty(a,pos)*.14))[0];
  if(!best)return '';used.add(best.id);return best.id;
 });
}
export function autoPitchers(pool:Player[],strict=false):string[]{
 const pitchers=pool.filter(p=>p.role==='pitcher').sort((a,b)=>b.overall-a.overall||a.id.localeCompare(b.id));
 // Bipartite assignment reserves scarce aptitudes instead of spending a closer
 // or dual-role arm on an earlier slot and filling the final slot out of role.
 const choices=Array.from({length:14},(_,i)=>pitchers.filter(p=>pitcherRolePenalty(p,pitcherSlotRole(i))===0));
 const assignments=new Map<string,number>(),slots=Array<string>(14);
 const assign=(slot:number,seen:Set<string>):boolean=>{
  for(const p of choices[slot]){if(seen.has(p.id))continue;seen.add(p.id);const old=assignments.get(p.id);
   if(old===undefined||assign(old,seen)){assignments.set(p.id,slot);slots[slot]=p.id;return true;}}
  return false;
 };
 const order=Array.from({length:14},(_,i)=>i).sort((a,b)=>choices[a].length-choices[b].length||a-b);
 for(const slot of order)if(!assign(slot,new Set())&&strict)return [];
 // CPU/reference rosters may lack enough published role grades. Keep games
 // playable there; user auto-formation always opts into the strict path.
 if(!strict)for(let i=0;i<14;i++)if(!slots[i]){const available=pitchers.filter(p=>!slots.includes(p.id)).sort((a,b)=>pitcherRolePenalty(a,pitcherSlotRole(i))-pitcherRolePenalty(b,pitcherSlotRole(i))||b.overall-a.overall);if(available[0])slots[i]=available[0].id;}
 return slots.filter(Boolean);
}
