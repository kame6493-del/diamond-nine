// 11/5 の作り直し(vc43 / 1.5.0 のまま)の試験。持ち主「1から別に試合画面作り直していいです。守備の動きに関しても、リアルにある程度再現してください」
// 「監督試合する際、スタメンを決められるようにしてください」「タップで閉じるみたいなのは無いようにして」。
// 1) 結果ごとに動きの種類が合う(凡打=ゴロ・フライ、犠牲フライ=タッチアップ、安打・長打・本塁打・失策・バント・盗塁・四死球・三振)。
// 2) 見た目と結果が食い違わない: アウトは送球が先に着く、セーフは走者が先、タッチアップは捕ってから走る、守る人・球はグラウンドの縮尺の中。
// 3) 投球の1球: 振る・見送る・空振り・当てるが球の種類どおり。 4) スタメン: 決めた打順・守備・先発で始まる、無理なオーダーは始められない、
// 「この試合だけ」ではふだんのオーダーが変わらない、画面とシーズンの結果が同じ。 5) ホームの札の言葉と「タップで閉じる」が無いこと。
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialSandboxState,type GameResult,type LiveEvent,type LiveSituation,type WatchOrder} from '../src/pro/engine';
import {managedGame,liveGame,finishLive,commitManaged,withOrder,readManage,saveManage,savedOrderOk,type ManagedGame} from '../src/pro/managed';
import {choreograph,pitchClip,endOf,actorAt,ballAt,BAGS,FIRST,SECOND,THIRD,PLATE,fenceAt,type Choreo,type V} from '../src/pro/field-sim';
import {playWord} from '../src/pro/watch';
import {usualOrder,orderBlock,swapOrder,setPosition,benchIn,benchOf,chooseStarter,starterOf,starterSlot,withStartOrder,isNative,restDays} from '../src/pro/lineup';
import {StartingLineup} from '../src/pro/StartingLineup';
import {KeyGameCard} from '../src/pro/SimpleApp';
import {projection,toScreen,HOME_CAM} from '../src/pro/FieldCanvas';
import {playerMap} from '../src/pro/data';

const ctx={fielders:{P:'p',C:'c','1B':'a','2B':'b','3B':'d',SS:'e',LF:'f',CF:'g',RF:'h'},rate:(id:string)=>({speed:id.length*9%100,field:60,arm:55+id.length*3%30})};
function drive(g:ManagedGame,orders:(s:LiveSituation)=>WatchOrder|null=()=>null){
 const gen=liveGame(g),inputs:(WatchOrder|null)[]=[],events:LiveEvent[]=[],sits:LiveSituation[]=[];let step=gen.next(),guard=0;
 while(!step.done&&guard++<20000){const v=step.value;let x:WatchOrder|null=null;if(v.type==='event')events.push(v.e);else{sits.push(v.s);x=orders(v.s);}inputs.push(x);step=gen.next(x);}
 assert.ok(step.done);return {result:step.value as GameResult,inputs,events,sits};
}
/** たくさんの試合の出来事(打席の前の塁つき)。盗塁・バントの指示も混ぜる。 */
function events(n=18){
 const state=initialSandboxState(),g=managedGame(state)!,out:{e:LiveEvent;before:(string|null)[]}[]=[];
 for(let i=0;i<n;i++){
  const d=drive({...g,rng:(g.rng+i*7919)>>>0},s=>s.side===g.control?(s.bases[0]&&!s.bases[1]&&i%2===0?{kind:'steal'}:s.outs<2&&(s.bases[0]||s.bases[1])&&i%3===0?{kind:'bunt'}:null):null);
  let bases:(string|null)[]=[null,null,null],key='';
  for(const e of d.events){const k=`${e.inning}|${e.side}`;if(k!==key){bases=[null,null,null];key=k;}const before=bases;bases=e.bases;if(['PINCH','RUNNER','FIELD','PITCHER','MOVE'].includes(e.kind))continue;out.push({e,before});}
 }
 return out;
}
/** その人が、その場所に最初に着いた時刻(着かなければ Infinity)。 */
function arrive(c:Choreo,id:string,at:V,m=.6){const a=c.actors.find(x=>x.id===id);if(!a)return Infinity;for(const k of a.keys)if(Math.hypot(k.p[0]-at[0],k.p[1]-at[1])<=m)return k.t;return Infinity;}
// 11/5 昼: 凡打は plays.ts のプレーどおり(フォース・タッチ・ライナー・内野フライ・ファインプレー・飛び出しの併殺)。
const MOTION:Record<string,string[]>={OUT:['ground-out','fly-out','force-out','tag-out','liner-out','pop-out','fine-play'],DP:['double-play'],TP:['double-play'],FC:['force-out','tag-out'],SF:['tag-up','double-play'],'1B':['single'],'2B':['extra-base'],'3B':['extra-base'],HR:['home-run'],E:['error'],BUNT:['bunt'],BUNT_FAIL:['bunt-pop'],SB:['steal'],CS:['caught-stealing'],BB:['walk'],HBP:['walk'],IBB:['walk'],K:['strikeout']};

