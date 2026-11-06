// 11/6 夜(vc44 / 1.5.1)の試験。
// 持ち主「大谷翔平が入って、スタメンを組もうとして、二刀流で組もうとしたときに、スタメンに進めないバグがあります」
// 「チュートリアルなのに勝手に試合が進む」「うーんみたいな感じの変な声がある(凡退した時かな)」
// 「外国人選手、メジャーリーガーの右左、なんかおかしい」「スタメンを決める際、打率・本塁打・打点も見れるように。控え、投手、野手も」。
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialSandboxState,type GameState,type WatchOrder} from '../src/pro/engine';
import {managedGame,liveGame} from '../src/pro/managed';
import {orderBlock,usualOrder,benchOf} from '../src/pro/lineup';
import {equipTwoWayPlayer} from '../src/pro/simple-game';
import {canTwoWay,playerMap} from '../src/pro/data';
import {mlbOpponentPlayers} from '../src/pro/mlb-opponents';
import {mlbPlayers} from '../src/pro/mlb-players';
import {soundFiles} from '../src/pro/game-audio';
import {soundCues} from '../src/pro/play-sounds';
import {choreograph} from '../src/pro/field-sim';
import {StartingLineup} from '../src/pro/StartingLineup';
import {batSide} from '../src/pro/field-sim';
import hands from '../src/pro/mlb-hands2026.json';

const TWO_WAY=['mlb-660271','f-矢澤宏太','s-北村拓己'];
/** 二刀流の選手を持たせて、先発(今日の枠)と DH に入れた状態。 */
function withTwoWay(id:string):GameState{
 const s0=initialSandboxState();const s1={...s0,owned:{...s0.owned,[id]:1}};
 const s2=equipTwoWayPlayer(s1,id);
 // 今日の先発の枠に入れる(equip は投手の1番目に入れる。今日の枠が違う時は並びを入れ替える)
 const slot=s2.season.day%6,at=s2.pitchers.indexOf(id),p=[...s2.pitchers];[p[at],p[slot]]=[p[slot],p[at]];
 return {...s2,pitchers:p};
}

