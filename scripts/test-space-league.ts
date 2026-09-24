import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,emptySeason,simulateDays,switchLeague,nextSeason,migrateState,validState,type GameState} from '../src/pro/engine';
import {circuitOf,spaceUnlocked,seasonGames,leagueTeams} from '../src/pro/leagues';
import {finishPostseason} from '../src/pro/postseason';
import {recordAchievements} from '../src/pro/achievements';
import {SimpleSeason} from '../src/pro/SimpleApp';
import {firstTitleCelebration} from '../src/pro/title-celebration';
import {mlbDifficultySquads} from './mlb-difficulty-fixtures';
import {collectSimpleRewards} from '../src/pro/simple-game';

const unlocked=():GameState=>({...initialState(3917),starterScout:undefined,season:emptySeason(7),achievements:{worldChampion:6},leagueProgress:{basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:6}});
export function registerSpaceLeagueTests(test:(name:string,run:()=>void)=>void){
 test('space is locked until a world title and hidden from the pre-title season screen',()=>{
  const locked={...initialState(),leagueProgress:{basis:'league' as const,npbStreak:3,mlbUnlocked:true,lastSettledSeason:0}};
  assert.equal(spaceUnlocked(locked),false);assert.equal(switchLeague(locked,'SPACE'),locked);
  const render=(state:GameState)=>renderToStaticMarkup(createElement(SimpleSeason,{state,busy:false,progress:0,onPlay:()=>{},onPost:()=>{},onNext:()=>{},onPlayer:()=>{},message:''}));
  assert.ok(!render(locked).includes('宇宙リーグ'));
  const legacy={...locked,season:{...emptySeason(6,'MLB',locked.club),completed:true,postseason:{stage:'complete',champion:locked.club} as GameState['season']['postseason']}};
  assert.ok(spaceUnlocked(legacy));assert.equal(recordAchievements(legacy).achievements?.worldChampion,6);
  assert.ok(render(unlocked()).includes('宇宙リーグに挑戦する'));
  const space=switchLeague(unlocked(),'SPACE');assert.ok(validState(space));assert.equal(seasonGames(space.season),162);assert.equal(leagueTeams(space.season).length,30);
  assert.ok(render(space).includes('宇宙王座決定戦優勝'));assert.ok(render(space).includes('海外リーグに戻る'));
 });
 test('all three ongoing leagues survive switching, reload and resume without duplicating rewards',()=>{
  const domestic=simulateDays(unlocked(),2);
  const overseas=simulateDays(switchLeague(domestic,'MLB'),3);
  const space=collectSimpleRewards(simulateDays(switchLeague(overseas,'SPACE'),4));
  assert.ok(validState(space));const saved=migrateState(JSON.parse(JSON.stringify(space)))!;assert.ok(saved);
  const returned=switchLeague(saved,'NPB');assert.deepEqual(returned.season,domestic.season);
  const back=switchLeague(returned,'MLB');assert.deepEqual(back.season,overseas.season);
  const resumed=switchLeague(back,'SPACE');assert.deepEqual(resumed.season,space.season);
  for(const state of [saved,returned,back,resumed]){assert.ok(validState(state));assert.equal(state.gems,space.gems);assert.deepEqual(state.owned,space.owned);assert.deepEqual(state.training,space.training);}
  const played=simulateDays(resumed,1);assert.equal(played.season.day,5);assert.deepEqual(played.season.results.slice(0,4),space.season.results);
  const malformed=structuredClone(space);malformed.additionalParkedSeasons=[space.season];assert.equal(migrateState(malformed),null);
  const locked=structuredClone(space);delete locked.achievements?.worldChampion;assert.equal(validState(locked),false);
 });
 test('space is harder than overseas but a deeply developed team can win without guaranteed titles',()=>{
  const squads=mlbDifficultySquads(),summaries=[];
  for(const index of [2,3,4]){
   let wins=0,titles=0,playoffs=0;
   for(let sample=0;sample<8;sample++){
    const squad=squads[index][1],start={...squad,starterScout:undefined,season:emptySeason(7,'SPACE',squad.club),achievements:{worldChampion:6},leagueChoice:'SPACE' as const,leagueProgress:{basis:'league' as const,npbStreak:3,mlbUnlocked:true,lastSettledSeason:6},seed:39017+sample*98881};
    const end=finishPostseason(simulateDays(start,162)),post=end.season.postseason!;
    assert.ok(validState(end));assert.ok(migrateState(JSON.parse(JSON.stringify(end))));assert.equal(post.circuit,'SPACE');assert.equal(post.stage,'complete');
    wins+=end.season.standings.find(r=>r.team===end.club)!.w;
    titles+=Number(post.champion===end.club);playoffs+=Number(post.series.some(r=>r.higher===end.club||r.lower===end.club));
    assert.equal(end.achievements?.worldChampion,6);assert.deepEqual(end.owned,start.owned);assert.deepEqual(end.training,start.training);
    const next=nextSeason(end);assert.equal(circuitOf(next.season),'SPACE');assert.ok(validState(next));
    if(post.champion===end.club){assert.equal(end.achievements?.spaceChampion,7);assert.equal(firstTitleCelebration(start,end)?.kind,'space-champion');assert.equal(firstTitleCelebration(end,end),null);}
   }
   summaries.push({name:squads[index][0],wins:wins/8,titles,playoffs});
  }
  console.log('SPACE balance (8 seasons per squad):',JSON.stringify(summaries));
  const [base,developing,elite]=summaries;
  assert.ok(base.wins<80);assert.equal(base.titles,0);
  assert.ok(developing.wins>base.wins+10&&developing.wins<100);
  assert.ok(elite.wins>developing.wins+3&&elite.wins<112);assert.ok(elite.titles>=1&&elite.titles<8);assert.ok(elite.playoffs>=5);
 });
}
