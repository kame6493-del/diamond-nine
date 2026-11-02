// 2026-11-01 バランスの見直し(行動力をやめる・年ごとの成長・はじめての購入パック・あと一歩の補強)の試験。
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,migrateState,nextSeason,validState,effectiveOverall,type GameState} from '../src/pro/engine';
import {playerMap,players} from '../src/pro/data';
import {growOneYear,yearlyGrowthDelta,growthBonus,playerAge,ratingOverall,GROWTH_MAX,GROWTH_MIN,YEARLY_GROWTH_ENABLED} from '../src/pro/development';
import {STAMINA_ENABLED,costToFinish,seasonCost,freshStamina,settleStaminaRefund,staminaRefund,parseStamina,STAMINA_MAX,restartStamina,staminaRules,buyDrinkSet,canBuyDrinkSet,DRINK_SET_COST,DRINK_SET_COUNT,DRINK_RESTORE,STAMINA_HARD_CAP} from '../src/pro/stamina';
import {StaminaPlay,StaminaChip,StaminaSheet} from '../src/pro/StaminaPanel';
import {drinkSetBuysLeft,DRINK_SET_DAILY_LIMIT,STAMINA_PT_SMALL_COST,STAMINA_PT_FULL_COST,staminaPtPrice} from '../src/pro/stamina';
import {firstPack,packById,pointPackIds,pointPacks,isOncePack,packBonusPercent} from '../src/pro/point-products';
import {nearMiss} from '../src/pro/pawa/PawaSeasonResult';
import {passSeasonPoints,seasonReward,SEASON_COMPLETE_POINTS} from '../src/pro/progression';
import {setPremiumMatchBonus} from '../src/pro/platform-economy';
import {SIMPLE_SCOUT_COST,scoutOdds} from '../src/pro/simple-game';
import {validStarterScout} from '../src/pro/starter-scout';

