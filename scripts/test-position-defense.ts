import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {clamp,findPlayer,fitsPosition,playerMap,type Player} from '../src/pro/data';
import {initialSandboxState,defenseAdjustment,fieldingErrorRate,emptySeason,simulateDays,migrateState,validState} from '../src/pro/engine';
import {ownedRatings} from '../src/pro/development';
import {wikiPositionPenalty} from '../src/pro/wiki-players';
import {defenseAtPosition,positionDefensePenalty} from '../src/pro/position-defense';
import {extraBaseChance,matchupProbabilities,stealProbabilities} from '../src/pro/matchup';
import {swapDefense} from '../src/pro/simple-game';
import {DeckTeam} from '../src/pro/CardDeck';

export function registerPositionDefenseTests(test:(name:string,run:()=>void)=>void){
 test('listed defensive positions retain their previous performance and all unfamiliar positions are harder than weak secondary positions',()=>{
  const p=findPlayer('牧秀悟');
  for(const position of ['二','一']){
   const result=defenseAtPosition(p,position);
   assert.equal(result.skill,p.ratings.field*.85+p.ratings.catching*.15-wikiPositionPenalty(p,position));
   assert.equal(result.arm,p.ratings.arm);
  }
  const specialist={...p,positions:['一'],wikiAssessment:undefined};
  for(const position of ['捕','二','三','遊','外'])assert.ok(positionDefensePenalty(specialist,position)>36);
  assert.ok(positionDefensePenalty(specialist,'捕')>positionDefensePenalty(specialist,'遊'));
  assert.ok(positionDefensePenalty(specialist,'遊')>positionDefensePenalty(specialist,'外'));
  assert.equal(positionDefensePenalty(specialist,'DH'),0);
  const s=initialSandboxState();
  for(const adjustment of [0,-4,-2]){
   const fielders=s.lineup.filter(id=>s.defense[id]!=='DH');
   assert.ok(fielders.every(id=>fitsPosition(playerMap[id],s.defense[id])));
   const old=fielders.map(id=>{const p=playerMap[id],r=ownedRatings(p,s.owned,s.training);return clamp(r.field+adjustment,0,99)*.85+clamp(r.catching+adjustment,0,99)*.15-wikiPositionPenalty(p,s.defense[id]);});
   assert.equal(defenseAdjustment(s.lineup,s.defense,s.owned,s.training,adjustment),(old.reduce((a,b)=>a+b,0)/old.length-60)*.0012);
  }
 });
 test('unfamiliar defense increases hits and errors without changing walks, strikeouts or home runs; DH is excluded',()=>{
  const p=findPlayer('源田壮亮'),batter=findPlayer('牧秀悟'),pitcher=findPlayer('才木浩人');
  const native=defenseAdjustment([p.id],{[p.id]:'遊'}),unfit=defenseAdjustment([p.id],{[p.id]:'捕'});
  assert.ok(unfit<native);assert.ok(fieldingErrorRate(unfit)>fieldingErrorRate(native));
  for(const league of ['NPB','MLB'] as const){
   const a=matchupProbabilities(batter,pitcher,0,0,native,{},0,0,league),b=matchupProbabilities(batter,pitcher,0,0,unfit,{},0,0,league);
   assert.ok(b.hit>a.hit);assert.ok(b.babip>a.babip);
   for(const key of ['walk','hbp','strikeout','homeRun'] as const)assert.equal(a[key],b[key]);
  }
  assert.equal(defenseAdjustment([p.id,batter.id],{[p.id]:'遊',[batter.id]:'DH'}),native);
 });
 test('untrained catchers allow more steals and untrained outfielders allow more advancement, including awakened cards',()=>{
  const source=findPlayer('牧秀悟'),runner=findPlayer('周東佑京'),native={...source,positions:['捕','外'],wikiAssessment:undefined},unfit={...native,positions:['一']};
  const before=JSON.stringify(source);
  for(const level of [0,5]){
   const ratings=ownedRatings(source,{[source.id]:6},{[source.id]:level});
   const a=defenseAtPosition(native,'捕',ratings),b=defenseAtPosition(unfit,'捕',ratings);
   assert.ok(b.field<a.field);assert.ok(b.arm<a.arm);
   const normal=stealProbabilities(runner,0,a.arm,a.field),misplaced=stealProbabilities(runner,0,b.arm,b.field);
   assert.ok(misplaced.success>normal.success);assert.equal(misplaced.attempt,normal.attempt);
   assert.ok(extraBaseChance(runner,0,defenseAtPosition(unfit,'外',ratings).arm)>extraBaseChance(runner,0,defenseAtPosition(native,'外',ratings).arm));
  }
  assert.equal(JSON.stringify(source),before);
 });
 test('defense swaps preserve saves and card abilities while the warning appears only for misplaced fielders',()=>{
  const start=initialSandboxState(),before=JSON.stringify(start),catcher=start.lineup.find(id=>start.defense[id]==='捕')!;
  const outfielder=start.lineup.find(id=>start.defense[id]==='外'&&!fitsPosition(playerMap[id],'捕'))!;
  const changed=swapDefense(start,catcher,outfielder),misplaced=changed.lineup.filter(id=>!fitsPosition(playerMap[id],changed.defense[id]));
  const render=(state:typeof start)=>renderToStaticMarkup(createElement(DeckTeam,{state,onChange:()=>{},onPlayer:()=>{},onImpact:()=>{}}));
  assert.ok(!render(start).includes('deck-defense-warning'));
  const html=render(changed);assert.ok(html.includes('守備適性外 '+misplaced.length+'人'));assert.ok(html.includes('捕手の適性外は盗塁も許しやすくなります。'));
  assert.ok(!html.includes('UZR'));assert.ok(validState(changed));assert.deepEqual(migrateState(JSON.parse(JSON.stringify(changed))),changed);
  assert.deepEqual(swapDefense(changed,catcher,outfielder),start);assert.equal(JSON.stringify(start),before);
  assert.deepEqual(changed.owned,start.owned);assert.deepEqual(changed.training,start.training);
 });
 test('paired complete seasons concede more runs, hits and errors after swapping two defensive specialists',()=>{
  const source=initialSandboxState(),state=structuredClone(source);
  // Unique test identities isolate the user's defense from CPU copies of a card.
  const clones=source.lineup.map((id,index):Player=>({...structuredClone(playerMap[id]),id:'position-test-'+index,positions:[source.defense[id]],wikiAssessment:undefined,ratings:{...playerMap[id].ratings,field:65,catching:65,arm:65}}));
  state.lineup=clones.map(p=>p.id);state.defense=Object.fromEntries(clones.map((p,i)=>[p.id,source.defense[source.lineup[i]]]));
  state.owned=Object.fromEntries([...state.lineup,...state.pitchers].map(id=>[id,1]));state.training={};
  const catcher=state.lineup.find(id=>state.defense[id]==='捕')!,outfielder=state.lineup.find(id=>state.defense[id]==='外')!;
  const changed=swapDefense(state,catcher,outfielder),totals=[];
  try{
   for(const p of clones)playerMap[p.id]=p;
   for(const setup of [state,changed]){
    const totalsForSetup={runs:0,hits:0,errors:0};
    for(const seed of [70123,180019,452831,811753]){
     const end=simulateDays({...setup,seed,season:emptySeason()},143);
     totalsForSetup.runs+=end.season.standings.find(t=>t.team===state.club)!.ra;
     totalsForSetup.hits+=Object.values(end.season.pitching).filter(p=>p.team===state.club).reduce((sum,p)=>sum+p.hits,0);
     totalsForSetup.errors+=end.season.results.reduce((sum,g)=>sum+(g.errors?.[g.home===state.club?1:0]??0),0);
    }
    totals.push(totalsForSetup);
   }
   console.log('POSITION DEFENSE season comparison (4 seasons each):',JSON.stringify({natural:totals[0],misplaced:totals[1]}));
   assert.ok(totals[1].runs>totals[0].runs*1.025,'position mistakes should meaningfully raise runs allowed');
   assert.ok(totals[1].hits>totals[0].hits,'position mistakes should allow more hits');
   assert.ok(totals[1].errors>totals[0].errors,'position mistakes should create more fielding errors');
  }finally{for(const p of clones)delete playerMap[p.id];}
 });
}
