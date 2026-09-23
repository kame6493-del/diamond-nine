import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,emptySeason,type GameState,type Season} from '../src/pro/engine';
import {recordAchievements} from '../src/pro/achievements';
import {settleLeagueProgress} from '../src/pro/leagues';
import type {Postseason} from '../src/pro/postseason';
import {firstTitleCelebration} from '../src/pro/title-celebration';
import {TitleCelebration} from '../src/pro/TitleCelebration';

const leagueWinner=(number:number):Season=>{const s=emptySeason(number);return {...s,day:143,completed:true,standings:s.standings.map(t=>({...t,w:t.team==='t'?100:60,l:t.team==='t'?43:83}))};};
const finished=(season:Season,champion='t'):Season=>({...season,completed:true,postseason:{stage:'complete',champion,series:[]} as Postseason});
const twoTitles=():GameState=>({...initialState(),name:'はじめてのクラブ',history:[leagueWinner(1),leagueWinner(2)],season:emptySeason(3),leagueProgress:{basis:'league',npbStreak:2,mlbUnlocked:false,lastSettledSeason:2}});
const major=():GameState=>({...twoTitles(),season:emptySeason(8,'MLB'),leagueProgress:{basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:7}});

export function registerTitleCelebrationTests(test:(name:string,run:()=>void)=>void){
 test('third consecutive NPB league title unlocks a first ceremony even after losing the Japan Series',()=>{
  const before=twoTitles(),after=recordAchievements(settleLeagueProgress({...before,season:finished(leagueWinner(3),'h')}));
  const frozen=JSON.stringify([before,after]);
  assert.deepEqual(firstTitleCelebration(before,after),{kind:'mlb-unlocked',year:3,clubName:before.name});
  assert.equal(JSON.stringify([before,after]),frozen,'ceremony detection cannot mutate rewards, cards or random state');
  assert.equal(firstTitleCelebration(after,after),null,'reloading the same result is silent');
  assert.equal(firstTitleCelebration({...after,season:emptySeason(4)}, {...after,season:leagueWinner(4)}),null,'subsequent league titles are silent');
 });
 test('one or two titles, interrupted streaks and a Japan Series win alone cannot unlock a ceremony',()=>{
  const base=initialState();
  for(const n of [1,2]){
   const before={...base,season:emptySeason(n),history:n===2?[leagueWinner(1)]:[]};
   assert.equal(firstTitleCelebration(before,{...before,season:finished(leagueWinner(n))}),null);
  }
  const broken={...base,history:[leagueWinner(1),leagueWinner(3)],season:emptySeason(4)};
  assert.equal(firstTitleCelebration(broken,{...broken,season:leagueWinner(4)}),null);
  const last=twoTitles(),loss=leagueWinner(3);loss.standings=loss.standings.map(t=>({...t,w:t.team==='g'?100:60,l:t.team==='g'?43:83}));
  assert.equal(firstTitleCelebration(last,{...last,season:finished(loss)}),null);
 });
 test('first World Series title celebrates the correct year and repeated or previously archived titles stay silent',()=>{
  const before=major(),after=recordAchievements({...before,season:finished({...before.season,day:162})});
  assert.deepEqual(firstTitleCelebration(before,after),{kind:'world-champion',year:8,clubName:before.name});
  assert.equal(firstTitleCelebration(after,after),null);
  const later={...after,season:emptySeason(25,'MLB'),history:[]};
  assert.equal(firstTitleCelebration(later,{...later,season:finished({...later.season,day:162})}),null,'durable record survives expired archives');
  const legacy={...before,achievements:undefined,history:[finished({...emptySeason(6,'MLB'),day:162})]};
  assert.equal(firstTitleCelebration(legacy,after),null,'legacy archive proves an earlier title');
  assert.equal(firstTitleCelebration({...before,parkedSeason:legacy.history[0]},after),null,'parked season proves an earlier title');
 });
 test('World Series loss, regular season success and an unfinished series do not celebrate',()=>{
  const before=major();
  const after={...before,season:finished({...before.season,day:162})};
  assert.equal(firstTitleCelebration(before,{...after,season:finished(after.season,'mlb-119')}),null);
  assert.equal(firstTitleCelebration(before,{...after,season:{...after.season,postseason:undefined}}),null);
  assert.equal(firstTitleCelebration(before,{...after,season:{...after.season,postseason:{...after.season.postseason!,stage:'world'}}}),null);
  assert.equal(firstTitleCelebration(before,{...after,season:{...after.season,completed:false}}),null);
 });
 test('importing a different season, circuit or club cannot masquerade as a just-played first achievement',()=>{
  const before=twoTitles(),after={...before,season:leagueWinner(3)};
  assert.equal(firstTitleCelebration({...before,season:emptySeason(2)},after),null);
  assert.equal(firstTitleCelebration({...before,season:emptySeason(3,'MLB')},after),null);
  assert.equal(firstTitleCelebration({...before,club:'g'},after),null);
  const oldAccess={...before,leagueProgress:{npbStreak:3,mlbUnlocked:true,lastSettledSeason:2}};
  assert.equal(firstTitleCelebration(oldAccess,after),null,'previously unlocked legacy saves remain silent');
 });
 test('both ceremony variants identify the first milestone with an immediate close, sound control and results action',()=>{
  for(const kind of ['mlb-unlocked','world-champion'] as const){
   const html=renderToStaticMarkup(createElement(TitleCelebration,{celebration:{kind,year:12,clubName:'12年かけたチーム'},sound:false,onToggleSound:()=>{},onClose:()=>{}}));
   assert.ok(html.includes('<dialog'));assert.ok(html.includes('aria-labelledby'));assert.ok(html.includes('12年かけたチーム'));assert.ok(html.includes('<strong>12</strong>'));
   assert.ok(html.includes('お祝い演出を閉じる'));assert.ok(html.includes('効果音をオンにする'));assert.ok(html.includes('の記録を見る'));
   assert.ok(!html.includes('confetti'));assert.ok(!html.includes('canvas'));
   assert.ok(html.includes(kind==='world-champion'?'初優勝おめでとう':'手に入れた！'));
  }
 });
}
