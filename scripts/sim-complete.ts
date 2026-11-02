// 使い方: esbuild で束ねて node で(node_modules/.tmp/comp-real.mjs の元)。引数=シード数。結果は mobile/balance-1103/vc39_1万円でそろうか_300シード.txt
// 実際の drawSimplePlayer で、1万円(30,000,000pt)からそろうまで引く。
import {initialState} from '../src/pro/engine';
import {pickStarterCard,finishStarterScout} from '../src/pro/starter-scout';
import {drawSimplePlayer,SIMPLE_SCOUT_COST} from '../src/pro/simple-game';
import {players} from '../src/pro/data';
import {pointPacks} from '../src/pro/point-products';
const seeds=Number(process.argv[2]??3),budget=pointPacks[pointPacks.length-1].points;
const out:number[]=[];let done=0;const t0=Date.now();
for(let seed=1;seed<=seeds;seed++){
 let s=finishStarterScout(pickStarterCard(initialState(seed*104729),0));
 s={...s,gems:budget,history:[]};
 const total=players.length;let own=Object.keys(s.owned).length;
 while(own<total&&s.gems>=SIMPLE_SCOUT_COST){s=drawSimplePlayer(s);if(s.lastPulls[0].isNew)own++;}
 out.push(own===total?s.pulls:-1);if(own===total)done++;
 console.log('seed',seed,'complete',own===total,'pulls',s.pulls,'owned',own,'left pt',s.gems,'sec',((Date.now()-t0)/1000).toFixed(0));
}
console.log('complete',done,'/',seeds);
