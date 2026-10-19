import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/pro/engine';
import {seasonGames} from '../src/pro/leagues';
import {dailyLeft,localDay,parseDaily,spendDaily,type MonetizeBridge,type MonetizeSnapshot} from '../src/pro/monetization';
import {
 DRINK_RESTORE,FREE_SEASONS,PASS_STAMINA_MAX,PASS_STAMINA_REGEN_MS,SEASON_COST,STAMINA_AD_DAILY_LIMIT,STAMINA_AD_POINTS,STAMINA_HARD_CAP,
 STAMINA_MAX,STAMINA_PT_COST,STAMINA_REGEN_MS,WARMUP_PULLS,addStamina,canBuyWithPoints,claimDrinkGift,costToFinish,currentRules,
 freshStamina,fullAt,gamesLeft,loadStamina,parseStamina,seasonCost,setStaminaPass,settle,spendStamina,staminaRules,staminaStage,staminaView,useDrink,
} from '../src/pro/stamina';
import {StaminaPlay} from '../src/pro/StaminaPanel';
import {PremiumPassCard} from '../src/pro/MonetizePanel';
import {SEASON_COMPLETE_POINTS,SUPPORT_STEPS,gameReward,postseasonReward,seasonReward,supportPoints} from '../src/pro/progression';
import {seasonGoals} from '../src/pro/ambitions';
import {DAILY_ALL_BONUS,DAILY_LOGIN_POINTS,DAILY_MISSIONS} from '../src/pro/daily';
import {PREMIUM_MATCH_MULTIPLIER} from '../src/pro/platform-economy';

const MIN=60000,T0=Date.UTC(2026,9,19,3,0,0);
const free=staminaRules(false),pass=staminaRules(true);

