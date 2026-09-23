import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {mlbPlayers} from '../src/pro/mlb-players';
import {players,npbPlayers,playerMap,teamById} from '../src/pro/data';
import {initialState,simulateDays,effectiveOverall,validState,migrateState,nextSeason,rng} from '../src/pro/engine';
import {collectSimpleRewards,drawSimplePlayer,equipTwoWayPlayer,mlbScoutCountdown,SIMPLE_SCOUT_COST} from '../src/pro/simple-game';
import {simulatePostseason} from '../src/pro/postseason';
import {matchupProbabilities} from '../src/pro/matchup';
import {TradingCard} from '../src/pro/CardDeck';
import {PlayerDetails} from '../src/pro/PlayerDetails';
import {SimpleScout} from '../src/pro/SimpleApp';

export function registerMLBTests(test:(name:string,run:()=>void)=>void){
 test('2026 Japanese MLB roster includes 15 verified identities with distinct teams and individualized game ratings',()=>{
  assert.equal(mlbPlayers.length,15);assert.equal(players.length,npbPlayers.length+15);
  for(const p of mlbPlayers){
   assert.ok(p.mlb?.profileUrl.startsWith('https://www.mlb.com/player/'));assert.equal(p.mlb?.asOf,'2026-09-22');
   assert.equal(teamById(p.team).league,'MLB');assert.ok(effectiveOverall(p,{}, {})>=65,p.name);assert.ok(effectiveOverall(p,{}, {})<=110);
   assert.ok(p.batting?.pa||p.pitching?.bf,p.name);
  }
  assert.equal(playerMap['mlb-506433'].mlb?.statsYear.pitching,2025);
  assert.equal(playerMap['mlb-807747'].name,'西〇 陸浮');
  assert.ok(Object.keys(initialState().owned).every(id=>!playerMap[id].mlb));
 });
 test('Ohtani uses one owned card for DH and starting pitcher through save reload and a full 143-game season',()=>{
  const id='mlb-660271',base=initialState();assert.equal(equipTwoWayPlayer(base,id),base);
  const owned={...base.owned,[id]:1},start={...base,owned};
  const equipped=equipTwoWayPlayer(start,id);assert.ok(validState(equipped));assert.equal(equipped.defense[id],'DH');
  assert.equal(equipped.lineup.filter(x=>x===id).length,1);assert.equal(equipped.pitchers.filter(x=>x===id).length,1);
  assert.deepEqual(equipped.owned,owned);assert.equal(equipTwoWayPlayer(equipped,id),equipped);
  const restored=migrateState(JSON.parse(JSON.stringify(equipped)))!;assert.ok(restored);assert.deepEqual(restored.lineup,equipped.lineup);
  const done=simulateDays(restored,143),b=done.season.batting[done.club+'|'+id],p=done.season.pitching[done.club+'|'+id];
  assert.equal(b.games,143);assert.ok(b.pa>450);assert.ok(b.hr>10);assert.equal(p.starts,24);assert.ok(p.outs>300);assert.ok(validState(done));
  const bats=Object.values(done.season.batting),pits=Object.values(done.season.pitching);
  for(const key of ['hits','hr','so'] as const)assert.equal(bats.reduce((s,b)=>s+b[key],0),pits.reduce((s,p)=>s+p[key],0));
  assert.equal(bats.reduce((s,b)=>s+b.pa,0),pits.reduce((s,p)=>s+p.bf,0));
 });
 test('Modest MLB league adjustments affect hit, home run, strikeout and walk probabilities',()=>{
  const ohtani=playerMap['mlb-660271'],yamamoto=playerMap['mlb-808967'];
  const batter=npbPlayers.find(p=>p.role==='batter'&&(p.batting?.pa??0)>400)!,pitcher=npbPlayers.find(p=>p.role==='pitcher'&&(p.pitching?.bf??0)>400)!;
  const batBase=matchupProbabilities({...ohtani,ratings:ohtani.simulationBaseline!},pitcher),batBoost=matchupProbabilities(ohtani,pitcher);
  assert.ok(batBoost.homeRun>batBase.homeRun&&batBoost.homeRun/batBase.homeRun<1.15);assert.ok(batBoost.babip>batBase.babip&&batBoost.babip-batBase.babip<.005);assert.ok(batBoost.strikeout<batBase.strikeout&&batBoost.strikeout/batBase.strikeout>.94);
  const pitBase=matchupProbabilities(batter,{...yamamoto,ratings:yamamoto.simulationBaseline!}),pitBoost=matchupProbabilities(batter,yamamoto);
  assert.ok(pitBoost.walk<pitBase.walk&&pitBoost.walk/pitBase.walk>.94);assert.ok(pitBoost.strikeout>pitBase.strikeout&&pitBoost.strikeout/pitBase.strikeout<1.08);assert.ok(pitBoost.homeRun<pitBase.homeRun&&pitBoost.homeRun/pitBase.homeRun>.94);
  for(const p of mlbPlayers)for(const probability of Object.values(matchupProbabilities(p.role==='batter'?p:batter,p.role==='pitcher'?p:pitcher)))assert.ok(Number.isFinite(probability)&&probability>=0&&probability<=1);
 });
 test('30th point scout guarantees an unowned MLB player, including saves containing obsolete tickets',()=>{
  const base=initialState(),id='mlb-660271';
  const state={...base,pulls:29,gems:6000,owned:{...base.owned,...Object.fromEntries(mlbPlayers.filter(p=>p.id!==id).map(p=>[p.id,1]))},franchise:{...base.franchise,claimed:['contract-1','contract-2','career-draw'],tickets:1}};
  const next=drawSimplePlayer(state);assert.equal(next.lastPulls[0].playerId,id);assert.equal(next.lastPulls[0].guaranteed,true);assert.equal(next.pulls,30);assert.equal(next.gems,3000);assert.equal(mlbScoutCountdown(next),30);assert.equal(next.franchise.tickets,0);assert.ok(validState(next));
  assert.equal(collectSimpleRewards(next),next);assert.equal(drawSimplePlayer({...base,gems:2999}).gems,2999);
  const complete={...state,owned:{...state.owned,[id]:1},franchise:{...state.franchise,tickets:0}};
  assert.ok(playerMap[drawSimplePlayer(complete).lastPulls[0].playerId].mlb);
 });
 test('ordinary point scouting follows the 2% MLB pool and obsolete tickets do not affect the draw',()=>{
  const random=rng(9929343),base=initialState();let major=0;
  for(let i=0;i<4000;i++){
   random.next();const seed=random.state;
   const point=drawSimplePlayer({...base,gems:SIMPLE_SCOUT_COST,seed});
   const stocked=drawSimplePlayer({...base,gems:SIMPLE_SCOUT_COST,seed,franchise:{...base.franchise,tickets:10}});
   if(playerMap[point.lastPulls[0].playerId].mlb)major++;
   assert.deepEqual(stocked,point);
  }
  assert.ok(major>=45&&major<=120,`MLB outcomes ${major}/4000`);
 });
 test('multi-year economy earns a handful of point scouts each year and keeps balances and cards',()=>{
  let state=initialState();const earned:number[]=[];
  for(let year=0;year<4;year++){
   const before=state.gems,done=collectSimpleRewards(simulatePostseason(collectSimpleRewards(simulateDays(state,143)),60));
   const draws=(done.gems-before)/SIMPLE_SCOUT_COST;earned.push(draws);assert.ok(draws>=1&&draws<=2,`year ${year+1}: ${draws} point scouts`);
   assert.equal(done.franchise.tickets,0);state=nextSeason(done);
  }
  assert.deepEqual(state.owned,initialState().owned);assert.ok(earned.reduce((a,b)=>a+b,0)<30);
 });
 test('MLB cards show both Ohtani ability sets and accessible player details without rarity labels',()=>{
  const player=playerMap['mlb-660271'],base=initialState(),state={...base,owned:{...base.owned,[player.id]:1}};
  const card=renderToStaticMarkup(createElement(TradingCard,{player,state}));
  for(const label of ['ミート','パワー','走力','肩','守備','球速','制球','スタミナ','変化','MLB'])assert.ok(card.includes(label),label);
  const details=renderToStaticMarkup(createElement(PlayerDetails,{player,state,onChange:()=>{},onAwaken:()=>{}}));
  assert.ok(details.includes('投手＋DHで二刀流起用'));assert.ok(!details.includes('ゲーム独自査定'));assert.ok(!details.includes('公式選手情報')); 
  const result={...state,lastPulls:[{playerId:player.id,copies:1,isNew:true,guaranteed:true,trainingReward:0}]};
  const scout=renderToStaticMarkup(createElement(SimpleScout,{state:result,onDraw:()=>{},onEquip:()=>{},drawing:false,hasDrawn:true,onSeason:()=>{}}));
  assert.ok(scout.includes('MLB選手を獲得！'));assert.ok(scout.includes('新たな選手を獲得しよう！'));
  assert.ok(!scout.includes('<canvas'));assert.ok(!scout.includes('scout-celebration'));
  const opening=renderToStaticMarkup(createElement(SimpleScout,{state:result,onDraw:()=>{},onEquip:()=>{},drawing:true,hasDrawn:true,onSeason:()=>{}}));
  for(const text of ['次の主役','次の仲間を、一人ずつ','新たな物語','THE NEXT CHAPTER'])assert.ok(!(opening+scout).includes(text));assert.ok(scout.includes('3,000 pt'));assert.ok(!scout.includes('>UR<'));assert.ok(!scout.includes('レア度'));
 });
}
