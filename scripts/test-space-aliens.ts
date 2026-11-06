import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {playerMap,teams,teamById} from '../src/pro/data';
import {mlbPlayers} from '../src/pro/mlb-players';
import {mlbLeagueTeams,mlbOpponentPlayers,spaceAlienNames,isSpaceAlien} from '../src/pro/mlb-opponents';
import {spaceTeams} from '../src/pro/display-names';
import {shownKmh} from '../src/pro/velocity-display';
import {AVOID_WORDS,looksReal,SPACE_TEAM_ROWS,alienNameFrom,alienStat,alienVelocity,buildAlienNames,setDisplayCircuit} from '../src/pro/space-aliens';
import {initialState,emptySeason,simulateDays,type GameState} from '../src/pro/engine';
import {leagueTeams} from '../src/pro/leagues';
import {PawaPlayer} from '../src/pro/pawa/PawaPlayer';

// 2026-11-03 宇宙リーグの相手を宇宙人に(見た目だけ。試合の計算は変えない)。
const spaceState=():GameState=>({...initialState(3917),starterScout:undefined,season:emptySeason(7,'SPACE',initialState(3917).club),achievements:{worldChampion:6},leagueChoice:'SPACE',leagueProgress:{basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:6}});
// 実在の名前に寄らないかを見る語(よく知られた大リーガー・作品の宇宙人の呼び名など。完全ではない)。
const REAL_KATAKANA=AVOID_WORDS;

export function registerSpaceAlienTests(test:(name:string,run:()=>void)=>void){
 test('space clubs use 30 coined alien names that differ from every real NPB/MLB club and from the overseas aliases',()=>{
  assert.equal(SPACE_TEAM_ROWS.length,30);assert.equal(Object.keys(spaceTeams).length,30);
  assert.deepEqual(Object.keys(spaceTeams).sort(),mlbLeagueTeams.map(t=>t.id).sort());
  const values=Object.values(spaceTeams);
  for(const key of ['name','short','mark'] as const)assert.equal(new Set(values.map(t=>t[key])).size,30,key);
  const earth=[...teams,...mlbLeagueTeams].flatMap(t=>[t.name,t.short]);
  for(const t of values){
   assert.ok(Array.from(t.short).length<=8,t.short);assert.ok(/^[A-Z]{3}$/.test(t.mark));
   assert.ok(!earth.some(e=>t.name.includes(e)||e.includes(t.short)),t.name);
   assert.ok(!looksReal(t.short)&&!looksReal(t.name),t.name);
  }
  const season=spaceState().season;
  const shown=leagueTeams(season).filter(t=>t.id.startsWith('mlb-'));
  assert.equal(shown.length,29);for(const t of shown)assert.equal(t.short,spaceTeams[t.id].short);
  assert.equal(teamById('mlb-119',season).short,'アストロゴンズ');assert.equal(teamById('mlb-119').short,'ロサンゼルス');
 });
 test('every space opponent gets a stable, unique alien name; one per roster slot, never a real or earth name',()=>{
  assert.equal(spaceAlienNames.size,mlbOpponentPlayers.length);
  const names=[...spaceAlienNames.values()];assert.equal(new Set(names).size,names.length);
  // 決まった種から作るので、何度作っても同じ(セーブごとにぶれない)
  assert.deepEqual([...buildAlienNames(mlbOpponentPlayers)],[...spaceAlienNames]);
  assert.equal(alienNameFrom('space|mlb-108|0|0'),alienNameFrom('space|mlb-108|0|0'));
  // 各球団の名簿の人数ぶん
  for(const t of mlbLeagueTeams){const roster=mlbOpponentPlayers.filter(p=>p.team===t.id);assert.ok(roster.length>=39);assert.ok(roster.every(p=>spaceAlienNames.has(p.id)));}
  setDisplayCircuit('NPB');
  const earth=new Set([...Object.values(playerMap).map(p=>p.name),...mlbPlayers.map(p=>p.name)]);
  for(const n of names){
   const len=Array.from(n).length;assert.ok(len>=7&&len<=9,n);
   assert.ok(/^[ァ-ー]+([=・][ァ-ー]+){1,2}$/u.test(n),n);
   assert.ok(!earth.has(n),n);
   assert.ok(!looksReal(n),n);
   for(const piece of n.split(/[=・]/))assert.ok(!REAL_KATAKANA.includes(piece),n);
  }
 });
 test('alien names and space abilities are display-only: names follow the circuit and matches are identical',()=>{
  const rival=mlbOpponentPlayers.find(p=>p.role==='pitcher')!,own=mlbPlayers[0],earthName=rival.name,ratings=JSON.stringify(rival.ratings);
  try{
   setDisplayCircuit('SPACE');
   assert.equal(playerMap[rival.id].name,spaceAlienNames.get(rival.id));assert.ok(isSpaceAlien(rival));
   assert.ok(!isSpaceAlien(own));assert.ok(own.name.includes('〇'));
   assert.equal(JSON.stringify(rival.ratings),ratings);
   setDisplayCircuit('MLB');assert.equal(rival.name,earthName);assert.ok(!isSpaceAlien(rival));
   // 名前の替えは試合に入らない
   const a=spaceState();setDisplayCircuit('SPACE');const withAliens=simulateDays(a,6);setDisplayCircuit('NPB');const without=simulateDays(spaceState(),6);
   assert.deepEqual(withAliens.season.results,without.season.results);assert.deepEqual(withAliens.season.standings,without.season.standings);
  }finally{setDisplayCircuit('NPB');}
  // 11/6 夜 持ち主「査定は宇宙基準じゃなく一般基準にして」: 見た目の数字も地球の選手と同じ物差し(球速は全員 shownKmh)
  const velo=mlbOpponentPlayers.filter(p=>p.role==='pitcher').map(p=>alienVelocity(p.ratings.velocity));
  assert.ok(Math.min(...velo)>=135&&Math.max(...velo)<=161,`${Math.min(...velo)}-${Math.max(...velo)}`);
  assert.equal(alienVelocity(150),shownKmh(150));assert.equal(alienStat(92),92);assert.equal(alienStat(99),99);
 });
 test('alien player sheet shows the alien name, space club, cosmic numbers and features only in the space league',()=>{
  const state=spaceState(),pitcher=mlbOpponentPlayers.find(p=>p.role==='pitcher'&&p.ratings.velocity>=158)!;
  const render=()=>renderToStaticMarkup(createElement(PawaPlayer,{player:pitcher,state,onChange:()=>{},onAwaken:()=>{}}));
  try{
   setDisplayCircuit('SPACE');const html=render();
   assert.ok(html.includes(spaceAlienNames.get(pitcher.id)!));assert.ok(html.includes(spaceTeams[pitcher.team].short));assert.ok(html.includes(' · 宇宙'));
   assert.ok(html.includes(`${shownKmh(pitcher.ratings.velocity)}<em>km/h</em>`));assert.ok(!html.includes('宇宙の目盛り'));assert.ok(html.includes('pw-trait-alien'));
   setDisplayCircuit('MLB');const earth=render();
   assert.ok(!earth.includes(spaceAlienNames.get(pitcher.id)!));assert.ok(earth.includes(`${shownKmh(pitcher.ratings.velocity)}<em>km/h</em>`));assert.ok(!earth.includes('pw-trait-alien'));
  }finally{setDisplayCircuit('NPB');}
 });
}
