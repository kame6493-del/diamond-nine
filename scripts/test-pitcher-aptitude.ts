import assert from 'node:assert/strict';
import {findPlayer} from '../src/pro/data';
import {pitcherRolePenalty,pitcherSlotRole,pitchingRatingsForRole} from '../src/pro/pitcher-aptitude';
import {matchupProbabilities} from '../src/pro/matchup';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialSandboxState} from '../src/pro/engine';
import {DeckTeam} from '../src/pro/CardDeck';

export function registerPitcherAptitudeTests(test:(name:string,run:()=>void)=>void){
 test('team screen explains role penalties without modifying card data',()=>{
  const state=initialSandboxState(),p=findPlayer('才木浩人'),before=JSON.stringify(p);
  const pitchers=state.pitchers.filter(id=>id!==p.id);pitchers.splice(11,0,p.id);
  const html=renderToStaticMarkup(createElement(DeckTeam,{state:{...state,pitchers:pitchers.slice(0,12),owned:{...state.owned,[p.id]:1}},onChange:()=>{},onPlayer:()=>{},onImpact:()=>{},onReset:()=>{},onRestore:()=>{},onCompleteReset:()=>{},canRestore:false}));
  assert.ok(html.includes('投手の役割適性不足'));assert.ok(html.includes('能力欄は起用時の補正後'));
  assert.equal(JSON.stringify(p),before);
 });
 test('pitching role grades preserve suitable abilities and penalize unfamiliar roles without mutating cards',()=>{
  const base=findPlayer('才木浩人');
  const p={...base,wikiAssessment:{...base.wikiAssessment!,pitcherRoles:{先:'◎',中:'△',抑:'－'}}};
  assert.equal(pitcherSlotRole(0),'先');assert.equal(pitcherSlotRole(5),'先');assert.equal(pitcherSlotRole(6),'中');assert.equal(pitcherSlotRole(10),'中');assert.equal(pitcherSlotRole(11),'抑');
  assert.equal(pitcherRolePenalty(p,'先'),0);assert.equal(pitcherRolePenalty(p,'中'),5);assert.equal(pitcherRolePenalty(p,'抑'),12);
  const before={...p.ratings};
  assert.deepEqual(pitchingRatingsForRole(p,p.ratings,'先'),before);
  const adjusted=pitchingRatingsForRole(p,p.ratings,'抑');
  assert.equal(adjusted.control,before.control-12);assert.equal(adjusted.breaking,before.breaking-12);assert.equal(adjusted.velocity,before.velocity);assert.deepEqual(p.ratings,before);
  const relief={...p,wikiAssessment:{...p.wikiAssessment,pitcherRoles:{中:'◎',抑:'○'}}};
  assert.equal(pitcherRolePenalty(relief,'抑'),0);
  assert.equal(pitchingRatingsForRole(relief,relief.ratings,'先').stamina,Math.max(0,before.stamina-24));
 });
 test('role mismatch changes actual plate appearance odds in both leagues',()=>{
  const base=findPlayer('才木浩人'),batter=findPlayer('牧秀悟');
  const p={...base,wikiAssessment:{...base.wikiAssessment!,pitcherRoles:{先:'◎',中:'△',抑:'－'}}};
  for(const league of ['NPB','MLB'] as const){
   const rates=(role:'先'|'中'|'抑')=>matchupProbabilities(batter,p,0,0,0,{},0,0,league,role);
   const fit=rates('先'),partial=rates('中'),bad=rates('抑');
   assert.ok(bad.walk>partial.walk&&partial.walk>fit.walk);
   assert.ok(bad.strikeout<partial.strikeout&&partial.strikeout<fit.strikeout);
   assert.ok(bad.homeRun>fit.homeRun);assert.ok(bad.babip>fit.babip);
  }
 });
 test('missing role data falls back to workload and save experience',()=>{
  const base=findPlayer('才木浩人');
  const starter={...base,wikiAssessment:undefined,pitching:{...base.pitching!,games:20,outs:360,saves:0}};
  assert.equal(pitcherRolePenalty(starter,'先'),0);assert.equal(pitcherRolePenalty(starter,'抑'),12);
  const relief={...starter,pitching:{...starter.pitching,games:40,outs:120,saves:10}};
  assert.equal(pitcherRolePenalty(relief,'先'),12);assert.equal(pitcherRolePenalty(relief,'中'),0);assert.equal(pitcherRolePenalty(relief,'抑'),0);
 });
}