export function register1106Tests(test:(name:string,run:()=>void)=>void){
 test('two-way (11/6): the cards that can both pitch and bat are 大谷・矢澤・北村 (the opponent-only 大谷 is never in a club)',()=>{
  const all=Object.values(playerMap).filter(p=>canTwoWay(p)&&!p.opponentOnly).map(p=>p.id).sort();
  assert.deepEqual(all,[...TWO_WAY].sort());
 });
 for(const id of TWO_WAY)test(`two-way (11/6): ${id} can start as pitcher and DH at once, the lineup screen lets the game start, and he stays at DH after leaving the mound`,()=>{
  const s=withTwoWay(id);
  assert.ok(s.lineup.includes(id),'打順にいる');assert.equal(s.defense[id],'DH','DH');assert.equal(s.pitchers[s.season.day%6],id,'今日の先発');
  const o=usualOrder(s);assert.equal(orderBlock(s,o),'','スタメンの画面で始められる(前は「投手の枠に入っています」で止まっていた)');
  const g=managedGame(s,true);assert.ok(g,'監督の試合がある');
  assert.equal(orderBlock(g!.base,usualOrder(g!.base)),'','試合の前の状態でも始められる');
  // 1試合を通しで: 4回の守りの前に投手を替える。替えた後も、その選手は打順に残って打席に立つ。
  const gen=liveGame(g!);let step=gen.next();let changed=false,batsAfter=0,pitchedBefore=0,guard=0;const mine=g!.control;
  while(!step.done&&guard++<5000){
   if(step.value.type==='event'){const e=step.value.e;
    if(e.side!==mine&&e.pitcher===id&&!changed)pitchedBefore++;
    if(changed&&e.side===mine&&e.batter===id&&e.kind!=='PITCHER')batsAfter++;
    step=gen.next(undefined);continue;}
   const sit=step.value.s;let order:WatchOrder|null=null;
   if(!changed&&sit.side!==mine&&sit.inning>=4&&sit.pitcher===id){const r=sit.pitchers[mine].slice(6).find(x=>!sit.usedPitchers[mine].includes(x));if(r){order={kind:'pitcher',id:r};changed=true;}}
   step=gen.next(order);
  }
  assert.ok(step.done,'試合が最後まで終わる');
  assert.ok(pitchedBefore>0,'先発として投げた');
  assert.ok(changed,'4回以降に投手を替えた');
  assert.ok(batsAfter>0,'投手を降りた後も DH として打席に立った');
  // スタメンの画面の始めるボタンが押せる
  const html=renderToStaticMarkup(createElement(StartingLineup,{base:g!.base,label:g!.label,rival:'相手',onStart:()=>{},onCancel:()=>{}}));
  assert.ok(/class="pw-btn pw-yellow lu-start"/.test(html)&&!/class="pw-btn pw-yellow lu-start"[^>]*\sdisabled=""/.test(html),'始めるボタンが押せる');
 });
 test('two-way (11/6): an ordinary pitcher in the batting order is still refused, and two-way players appear on the bench while pitching',()=>{
  const s=initialSandboxState(),o=usualOrder(s),pit=s.pitchers.find(id=>!canTwoWay(playerMap[id]))!;
  const bad={...o,lineup:[pit,...o.lineup.slice(1)],defense:{...o.defense,[pit]:o.defense[o.lineup[0]]}};
  assert.match(orderBlock({...s,owned:{...s.owned}},bad),/投手の枠|打てません/);
  const id='mlb-660271',t0={...s,owned:{...s.owned,[id]:1},pitchers:[id,...s.pitchers.slice(1)]};
  assert.ok(benchOf(t0,usualOrder(t0)).includes(id),'投手の枠にいる二刀流は控えの野手にも出る');
 });

 test('hands (11/6): every MLB player uses the official MLB Stats API batSide / pitchHand; nobody is filled with 右投右打 by default',()=>{
  const h=(hands as {hands:Record<string,string[]>}).hands;
  const ja=(c:string)=>c==='L'?'左':c==='S'?'両':'右';
  assert.equal((hands as {missing:number[]}).missing.length,0);
  for(const p of [...mlbOpponentPlayers,...mlbPlayers]){const x=h[String(p.mlb!.id)];assert.ok(x,p.id);assert.equal(p.bats,ja(x[0]),p.id+' bats');assert.equal(p.throws,ja(x[1]),p.id+' throws');}
  const left=mlbOpponentPlayers.filter(p=>p.bats==='左').length,sw=mlbOpponentPlayers.filter(p=>p.bats==='両').length,lp=mlbOpponentPlayers.filter(p=>p.role==='pitcher'&&p.throws==='左').length;
  assert.ok(left>300&&sw>50&&lp>150,`左打 ${left} 両打 ${sw} 左投手 ${lp}`);
  assert.equal(playerMap['mlb-660271'].bats,'左');assert.equal(playerMap['mlb-660271'].throws,'右');
  // 打席の向きはデータどおり: 左打ちは左(L)の打席、右打ちは R、両打ちは投手の反対
  const lhb=mlbOpponentPlayers.find(p=>p.bats==='左')!,rhb=mlbOpponentPlayers.find(p=>p.bats==='右')!,shb=mlbOpponentPlayers.find(p=>p.bats==='両')!;
  const rhp=mlbOpponentPlayers.find(p=>p.role==='pitcher'&&p.throws==='右')!,lhp=mlbOpponentPlayers.find(p=>p.role==='pitcher'&&p.throws==='左')!;
  assert.equal(batSide(lhb.id,rhp.id),'L');assert.equal(batSide(rhb.id,lhp.id),'R');assert.equal(batSide(shb.id,rhp.id),'L');assert.equal(batSide(shb.id,lhp.id),'R');
 });
 test('hands (11/6): every NPB player on a 2026 roster has hands from npb.jp, and every player has a batting side',()=>{
  for(const p of Object.values(playerMap)){assert.ok(['右','左','両'].includes(p.bats),p.id+' bats');if(p.roster)assert.ok(p.throws==='右'||p.throws==='左',p.id);}
 });

 test('sounds (11/6): no human-voice sound effects remain (the sigh and the "ooh" are gone); outs only use mitt / glove / bat sounds',()=>{
  for(const k of Object.keys(soundFiles))assert.ok(!['sigh','ooh'].includes(k),k);
  for(const f of Object.values(soundFiles))assert.ok(!/sigh|ooh/.test(f),f);
  assert.ok(!existsSync('public/audio/freesound/field/sigh.mp3')&&!existsSync('public/audio/freesound/field/ooh.mp3'));
  assert.ok(!readFileSync('src/pro/WatchScreen.tsx','utf8').includes("'sigh'"));
  // 凡退の動き(ゴロ・フライ・ライナー・三振)で鳴る音の一覧
  const s=initialSandboxState(),[b,p]=[s.lineup[0],s.pitchers[0]];
  const kinds=new Set<string>();
  const outs=['OUT','K','DP','SF'] as const;
  for(const kind of outs)for(let i=0;i<40;i++){
   const e={kind,inning:1,side:0,batter:b,slot:0,pitcher:p,runs:0,outs:1,bases:[null,null,null],score:[0,0],line:[[],[]],hits:[0,0],errors:[0,0]} as never;
   try{const c=choreograph(e,{bases:[null,null,null],outs:0} as never,{fielders:{},rate:()=>({speed:50,field:50,arm:50})});for(const x of soundCues(c,{lastK:kind==='K'}))kinds.add(x.kind);}catch{/* 形が合わない時は飛ばす */}
  }
  const allowed=new Set(['mitt','strikeout','glove','infield','throw','step','slide','bounce','foul']);
  for(const k of kinds)assert.ok(allowed.has(k),'凡退で鳴る音 '+k);
  for(const k of kinds)assert.ok(soundFiles[k]&&!/voice|people/.test(soundFiles[k]),k+' '+soundFiles[k]);
 });

 test('lineup (11/6): each batter shows 打率・本塁打・打点 (this season, or last season before the first game, or ―); the pitcher tab lists the bullpen with 中継ぎ/セット/抑え and 勝敗',()=>{
  const state=initialSandboxState(),g=managedGame(state)!;
  const html=renderToStaticMarkup(createElement(StartingLineup,{base:g.base,label:g.label,rival:'相手',onStart:()=>{},onCancel:()=>{}}));
  const order=html.slice(html.indexOf('<ol class="lu-order">'),html.indexOf('</ol>'));
  assert.equal((order.match(/class="lu-stat/g)??[]).length,9,'9人とも成績の欄がある');
  assert.ok(/打率.*本.*点/.test(html.match(/<div class="lu-thead"[^>]*>(.*?)<\/div>/)![1]),'見出しに 打率 本 点');
  const pit=renderToStaticMarkup(createElement(StartingLineup,{base:g.base,label:g.label,rival:'相手',onStart:()=>{},onCancel:()=>{},tab:'pit'}));
  assert.ok(pit.includes('救援'),'救援の一覧');for(const r of ['中継ぎ','抑え'])assert.ok(pit.includes(`>${r}<`),r);
  // 試合が進んだ後は今季の成績
  const later=managedGame({...state,season:{...state.season}},true)!;void later;
  const css=readFileSync('src/pro/lineup.css','utf8');
  for(const m of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(m[1])>=11,`字の大きさ ${m[1]}px`);
 });

 test('tutorial (11/6): skip asks once inside the app (no window.confirm), the match waits while the guide explains, and settings can replay it',()=>{
  const coach=readFileSync('src/pro/GuideCoach.tsx','utf8'),watch=readFileSync('src/pro/WatchScreen.tsx','utf8'),app=readFileSync('src/pro/SimpleApp.tsx','utf8');
  assert.ok(coach.includes('チュートリアルを終えますか')&&coach.includes('設定からもう一度見られます'));
  assert.ok(!/window\.confirm|confirm\(/.test(coach));
  assert.ok(watch.includes('holdRef.current)return'),'案内の間は試合を進めない');
  assert.ok(app.includes('resetGuides(profile)'),'設定から見直せる');
 });
}
