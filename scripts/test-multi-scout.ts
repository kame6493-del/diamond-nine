// 10回まとめて引く(2026-11-04 vc43)の試験。
// 1) 値段は1回の10倍(30,000pt)、割引・おまけなし。 2) 確率は1回ずつと同じ(同じ種なら1回ずつ10回とまったく同じ結果)。
// 3) 同じ選手の能力アップ・7枚目からの換金も1回ずつと同じ。 4) 足りない時は引けず、足りない数を出す。 5) 演出と一覧の中身。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,validState,type GameState} from '../src/pro/engine';
import {players,playerMap} from '../src/pro/data';
import {SCOUT_BANDS,scoutBandOf,SIMPLE_SCOUT_COST,MULTI_SCOUT_COST,MULTI_SCOUT_COUNT,drawSimplePlayer,drawSimplePlayers,scoutOdds} from '../src/pro/simple-game';
import {PawaScout} from '../src/pro/pawa/PawaScout';
import {PawaMultiReveal,PawaMultiResult,multiItems,bestOfMulti,multiTag,multiSummary} from '../src/pro/pawa/PawaMultiScout';

const noop=()=>{};
const scoutHtml=(state:GameState,hasDrawn=false,drawing=false)=>renderToStaticMarkup(createElement(PawaScout,{state,onDraw:noop,onDrawMulti:noop,onEquip:noop,drawing,hasDrawn,onSeason:noop}));
const ten=(s:GameState)=>{let x=s;const pulls=[];for(let i=0;i<10;i++){x=drawSimplePlayer(x);pulls.push(x.lastPulls[0]);}return {state:x,pulls};};

