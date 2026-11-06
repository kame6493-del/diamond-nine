// MLB の選手の投打(左右)を MLB 公式の Stats API(statsapi.mlb.com/api/v1/people)から取る(2026-11-06)。
// 出力: src/pro/mlb-hands2026.json  {asOf,source,hands:{mlbId:[bats,throws]}}  bats=R/L/S throws=R/L/S(両投げ)
import {readFile,writeFile} from 'node:fs/promises';
const opp=JSON.parse(await readFile('src/pro/mlb-opponents2026.json','utf8')),own=JSON.parse(await readFile('src/pro/mlb2026.json','utf8'));
const ids=[...new Set([...opp.entries.map(e=>e.id),...own.entries.map(e=>e.mlbId)])];
const hands={},missing=[];
for(let i=0;i<ids.length;i+=100){
 const part=ids.slice(i,i+100),url=`https://statsapi.mlb.com/api/v1/people?personIds=${part.join(',')}`;
 const j=await (await fetch(url)).json();
 for(const p of j.people??[]){const b=p.batSide?.code,t=p.pitchHand?.code;if((b==='R'||b==='L'||b==='S')&&(t==='R'||t==='L'||t==='S'))hands[p.id]=[b,t];}
}
for(const id of ids)if(!hands[id])missing.push(id);
await writeFile('src/pro/mlb-hands2026.json',JSON.stringify({asOf:new Date().toISOString().slice(0,10),source:'https://statsapi.mlb.com/api/v1/people?personIds=…(MLB Advanced Media 公式の選手データ。batSide / pitchHand)',count:Object.keys(hands).length,missing,hands})+'\n');
console.log('ids',ids.length,'ok',Object.keys(hands).length,'missing',missing.length);
