import assert from 'node:assert/strict';
import {initialState,initialSandboxState,migrateState,validState,simulateDays} from '../src/pro/engine';
import {autoPitchers,players,playerMap} from '../src/pro/data';
import {buildByStrategy} from '../src/pro/franchise';
import {pitcherRolePenalty,pitcherSlotRole} from '../src/pro/pitcher-aptitude';

export function registerBullpenTests(test:(name:string,run:()=>void)=>void){
 test('14-arm staffs and automatic formations have six starters and eight suitable relievers',()=>{
  for(let seed=1;seed<=100;seed++){
   const state=initialState(seed),auto=buildByStrategy(state,'balanced');
   for(const s of [state,auto]){assert.ok(validState(s));assert.equal(s.pitchers.length,14);assert.equal(new Set(s.pitchers).size,14);assert.ok(s.pitchers.every((id,i)=>pitcherRolePenalty(playerMap[id],pitcherSlotRole(i))===0));}
  }
  assert.deepEqual(autoPitchers(players.filter(p=>pitcherRolePenalty(p,'先')===0&&pitcherRolePenalty(p,'中')>0&&pitcherRolePenalty(p,'抑')>0),true),[]);
  const s=initialState(22),onlyStarters={...s,owned:Object.fromEntries(Object.keys(s.owned).filter(id=>playerMap[id].role!=='pitcher'||pitcherRolePenalty(playerMap[id],'先')===0).map(id=>[id,1]))};
  assert.equal(buildByStrategy(onlyStarters,'balanced'),onlyStarters);
 });
 test('automatic formation puts the strongest in-role arms in the rotation, ace first',()=>{
  for(let seed=1;seed<=60;seed++){
   const auto=buildByStrategy(initialState(seed),'balanced'),ids=auto.pitchers,ovr=(id:string)=>playerMap[id].overall,fit=(id:string,i:number)=>pitcherRolePenalty(playerMap[id],pitcherSlotRole(i))===0;
   const starters=ids.slice(0,6);
   for(const r of ids.slice(6,13))for(const st of starters)assert.ok(!(ovr(r)>ovr(st)&&fit(r,starters.indexOf(st))&&fit(st,ids.indexOf(r))),`seed ${seed}: reliever ${r} (${ovr(r)}) outranks starter ${st} (${ovr(st)})`);
   const ace=Object.keys(auto.owned).map(id=>playerMap[id]).filter(p=>p.role==='pitcher'&&fit(p.id,0)).sort((a,b)=>b.overall-a.overall)[0];
   assert.equal(ovr(ids[0]),ace.overall,`seed ${seed}: opening starter is not the best starter`);
  }
 });
 test('legacy staff expansion retains the closer, season and points and is idempotent',()=>{
  const s=initialState(54),old={...s,pitchers:[...s.pitchers.slice(0,11),s.pitchers[13]]};
  for(const id of s.pitchers.slice(11,13))delete old.owned[id];
  const frozen=JSON.stringify(old),next=migrateState(old)!;assert.ok(next&&validState(next));
  assert.equal(next.pitchers.length,14);assert.deepEqual(next.pitchers.slice(0,11),old.pitchers.slice(0,11));assert.equal(next.pitchers[13],old.pitchers[11]);
  assert.deepEqual(next.season,old.season);assert.equal(next.gems,old.gems);assert.equal(JSON.stringify(old),frozen);assert.deepEqual(migrateState(next),next);
 });
 test('all eight bullpen arms appear over a season with conserved pitching totals',()=>{
  const start=initialSandboxState(),end=simulateDays({...start,seed:87731},143);assert.ok(validState(end));
  const rows=start.pitchers.slice(6).map(id=>end.season.pitching[`${start.club}|${id}`]);
  assert.ok(rows.every(r=>r&&r.games>0&&r.starts===0));assert.ok(rows.every(r=>r.games<100));
  const b=Object.values(end.season.batting),p=Object.values(end.season.pitching);
  assert.equal(b.reduce((n,x)=>n+x.so,0),p.reduce((n,x)=>n+x.so,0));
  console.log('Eight-reliever appearances:',rows.map(r=>r.games));
 });
}
