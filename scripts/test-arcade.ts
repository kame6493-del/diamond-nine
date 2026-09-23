import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,simulateDays,validState,saveKeyFor} from '../src/pro/engine';
import {resetTeam,readResetBackup,restoreResetBackup,completeResetTeam} from '../src/pro/reset-team';
import {DeckTeam,TradingCard,Burst} from '../src/pro/CardDeck';
import {playerMap,players} from '../src/pro/data';

export function registerArcadeTests(test:(name:string,run:()=>void)=>void){
 const store=()=>{const data=new Map<string,string>();return {data,get length(){return data.size;},key:(index:number)=>[...data.keys()][index]??null,removeItem:(key:string)=>{data.delete(key);},getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};};
 test('team reset starts over and provides a complete restorable copy without deleting any save',()=>{
  const before=simulateDays(initialState(),12);before.name='虹色ライオンズ';before.training[before.lineup[0]]=3;before.owned[before.lineup[0]]=4;before.pulls=18;
  const storage=store();storage.setItem(saveKeyFor('career'),JSON.stringify(before));storage.setItem(saveKeyFor('free'),'unrelated-save');const json=JSON.stringify(before);
  const reset=resetTeam(before,'career',storage);
  assert.ok(validState(reset));assert.equal(reset.name,before.name);assert.equal(reset.season.day,0);assert.equal(reset.season.number,1);assert.equal(reset.gems,0);assert.equal(reset.pulls,0);assert.equal(Object.keys(reset.owned).length,24);assert.deepEqual(reset.training,{});
  assert.equal(JSON.stringify(before),json);assert.deepEqual(readResetBackup('career',storage),before);assert.equal(storage.getItem(saveKeyFor('free')),'unrelated-save');
  const savedCount=storage.data.size,restored=restoreResetBackup(reset,'career',storage);assert.deepEqual(restored,before);assert.ok(storage.data.size>savedCount);assert.deepEqual(JSON.parse(storage.getItem(saveKeyFor('career'))!),before);
  const firstKeys=[...storage.data.keys()];resetTeam(restored,'career',storage);assert.ok(firstKeys.every(key=>storage.data.has(key)));
 });
 test('reset aborts when a backup cannot be saved; invalid or cross-profile backups cannot restore',()=>{
  const before=initialState(),storage=store();storage.setItem(saveKeyFor('career'),JSON.stringify(before));const broken={getItem:storage.getItem,setItem:(key:string,value:string)=>{if(key.includes('-snapshot-'))throw new Error('quota');storage.setItem(key,value);}};
  assert.throws(()=>resetTeam(before,'career',broken));assert.deepEqual(JSON.parse(storage.getItem(saveKeyFor('career'))!),before);assert.equal(readResetBackup('career',broken),null);
  storage.setItem(`${saveKeyFor('career')}-reset-backup`,'bad');storage.setItem('bad','not-json');assert.equal(restoreResetBackup(before,'career',storage),before);
  storage.setItem('bad',JSON.stringify({...before,mode:'free'}));assert.equal(readResetBackup('career',storage),null);
 });
 test('card deck exposes 21 selectable roster cards, hand cards, five abilities and no rarity badges',()=>{
  const state=initialState(),html=renderToStaticMarkup(createElement(DeckTeam,{state,onChange:()=>{},onPlayer:()=>{},onImpact:()=>{}}));
  assert.equal((html.match(/class="deck-card-button"/g)??[]).length,21);assert.equal((html.match(/class="deck-hand-card"/g)??[]).length,3);
  assert.ok(html.includes('スターティング9'));assert.ok(html.includes('投手デッキ'));assert.ok(html.includes('draggable="true"'));
  assert.ok(!html.includes('rarity-'));assert.ok(!html.includes('レア度'));
  const card=renderToStaticMarkup(createElement(TradingCard,{player:playerMap[state.lineup[0]],state}));for(const label of ['ミート','パワー','走力','肩','守備'])assert.ok(card.includes(label));assert.ok(!card.includes('UZR'));
  const burst=renderToStaticMarkup(createElement(Burst,{}));assert.ok(burst.includes('aria-hidden="true"'));
 });
 test('complete reset removes acquired cards, duplicates, development, seasons and every reset snapshot of this club',()=>{
  const storage=store(),before=simulateDays(initialState(),5),newPlayer=players.find(p=>p.mlb)!;
  before.owned[newPlayer.id]=6;before.training[newPlayer.id]=5;before.pulls=23;before.name='前のクラブ';
  resetTeam(before,'career',storage);resetTeam(before,'career',storage);
  storage.setItem(saveKeyFor('free'),'other-profile');storage.setItem('unrelated-setting','keep');
  const fresh=completeResetTeam('career',storage);
  assert.ok(validState(fresh));assert.deepEqual(fresh.owned,initialState(fresh.seed).owned);assert.equal(Object.keys(fresh.owned).length,24);assert.equal(fresh.owned[newPlayer.id],undefined);assert.ok(Object.values(fresh.owned).every(v=>v===1));assert.deepEqual(fresh.training,{});assert.deepEqual(fresh.history,[]);assert.deepEqual(fresh.lastPulls,[]);
  assert.equal(fresh.season.number,1);assert.equal(fresh.season.day,0);assert.equal(fresh.gems,0);assert.equal(fresh.franchise.points,0);assert.equal(fresh.franchise.tickets,0);assert.equal(fresh.pulls,0);assert.equal(readResetBackup('career',storage),null);
  assert.ok(![...storage.data.keys()].some(key=>key.startsWith(saveKeyFor('career')+'-')));assert.equal(storage.getItem('unrelated-setting'),'keep');assert.equal(storage.getItem(saveKeyFor('free')),'other-profile');
  assert.deepEqual(JSON.parse(storage.getItem(saveKeyFor('career'))!),fresh);
 });
 test('complete reset keeps existing saves when writing the fresh club fails',()=>{
  const storage=store(),before=initialState();resetTeam(before,'career',storage);const snapshot=[...storage.data];
  assert.throws(()=>completeResetTeam('career',{...storage,get length(){return storage.length;},setItem:()=>{throw new Error('quota');}}));
  assert.deepEqual([...storage.data],snapshot);
 });
}
