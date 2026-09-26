import {writeFile} from 'node:fs/promises';
const root='https://statsapi.mlb.com/api/v1';
const get=async path=>{const r=await fetch(root+path);if(!r.ok)throw new Error(`${r.status}: ${path}`);return r.json();};
const [teamData,batData,pitData]=await Promise.all([get('/teams?sportId=1&season=2026'),get('/stats?stats=season&group=hitting&sportIds=1&season=2026&playerPool=ALL&limit=2000'),get('/stats?stats=season&group=pitching&sportIds=1&season=2026&playerPool=ALL&limit=2000')]);
const index=(data,key)=>{const map=new Map();for(const s of data.stats[0].splits){if(!map.has(s.player.id)||s.stat[key]>map.get(s.player.id)[key])map.set(s.player.id,s.stat);}return map;};
const batting=index(batData,'plateAppearances'),pitching=index(pitData,'battersFaced');
const teams=teamData.teams.filter(t=>t.active).sort((a,b)=>a.id-b.id).map(t=>({id:t.id,name:t.name,short:t.teamName,mark:t.abbreviation,league:t.league.id===103?'AMERICAN':'NATIONAL',division:t.division.id}));
const entries=[];
for(let offset=0;offset<teams.length;offset+=5){
 const batch=teams.slice(offset,offset+5);
 const rosters=await Promise.all(batch.map(t=>get(`/teams/${t.id}/roster/40Man?season=2026`)));
 rosters.forEach((roster,i)=>{for(const r of roster.roster){const id=r.person.id;entries.push({id,team:batch[i].id,name:r.person.fullName,number:r.jerseyNumber??'',position:r.position.abbreviation,batting:batting.get(id)??null,pitching:pitching.get(id)??null});}});
}
if(teams.length!==30||entries.length<900)throw new Error('Incomplete MLB opponent roster');
await writeFile('src/pro/mlb-opponents2026.json',JSON.stringify({asOf:new Date().toISOString().slice(0,10),source:root,teams,entries},null,1));
console.log(`MLB opponents: ${teams.length} teams, ${entries.length} roster entries`);