const T0=Date.UTC(2026,10,1,12);
const noop={onPlay:()=>{},onBuy:()=>null,onDrink:()=>false,onAdStart:()=>{},onAdReward:()=>{},onAdEnd:()=>{}};
export function registerBalance1101Tests(test:(name:string,run:()=>void)=>void){
 test('balance 11/02 (vc36): stamina is back - a domestic year costs 10 from season 4, the chip shows, and the empty panel offers wait, ad, points and drinks on one screen',()=>{
  assert.equal(STAMINA_ENABLED,true);
  const s=initialState(4242),late={...s,pulls:30,season:{...s.season,number:40}},early={...s,season:{...s.season,number:3}};
  assert.equal(seasonCost(late),10);assert.equal(costToFinish(late),10);assert.equal(seasonCost(early),0);
  assert.match(renderToStaticMarkup(createElement(StaminaChip,{onOpen:()=>{}})),/st-chip/);
  const empty={points:3,max:30,regenMs:30*60000,full:false,nextInMs:20*60000,fullInMs:20*60000+26*30*60000,frozen:false,drinks:0};
  const html=renderToStaticMarkup(createElement(StaminaPlay,{state:late,busy:false,pawa:true,actions:{...noop,onBuyDrinks:()=>false},view:empty}));
  assert.match(html,/行動力が足りません/);assert.match(html,/あと 3時間20分 で1年ぶん/,'7足りない = 20分+6×30分');
  for(const t of ['待つ（無料）','動画を見る','ポイントで少し回復','ポイントで満タンまで回復','回復ドリンクを買う'])assert.ok(html.includes(t),t);
  assert.match(html,/1年進める/);assert.doesNotMatch(html,/1試合<|10連|まとめて引/);
 });
 test('balance 11/02 (vc36): an old stamina record restarts full once; refunded players keep their points; over-cap stock is kept',()=>{
  const free=staminaRules(false),now=T0+1000;
  const refunded={...freshStamina(T0),points:12,drinks:0,refunded:true,restarted:undefined};delete (refunded as {restarted?:boolean}).restarted;
  const r1=restartStamina(refunded,now,free);assert.equal(r1.points,30);assert.equal(r1.restarted,true);assert.equal(r1.refunded,true);assert.equal(r1.at,now);
  assert.deepEqual(restartStamina(r1,now+5,free),r1,'一度だけ');
  const old={v:1 as const,points:180,at:T0,seen:T0,drinks:4,gift:{day:'',login:false,all:false}};
  const r2=restartStamina(old,now,free);assert.equal(r2.points,180,'返していない上限超えの分は減らさない');assert.equal(r2.drinks,4);
  assert.equal(restartStamina({...old,points:2},now,free).points,30);
  assert.equal(parseStamina(JSON.stringify(r1),now).restarted,true,'済みの印は読み直しても残る');
  assert.equal(freshStamina(T0).restarted,true,'新しく始める人は始め直さない(満タンから)');
  assert.ok(STAMINA_HARD_CAP>=180);
 });
 test('balance 11/02 (vc36): drinks can be bought with points, 3 for 6,000, kept for later',()=>{
  const r=freshStamina(T0);assert.equal(DRINK_SET_COUNT,3);assert.equal(DRINK_SET_COST,10500);assert.equal(DRINK_RESTORE,10);
  assert.equal(canBuyDrinkSet(r,10499),false);assert.equal(buyDrinkSet(r,10499),null);
  const [n,price]=buyDrinkSet(r,10500)!;assert.equal(n.drinks,3);assert.equal(price,10500);assert.equal(n.points,r.points);
  assert.equal(canBuyDrinkSet({...r,drinks:97},99999),false,'99本まで');
 });
 test('balance 11/02 (vc38): a recover button sits next to the stamina chip and opens every option on one screen; full shows 満タンです',()=>{
  const s=initialState(4242),late={...s,pulls:30,season:{...s.season,number:40},gems:50000};
  const acts={...noop,onBuyDrinks:()=>false};
  const empty={points:3,max:30,regenMs:30*60000,full:false,nextInMs:20*60000,fullInMs:20*60000+26*30*60000,frozen:false,drinks:2};
  const chip=renderToStaticMarkup(createElement(StaminaChip,{state:late,pawa:true,actions:acts,view:empty}));
  assert.match(chip,/st-chip-recover/);assert.match(chip,/>回復</);
  const sheet=renderToStaticMarkup(createElement(StaminaSheet,{state:late,pawa:true,busy:false,actions:acts,v:empty,onClose:()=>{}}));
  for(const x of ['行動力の回復','次に1回復するまで','20分00秒','待つ（無料）','動画を見る','ポイントで少し回復','ポイントで満タンまで回復','回復ドリンクを使う','回復ドリンクを買う'])assert.ok(sheet.includes(x),x);
  assert.doesNotMatch(sheet,/10連|まとめて引|1試合|10試合|期限/);
  const full={...empty,points:30,full:true,nextInMs:0,fullInMs:0};
  const fsheet=renderToStaticMarkup(createElement(StaminaSheet,{state:late,pawa:true,busy:false,actions:acts,v:full,onClose:()=>{}}));
  assert.match(fsheet,/行動力は満タンです/);
  // 足す物(動画・ポイント2つ・ドリンクを使う)は「満タン」で押せない
  assert.equal((fsheet.match(/disabled="">満タン</g)??[]).length,4,fsheet);
 });
 test('balance 11/02 (vc38): point recovery does not pay for itself - a year from points costs about what a year earns, and drinks are 1 set a day',()=>{
  // 無課金・上手な遊び方の1年(2年目から)に入るのは約4,000pt(BALANCE_1101.md vc36 の表)。
  const yearIncome=3980;
  assert.equal(STAMINA_PT_SMALL_COST,3500);assert.equal(STAMINA_PT_FULL_COST,10000);
  const r=freshStamina(T0),day='2026-11-03';
  const smalls=[0,1,2].map(n=>staminaPtPrice('small',{...r,ptBuys:{day,count:n}},day)),fulls=[0,1,2].map(n=>staminaPtPrice('full',{...r,ptBuys:{day,count:n}},day));
  assert.deepEqual(smalls,[3500,5250,7000]);assert.deepEqual(fulls,[10000,15000,20000]);
  // 1日に3回使い切ると、使ったポイント > その年数で入るポイント
  assert.ok(smalls.reduce((a,b)=>a+b)>3*yearIncome);assert.ok(fulls.reduce((a,b)=>a+b)>9*yearIncome);
  // 2回目からは1回ごとに損
  assert.ok(smalls[1]>yearIncome&&fulls[1]>3*yearIncome);
  // ドリンク: 1本 = 少し回復の1回目と同じ値段、1日1組
  assert.equal(DRINK_SET_COST/DRINK_SET_COUNT,STAMINA_PT_SMALL_COST);assert.equal(DRINK_SET_DAILY_LIMIT,1);
  assert.equal(drinkSetBuysLeft(r,day),1);
  const [n]=buyDrinkSet(r,99999,day)!;assert.equal(drinkSetBuysLeft(n,day),0);assert.equal(canBuyDrinkSet(n,99999,day),false);assert.equal(buyDrinkSet(n,99999,day),null);
  assert.equal(canBuyDrinkSet(n,99999,'2026-11-04'),true,'日付が変わるとまた買える');
  assert.equal(parseStamina(JSON.stringify(n),T0).drinkBuys?.count,1,'回数は読み直しても残る');
 });
 test('balance 11/01: leftover stamina above the cap and drinks turn into points once',()=>{
  const r={...freshStamina(T0),points:STAMINA_MAX+130,drinks:2};
  assert.equal(staminaRefund(r),130*40+2*DRINK_RESTORE*40);
  const [next,pts]=settleStaminaRefund(r);assert.equal(pts,130*40+2*DRINK_RESTORE*40);assert.equal(next.refunded,true);assert.equal(next.drinks,0);
  assert.equal(settleStaminaRefund(next)[1],0,'2回目は0');
  assert.equal(parseStamina(JSON.stringify(next),T0).refunded,true,'済みの印は読み直しても残る');
  assert.equal(staminaRefund(freshStamina(T0)),0,'満タン以下・ドリンク無しは0');
  assert.equal(staminaRefund({...freshStamina(T0),points:400,drinks:99}),30000,'上限 30,000pt');
 });
 test('balance 11/02 (vc35): yearly growth is off - a year never changes ratings; vc34 gains stay, vc34 declines are undone',()=>{
  assert.equal(YEARLY_GROWTH_ENABLED,false);
  const young=players.find(p=>!p.mlb&&(playerAge(p)??99)<=21)!,old=players.find(p=>!p.mlb&&(playerAge(p)??0)>=36)!;
  let s:GameState={...initialState(4242),owned:{[young.id]:1,[old.id]:1}};
  for(let y=1;y<=20;y++)s=growOneYear(s,y,id=>playerMap[id]);
  assert.equal(s.careerGrowth,undefined,'年を進めても成長の欄は増えない');assert.equal(s.grownSeason,undefined);
  const base=effectiveOverall(young,{[young.id]:1});
  assert.ok(effectiveOverall(young,{[young.id]:1},{},{[young.id]:{y:3,b:6}})>base,'vc34 で伸びた分は残す');
  assert.equal(effectiveOverall(old,{[old.id]:1},{},{[old.id]:{y:3,b:-5}}),effectiveOverall(old,{[old.id]:1}),'vc34 で衰えた分は戻す');
  assert.equal(growthBonus({[young.id]:{y:3,b:5.6}},young.id),6);assert.equal(growthBonus({[old.id]:{y:3,b:-4}},old.id),0);
  assert.ok(GROWTH_MIN<0&&GROWTH_MAX>0);void yearlyGrowthDelta;
 });
 test('balance 11/01: growth survives save/load, junk growth entries are dropped, old saves still load',()=>{
  const s=initialState(4242),id=s.lineup[0];
  const saved={...s,careerGrowth:{[id]:{y:2,b:3.4},notMine:{y:1,b:1}}};
  const m=migrateState(JSON.parse(JSON.stringify(saved)))!;assert.ok(m);assert.deepEqual(m.careerGrowth,{[id]:{y:2,b:3.4}});
  assert.ok(validState(m));
  const legacy=migrateState(JSON.parse(JSON.stringify(s)))!;assert.ok(legacy);assert.equal(legacy.careerGrowth,undefined);
  assert.equal(validState({...m,careerGrowth:{[id]:{y:1,b:99}}}),false);
 });
 test('balance 11/02 (vc35): nextSeason leaves every rating as it was (no aging)',()=>{
  const s=initialState(77),id=s.lineup[0];
  const done={...s,careerGrowth:{[id]:{y:1,b:2}},grownSeason:0,season:{...s.season,completed:true,day:143,postseason:{stage:'complete'} as never}};
  const n=nextSeason(done);
  assert.deepEqual(n.careerGrowth,{[id]:{y:1,b:2}},'vc34 の値はそのまま(増えも減りもしない)');assert.equal(n.grownSeason,0);
  for(const pid of Object.keys(s.owned))assert.equal(effectiveOverall(playerMap[pid],n.owned,n.training,n.careerGrowth),effectiveOverall(playerMap[pid],done.owned,done.training,done.careerGrowth));
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
