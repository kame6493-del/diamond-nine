// node scripts/sim-gacha-stamina.mjs [ソースのルート=.] [シード数=4] [日数=3]
// ルートの src/pro を @d9/ として束ね、アプリ版(広告・パスのある版)の値で bot を回す。
import {build} from 'esbuild';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';

const root=resolve(process.argv[2]??'.'),here=resolve('.');
const shim=`export {awakeningCosts} from './development';
import {ownedRatings,ratingOverall} from './development';
export const effectiveOverallFor=(p,owned,training)=>ratingOverall(p,ownedRatings(p,owned,training));`;
await mkdir('node_modules/.tmp',{recursive:true});
const out=join(here,'node_modules/.tmp',`sim-gacha-${Date.now()}.mjs`);
await build({entryPoints:[join(here,'scripts/sim-gacha-stamina.ts')],outfile:out,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent',
 define:{__DIAMOND_APP__:'true',__DIAMOND_ANDROID__:'true'},loader:{'.css':'empty'},
 plugins:[{name:'d9',setup(b){
  b.onResolve({filter:/^@d9\/sim-shim$/},()=>({path:'sim-shim',namespace:'d9shim'}));
  b.onLoad({filter:/.*/,namespace:'d9shim'},()=>({contents:shim,loader:'ts',resolveDir:join(root,'src/pro')}));
  b.onResolve({filter:/^@d9\//},a=>({path:join(root,'src/pro',a.path.slice(4)+'.ts')}));
 }}]});
process.argv=[process.argv[0],process.argv[1],process.argv[3]??'4',process.argv[4]??'3'];
await import(pathToFileURL(out).href);
