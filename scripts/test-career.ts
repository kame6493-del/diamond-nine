import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialState,initialSandboxState,drawPlayers,simulateDays,loadState,saveKeyFor,SAVE_KEY,CAREER_SAVE_KEY,validState,redeemURTicket,nextSeason,type GameResult } from '../src/pro/engine';
import { fitsPosition,players,playerMap,findPlayer } from '../src/pro/data';
import { claimAllMilestones,claimMilestone,establishClub,milestonesFor } from '../src/pro/franchise';
import { gameReward,seasonReward,postseasonReward } from '../src/pro/progression';
import { simulatePostseason } from '../src/pro/postseason';
import { bestUpgrade,equipScoutedPlayer } from '../src/pro/career-roster';
import {claimSeasonGoals} from '../src/pro/ambitions';
import { CareerHome,CareerScout,SingleScoutOpening } from '../src/pro/Career';

export function registerCareerTests(test:(name:string,run:()=>void)=>void){
 test('career starts with 24 real players, valid positions, modest strength and zero currency',()=>{
  const s=initialState();assert.ok(validState(s));assert.equal(s.mode,'career');assert.equal(Object.keys(s.owned).length,24);assert.ok(Object.keys(s.owned).every(id=>!playerMap[id].provisional));assert.ok(s.lineup.every(id=>playerMap[id].overall<=50));assert.ok(s.pitchers.every(id=>playerMap[id].overall<=65));assert.equal(s.gems,0);assert.equal(s.franchise.tickets,0);assert.equal(s.franchise.points,0);assert.equal(s.pulls,0);
  for(const id of s.lineup)assert.ok(fitsPosition(playerMap[id],s.defense[id]));
  const bat=s.lineup.map(id=>playerMap[id].overall),pit=s.pitchers.map(id=>playerMap[id].overall);assert.ok(Math.max(...bat)<=51);assert.ok(Math.max(...pit)<=68);assert.ok(bat.reduce((a,b)=>a+b)/9<=50);assert.ok(pit.reduce((a,b)=>a+b)/12<=65);
  assert.ok([...bat,...pit].reduce((a,b)=>a+b)/21<59);
  assert.deepEqual(claimAllMilestones(s),s);assert.equal(claimMilestone(s,'club'),s);
  const profile={city:'大阪',mark:'D',color:'#123456',motto:'新しいチーム'};const updated=establishClub({...s,franchise:{...s.franchise,established:false}},profile,'テスト球団',findPlayer('佐藤輝明').id);assert.equal(updated.gems,0);assert.deepEqual(updated.owned,s.owned);
 });
 test('wins, draws and losses credit only the shared wallet; daily and batch rewards agree',()=>{
  const s=initialState();s.seed=2345;const fake={home:s.club,away:'g',homeRuns:0,awayRuns:1} as GameResult;
  assert.equal(gameReward(s,fake),18);assert.equal(gameReward(s,{...fake,homeRuns:2}),26);assert.equal(gameReward(s,{...fake,homeRuns:1}),22);assert.equal(gameReward(s,{...fake,home:'g',away:s.club}),26);
  const batch=simulateDays(s,5);let daily=s;for(let i=0;i<5;i++)daily=simulateDays(daily,1);assert.deepEqual(batch,daily);assert.equal(batch.gems,batch.season.results.reduce((n,g)=>n+gameReward(s,g),0));assert.ok(batch.gems>=90&&batch.gems<=130);assert.equal(batch.franchise.points,0);
  const funded={...batch,gems:300};const drawn=drawPlayers(funded,1);assert.equal(drawn.gems,0);assert.equal(drawn.lastPulls.length,1);assert.equal(Object.values(drawn.owned).reduce((a,b)=>a+b),25);assert.equal(drawn.pulls,1);assert.ok(validState(drawn));assert.equal(drawPlayers(s,1),s);assert.equal(drawPlayers({...s,gems:9999},10).pulls,0);
 });
 test('single draws guarantee SR at five and SSR at ten, with UR pity taking precedence',()=>{
  for(let seed=1;seed<120;seed++){
   const s={...initialState(),seed,gems:300};
   assert.ok(['SR','SSR','UR'].includes(playerMap[drawPlayers({...s,pulls:4},1).lastPulls[0].playerId].rarity));
   assert.ok(['SSR','UR'].includes(playerMap[drawPlayers({...s,pulls:9},1).lastPulls[0].playerId].rarity));
   const pity=drawPlayers({...s,pulls:9,pity:49},1);assert.equal(playerMap[pity.lastPulls[0].playerId].rarity,'UR');assert.equal(pity.pity,0);assert.equal(pity.pulls,10);
  }
  let s={...initialState(),seed:99,gems:30000};for(let i=1;i<=50;i++){s=drawPlayers(s,1);assert.equal(s.lastPulls.length,1);if(i%10===0)assert.ok(['SSR','UR'].includes(playerMap[s.lastPulls[0].playerId].rarity));assert.ok(validState(s));}assert.equal(s.gems,15000);
  const ticketState={...s,franchise:{...s.franchise,tickets:1}},ticket=redeemURTicket(ticketState);assert.equal(ticket.gems,s.gems);assert.equal(ticket.pulls,s.pulls);assert.equal(ticket.pity,s.pity);assert.equal(ticket.franchise.tickets,0);assert.equal(playerMap[ticket.lastPulls[0].playerId].rarity,'UR');
 });
 test('immediate upgrades respect positions and ownership and retain the benched player',()=>{
  const s=initialState();for(const p of players.filter(p=>p.rarity==='UR')){
   const owned={...s,owned:{...s.owned,[p.id]:1}},upgrade=bestUpgrade(owned,p.id);assert.ok(upgrade,p.name);const next=equipScoutedPlayer(owned,p.id);assert.ok(validState(next));assert.equal(next.owned[upgrade.oldId],1);assert.ok(upgrade.after>upgrade.before);assert.equal(bestUpgrade(next,p.id),null);assert.equal(equipScoutedPlayer(next,p.id),next);
   if(!upgrade.pitching)assert.ok(fitsPosition(p,next.defense[p.id]));else assert.equal(next.pitchers[upgrade.index],p.id);
   assert.equal(equipScoutedPlayer(s,p.id),s);
  }
 });
 test('career runs the full year with one-time rewards and keeps its collection in the next season',()=>{
  const s=initialState();s.seed=9876;const season=simulateDays(s,143);assert.ok(validState(season));assert.equal(season.gems,season.season.results.reduce((n,g)=>n+gameReward(s,g),0)+seasonReward(s));assert.equal(season.franchise.tickets,0);assert.deepEqual(simulateDays(season,143),season);
  const claimed=claimAllMilestones(season);assert.equal(claimed.gems-season.gems,milestonesFor(season).filter(m=>m.value(season)>=m.goal).reduce((n,m)=>n+m.gems,0));assert.deepEqual(claimAllMilestones(claimed),claimed);
  const finished=simulatePostseason(claimed,60),post=finished.season.postseason!,champion=post.champion===s.club,finalist=post.series.some(series=>series.stage==='japan'&&[series.higher,series.lower].includes(s.club));assert.equal(finished.gems-claimed.gems,postseasonReward(s,champion,finalist));assert.ok(validState(finished));assert.deepEqual(simulatePostseason(finished,60),finished);
  const next=nextSeason(finished);assert.equal(next.season.day,0);assert.equal(next.season.number,2);assert.deepEqual(next.owned,finished.owned);assert.equal(next.gems,claimSeasonGoals(finished).gems);assert.equal(next.mode,'career');
 });
 test('legacy and career save slots load independently without modifying the old save',()=>{
  const old=initialSandboxState();old.gems=97475;old.name='既存の大切な球団';const career=initialState();career.gems=80;
  const values=new Map([[SAVE_KEY,JSON.stringify(old)],[CAREER_SAVE_KEY,JSON.stringify(career)]]),previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:()=>{throw new Error('load must not write');}}});
  try{assert.deepEqual(loadState('career').state,career);assert.deepEqual(loadState('free').state,old);assert.equal(saveKeyFor('free'),SAVE_KEY);assert.notEqual(saveKeyFor('career'),SAVE_KEY);values.delete(CAREER_SAVE_KEY);assert.equal(loadState().state.gems,0);assert.equal(values.get(SAVE_KEY),JSON.stringify(old));}
  finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
 });
 test('career screens offer one card and earned points without a free top-up or ten-card action',()=>{
  const s=initialState(),noop=()=>{},renderCard=()=>null;
  const home=renderToStaticMarkup(createElement(CareerHome,{state:s,advance:noop,onScout:noop,onTeam:noop,onSeason:noop,onClub:noop,onGame:noop,renderCard}));assert.ok(home.includes('5試合プレイ'));assert.ok(home.includes('1枚スカウトへ'));assert.ok(home.includes('disabled'));
  const scout=renderToStaticMarkup(createElement(CareerScout,{state:s,focus:'all',setFocus:noop,onPull:noop,onTicket:noop,onPlay:noop,onTeam:noop,onEquip:noop,renderCard}));assert.ok(scout.includes('1枚スカウト'));assert.ok(!scout.includes('10連'));assert.ok(!scout.includes('無料ジェム'));assert.ok(!scout.includes('UZR'));
  const pulled=drawPlayers({...s,gems:300},1),opening=renderToStaticMarkup(createElement(SingleScoutOpening,{state:pulled,onClose:noop,onAgain:noop,onTeam:noop,onPlay:noop,onEquip:noop,onReveal:noop,renderCard}));assert.ok(opening.includes('カードをめくる'));assert.ok(!opening.includes('もう10連'));
 });
}
