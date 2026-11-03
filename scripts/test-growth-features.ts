import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {players,playerMap} from '../src/pro/data';
import {initialState,emptySeason,type Season} from '../src/pro/engine';
import type {Postseason} from '../src/pro/postseason';
import {isRookie} from '../src/pro/development';
import {drawSimplePlayer,SIMPLE_SCOUT_COST,scoutOdds,scoutPlayerOdds,scoutBandOf} from '../src/pro/simple-game';
import {SHARE_TAGS,scoutPostText,scoutShareData,shareTags,xWeightedLength} from '../src/pro/share-kit';
import {seasonShareTitle,victoryPostText,victoryShareData} from '../src/pro/victory-share';
import {VictoryShare} from '../src/pro/VictoryShare';
import {ScoutShare} from '../src/pro/ScoutShare';
import {cleanParams,track} from '../src/pro/analytics';

const inEvent=new Date(2026,9,23,12),beforeEvent=new Date(2026,9,15,23,59);
const finished=(rankOf:string,number=5):Season=>{const s=emptySeason(number);return {...s,day:143,completed:true,postseason:{stage:'complete',champion:'g',series:[]} as Postseason,standings:s.standings.map(t=>({...t,w:t.team===rankOf?100:t.team==='t'?50:70,l:t.team===rankOf?43:t.team==='t'?93:73}))};};

export function registerGrowthFeatureTests(test:(name:string,run:()=>void)=>void){
 test('2026-11-03 vc41: draft week is gone - rookies are ordinary domestic players, the date never changes a draw, and the odds have no rookie row',()=>{
  const inOldEvent=new Date(2026,9,23,12),base={...initialState(),gems:SIMPLE_SCOUT_COST*4000,seed:4242};
  let plain=base,dated=base;
  for(let i=0;i<200;i++){plain=drawSimplePlayer(plain);dated=drawSimplePlayer(dated,inOldEvent);}
  assert.deepEqual(dated.owned,plain.owned);assert.equal(dated.seed,plain.seed);
  assert.ok(scoutOdds(base,inOldEvent).bands.every(b=>!/ルーキー|rookie/i.test(b.id+b.label+b.detail)));
  const rookies=players.filter(p=>!p.mlb&&isRookie(p)),per=scoutPlayerOdds(base,inOldEvent);
  assert.ok(rookies.length>=50);
  for(const p of rookies)assert.equal(per.get(p.id),scoutOdds(base).bands.find(b=>b.id===scoutBandOf(p))!.each,'ルーキーも同じ段の他の選手と同じ確率');
 });
 test('every post carries the brand and genre hashtags (no draft tag any more), and fits X\'s 280 limit',()=>{
  for(const tag of SHARE_TAGS)assert.ok(shareTags(beforeEvent).includes(tag));
  assert.equal(shareTags(inEvent),shareTags(beforeEvent));assert.ok(!shareTags(inEvent).includes('#ドラフト会議'));
  assert.equal(xWeightedLength('abc'),3);assert.equal(xWeightedLength('野球'),4);assert.equal(xWeightedLength('https://example.com/very/long/path?x=1'),23);
  const url='https://diamond-nine-baseball.com/';
  const longest=[...players].sort((a,b)=>b.name.length-a.name.length)[0];
  for(const tier of ['standard','gold','rainbow'] as const){
   const text=scoutPostText(scoutShareData(longest,{[longest.id]:1},{},tier,true,true),url,inEvent);
   assert.ok(xWeightedLength(text)<=280,`${tier} ${xWeightedLength(text)}`);assert.ok(text.includes('#DIAMONDNINE'));assert.ok(text.includes(url));
  }
  const s={...initialState(),name:'あ'.repeat(20)},season=finished(s.club);
  const data=victoryShareData({...s,season},season)!;
  for(const d of [data,{...data,champion:true,title:'宇宙王座決定戦優勝'}]){const text=victoryPostText(d,url,inEvent);assert.ok(xWeightedLength(text)<=280,`${xWeightedLength(text)}`);assert.ok(text.includes('#プロ野球'));}
 });
 test('every finished season is shareable with its final rank; unfinished seasons and open postseasons are not',()=>{
  const s=initialState();
  const low=seasonShareTitle(finished('g'),s.club);assert.equal(low?.champion,false);assert.match(low!.title,/^リーグ[2-6]位$/);
  const second=finished('g');second.standings=second.standings.map(t=>({...t,w:t.team===s.club?90:t.team==='g'?100:60,l:t.team===s.club?53:t.team==='g'?43:83}));
  assert.deepEqual(seasonShareTitle(second,s.club),{title:'リーグ2位',champion:false});
  assert.equal(seasonShareTitle({...second,postseason:{stage:'japan',champion:undefined,series:[]} as unknown as Postseason},s.club),null);
  assert.equal(seasonShareTitle({...second,completed:false},s.club),null);
  const top=finished(s.club);assert.equal(seasonShareTitle(top,s.club)?.champion,true);
  const state={...s,season:second},html=renderToStaticMarkup(createElement(VictoryShare,{state,season:second}));
  assert.ok(html.includes('シーズンの記録をシェア'));assert.ok(!html.includes('優勝の記録をシェア'));
  const text=victoryPostText(victoryShareData(state,second)!,'',beforeEvent);assert.ok(text.includes('リーグ2位'));assert.ok(text.includes('来季こそ優勝へ'));
 });
 test('scout share renders a labelled button whose wording follows the card tier',()=>{
  const p=players.find(p=>!p.mlb)!;
  const html=(tier:'standard'|'gold'|'rainbow')=>renderToStaticMarkup(createElement(ScoutShare,{data:scoutShareData(p,{[p.id]:1},{},tier,true)}));
  assert.ok(html('rainbow').includes('虹カードを自慢する'));assert.ok(html('gold').includes('この当たりをシェア'));assert.ok(html('standard').includes('この選手をシェア'));
  const pitcher=players.find(p=>p.role==='pitcher')!,d=scoutShareData(pitcher,{[pitcher.id]:1},{},'standard',false);
  assert.equal(d.abilities[0][0],'球速');assert.ok(scoutPostText(d,'',beforeEvent).includes('重ねて獲得'));
 });
 test('analytics sends only named game facts and is a silent no-op without the native bridge',()=>{
  assert.deepEqual(cleanParams({tier:'gold',pulls:3,is_new:true,bad:NaN,'Bad Key':1,none:undefined,empty:null,long:'x'.repeat(150)}),{tier:'gold',pulls:3,is_new:true,long:'x'.repeat(100)});
  assert.doesNotThrow(()=>track('scout_draw',{tier:'gold'}));
  const g=globalThis as {window?:unknown},old=g.window,sent:[string,unknown][]=[];
  g.window={diamondAnalytics:{track:(n:string,p:unknown)=>sent.push([n,p])}};
  try{track('Bad Name');track('season_complete',{rank:2,team:undefined});track('boom');}finally{g.window=old;}
  assert.deepEqual(sent,[['season_complete',{rank:2}],['boom',{}]]);
  g.window={diamondAnalytics:{track:()=>{throw new Error('offline');}}};
  try{assert.doesNotThrow(()=>track('share',{content:'scout'}));}finally{g.window=old;}
 });
}
