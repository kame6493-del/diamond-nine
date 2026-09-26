import {writeFile} from 'node:fs/promises';

// Official MLB records are stored separately from the game's ability boosts.
const api='https://statsapi.mlb.com/api/v1';
const get=async path=>{const response=await fetch(api+path);if(!response.ok)throw new Error(`${response.status}: ${path}`);return response.json();};
const roster=await get('/sports/1/players?season=2026');
const japan=roster.people.filter(p=>p.birthCountry==='Japan');
const ids=[...new Set([...japan.map(p=>p.id),506433])]; // Darvish: Padres restricted list, absent from active-season endpoint.
const names={660271:'大谷 翔平',673548:'鈴木 誠也',808967:'山本 由伸',808963:'佐々木 朗希',684007:'今永 昇太',579328:'菊池 雄星',673513:'松井 裕樹',673540:'千賀 滉大',608372:'菅野 智之',807799:'吉田 正尚',672960:'岡本 和真',808959:'村上 宗隆',837227:'今井 達也',506433:'ダルビッシュ 有',807747:'西田 陸浮'};
const people=await get(`/people?personIds=${ids.join(',')}&hydrate=currentTeam,stats(group=[hitting,pitching],type=[season],season=2026)`);
const previous=await get(`/people?personIds=${ids.join(',')}&hydrate=stats(group=[hitting,pitching],type=[season],season=2025)`);
const previousMap=new Map(previous.people.map(p=>[p.id,p]));
const entries=people.people.map(p=>{
 if(!names[p.id])throw new Error(`New Japanese player requires Japanese name: ${p.fullName}`);
 const getStat=(person,group)=>{
  const splits=person.stats?.find(s=>s.group.displayName===group)?.splits.filter(s=>s.sport?.id===1)??[];
  return (splits.find(s=>!s.team)??splits[0])?.stat??null;
 };
 const stats={},statsYear={};
 for(const group of ['hitting','pitching']){
  const current=getStat(p,group),prior=getStat(previousMap.get(p.id),group);
  stats[group]=current??prior;statsYear[group]=current?2026:prior?2025:null;
 }
 const parent=japan.find(q=>q.id===p.id)?.currentTeam?.id??135;
 return {mlbId:p.id,name:names[p.id],englishName:p.fullName,birthDate:p.birthDate,number:p.primaryNumber??'',bats:p.batSide.code,throws:p.pitchHand.code,teamId:parent,currentAssignment:p.currentTeam.name,position:p.primaryPosition.abbreviation,profileUrl:`https://www.mlb.com/player/${p.id}`,statsYear,...stats};
});
const snapshot={asOf:'2026-09-22',sourceUrl:'https://www.mlb.com/international/players',apiUrl:`${api}/sports/1/players?season=2026`,scope:'2026 MLB Japanese players, including current affiliate assignments and Yu Darvish on the restricted list. NPB returnees remain in the NPB roster.',entries};
await writeFile('src/pro/mlb2026.json',JSON.stringify(snapshot,null,2)+'\n');
console.log(entries.map(p=>({name:p.name,team:p.currentAssignment,bat:p.statsYear.hitting,pit:p.statsYear.pitching})));console.log(`Saved ${entries.length} Japanese MLB players.`);
