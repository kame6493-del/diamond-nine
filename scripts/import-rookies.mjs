import {readFile,writeFile} from 'node:fs/promises';
const roster=JSON.parse(await readFile('src/pro/rosters2026.json','utf8'));
const clean=s=>s.normalize('NFKC').replace(/[\s　]/g,'').replaceAll('髙','高').replaceAll('﨑','崎');
const aliases={'エドポロクリストファケインセカンド':'エドポロケイン','田中大聖':'大聖'};
const entries=[],sources=[];
for(const team of ['t','g','db','c','s','d','h','f','m','e','b','l']){
 const url=`https://draft.npb.jp/draft/2025/draftlist_${team}.html`;
 const response=await fetch(url);if(!response.ok)throw new Error(`${url}: ${response.status}`);
 const html=await response.text();
 const names=[...html.matchAll(/<td[^>]*class="name"[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1].replace(/<[^>]*>/g,'').trim());
 if(names.length<4)throw new Error(`Missing draft rows: ${team}`);
 for(const name of names){const normalized=aliases[clean(name)]??clean(name);const p=roster.players.find(p=>p.team===team&&clean(p.name)===normalized);if(p)entries.push({id:p.id,source:url});else console.log('Not in current roster',team,name);}
 sources.push({team,url,listed:names.length});
}
await writeFile('src/pro/rookies2026.json',JSON.stringify({year:2026,definition:'2025年NPBドラフト（育成含む）指名選手のうち2026年収録名簿と氏名・球団が一致した選手',sources,entries},null,2)+'\n');
console.log(`Imported ${entries.length} rookies across ${sources.length} teams.`);
