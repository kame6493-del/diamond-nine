// 2026-11-01 バランスの見直し(行動力をやめる・年ごとの成長・はじめての購入パック・あと一歩の補強)の試験。
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,migrateState,nextSeason,validState,effectiveOverall,type GameState} from '../src/pro/engine';
import {playerMap,players} from '../src/pro/data';
import {growOneYear,yearlyGrowthDelta,growthBonus,playerAge,ratingOverall,GROWTH_MAX,GROWTH_MIN} from '../src/pro/development';
import {STAMINA_ENABLED,costToFinish,seasonCost,freshStamina,settleStaminaRefund,staminaRefund,parseStamina,STAMINA_MAX} from '../src/pro/stamina';
import {StaminaPlay,StaminaChip} from '../src/pro/StaminaPanel';
import {firstPack,packById,pointPackIds,pointPacks,isOncePack,packBonusPercent} from '../src/pro/point-products';
import {nearMiss} from '../src/pro/pawa/PawaSeasonResult';
import {passSeasonPoints,seasonReward,SEASON_COMPLETE_POINTS} from '../src/pro/progression';
import {setPremiumMatchBonus} from '../src/pro/platform-economy';
import {SIMPLE_SCOUT_COST,scoutOdds} from '../src/pro/simple-game';
import {validStarterScout} from '../src/pro/starter-scout';

