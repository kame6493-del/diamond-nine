// 使い方: esbuild で束ねて node で。引数=シード数。結果は mobile/balance-1103/(vc39_1万円でそろうか_300シード.txt・vc41/)
// 実際の drawSimplePlayer で、1万円(30,000,000pt)からそろうまで引く。
// 2026-11-03 vc41: UNLIMITED=1 で ポイントの上限なしに、そろうまで引く(そろうのに要った回数と、重なりの換金を引いた正味のポイントを出す)。
// はじめの3人は初期の作り(createStarterScout)のまま、1枚目を選ぶ。
import {initialState} from '../src/pro/engine';
import {pickStarterCard,finishStarterScout} from '../src/pro/starter-scout';
import {drawSimplePlayer,SIMPLE_SCOUT_COST} from '../src/pro/simple-game';
import {players} from '../src/pro/data';
import {pointPacks} from '../src/pro/point-products';
const seeds=Number(process.argv[2]??3),unlimited=process.env.UNLIMITED==='1',budget=unlimited?3_000_000_000:pointPacks[pointPacks.length-1].points;
const pulls:number[]=[],net:number[]=[];let done=0;const t0=Date.now();
for(let seed=1;seed<=seeds;seed++){
 let s=finishStarterScout(pickStarterCard(initialState(seed*104729),0));
 s={...s,gems:budget,history:[]};
 const total=players.length;let own=Object.keys(s.owned).length;
 while(own<total&&s.gems>=SIMPLE_SCOUT_COST){s=drawSimplePlayer(s);if(s.lastPulls[0].isNew)own++;}
 if(own===total){done++;pulls.push(s.pulls);net.push(budget-s.gems);}
 console.log('seed',seed,'complete',own===total,'pulls',s.pulls,'owned',own,'net pt',budget-s.gems,'sec',((Date.now()-t0)/1000).toFixed(0));
}
const q=(xs:number[],p:number)=>{const v=[...xs].sort((a,b)=>a-b);return v.length?v[Math.min(v.length-1,Math.floor(v.length*p))]:NaN;};
console.log('complete',done,'/',seeds);
console.log('pulls p10/p50/p90',q(pulls,.1),q(pulls,.5),q(pulls,.9));
console.log('net pt p50/p80/p90',q(net,.5),q(net,.8),q(net,.9));
