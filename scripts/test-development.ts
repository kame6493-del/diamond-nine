import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {players,playerMap,rosterSlots} from '../src/pro/data';
import {initialState,effectiveOverall,simulateDays,validState,defenseAdjustment} from '../src/pro/engine';
import {awakeningCosts,baseAbilityScore,developedRatings,growthProfile,isRookie,overallAbilityScore,ownedRatings,playerAge,ratingOverall} from '../src/pro/development';
import {buildByStrategy,trainPlayer} from '../src/pro/franchise';
import {gameRatings,matchupProbabilities,extraBaseChance,stealProbabilities} from '../src/pro/matchup';
import {reorderSimplePlayer,swapDefense} from '../src/pro/simple-game';
import {PlayerDetails} from '../src/pro/PlayerDetails';
import {TradingCard,uniformColors} from '../src/pro/CardDeck';

export function registerDevelopmentTests(test:(name:string,run:()=>void)=>void){
 test('all players have finite monotonic staged growth with varied prospects and modest veteran growth',()=>{
  const snapshot=JSON.stringify(players.map(p=>p.ratings));let young=0,veterans=0;
  for(const p of players){
   let previous=developedRatings(p,0);assert.deepEqual(previous,p.ratings);
   for(let stage=1;stage<=5;stage++){
    const r=developedRatings(p,stage);
    for(const key of Object.keys(r) as (keyof typeof r)[]){assert.ok(Number.isFinite(r[key]));assert.ok(r[key]>=previous[key]);if(key!=='velocity')assert.ok(r[key]<=99);}
    assert.equal(r.velocity,p.ratings.velocity);previous=r;
   }
   const base=baseAbilityScore(p),max=baseAbilityScore(p,previous),age=playerAge(p);
   if(age!==null&&age<=22&&base<65){young++;assert.ok(max-base>=5,`${p.name}: ${base} -> ${max}`);}
   if(age!==null&&age>=32&&!isRookie(p)){veterans++;assert.ok(max-base<=6,`${p.name}: veteran grows ${max-base}`);}
  }
  assert.ok(young>100);assert.ok(veterans>100);assert.equal(JSON.stringify(players.map(p=>p.ratings)),snapshot);
  assert.equal(players.filter(isRookie).length,111);assert.equal(isRookie(playerMap['m-大聖']),true);
 });
 test('awakening charges every stage once, rejects insufficient funds and persists existing stages',()=>{
  const initial=initialState(),id=initial.lineup[0];assert.equal(trainPlayer(initial,id),initial);
  let s={...initial,gems:awakeningCosts.reduce((total,cost)=>total+cost,0)+1000};
  for(let level=0;level<5;level++){const before=s.gems;s=trainPlayer(s,id);assert.equal(s.training[id],level+1);assert.equal(s.gems,before-awakeningCosts[level]);assert.ok(validState(s));}
  assert.equal(trainPlayer(s,id),s);assert.equal(trainPlayer(s,'invalid-id'),s);assert.equal(s.gems,1000);
  assert.equal(effectiveOverall(playerMap[id],s.owned,s.training),ratingOverall(playerMap[id],ownedRatings(playerMap[id],s.owned,s.training)));
 });
 test('display and simulation use exactly the same developed abilities, including fielding, running and pitching',()=>{
  const batter=players.find(p=>p.role==='batter'&&(playerAge(p)??99)<=22&&baseAbilityScore(p)<55&&(p.batting?.sb??0)>0)!;
  const pitcher=players.find(p=>p.role==='pitcher'&&(playerAge(p)??99)<=22&&baseAbilityScore(p)<65)!;
  const owned={[batter.id]:3,[pitcher.id]:2},training={[batter.id]:5,[pitcher.id]:5};
  assert.deepEqual(gameRatings(batter,2,5),ownedRatings(batter,owned,training));assert.deepEqual(gameRatings(pitcher,1,5),ownedRatings(pitcher,owned,training));
  const base=matchupProbabilities(batter,pitcher),bat=matchupProbabilities(batter,pitcher,0,0,0,{},5),pit=matchupProbabilities(batter,pitcher,0,0,0,{},0,5);
  assert.ok(bat.homeRun>base.homeRun);assert.ok(bat.babip>base.babip);assert.ok(bat.strikeout<base.strikeout);
  assert.ok(pit.strikeout>base.strikeout);assert.ok(pit.walk<base.walk);assert.ok(pit.homeRun<base.homeRun);
  assert.ok(extraBaseChance(batter,0,60,5)>extraBaseChance(batter,0,60));assert.ok(stealProbabilities(batter,0,60,60,5).success>stealProbabilities(batter,0,60,60).success);
  assert.ok(defenseAdjustment([batter.id],{[batter.id]:'外'},owned,training)>defenseAdjustment([batter.id],{[batter.id]:'外'},owned));
 });
 test('automatic batting orders reserve cleanup power, lead with speed and keep all defensive positions',()=>{
  const base=initialState();base.owned=Object.fromEntries(players.map(p=>[p.id,1]));
  const state=buildByStrategy(base,'balanced');assert.ok(validState(state));
  const order=state.lineup.map(id=>ownedRatings(playerMap[id],state.owned,state.training));
  assert.equal(order[3].power,Math.max(...order.map(p=>p.power)));
  assert.equal(order[0].speed,Math.max(...order.filter((_,i)=>i!==3).map(p=>p.speed)));
  assert.deepEqual(state.lineup.map(id=>state.defense[id]).sort(),[...rosterSlots].sort());
 });
 test('tap and drag operations insert batting order and exchange defense without duplicates or lost cards',()=>{
  const s=initialState(),ids=[...s.lineup],moved=reorderSimplePlayer(s,'bat',0,3);
  assert.deepEqual(moved.lineup.slice(0,4),[ids[1],ids[2],ids[3],ids[0]]);assert.deepEqual(moved.defense,s.defense);assert.ok(validState(moved));
  const swapped=swapDefense(s,ids[0],ids[8]);assert.deepEqual(swapped.lineup,s.lineup);assert.equal(swapped.defense[ids[0]],s.defense[ids[8]]);assert.ok(validState(swapped));
  assert.deepEqual(s.lineup,ids);assert.equal(reorderSimplePlayer(s,'bat',-1,2),s);assert.equal(swapDefense(s,ids[0],'unowned'),s);
 });
 test('player details hide awakening forecasts at every stage and preserve current overall, traits and team colors',()=>{
  const state=initialState(),player=playerMap[state.lineup[0]];state.training[player.id]=3;
  const html=renderToStaticMarkup(createElement(PlayerDetails,{player,state,onChange:()=>{},onAwaken:()=>{}}));
  for(const text of ['特殊能力','現在の総合','第4段階へ覚醒'])assert.ok(html.includes(text));assert.ok(!html.includes('100点満点'));
  for(let stage=0;stage<=5;stage++){
   const view=renderToStaticMarkup(createElement(PlayerDetails,{player,state:{...state,training:{[player.id]:stage}},onChange:()=>{},onAwaken:()=>{}}));
   for(const text of ['最大覚醒','次の覚醒','>MAX<','growth-table'])assert.ok(!view.includes(text));
  }
  const card=renderToStaticMarkup(createElement(TradingCard,{player,state}));assert.ok(card.includes('総合'));assert.ok(card.includes(`>${effectiveOverall(player,state.owned,state.training)}</b>`));
  assert.equal(Object.keys(uniformColors).length,22);assert.equal(new Set(Object.values(uniformColors).map(c=>c.join(','))).size,22);assert.ok(!html.includes('画像のUZR'));assert.ok(!html.includes('レア度'));
 });
 test('overall stays monotonic above 100 for elite abilities, on the same scale for pitchers and batters',()=>{
  const batter=players.find(p=>p.role==='batter')!,pitcher=players.find(p=>p.role==='pitcher')!;
  for(const p of [batter,pitcher]){
   let previous=0;
   for(let ability=0;ability<=99;ability++){
    const ratings=Object.fromEntries(Object.keys(p.ratings).map(key=>[key,key==='velocity'?165:ability])) as typeof p.ratings;
    const overall=ratingOverall(p,ratings);assert.ok(overall>=previous);assert.ok(overall>=1&&overall<=124);previous=overall;
   }
   assert.equal(previous,124);
  }
  const elite=players.filter(p=>overallAbilityScore(p)>=75);assert.ok(elite.length>0);assert.ok(elite.every(p=>ratingOverall(p)>=94));
  assert.ok(developedRatings(playerMap['g-ティマ'],1).contact>playerMap['g-ティマ'].ratings.contact);assert.ok(developedRatings(playerMap['g-ティマ'],1).power>playerMap['g-ティマ'].ratings.power);
  for(const p of players)for(let stage=0;stage<=5;stage++){const score=ratingOverall(p,developedRatings(p,stage,5));assert.ok(Number.isInteger(score)&&score>=1&&score<=124);}
  const eliteBase=players.filter(p=>ratingOverall(p)>100),eliteGrown=players.filter(p=>ratingOverall(p,developedRatings(p,5))>100);
  assert.ok(eliteBase.length>0&&eliteBase.length<players.length*.02);
  assert.ok(eliteGrown.some(p=>!p.mlb&&p.role==='batter'));assert.ok(eliteGrown.some(p=>!p.mlb&&p.role==='pitcher'));
  assert.ok(eliteGrown.length>eliteBase.length&&eliteGrown.length<players.length*.05);
 });
 test('fully awakened roster plays 143 games with conserved batting and pitching totals and no repeated reward',()=>{
  const s=initialState();s.seed=20260922;s.training=Object.fromEntries(Object.keys(s.owned).map(id=>[id,5]));
  const result=simulateDays(s,143);assert.ok(validState(result));assert.equal(result.season.day,143);
  const bats=Object.values(result.season.batting),pits=Object.values(result.season.pitching);
  assert.equal(bats.reduce((n,p)=>n+p.hits,0),pits.reduce((n,p)=>n+p.hits,0));assert.equal(bats.reduce((n,p)=>n+p.hr,0),pits.reduce((n,p)=>n+p.hr,0));assert.equal(bats.reduce((n,p)=>n+p.so,0),pits.reduce((n,p)=>n+p.so,0));assert.equal(simulateDays(result,143).gems,result.gems);
 });
}
