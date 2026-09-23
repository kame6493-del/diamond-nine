import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { findPlayer,players,playerMap,grade,autoPitchers,type Player,type Ratings } from '../src/pro/data';
import { wikiInfo,wikiPlayerMap,wikiBreaking,wikiPositionPenalty,velocityLabel } from '../src/pro/wiki-players';
import { wikiMatchEffects,traitDescriptions } from '../src/pro/wiki-traits';
import { matchupProbabilities } from '../src/pro/matchup';
import { WikiAssessmentDetail,WikiSourcesPanel } from '../src/pro/WikiAssessment';
export function registerWikiTests(test:(name:string,run:()=>void)=>void){
 test('all twelve 2026 Wiki pages are represented, with 809 unique matched players and explicit exclusions',()=>{
  const counts={t:69,s:68,b:66,db:72,d:74,g:81,e:58,l:61,m:61,h:65,c:68,f:66};
  assert.equal(wikiInfo.sources.length,12);assert.equal(wikiPlayerMap.size,809);assert.equal(wikiInfo.unmatched.length,0);assert.equal(wikiInfo.excluded.length,11);
  for(const [team,count] of Object.entries(counts)){assert.equal(players.filter(p=>p.team===team&&p.wikiAssessment).length,count);assert.ok(wikiInfo.sources.find(s=>s.team===team)?.title.startsWith('2026(新)'));}
  for(const e of wikiPlayerMap.values()){const p=playerMap[e.id];assert.ok(p.active);assert.equal(p.roster!.number,e.sourceNumber);assert.equal(p.team,e.team);assert.ok(e.sourceUrl.startsWith(wikiInfo.sources.find(s=>s.team===e.team)!.url+'#'));for(const [key,value] of Object.entries(e.ratings))if(key!=='trajectory')assert.equal(p.ratings[key as keyof Ratings],value,p.id+' '+key);}
 });
 test('cross-team spot checks reproduce the published six abilities, including non-rounded values',()=>{
  const examples:[string,number[]][]=[['佐藤輝明',[75,80,65,70,50,40]],['増田珠',[60,60,60,65,60,50]],['西川龍馬',[65,60,65,55,45,65]],['牧秀悟',[65,80,55,70,60,45]],['サノー',[40,80,25,70,50,60]],['ダルベック',[50,75,55,70,40,40]],['マッカスカー',[50,80,65,65,50,50]],['ネビン',[65,80,40,75,60,60]],['山口航輝',[55,88,50,65,40,40]],['近藤健介',[78,80,55,70,70,60]],['ファビアン',[40,75,55,75,50,55]],['レイエス',[83,80,40,55,35,35]]];
  for(const [name,values] of examples){const r=findPlayer(name).ratings;assert.deepEqual([r.contact,r.power,r.speed,r.arm,r.field,r.catching],values,name);}
  assert.deepEqual([19,20,39,40,50,60,70,80,90].map(grade),['G','F','F','E','D','C','B','A','S']);
 });
 test('unlisted players and missing fields retain evidence-based fallback, never borrowed identities',()=>{
  const unlisted=players.filter(p=>!p.wikiAssessment&&!p.mlb);assert.equal(unlisted.length,258);for(const p of unlisted)assert.deepEqual(p.ratings,p.simulationBaseline);
  assert.equal(findPlayer('菊地吏玖').wikiAssessment?.sourceNumber,'28');assert.equal(findPlayer('スチュワート・ジュニア').wikiAssessment?.sourceNumber,'2');
  assert.ok(!findPlayer('ビド').wikiAssessment?.sourceName.includes('コックス'));
  const f=findPlayer('福敬登');assert.equal(f.wikiAssessment?.ratings.catching,undefined);assert.equal(f.ratings.catching,f.simulationBaseline?.catching);
  assert.equal(findPlayer('大山悠輔').uzr,-7.1);assert.equal(findPlayer('大山悠輔').ratings.field,50);
 });
 test('Wiki ability overrides change simulated probabilities rather than resetting their anchor',()=>{
  const pitcher=findPlayer('才木浩人');let changed=0;
  for(const p of players.filter(p=>p.role==='batter'&&p.wikiAssessment)){
   const plain={...p,wikiAssessment:undefined},old={...plain,ratings:{...p.simulationBaseline!}};
   const after=matchupProbabilities(plain,pitcher),before=matchupProbabilities(old,pitcher),delta=p.ratings.power-old.ratings.power;
   if(delta>0)assert.ok(after.homeRun>=before.homeRun);if(delta<0)assert.ok(after.homeRun<=before.homeRun);if(after.homeRun!==before.homeRun)changed++;
  }assert.ok(changed>250);
 });
 test('pitch repertoire, secondary positions and contextual traits have bounded gameplay effects',()=>{
  const p=findPlayer('才木浩人');assert.deepEqual(p.wikiAssessment!.pitches,[{name:'スライダー',level:2},{name:'スローカーブ',level:1},{name:'フォーク',level:5}]);assert.equal(p.ratings.breaking,wikiBreaking(p.wikiAssessment!.pitches));
  assert.ok(wikiBreaking([{name:'フォーク',level:6}])>wikiBreaking([{name:'フォーク',level:3}]));
  const bat=findPlayer('牧秀悟');assert.equal(wikiPositionPenalty(bat,'二'),0);assert.equal(wikiPositionPenalty(bat,'一'),12);
  const controlled={...bat,wikiAssessment:{...bat.wikiAssessment!,traits:['チャンスB','対左投手B']}} as Player;
  const right={...p,throws:'右',wikiAssessment:{...p.wikiAssessment!,traits:[]}} as Player,left={...right,throws:'左'} as Player;
  assert.equal(wikiMatchEffects(controlled,right).contact,0);assert.equal(wikiMatchEffects(controlled,left).contact,4);assert.equal(wikiMatchEffects(controlled,left,{scoringPosition:true}).contact,8);
  const normal=matchupProbabilities(controlled,right),clutch=matchupProbabilities(controlled,right,0,0,0,{scoringPosition:true});assert.ok(clutch.hit>normal.hit);assert.ok(clutch.homeRun>normal.homeRun);
  const low={...controlled,wikiAssessment:{...controlled.wikiAssessment!,ratings:{...controlled.wikiAssessment!.ratings,trajectory:1}}},high={...controlled,wikiAssessment:{...controlled.wikiAssessment!,ratings:{...controlled.wikiAssessment!.ratings,trajectory:4}}};assert.ok(matchupProbabilities(high,right).homeRun>matchupProbabilities(low,right).homeRun);
  const pitchers=autoPitchers(players.filter(p=>p.team==='t'));assert.ok(pitchers.slice(0,6).every(id=>playerMap[id].wikiAssessment?.pitcherRoles['先']==='◎'));assert.equal(playerMap[pitchers[11]].wikiAssessment?.pitcherRoles['抑'],'◎');
 });
 test('source and ability detail show all-team coverage, pitch levels and supported versus reference traits',()=>{
  const p=findPlayer('才木浩人');assert.equal(velocityLabel(p),'球速');
  const html=renderToStaticMarkup(createElement(WikiAssessmentDetail,{player:p}));assert.ok(html.includes('フォーク'));assert.ok(html.includes('変化量 5 / 7'));assert.ok(html.includes('試合に反映'));assert.ok(html.includes('その他の掲載特性'));assert.ok(html.includes(p.wikiAssessment!.sourceUrl));assert.ok(html.includes(traitDescriptions['奪三振']));assert.ok(!html.includes('UZR'));
  assert.ok(html.includes('慎重盗塁'));assert.ok(!html.includes(traitDescriptions['慎重盗塁']));
  const overview=renderToStaticMarkup(createElement(WikiSourcesPanel));assert.ok(overview.includes('809'));assert.ok(overview.includes('258'));for(const s of wikiInfo.sources)assert.ok(overview.includes(s.url));
 });
}
