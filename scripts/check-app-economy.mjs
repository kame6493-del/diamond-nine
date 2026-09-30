// Simulates real seasons with the app economy (iOS + Android) and the browser economy,
// and prints points earned per season for: no purchase / full rewarded ads / premium pass.
// Usage: node scripts/check-app-economy.mjs [seeds=4]
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const seeds=Array.from({length:Number(process.argv[2]??4)},(_,i)=>1000+i*7919);
const entry=`export {initialState,simulateDays,nextSeason} from './src/pro/engine';
export {finishPostseason} from './src/pro/postseason';
export {collectSimpleRewards,SIMPLE_SCOUT_COST} from './src/pro/simple-game';
export {setPremiumMatchBonus,appEdition,PREMIUM_MATCH_MULTIPLIER} from './src/pro/platform-economy';
export {gameReward} from './src/pro/progression';
export {REWARD_AD_POINTS,REWARD_AD_DAILY_LIMIT,PREMIUM_DAILY_POINTS} from './src/pro/monetization';`;
const load=async(app,android)=>{
 const out=resolve(`node_modules/.tmp/app-economy-${app}-${android}.mjs`);
 await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'ts'},outfile:out,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent',
  define:{__DIAMOND_APP__:String(app),__DIAMOND_ANDROID__:String(android)},loader:{'.css':'empty'}});
 return import(pathToFileURL(out).href+`?${app}${android}`);
};
const web=await load(false,false),ios=await load(true,false),android=await load(true,true);
assert.equal(web.appEdition,false);assert.equal(ios.appEdition,true);assert.equal(android.appEdition,true);

// Per-game reward table: browser unchanged, apps 0.8x, premium 0.8x * 2.
for(let stadium=1;stadium<=5;stadium++)for(const [h,a,bonus] of [[4,1,8],[1,1,4],[0,3,0]]){
 const s={club:'t',franchise:{stadium}},g={home:'t',away:'g',homeRuns:h,awayRuns:a},base=18+bonus+stadium-1;
 assert.equal(web.gameReward(s,g),base);
 for(const m of [ios,android]){
  m.setPremiumMatchBonus(false);assert.equal(m.gameReward(s,g),Math.floor(base*.8));
  m.setPremiumMatchBonus(true);assert.equal(m.gameReward(s,g),Math.floor(base*.8*2));m.setPremiumMatchBonus(false);
 }
 web.setPremiumMatchBonus(true);assert.equal(web.gameReward(s,g),base);web.setPremiumMatchBonus(false);
}

function seasons(m,premium,seed){
 m.setPremiumMatchBonus(premium);
 try{
  let s=m.collectSimpleRewards(m.initialState(seed));const out=[];
  for(let n=0;n<2;n++){
   const start=s.gems;
   s=m.collectSimpleRewards(m.finishPostseason(m.simulateDays(s,143)));
   const {w,l}=s.season.standings.find(t=>t.team===s.club);
   out.push({earned:s.gems-start,w,l});
   s=m.collectSimpleRewards(m.nextSeason(s));
  }
  return out;
 }finally{m.setPremiumMatchBonus(false);}
}
const avg=a=>Math.round(a.reduce((x,y)=>x+y,0)/a.length);
const rows=[];
for(const [label,m,premium] of [['browser (unchanged)',web,false],['app: no purchase, no ads',android,false],['app: premium pass',android,true]]){
 const runs=seeds.map(seed=>seasons(m,premium,seed));
 rows.push({label,season1:avg(runs.map(r=>r[0].earned)),season2:avg(runs.map(r=>r[1].earned)),wins:runs.map(r=>r[1].w).join('/')});
}
const cost=android.SIMPLE_SCOUT_COST,adDay=android.REWARD_AD_POINTS*android.REWARD_AD_DAILY_LIMIT;
const table=rows.map(r=>({...r,scouts2:+(r.season2/cost).toFixed(2)}));
const free=rows[1].season2,pass=rows[2].season2;
table.push({label:'app: no purchase + full ads (1 season/day)',season1:rows[1].season1+adDay,season2:free+adDay,wins:'-',scouts2:+((free+adDay)/cost).toFixed(2)});
table.push({label:'app: premium + full ads + login (1 season/day)',season1:rows[2].season1+adDay+android.PREMIUM_DAILY_POINTS,season2:pass+adDay+android.PREMIUM_DAILY_POINTS,wins:'-',scouts2:+((pass+adDay+android.PREMIUM_DAILY_POINTS)/cost).toFixed(2)});
console.table(table);
console.log({seeds,scoutCost:cost,rewardAdsPerDay:adDay,premiumLoginPerDay:android.PREMIUM_DAILY_POINTS});
// Balance targets: free players still fund ~1-1.5 scouts a season; the pass is a clear step up.
assert.ok(free/cost>=1&&free/cost<=1.6,`free season should fund 1-1.5 scouts (got ${free/cost})`);
assert.ok(pass>=free*1.3,'premium must be clearly faster');
assert.ok(adDay>=cost*.9&&adDay<=cost*1.1,'a full day of rewarded ads is about one scout');
console.log('App economy: passed');
