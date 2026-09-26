import { mkdir, writeFile } from 'node:fs/promises';
const year=Number(process.argv[2]||2026);
if(!Number.isInteger(year)||year<2025||year>2026)throw new Error('Supported year: 2025 or 2026');
const asOfDates=new Set();

const teams = [
 ['t','阪神タイガース','阪神','T','CENTRAL','#edbd43'],['g','読売ジャイアンツ','巨人','G','CENTRAL','#ef8340'],
 ['db','横浜DeNAベイスターズ','DeNA','DB','CENTRAL','#2789de'],['c','広島東洋カープ','広島','C','CENTRAL','#e74b57'],
 ['s','東京ヤクルトスワローズ','ヤクルト','YS','CENTRAL','#77bf65'],['d','中日ドラゴンズ','中日','D','CENTRAL','#577fdf'],
 ['h','福岡ソフトバンクホークス','ソフトバンク','H','PACIFIC','#f5c44c'],['f','北海道日本ハムファイターズ','日本ハム','F','PACIFIC','#50a9d6'],
 ['b','オリックス・バファローズ','オリックス','B','PACIFIC','#bba16d'],['e','東北楽天ゴールデンイーグルス','楽天','E','PACIFIC','#c7526b'],
 ['l','埼玉西武ライオンズ','西武','L','PACIFIC','#91acc9'],['m','千葉ロッテマリーンズ','ロッテ','M','PACIFIC','#adb6bd'],
].map(([id,name,short,mark,league,color])=>({id,name,short,mark,league,color}));
const clean = s=>s.replace(/<[^>]+>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
const nameOf=s=>s.replace(/^[*+]+/,'').trim();
const rows=html=>[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>clean(x[1])));
const num=s=>Number(s)||0;
const outs=s=>{const parts=s.match(/(\d+)(?:\s+(\d)\/3)?/);return parts?Number(parts[1])*3+Number(parts[2]||0):0;};
const players=[];
const sources=[];
for(const team of teams){
 const urls=['b','p','f'].map(type=>`https://npb.jp/bis/${year}/stats/id${type}1_${team.id}.html`);
 const results=await Promise.allSettled(urls.map(async url=>{const r=await fetch(url);if(!r.ok)throw new Error(`${r.status}: ${url}`);return r.text();}));
 for(const result of results)if(result.status==='rejected')throw result.reason;
 const [bat,pit,field]=results.map(r=>r.value);
 for(const html of [bat,pit,field]){const date=clean(html).match(/(202\d)年\s*(\d+)月\s*(\d+)日\s*現在/);if(year===2026&&!date)throw new Error('Missing statistics cutoff');if(date)asOfDates.add(`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`);}
 const records=new Map();
 const ensure=name=>{if(!records.has(name))records.set(name,{id:`${team.id}-${name.replaceAll(' ','')}`,name,team:team.id,positions:[],fielding:[]});return records.get(name);};
 for(const r of rows(bat).filter(r=>r.length===23&&/\d/.test(r[1]))){
  const p=ensure(nameOf(r[0]));p.bats=r[0].startsWith('*')?'左':r[0].startsWith('+')?'両':'右';
  p.batting=Object.fromEntries(['games','pa','ab','runs','hits','doubles','triples','hr','tb','rbi','sb','cs','sh','sf','bb','ibb','hbp','so','gidp','avg','slg','obp'].map((key,i)=>[key,num(r[i+1])]));
 }
 for(const r of rows(pit).filter(r=>r.length===24&&/\d/.test(r[1]))){
  const p=ensure(nameOf(r[0]));p.throws=r[0].startsWith('*')?'左':'右';
  p.pitching=Object.fromEntries(['games','wins','losses','saves','holds','hp','cg','sho','noWalk','winPct','bf','outs','hits','hr','bb','ibb','hbp','so','wp','balk','runs','er','era'].map((key,i)=>[key,key==='outs'?outs(r[i+1]):num(r[i+1])]));
 }
 const positionNames={'投手':'投','捕手':'捕','一塁手':'一','二塁手':'二','三塁手':'三','遊撃手':'遊','外野手':'外'};
 for(const block of field.matchAll(/<h5[^>]*>(.*?)<\/h5>([\s\S]*?)(?=<h5|$)/gi)){
  const pos=positionNames[clean(block[1])]; if(!pos)continue;
  for(const r of rows(block[2]).filter(r=>r.length>=7&&/\d/.test(r[1]))){
   const p=ensure(nameOf(r[0]));p.fielding.push({position:pos,games:num(r[1]),putouts:num(r[2]),assists:num(r[3]),errors:num(r[4]),pct:num(r[6])});
  }
 }
 for(const p of records.values()){
  p.fielding.sort((a,b)=>b.games-a.games);p.positions=p.fielding.map(f=>f.position);
  p.role=p.pitching&&p.pitching.outs>0?'pitcher':'batter';
  p.position=p.role==='pitcher'?'投':p.positions.find(x=>x!=='投')||'DH';
  p.bats??='右';p.throws??=null;
  players.push(p);
 }
 sources.push(...urls);
 console.log(`${team.short}: ${records.size} players`);
}
if(players.length<600)throw new Error(`Unexpectedly small dataset: ${players.length}`);
await mkdir('src/pro',{recursive:true});
if(asOfDates.size>1)throw new Error(`Inconsistent cutoffs: ${[...asOfDates]}`);
await writeFile(`src/pro/npb${year}.json`,JSON.stringify({year,asOf:[...asOfDates][0]||`${year}-12-31`,fetchedAt:new Date().toISOString(),scope:`${year}年NPB一軍公式戦の打撃・投球・守備成績掲載選手。育成・二軍のみ出場の選手は対象外。`,sources,teams,players},null,2));
console.log(`Saved ${players.length} players across ${teams.length} teams.`);