export function registerStaminaTests(test:(name:string,run:()=>void)=>void){
 test('stamina: limits and regeneration are the documented numbers; waiting always refills a year',()=>{
  assert.deepEqual(free,{max:30,regenMs:3*MIN});
  assert.deepEqual(pass,{max:40,regenMs:2*MIN});
  assert.equal(STAMINA_PT_COST,4000);assert.equal(STAMINA_AD_POINTS,10);assert.equal(STAMINA_AD_DAILY_LIMIT,3);assert.equal(DRINK_RESTORE,10);
  assert.deepEqual(SEASON_COST,{warmup:5,NPB:10,MLB:12,SPACE:15});
  // 国内の1年(10)は30分で戻る。満タンなら3年続けて進められる。
  assert.equal(SEASON_COST.NPB*STAMINA_REGEN_MS,30*MIN);
  assert.equal(Math.floor(STAMINA_MAX/SEASON_COST.NPB),3);
  // どの段階の1年も上限以下(待てば必ず1年進める)
  for(const c of Object.values(SEASON_COST))assert.ok(c<=STAMINA_MAX);
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
  assert.equal(spendStamina(full,31,T0,free),null);
  assert.equal(spendStamina(full,-1,T0,free),null);
  const used=spendStamina(full,30,T0,free)!;assert.equal(used.points,0);
  assert.equal(settle(used,T0+2*MIN,free).points,0);
  assert.equal(settle(used,T0+3*MIN,free).points,1);
  assert.equal(settle(used,T0+15*MIN+30000,free).points,5);
  // 端数の時間は次へ持ち越す
  const partial=settle(used,T0+7*MIN,free);assert.equal(partial.points,2);assert.equal(settle(partial,T0+9*MIN,free).points,3);
  assert.equal(settle(used,T0+24*60*MIN,free).points,STAMINA_MAX);
  const v=staminaView(used,T0+1*MIN,free);assert.equal(v.nextInMs,2*MIN);assert.equal(v.fullInMs,2*MIN+29*3*MIN);
  assert.equal(fullAt(used,T0,free),T0+30*3*MIN);assert.equal(fullAt(full,T0,free),null);
  // 満タンの間は貯まらない(満タンで放置した時間は後で回復に数えない)
  const idle=settle(full,T0+5*60*MIN,free);const after=spendStamina(idle,1,T0+5*60*MIN,free)!;
  assert.equal(settle(after,T0+5*60*MIN+2*MIN,free).points,29);
 });

 test('stamina: turning the clock back never recovers, and a forward-then-back trick freezes recovery',()=>{
  const used=spendStamina(freshStamina(T0),20,T0,free)!;
  const seen=settle(used,T0+6*MIN,free);assert.equal(seen.points,12);
  // 1日戻す: 回復しない
  assert.equal(settle(seen,T0-24*60*MIN,free).points,12);
  assert.equal(staminaView(seen,T0,free).frozen,true);
  assert.equal(staminaView(seen,T0+5*MIN,free).points,12);
  // 進めて満タン→戻して使う→前回の時刻に追いつくまで回復しない
  const ahead=settle(used,T0+24*60*MIN,free);assert.equal(ahead.points,30);
  const spent=spendStamina(ahead,30,T0+60*MIN,free)!;assert.equal(spent.points,0);
  assert.equal(settle(spent,T0+23*60*MIN,free).points,0);
  assert.equal(settle(spent,T0+24*60*MIN+3*MIN,free).points,1);
  // 時計が戻っていても、ドリンク・広告・pt の回復と消費はできる(待つ以外は時計に関係しない)
  assert.equal(addStamina(spent,5,T0+2*60*MIN,free).points,5);
 });

 test('stamina: points refill, drinks, gifts and the hard cap',()=>{
  const empty=spendStamina(freshStamina(T0),30,T0,free)!;
  assert.equal(canBuyWithPoints(empty,STAMINA_PT_COST-1,T0,free),false);
  assert.equal(canBuyWithPoints(empty,STAMINA_PT_COST,T0,free),true);
  const bought=addStamina(empty,free.max,T0,free);assert.equal(bought.points,30);
  // 上限を超えて持てる(無駄にしない)。超えている間は時間では増えない。
  const over=addStamina(bought,free.max,T0,free);assert.equal(over.points,60);assert.equal(settle(over,T0+600*MIN,free).points,60);
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
  assert.equal(used.points,10);
  assert.equal(settle(used,T0+20*MIN,pass).points,20);
  assert.equal(settle(used,T0+20*MIN,free).points,16);
  assert.equal(settle(used,T0+24*60*MIN,pass).points,PASS_STAMINA_MAX);
  assert.equal(PASS_STAMINA_REGEN_MS<STAMINA_REGEN_MS,true);
  setStaminaPass(true);assert.deepEqual(currentRules(),pass);setStaminaPass(false);assert.deepEqual(currentRules(),free);
  const snap={privacyOptions:false,reward:{available:true,busy:false,left:3,limit:3,points:3000},premium:{status:'ready',owned:false,verified:true,price:'¥480',busy:false,message:''}} as MonetizeSnapshot;
  const html=withBridge(snap,()=>renderToStaticMarkup(createElement(PremiumPassCard)));
  assert.match(html,/行動力の上限 30→40、回復 3分→2分ごと/);
 });

 test('stamina: stages - free first seasons, a half-price warm-up, then 10 a year, more in the upper leagues',()=>{
  const base=initialState(4242);
  const at=(number:number,pulls:number,circuit?:'MLB'|'SPACE')=>({...base,pulls,season:{...base.season,number,...(circuit?{circuit,club:base.club}:{})}});
  assert.equal(FREE_SEASONS,3);assert.equal(WARMUP_PULLS,10);
  for(const n of [1,2,3]){assert.equal(staminaStage(at(n,0)),'free');assert.equal(seasonCost(at(n,50)),0);}
  assert.equal(staminaStage(at(4,9)),'warmup');assert.equal(seasonCost(at(4,9)),5);
  assert.equal(staminaStage(at(4,10)),'mid');assert.equal(seasonCost(at(4,10)),10);
  assert.equal(staminaStage(at(9,3,'MLB')),'late');assert.equal(seasonCost(at(9,3,'MLB')),12);
  assert.equal(seasonCost(at(20,80,'SPACE')),15);
  // 試合を進めるのは「1年進める」だけ。途中まで進んだ年でも1年ぶん、終わった年は0。
  const mid=at(5,30),G=seasonGames(mid.season);
  assert.equal(costToFinish(mid),10);assert.equal(costToFinish(at(1,0)),0);
  const half={...mid,season:{...mid.season,day:72}};assert.equal(costToFinish(half),10);
  const done={...mid,season:{...mid.season,day:G,completed:true}};assert.equal(costToFinish(done),0);assert.equal(gamesLeft(done),0);
  const late=at(9,3,'MLB');assert.equal(costToFinish(late),12);
 });

 test('stamina: the play panel keeps the one-tap year and shows the three ways to recover',()=>{
  const base=initialState(4242);
  const s={...base,pulls:20,season:{...base.season,number:5}};
  const actions={onPlay:()=>{},onBuy:()=>true,onDrink:()=>true,onAdStart:()=>{},onAdReward:()=>{},onAdEnd:()=>{}};
  const html=renderToStaticMarkup(createElement(StaminaPlay,{state:s,busy:false,pawa:true,actions}));
  assert.match(html,/1年進める/);assert.match(html,/行動力 −10/);assert.match(html,/1年進める ＝ 行動力 <b>10<\/b>/);
  assert.doesNotMatch(html,/行動力が足りません/);
  const first=renderToStaticMarkup(createElement(StaminaPlay,{state:base,busy:false,pawa:false,actions}));
  assert.match(first,/3シーズン目までは行動力を使いません（あと3シーズン）/);assert.match(first,/行動力を使わない/);
  const snap={privacyOptions:false,reward:{available:true,busy:false,left:3,limit:3,points:3000},staminaReward:{left:0,limit:3,points:10},premium:{status:'ready',owned:false,verified:true,price:null,busy:false,message:''}} as MonetizeSnapshot;
  const lowView=staminaView({...freshStamina(T0),points:4,at:T0,seen:T0},T0+1*MIN,free);
  const out=withBridge(snap,()=>renderToStaticMarkup(createElement(StaminaPlay,{state:s,busy:false,pawa:true,actions,view:lowView})));
  assert.match(out,/行動力が足りません/);assert.match(out,/あと 17分00秒 で1年ぶん（10）がたまります/);
  assert.match(out,/待つ（無料）/);assert.match(out,/広告を見る/);assert.match(out,/ポイントで回復/);
  assert.match(out,/今日あと 0 \/ 3 回/);assert.match(out,/今日は終了/);
  assert.match(out,/4,000 pt で ＋30/);assert.match(out,/プレミアムパスで上限 40/);
  // 細かく進めるボタンは無い(1年進めるだけ)
  for(const h of [html,out])assert.doesNotMatch(h,/1試合<|進められる所まで|st-one|st-part/);
  assert.match(out,/disabled=""[^>]*>[^]*?1年進める/);
  const web=renderToStaticMarkup(createElement(StaminaPlay,{state:s,busy:false,pawa:false,actions,view:lowView}));
  assert.match(web,/アプリ版で使えます/);assert.doesNotMatch(web,/プレミアムパスで上限/);
 });
}

