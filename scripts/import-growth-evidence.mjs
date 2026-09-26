import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const roster=JSON.parse(await readFile('src/pro/rosters2026.json','utf8'));
const cache='scripts/data/growth-cache';await mkdir(cache,{recursive:true});
const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
const key=s=>clean(s).normalize('NFKC').replace(/^[*+]+/,'').replace(/[\s・･.]/g,'').replaceAll('髙','高').replaceAll('﨑','崎');
const sources=[];
async function page(url){
 const file=`${cache}/${createHash('sha256').update(url).digest('hex')}.html`;
 let html;try{html=await readFile(file,'utf8');}catch{
  for(let attempt=0;attempt<3;attempt++){try{const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(`${r.status} ${url}`);html=await r.text();break;}catch(e){if(attempt===2)throw e;await new Promise(resolve=>setTimeout(resolve,1000));}}
  await writeFile(file,html);
 }
 sources.push({url,sha256:createHash('sha256').update(html).digest('hex')});return html;
}
function draft(raw){
 const year=Number(raw.match(/(\d{4})年/)?.[1])||null,rank=Number(raw.match(/(\d+)(?:位|巡目)/)?.[1])||null;
 const type=raw.includes('育成')?'developmental':/自由|希望|逆指名/.test(raw)?'priority':rank?'regular':null;
 if(raw&&(!year||!type))throw Error(`Unknown draft text: ${raw}`);
 return {year,rank,type,league:'NPB',pick:null};
}
function career(html,kind){
 const section=html.split(`id="stats_${kind}"`)[1]?.split('</div>')[0]??'';
 const flat=section.replace(/<table class="table_inning">[\s\S]*?<\/table>/g,m=>clean(m).replace(/\s/g,''));
 const headers=[...flat.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m=>clean(m[1]));
 const records=[];
 for(const row of flat.matchAll(/<tr class="registerStats">([\s\S]*?)<\/tr>/g)){
  const cells=[...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m=>clean(m[1]));if(!/^\d{4}$/.test(cells[0]))continue;
  const obj=Object.fromEntries(headers.map((h,i)=>[h,cells[i]])),n=h=>Number(obj[h])||0;
  const ip=(obj['投球回']??'0').replaceAll('+','')||'0',outs=Math.trunc(Number(ip))*3+Number(ip.split('.')[1]??0);
  if(!Number.isInteger(outs))throw Error(`Invalid innings: ${obj['投球回']}`);
  records.push(kind==='b'?{year:n('年度'),pa:n('打席'),ab:n('打数'),hits:n('安打'),hr:n('本塁打'),bb:n('四球'),so:n('三振'),obp:n('出塁率'),slg:n('長打率')}:{year:n('年度'),bf:n('打者'),outs,so:n('三振'),bb:n('四球'),hr:n('本塁打'),er:n('自責点')});
 }
 return records;
}
let complete=0;const entries=new Array(roster.players.length);let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
 while(cursor<roster.players.length){const index=cursor++,p=roster.players[index],html=await page(p.profileUrl);
  const raw=clean(html.match(/<th>ドラフト<\/th>\s*<td>([\s\S]*?)<\/td>/)?.[1]??'');
  if(!html.includes('<th>生年月日</th>'))throw Error(`Not a player profile: ${p.id}`);
  const batting=career(html,'b'),pitching=career(html,'p'),years=[...batting,...pitching].map(s=>s.year);
  entries[index]={id:p.id,source:p.profileUrl,birthDate:p.birthDate,draft:draft(raw),debutYear:years.length?Math.min(...years):null,batting,pitching,farmBatting:null,farmPitching:null};
  if(++complete%100===0)console.log(`Profiles ${complete}/${roster.players.length}`);
 }
}));
for(const team of [...new Set(roster.players.map(p=>p.team))]){
 for(const type of ['b','p']){
  const url=`https://npb.jp/bis/2026/stats/id${type}2_${team}.html`,html=await page(url),section=html.split('class="tablefix2"')[1]?.split('</table>')[0];if(!section)throw Error(`Missing farm table ${url}`);
  let matched=0;
  for(const row of section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)){
   const c=[...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m=>clean(m[1]));if(c.length<20)continue;
   const p=roster.players.find(p=>p.team===team&&key(p.name)===key(c[0]));if(!p)continue;
   const e=entries.find(e=>e.id===p.id),n=i=>Number(c[i])||0;
   if(type==='b'){if(c.length!==23)throw Error(`Farm batting columns ${c.length}`);e.farmBatting={pa:n(2),ab:n(3),hits:n(5),hr:n(8),bb:n(15),so:n(18),obp:n(22),slg:n(21)};}
   else{if(c.length!==22)throw Error(`Farm pitching columns ${c.length}`);const innings=c[10].replace(/[\s+]/g,'')||'0',outs=Math.trunc(Number(innings))*3+Number(innings.split('.')[1]??0);if(!Number.isInteger(outs))throw Error(`Invalid farm innings ${c[10]}`);e.farmPitching={bf:n(9),outs,so:n(16),bb:n(13),hr:n(12),er:n(20)};}
   matched++;
  }
  if(matched<15)throw Error(`Too few farm players: ${url} ${matched}`);
 }
 console.log(`Farm ${team}`);
}
const japanese=JSON.parse(await readFile('src/pro/mlb2026.json','utf8')).entries;
const rivals=JSON.parse(await readFile('src/pro/mlb-opponents2026.json','utf8')).entries;
const mlbIds=[...new Set([...japanese.map(p=>p.mlbId),...rivals.map(p=>p.id)])];
for(let offset=0;offset<mlbIds.length;offset+=50){
 const url=`https://statsapi.mlb.com/api/v1/people?personIds=${mlbIds.slice(offset,offset+50).join(',')}&hydrate=draft`;
 const people=JSON.parse(await page(url)).people;if(people.length!==mlbIds.slice(offset,offset+50).length)throw Error('MLB people coverage');
 for(const p of people){
  const pick=p.drafts?.filter(d=>Number(d.year)===p.draftYear).at(-1)??p.drafts?.at(-1),japan=japanese.find(j=>j.mlbId===p.id);
  let evidence={id:`mlb-${p.id}`,source:url,birthDate:p.birthDate,draft:{year:pick?Number(pick.year):null,rank:pick?parseInt(pick.pickRound)||null:null,type:pick?'regular':null,league:'MLB',pick:pick?.pickNumber??null},debutYear:p.mlbDebutDate?Number(p.mlbDebutDate.slice(0,4)):null,batting:[],pitching:[],farmBatting:null,farmPitching:null};
  if(japan&&p.id!==807747){
   const search=`https://npb.jp/bis/players/search/result?search_keyword=${encodeURIComponent(japan.name.replace(/\s/g,''))}`,result=await page(search);
   const matches=[...result.matchAll(/<a href="(\/bis\/players\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/g)].filter(m=>key(m[2].match(/<dd class="name">([\s\S]*?)<\/dd>/)?.[1]??'')===key(japan.name));
   if(matches.length!==1)throw Error(`Japanese MLB profile ambiguous: ${japan.name}`);
   const profileUrl=`https://npb.jp${matches[0][1]}`,html=await page(profileUrl),birth=clean(html.match(/<th>生年月日<\/th>\s*<td>([\s\S]*?)<\/td>/)?.[1]??'').match(/(\d+)年(\d+)月(\d+)日/);
   if(!birth||`${birth[1]}-${birth[2].padStart(2,'0')}-${birth[3].padStart(2,'0')}`!==japan.birthDate)throw Error(`Profile birthday mismatch: ${japan.name}`);
   const batting=career(html,'b'),pitching=career(html,'p'),years=[...batting,...pitching].map(s=>s.year);
   evidence={...evidence,source:profileUrl,draft:draft(clean(html.match(/<th>ドラフト<\/th>\s*<td>([\s\S]*?)<\/td>/)?.[1]??'')),debutYear:years.length?Math.min(...years):evidence.debutYear,batting,pitching};
  }
  entries.push(evidence);
 }
 console.log(`MLB evidence ${Math.min(offset+50,mlbIds.length)}/${mlbIds.length}`);
}
await writeFile('src/pro/growth-evidence2026.json',JSON.stringify({asOf:'2026-09-22',fetchedAt:new Date().toISOString(),method:'NPB official player profiles and 2026 farm stats; MLB official profiles/draft. Draft facts and performance evidence, not official potential ratings.',sources,entries},null,2)+'\n');
console.log(JSON.stringify({players:entries.length,drafted:entries.filter(e=>e.draft.year).length,farmBatting:entries.filter(e=>e.farmBatting?.pa>0).length,farmPitching:entries.filter(e=>e.farmPitching?.outs>0).length}));
