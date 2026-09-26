import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url);
const snapshot=JSON.parse(await fs.readFile(new URL('scripts/data/wiki-2026-browser.json',root),'utf8'));
const roster=JSON.parse(await fs.readFile(new URL('src/pro/rosters2026.json',root),'utf8')).players;
const teamIds={'阪神':'t','巨人':'g','DeNA':'db','広島':'c','ヤクルト':'s','中日':'d','ソフトバンク':'h','日本ハム':'f','オリックス':'b','楽天':'e','西武':'l','ロッテ':'m'};
const normal=s=>s.normalize('NFKC').replace(/[\s・.]/g,'').replaceAll('髙','高').replaceAll('﨑','崎');
// Explicitly reviewed notation differences; never match an unrelated player by number alone.
const aliases={'m|菊池':'m-菊地吏玖','h|スチュワートJr':'h-スチュワート・ジュニア'};
const entries=[],unmatched=[],excluded=[],sources=[],seen=new Set();
for(const page of snapshot){
 const team=teamIds[page.title.replace(/^2026\(新\)\s*/,'')];if(!team)throw Error('Unknown team '+page.title);
 sources.push({team,title:page.title,url:page.url,updatedAt:page.updated.replace('最終更新：',''),rows:page.rows.length,sha256:crypto.createHash('sha256').update(JSON.stringify(page.rows)).digest('hex')});
 for(const row of page.rows){
  const heading=row.heading.normalize('NFKC'),match=heading.match(/^\[\s*([\d.]+)\s*\]\s*(.*)/);if(!match)throw Error('Invalid heading '+heading);
  const number=match[1].replaceAll('.',''),name=normal(match[2].replace(/\(.*$/,''));
  if(row.ratings.every(v=>v===null)){excluded.push({team,heading:row.heading,reason:'移籍・退団先への案内のみで能力掲載なし'});continue;}
  let candidates=roster.filter(p=>p.team===team&&(normal(p.name).includes(name)||name.includes(normal(p.name))));
  if(aliases[team+'|'+name])candidates=roster.filter(p=>p.id===aliases[team+'|'+name]&&p.number===number);
  const byNumber=candidates.filter(p=>p.number===number);
  if(byNumber.length===1)candidates=byNumber;
  if(candidates.length!==1){if(!candidates.length&&/→(?:退団|引退)/.test(heading)){excluded.push({team,heading:row.heading,reason:'現所属の公式名簿にいない退団・引退選手'});continue;}unmatched.push({team,heading:row.heading,number,name,candidates:candidates.map(p=>p.id),numberCandidates:roster.filter(p=>p.team===team&&p.number===number).map(p=>p.id)});continue;}
  const p=candidates[0];if(seen.has(p.id))throw Error('Duplicate '+p.id);seen.add(p.id);
  const keys=['contact','power','speed','arm','field','catching','velocity','control','stamina','trajectory'];
  const ratings=Object.fromEntries(keys.flatMap((k,i)=>row.ratings[i]===null?[]:[[k,row.ratings[i]]]));
  if(keys.slice(0,5).some(k=>ratings[k]===undefined))throw Error('Missing main abilities '+p.id);
  const positionLevels=Object.fromEntries([...row.position.matchAll(/([捕一二三遊外投])([1-7])/g)].map(m=>[m[1],Number(m[2])]));
  const pitcherRoles=Object.fromEntries([...row.pitcherRoles.matchAll(/([先中抑])([◎○△])/g)].map(m=>[m[1],m[2]]));
  entries.push({id:p.id,name:p.name,team,sourceNumber:number,sourceName:row.heading,sourceUrl:page.url+'#'+row.anchor,performanceYears:row.performanceYears,ratings,positionLevels,pitcherRoles,pitches:row.pitches,secondFastball:row.secondFastball||null,traits:[...new Set(row.traits)]});
 }
}
if(sources.length!==12||new Set(sources.map(p=>p.team)).size!==12)throw Error('All 12 teams are required');
const result={sourceName:'パワプロNPB実在選手限定 能力査定 @ ウィキ',edition:2026,retrievedAt:new Date().toISOString(),note:'2026(新)の12球団ページに掲載された選手別査定。本文の実績年度とは別。能力数値・球種・適性を記録し、解説文章・画像・デザインは転載しない。',sources,entries,unmatched,excluded};
await fs.writeFile(new URL('src/pro/wiki2026.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({sources:sources.length,matched:entries.length,excluded:excluded.length,unmatched},null,2));
