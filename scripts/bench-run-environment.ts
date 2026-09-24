import assert from 'node:assert/strict';
import {initialSandboxState,emptySeason,simulateDays} from '../src/pro/engine';
import type {Circuit} from '../src/pro/leagues';
export function measureEnvironment(circuit:Circuit,samples=5){
 const totals={games:0,runs:0,ab:0,hits:0,hr:0,bb:0,hbp:0,sf:0,doubles:0,triples:0,outs:0,er:0,so:0,pa:0};
 for(let i=0;i<samples;i++){
  const base=initialSandboxState(),s=simulateDays({...base,seed:17023+i*91991,season:emptySeason(1,circuit,base.club)},circuit==='NPB'?143:162).season;
  assert.equal(s.standings.reduce((n,r)=>n+r.rf-r.ra,0),0);
  const bats=Object.values(s.batting),pits=Object.values(s.pitching);
  assert.equal(bats.reduce((n,b)=>n+b.hits,0),pits.reduce((n,p)=>n+p.hits,0));
  assert.equal(bats.reduce((n,b)=>n+b.hr,0),pits.reduce((n,p)=>n+p.hr,0));
  assert.ok(bats.some(b=>b.sf>0));
  for(const b of bats){assert.equal(b.pa,b.ab+b.bb+b.hbp+b.sf);assert.ok(b.hits<=b.ab);}
  totals.games+=s.standings.reduce((n,r)=>n+r.w+r.l+r.d,0);totals.runs+=s.standings.reduce((n,r)=>n+r.rf,0);
  for(const b of Object.values(s.batting))for(const k of ['ab','hits','hr','bb','hbp','sf','doubles','triples','so','pa'] as const)totals[k]+=b[k];
  for(const p of Object.values(s.pitching)){totals.outs+=p.outs;totals.er+=p.er;}
 }
 const t=totals,obp=(t.hits+t.bb+t.hbp)/(t.ab+t.bb+t.hbp+t.sf),slg=(t.hits+t.doubles+2*t.triples+3*t.hr)/t.ab;
 return {circuit,samples,rpg:t.runs/t.games,avg:t.hits/t.ab,obp,slg,ops:obp+slg,hrPerTeamGame:t.hr/t.games,era:t.er*27/t.outs,kPct:t.so/t.pa};
}
export function registerRunEnvironmentTests(test:(name:string,run:()=>void)=>void){
 test('all leagues retain a modern MLB-like scoring environment and consistent sacrifice-fly accounting',()=>{
  for(const circuit of ['NPB','MLB','SPACE'] as const){
   const m=measureEnvironment(circuit);console.log('Run environment:',JSON.stringify(m));
   assert.ok(m.rpg>4.2&&m.rpg<4.7);assert.ok(m.avg>.235&&m.avg<.255);
   assert.ok(m.obp>.305&&m.obp<.325);assert.ok(m.ops>.695&&m.ops<.745);
   assert.ok(m.era>3.9&&m.era<4.4);assert.ok(m.hrPerTeamGame>1.05&&m.hrPerTeamGame<1.3);
  }
 });
}
