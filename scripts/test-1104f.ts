// 11/4 夜おそくの直し(vc43 / 1.5.0 のまま)の試験。持ち主「試合の時、ミート・パワー・走力が、投手のコントロール・スタミナ・球速が、能力として
// 見れるようにして」「バットに当たった音が金属音なので、これ違う音に変えて…前提はプロ野球なので」「投球数は1球ずつちゃんと増えるようにして」
// 「奪三振数も見えるようにして」。
// 1) 帯に能力の段と棒が出る(段の色と記号はシートと同じ)。 2) スタミナの棒は1球ごとに減る。 3) 打球音は木製バットの新しいファイル。
// 4) 球数は1球ずつ +1、飛ばしても打席の合計は同じ、球の並びは打席の結果と食い違わない、試合の終わりの球数は成績表と同じ表。
// 5) 奪三振は三振で1つ増え、試合の終わりに成績と一致する。
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {initialSandboxState,type GameResult,type LiveEvent,type LiveSituation,type WatchOrder} from '../src/pro/engine';
import {managedGame,liveGame,type ManagedGame} from '../src/pro/managed';
import {longArm,gradeOf,gradeClass,pitchPlan,countOf,newTally,tallyBegin,tallyPitch,tallyEnd,staminaLeft,staminaBudget,isPlateAppearance} from '../src/pro/watch';
import {Mini} from '../src/pro/WatchScreen';
import {soundFiles} from '../src/pro/game-audio';

function drive(g:ManagedGame,orders:(s:LiveSituation)=>WatchOrder|null=()=>null){
 const gen=liveGame(g),events:LiveEvent[]=[],sits:{s:LiveSituation;at:number;so:Record<string,number>}[]=[];
 let step=gen.next(),guard=0;
 while(!step.done&&guard++<20000){const v=step.value;let x:WatchOrder|null=null;if(v.type==='event')events.push(v.e);else{sits.push({s:v.s,at:events.length,so:Object.fromEntries(Object.entries(v.s.pitToday).map(([k,p])=>[k,p.so]))});x=orders(v.s);}step=gen.next(x);}
 assert.ok(step.done);return {result:step.value as GameResult,events,sits};
}

