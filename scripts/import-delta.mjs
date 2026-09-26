import { writeFile } from 'node:fs/promises';
const url='https://1point02.jp/op/';
const response=await fetch(url);
if(!response.ok)throw new Error(`DELTA ${response.status}`);
const html=await response.text();
const plain=html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
const entries=new Map();
for(const match of plain.matchAll(/(UZR|WAR)リーダーズ\s*-\s*(?:守備|野手|投手)\s*-\s*(.*?)\s+(-?\d+\.\d+)/g)){
 const name=match[2].normalize('NFKC').replace(/\s/g,'');
 entries.set(name,{...entries.get(name),name,[match[1].toLowerCase()]:Number(match[3])});
}
if([...entries.values()].filter(x=>x.uzr!==undefined).length!==12)throw new Error('Public leaderboard structure changed; no data written');
await writeFile('src/pro/delta2026.json',JSON.stringify({year:2026,fetchedAt:new Date().toISOString(),asOf:null,source:url,scope:'DELTA 1.02 トップページの公開球団別リーダー。全選手ランキングではありません。トップページに集計基準日の明記がないため、取得日時を表示します。',entries:[...entries.values()]},null,2));
console.log(`Saved ${entries.size} public leaders, 12 UZR records. Cutoff unspecified by source.`);
