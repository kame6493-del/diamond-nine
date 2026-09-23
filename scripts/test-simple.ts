import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,simulateDays,validState,migrateState,rng,nextSeason} from '../src/pro/engine';
import {players,playerMap} from '../src/pro/data';
import {finishPostseason,simulatePostseason} from '../src/pro/postseason';
import {collectSimpleRewards,drawSimplePlayer,replacementPool,replaceSimplePlayer,moveSimplePlayer} from '../src/pro/simple-game';
import SimpleApp,{SimpleSeason,SimpleStats,SimpleScout} from '../src/pro/SimpleApp';
import {scoutPresentation,scoutDuration} from '../src/pro/scout-presentation';
import {ratingOverall} from '../src/pro/development';
import {PlayerDetails} from '../src/pro/PlayerDetails';

export function registerSimpleTests(test:(name:string,run:()=>void)=>void){
 test('saves from simulated games appear in the season table and player details',()=>{
  const state=simulateDays(initialState(12345),143);
  const pitcher=Object.values(state.season.pitching).find(p=>p.team===state.club&&p.saves>0)!;
  assert.ok(pitcher,'a reliever earned a save in the simulated games');
  const player=playerMap[pitcher.playerId];
  const html=renderToStaticMarkup(createElement(SimpleStats,{season:state.season,club:state.club,onPlayer:()=>{}}));
  const row=[...html.matchAll(/<tr>(.*?)<\/tr>/g)].find(m=>m[1].includes('data-player-id="'+player.id+'"'))![1];
  assert.ok(row.endsWith('<td>'+pitcher.saves+'</td>'));
  const detail=renderToStaticMarkup(createElement(PlayerDetails,{player,state,onChange:()=>{},onClose:()=>{},onAwaken:()=>{}}));
  assert.ok(detail.includes('<small>セーブ</small><b>'+pitcher.saves+'</b>'));
  const saved=migrateState(JSON.parse(JSON.stringify(state)))!;
  assert.equal(saved.season.pitching[state.club+'|'+player.id].saves,pitcher.saves);
 });
 test('scout presentation rewards displayed OVR and MLB acquisition without introducing rarity',()=>{
  const standard=players.find(p=>!p.mlb&&ratingOverall(p)<85)!;
  const gold=players.find(p=>!p.mlb&&ratingOverall(p)>=85&&ratingOverall(p)<95)!;
  const rainbow=players.find(p=>!p.mlb&&ratingOverall(p)>=95)!;
  for(const [player,tier] of [[standard,'standard'],[gold,'gold'],[rainbow,'rainbow']] as const){
   assert.equal(scoutPresentation(player).tier,tier);
   assert.equal(scoutPresentation({...player,rarity:'UR'}).tier,tier);
   const state=initialState();state.owned[player.id]=1;state.lastPulls=[{playerId:player.id,isNew:true,copies:1,guaranteed:false}];
   const props={state,onDraw:()=>{},onEquip:()=>{},hasDrawn:true,onSeason:()=>{},onSkip:()=>{}};
   const opening=renderToStaticMarkup(createElement(SimpleScout,{...props,drawing:true}));
   const result=renderToStaticMarkup(createElement(SimpleScout,{...props,drawing:false}));
   assert.ok(opening.includes('scout-tier-'+tier));assert.ok(opening.includes('演出をスキップ'));
   assert.ok(!opening.includes('class="trading-card'));assert.ok(result.includes(player.name));
   if(tier!=='standard')assert.ok(result.includes('<strong>'+ratingOverall(player)+'</strong>'));
   for(const text of ['>UR<','>SSR<','<canvas','花吹雪'])assert.ok(!result.includes(text));
  }
  for(const p of players.filter(p=>p.mlb))assert.notEqual(scoutPresentation(p).tier,'standard');
  assert.ok(scoutDuration('rainbow',false)>scoutDuration('gold',false));
  assert.ok(scoutDuration('gold',false)>scoutDuration('standard',false));
  for(const tier of ['standard','gold','rainbow'] as const)assert.equal(scoutDuration(tier,true),180);
 });
 test('simple scouts ignore legacy rarity and pity while retaining the published league pools',()=>{
  const base=initialState();base.gems=10000;
  for(const seed of [1,99,44321,2026,999999,4294967295]){
   const random=rng(seed),major=random.next()<.02,pool=players.filter(p=>!!p.mlb===major);
   const expected=pool[Math.floor(random.next()*pool.length)].id;
   for(const [pulls,pity] of [[0,0],[4,49],[9,42],[49,49]]){
    const start={...base,seed,pulls,pity},snapshot=JSON.stringify(start),next=drawSimplePlayer(start);
    assert.equal(next.lastPulls[0].playerId,expected);assert.equal(next.lastPulls.length,1);
    assert.equal(next.lastPulls[0].guaranteed,false);assert.equal(next.pity,0);assert.equal(next.pulls,pulls+1);
    assert.equal(JSON.stringify(start),snapshot);assert.ok(validState(next));
   }
  }
 });
 test('every simple scout costs 3000 and old tickets or ten-draw milestones cannot create free draws',()=>{
  const zero=initialState();assert.equal(drawSimplePlayer(zero),zero);
  const stocked={...zero,franchise:{...zero.franchise,tickets:50}};
  assert.equal(drawSimplePlayer(stocked),stocked);
  assert.equal(drawSimplePlayer({...stocked,gems:2999}).lastPulls.length,0);
  let state={...zero,gems:100000,seed:123};
  for(let i=0;i<10;i++)state=drawSimplePlayer(state);
  assert.equal(state.pulls,10);assert.equal(state.gems,100000-30000+100);assert.equal(state.franchise.tickets,0);
  assert.equal(state.franchise.claimed.filter(x=>x==='contract-1').length,0);
  const paid=drawSimplePlayer({...state,franchise:{...state.franchise,tickets:50}});assert.equal(paid.franchise.tickets,0);assert.equal(paid.gems,state.gems-3000);assert.equal(paid.pulls,11);
  assert.deepEqual(collectSimpleRewards(paid),paid);assert.equal(collectSimpleRewards(paid),paid);
  const oldProfile={...zero,mode:'free' as const,pulls:10};
  const oldBonus=collectSimpleRewards(oldProfile);assert.equal(oldBonus.franchise.tickets,0);assert.equal(collectSimpleRewards(oldBonus),oldBonus);
  const overflow={...zero,gems:3000,owned:Object.fromEntries(players.map(p=>[p.id,6]))};
  const next=drawSimplePlayer(overflow);assert.equal(next.lastPulls[0].copies,7);assert.equal(next.lastPulls[0].trainingReward,80);assert.equal(next.gems,80);assert.equal(next.franchise.points,0);
 });
 test('simple migration auto-collects rewards without changing existing players, abilities or results',()=>{
  const old=simulateDays(initialState(),10);old.pulls=25;old.franchise.tickets=23;old.franchise.claimed.push('contract-1');
  const snapshot=JSON.stringify(old),next=collectSimpleRewards(old);
  assert.equal(JSON.stringify(old),snapshot);assert.equal(next.franchise.tickets,0);
  assert.deepEqual(next.owned,old.owned);assert.deepEqual(next.training,old.training);assert.deepEqual(next.season,old.season);
  assert.equal(collectSimpleRewards(next),next);assert.ok(migrateState(JSON.parse(JSON.stringify(next))));
 });
 test('simple replacement preserves positions, rejects unowned players and keeps outgoing players',()=>{
  const start=initialState();const bench=players.find(p=>!start.owned[p.id]&&p.role==='batter'&&p.positions.includes('外'))!;
  const state={...start,owned:{...start.owned,[bench.id]:1}};
  const slot=state.lineup.findIndex(id=>state.defense[id]==='外'),old=state.lineup[slot];
  const next=replaceSimplePlayer(state,'bat',slot,bench.id);assert.ok(validState(next));assert.equal(next.lineup[slot],bench.id);assert.ok(next.owned[old]);assert.equal(next.defense[bench.id],'外');
  assert.equal(replaceSimplePlayer(start,'bat',slot,bench.id),start);
  assert.equal(replaceSimplePlayer(start,'pit',0,start.lineup[0]),start);
  assert.deepEqual(replacementPool(start,'pit',100),[]);
  const moved=moveSimplePlayer(next,'bat',0,1);assert.ok(validState(moved));assert.deepEqual(moved.defense,next.defense);
 });
 test('simple season stats render five batting and four pitching statistics including saves',()=>{
  const state=simulateDays(initialState(),3);
  const html=renderToStaticMarkup(createElement(SimpleStats,{season:state.season,club:state.club,onPlayer:()=>{},lineup:state.lineup,pitchers:state.pitchers}));
  const headers=[...html.matchAll(/<thead>(.*?)<\/thead>/g)].map(m=>[...m[1].matchAll(/<th>(.*?)<\/th>/g)].map(x=>x[1]));
  assert.deepEqual(headers,[['選手','打率','本塁打','打点','OPS','盗塁'],['選手','奪三振','防御率','投球回','セーブ']]);
  for(const label of ['四球','WHIP','UZR','安打','勝率'])assert.ok(!html.includes(label));
 });
 test('simple application has three main choices and acquisition has no rarity or second reveal step',()=>{
  const html=renderToStaticMarkup(createElement(SimpleApp,{}));
  const nav=html.match(/<nav.*?<\/nav>/)![0];assert.equal((nav.match(/<button/g)??[]).length,3);
  const state=drawSimplePlayer({...initialState(),gems:3000,seed:543});
  const scout=renderToStaticMarkup(createElement(SimpleScout,{state,onDraw:()=>{},onEquip:()=>{},drawing:false,hasDrawn:true,onSeason:()=>{}}));
  for(const text of ['SSR','UR','レアリティ','確定枠','開封する','テーマ選択','無料','scout-celebration','<canvas'])assert.ok(!`${html}${scout}`.includes(text));
  assert.ok(scout.includes(playerMap[state.lastPulls[0].playerId].name));assert.ok(scout.includes('もう1人引く'));
  const stocked=renderToStaticMarkup(createElement(SimpleScout,{state:{...state,gems:2999,franchise:{...state.franchise,tickets:99}},onDraw:()=>{},onEquip:()=>{},drawing:false,hasDrawn:false,onSeason:()=>{}}));
  assert.match(stocked,/<button class="s-primary s-draw" disabled=""/);assert.ok(stocked.includes('3,000 pt'));assert.ok(stocked.includes('あと1 pt'));assert.ok(!stocked.includes('無料'));
 });
 test('simple complete-season flow preserves the 143-game stats through playoffs and next year',()=>{
  const opening=initialState();assert.equal(finishPostseason(opening),opening);
  const state=collectSimpleRewards(simulateDays(initialState(),143));
  const frozen=JSON.stringify(state);
  const done=collectSimpleRewards(finishPostseason(state)),next=nextSeason(done);
  assert.equal(done.season.postseason!.stage,'complete');assert.equal(done.season.number,1);assert.equal(done.season.day,143);
  assert.equal(JSON.stringify(state),frozen);assert.equal(finishPostseason(done),done);
  assert.deepEqual(collectSimpleRewards(finishPostseason(simulatePostseason(state,1))),done);
  assert.deepEqual(collectSimpleRewards(finishPostseason(done)),done);
  const html=renderToStaticMarkup(createElement(SimpleSeason,{state:done,busy:false,progress:100,onPlay:()=>{},onPost:()=>{},onNext:()=>{},onPlayer:()=>{},message:''}));
  assert.ok(html.includes('次のシーズンへ'));assert.ok(html.includes('短期決戦の結果を見る'));assert.ok(!html.includes('CS・日本シリーズ終了まで'));assert.ok(!html.includes('<canvas'));
  assert.equal(next.season.number,2);assert.equal(next.season.day,0);assert.equal(next.history[0].day,143);
  assert.deepEqual(next.history[0].batting,state.season.batting);assert.deepEqual(next.history[0].pitching,state.season.pitching);
  assert.deepEqual(next.owned,state.owned);assert.ok(validState(next));
  assert.equal(state.franchise.tickets,0);assert.equal(done.franchise.tickets,0);assert.equal(next.franchise.tickets,0);
 });
}
