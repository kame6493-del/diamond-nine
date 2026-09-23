import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {players,playerMap,findPlayer,type Player} from '../src/pro/data';
import {mlbOpponentPlayers} from '../src/pro/mlb-opponents';
import {growthEvidence,evidenceFor,draftExpectation,performanceExpectation,type GrowthEvidence} from '../src/pro/growth-evidence';
import {developedRatings,growthProfile,playerAge,ratingOverall} from '../src/pro/development';
import {initialState,migrateState,simulateDays} from '../src/pro/engine';
import {PlayerDetails} from '../src/pro/PlayerDetails';
import {DeckTeam} from '../src/pro/CardDeck';

export function registerGrowthTests(test:(name:string,run:()=>void)=>void){
 test('official growth evidence covers every collectible and MLB opponent, including verified draft types',()=>{
  assert.equal(players.length,1082);
  for(const p of [...players,...mlbOpponentPlayers]){const e=evidenceFor(p);assert.ok(e,p.id);assert.ok(playerAge(p)!==null);assert.ok(e.source.startsWith('https://npb.jp/')||e.source.startsWith('https://statsapi.mlb.com/'));for(const record of [e.farmPitching,...e.pitching])if(record){assert.ok(Number.isInteger(record.outs));assert.ok(record.outs>=0&&record.outs<=1100);}}
  assert.equal(evidenceFor(findPlayer('立石正広'))!.draft.rank,1);assert.equal(evidenceFor(findPlayer('立石正広'))!.draft.year,2025);
  assert.equal(evidenceFor(findPlayer('周東佑京'))!.draft.type,'developmental');assert.equal(evidenceFor(findPlayer('山本由伸'))!.draft.rank,4);
  assert.equal(evidenceFor(findPlayer('西田陸浮'))!.draft.pick,329);assert.equal(evidenceFor(findPlayer('西田陸浮'))!.draft.league,'MLB');
  const international=evidenceFor(playerMap['g-ティマ'])!;assert.equal(international.draft.year,null);assert.equal(draftExpectation(international.draft),.5);assert.ok(international.farmBatting!.pa>200);
 });
 test('draft position matters for comparable prospects, fades with experience, and performance can overcome it',()=>{
  const original=findPlayer('石塚裕惺'),base={...original,id:'growth-test',roster:{...original.roster!,birthDate:'2005-01-01'}} as Player;
  const evidence:GrowthEvidence={id:base.id,source:'test',birthDate:'2005-01-01',draft:{year:2025,rank:1,type:'regular',league:'NPB',pick:null},debutYear:null,batting:[],pitching:[],farmBatting:null,farmPitching:null};
  const measure=(e:GrowthEvidence,p:Player=base)=>{growthEvidence.set(base.id,e);return growthProfile({...p,batting:undefined,pitching:undefined});};
  try{
   const first=measure(evidence),late=measure({...evidence,draft:{...evidence.draft,rank:6}}),developmental=measure({...evidence,draft:{...evidence.draft,type:'developmental',rank:8}});
   assert.ok(first.factor>late.factor&&late.factor>developmental.factor);
   const veteran={...base,roster:{...base.roster!,birthDate:'1991-01-01'}} as Player;
   const olderFirst=measure({...evidence,draft:{...evidence.draft,year:2013}},veteran),olderLate=measure({...evidence,draft:{...evidence.draft,year:2013,rank:6}},veteran);
   assert.ok(olderFirst.factor<first.factor/5);assert.ok(olderFirst.factor-olderLate.factor<(first.factor-late.factor)/10);
   const poor={...evidence,farmBatting:{pa:500,ab:450,hits:50,hr:1,bb:10,so:200,obp:.15,slg:.15}},good={...evidence,draft:{...evidence.draft,rank:6},farmBatting:{pa:500,ab:450,hits:180,hr:25,bb:45,so:35,obp:.43,slg:.65}};
   assert.ok(measure(good).factor>measure(poor).factor);
   assert.ok(measure({...evidence,draft:{...evidence.draft,year:null,rank:null,type:null}}).factor>developmental.factor);
  }finally{growthEvidence.delete(base.id);}
 });
 test('tiny samples stay near neutral, and completed growth keeps player specialties',()=>{
  const p=findPlayer('立石正広'),tiny={...p,id:'tiny-sample',batting:{...p.batting!,pa:1,ab:1,hits:1,hr:1,so:0,obp:1,slg:4}} as Player;
  assert.ok(Math.abs(performanceExpectation(tiny).value-.5)<.01);
  const slow={...p,ratings:{...p.ratings,power:80,speed:20,arm:35}};
  const raised=developedRatings(slow,5);assert.ok(raised.power>raised.speed+30);assert.ok(raised.speed-slow.ratings.speed<20);assert.ok(raised.contact>slow.ratings.contact);
  const young=players.filter(p=>(playerAge(p)??99)<=22),scores=young.map(p=>ratingOverall(p,developedRatings(p,5)));
  assert.ok(scores.filter(s=>s>=90).length>=10);assert.ok(scores.filter(s=>s<85).length>50);assert.ok(new Set(scores).size>20);
  const relief=players.find(p=>p.role==='pitcher'&&(playerAge(p)??99)<24&&p.wikiAssessment?.pitcherRoles['中']==='◎'&&!p.wikiAssessment?.pitcherRoles['先']&&p.ratings.stamina<45)!;
  assert.ok(relief);assert.ok(developedRatings(relief,5).stamina<65);assert.equal(developedRatings(relief,5).velocity,relief.ratings.velocity);
 });
 test('revised growth preserves base ratings, purchased stages, wallet and historical stats on reload',()=>{
  const start=initialState(),id=start.lineup[0],state=simulateDays({...start,training:{[id]:3},gems:22345},3),frozen=JSON.stringify(state),loaded=migrateState(JSON.parse(frozen))!;
  assert.ok(loaded);assert.deepEqual(loaded.training,state.training);assert.deepEqual(loaded.owned,state.owned);assert.equal(loaded.gems,state.gems);assert.deepEqual(loaded.season,state.season);
  for(const p of players)assert.deepEqual(developedRatings(p,0),p.ratings);
  assert.equal(JSON.stringify(state),frozen);
 });
 test('player cards and details contain abilities without assessment explanations, external sources or potential forecasts',()=>{
  const state=initialState(),examples=[findPlayer('才木浩人'),playerMap['g-ティマ'],findPlayer('大谷翔平')];
  for(const player of examples){const html=renderToStaticMarkup(createElement(PlayerDetails,{player,state,onChange:()=>{},onAwaken:()=>{}}));
   for(const text of ['Wiki','wiki','掲載','査定','参考ページ','選手情報','能力・成長のデータ','伸びしろ','最大覚醒','npb.jp','mlb.com','atwiki.jp'])assert.ok(!html.includes(text),text);
   assert.ok(html.includes('総合'));assert.ok(html.includes('特殊能力'));assert.ok(html.includes('今シーズンの成績'));
  }
  const team=renderToStaticMarkup(createElement(DeckTeam,{state,onChange:()=>{},onPlayer:()=>{},onImpact:()=>{}}));assert.ok(team.includes('おまかせ編成'));assert.ok(!team.includes('1番は'));
 });
}