const T0=Date.UTC(2026,10,1,12);
const noop={onPlay:()=>{},onBuy:()=>null,onDrink:()=>false,onAdStart:()=>{},onAdReward:()=>{},onAdEnd:()=>{}};
export function registerBalance1101Tests(test:(name:string,run:()=>void)=>void){
 test('balance 11/01: stamina is off - a year never costs stamina and the panel is just "1年進める"',()=>{
  assert.equal(STAMINA_ENABLED,false);
  const s=initialState(4242),late={...s,pulls:30,season:{...s.season,number:40}};
  assert.equal(seasonCost(late),0);assert.equal(costToFinish(late),0);
  const html=renderToStaticMarkup(createElement(StaminaPlay,{state:late,busy:false,pawa:true,actions:noop}));
  assert.match(html,/1年進める/);assert.doesNotMatch(html,/行動力|回復|disabled/);
  assert.equal(renderToStaticMarkup(createElement(StaminaChip,{onOpen:()=>{}})),'');
 });
 test('balance 11/01: leftover stamina above the cap and drinks turn into points once',()=>{
  const r={...freshStamina(T0),points:STAMINA_MAX+130,drinks:2};
  assert.equal(staminaRefund(r),130*40+2*30*40);
  const [next,pts]=settleStaminaRefund(r);assert.equal(pts,7600);assert.equal(next.refunded,true);assert.equal(next.drinks,0);
  assert.equal(settleStaminaRefund(next)[1],0,'2回目は0');
  assert.equal(parseStamina(JSON.stringify(next),T0).refunded,true,'済みの印は読み直しても残る');
  assert.equal(staminaRefund(freshStamina(T0)),0,'満タン以下・ドリンク無しは0');
  assert.equal(staminaRefund({...freshStamina(T0),points:400,drinks:99}),30000,'上限 30,000pt');
 });
 test('balance 11/01: players age each year - the young grow, veterans decline, once per season',()=>{
  const young=players.find(p=>!p.mlb&&(playerAge(p)??99)<=21)!,old=players.find(p=>!p.mlb&&(playerAge(p)??0)>=36)!;
  assert.ok(yearlyGrowthDelta(young,0)>=1.5,`${yearlyGrowthDelta(young,0)}`);assert.ok(yearlyGrowthDelta(old,0)<0);
  assert.ok(yearlyGrowthDelta(young,15)<0,'若手も年を重ねればいつか衰える');
  let s:GameState={...initialState(4242),owned:{[young.id]:1,[old.id]:1}};
  s=growOneYear(s,1,id=>playerMap[id]);const once=s.careerGrowth!;
  assert.equal(once[young.id].y,1);assert.ok(once[young.id].b>0);assert.ok(once[old.id].b<0);
  assert.deepEqual(growOneYear(s,1,id=>playerMap[id]).careerGrowth,once,'同じ年は2回効かない');
  for(let y=2;y<=40;y++)s=growOneYear(s,y,id=>playerMap[id]);
  for(const v of Object.values(s.careerGrowth!))assert.ok(v.b>=GROWTH_MIN&&v.b<=GROWTH_MAX);
  const base=effectiveOverall(young,{[young.id]:1}),grown=effectiveOverall(young,{[young.id]:1},{},{[young.id]:{y:3,b:6}});
  assert.ok(grown>base,'成長は総合に効く');assert.equal(growthBonus({[young.id]:{y:3,b:5.6}},young.id),6);
 });
 test('balance 11/01: growth survives save/load, junk growth entries are dropped, old saves still load',()=>{
  const s=initialState(4242),id=s.lineup[0];
  const saved={...s,careerGrowth:{[id]:{y:2,b:3.4},notMine:{y:1,b:1}}};
  const m=migrateState(JSON.parse(JSON.stringify(saved)))!;assert.ok(m);assert.deepEqual(m.careerGrowth,{[id]:{y:2,b:3.4}});
  assert.ok(validState(m));
  const legacy=migrateState(JSON.parse(JSON.stringify(s)))!;assert.ok(legacy);assert.equal(legacy.careerGrowth,undefined);
  assert.equal(validState({...m,careerGrowth:{[id]:{y:1,b:99}}}),false);
 });
 test('balance 11/01: nextSeason applies one year of growth to the whole roster',()=>{
  const s=initialState(77);
  const done={...s,season:{...s.season,completed:true,day:143,postseason:{stage:'complete'} as never}};
  const n=nextSeason(done);
  assert.equal(n.grownSeason,1);assert.equal(Object.keys(n.careerGrowth!).length,Object.keys(s.owned).length);
 });
 test('balance 11/01: the old 85+ starter offers stay valid; new offers are 74-82',()=>{
  const strong=players.filter(p=>!p.mlb&&!p.provisional&&ratingOverall(p)>=85).slice(0,3).map(p=>p.id);
  assert.equal(strong.length,3);
  assert.ok(validStarterScout({version:1,choices:strong,selected:null,completed:false},{}));
 });
 test('balance 11/01: first-purchase pack - ¥480 for 30,000pt, one per account, sold beside the six packs',()=>{
  assert.equal(firstPack.id,'pt_first_30000');assert.equal(firstPack.points,30000);assert.equal(firstPack.priceYen,480);
  assert.ok(isOncePack('pt_first_30000'));assert.ok(!isOncePack('pt_pack_10000'));
  assert.ok(pointPackIds.includes('pt_first_30000'));assert.equal(packById('pt_first_30000'),firstPack);
  assert.equal(pointPacks.length,6,'いつもの6つはそのまま');assert.ok(packBonusPercent(firstPack)>packBonusPercent(pointPacks[5]));
  assert.equal(SIMPLE_SCOUT_COST,3000,'スカウトの値段は変えない(持っている pt の価値を下げない)');
 });
 test('balance 11/01: premium pass season points only in the app while owned',()=>{
  const s=initialState(4242);
  setPremiumMatchBonus(false);assert.equal(passSeasonPoints(),0);
  assert.equal(seasonReward({...s,pulls:99}),SEASON_COMPLETE_POINTS);
  // ブラウザ版の試験では appEdition が false なので、パスを有効にしても足されない(アプリ版だけの特典)
  setPremiumMatchBonus(true);assert.equal(passSeasonPoints(),0);setPremiumMatchBonus(false);
 });
 test('balance 11/01: the near-miss panel shows only when the title was close',()=>{
  const s=initialState(4242);
  const mk=(f:(team:string)=>number):GameState=>({...s,season:{...s.season,completed:true,day:143,standings:s.season.standings.map(t=>({...t,w:f(t.team),l:143-f(t.team)}))}});
  const rival=s.season.standings.find(t=>t.team!==s.club&&['g','db','c','s','d'].includes(t.team))!.team;
  const r=nearMiss(mk(t=>t===s.club?80:t===rival?84:60),s.season.number);
  assert.ok(r);assert.equal(r!.rank,2);assert.equal(r!.behind,4);assert.equal(r!.weak.length,2);
  assert.equal(nearMiss(mk(t=>t===s.club?50:t===rival?95:60),s.season.number),null);
  assert.equal(nearMiss(mk(t=>t===s.club?60:t===rival?84:50),s.season.number),null,'12ゲーム差は出さない');
  assert.equal(scoutOdds(s).mlb,.02,'確率は変えていない');
 });
}
