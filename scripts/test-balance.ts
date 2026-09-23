import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {npbPlayers,players,playerMap,findPlayer,type Player} from '../src/pro/data';
import {initialState,simulateDays,migrateState,nextSeason,validState,effectiveOverall} from '../src/pro/engine';
import {collectSimpleRewards,drawSimplePlayer} from '../src/pro/simple-game';
import {simulatePostseason} from '../src/pro/postseason';
import {trainPlayer} from '../src/pro/franchise';
import {awakeningCosts,baseAbilityScore,developedRatings,ratingOverall} from '../src/pro/development';
import {PlayerDetails} from '../src/pro/PlayerDetails';

const mean=(pool:Player[])=>pool.reduce((total,p)=>total+ratingOverall(p),0)/pool.length;
export function registerBalanceTests(test:(name:string,run:()=>void)=>void){
 test('scouting and awakening debit the same displayed wallet in either order without a second currency',()=>{
  const base={...initialState(),gems:3600,seed:444},id=base.lineup[0],saved=JSON.stringify(base);
  const trained=trainPlayer(base,id);assert.equal(trained.gems,3000);assert.equal(trained.training[id],1);
  const drawn=drawSimplePlayer(trained);assert.equal(drawn.gems,0);assert.equal(drawn.pulls,1);assert.equal(drawn.training[id],1);
  const scoutFirst=drawSimplePlayer(base);assert.equal(scoutFirst.gems,600);
  const trainSecond=trainPlayer(scoutFirst,id);assert.equal(trainSecond.gems,0);assert.equal(trainSecond.training[id],1);
  for(const state of [drawn,trainSecond]){assert.equal(state.franchise.points,0);assert.equal(trainPlayer(state,id),state);assert.equal(drawSimplePlayer(state),state);assert.ok(validState(state));}
  assert.equal(JSON.stringify(base),saved);
 });
 test('legacy point migration conserves both balances once and rejects invalid balances before combining',()=>{
  const base={...initialState(),gems:16200},old={...base,franchise:{...base.franchise,points:1970}},saved=JSON.stringify(old);
  const next=migrateState(old)!;assert.equal(next.gems,18170);assert.equal(next.franchise.points,0);
  assert.deepEqual(migrateState(next),next);assert.equal(JSON.stringify(old),saved);assert.deepEqual(next.owned,old.owned);
  for(const amount of [-1,NaN,Infinity])assert.equal(migrateState({...old,franchise:{...old.franchise,points:amount}}),null);
  assert.equal(migrateState({...old,gems:Number.MAX_VALUE,franchise:{...old.franchise,points:Number.MAX_VALUE}}),null);
 });
 test('pitcher and batter OVR distributions align for the full, Wiki and established NPB pools',()=>{
  const pools=[npbPlayers,npbPlayers.filter(p=>p.wikiAssessment),npbPlayers.filter(p=>p.role==='batter'?(p.batting?.pa??0)>=100:(p.pitching?.outs??0)>=100)];
  for(const pool of pools){const bats=pool.filter(p=>p.role==='batter'),arms=pool.filter(p=>p.role==='pitcher');assert.ok(bats.length>100&&arms.length>100);assert.ok(Math.abs(mean(bats)-mean(arms))<3,`bat ${mean(bats)} / pitch ${mean(arms)}`);}
  assert.equal(ratingOverall(findPlayer('佐藤輝明')),90);assert.equal(ratingOverall(findPlayer('近本光司')),78);
  assert.equal(ratingOverall(findPlayer('才木浩人')),89);assert.equal(ratingOverall(findPlayer('下村海翔')),68);
  // The source's actual skills do not become lower because OVR is recalibrated.
  const sa= findPlayer('才木浩人');assert.deepEqual([sa.ratings.velocity,sa.ratings.control,sa.ratings.stamina],[158,70,70]);assert.equal(baseAbilityScore(sa),74);
 });
 test('pitcher OVR remains monotonic in every pitching skill with the same ceiling and no roster dependence',()=>{
  const arm=findPlayer('才木浩人');
  for(const key of ['velocity','control','stamina','breaking'] as const){
   let previous=0;
   for(let value=key==='velocity'?125:0;value<=(key==='velocity'?165:99);value++){
    const score=ratingOverall(arm,{...arm.ratings,[key]:value});assert.ok(score>=previous);previous=score;
   }
  }
  const mlbArms=players.filter(p=>p.mlb&&p.role==='pitcher');assert.ok(mlbArms.filter(p=>ratingOverall(p)<100).length>=4);
  assert.equal(ratingOverall(findPlayer('山本由伸')),107);assert.equal(ratingOverall(findPlayer('大谷翔平')),104);
  for(const p of players){let last=0;for(let stage=0;stage<=5;stage++){const now=ratingOverall(p,developedRatings(p,stage));assert.ok(now>=last&&now<=124);last=now;}}
 });
 test('every awakening stage has an exact escalating price and rejects a one-point shortage without charging',()=>{
  assert.deepEqual([...awakeningCosts],[600,1800,5400,16200,48600]);
  const base=initialState(),id=base.lineup[0];
  for(let stage=0;stage<5;stage++){
   const start={...base,training:{[id]:stage},gems:awakeningCosts[stage]-1},snapshot=JSON.stringify(start);
   assert.equal(trainPlayer(start,id),start);assert.equal(JSON.stringify(start),snapshot);
   const funded={...start,gems:awakeningCosts[stage]},next=trainPlayer(funded,id);
   assert.equal(next.training[id],stage+1);assert.equal(next.franchise.points,0);assert.ok(validState(next));assert.equal(trainPlayer(next,id),next);
   assert.equal(next.gems,0);assert.deepEqual(next.owned,base.owned);
  }
  for(const stage of [-1,.5,6,NaN])assert.equal(trainPlayer({...base,training:{[id]:stage},gems:90000},id).training[id],stage);
 });
 test('legacy awakening stages and point balances migrate without back-charging at the new prices',()=>{
  const base=simulateDays(initialState(),10),ids=Object.keys(base.owned).slice(0,6);
  base.training=Object.fromEntries(ids.map((id,i)=>[id,i]));base.franchise.points=20000;
  const saved=JSON.stringify(base),restored=migrateState(JSON.parse(saved))!;assert.ok(restored);assert.deepEqual(restored,{...base,gems:base.gems+20000,franchise:{...base.franchise,points:0}});assert.deepEqual(migrateState(restored),restored);
  const fullId=ids[5];assert.equal(trainPlayer(restored,fullId),restored);assert.equal(restored.franchise.points,0);
  const next=trainPlayer(restored,ids[3]);assert.equal(next.training[ids[3]],4);assert.equal(next.gems,base.gems+3800);assert.equal(next.training[fullId],5);assert.equal(JSON.stringify(base),saved);
 });
 test('one focused prospect needs multiple years for late stages while early awakening is attainable in year one',()=>{
  let state=initialState(20260922);const id=findPlayer('ティマ').id,years:number[]=[];state.owned[id]??=1;
  assert.ok(id);let spent=0;
  for(let year=1;year<=25;year++){
   state=collectSimpleRewards(simulatePostseason(collectSimpleRewards(simulateDays(state,143)),60));
   for(let attempt=0;attempt<5;attempt++){
    const before=state.gems,next=trainPlayer(state,id);if(next===state)break;spent+=before-next.gems;years.push(year);state=next;
   }
   assert.ok(validState(state));if(state.training[id]===5)break;state=nextSeason(state);
  }
  assert.equal(years.length,5);assert.equal(years[0],1);assert.ok(years[2]>=2);assert.ok(years[3]-years[2]>=3);assert.ok(years[4]-years[3]>=9);assert.ok(years[4]>=15&&years[4]<=24,`awakening years ${years}`);assert.equal(spent,72600);
  assert.ok(effectiveOverall(playerMap[id],state.owned,state.training)>effectiveOverall(playerMap[id],state.owned));
 });
 test('awakening UI shows the next price, savings and shortfall, while hiding future maximum abilities',()=>{
  const base=initialState(),player=playerMap[base.lineup[0]],state={...base,training:{[player.id]:4},gems:7000};
  const html=renderToStaticMarkup(createElement(PlayerDetails,{player,state,onChange:()=>{},onAwaken:()=>{}}));
  for(const text of ['48,600 pt','あと41,600pt','aria-valuenow="7000"','aria-valuemax="48600"'])assert.ok(html.includes(text),text);
  assert.ok(html.includes('disabled=""'));for(const text of ['最大覚醒','次の覚醒','growth-table'])assert.ok(!html.includes(text));
  const full=renderToStaticMarkup(createElement(PlayerDetails,{player,state:{...state,training:{[player.id]:5}},onChange:()=>{},onAwaken:()=>{}}));
  assert.ok(full.includes('完全覚醒しました'));assert.ok(!full.includes('aria-valuemax="48600"'));assert.ok(!full.includes('NaN'));
 });
}
