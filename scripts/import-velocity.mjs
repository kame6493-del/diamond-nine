import fs from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const roster = JSON.parse(await fs.readFile(new URL('src/pro/rosters2026.json', root), 'utf8'));
const cache = new URL('node_modules/.cache/velocity-2026/', root);
await fs.mkdir(cache, { recursive: true });
const clean = s => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
const normal = s => clean(s).normalize('NFKC').replace(/[\s・.]/g, '').replaceAll('髙', '高').replaceAll('﨑', '崎');
const teamIds = {tigers:'t',giants:'g',dragons:'d',baystars:'db',carp:'c',swallows:'s',buffaloes:'b',hawks:'h',fighters:'f',marines:'m',lions:'l',eagles:'e'};
async function get(url) {
 const file = new URL(new URL(url).pathname.replaceAll('/', '_') + '.html', cache);
 try { return await fs.readFile(file, 'utf8'); } catch {}
 const response = await fetch(url, {signal:AbortSignal.timeout(20000)});
 if (!response.ok) throw new Error(`${response.status} ${url}`);
 const html = await response.text(); await fs.writeFile(file, html); return html;
}
const index = await get('https://npbdata.jp/teams/tigers');
const links = [...new Set([...index.matchAll(/href="(\/teams\/[^"?]+)"/g)].map(m=>m[1]))];
const jobs = [];
for(const link of links) {
 const team = teamIds[link.split('/').pop()]; if(!team) continue;
 const html = await get('https://npbdata.jp'+link);
 for(const m of html.matchAll(/<a[^>]+href="(\/players\/\d+\/stats)"[^>]*>([\s\S]*?)<\/a>/g)) {
  const candidates = roster.players.filter(p=>p.team===team&&p.registeredPosition==='投手'&&normal(p.name)===normal(m[2]));
  if(candidates.length===1 && !jobs.some(j=>j.id===candidates[0].id)) jobs.push({id:candidates[0].id,name:candidates[0].name,team,url:'https://npbdata.jp'+m[1]});
 }
}
const entries = [], errors = []; let cursor=0, done=0;
async function worker() {
 while(cursor<jobs.length) {
  const job=jobs[cursor++];
  try {
   const html=await get(job.url);
   const title=clean(html.match(/<title>([\s\S]*?)<\/title>/)?.[1]??'');
   if(!title.includes('2026年度')) throw new Error('Unexpected season: '+title);
   const start=html.indexOf('球種別球速');
   const table=start<0?'':html.slice(start).split('</table>')[0];
   const pitches=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(c=>clean(c[1]))).filter(c=>c.length===4).map(([pitch,avg,max,min])=>({pitch,average:Number(avg),maximum:Number(max),minimum:Number(min)})).filter(p=>p.maximum>=100&&p.maximum<=170&&p.minimum>0&&p.average>=p.minimum&&p.average<=p.maximum);
   const fastest=[...pitches].sort((a,b)=>b.maximum-a.maximum)[0];
   entries.push({...job,year:2026,maximum:fastest?.maximum??null,pitch:fastest?.pitch??null,pitches});
  } catch(e) { errors.push({...job,error:String(e)}); }
  done++; if(done%50===0) console.log(`${done}/${jobs.length} pages checked`);
  await new Promise(r=>setTimeout(r,180));
 }
}
await Promise.all([worker(),worker(),worker()]);
entries.sort((a,b)=>a.id.localeCompare(b.id));
if(entries.filter(p=>p.maximum!==null).length<200) throw new Error('Insufficient coverage; not replacing data');
const result={source:'https://npbdata.jp/',sourceName:'プロ野球データ（Sportsnaviを元にした公開集計）',year:2026,fetchedAt:new Date().toISOString(),asOf:null,note:'2026年度・球種別球速の掲載最速値。集計締切の掲載なし。生涯最速・公式認定記録ではない。欠測を実測値として補完しない。',entries,errors};
await fs.writeFile(new URL('src/pro/velocity2026.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({matched:entries.length,measured:entries.filter(e=>e.maximum!==null).length,missing:roster.players.filter(p=>p.registeredPosition==='投手').length-entries.filter(e=>e.maximum!==null).length,errors:errors.length}));
