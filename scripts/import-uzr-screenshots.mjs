import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// Audited transcription of user-supplied images. Never treat the dashboard's Def column as UZR.
const root=new URL('../',import.meta.url);
const database=JSON.parse(await readFile(new URL('src/pro/npb2026.json',root),'utf8'));
const sourceDirectory=process.argv[2]??resolve(process.env.USERPROFILE,'Pictures/Screenshots');
const normalize=name=>name.normalize('NFKC').replace(/[\s　・･]/g,'').replaceAll('髙','高').replaceAll('﨑','崎');
const teamCodes={T:'t',G:'g',DB:'db',C:'c',S:'s',D:'d',H:'h',F:'f',B:'b',E:'e',L:'l',M:'m'};
const ranges=[[1,20,'230806'],[21,40,'230811'],[41,60,'230816'],[61,80,'230821'],[81,100,'230825'],[101,120,'230829'],[121,140,'230833'],[141,160,'230837'],[161,180,'230842'],[182,200,'230847'],[201,220,'230850'],[561,580,'230917'],[581,600,'230911'],[601,620,'230907'],[621,640,'230903'],[641,660,'230859']];
const fileName=time=>`スクリーンショット 2026-09-21 ${time}.png`;
const sources=await Promise.all(['230758',...ranges.map(r=>r[2])].map(async time=>{const file=fileName(time),bytes=await readFile(resolve(sourceDirectory,file));return {file,sha256:createHash('sha256').update(bytes).digest('hex')};}));
const rows=(await readFile(new URL('scripts/data/uzr2026-screenshots.tsv',root),'utf8')).replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(line=>!line.startsWith('#'));
const ranks=new Set(),ids=new Set();let last=Infinity;
const entries=rows.map(line=>{
 const [rankText,code,name,inningsText,uzrText,per1200Text]=line.split('|'),rank=Number(rankText),team=teamCodes[code];
 const match=inningsText?.match(/^(\d+)(?:\.([12]))?$/);
 const range=ranges.find(([start,end])=>rank>=start&&rank<=end);
 if(!team||!Number.isInteger(rank)||ranks.has(rank)||!match||!range)throw Error(`Invalid row: ${line}`);
 ranks.add(rank);const outs=Number(match[1])*3+Number(match[2]??0),uzr=uzrText==='-'?null:Number(uzrText);
 if(uzr!==null&&(!Number.isFinite(uzr)||uzr>last||outs===0))throw Error(`Invalid UZR/order: ${line}`);
 const per1200=per1200Text==='-'?null:Number(per1200Text);
 if(uzr!==null){
  if(!Number.isFinite(per1200))throw Error('Missing rate: '+line);
  const reconstructed=per1200*outs/3/1200,tolerance=.050001+outs/3/1200*.050001;
  if(Math.abs(reconstructed-uzr)>tolerance)throw Error('UZR/innings/rate mismatch: '+line);
  last=uzr;
 }
 const candidates=[normalize(name),normalize(name.replace(/^[A-Z]・/,''))];
 const matches=database.players.filter(p=>p.team===team&&candidates.includes(normalize(p.name)));
 if(matches.length>1)throw Error(`Ambiguous name: ${line}`);
 const playerId=matches[0]?.id??null;
 if(playerId&&ids.has(playerId))throw Error(`Duplicate player: ${playerId}`);
 if(playerId)ids.add(playerId);
 return {rank,team,name,outs,uzr,per1200,playerId,sourceFile:fileName(range[2]),...(playerId?{}:{note:'画像の球団・選手名に一致するNPBレコードがないため未適用。'})};
});
if(entries.length!==319||entries.filter(e=>e.playerId&&e.uzr!==null).length!==314)throw Error('Unexpected coverage; review transcription/matching.');
const data={year:2026,asOf:'2026-09-21',sourceType:'user-supplied-screenshots',source:'https://1point02.jp/op/gnav/leaders/pl/pfs_advanced.aspx',scope:'提供画像のUZR列を転記。1〜220位（181位は画像外）・561〜660位。ダッシュボードの防御列は使用しない。守備位置は画像が「-」のため選手合計として扱う。',sources,entries};
await writeFile(new URL('src/pro/uzr2026-screenshots.json',root),JSON.stringify(data,null,2)+'\n');
console.log(`${entries.length} image rows; ${ids.size} matched records, 314 numerical UZR values, 5 explicit missing values.`);
