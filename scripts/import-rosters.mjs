import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const stats=JSON.parse(await readFile('src/pro/npb2026.json','utf8'));
const previous=JSON.parse(await readFile('src/pro/npb2025.json','utf8'));
const clean=s=>s.replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
const key=s=>s.normalize('NFKC').replace(/[\s・･.]/g,'').replaceAll('髙','高').replaceAll('﨑','崎');
const sources=[],players=[],dates=new Set();
for(const team of stats.teams){
 const url=`https://npb.jp/bis/teams/rst_${team.id}.html`;
 const response=await fetch(url);if(!response.ok)throw Error(`${response.status} ${url}`);
 const html=await response.text();
 const cutoff=clean(html.match(/class="rosterUpdate">([\s\S]*?)<\/div>/)?.[1]??'').match(/(2026)年(\d+)月(\d+)日/);
 if(!cutoff)throw Error(`Missing 2026 roster date: ${url}`);
 dates.add(`${cutoff[1]}-${cutoff[2].padStart(2,'0')}-${cutoff[3].padStart(2,'0')}`);
 let registration=null,position=null,count=0;
 for(const token of html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>|<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){
  if(token[1]){const title=clean(token[1]);if(title.includes('支配下選手'))registration='registered';else if(title.includes('育成選手'))registration='developmental';continue;}
  if(!registration)continue;
  const row=token[2];
  if(token[0].includes('class="rosterRetire"'))continue;
  if(row.includes('rosterPos')){position=clean(row.match(/class="rosterPos">([\s\S]*?)<\/th>/)?.[1]??'');continue;}
  const profile=row.match(/href="(\/bis\/players\/(\d+)\.html)"/);
  if(!profile||!['投手','捕手','内野手','外野手'].includes(position))continue;
  const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>clean(m[1]));
  if(cells.length!==8||!/^\d{4}\.\d{2}\.\d{2}$/.test(cells[2])||!['右','左'].includes(cells[5])||!['右','左','左右'].includes(cells[6]))throw Error(`Invalid roster row: ${cells}`);
  const matches=stats.players.filter(p=>p.team===team.id&&key(p.name)===key(cells[1]));
  if(matches.length>1)throw Error(`Ambiguous name ${cells[1]}`);
  const stat=matches[0];
  const baseId=`${team.id}-${cells[1].replaceAll(' ','')}`;
  const id=stat?.id??(previous.players.some(p=>p.id===baseId)?`${baseId}-2026`:baseId);
  players.push({id,officialId:profile[2],name:stat?.name??cells[1],team:team.id,registration,number:cells[0],registeredPosition:position,birthDate:cells[2].replaceAll('.','-'),height:Number(cells[3]),weight:Number(cells[4]),throws:cells[5],bats:cells[6]==='左右'?'両':cells[6],profileUrl:`https://npb.jp${profile[1]}`,note:cells[7],statsId:stat?.id??null});count++;
 }
 const teamPlayers=players.filter(p=>p.team===team.id);
 const farmUrl=`https://npb.jp/bis/2026/stats/idf2_${team.id}.html`;
 const farmResponse=await fetch(farmUrl);if(!farmResponse.ok)throw Error(`${farmResponse.status} ${farmUrl}`);
 const farmHtml=await farmResponse.text(),farmDate=clean(farmHtml).match(/(2026)年\s*(\d+)月\s*(\d+)日\s*現在/);
 if(!farmDate)throw Error(`Missing farm cutoff: ${farmUrl}`);
 const farmAsOf=`${farmDate[1]}-${farmDate[2].padStart(2,'0')}-${farmDate[3].padStart(2,'0')}`;
 for(const p of teamPlayers){p.farmPositions=[];p.farmAsOf=farmAsOf;}
 const positions={'投手':'投','捕手':'捕','一塁手':'一','二塁手':'二','三塁手':'三','遊撃手':'遊','外野手':'外'};
 for(const block of farmHtml.matchAll(/<h5[^>]*>(.*?)<\/h5>([\s\S]*?)(?=<h5|$)/g)){
  const position=positions[clean(block[1])];if(!position)continue;
  for(const row of block[2].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){
   const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>clean(m[1]));
   if(cells.length<7)continue;
   const p=teamPlayers.find(p=>key(p.name)===key(cells[0].replace(/^[*+]+/,'')));
   if(p&&Number(cells[1])>0)p.farmPositions.push({position,games:Number(cells[1])});
  }
 }
 for(const p of teamPlayers)p.farmPositions.sort((a,b)=>b.games-a.games);
 const registered=teamPlayers.filter(p=>p.registration==='registered').length;
 if(registered<60||registered>70||count<70)throw Error(`Unexpected team coverage ${team.id}: ${registered}/${count}`);
 sources.push({url,sha256:createHash('sha256').update(html).digest('hex'),count,registered,developmental:count-registered,farmUrl,farmAsOf,farmSha256:createHash('sha256').update(farmHtml).digest('hex')});
 console.log(`${team.short}: ${count} (${registered} registered / ${count-registered} developmental)`);
}
if(dates.size!==1)throw Error(`Inconsistent dates: ${[...dates]}`);
if(new Set(players.map(p=>p.id)).size!==players.length)throw Error('Duplicate player ID');
if(new Set(players.map(p=>`${p.team}:${p.officialId}`)).size!==players.length)throw Error('Duplicate team/profile ID');
const unmatchedStats=stats.players.filter(p=>!players.some(r=>r.statsId===p.id)).map(p=>({id:p.id,name:p.name,team:p.team}));
await writeFile('src/pro/rosters2026.json',JSON.stringify({year:2026,asOf:[...dates][0],fetchedAt:new Date().toISOString(),scope:'NPB公式12球団選手一覧の支配下・育成選手全員。監督・コーチを除く。',sources,players,unmatchedStats},null,2));
console.log(JSON.stringify({total:players.length,added:players.filter(p=>!p.statsId).length,unmatchedStats},null,2));
