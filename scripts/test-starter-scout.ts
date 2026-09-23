import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,migrateState,validState} from '../src/pro/engine';
import {playerMap,fitsPosition} from '../src/pro/data';
import {ratingOverall} from '../src/pro/development';
import {createStarterScout,pickStarterCard,finishStarterScout,starterScoutActive,starterScoutPool} from '../src/pro/starter-scout';
import {StarterScout} from '../src/pro/StarterScout';
import {equipScoutedPlayer} from '../src/pro/career-roster';
import {completeResetTeam,resetTeam,restoreResetBackup} from '../src/pro/reset-team';

export function registerStarterScoutTests(test:(name:string,run:()=>void)=>void){
 test('new clubs offer three distinct strong NPB cards without changing the weak initial roster',()=>{
  assert.ok(starterScoutPool.length>=3);
  for(let seed=1;seed<=100;seed++){
   const offer=createStarterScout(seed);assert.deepEqual(offer,createStarterScout(seed));assert.equal(new Set(offer.choices).size,3);
   for(const id of offer.choices){assert.ok(!playerMap[id].mlb);assert.ok(ratingOverall(playerMap[id])>=85);}
  }
  const state=initialState();assert.ok(validState(state));assert.ok(starterScoutActive(state));assert.equal(Object.keys(state.owned).length,24);assert.equal(state.gems,0);
  assert.ok(state.starterScout!.choices.every(id=>!state.owned[id]));
 });
 test('starter picks grant exactly one card once without spending points or advancing paid guarantees',()=>{
  const state=initialState(),snapshot=JSON.stringify(state);
  for(let i=0;i<3;i++){
   const next=pickStarterCard(state,i),id=state.starterScout!.choices[i];
   assert.ok(validState(next));assert.equal(next.starterScout!.selected,id);assert.equal(Object.keys(next.owned).length,25);assert.equal(next.owned[id],1);
   assert.equal(next.gems,state.gems);assert.equal(next.pulls,state.pulls);assert.equal(next.seed,state.seed);assert.deepEqual(next.lastPulls,state.lastPulls);assert.deepEqual(next.training,state.training);assert.deepEqual(next.franchise,state.franchise);
   for(let j=0;j<3;j++)assert.equal(pickStarterCard(next,j),next);
   const reloaded=migrateState(JSON.parse(JSON.stringify(next)))!;assert.deepEqual(reloaded.starterScout,next.starterScout);assert.equal(pickStarterCard(reloaded,i),reloaded);
  }
  for(const invalid of [-1,3,.5,NaN,Infinity])assert.equal(pickStarterCard(state,invalid),state);
  assert.equal(finishStarterScout(state),state);assert.equal(JSON.stringify(state),snapshot);
 });
 test('starter completion equips the earned player, persists and never returns after opening day',()=>{
  for(const player of starterScoutPool){
   const state=initialState();state.starterScout!.choices=[player.id,...starterScoutPool.filter(p=>p.id!==player.id).slice(0,2).map(p=>p.id)];
   const selected=pickStarterCard(state,0),done=equipScoutedPlayer(finishStarterScout(selected),player.id);
   assert.ok(validState(done));assert.ok(!starterScoutActive(done));assert.ok([...done.lineup,...done.pitchers].includes(player.id));
   if(player.role==='batter')assert.ok(fitsPosition(player,done.defense[player.id]));
   assert.equal(done.gems,0);assert.equal(done.pulls,0);assert.equal(Object.keys(done.owned).length,25);
   assert.equal(finishStarterScout(done),done);assert.equal(pickStarterCard(done,1),done);
   const saved=migrateState(JSON.parse(JSON.stringify(done)))!;assert.ok(!starterScoutActive(saved));assert.deepEqual(saved.owned,done.owned);
  }
 });
 test('legacy saves stay untouched and malformed starter rewards cannot load',()=>{
  const old=initialState();delete old.starterScout;const snapshot=JSON.stringify(old);
  const saved=migrateState(JSON.parse(snapshot))!;assert.equal(saved.starterScout,undefined);assert.ok(!starterScoutActive(saved));assert.equal(pickStarterCard(saved,0),saved);assert.deepEqual(saved.owned,old.owned);
  const state=initialState(),offer=state.starterScout!;
  for(const starterScout of [null,{...offer,choices:offer.choices.slice(1)},{...offer,choices:[offer.choices[0],offer.choices[0],offer.choices[2]]},{...offer,completed:true},{...offer,selected:offer.choices[0]},{...offer,choices:[state.lineup[0],...offer.choices.slice(1)]}])assert.equal(migrateState({...state,starterScout}),null);
 });
 test('reset creates a fresh welcome event and restore keeps its already-claimed reward',()=>{
  const data=new Map<string,string>();const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);},key:(i:number)=>[...data.keys()][i]??null,get length(){return data.size;}};
  const done=finishStarterScout(pickStarterCard(initialState(),1));
  const fresh=resetTeam(done,'career',storage);assert.ok(starterScoutActive(fresh));assert.equal(fresh.starterScout!.selected,null);assert.equal(Object.keys(fresh.owned).length,24);
  const restored=restoreResetBackup(fresh,'career',storage);assert.ok(!starterScoutActive(restored));assert.deepEqual(restored.owned,done.owned);
  const complete=completeResetTeam('career',storage);assert.ok(starterScoutActive(complete));assert.equal(complete.gems,0);assert.equal(Object.keys(complete.owned).length,24);
 });
 test('starter screen has exactly three accessible blind choices and reveals only the earned card',()=>{
  const state=initialState(),props={sound:false,onPick:()=>true,onFinish:()=>{},onPlayer:()=>{}};
  const html=renderToStaticMarkup(createElement(StarterScout,{...props,state}));
  assert.equal([...html.matchAll(/枚目のカードを選ぶ/g)].length,3);assert.ok(html.includes('スタートスカウト'));assert.ok(html.includes('総合 85 以上'));
  for(const id of state.starterScout!.choices)assert.ok(!html.includes(playerMap[id].name));
  const picked=pickStarterCard(state,1),result=renderToStaticMarkup(createElement(StarterScout,{...props,state:picked}));
  assert.ok(result.includes(playerMap[picked.starterScout!.selected!].name));assert.ok(result.includes('チームに入れて開幕する'));assert.ok(!result.includes('枚目のカードを選ぶ'));
  assert.ok(!result.includes('<canvas'));assert.ok(!result.includes('>SSR<'));
 });
}
