// 11/6 夜(vc46 / 1.5.3)の試験。持ち主「保存できません…が消えない」「宇宙人のチームは、査定は一般基準に」「球速インフレやばい」。
import assert from 'node:assert/strict';
import {initialSandboxState,saveKeyFor,type GameState} from '../src/pro/engine';
import {compactForSave,writeSave,pruneSnapshots,parseSave,encodeSave} from '../src/pro/save-store';
import {compressToUTF16,decompressFromUTF16} from '../src/pro/lz-utf16';
import {resetTeam,readResetBackup} from '../src/pro/reset-team';
import {npbPlayers} from '../src/pro/data';
import {mlbOpponentPlayers} from '../src/pro/mlb-opponents';
import {shownKmh} from '../src/pro/velocity-display';
import {alienStat,alienOverall} from '../src/pro/space-aliens';

/** 枠(字数)のある localStorage のまね。Chromium と同じく key+value の字数の合計で数える。 */
function limitedStore(limit:number){
 const m=new Map<string,string>();const used=()=>[...m].reduce((n,[k,v])=>n+k.length+v.length,0);
 return {map:m,get length(){return m.size;},key:(i:number)=>[...m.keys()][i]??null,getItem:(k:string)=>m.get(k)??null,removeItem:(k:string)=>{m.delete(k);},
  setItem:(k:string,v:string)=>{const before=m.get(k);const next=used()-(before===undefined?0:k.length+before.length)+k.length+v.length;if(next>limit)throw new DOMException('quota','QuotaExceededError');m.set(k,v);}};
}
function bigState():GameState{
 const s=initialSandboxState();const box={batting:Array.from({length:20},(_,i)=>({playerId:'p'+i,team:'x',games:1,pa:4,ab:4,hits:1,doubles:0,triples:0,hr:0,rbi:0,runs:0,bb:0,so:1,sb:0,hbp:0,sf:0,gdp:0})),pitching:[],highlights:[]};
 const results=Array.from({length:800},(_,i)=>({day:i+1,home:i%5===0?s.club:'d',away:'g',homeRuns:3,awayRuns:2,innings:9,line:[[0,1,0,0,0,1,0,0,0],[0,0,2,0,0,1,0,0,0]],stars:[],errors:[0,0] as [number,number],box}));
 return {...s,season:{...s.season,results:results as never},history:[{...s.season,number:0,results:results as never}]};
}
export function register1106cTests(test:(name:string,run:()=>void)=>void){
 test('1106 save codec: compressed text round-trips, plain JSON still reads',()=>{
  for(const t of ['','a','日本語とemoji🎉',JSON.stringify(bigState())])assert.equal(decompressFromUTF16(compressToUTF16(t)),t);
  const s=bigState();assert.deepEqual(parseSave(encodeSave(s)),JSON.parse(JSON.stringify(s)));assert.deepEqual(parseSave(JSON.stringify(s)),JSON.parse(JSON.stringify(s)));
  assert.ok(encodeSave(s).length<JSON.stringify(s).length/5);
 });
 test('1106 save keeps only the current season own-game box scores',()=>{
  const s=bigState(),c=compactForSave(s);
  assert.ok(c.season.results.every(g=>(g.home===s.club||g.away===s.club)===(g.box!==undefined)));
  assert.ok(c.history.every(h=>h.results.every(g=>g.box===undefined)));
  assert.equal(c.season.results.length,s.season.results.length);
  assert.ok(s.season.results.every(g=>g.box!==undefined),'the playing state is not changed');
 });
 test('1106 writeSave falls back to pruning old reset snapshots and compression when the quota is full',()=>{
  const s=bigState(),plain=JSON.stringify(compactForSave(s)).length,key=saveKeyFor('free');
  // 枠が素の JSON より小さい → 縮めて書ける
  const small=limitedStore(Math.floor(plain/2));assert.ok(writeSave(s,'free',small));assert.ok(small.getItem(key)!.startsWith('D9Z1:'));
  assert.deepEqual(parseSave(small.getItem(key)),JSON.parse(JSON.stringify(compactForSave(s))));
  // 古いリセットの控えが枠を食っている → 指されていない控えだけ消して、縮めて書ける
  const store=limitedStore(plain+200);store.map.set(`${key}-snapshot-old1`,'x'.repeat(plain));store.map.set(`${key}-reset-backup`,`${key}-snapshot-keep`);store.map.set(`${key}-snapshot-keep`,'{}');
  assert.ok(writeSave(s,'free',store));assert.ok(!store.map.has(`${key}-snapshot-old1`));assert.ok(store.map.has(`${key}-snapshot-keep`));assert.ok(store.getItem(key)!.startsWith('D9Z1:'));
  assert.equal(pruneSnapshots('free',store),0);
  // どうしても入らない時は false(画面は小さな帯を数秒だけ出す)
  assert.equal(writeSave(s,'free',limitedStore(50)),false);
 });
 test('1106 reset writes a compressed snapshot and can restore it',()=>{
  const store=limitedStore(10_000_000),s={...initialSandboxState(),name:'控えのチーム'};
  resetTeam(s,'free',store);
  const snaps=[...store.map.keys()].filter(k=>k.includes('-snapshot-'));assert.equal(snaps.length,1);
  assert.ok(store.getItem(snaps[0])!.startsWith('D9Z1:'));assert.ok(store.getItem(snaps[0])!.length<JSON.stringify(s).length);assert.equal(readResetBackup('free',store)?.name,'控えのチーム');
 });
 test('1106 the save notice is a small self-hiding strip, not a tap-to-close box',async()=>{
  const {readFileSync}=await import('node:fs');const app=readFileSync('src/pro/SimpleApp.tsx','utf8');
  assert.ok(!app.includes('設定からデータを書き出してください'));assert.ok(app.includes('s-save-note'));assert.ok(!/s-save-error[^]*?<button/.test(app));
 });
 test('1106 velocity shown on a natural pro scale (avg mid-140s, top about 160) for everyone',()=>{
  const pit=(ps:typeof npbPlayers)=>ps.filter(p=>p.role==='pitcher').map(p=>shownKmh(p.ratings.velocity));
  for(const v of [pit(npbPlayers),pit(mlbOpponentPlayers)]){
   const avg=v.reduce((a,b)=>a+b,0)/v.length;assert.ok(avg>=143&&avg<=150,`avg ${avg}`);assert.ok(Math.max(...v)<=160);assert.ok(v.filter(x=>x>=160).length/v.length<.01);
  }
  assert.equal(alienStat(95),95);assert.equal(alienOverall(110),110);
 });
}