export function registerMultiScoutTests(test:(name:string,run:()=>void)=>void){
 test('multi scout (vc43): 10 draws cost exactly 10x one draw (30,000 pt), no discount or bonus pull',()=>{
  assert.equal(MULTI_SCOUT_COUNT,10);assert.equal(MULTI_SCOUT_COST,SIMPLE_SCOUT_COST*10);assert.equal(MULTI_SCOUT_COST,30000);
  // 1回分の報酬(重複の換金・目標)が出ない状態で、ちょうど 30,000pt 減る
  const warm=ten({...initialState(77),gems:200000,seed:77}).state;
  const before={...warm,gems:30000},after=drawSimplePlayers(before);
  const refunds=after.lastPulls.reduce((n,p)=>n+(p.trainingReward??0),0);
  assert.equal(after.lastPulls.length,10);assert.equal(after.pulls,before.pulls+10);
  assert.equal(after.gems,refunds,'30,000pt ちょうど使う(戻りは重複の換金だけ)');
  assert.equal(after.gems,ten(before).state.gems,'1回ずつ10回引いた時と同じ残り');
  assert.ok(validState(after));
  // おまけの11枚目・確定枠の印は無い
  assert.ok(after.lastPulls.every(p=>p.guaranteed===false));
 });
 test('multi scout (vc43): same odds as single draws - identical to ten single draws from the same seed, and band frequencies match the shown rates',()=>{
  for(const seed of [1,2,3,42,9999,123456]){
   const base={...initialState(seed),gems:100000,seed};
   const multi=drawSimplePlayers(base),single=ten(base);
   assert.deepEqual(multi.lastPulls,single.pulls,'10枚の中身と順番が同じ');
   assert.deepEqual({...multi,lastPulls:[]},{...single.state,lastPulls:[]},'ポイント・所持・乱数の続きも同じ');
  }
  // 提供割合の画面の数(scoutOdds)と、まとめて引いた時の出方を突き合わせる
  let s={...initialState(5),gems:0,seed:5};const hits:Record<string,number>={};let n=0;
  for(let k=0;k<3000;k++){s=drawSimplePlayers({...s,gems:MULTI_SCOUT_COST});for(const p of s.lastPulls){const b=scoutBandOf(playerMap[p.playerId]);hits[b]=(hits[b]??0)+1;n++;}}
  for(const b of scoutOdds(s).bands){const got=(hits[b.id]??0)/n,sd=Math.sqrt(b.rate*(1-b.rate)/n);assert.ok(Math.abs(got-b.rate)<5*sd+1e-4,`${b.id} ${got} vs ${b.rate}`);}
  assert.equal(SCOUT_BANDS.reduce((x,b)=>x+b.rate,0).toFixed(6),'1.000000');
 });
 test('multi scout (vc43): duplicates raise abilities by the same rule as single draws (+1 up to the 6th copy, then +300 pt)',()=>{
  const base=initialState(31);
  const owned1=Object.fromEntries(players.map(p=>[p.id,1]));
  const a=drawSimplePlayers({...base,gems:MULTI_SCOUT_COST,owned:owned1,seed:31});
  const count:Record<string,number>={};for(const p of a.lastPulls)count[p.playerId]=(count[p.playerId]??0)+1;
  for(const [id,c] of Object.entries(count))assert.equal(a.owned[id],1+c,'出た回数だけ所持(=能力アップ)が増える');
  assert.ok(a.lastPulls.every(p=>!p.isNew&&p.copies<=6&&(p.trainingReward??0)===0));
  assert.ok(a.lastPulls.every(p=>multiTag(p).label==='能力+1'));
  const owned6=Object.fromEntries(players.map(p=>[p.id,6]));
  const b=drawSimplePlayers({...base,gems:MULTI_SCOUT_COST,owned:owned6,seed:31});
  assert.ok(b.lastPulls.every(p=>(p.trainingReward??0)===300&&multiTag(p).label==='+300pt'));
  assert.equal(b.gems,ten({...base,gems:MULTI_SCOUT_COST,owned:owned6,seed:31}).state.gems,'7枚目からは1枚300pt(1回ずつと同じ)');
  assert.ok(b.gems>=300*10);
  const fresh=drawSimplePlayers({...base,gems:MULTI_SCOUT_COST,owned:{},seed:31});
  assert.equal(multiTag(fresh.lastPulls[0]).label,'NEW');
 });
 test('multi scout (vc43): with fewer than 30,000 pt nothing is drawn, the button is disabled and the shortfall is shown',()=>{
  const base=initialState(8);
  for(const gems of [0,3000,29999]){const s={...base,gems};assert.equal(drawSimplePlayers(s),s,'途中までも引かない');
   const html=scoutHtml(s);
   assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="10回まとめて引く 30,000 pt"/);
   assert.ok(html.includes(`10回まとめて引くには あと${(30000-gems).toLocaleString('ja-JP')}pt`));}
  const ok=scoutHtml({...base,gems:30000});
  assert.doesNotMatch(ok,/<button[^>]*disabled=""[^>]*aria-label="10回まとめて引く/);assert.ok(!ok.includes('10回まとめて引くには'));
  assert.ok(ok.includes('1枚引く'),'1回引くボタンも残る');
  // 提供割合の説明
  const src=readFileSync('src/pro/pawa/PawaScout.tsx','utf8');
  assert.ok(src.includes('まとめて引く時も、1回ずつと同じ確率で10回引きます'));
 });
 test('multi scout (vc43): reveal shows 10 face-down cards with skip; the summary marks new, ability-up and the best card',()=>{
  const base=initialState(12);
  const owned=Object.fromEntries(players.slice(0,400).map(p=>[p.id,1]));
  let s=drawSimplePlayers({...base,gems:MULTI_SCOUT_COST,owned,seed:12});
  const rv=renderToStaticMarkup(createElement(PawaMultiReveal,{state:s,sound:false,onDone:noop}));
  assert.equal((rv.match(/class="pw-mx-card /g)??[]).length,10);
  assert.equal((rv.match(/まだ裏/g)??[]).length,10,'最初は全部裏');
  assert.ok(rv.includes('全部めくる'));
  // 金・虹は裏のまま光り方が違う(段の class が付く)
  const items=multiItems(s);for(const x of items)assert.ok(rv.includes('pw-mx-t-'+x.tier));
  const res=renderToStaticMarkup(createElement(PawaMultiResult,{state:s}));
  const sum=multiSummary(items),best=bestOfMulti(items)!;
  assert.ok(res.includes('いちばん良かった1枚'));assert.ok(res.includes(best.player.name));
  assert.equal((res.match(/class="pw-mx-t-[a-z]+( is-best)?"/g)??[]).length,10);
  assert.equal((res.match(/is-best/g)??[]).length,1);
  assert.ok(res.includes(`NEW <b>${sum.fresh}</b>人`));assert.ok(res.includes(`能力アップ <b>${sum.up}</b>人`));
  assert.equal(sum.fresh+sum.up+items.filter(x=>multiTag(x.pull).kind==='pts').length,10);
  // いちばん良かった1枚は段→総合の順で一番上
  for(const x of items){const r=(t:string)=>t==='rainbow'?2:t==='gold'?1:0;assert.ok(r(x.tier)<r(best.tier)||(r(x.tier)===r(best.tier)&&x.overall<=best.overall));}
  // スカウト画面: 演出中は専用の演出、終わったら一覧(1枚の結果は出さない)。1枚引けば今までの1枚の結果に戻る
  assert.match(scoutHtml(s,true,true),/class="pw-mx"/);assert.ok(scoutHtml(s,true,false).includes('10回スカウトの結果'));
  assert.ok(!scoutHtml(s,true,false).includes('pw-sc-result'));
  s=drawSimplePlayer({...s,gems:3000});assert.ok(scoutHtml(s,true,false).includes('pw-sc-result'));assert.ok(!scoutHtml(s,true,false).includes('10回スカウトの結果'));
 });
}