export function register1104fTests(test:(name:string,run:()=>void)=>void){
 test('duel strip (11/4 夜おそく): batter shows ミート・パワー・走力 and pitcher 球速・制球・スタミナ with the same grade letters and colors as the sheets; 奪三振 today and season are always shown',()=>{
  for(const v of [20,45,62,78,91,104]){
   const html=renderToStaticMarkup(createElement(Mini,{v,label:'ミート'}));
   assert.ok(html.includes('>ミート<'),'名前');
   assert.ok(html.includes(`>${gradeOf(v)}<`),`段 ${gradeOf(v)}`);
   assert.ok(html.includes(`class="${gradeClass(v)}"`),'段の色(シートと同じ g-*)');
  }
  // 帯の部品(WatchScreen の duelCards)が6つの能力と奪三振を常に出す
  const src=readFileSync('src/pro/WatchScreen.tsx','utf8'),strip=src.slice(src.indexOf('const duelCards='),src.indexOf('const quickRow='));
  for(const l of ['label="ミート"','label="パワー"','label="走力"','<MiniVelocity','label="制球"','label="スタミナ" left={left}','奪三振 今日','今季','{bats}','打率','unit="本"','防御率','球</span>'])assert.ok(strip.includes(l),`帯に ${l}`);
  assert.ok(!strip.includes('{!(bm?.avg)&&')&&!strip.includes('{!(pm?.era)&&'),'球数・今日の成績は数字が動いた時も消さない');
  // 文字は 11px 未満にしない(帯の CSS)
  const css=readFileSync('src/pro/watch.css','utf8'),tail=css.slice(css.indexOf('帯に能力を常に出す'));
  for(const m of tail.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(m[1])>=11,`帯の字 ${m[1]}px`);
 });
 test('stamina bar (11/4 夜おそく): today\'s remaining stamina goes down by one step on every pitch, lasts longer for higher stamina and for starters',()=>{
  for(const [st,starter] of [[40,true],[85,true],[60,false],[110,false]] as const){
   let prev=staminaLeft(st,0,starter);assert.equal(prev,1,'投げる前は満タン');
   for(let n=1;n<=staminaBudget(st,starter)+5;n++){const x=staminaLeft(st,n,starter);assert.ok(x<prev||x===0,`${n}球目で減る`);assert.ok(x>=0&&x<=1);prev=x;}
   assert.equal(prev,0,'投げ続ければ 0');
  }
  assert.ok(staminaBudget(90,true)>staminaBudget(40,true),'スタミナが高い先発ほど長い');
  assert.ok(staminaBudget(90,true)>=90&&staminaBudget(40,true)>=75&&staminaBudget(90,true)<=115,'先発はおよそ 80〜110球');
  assert.ok(staminaBudget(60,false)<staminaBudget(60,true),'中継ぎは短い');
  const P=['s1','s2','s3','s4','s5','s6','r1','r2'];
  assert.ok(longArm('s3',['s3'],P)&&longArm('s2',['s1','s2'],P)&&!longArm('r1',['s1','r1'],P),'先発と先発の枠は長く、中継ぎは短く数える');
  // 帯の棒の幅は残りの %(Mini の left)
  const full=renderToStaticMarkup(createElement(Mini,{v:70,label:'スタミナ',left:1})),half=renderToStaticMarkup(createElement(Mini,{v:70,label:'スタミナ',left:.5})),low=renderToStaticMarkup(createElement(Mini,{v:70,label:'スタミナ',left:.2}));
  assert.ok(full.includes('width:100%')&&half.includes('width:50%')&&low.includes('width:20%'));
  assert.ok(low.includes('is-low')&&!half.includes('is-low'),'3割を切ると赤');
  assert.ok(half.includes('>B<')||half.includes(`>${gradeOf(70)}<`),'段はスタミナの能力のまま');
 });
 test('bat sound (11/4 夜おそく): hits use the new CC0 wooden-bat recordings (strong / jammed / foul); the metal-bat files are gone and credited sources are listed',()=>{
  assert.equal(soundFiles.hitStrong,'freesound/bat/hit-strong.mp3');assert.equal(soundFiles.hitJammed,'freesound/bat/hit-jammed.mp3');assert.equal(soundFiles.foul,'freesound/bat/foul.mp3');
  for(const k of ['hit','homerun','win'])assert.equal(soundFiles[k],undefined,`${k}(金属バット)は使わない`);
  for(const f of Object.values(soundFiles)){assert.ok(!/metal/.test(f));assert.ok(existsSync('public/audio/'+f),`public/audio/${f} がある`);}
  for(const f of ['selab/watch/hit.mp3','selab/watch/homerun.mp3','selab/win.mp3'])assert.ok(!existsSync('public/audio/'+f),`${f}(金属音)は外した`);
  const credits=readFileSync('public/THIRD_PARTY_ASSETS.txt','utf8'),lic=readFileSync('public/audio/freesound/bat-LICENSE.txt','utf8');
  for(const id of ['162876','162873','162866']){assert.ok(credits.includes(id),`THIRD_PARTY_ASSETS に ${id}`);assert.ok(lic.includes(id));}
  assert.ok(/CC0|Creative Commons 0/.test(lic));
  const src=readFileSync('src/pro/WatchScreen.tsx','utf8');
  assert.ok(!/play\('hit'\)|play\('homerun'\)/.test(src),'試合の画面は古い名前を鳴らさない');
  // 11/5: ファウルの音は打った瞬間に鳴らす(play-sounds.ts の cue 'foul')。前は球の動きが終わってから play('foul') で鳴っていた。
  assert.ok(readFileSync('src/pro/play-sounds.ts','utf8').includes("kind:'foul'")&&src.includes("'hitStrong'")&&src.includes("'hitJammed'"));
 });
 test('pitch count (11/4 夜おそく): +1 on every pitch shown, the same per-at-bat total when skipped, pitch sequences agree with the result, and the end-of-game counts are the box score table',()=>{
  const g=managedGame(initialSandboxState())!;
  // 作戦(慎重に・積極的に)も入れた試合で確かめる
  const patient:(s:LiveSituation)=>WatchOrder|null=(()=>{let sent=false;return (s:LiveSituation)=>{if(sent||s.side!==g.control)return null;sent=true;return {kind:'tactic',scope:'team',tactic:'patient'};};})();
  for(const [label,orders] of [['おまかせ',()=>null],['慎重に',patient]] as const){
   const d=drive(g,orders as (s:LiveSituation)=>WatchOrder|null);
   const shown=newTally(),quiet=newTally();let paNo=0,lengthened=0;
   for(const e of d.events){
    if(!isPlateAppearance(e.kind))continue;
    paNo++;const seq=pitchPlan(e.kind,paNo,e.tactic?.[0]??null),key=`${1-e.side}|${e.pitcher}`,last=seq.at(-1)!;
    if(e.tactic?.[0]==='patient')lengthened++;
    // 球の並びと打席の結果: 最後の球の前のカウントは 3-2 まで、三振は3つ目のストライクで、四球は4つ目のボールで終わる。
    const before=countOf(seq.slice(0,-1)),balls=seq.filter(x=>x==='B').length;
    assert.ok(before.b<=3&&before.s<=2,`${e.kind} ${seq.join('')}`);
    if(e.kind==='K'){assert.equal(last,'S');assert.equal(seq.filter(x=>x==='S'||x==='F').length>=3,true);assert.equal(before.s,2,'2ストライクから三振');assert.ok(balls<=3);}
    else if(e.kind==='BB'||e.kind==='IBB'){assert.equal(last,'B');assert.equal(balls,4);}
    else{assert.equal(last,'X',`${e.kind} は打った球(当たった球)で終わる`);assert.ok(balls<=3);}
    // 観る: 何球か見せた所で「次の打席へ」(飛ばし)。1球ごとに +1、合計は飛ばしと同じ。
    const cut=paNo%3===0?Math.floor(seq.length/2):paNo%3===1?seq.length:0;
    tallyBegin(shown,key);
    for(let i=0;i<cut;i++){const was=shown.count[key]??0;tallyPitch(shown);assert.equal(shown.count[key],was+1,'1球で1つ増える');}
    const was=shown.count[key]??0;tallyEnd(shown,key,seq.length);assert.equal(shown.count[key],was+seq.length-cut,'残りをまとめて足す');
    tallyEnd(quiet,key,seq.length);
    // 同じ打席は何度作っても同じ並び(倍速・続きから・飛ばしでも同じ)
    assert.deepEqual(pitchPlan(e.kind,paNo,e.tactic?.[0]??null),seq);
   }
   assert.deepEqual(shown.count,quiet.count,`${label}: 観ても飛ばしても、試合の終わりの球数は同じ`);
   const pitchedIn=new Set(d.result.box!.pitching.map(p=>`${p.team===g.away?0:1}|${p.playerId}`));
   assert.deepEqual(new Set(Object.keys(shown.count)),pitchedIn,`${label}: 球数のある投手 = 成績表の投手`);
   for(const n of Object.values(shown.count))assert.ok(n>=1&&n<200);
   if(label==='慎重に')assert.ok(lengthened>5,'慎重にの打席がある');
  }
 });
 test('strikeouts (11/4 夜おそく): a strikeout adds exactly one to the pitcher\'s today count, and the end-of-game strikeouts match the box score',()=>{
  const g=managedGame(initialSandboxState())!,d=drive(g);
  const teamOf=(side:number)=>side===0?g.away:g.home;let checked=0;
  for(let i=1;i<d.sits.length;i++){
   const a=d.sits[i-1],b=d.sits[i],evs=d.events.slice(a.at,b.at).filter(e=>isPlateAppearance(e.kind));
   for(const e of evs){if(evs.length!==1)continue;const key=`${teamOf(1-e.side)}|${e.pitcher}`,so0=a.so[key]??0,so1=b.so[key]??0;// 打席の前に写した数(試合中の表は同じ物が書き換わる)
    assert.equal(so1-so0,e.kind==='K'?1:0,`${e.kind} の後の奪三振`);if(e.kind==='K')checked++;}
  }
  assert.ok(checked>3,'三振の打席を確かめた');
  for(const side of [0,1]){
   const ks=d.events.filter(e=>e.kind==='K'&&e.side===1-side).length,box=d.result.box!.pitching.filter(p=>p.team===teamOf(side)).reduce((n,p)=>n+p.so,0);
   assert.equal(box,ks,'試合の終わりの奪三振 = 三振の数');
  }
 });
}
