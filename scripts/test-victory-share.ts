import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {players,playerMap,formatAvg} from '../src/pro/data';
import {initialState,emptySeason,simulateDays,nextSeason,migrateState,ops,type Season} from '../src/pro/engine';
import {buildByStrategy} from '../src/pro/franchise';
import {finishPostseason,type Postseason} from '../src/pro/postseason';
import {captureSeasonTeam,validSeasonTeam} from '../src/pro/season-team';
import {canShareVictory,publicGameUrl,shareTeamAbilities,victoryShareData,victoryTitle,victoryPostText,xPostIntent} from '../src/pro/victory-share';
import {VictoryShare} from '../src/pro/VictoryShare';

const winner=(number=1):Season=>{const s=emptySeason(number);return {...s,day:143,completed:true,standings:s.standings.map(t=>({...t,w:t.team==='t'?100:60,l:t.team==='t'?43:83}))};};
const post=(champion:string,stage:Postseason['stage']='complete')=>({stage,champion,series:[]} as Postseason);
export function registerVictoryShareTests(test:(name:string,run:()=>void)=>void){
 test('victory sharing appears for actual league and series championships, including repeat wins, but never unfinished or losing seasons',()=>{
  const s=initialState(),league=winner(12);assert.equal(victoryTitle(s.season,s.club),null);assert.equal(victoryTitle({...league,completed:false},s.club),null);
  assert.equal(victoryTitle(league,s.club),'リーグ優勝');assert.equal(victoryTitle({...league,postseason:post('t')},s.club),'日本一');assert.equal(victoryTitle({...league,postseason:post('g')},s.club),'リーグ優勝');
  const loss={...league,standings:league.standings.map(t=>({...t,w:t.team==='g'?100:60,l:t.team==='g'?43:83}))};assert.equal(victoryTitle({...loss,postseason:post('g')},s.club),null);assert.equal(victoryTitle({...loss,postseason:post('t')},s.club),'日本一');
  const major={...emptySeason(14,'MLB'),day:162,completed:true,postseason:post('t')};assert.equal(victoryTitle(major,s.club),'世界王座決定戦優勝');assert.equal(victoryTitle({...major,postseason:post('t','world')},s.club),null);
  assert.equal(renderToStaticMarkup(createElement(VictoryShare,{state:s,season:s.season})), '');
  const won={...s,season:league,achievements:{npbLeague:3}};assert.ok(renderToStaticMarkup(createElement(VictoryShare,{state:won,season:league})).includes('優勝の記録をシェア'));
 });
 test('season end freezes real team abilities and archived victory images survive later training, reorder, rename and save reload',()=>{
  const start=buildByStrategy({...initialState(),seed:19017,owned:Object.fromEntries(players.map(p=>[p.id,1])),training:Object.fromEntries(players.map(p=>[p.id,5]))},'balanced');
  const done=finishPostseason(simulateDays(start,143)),snap=done.season.shareTeam!;assert.ok(validSeasonTeam(snap));assert.deepEqual(snap,captureSeasonTeam(done));
  const expected=victoryShareData(done,done.season)!;assert.ok(expected);assert.equal(expected.abilityLabel,'シーズン終了時のチーム能力');assert.equal(expected.batters.length,9);
  assert.equal(expected.playerAbilityLabel,'シーズン終了時の選手能力');
  assert.deepEqual(expected.lineupAbilities.map(p=>p.id),snap.batters.map(p=>p.id));
  assert.deepEqual(expected.pitcherAbilities.map(p=>p.id),snap.pitchers.map(p=>p.id));
  for(const [i,row] of expected.lineupAbilities.entries()){assert.equal(row.order,i+1);assert.equal(row.position,snap.batters[i].position);assert.equal(row.overall,snap.batters[i].overall);assert.deepEqual(row.ratings,snap.batters[i].ratings);}
  for(const [i,row] of expected.pitcherAbilities.entries()){assert.equal(row.order,i+1);assert.equal(row.position,i<6?'先発':i===11?'抑え':'救援');assert.equal(row.overall,snap.pitchers[i].overall);assert.deepEqual(row.ratings,snap.pitchers[i].ratings);}
  for(const row of expected.batters){const b=Object.values(done.season.batting).find(b=>b.team===done.club&&playerMap[b.playerId].name===row.name)!;assert.equal(row.hr,b.hr);assert.equal(row.rbi,b.rbi);assert.equal(row.sb,b.sb);assert.equal(row.ops,formatAvg(ops(b)));}
  const next=nextSeason(done),changed={...next,name:'別名',training:{},lineup:[...next.lineup].reverse(),owned:Object.fromEntries(players.map(p=>[p.id,6]))};
  assert.deepEqual(victoryShareData(changed,next.history[0]),expected);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(changed)))!.history[0].shareTeam,snap);
  const broken=structuredClone(done);broken.season.shareTeam!.batters[0].ratings.power=999;assert.equal(migrateState(broken),null);
  const legacy=structuredClone(done);delete legacy.season.shareTeam;assert.ok(migrateState(legacy));assert.equal(victoryShareData(legacy,legacy.season)!.abilityLabel,'現在のチーム能力');assert.equal(victoryShareData({...legacy,season:emptySeason(2)},legacy.season),null);
  assert.equal(victoryShareData(legacy,legacy.season)!.playerAbilityLabel,'現在の選手能力');
 });
 test('shared player abilities include the whole saved order even without batting stats and do not expose mutable save objects',()=>{
  const base=initialState(),snapshot=captureSeasonTeam(base),season={...winner(4),shareTeam:snapshot},state={...base,season};
  const data=victoryShareData(state,season)!;assert.equal(data.batters.length,0);assert.equal(data.lineupAbilities.length,9);assert.equal(data.pitcherAbilities.length,12);
  const original=JSON.stringify(snapshot);data.lineupAbilities[0].ratings.power=99;data.pitcherAbilities[0].ratings.control=99;assert.equal(JSON.stringify(snapshot),original);
  const batter=snapshot.batters[0];snapshot.pitchers[0]={...batter,position:'投',ratings:{...batter.ratings,velocity:161,control:84,stamina:73,breaking:81}};
  const twoWay=victoryShareData(state,season)!;assert.ok(twoWay.lineupAbilities.some(p=>p.id===batter.id));assert.equal(twoWay.pitcherAbilities[0].id,batter.id);assert.equal(twoWay.pitcherAbilities[0].ratings.velocity,161);
  const html=renderToStaticMarkup(createElement(VictoryShare,{state,season}));assert.ok(html.includes('選手一人ひとりの能力'));assert.ok(!html.includes('最大覚醒'));
 });
 test('share team averages exclude DH from fielding and count a two-way card once in overall',()=>{
  const s=initialState(),snap=captureSeasonTeam(s),dh=snap.batters.find(r=>r.position==='DH')!;
  snap.pitchers[0]={...dh,position:'投'};dh.ratings.field=99;
  const abilities=shareTeamAbilities(snap),unique=[...new Map([...snap.batters,...snap.pitchers].map(r=>[r.id,r])).values()];
  assert.equal(abilities.overall,Math.round(unique.reduce((n,r)=>n+r.overall,0)/unique.length));
  assert.equal(abilities.metrics.find(([label])=>label==='守備')![1],Math.round(snap.batters.filter(r=>r.position!=='DH').reduce((n,r)=>n+r.ratings.field,0)/8));
 });
 test('share URLs exclude local addresses and private query data, and X receives the exact editable promotional text',()=>{
  for(const url of ['http://127.0.0.1:4178/','http://localhost:4180/','http://localhost.:4180/','http://10.0.0.2/','http://192.168.1.5/','http://172.16.0.5/','http://[::1]/','http://game.local/','file:///game.html','javascript:alert(1)'])assert.equal(publicGameUrl(url),'');
  assert.equal(publicGameUrl('https://user:secret@example.com/game/?save=secret#team'),'https://example.com/game/');
  const s={...initialState(),name:'優勝＆最強 #9',season:winner(3)},data=victoryShareData(s,s.season)!,url=publicGameUrl('https://example.com/game/'),text=victoryPostText(data,url),intent=new URL(xPostIntent(text));
  assert.equal(intent.origin,'https://twitter.com');assert.equal(intent.searchParams.get('text'),text);assert.ok(text.includes('3年目にリーグ優勝'));assert.ok(text.includes('#DIAMONDNINE'));assert.ok(text.includes(url));assert.ok(!text.includes('secret'));
  assert.ok(!victoryPostText(data).includes('127.0.0.1'));assert.ok(!victoryPostText(data).includes('最大覚醒'));
 });
 test('native image sharing is used only for secure contexts with supported PNG files; unsupported and rejected capabilities fall back',()=>{
  const file=new File(['png'],'result.png',{type:'image/png'});let passed:ShareData|undefined;
  const supported={share:async()=>{},canShare:(data?:ShareData)=>{passed=data;return true;}};
  assert.equal(canShareVictory(supported,file,true),true);assert.deepEqual(passed,{files:[file]});assert.equal(canShareVictory(supported,file,false),false);
  assert.equal(canShareVictory({...supported,canShare:()=>false},file,true),false);assert.equal(canShareVictory({...supported,canShare:()=>{throw new Error();}},file,true),false);
  assert.equal(canShareVictory({} as Navigator,file,true),false);
 });
}
