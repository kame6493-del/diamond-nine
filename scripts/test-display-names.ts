import assert from 'node:assert/strict';
import {findPlayer,playerMap,players,teams,teamById} from '../src/pro/data';
import {mlbPlayers,mlbTeams} from '../src/pro/mlb-players';
import {mlbLeagueTeams,mlbOpponentPlayers} from '../src/pro/mlb-opponents';
import {maskPlayerName} from '../src/pro/display-names';
import {browseCards,defaultCardFilters} from '../src/pro/player-browser';
import {initialState,migrateState} from '../src/pro/engine';

export function registerDisplayNameTests(test:(name:string,run:()=>void)=>void){
 test('all collectible, legacy and opponent names are masked, with stable IDs and canonical search',()=>{
  assert.equal(maskPlayerName('小川 海斗'),'小〇 海斗');assert.equal(maskPlayerName('大谷翔平'),'大〇翔平');
  assert.equal(maskPlayerName('周'),'〇');assert.equal(maskPlayerName('大〇 翔平'),'大〇 翔平');
  assert.equal(maskPlayerName('A. Judge'),'A. 〇udge');
  for(const p of Object.values(playerMap))assert.ok(p.name.includes('〇'),p.id);
  assert.equal(mlbPlayers.length,15);assert.ok(mlbOpponentPlayers.length>1000);
  const state=initialState(),before=JSON.stringify(state);
  for(const [name,id] of [['大谷 翔平','mlb-660271'],['鈴木 誠也','mlb-673548']]){
   const p=findPlayer(name);assert.equal(p,playerMap[id]);
   for(const search of [name,p.name])assert.ok(browseCards(players,state,{...defaultCardFilters,search}).some(row=>row.id===id));
  }
  assert.equal(findPlayer('大谷翔平').name,'大〇 翔平');
  assert.ok(state.lineup.every(id=>playerMap[id]));
  const restored=migrateState(JSON.parse(before))!;assert.ok(restored);
  assert.deepEqual(restored.owned,state.owned);assert.deepEqual(restored.training,state.training);
  assert.deepEqual(restored.lineup,state.lineup);assert.equal(JSON.stringify(state),before);
 });
 test('all 12 NPB and 30 MLB clubs use unique geographic names consistently in cards and leagues',()=>{
  assert.equal(teams.length,12);assert.equal(mlbLeagueTeams.length,30);
  assert.equal(teamById('t').name,'兵庫');assert.equal(teamById('g').short,'東京');
  assert.equal(teamById('mlb-119').short,'ロサンゼルス');
  for(const group of [teams,mlbLeagueTeams]){
   assert.equal(new Set(group.map(t=>t.short)).size,group.length);
   for(const t of group){assert.ok(t.name&&t.short&&t.mark);assert.equal(teamById(t.id).name,t.name);}
  }
  for(const t of mlbTeams){const rival=mlbLeagueTeams.find(row=>row.id===t.id)!;assert.equal(rival.short,t.short);assert.equal(rival.mark,t.mark);}
 });
}
