import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState,simulateDays} from '../src/pro/engine';
import {seasonGames} from '../src/pro/leagues';
import {dailyLeft,localDay,parseDaily,spendDaily,type MonetizeBridge,type MonetizeSnapshot} from '../src/pro/monetization';
import {
 DRINK_RESTORE,FIRST_SEASON_FREE_GAMES,PASS_STAMINA_MAX,PASS_STAMINA_REGEN_MS,STAMINA_AD_DAILY_LIMIT,STAMINA_AD_POINTS,STAMINA_HARD_CAP,
 STAMINA_MAX,STAMINA_PT_COST,STAMINA_REGEN_MS,addStamina,affordableGames,canBuyWithPoints,claimDrinkGift,costForGames,currentRules,
 freeGamesLeft,freshStamina,fullAt,gamesLeft,loadStamina,parseStamina,setStaminaPass,settle,spendStamina,staminaRules,staminaView,useDrink,
} from '../src/pro/stamina';
import {StaminaPlay} from '../src/pro/StaminaPanel';
import {PremiumPassCard} from '../src/pro/MonetizePanel';

const MIN=60000,T0=Date.UTC(2026,9,19,3,0,0);
const free=staminaRules(false),pass=staminaRules(true);

export function registerStaminaTests(test:(name:string,run:()=>void)=>void){
 test('stamina: limits and regeneration are the documented numbers; a free NPB season takes days, never money',()=>{
  assert.deepEqual(free,{max:20,regenMs:12*MIN});
  assert.deepEqual(pass,{max:30,regenMs:9*MIN});
  assert.equal(STAMINA_PT_COST,1500);assert.equal(STAMINA_AD_POINTS,5);assert.equal(STAMINA_AD_DAILY_LIMIT,3);assert.equal(DRINK_RESTORE,10);
  // 寝ずに回復ぶんを毎回使っても、2シーズン目以降(無料の開幕なし)の143試合は 満タン20 + 123回復 = 24時間36分。
  const games=143,hours=(games-STAMINA_MAX)*STAMINA_REGEN_MS/3600000;
  assert.ok(hours>24,`continuous play should not finish a season inside a day (${hours}h)`);
  // 1日に満タンを3回使う人(+ログインのドリンク10)は 70試合/日 → 約2日。
  assert.ok(games/(STAMINA_MAX*3+DRINK_RESTORE)>2);
 });

 test('stamina: players without a record (existing saves) and broken records start full',()=>{
  for(const raw of [null,'','{','{"v":2}','{"v":1,"points":-3,"at":0,"seen":0,"drinks":0}','"x"']){
   const r=parseStamina(raw,T0);assert.equal(r.points,STAMINA_MAX);assert.equal(r.at,T0);assert.equal(r.drinks,0);
  }
  const loaded=loadStamina(T0);// no localStorage in node: still a full record
  assert.equal(loaded.points,STAMINA_MAX);
  const kept=parseStamina(JSON.stringify({...freshStamina(T0),points:7,drinks:2}),T0+MIN);
  assert.equal(kept.points,7);assert.equal(kept.drinks,2);
 });

 test('stamina: spending and time-based recovery',()=>{
  const full=freshStamina(T0);
  assert.equal(spendStamina(full,21,T0,free),null);
  assert.equal(spendStamina(full,-1,T0,free),null);
  const used=spendStamina(full,20,T0,free)!;assert.equal(used.points,0);
  assert.equal(settle(used,T0+11*MIN,free).points,0);
  assert.equal(settle(used,T0+12*MIN,free).points,1);
  assert.equal(settle(used,T0+60*MIN+30000,free).points,5);
  // 端数の時間は次へ持ち越す
  const partial=settle(used,T0+30*MIN,free);assert.equal(partial.points,2);assert.equal(settle(partial,T0+36*MIN,free).points,3);
  assert.equal(settle(used,T0+24*60*MIN,free).points,STAMINA_MAX);
  const v=staminaView(used,T0+5*MIN,free);assert.equal(v.nextInMs,7*MIN);assert.equal(v.fullInMs,7*MIN+19*12*MIN);
  assert.equal(fullAt(used,T0,free),T0+20*12*MIN);assert.equal(fullAt(full,T0,free),null);
  // 満タンの間は貯まらない(満タンで放置した時間は後で回復に数えない)
  const idle=settle(full,T0+5*60*MIN,free);const after=spendStamina(idle,1,T0+5*60*MIN,free)!;
  assert.equal(settle(after,T0+5*60*MIN+11*MIN,free).points,19);
 });

 test('stamina: turning the clock back never recovers, and a forward-then-back trick freezes recovery',()=>{
  const used=spendStamina(freshStamina(T0),20,T0,free)!;
  const seen=settle(used,T0+30*MIN,free);assert.equal(seen.points,2);
  // 1日戻す: 回復しない
  assert.equal(settle(seen,T0-24*60*MIN,free).points,2);
  assert.equal(staminaView(seen,T0,free).frozen,true);
  assert.equal(staminaView(seen,T0+29*MIN,free).points,2);
  // 進めて満タン→戻して使う→前回の時刻に追いつくまで回復しない
  const ahead=settle(used,T0+24*60*MIN,free);assert.equal(ahead.points,20);
  const spent=spendStamina(ahead,20,T0+60*MIN,free)!;assert.equal(spent.points,0);
  assert.equal(settle(spent,T0+23*60*MIN,free).points,0);
  assert.equal(settle(spent,T0+24*60*MIN+12*MIN,free).points,1);
  // 時計が戻っていても、ドリンク・広告・pt の回復と消費はできる(待つ以外は時計に関係しない)
  assert.equal(addStamina(spent,5,T0+2*60*MIN,free).points,5);
 });

 test('stamina: points refill, drinks, gifts and the hard cap',()=>{
  const empty=spendStamina(freshStamina(T0),20,T0,free)!;
  assert.equal(canBuyWithPoints(empty,STAMINA_PT_COST-1,T0,free),false);
  assert.equal(canBuyWithPoints(empty,STAMINA_PT_COST,T0,free),true);
  const bought=addStamina(empty,free.max,T0,free);assert.equal(bought.points,20);
  // 上限を超えて持てる(無駄にしない)。超えている間は時間では増えない。
  const over=addStamina(bought,free.max,T0,free);assert.equal(over.points,40);assert.equal(settle(over,T0+600*MIN,free).points,40);
  assert.equal(addStamina(over,1000,T0,free).points,STAMINA_HARD_CAP);
  assert.equal(canBuyWithPoints({...over,points:STAMINA_HARD_CAP-10},99999,T0,free),false);
  assert.equal(useDrink(empty,T0,free),null);
  let [r,got]=claimDrinkGift(empty,'login','2026-10-19');assert.equal(got,1);
  [r,got]=claimDrinkGift(r,'login','2026-10-19');assert.equal(got,0);
  [r,got]=claimDrinkGift(r,'all','2026-10-19');assert.equal(got,1);assert.equal(r.drinks,2);
  [r,got]=claimDrinkGift(r,'login','2026-10-20');assert.equal(got,1);assert.equal(r.drinks,3);
  const drank=useDrink(r,T0,free)!;assert.equal(drank.points,DRINK_RESTORE);assert.equal(drank.drinks,2);
 });

 test('stamina: rewarded-ad recovery has its own daily limit',()=>{
  const day=localDay();let rec=parseDaily(null);
  for(let i=0;i<STAMINA_AD_DAILY_LIMIT;i++){assert.ok(dailyLeft(rec,day,STAMINA_AD_DAILY_LIMIT)>0);rec=spendDaily(rec,day);}
  assert.equal(dailyLeft(rec,day,STAMINA_AD_DAILY_LIMIT),0);
  assert.equal(dailyLeft(rec,'2099-01-01',STAMINA_AD_DAILY_LIMIT),STAMINA_AD_DAILY_LIMIT);
 });

 test('stamina: the premium pass raises the limit and recovers faster',()=>{
  const used=spendStamina(freshStamina(T0,pass),30,T0,pass)!;
  assert.equal(settle(used,T0+90*MIN,pass).points,10);
  assert.equal(settle(used,T0+90*MIN,free).points,7);
  assert.equal(settle(used,T0+24*60*MIN,pass).points,PASS_STAMINA_MAX);
  assert.equal(PASS_STAMINA_REGEN_MS<STAMINA_REGEN_MS,true);
  setStaminaPass(true);assert.deepEqual(currentRules(),pass);setStaminaPass(false);assert.deepEqual(currentRules(),free);
  const snap={privacyOptions:false,reward:{available:true,busy:false,left:3,limit:3,points:3000},premium:{status:'ready',owned:false,verified:true,price:'¥480',busy:false,message:''}} as MonetizeSnapshot;
  const html=withBridge(snap,()=>renderToStaticMarkup(createElement(PremiumPassCard)));
  assert.match(html,/行動力の上限 20→30、回復 12分→9分ごと/);
 });

 test('stamina: the first season opens with free games, later seasons cost one per game',()=>{
  const s=initialState(4242);
  assert.equal(s.history.length,0);
  assert.equal(freeGamesLeft(s),FIRST_SEASON_FREE_GAMES);
  assert.equal(costForGames(s,FIRST_SEASON_FREE_GAMES),0);
  assert.equal(costForGames(s,FIRST_SEASON_FREE_GAMES+5),5);
  assert.equal(affordableGames(s,0),FIRST_SEASON_FREE_GAMES);
  assert.equal(affordableGames(s,20),40);
  const later=simulateDays(s,15);assert.equal(freeGamesLeft(later),5);assert.equal(costForGames(later,10),5);
  const second={...s,history:[s.season]};
  assert.equal(freeGamesLeft(second),0);assert.equal(costForGames(second,7),7);
  assert.equal(affordableGames(second,0),0);
  assert.equal(gamesLeft(second),seasonGames(second.season));
  assert.equal(costForGames(second,9999),seasonGames(second.season));
  assert.equal(affordableGames(second,500),seasonGames(second.season));
 });

 test('stamina: the play panel shows the three ways to recover and never blocks forever',()=>{
  const s={...initialState(4242),history:[initialState(1).season]};
  const actions={onPlay:()=>{},onBuy:()=>true,onDrink:()=>true,onAdStart:()=>{},onAdReward:()=>{},onAdEnd:()=>{}};
  const html=renderToStaticMarkup(createElement(StaminaPlay,{state:s,busy:false,pawa:true,actions}));
  assert.match(html,/行動力/);assert.match(html,/20試合 進める/);assert.match(html,/行動力 −20/);
  const snap={privacyOptions:false,reward:{available:true,busy:false,left:3,limit:3,points:3000},staminaReward:{left:0,limit:3,points:5},premium:{status:'ready',owned:false,verified:true,price:null,busy:false,message:''}} as MonetizeSnapshot;
  // ブラウザ版(ブリッジ無し)では広告は「アプリ版で使えます」
  assert.doesNotMatch(html,/今日あと/);
  const first=renderToStaticMarkup(createElement(StaminaPlay,{state:initialState(4242),busy:false,pawa:false,actions}));
  assert.match(first,/開幕から20試合は行動力なし/);assert.match(first,/40試合 進める/);
  const emptyView=staminaView(spendStamina(freshStamina(T0),20,T0,free)!,T0+5*MIN,free);
  const out=withBridge(snap,()=>renderToStaticMarkup(createElement(StaminaPlay,{state:s,busy:false,pawa:true,actions,view:emptyView})));
  assert.match(out,/行動力が足りません/);assert.match(out,/7分00秒 で1試合ぶん回復/);
  assert.match(out,/待つ（無料）/);assert.match(out,/広告を見る/);assert.match(out,/ポイントで回復/);
  assert.match(out,/今日あと 0 \/ 3 回/);assert.match(out,/今日は終了/);
  assert.match(out,/1,500 pt で ＋20/);assert.match(out,/プレミアムパスで上限 30/);
  assert.doesNotMatch(out,/試合 進める/);
  const web=renderToStaticMarkup(createElement(StaminaPlay,{state:s,busy:false,pawa:false,actions,view:emptyView}));
  assert.match(web,/アプリ版で使えます/);assert.doesNotMatch(web,/プレミアムパスで上限/);
 });
}

function withBridge<T>(snap:MonetizeSnapshot,fn:()=>T):T{
 const g=globalThis as unknown as {window?:{diamondMonetize?:MonetizeBridge}};
 const before=g.window;
 g.window={diamondMonetize:{snapshot:()=>snap,subscribe:()=>()=>{},buyPremium:async()=>{},restorePremium:async()=>{},showRewardAd:async()=>'failed',showStaminaAd:async()=>'failed',noteScout:()=>{},showInterstitial:async()=>false,claimPremiumDaily:()=>0,showPrivacyOptions:async()=>{}}};
 try{return fn();}finally{if(before===undefined)delete g.window;else g.window=before;}
}
