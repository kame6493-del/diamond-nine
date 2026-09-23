import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,simulateDays,drawPlayers,redeemURTicket,validState,migrateState,nextSeason,type GameState} from '../src/pro/engine';
import {players,playerMap,autoLineup,rosterSlots} from '../src/pro/data';
import {matchupProbabilities} from '../src/pro/matchup';
import {claimSeasonGoals,seasonGoals,nextContract,signContract,contractPool} from '../src/pro/ambitions';
import {benchUpgrades,equipScoutedPlayer} from '../src/pro/career-roster';
import {rewardBetween} from '../src/pro/Rewards';
import {GameRecap,PlayReview} from '../src/pro/MatchReview';
import {ContractBoard,ManagerDesk} from '../src/pro/ManagerDesk';
import {simulatePostseason} from '../src/pro/postseason';

export function registerManagerTests(test:(name:string,run:()=>void)=>void){
 const start=initialState();start.seed=89421;const end=simulateDays(start,143);
 test('per-game box scores and scoring highlights reconcile with season totals, including mirrored players',()=>{
  assert.ok(validState(end));
  for(const g of end.season.results){assert.equal(g.box!.batting.length,18);
   for(const [team,runs] of [[g.home,g.homeRuns],[g.away,g.awayRuns]] as [string,number][]){
    const b=g.box!.batting.filter(b=>b.team===team),p=g.box!.pitching.filter(p=>p.team!==team),highlights=g.box!.highlights.filter(h=>h.team===team);
    const errorRuns=highlights.filter(h=>h.play==='失策で得点').reduce((n,h)=>n+h.runs,0);
    assert.equal(b.reduce((n,b)=>n+b.runs,0),runs);assert.equal(b.reduce((n,b)=>n+b.rbi,0),runs-errorRuns);assert.ok(p.reduce((n,p)=>n+p.er,0)<=runs);assert.equal(highlights.reduce((n,h)=>n+h.runs,0),runs);
    if(g.errors![g.home===team?0:1]===0)assert.equal(p.reduce((n,p)=>n+p.er,0),runs);
    assert.equal(b.reduce((n,b)=>n+b.hits,0),p.reduce((n,p)=>n+p.hits,0));assert.equal(b.reduce((n,b)=>n+b.pa,0),p.reduce((n,p)=>n+p.bf,0));
   }
   const last=g.box!.highlights.at(-1);if(last){assert.equal(last.awayScore,g.awayRuns);assert.equal(last.homeScore,g.homeRuns);}
  }
  for(const b of Object.values(end.season.batting).filter(b=>b.team===end.club))for(const key of ['games','pa','ab','hits','hr','rbi','bb','so','sb','runs'] as const){assert.equal(end.season.results.flatMap(g=>g.box!.batting).filter(x=>x.team===end.club&&x.playerId===b.playerId).reduce((n,x)=>n+x[key],0),b[key]);}
  const lineup=autoLineup(players.filter(p=>p.team==='d')),mirrored=simulateDays({...start,lineup,defense:Object.fromEntries(lineup.map((id,i)=>[id,rosterSlots[i]])),seed:1},1),box=mirrored.season.results[0].box!;assert.equal(box.batting.length,18);assert.equal(new Set(box.batting.map(b=>b.playerId)).size,9);assert.equal(new Set(box.batting.map(b=>b.team+'|'+b.playerId)).size,18);
 });
 test('game heroes use this game only and legacy scores remain readable',()=>{
  for(const g of end.season.results){const winner=g.homeRuns===g.awayRuns?null:g.homeRuns>g.awayRuns?g.home:g.away,b=g.box!.batting.filter(b=>!winner||b.team===winner);const value=(b:typeof g.box.batting[number])=>b.hits+2*b.hr+b.rbi+.25*b.bb;assert.equal(Math.max(...b.map(value)),Math.max(...b.filter(b=>g.stars.includes(b.playerId)).map(value)));}
  const old=structuredClone(end);old.season.results.forEach(g=>delete g.box);assert.ok(migrateState(old));assert.ok(renderToStaticMarkup(createElement(GameRecap,{game:old.season.results[0],state:old})).includes('詳細記録はありません'));
  const broken=structuredClone(end);broken.season.results[0].box!.batting[0].hits=-1;assert.equal(migrateState(broken),null);
 });
 test('season objectives pay once, preserve currency and unlock independently next year',()=>{
  assert.equal(claimSeasonGoals(start),start);const earned=seasonGoals(end).filter(g=>g.value>=g.goal),claimed=claimSeasonGoals(end);
  assert.equal(claimed.gems-end.gems,earned.reduce((n,g)=>n+g.reward,0));assert.equal(claimed.franchise.points-end.franchise.points,earned.reduce((n,g)=>n+g.training,0));assert.equal(claimSeasonGoals(claimed),claimed);assert.ok(validState(claimed));
  const next={...claimed,season:{...claimed.season,number:2}};assert.ok(seasonGoals(next).every(g=>!g.claimed));assert.equal(claimSeasonGoals({...end,mode:'free'}).gems,end.gems);
 });
 test('select contracts alternate SR and SSR, require earned draws and cannot be redeemed twice',()=>{
  const sr=players.find(p=>p.rarity==='SR')!,ssr=players.find(p=>p.rarity==='SSR')!;
  assert.equal(nextContract(start),null);assert.equal(signContract(start,sr.id),start);
  const ready={...start,pulls:10};assert.equal(nextContract(ready)?.rarity,'SR');assert.equal(signContract(ready,ssr.id),ready);
  const signed=signContract(ready,sr.id);assert.equal(signed.owned[sr.id],(ready.owned[sr.id]??0)+1);assert.equal(signed.gems,ready.gems);assert.equal(signed.seed,ready.seed);assert.equal(signed.pity,ready.pity);assert.equal(signed.pulls,10);assert.equal(nextContract(signed),null);assert.equal(signContract(signed,sr.id),signed);assert.ok(validState(signed));assert.equal(rewardBetween(ready,signed),null);
  const later={...signed,pulls:20};assert.equal(nextContract(later)?.rarity,'SSR');assert.equal(contractPool(later).some(p=>p.rarity!=='SSR'),false);assert.equal(nextContract({...later,mode:'free'}),null);
 });
 test('duplicates beyond full awakening credit the shared wallet for normal, ticket and selected rewards',()=>{
  const s={...start,gems:300,owned:Object.fromEntries(players.map(p=>[p.id,6])),franchise:{...start.franchise,tickets:1}};
  for(const [earned,cost] of [[drawPlayers(s,1),300],[redeemURTicket(s),0],[signContract({...s,pulls:10},players.find(p=>p.rarity==='SR')!.id),0]] as const){assert.equal(earned.gems-s.gems,80-cost);assert.equal(earned.franchise.points,0);assert.equal(earned.lastPulls[0].trainingReward,80);assert.equal(earned.lastPulls[0].copies,7);assert.ok(validState(earned));}
 });
 test('bench recommendations respect published pitching roles and keep owned cards after a swap',()=>{
  const s={...start,owned:Object.fromEntries(players.map(p=>[p.id,1]))};const upgrades=benchUpgrades(s);assert.ok(upgrades.length>20);for(const {id,upgrade} of upgrades.slice(0,20)){const equipped=equipScoutedPlayer(s,id);assert.ok(validState(equipped));assert.ok(equipped.owned[upgrade.oldId]);assert.deepEqual(equipped.owned,s.owned);assert.ok(upgrade.gain>0);}
 });
 test('new screens show actual game performance, clear contract cost and season objectives without UZR',()=>{
  const after=simulateDays(start,5),noop=()=>{};
  const report=renderToStaticMarkup(createElement(PlayReview,{before:start,after,onScout:noop,onTeam:noop,onContinue:noop,onSeason:noop}));for(const text of ['打率','本塁打','打点','OPS','試合が動いた場面','この試合の個人成績'])assert.ok(report.includes(text));assert.ok(!report.includes('UZR'));assert.equal(rewardBetween(start,after),null);
  const desk=renderToStaticMarkup(createElement(ManagerDesk,{state:after,onTeam:noop,onScout:noop,onClub:noop,onSeason:noop}));assert.ok(desk.includes('次は、'));assert.ok(desk.includes('毎シーズン更新'));
  const contract=renderToStaticMarkup(createElement(ContractBoard,{state:{...start,pulls:10}}));assert.ok(contract.includes('SR選手を'));assert.ok(contract.includes('指名選手を検索'));
 });
 test('multi-season archives retain aggregate records while bounding detailed replay storage',()=>{
  const finished=simulatePostseason(end,60),second=nextSeason(finished),secondDone={...second,season:{...finished.season,number:2}},third=nextSeason(secondDone);
  assert.equal(second.gems,claimSeasonGoals(finished).gems);assert.equal(second.franchise.points,claimSeasonGoals(finished).franchise.points);assert.equal(nextSeason(second),second);
  assert.ok(third.history[0].results[0].box);assert.equal(third.history[1].results[0].box,undefined);assert.deepEqual(third.history[1].batting,finished.season.batting);assert.deepEqual(third.history[1].pitching,finished.season.pitching);assert.ok(validState(third));
  const eight={...third,history:Array.from({length:8},(_,i)=>({...third.history[i?1:0],number:9-i}))};assert.ok(JSON.stringify(eight).length<2_000_000);
 });
 test('small-sample home run estimates reflect absolute published power rather than league average',()=>{
  const batter=playerMap[start.lineup[0]],pitcher=playerMap[start.pitchers[0]];
  const weak={...batter,batting:null,wikiAssessment:undefined,ratings:{...batter.ratings,power:20}},strong={...weak,ratings:{...weak.ratings,power:80}};
  const a=matchupProbabilities(weak,pitcher),b=matchupProbabilities(strong,pitcher);assert.ok(a.homeRun<.004);assert.ok(b.homeRun>a.homeRun*15);
  for(const g of end.season.results){const h=g.box!.highlights.at(-1);if(h&&h.inning>=9&&h.team===g.home&&g.homeRuns>g.awayRuns&&h.play!=='本塁打')assert.equal(g.homeRuns-g.awayRuns,1);}
 });
}
