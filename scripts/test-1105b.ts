// 11/5 朝の直し(vc43 / 1.5.0 のまま)の試験。持ち主「スタメン選ぶ際に、ミート・パワー・走力とか、どのアルファベットがどれを示してるか分からない。
// 選手のポジション適性がわからない。投手も同じ」「終わったあとに『結果を残して次へ』とかいらない。『次へ』でいい」「捕手・バッターの向きがおかしい」。
// 1) 能力の段には必ず項目名と棒が付く(打者 ミート・パワー・走力・守備、投手 球速・制球・スタミナ・変化)、「S が最高、G が最低」の目安。
// 2) 守れる位置の適性(◎本職 ○ △ ×)と、投手の先発・中継ぎ・抑えの適性と利き腕。 3) 試合終了のボタンは「次へ」だけ。 4) 打者・捕手の後ろ姿のコマ。
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialSandboxState} from '../src/pro/engine';
import {managedGame} from '../src/pro/managed';
import {posFit,posFitLine,roleFits,benchOf} from '../src/pro/lineup';
import {StartingLineup} from '../src/pro/StartingLineup';
import {AbilityTag,VelocityTag,GRADE_GUIDE} from '../src/pro/AbilityTag';
import {ATLAS} from '../src/pro/sprite-atlas';
import {fitsPosition,playerMap,players} from '../src/pro/data';

