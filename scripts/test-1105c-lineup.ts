// 11/5 昼(vc43 / 1.5.0 のまま)スタメンの1画面の表の試験。持ち主「スタメン野手は画面ひと枠に収まる感じにして」。
// 画面に収まることは撮影(360x640・412x915 で .lu-scroll の scrollHeight<=clientHeight)で確かめる。ここでは並びと操作の決まり。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialSandboxState} from '../src/pro/engine';
import {managedGame} from '../src/pro/managed';
import {benchIn,benchOf,swapOrder,usualOrder,setPosition,sameOrder} from '../src/pro/lineup';
import {StartingLineup} from '../src/pro/StartingLineup';
import {playerMap} from '../src/pro/data';
import {teamColorIn} from '../src/pro/team-colors';

export function register1105cLineupTests(test:(name:string,run:()=>void)=>void){
 test('starting lineup (11/5 昼): one compact row per batter (9 rows), one heading line for ミート/パワー/走力/守備, grades only in the rows, tabs 野手/投手/控え',()=>{
  const state=initialSandboxState(),g=managedGame(state)!;
  const html=renderToStaticMarkup(createElement(StartingLineup,{base:g.base,label:g.label,rival:'相手',onStart:()=>{},onCancel:()=>{}}));
  const order=html.slice(html.indexOf('<ol class="lu-order">'),html.indexOf('</ol>'));
  assert.equal((order.match(/<li class="lu-row/g)??[]).length,9,'9行');
  const head=html.match(/<div class="lu-thead"[^>]*>(.*?)<\/div>/)![1];
  for(const x of ['打順','選手名','守','ミート','パワー','走力','守備','打率'])assert.ok(head.includes(x),x);
  assert.equal((order.match(/class="lu-g"/g)??[]).length,36,'各行に段の1文字が4つ');
  for(const [i,id] of g.base.lineup.entries()){assert.ok(order.includes(`${i+1}番 ${playerMap[id].name}を選ぶ`),playerMap[id].name);}
  for(const t of ['野手','投手','控え'])assert.ok(html.includes(`role="tab"`)&&html.includes(`>${t}<`),t);
  // 詳しい能力と守れる位置は、行の下に閉じた形で入っている(押すと開く)
  assert.equal((order.match(/<div class="lu-detail" hidden="">/g)??[]).length,9,'詳しい所は最初は閉じている');
  // ヘッダーの帯は自分のチームの色
  assert.ok(html.includes(`background:${teamColorIn(g.base,g.base.club).main}`),'帯はチームの色');
  // 投手のタブを開いた形
  const pit=renderToStaticMarkup(createElement(StartingLineup,{base:g.base,label:g.label,rival:'相手',onStart:()=>{},onCancel:()=>{},tab:'pit'}));
  assert.ok(/<section class="lu-sec" aria-label="先発投手">/.test(pit),'投手のタブが見える');
  // 字は 11px 未満にしない
  const css=readFileSync('src/pro/lineup.css','utf8');
  for(const m of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(m[1])>=11,`字の大きさ ${m[1]}px`);
 });
 test('starting lineup (11/5 昼): swapping the order and taking a bench player work as before',()=>{
  const state=initialSandboxState(),g=managedGame(state)!,base=g.base,o=usualOrder(base);
  const s=swapOrder(o,0,3);assert.equal(s.lineup[0],o.lineup[3]);assert.equal(s.lineup[3],o.lineup[0]);assert.equal(s.lineup.length,9);
  assert.ok(sameOrder(swapOrder(s,0,3),o),'もう一度入れ替えると元どおり');
  const bench=benchOf(base,o);assert.ok(bench.length>0,'控えがいる');
  const b=benchIn(o,2,bench[0]);assert.equal(b.lineup[2],bench[0]);assert.equal(b.defense[bench[0]],o.defense[o.lineup[2]],'控えは抜けた選手の守備位置へ');
  assert.ok(!b.lineup.includes(o.lineup[2]));
  const id=o.lineup[0],p=setPosition(o,id,'外');assert.equal(p.defense[id],'外');
 });
}
