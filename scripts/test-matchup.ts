import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { findPlayer,players,formatAvg,type Player,type BattingRecord } from '../src/pro/data';
import { initialState,simulateDays,ops,type BatStats } from '../src/pro/engine';
import { gameRatings,matchupProbabilities,extraBaseChance,stealProbabilities } from '../src/pro/matchup';
import { bestUpgrade,equipScoutedPlayer } from '../src/pro/career-roster';
import { assessBatting,assessPitching } from '../src/pro/wiki-assessment';
import { battingTotals,SeasonBattingReport } from '../src/pro/SeasonBattingReport';

const change=(p:Player,key:keyof Player['ratings'],amount:number):Player=>({...p,ratings:{...p.ratings,[key]:p.ratings[key]+amount}});
export function registerMatchupTests(test:(name:string,run:()=>void)=>void){
 test('each batting and pitching ability affects its corresponding simulated event',()=>{
  const bat=findPlayer('牧秀悟'),pitch=findPlayer('才木浩人'),base=matchupProbabilities(bat,pitch);
  const contact=matchupProbabilities(change(bat,'contact',10),pitch);assert.ok(contact.hit>base.hit);assert.ok(contact.strikeout<base.strikeout);assert.equal(contact.homeRun,base.homeRun);
  const power=matchupProbabilities(change(bat,'power',10),pitch);assert.ok(power.homeRun>base.homeRun);assert.ok(power.double>base.double);assert.equal(power.strikeout,base.strikeout);
  const fast=matchupProbabilities(bat,change(pitch,'velocity',5)),breaking=matchupProbabilities(bat,change(pitch,'breaking',10));assert.ok(fast.strikeout>base.strikeout);assert.ok(breaking.strikeout>base.strikeout);assert.ok(breaking.homeRun<base.homeRun);
  const control=matchupProbabilities(bat,change(pitch,'control',10));assert.ok(control.walk<base.walk);assert.ok(control.hbp<base.hbp);
  assert.ok(matchupProbabilities(bat,pitch,0,0,.015).hit<base.hit);assert.ok(matchupProbabilities(bat,pitch,5).homeRun>base.homeRun);assert.ok(matchupProbabilities(bat,pitch,0,5).walk<base.walk);
 });
 test('running and throwing abilities affect advancement and stolen bases without changing real records',()=>{
  const runner=findPlayer('周東佑京'),record=JSON.stringify(runner.batting);
  assert.ok(extraBaseChance(runner,5,60)>extraBaseChance(runner,0,60));assert.ok(extraBaseChance(runner,0,80)<extraBaseChance(runner,0,60));
  const base=stealProbabilities(runner,0,66,60),trained=stealProbabilities(runner,5,66,60),catcher=stealProbabilities(runner,0,80,80);assert.ok(trained.attempt>=base.attempt);assert.ok(trained.success>base.success);assert.ok(catcher.success<base.success);
  assert.equal(JSON.stringify(runner.batting),record);
  const cap=gameRatings(change(runner,'contact',99),20);assert.equal(cap.contact,99);assert.equal(cap.velocity,runner.ratings.velocity);
 });
 test('event probabilities remain a valid distribution across the entire player pool',()=>{
  const bats=players.filter(p=>p.role==='batter'),arms=players.filter(p=>p.role==='pitcher');
  for(let i=0;i<bats.length;i++)for(const bonus of [-3,0,10]){
   const r=matchupProbabilities(bats[i],arms[i%arms.length],bonus,-bonus,bonus*.002);
   assert.ok(Object.values(r).every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.ok(r.walk+r.hbp<1);assert.ok(r.hit+r.strikeout<=1);assert.ok(r.homeRun+r.double+r.triple<=r.hit+1e-12);
  }
 });
 test('wiki-informed assessment distinguishes sample size, home-run production and pitcher workload',()=>{
  const source=findPlayer('牧秀悟').batting!;
  const regular={...source,pa:600,ab:550,hits:165,hr:30,tb:285,avg:.300} as BattingRecord;
  const brief={...regular,pa:30,ab:25,hits:8,hr:1,tb:12};
  assert.ok(assessBatting(regular,.250,135).contact>assessBatting(brief,.250,135).contact);assert.ok(assessBatting(brief,.250,135).contact<=40);
  assert.ok(assessBatting(regular,.250,135).power>assessBatting({...regular,hr:5,tb:205},.250,135).power);
  assert.equal(assessBatting(undefined,.250,135).contact,30);
  const q=findPlayer('才木浩人').pitching!,clean=assessPitching(q),wild=assessPitching({...q,wp:q.wp+40,hbp:q.hbp+20});assert.ok(wild.control<clean.control);
  assert.ok(assessPitching({...q,games:25,outs:450}).stamina>assessPitching({...q,games:60,outs:180}).stamina);
 });
 test('a scouted player accumulates stats only after being put in the order',()=>{
  const s=initialState();s.seed=2468;const first=simulateDays(s,5),id=findPlayer('佐藤輝明').id;
  const owned={...first,owned:{...first.owned,[id]:1}},upgrade=bestUpgrade(owned,id)!;assert.ok(upgrade&&!upgrade.pitching);
  const next=simulateDays(equipScoutedPlayer(owned,id),5);
  assert.equal(first.season.batting[`${s.club}|${id}`],undefined);assert.equal(next.season.batting[`${s.club}|${id}`].games,5);assert.equal(next.season.batting[`${s.club}|${upgrade.oldId}`].games,5);assert.ok(next.season.batting[`${s.club}|${id}`].pa>0);
 });
 test('season report shows batting average, HR, RBI and OPS calculated from actual simulated records',()=>{
  const row=(values:Partial<BatStats>):BatStats=>({playerId:findPlayer('佐藤輝明').id,team:'t',games:1,pa:0,ab:0,hits:0,doubles:0,triples:0,hr:0,rbi:0,runs:0,bb:0,so:0,sb:0,hbp:0,sf:0,...values});
  const a=row({pa:6,ab:4,hits:2,hr:1,rbi:3,bb:1,hbp:1}),b=row({pa:12,ab:10,hits:1,doubles:1,bb:1,sf:1});
  const total=battingTotals([a,b]);assert.equal(total.hr,1);assert.equal(total.rbi,3);assert.equal(total.avg,3/14);assert.equal(total.ops,6/18+7/14);assert.equal(ops(a),4/6+5/4);
  const start=initialState();start.seed=1234;const s=simulateDays(start,143),bat=Object.values(s.season.batting).filter(b=>b.team===s.club),summary=battingTotals(bat);
  assert.equal(summary.rbi,bat.reduce((n,b)=>n+b.rbi,0));assert.ok(summary.rbi<=s.season.standings.find(t=>t.team===s.club)!.rf);
  const html=renderToStaticMarkup(createElement(SeasonBattingReport,{state:s,onPlayer:()=>{}}));for(const label of ['打率','本塁打','打点','OPS'])assert.ok(html.includes(label));assert.ok(html.includes(formatAvg(summary.ops)));assert.equal((html.match(/<tbody>/g)||[]).length,1);assert.ok(!html.includes('UZR'));
 });
}
