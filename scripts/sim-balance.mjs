// node scripts/sim-balance.mjs [ソースのルート=.] [シード数=8] [年数=12]
// ルートの src/pro を @d9/ として束ね、アプリ版(広告・パスのある版)の値で bot を回す。
// 前の版と比べる時は、前の版の作業コピー(git worktree)をルートに渡す(年ごとの成長が無い版でも動くよう shim で吸収)。
import {build} from 'esbuild';
import {resolve,join} from 'node:path';
import {existsSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';

const root=resolve(process.argv[2]??'.'),here=resolve('.');
const patching=!!(process.env.D9_SET||process.env.D9_MISSION_SCALE||process.env.D9_POST||process.env.D9_CAPS);
const dev=readFileSync(join(root,'src/pro/development.ts'),'utf8');
const hasYearly=/export function advanceCareerYear/.test(dev);
const shim=`export {awakeningCosts} from './development';
export {REWARD_AD_DAILY_LIMIT,PREMIUM_DAILY_POINTS} from './monetization';
export {setPremiumMatchBonus} from './platform-economy';
import {ownedRatings,ratingOverall${hasYearly?',advanceCareerYear':''}} from './development';
export const effectiveOverallFor=(p,owned,training,state)=>ratingOverall(p,${hasYearly?'ownedRatings(p,owned,training,state.careerGrowth)':'ownedRatings(p,owned,training)'});
export const yearEnd=s=>${hasYearly?'advanceCareerYear(s)':'s'};`;
await mkdir('node_modules/.tmp',{recursive:true});
const out=join(here,'node_modules/.tmp',`sim-balance-${process.pid}-${Date.now()}.mjs`);
await build({entryPoints:[join(here,'scripts/sim-balance.ts')],outfile:out,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent',
 define:{__DIAMOND_APP__:'true',__DIAMOND_ANDROID__:'true'},loader:{'.css':'empty'},
 plugins:[{name:'d9',setup(b){
  b.onResolve({filter:/^@d9\/sim-shim$/},()=>({path:'sim-shim',namespace:'d9shim'}));
  b.onLoad({filter:/.*/,namespace:'d9shim'},()=>({contents:shim,loader:'ts',resolveDir:join(root,'src/pro')}));
  b.onResolve({filter:/^@d9\//},a=>({path:join(root,'src/pro',a.path.slice(4)+'.ts')}));
  // 試しの値(bot だけ。ソースは書き換えない): D9_SET="SEASON_COMPLETE_POINTS=3000,DAILY_LOGIN_POINTS=100"、
  // D9_MISSION_SCALE(今日の目標の各 points)、D9_POST="優勝,準優勝,敗退"、D9_CAPS="打者,先発,救援"(はじめの上限)。
  if(patching)b.onLoad({filter:/src[\\/]pro[\\/][^\\/]+\.ts$/},a=>{
   let t=readFileSync(a.path,'utf8');const f=a.path.replace(/\\/g,'/');
   for(const kv of (process.env.D9_SET??'').split(',').filter(Boolean)){const [k,v]=kv.split('=');t=t.replace(new RegExp(`export const ${k}\\s*=\\s*[^;]+;`),`export const ${k}=${v};`);}
   if(f.endsWith('/daily.ts')&&process.env.D9_MISSION_SCALE){const m=Number(process.env.D9_MISSION_SCALE);t=t.replace(/(label:'[^']*',points:)(\d+)/g,(_,a,n)=>a+Math.round(Number(n)*m));}
   if(f.endsWith('/progression.ts')&&process.env.D9_POST){const [c,fi,l]=process.env.D9_POST.split(',');t=t.replace(/champion \? 500 : finalist \? 250 : 100/,`champion ? ${c} : finalist ? ${fi} : ${l}`);}
   if(f.endsWith('/engine.ts')&&process.env.D9_CAPS){const [bt,st,rp]=process.env.D9_CAPS.split(',');t=t.replace("ratingOverall(p)<=59)",`ratingOverall(p)<=${bt})`).replace("'先発'?64:61",`'先発'?${st}:${rp}`);}
   return {contents:t,loader:'ts'};
  });
 }}]});
process.argv=[process.argv[0],process.argv[1],process.argv[3]??'8',process.argv[4]??'12'];
await import(pathToFileURL(out).href);
