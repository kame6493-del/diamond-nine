// 11/4 深夜の直し(vc43 / 1.5.0 のまま)の試験。開幕戦の画面で「1回裏なのに、投手の帯が1回表に投げた東京の先発のまま」に見えた件。
// 試合の計算(打順・投手・球数・奪三振)は正しく、画面が前の打席の打者と投手を帯に残したまま、グラウンドと回は次の半回に進んでいた。
// 1) 攻守が替わる時・次の打席から投手が替わる時は帯に残さない(holdsAfter)。 2) 帯の投手はいつも守っている側の、いま投げている投手。
// 3) 打順は両チームそれぞれ1つずつ進み、半回をまたいでも続きから。 4) 作戦の欄は、帯の人と違う相手なら「次の打者/次の投手」。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialSandboxState,type LiveEvent,type LiveSituation} from '../src/pro/engine';
import {managedGame,liveGame} from '../src/pro/managed';
import {holdsAfter,tacticWho,isPlateAppearance} from '../src/pro/watch';

function drive(){
 const g=managedGame(initialSandboxState())!,gen=liveGame(g),steps:({e:LiveEvent}|{s:LiveSituation})[]=[];
 let step=gen.next(),guard=0;
 while(!step.done&&guard++<20000){const v=step.value;if(v.type==='event')steps.push({e:v.e});else steps.push({s:v.s});step=gen.next(null);}
 assert.ok(step.done);return {g,steps};
}

export function register1104gTests(test:(name:string,run:()=>void)=>void){
 test('duel strip after a plate appearance (11/4 深夜): when the side changes or the pitcher changes, the strip shows the pitcher now on the mound and the batter now up, never the previous half-inning\'s pitcher',()=>{
  assert.equal(holdsAfter({side:0,pitcher:'a'},{side:0,pitcher:'a'}),true,'同じ半回・同じ投手は結果を残す');
  assert.equal(holdsAfter({side:0,pitcher:'a'},{side:1,pitcher:'b'}),false,'攻守交代は残さない');
  assert.equal(holdsAfter({side:1,pitcher:'b'},{side:1,pitcher:'c'}),false,'投手交代は残さない');
  assert.equal(holdsAfter({side:1,pitcher:'b'},null),true,'試合終了は最後の打席を残す');
  const {g,steps}=drive(),teamOf=(side:number)=>side===0?g.away:g.home;
  let last:LiveEvent|null=null,changes=0,held=0;
  for(const x of steps){
   if('e' in x){if(isPlateAppearance(x.e.kind))last=x.e;continue;}
   const s=x.s;
   // 画面の帯(reveal と同じ決まり): 残す時は前の打席の打者と投手、残さない時はいまの場面。
   const shown=last&&holdsAfter(last,s)?{side:last.side,batter:last.batter,pitcher:last.pitcher}:{side:s.side,batter:s.batter,pitcher:s.pitcher};
   assert.equal(shown.side,s.side,`${s.inning}回${s.side?'裏':'表'}: 帯の攻め手は回の表示と同じ`);
   assert.equal(shown.pitcher,s.pitcher,`${s.inning}回${s.side?'裏':'表'}: 投手の帯はいま投げている投手`);
   assert.ok(s.pitchers[1-s.side].includes(shown.pitcher),`投手は守っている側(${teamOf(1-s.side)})の投手`);
   assert.ok(s.lineups[s.side].includes(shown.batter)||s.removed[s.side].includes(shown.batter),'打者は攻めている側の選手');
   if(last&&last.side!==s.side)changes++;else if(last)held++;
   last=null;
  }
  assert.ok(changes>=16,`攻守交代を確かめた(${changes})`);assert.ok(held>20);
  // 画面の部品が同じ決まりを使っている
  const src=readFileSync('src/pro/WatchScreen.tsx','utf8');
  assert.ok(src.includes('!holdsAfter(lastPA,l.nextSit)'),'reveal は holdsAfter で帯を残すか決める');
  assert.ok(src.includes("l.flash='チェンジ'"),'攻守交代は「チェンジ」と出す');
 });
 test('batting order and pitcher per half-inning (11/4 深夜): each team bats 1..9 in turn and carries on from where it stopped; every plate appearance is against the defending team\'s pitcher; strikeouts and pitch keys belong to the defending side',()=>{
  const {g,steps}=drive();
  const next:[number|null,number|null]=[null,null];let sit:LiveSituation|null=null,pas=0,halves=new Set<string>();
  for(const x of steps){
   if('s' in x){sit=x.s;continue;}
   const e=x.e;if(!isPlateAppearance(e.kind))continue;
   assert.ok(sit,'打席の前に場面がある');
   assert.equal(e.side,sit!.side);assert.equal(e.batter,sit!.batter,'場面の打者が打つ');assert.equal(e.pitcher,sit!.pitcher,'場面の投手が投げる');
   assert.ok(sit!.pitchers[1-e.side].includes(e.pitcher),`${e.inning}回: 守っている側の投手`);
   // 同じ選手のカードが自分のチームと相手の実在チームの両方にいることがある(カードの遊び)。成績は「チーム|選手」で分けて数える。
   assert.ok(sit!.pitToday[`${e.side===0?g.home:g.away}|${e.pitcher}`]||!Object.keys(sit!.pitToday).some(k=>k.endsWith('|'+e.pitcher)&&!k.startsWith((e.side===0?g.home:g.away)+'|')),'投手の今日の成績は守っている側の表');
   if(next[e.side]!==null)assert.equal(e.slot,next[e.side],`${e.inning}回${e.side?'裏':'表'}: 打順は前の打者の次(半回をまたいでも続き)`);
   else assert.equal(e.slot,0,'最初の打者は1番');
   next[e.side]=(e.slot+1)%9;pas++;halves.add(`${e.inning}|${e.side}`);
  }
  assert.ok(pas>=54&&halves.size>=17,`${pas}打席・${halves.size}半回`);
 });
 test('tactic label (11/4 深夜): attacking = 打者, defending = 投手; when the strip still shows someone else (result held, or the pitch is being thrown) it says 次の打者 / 次の投手',()=>{
  assert.equal(tacticWho(true,'b2','b2'),'打者');assert.equal(tacticWho(true,'b2','b1'),'次の打者');
  assert.equal(tacticWho(false,'p1','p1'),'投手');assert.equal(tacticWho(false,'p2','p1'),'次の投手');
  assert.equal(tacticWho(true,'b1',null),'打者');
  const src=readFileSync('src/pro/WatchScreen.tsx','utf8'),row=src.slice(src.indexOf('const quickRow='),src.indexOf('const managerPanel='));
  assert.ok(row.includes('tacticWho(mineBat,id,shownWho(mineBat))'),'作戦の欄は帯の人と比べて名前の前の言葉を決める');
 });
}