export function registerEconomyTests(test:(name:string,run:()=>void)=>void){
 test('economy: auto income per season is small, support is generous while few scouts, manual daily goals are bigger',()=>{
  const s=initialState(4242);
  assert.equal(SEASON_COMPLETE_POINTS,50);
  assert.deepEqual(SUPPORT_STEPS.map(x=>[x.under,x.points]),[[10,6000],[25,3000],[40,1500]]);
  for(const [pulls,pts] of [[0,6000],[9,6000],[10,3000],[24,3000],[25,1500],[39,1500],[40,0],[400,0]] as const)assert.equal(supportPoints({...s,pulls}),pts);
  assert.equal(seasonReward({...s,pulls:0}),6050);assert.equal(seasonReward({...s,pulls:80}),50);
  // 12シーズン目まで。引かずにためても13年目からは無し。
  assert.equal(supportPoints({...s,pulls:0,season:{...s.season,number:12}}),6000);assert.equal(supportPoints({...s,pulls:0,season:{...s.season,number:13}}),0);
  assert.deepEqual([postseasonReward(s,true,true),postseasonReward(s,false,true),postseasonReward(s,false,false)],[150,60,30]);
  const goals=seasonGoals(s).reduce((n,g)=>n+g.reward,0);assert.equal(goals,400);
  assert.equal(DAILY_MISSIONS.length,5);assert.equal(DAILY_LOGIN_POINTS+DAILY_MISSIONS.reduce((n,m)=>n+m.points,0)+DAILY_ALL_BONUS,2000);
  // pt で行動力を買い続けても増えない: 強いチーム(全勝・優勝・目標全部・パス)でも、満タンぶん(国内3年)で入る自動のポイントは回復の値段より少ない
  const win={home:s.club,away:'g',homeRuns:5,awayRuns:0} as never;
  const perSeasonMax=Math.floor(gameReward(s,win)*PREMIUM_MATCH_MULTIPLIER)*143+SEASON_COMPLETE_POINTS+150+goals;
  assert.ok(perSeasonMax*3<STAMINA_PT_COST,`${perSeasonMax*3}`);
 });
}

function withBridge<T>(snap:MonetizeSnapshot,fn:()=>T):T{
 const g=globalThis as unknown as {window?:{diamondMonetize?:MonetizeBridge}};
 const before=g.window;
 g.window={diamondMonetize:{snapshot:()=>snap,subscribe:()=>()=>{},buyPremium:async()=>{},restorePremium:async()=>{},showRewardAd:async()=>'failed',showStaminaAd:async()=>'failed',noteScout:()=>{},showInterstitial:async()=>false,claimPremiumDaily:()=>0,showPrivacyOptions:async()=>{}}};
 try{return fn();}finally{if(before===undefined)delete g.window;else g.window=before;}
}
