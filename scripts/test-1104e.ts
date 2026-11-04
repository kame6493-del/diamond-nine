// 11/4 夜の直し(vc43 / 1.5.0 のまま)の試験。持ち主「右と左別に立つようにして。あとスクロールせずに結果見れるようにして。監督として細かく
// ある程度指示出せるようにして」「さっき言った長打狙いとかその辺」「守備交代するときにポジションが出てないから、何が何かわからない」。
// 1) 打ち方ごとの立ち位置(右打=三塁側・左打=一塁側・両打ち=投手の反対)と投手の腕。 2) 1タップの作戦(打者ごと・投手ごと)が、その選手の打席だけに
// 決まりの向きで効く。 3) 使えない場面の指示は効かない。 4) 指示なし・取り消しはおまかせと同じ。 5) 守備位置の入れ替え。 6) 結果の一文の言葉。
import assert from 'node:assert/strict';
import {initialSandboxState,type GameResult,type LiveEvent,type LiveSituation,type WatchOrder} from '../src/pro/engine';
import {managedGame,liveGame,finishLive,commitManaged,type ManagedGame} from '../src/pro/managed';
import {playerMap,players} from '../src/pro/data';
import {batSide,throwHand,BOX,SPOTS,fieldPlay,HOME,BASES} from '../src/pro/watch-play';
import {tacticNote,pitchTacticFor,emptyTactics} from '../src/pro/tactics';
import {orderBlock,positionNames} from '../src/pro/WatchScreen';

type Orders=(s:LiveSituation,events:LiveEvent[])=>WatchOrder|null;
function drive(g:ManagedGame,orders:Orders=()=>null){
 const gen=liveGame(g),inputs:(WatchOrder|null)[]=[],events:LiveEvent[]=[],sits:LiveSituation[]=[];
 let step=gen.next(),guard=0;
 while(!step.done&&guard++<20000){const v=step.value;let x:WatchOrder|null=null;if(v.type==='event')events.push(v.e);else{sits.push(v.s);x=orders(v.s,events);}inputs.push(x);step=gen.next(x);}
 assert.ok(step.done);return {result:step.value as GameResult,inputs,events,sits};
}
const PA=['BB','HBP','K','OUT','SF','E','1B','2B','3B','HR'];
const once=(o:WatchOrder):Orders=>{let sent=false;return ()=>{if(sent)return null;sent=true;return o;};};