export function register1105bTests(test:(name:string,run:()=>void)=>void){
 test('ability labels (11/5 朝): every grade on the starting lineup carries its name and a bar; batters ミート/パワー/走力/守備, pitchers 球速/制球/スタミナ; S が最高 G が最低',()=>{
  const state=initialSandboxState(),g=managedGame(state)!;
  const html=renderToStaticMarkup(createElement(StartingLineup,{base:g.base,label:g.label,rival:'相手',onStart:()=>{},onCancel:()=>{}}));
  assert.ok(html.includes(GRADE_GUIDE)&&GRADE_GUIDE.includes('S が最高')&&GRADE_GUIDE.includes('G が最低'),'目安の1行');
  const esc=(x:string)=>x.replace(/[()]/g,m=>'['+m+']');
  const tag=(label:string)=>(html.match(new RegExp('<small>'+esc(label)+'[^<]*</small><b[^>]*>(S[+]|[SABCDEFG])</b><i[^>]*><u style="width:[0-9.]+%;background:#[0-9a-f]{6}"','g'))??[]).length;
  for(const x of ['ミート','パワー','走力'])assert.ok(tag(x)>=9,`${x} が9人分(項目名・段・棒) ${tag(x)}`);
  assert.ok(tag('守備')>=9,'守備(位置)も9人分');
  for(const x of ['制球','スタミナ'])assert.ok(tag(x)>=5,`${x} が先発の候補に付く`);
  assert.ok((html.match(/<small>球速<\/small><b[^>]*>\d+<em>km<\/em>/g)??[]).length>=5,'球速は km の数');
  assert.ok(!/class="pw-rank"/.test(html),'項目名の無い段の札は使わない');
  const a=renderToStaticMarkup(createElement(AbilityTag,{label:'ミート',v:65}));assert.ok(a.includes('<small>ミート</small>')&&a.includes('>C</b>')&&a.includes('width:65%'));
  const v=renderToStaticMarkup(createElement(VelocityTag,{kmh:151,id:g.base.pitchers[0]}));assert.ok(v.includes('151<em>km</em>'));
  // 試合の画面の相手チーム・交代も、略さない項目名と目安
  const w=readFileSync('src/pro/WatchScreen.tsx','utf8');
  for(const x of ['<th>ミート</th>','<th>パワー</th>','<th>走力</th>','<th>守備</th>','<th>スタミナ</th>','<small>守備</small>{gradeBadge(g)}'])assert.ok(w.includes(x),x);
  assert.ok(!w.includes('ミ=ミート')&&(w.match(/GRADE_GUIDE/g)??[]).length>=3,'略した凡例は無く、目安が出る');
 });
 test('position aptitude (11/5 朝): each player shows where he can play (◎ main, ○, △) and a picked position says 本職ではありません; pitchers show 先発/中継ぎ/抑え and 右投/左投',()=>{
  const state=initialSandboxState(),g=managedGame(state)!,base=g.base;
  for(const id of base.lineup){const p=playerMap[id];if(base.defense[id]==='DH')continue;
   const line=posFitLine(id);assert.ok(line.length>=1&&line[0].mark==='◎'&&line[0].main,`${p.name} は本職が先頭で◎`);
   for(const f of line)assert.ok(fitsPosition(p,f.pos),'× の位置は一覧に出さない');}
  // 守れない位置は × と「本職ではありません」、守れるが本職でない位置も「本職ではありません」
  const of=players.find(p=>p.role==='batter'&&p.positions.length===1&&p.positions[0]==='外')!;
  assert.equal(posFit(of.id,'外').mark,'◎');assert.equal(posFit(of.id,'外').text,'本職');
  const c=posFit(of.id,'捕');assert.equal(c.mark,'×');assert.ok(c.text.includes('本職ではありません'));
  const multi=players.find(p=>p.role==='batter'&&p.positions.length>=2&&p.positions[0]!==p.positions[1]&&!p.positions.includes('内'))!;
  const sub=posFit(multi.id,multi.positions[1]);assert.ok(sub.mark==='○'||sub.mark==='△');assert.ok(sub.text.includes('本職ではありません'));
  // 投手の役割: 3つ、どの投手も少なくとも1つは ◎ か ○
  for(const id of base.pitchers.slice(0,8)){const r=roleFits(id);assert.deepEqual(r.map(x=>x.name),['先発','中継ぎ','抑え']);assert.ok(r.some(x=>x.mark==='◎'||x.mark==='○'),playerMap[id].name);}
  const html=renderToStaticMarkup(createElement(StartingLineup,{base,label:g.label,rival:'相手',onStart:()=>{},onCancel:()=>{}}));
  assert.ok((html.match(/class="lu-fits"/g)??[]).length>=9+benchOf(base,{lineup:base.lineup,defense:base.defense,pitchers:base.pitchers}).length-1,'打順と控えに守れる位置');
  assert.ok((html.match(/class="lu-fits is-roles"/g)??[]).length===6,'先発の候補6人に役割の適性');
  for(const x of ['先発','中継ぎ','抑え','◎','本職'])assert.ok(html.includes(x),x);
  assert.ok(/[右左]投 防御率/.test(html),'利き腕');
  // 守備位置を選ぶ所: 選んだ位置の適性を大きく出す部品がある
  const src=readFileSync('src/pro/StartingLineup.tsx','utf8');assert.ok(src.includes('lu-posbig')&&src.includes("'本職です'"),'選んだ位置の大きな適性');
 });
 test('end of game (11/5 朝): the button is just 次へ, no long sentence buttons such as 結果を残して次へ',()=>{
  const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(`${dir}/${d.name}`):/\.(tsx|ts)$/.test(d.name)?[`${dir}/${d.name}`]:[]);
  for(const f of walk('src')){const t=readFileSync(f,'utf8');assert.ok(!t.includes('結果を残して次へ'),f);}
  const w=readFileSync('src/pro/WatchScreen.tsx','utf8');
  assert.ok(w.includes('<button className="wt-gold" onClick={finish}>次へ</button>'),'試合終了は「次へ」');
  assert.ok(!w.includes('この作戦で続ける'));
  const app=readFileSync('src/pro/SimpleApp.tsx','utf8');assert.ok(!app.includes('このシリーズの残りを一気に進める</button>')&&!app.includes('この試合を最初からやり直す</button>'));
 });
 test('sprites (11/5 朝): batter and catcher frames are the back views seen from behind the plate; the catcher back view is never mirrored',()=>{
  for(const f of ['bat_stance','bat_stride','bat_contact','bat_miss','bat_follow','bat_bunt','catch_crouch','catch_catch','catch_throw'] as const)assert.ok(ATLAS.frames[f],f);
  const fc=readFileSync('src/pro/FieldCanvas.tsx','utf8');
  assert.ok(fc.includes("frame:'catch_catch'")&&fc.includes("!d.frame?.startsWith('catch_')"),'捕手は後ろ姿・左右を返さない');
  assert.ok(fc.includes("s.leftyBat"),'左打者は左右を返す');
 });
}