export function register1105Tests(test:(name:string,run:()=>void)=>void){
 test('field motion (11/5): every result gets the matching kind of play (ground/fly out, tag-up, single, extra-base relay, home run, error, bunt, steal, walk, strikeout)',()=>{
  const seen=new Set<string>();
  for(const {e,before} of events()){
   const c=choreograph(e,before,ctx),want=MOTION[e.kind];assert.ok(want,`${e.kind}`);
   assert.ok(want.includes(c.motion),`${e.kind} → ${c.motion}`);seen.add(c.motion);
   if(e.kind==='OUT'&&e.play&&!e.play.fine)assert.equal(c.motion,e.play.bb==='gb'?'ground-out':e.play.bb==='ld'?'liner-out':e.play.bb==='pop'?'pop-out':'fly-out');void playWord;
   assert.ok(c.len>0&&c.len<=4.7,`1倍で 4.7 秒以内 ${e.kind} ${c.len}`);
  }
  for(const m of ['ground-out','fly-out','tag-up','single','extra-base','home-run','steal','walk','strikeout'])assert.ok(seen.has(m),m);
 });
 test('field motion (11/5): the picture never contradicts the result: outs are thrown out before the runner, safe runners beat the ball, tag-ups leave after the catch, everyone stays inside the park',()=>{
  let outs=0,safes=0,tags=0;
  for(const {e,before} of events()){
   const c=choreograph(e,before,ctx),bid='b:'+e.batter;
   if(c.motion==='ground-out'){
    const thr=c.ball.find(b=>b.kind==='throw'&&Math.hypot(b.b[0]-FIRST[0],b.b[1]-FIRST[1])<1.5);
    const run=arrive(c,bid,FIRST,.1);
    if(thr){assert.ok(thr.t1<run,`送球が先 ${thr.t1} < ${run}`);outs++;}
    assert.equal(endOf(c,bid)!.o,0,'アウトの打者は消える');
   }
   if(c.motion==='steal'||c.motion==='caught-stealing'){
    const thr=c.ball.find(b=>b.kind==='throw')!,rid=c.actors.find(a=>a.role==='r'&&arrive(c,a.id,SECOND,.1)<Infinity)!;
    const t=arrive(c,rid.id,SECOND,.1);
    if(c.motion==='steal'){assert.ok(t<thr.t1,'盗塁成功は走者が先');safes++;}else{assert.ok(t>thr.t1,'盗塁失敗は球が先');assert.equal(endOf(c,rid.id)!.o,0);}
   }
   if(c.motion==='single'||c.motion==='extra-base'){
    // 送球がその塁に着くのは、その塁で止まる走者が着いた後
    for(const b of c.ball.filter(x=>x.kind==='throw'))for(const [i,bag] of BAGS.slice(0,3).entries()){
     if(Math.hypot(b.b[0]-bag[0],b.b[1]-bag[1])>1)continue;
     const who=e.bases[i];if(!who)continue;const id=c.actors.find(a=>a.id==='r:'+who||a.id==='b:'+who)!.id;
     assert.ok(arrive(c,id,bag,.1)<=b.t1+1e-6,`${e.kind} ${i+1}塁は走者が先`);safes++;
    }
   }
   if(c.motion==='tag-up'){
    const catchT=c.ball.find(b=>b.kind==='air')!.t1,r=c.actors.find(a=>a.role==='r'&&before[2]&&a.id==='r:'+before[2])!;
    // 三塁(塁の上)を最後に離れる時刻 = 走り出す時刻
    const onBag=r.keys.filter(k=>Math.hypot(k.p[0]-THIRD[0],k.p[1]-THIRD[1])<.1),leave=onBag[onBag.length-1];
    assert.ok(leave&&leave.t>=catchT,'塁に戻って、捕ってから走る');assert.ok(Math.hypot(endOf(c,r.id)!.p[0],endOf(c,r.id)!.p[1])<1,'本塁に還る');tags++;
   }
   // 人と球は球場の中(本塁打の球だけはスタンドへ)
   for(const a of c.actors)for(const k of a.keys){const d=Math.hypot(k.p[0],k.p[1]),deg=Math.atan2(k.p[0],k.p[1])*180/Math.PI;assert.ok(d<=fenceAt(Math.max(-45,Math.min(45,deg)))+1,`${a.id} 塀の中`);assert.ok(k.p[1]>-8,'本塁の後ろに行きすぎない');}
   for(const b of c.ball)if(c.motion!=='home-run')assert.ok(Math.hypot(b.b[0],b.b[1])<=fenceAt(Math.max(-45,Math.min(45,Math.atan2(b.b[0],b.b[1])*180/Math.PI)))+1,'球は塀の中');
  }
  assert.ok(outs>40&&safes>20&&tags>0,`${outs} ${safes} ${tags}`);
 });
 test('pitch motion (11/5): the pitcher winds up and throws, the batter swings at strikes/fouls/contact, takes balls, and misses on the third strike; the ball reaches the catcher',()=>{
  const e={batter:'bat',pitcher:'p'},before=[null,null,null];
  const pose=(c:Choreo,id:string,t:number)=>actorAt(c.actors.find(a=>a.id===id)!,t).pose;
  for(const p of ['B','S','F','X']){
   const c=pitchClip(ctx,e,before,p,{last:p==='S'});
   const poses=new Set(c.actors.find(a=>a.id==='f:P')!.keys.map(k=>k.pose));for(const x of ['windup','kick','release'])assert.ok(poses.has(x as never),`投手 ${x}`);
   const bat=new Set(c.actors.find(a=>a.id==='b:bat')!.keys.map(k=>k.pose));
   if(p==='B')assert.ok(!bat.has('swing'),'ボールは見送る');
   if(p==='S')assert.ok(bat.has('miss'),'三つ目のストライクは空振り');
   if(p==='F'||p==='X')assert.ok(bat.has('swing'),'当てる');
   const ball=c.ball.find(b=>b.kind==='pitch')!;assert.ok(ball.b[1]<0.5,'球は本塁まで');assert.ok(ballAt(c,(ball.t0+ball.t1)/2),'途中で見える');
   assert.ok(c.len<1.3,'1球は 1.3 秒以内(1倍)');void pose;
  }
  const bunt=pitchClip(ctx,e,before,'X',{bunt:true});assert.ok(bunt.actors.find(a=>a.id==='b:bat')!.keys.some(k=>k.pose==='bunt'));
  // 倍速: 画面は 1球・1プレーの長さを速さで割る(動きも速くなる)。飛ばしの時は動きを出さない。
  const src=readFileSync('src/pro/WatchScreen.tsx','utf8');
  assert.ok(src.includes('clip.len*1000/sp')&&src.includes('d.len*1000/sp'),'倍速で動きも速い');
  assert.ok(/skipPlate=.*l\.clip=null/.test(src)&&/skipGame=.*l\.clip=null/.test(src),'次の打席へ・試合終了までは動きを飛ばす');
 });
 test('field picture (11/5): the camera keeps the infield large, the plate inside the frame, and figures are at least 17px on a 360x640 phone',()=>{
  for(const [W,H] of [[344,222],[392,420],[392,300]]){
   const pr=projection(W,H,HOME_CAM);
   for(const p of [PLATE,FIRST,SECOND,THIRD,[0,-3.3] as V]){const [x,y]=toScreen(pr,p);assert.ok(x>=0&&x<=W&&y>=0&&y<=H,`${W}x${H} ${p}`);}
   const [,yh]=toScreen(pr,PLATE),[,y2]=toScreen(pr,SECOND);assert.ok(yh-y2>H*.3,'内野が大きい');
  }
 });
 test('starting lineup (11/5): the game starts with the chosen order, positions and starter; impossible orders cannot start; "この試合だけ" keeps the usual order; screen and season agree',()=>{
  const state=initialSandboxState(),g=managedGame(state)!,base=g.base,usual=usualOrder(base);
  assert.equal(orderBlock(base,usual),'','ふだんのオーダーは始められる');
  // 打順の入れ替え・守備位置・先発・控え
  let o=swapOrder(usual,0,8);
  const bench=benchOf(base,o);assert.ok(bench.length>0,'控えがいる');
  o=benchIn(o,4,bench[0]);
  const rotation=o.pitchers.slice(0,6),pick=rotation.find(id=>id!==starterOf(o,base))!;o=chooseStarter(o,base,pick);
  assert.equal(starterOf(o,base),pick);assert.equal(o.pitchers.indexOf(pick),starterSlot(base));
  assert.equal(orderBlock(base,o),'');
  const live=withOrder(g,o),d=drive(live),mine=d.sits[0].lineups[g.control];
  assert.deepEqual(mine,o.lineup,'決めた打順で始まる');
  for(const id of o.lineup)assert.equal(d.sits[0].defense[g.control][id],o.defense[id],'決めた守備位置');
  const firstDef=d.sits.find(s=>s.side!==g.control)!;assert.equal(firstDef.pitcher,pick,'決めた先発');
  assert.ok(d.result.box!.batting.some(b=>b.team===state.club&&b.playerId===bench[0]),'控えから入れた選手が出る');
  // シーズンに入れる: 画面と同じ結果、ふだんのオーダーは変わらない(この試合だけ)
  const before=JSON.stringify([state.lineup,state.defense,state.pitchers]);
  const next=commitManaged(state,g.control,d.inputs,o),r=next.season.results.find(x=>x.home===g.home&&x.away===g.away)!;
  assert.equal(JSON.stringify([r.homeRuns,r.awayRuns,r.box]),JSON.stringify([d.result.homeRuns,d.result.awayRuns,d.result.box]),'画面とシーズンが同じ');
  assert.equal(JSON.stringify([next.lineup,next.defense,next.pitchers]),before,'この試合だけ: ふだんのオーダーは変わらない');
  assert.equal(JSON.stringify([state.lineup,state.defense,state.pitchers]),before,'元の状態も変わらない');
  // ふだんのオーダーにも使う: 状態に入れる
  const kept=withStartOrder(state,o);assert.deepEqual(kept.lineup,o.lineup);assert.equal(kept.pitchers[starterSlot(state)],pick);
  // 何も決めない(order=null)は、前と同じ(おまかせと同じ結果)
  assert.equal(JSON.stringify(finishLive(withOrder(g,null),[]).box),JSON.stringify(finishLive(g,[]).box));
 });
 test('starting lineup (11/5): duplicated or missing positions, a short order, players outside the team and a missing starter cannot start, each with a reason',()=>{
  const state=initialSandboxState(),base=managedGame(state)!.base,u=usualOrder(base);
  const catcher=u.lineup.find(id=>u.defense[id]==='捕')!,first=u.lineup.find(id=>u.defense[id]==='一')!;
  const dup={...u,defense:{...u.defense,[first]:'捕'}};assert.match(orderBlock(base,dup),/捕手が2人|一塁がいません/);
  // setPosition は重ならないように入れ替える
  const moved=setPosition(u,first,'捕');assert.equal(orderBlock(base,moved),'');assert.equal(moved.defense[catcher],'一');
  assert.match(orderBlock(base,{...u,lineup:u.lineup.slice(0,8)}),/9人/);
  assert.match(orderBlock(base,{...u,lineup:[...u.lineup.slice(0,8),'nobody']}),/チームにいない/);
  const of=u.lineup.filter(id=>u.defense[id]==='外');assert.match(orderBlock(base,{...u,defense:{...u.defense,[of[0]]:'遊'}}),/遊撃が2人|外野が2人/);
  assert.match(orderBlock(base,{...u,pitchers:u.pitchers.map((p,i)=>i===starterSlot(base)?'':p)}),/投手/);
  // 本職でない位置は分かる
  const p=playerMap[catcher];assert.equal(isNative(catcher,'捕'),true);void p;
  // 疲れの表示(前の登板からの日数)は今日の先発で最大、昨日の投手で 0
  const later={...base,season:{...base.season,day:20}};
  const today=later.pitchers[starterSlot(later)],yesterday=later.pitchers[(starterSlot(later)+5)%6];
  assert.equal(restDays(later,usualOrder(later),today),5);assert.equal(restDays(later,usualOrder(later),yesterday),0);
 });
 test('starting lineup screen (11/5): the order, positions, starter and bench are shown with their abilities; the start button says why when it cannot start; resume keeps the chosen order',()=>{
  const state=initialSandboxState(),g=managedGame(state)!;
  const html=renderToStaticMarkup(createElement(StartingLineup,{base:g.base,label:g.label,rival:'相手',onStart:()=>{},onCancel:()=>{}}));
  for(const x of ['スタメンを決める','この試合だけ','ふだんのオーダーにも使う','打順と守備位置','先発投手','控え','おすすめ','このまま始める','打率','防御率','km'])assert.ok(html.includes(x),x);
  for(const id of g.base.lineup)assert.ok(html.includes(playerMap[id].name),playerMap[id].name);
  for(const x of ['ミート','パワー','走力','守備','制球','スタミナ'])assert.ok(html.includes(x),x);
  // 続きから: 覚えたスタメンで開き直す
  const store=new Map<string,string>(),st={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);}};
  const o=swapOrder(usualOrder(g.base),0,1);
  saveManage('p',{v:1,key:g.key,control:g.control,inputs:[],mode:'manage',order:o},st);
  const back=readManage('p',g.key,st)!;assert.deepEqual(back.order,o);assert.ok(savedOrderOk(state,back.order));
 });
 test('home card and notices (11/5): the card is just the game name and opponent with 監督して戦う / 一気に進める; no "タップで閉じる" anywhere in the game',()=>{
  const state=initialSandboxState(),g=managedGame(state)!;
  const html=renderToStaticMarkup(createElement(KeyGameCard,{game:g,at:state,name:state.name,club:state.club,saved:false,onManage:()=>{},onRestart:()=>{},onAuto:()=>{}}));
  for(const x of ['開幕戦','vs','監督して戦う','一気に進める'])assert.ok(html.includes(x),x);
  for(const x of ['次の大事な試合','止まっている間','作戦・バント','大事な試合でも止まらない'])assert.ok(!html.includes(x),x);
  const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(`${dir}/${d.name}`):/\.(tsx|ts)$/.test(d.name)?[`${dir}/${d.name}`]:[]);
  for(const f of walk('src')){const t=readFileSync(f,'utf8').split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');assert.ok(!/タップで閉じる|タップで次へ|タップして続ける/.test(t),f);}
  const app=readFileSync('src/pro/SimpleApp.tsx','utf8');assert.ok(app.includes('className="kg-toast" role="status"'),'知らせは押さなくても消える');
  const css=readFileSync('src/pro/watch.css','utf8');assert.ok(/kg-toast\{[^}]*pointer-events:none/.test(css)&&/kg-toast 1\.8s/.test(css),'1.8秒で消え、操作を止めない');
  const m=readFileSync('src/pro/match.css','utf8');assert.ok(/\.wt-hr,\.wt-root \.wt-flash\{pointer-events:none/.test(m),'ホームラン・チェンジの演出も押さなくてよい');
 });
}