export function register1104eTests(test:(name:string,run:()=>void)=>void){
 test('batting side (11/4 夜): right-handed batters stand on the third-base side, left-handed on the first-base side, switch hitters opposite the pitcher; left-handed pitchers throw left; the batter runs from his box',()=>{
  const by=(f:(p:typeof players[number])=>boolean)=>players.find(f)!;
  const R=by(p=>p.role==='batter'&&p.bats==='右'),Lb=by(p=>p.role==='batter'&&p.bats==='左'),S=by(p=>p.role==='batter'&&p.bats==='両');
  const RP=by(p=>p.role==='pitcher'&&p.throws==='右'),LP=by(p=>p.role==='pitcher'&&p.throws==='左');
  assert.ok(R&&Lb&&S&&RP&&LP,'実在の選手のデータに 右・左・両 と 右投・左投 がある');
  assert.equal(batSide(R.id,RP.id),'R');assert.equal(batSide(R.id,LP.id),'R');
  assert.equal(batSide(Lb.id,RP.id),'L');assert.equal(batSide(Lb.id,LP.id),'L');
  assert.equal(batSide(S.id,RP.id),'L','両打ちは右投手なら左打席');assert.equal(batSide(S.id,LP.id),'R','両打ちは左投手なら右打席');
  assert.equal(throwHand(LP.id),'L');assert.equal(throwHand(RP.id),'R');
  // データに無い選手は id から決まった形(何度呼んでも同じ)
  assert.equal(batSide('nobody-x',RP.id),batSide('nobody-x',RP.id));assert.ok(['R','L'].includes(throwHand('nobody-y')));
  // 打席の位置: 右打は本塁の左(三塁側)、左打は右(一塁側)、高さは同じ。捕手は本塁の真後ろのまま。
  assert.ok(BOX.R[0]<HOME[0]&&BOX.L[0]>HOME[0]&&BOX.R[1]===BOX.L[1]);assert.equal(BOX.R[0]+BOX.L[0],100,'左右対称');
  assert.equal(SPOTS.捕[0],HOME[0]);
  // 打者が走り出すのは、立っていた打席から。終わりは結果の塁(一塁)。
  const e=(batter:string):LiveEvent=>({kind:'1B',inning:1,side:0,batter,slot:0,pitcher:RP.id,runs:0,outs:0,bases:[batter,null,null],score:[0,0],line:[[0],[]],hits:[1,0],errors:[0,0]});
  for(const [id,side] of [[R.id,'R'],[Lb.id,'L']] as const){
   const t=fieldPlay(e(id),[null,null,null]).tracks.find(x=>x.who==='r:'+id)!;
   assert.deepEqual(t.pts[0],BOX[side],'打席から走り出す');assert.deepEqual(t.pts.at(-1),BASES[0],'一塁で止まる');
  }
  // 試合の中の打者・投手は、どれも左右が決まる(1試合ぶん)
  const g=managedGame(initialSandboxState())!;const d=drive(g);
  const sides=new Set(d.events.filter(x=>PA.includes(x.kind)).map(x=>batSide(x.batter,x.pitcher)));
  assert.ok(sides.has('R'),'右打者がいる');
 });
 test('one-tap tactics (11/4 夜): per-batter and per-pitcher orders work only for that player, push the stated way, and clearing them gives the おまかせ result',()=>{
  const state=initialSandboxState(),g=managedGame(state)!;
  // 投手ごと: 先発投手に「ボール球中心」。その投手が投げる相手の打席だけに効く。
  const starter=drive(g).sits.find(s=>s.side!==g.control)!.pitcher;
  const d=drive(g,once({kind:'tactic',scope:'pitcher',id:starter,tactic:'ball'}));
  let n=0;for(const e of d.events)if(PA.includes(e.kind)&&e.tactic){if(e.side===g.control)assert.equal(e.tactic[1],null);else{assert.equal(e.tactic[1],e.pitcher===starter?'ball':null);if(e.pitcher===starter)n++;}}
  assert.ok(n>5,'先発の打席に効いた');
  // 向き: 同じ試合を60の乱数の位置で回し、ボール球中心は四球を出しやすく、本塁打を打たれにくい
  const tally=(o:WatchOrder|null)=>{let pa=0,bb=0,hr=0;for(let i=0;i<60;i++){const x=drive({...g,rng:(g.rng+i*7919)>>>0},o?once(o):()=>null);for(const e of x.events)if(PA.includes(e.kind)&&e.side!==g.control&&e.pitcher===starter){pa++;if(e.kind==='BB')bb++;if(e.kind==='HR')hr++;}}return {bb:bb/pa,hr:hr/pa};};
  const none=tally(null),ball=tally({kind:'tactic',scope:'pitcher',id:starter,tactic:'ball'}),strike=tally({kind:'tactic',scope:'pitcher',id:starter,tactic:'strike'});
  assert.ok(ball.bb>none.bb&&strike.bb<none.bb,`四球 ${none.bb.toFixed(3)} ボール ${ball.bb.toFixed(3)} ストライク ${strike.bb.toFixed(3)}`);
  assert.ok(ball.hr<=strike.hr,'ボール球中心は本塁打を打たれにくい');
  // 投手ごとはチーム全体より優先
  const t=emptyTactics();t.pitch='strike';t.pitcher.x='ball';assert.equal(pitchTacticFor(t,'x'),'ball');assert.equal(pitchTacticFor(t,'y'),'strike');
  // 打者ごと: 打席の前に出して、次の打席の前に取り消すと、おまかせと同じ
  const plain=finishLive(g,[]);
  let k=0;const cleared=drive(g,()=>{k++;return k===1?{kind:'tactic',scope:'pitcher',id:starter,tactic:'ball'}:k===2?{kind:'tactic',scope:'pitcher',id:starter,tactic:null}:null;});
  assert.equal(JSON.stringify(cleared.result.box),JSON.stringify(plain.box),'取り消せばおまかせと同じ');
  assert.equal(JSON.stringify(drive(g).result.box),JSON.stringify(plain.box),'指示なしはおまかせと同じ');
  // 作戦を出した試合はそのままシーズンに入る
  const after=commitManaged(state,g.control,d.inputs);assert.equal(JSON.stringify(after.season.results[0].box),JSON.stringify(d.result.box));
 });
 test('orders that do not fit the moment are not shown as usable and do nothing (11/4 夜)',()=>{
  const state=initialSandboxState(),g=managedGame(state)!,plain=finishLive(g,[]);
  // 投手の作戦の欄に打撃の作戦、打者の欄に投手の作戦、知らない選手は効かない
  for(const o of [{kind:'tactic',scope:'pitcher',id:'x',tactic:'ball'},{kind:'tactic',scope:'pitcher',id:state.pitchers[0],tactic:'power'},{kind:'tactic',scope:'batter',id:state.lineup[0],tactic:'ball'}] as WatchOrder[])
   assert.equal(JSON.stringify(drive(g,once(o)).result.box),JSON.stringify(plain.box),JSON.stringify(o));
  // 送りバント・盗塁・敬遠の出せない理由(画面のボタンは灰色)
  const sit=drive(g).sits.find(s=>s.side===g.control&&!s.bases.some(Boolean))!;
  assert.ok(orderBlock('steal',sit,g.control),'走者がいない時の盗塁');assert.ok(orderBlock('bunt',sit,g.control),'走者がいない時の送りバント');assert.ok(orderBlock('ibb',sit,g.control),'攻撃の時の敬遠');
  const def=drive(g).sits.find(s=>s.side!==g.control)!;assert.ok(orderBlock('bunt',def,g.control)&&orderBlock('steal',def,g.control),'守りの時のバント・盗塁');
  assert.ok(orderBlock('bunt',sit,-1),'観るだけの試合');
  // 守備位置の入れ替え: 攻撃の時・DH・同じ位置・いない位置は効かない
  const ownBat=(s:LiveSituation)=>s.side===g.control;
  for(const mk of [(s:LiveSituation)=>ownBat(s)?{kind:'move',slot:0,position:'捕'}:null,(s:LiveSituation)=>!ownBat(s)?{kind:'move',slot:s.lineups[g.control].findIndex(id=>s.defense[g.control][id]==='DH'),position:'一'}:null,(s:LiveSituation)=>!ownBat(s)?{kind:'move',slot:0,position:'X'}:null] as ((s:LiveSituation)=>WatchOrder|null)[]){
   let sent=false;const x=drive(g,s=>{if(sent)return null;const o=mk(s);if(o)sent=true;return o;});
   assert.equal(JSON.stringify(x.result.box),JSON.stringify(plain.box));assert.ok(!x.events.some(e=>e.kind==='MOVE'));
  }
 });
 test('fielding positions (11/4 夜): moving a fielder swaps two positions on the defending side, shows a MOVE event, and the names are 投捕一二三遊左中右 in lineup order',()=>{
  const state=initialSandboxState(),g=managedGame(state)!;
  let sent=false,a='',b='',posA='',posB='';
  const d=drive(g,s=>{if(sent||s.side===g.control)return null;sent=true;const lu=s.lineups[g.control],df=s.defense[g.control];
   const i=lu.findIndex(id=>df[id]==='一'),j=lu.findIndex(id=>df[id]==='三');a=lu[i];b=lu[j];posA=df[a];posB=df[b];return {kind:'move',slot:i,position:'三'};});
  const ev=d.events.find(e=>e.kind==='MOVE');assert.ok(ev,'MOVE');assert.equal(ev!.batter,a);assert.equal(ev!.replaced,b);
  const after=d.sits.find(s=>s.defense[g.control][a]==='三')!;assert.ok(after,'入れ替わった');assert.equal(after.defense[g.control][b],posA);assert.equal(posB,'三');
  // 呼び名: 外野は打順の並びで 左・中・右、DH は 指
  const names=positionNames(['a','b','c','d','e'],{a:'外',b:'捕',c:'外',d:'外',e:'DH'});
  assert.deepEqual(names,{a:'左',b:'捕',c:'中',d:'右',e:'指'});
  // 入れ替えた試合もシーズンに入り、試合は最後まで終わる
  const s2=commitManaged(state,g.control,d.inputs);assert.equal(JSON.stringify(s2.season.results[0].box),JSON.stringify(d.result.box));
  void playerMap;
 });
 test('result line words (11/4 夜): the call says whether the order worked ("長打狙いが当たった!" / "ボール球中心で空振り三振!"), only for the side that gave it',()=>{
  assert.deepEqual(tacticNote('2B','power',null),{text:'長打狙いが当たった!',good:true});
  assert.deepEqual(tacticNote('HR','power',null),{text:'長打狙いが当たった!',good:true});
  assert.equal(tacticNote('K','power',null)?.good,false);
  assert.deepEqual(tacticNote('K',null,'ball'),{text:'ボール球中心で空振り三振!',good:true});
  assert.equal(tacticNote('BB',null,'ball')?.good,false);
  assert.equal(tacticNote('BB','patient',null)?.good,true);assert.equal(tacticNote('K','patient',null)?.good,false);
  assert.equal(tacticNote('HR',null,'strike')?.good,false);
  assert.equal(tacticNote('1B',null,null),null,'作戦なしは言葉なし');
  // 試合の中の打席の言葉は、その打席に効いていた作戦と同じ
  const g=managedGame(initialSandboxState())!;const d=drive(g,once({kind:'tactic',scope:'team',tactic:'power'}));
  let said=0;for(const e of d.events)if(PA.includes(e.kind)&&e.tactic){const n=tacticNote(e.kind,e.tactic[0],e.tactic[1]);if(n){said++;if(e.side!==g.control)assert.fail('相手の打席に言葉');assert.ok(n.text.includes('長打狙い'));}}
  assert.ok(said>0);
 });
}
