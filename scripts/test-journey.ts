import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {findPlayer,players,type Player} from '../src/pro/data';
import {initialState,emptySeason,simulateDays,switchLeague,nextSeason,migrateState,validState,type GameState,type Season} from '../src/pro/engine';
import {recordAchievements} from '../src/pro/achievements';
import {AchievementsPanel} from '../src/pro/CareerAchievements';
import {SimpleSeason} from '../src/pro/SimpleApp';
import {matchupProbabilities} from '../src/pro/matchup';
import {claimSeasonGoals} from '../src/pro/ambitions';
import type {Postseason} from '../src/pro/postseason';

const unlocked=():GameState=>({...initialState(),seed:61001,gems:12000,season:emptySeason(6,'MLB'),leagueProgress:{basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:5}});
const leagueWinner=(number:number):Season=>{const s=emptySeason(number);return {...s,day:143,completed:true,standings:s.standings.map(t=>({...t,w:t.team==='t'?100:60,l:t.team==='t'?43:83}))};};
const champion=(s:Season):Season=>({...s,completed:true,postseason:{stage:'complete',champion:'t',series:[]} as Postseason});
export function registerJourneyTests(test:(name:string,run:()=>void)=>void){
 test('achievement years are recorded from actual league and postseason outcomes and retained after archives expire',()=>{
  const initial=initialState();assert.deepEqual(recordAchievements(initial).achievements,{});
  const regular=recordAchievements({...initial,season:leagueWinner(12)});assert.deepEqual(regular.achievements,{npbLeague:12});
  const title=recordAchievements({...regular,season:champion(regular.season)});assert.deepEqual(title.achievements,{npbLeague:12,npbChampion:12});
  const major=recordAchievements({...title,season:emptySeason(13,'MLB')});assert.equal(major.achievements!.mlbEntry,13);
  const world=recordAchievements({...major,season:champion({...emptySeason(15,'MLB'),day:162})});assert.equal(world.achievements!.worldChampion,15);
  const later=recordAchievements({...world,season:champion(leagueWinner(40)),history:[]});assert.deepEqual(later.achievements,world.achievements);assert.equal(recordAchievements(later),later);
  const old={...initial,season:emptySeason(135,'MLB'),history:[champion(leagueWinner(130))]};const restored=recordAchievements(old);assert.equal(restored.achievements!.npbChampion,130);assert.equal(restored.achievements!.mlbEntry,135);assert.deepEqual(old.achievements,{});
 });
 test('league switching preserves both in-progress seasons, cards, training, random state and wallet without repeat rewards',()=>{
  const base=unlocked();base.training[base.lineup[0]]=2;
  const major=claimSeasonGoals(simulateDays(base,4)),snapshot=JSON.stringify(major);
  const domestic=switchLeague(major,'NPB');assert.equal(JSON.stringify(major),snapshot);assert.equal(domestic.season.number,7);assert.equal(domestic.season.day,0);assert.deepEqual(domestic.parkedSeason,major.season);assert.equal(domestic.seed,major.seed);assert.equal(domestic.gems,major.gems);
  assert.deepEqual(domestic.owned,major.owned);assert.deepEqual(domestic.training,major.training);assert.deepEqual(domestic.lineup,major.lineup);assert.deepEqual(domestic.pitchers,major.pitchers);assert.ok(validState(domestic));
  const played=claimSeasonGoals(simulateDays(domestic,3)),returned=switchLeague(played,'MLB');assert.deepEqual(returned.season,major.season);assert.deepEqual(returned.parkedSeason,played.season);assert.equal(returned.seed,played.seed);assert.equal(returned.gems,played.gems);
  assert.deepEqual(migrateState(returned),returned);assert.deepEqual(migrateState(switchLeague(returned,'NPB')),switchLeague(returned,'NPB'));
  let state=returned;for(let i=0;i<4;i++)state=switchLeague(switchLeague(state,'NPB'),'MLB');assert.deepEqual(state,returned);
  const resumed=simulateDays(returned,1);assert.equal(resumed.season.day,5);assert.equal(resumed.season.results.length,5);assert.deepEqual(resumed.season.results.slice(0,4),major.season.results);assert.deepEqual(resumed.parkedSeason,played.season);
 });
 test('a returning NPB manager stays in NPB for subsequent seasons and season identifiers never collide',()=>{
  const major=unlocked(),domestic=switchLeague(major,'NPB');
  const next=nextSeason({...domestic,season:champion(leagueWinner(7))});assert.equal(next.season.circuit,undefined);assert.equal(next.season.number,8);assert.equal(next.leagueChoice,'NPB');assert.equal(next.parkedSeason!.number,6);assert.equal(next.history[0].number,7);
  const resumed=switchLeague(next,'MLB');assert.equal(resumed.season.number,6);assert.equal(resumed.parkedSeason!.number,8);
  const nextMajor=nextSeason({...resumed,season:champion({...resumed.season,day:162})});assert.equal(nextMajor.season.number,9);assert.equal(nextMajor.season.circuit,'MLB');assert.equal(nextMajor.parkedSeason!.number,8);assert.equal(new Set([nextMajor.season.number,nextMajor.parkedSeason!.number,...nextMajor.history.map(h=>h.number)]).size,4);
 });
 test('switching is gated by earned MLB access and invalid parked seasons or milestone records cannot load',()=>{
  const base=initialState();assert.equal(switchLeague(base,'MLB'),base);assert.equal(switchLeague(base,'NPB'),base);
  const s=switchLeague(unlocked(),'NPB');assert.ok(validState(s));assert.equal(switchLeague(s,'NPB'),s);
  for(const mutate of [(v:GameState)=>{v.parkedSeason!.day=999;},(v:GameState)=>{v.parkedSeason!.number=v.season.number;},(v:GameState)=>{v.leagueProgress!.mlbUnlocked=false;},(v:GameState)=>{v.achievements={npbLeague:999};},(v:GameState)=>{v.achievements={npbLeague:-1};},(v:GameState)=>{v.achievements={unexpected:1} as never;}]){const bad=structuredClone(s);mutate(bad);assert.equal(migrateState(bad),null);}
  const settled=switchLeague({...s,leagueProgress:{basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:7}},'MLB');assert.equal(settled.season.number,6);assert.ok(validState(settled));assert.deepEqual(migrateState(settled),settled);
 });
 test('NPB-to-MLB translation reduces batting and pitching performance while preserving displayed abilities and MLB card baselines',()=>{
  const bat=findPlayer('森下翔太'),pitch=findPlayer('才木浩人'),mlbTag=players.find(p=>p.mlb)!.mlb;
  const taggedBat={...bat,mlb:mlbTag},taggedPitch={...pitch,mlb:mlbTag};
  const r=(b:Player,p:Player,circuit:'NPB'|'MLB'='MLB',batStage=0,pitchStage=0)=>matchupProbabilities(b,p,0,0,0,{},batStage,pitchStage,circuit);
  const frozen=JSON.stringify([bat,pitch]),translatedBat=r(bat,taggedPitch),noBatTransition=r(taggedBat,taggedPitch);
  assert.ok(translatedBat.strikeout>noBatTransition.strikeout);assert.ok(translatedBat.homeRun<noBatTransition.homeRun);assert.ok(translatedBat.babip<noBatTransition.babip);assert.ok(translatedBat.walk<noBatTransition.walk);
  const translatedPitch=r(taggedBat,pitch);assert.ok(translatedPitch.strikeout<noBatTransition.strikeout);assert.ok(translatedPitch.homeRun>noBatTransition.homeRun);assert.ok(translatedPitch.walk>noBatTransition.walk);assert.ok(translatedPitch.babip>noBatTransition.babip);
  assert.deepEqual(r(bat,pitch,'NPB'),r(taggedBat,taggedPitch,'NPB'));assert.equal(JSON.stringify([bat,pitch]),frozen);
  assert.ok(r(bat,taggedPitch,'MLB',5).homeRun>translatedBat.homeRun);assert.ok(r(taggedBat,pitch,'MLB',0,5).walk<translatedPitch.walk);
 });
 test('MLB event probabilities remain valid for the full roster and all awakening stages',()=>{
  const bats=players.filter(p=>p.role==='batter'),arms=players.filter(p=>p.role==='pitcher');
  for(let i=0;i<bats.length;i++)for(const stage of [0,2,5]){const r=matchupProbabilities(bats[i],arms[i%arms.length],0,0,.005,{},stage,stage,'MLB');assert.ok(Object.values(r).every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.ok(r.walk+r.hbp<1);assert.ok(r.hit+r.strikeout<=1);assert.ok(r.homeRun+r.double+r.triple<=r.hit+1e-12);}
 });
 test('achievement celebrations show the attained year and league controls remain compact and disabled during simulation',()=>{
  const state=recordAchievements({...initialState(),season:champion(leagueWinner(12))});
  const html=renderToStaticMarkup(createElement(AchievementsPanel,{state,season:state.season}));assert.ok(html.includes('日本一を達成！'));assert.ok(html.includes('12'));assert.ok(html.includes('年目に'));assert.ok(html.includes('達成記録'));assert.ok(!html.includes('confetti'));assert.ok(!html.includes('初優勝'));
  const render=(s:GameState,busy=false)=>renderToStaticMarkup(createElement(SimpleSeason,{state:s,busy,progress:0,onPlay:()=>{},onPost:()=>{},onNext:()=>{},onPlayer:()=>{},onSwitchLeague:()=>{},message:''}));
  assert.ok(!render(initialState()).includes('NPBで立て直す'));assert.ok(render(unlocked()).includes('NPBで立て直す'));assert.match(render(unlocked(),true),/disabled=""[^>]*>NPBで立て直す/);assert.ok(render(switchLeague(unlocked(),'NPB')).includes('MLBに挑戦する'));assert.ok(render(switchLeague(unlocked(),'NPB')).includes('いつでも再開'));
 });
}
