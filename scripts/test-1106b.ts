// 11/6 夜(vc45 / 1.5.2)の試験。持ち主「守備でボールを取った時に、名前と肩・守の能力が出るようにしてください」。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialSandboxState,type GameResult,type LiveEvent,type LiveSituation,type WatchOrder} from '../src/pro/engine';
import {managedGame,liveGame} from '../src/pro/managed';
import {choreograph,POS_LABEL,POS_DATA,POSITIONS} from '../src/pro/field-sim';
import {NO_POS} from '../src/pro/plays';

const ctx={fielders:{P:'p',C:'c','1B':'a','2B':'b','3B':'d',SS:'e',LF:'f',CF:'g',RF:'h'},rate:(id:string)=>({speed:id.length*9%100,field:60,arm:55+id.length*3%30})};
function games(n=14){
 const state=initialSandboxState(),g=managedGame(state)!,out:{e:LiveEvent;before:(string|null)[]}[]=[];
 for(let i=0;i<n;i++){
  const gen=liveGame({...g,rng:(g.rng+i*7919)>>>0});let step=gen.next(),guard=0,bases:(string|null)[]=[null,null,null],key='';
  while(!step.done&&guard++<20000){const v=step.value;let x:WatchOrder|null=null;
   if(v.type==='event'){const e=v.e,k=`${e.inning}|${e.side}`;if(k!==key){bases=[null,null,null];key=k;}const before=bases;bases=e.bases;if(!['PINCH','RUNNER','FIELD','PITCHER','MOVE'].includes(e.kind))out.push({e,before});}
   else{const s:LiveSituation=v.s;x=s.side===g.control&&s.outs<2&&(s.bases[0]||s.bases[1])&&i%3===0?{kind:'bunt'}:null;}
   step=gen.next(x);}
  void (step.value as GameResult);
 }
 return out;
}

export function register1106bTests(test:(name:string,run:()=>void)=>void){
 test('fielder card (11/6 night): every caught ball (ground/fly/liner/pop out, double play, fielder\'s choice, sac fly, fine play, bunt) marks who caught it and when; hits, errors, homers, walks and strikeouts do not',()=>{
  const seen=new Set<string>();let caught=0;
  for(const {e,before} of games()){
   const c=choreograph(e,before,ctx),ca=c.catchAt;
   if(['OUT','DP','FC','TP','SF','BUNT','BUNT_FAIL'].includes(e.kind)){
    assert.ok(ca,`${e.kind} ${c.motion} に捕った瞬間が無い`);
    if(e.play)assert.equal(ca!.pos,NO_POS[e.play.fielder],`${e.kind} 捕った野手が試合の計算と違う`);
    assert.ok(ca!.t>0&&ca!.t<c.len,`${e.kind} 捕った時刻 ${ca!.t} は動きの中(${c.len})`);
    // 捕った時刻に、打球(ゴロ・フライ)がちょうど着く
    assert.ok(c.ball.some(b=>(b.kind==='ground'||b.kind==='air')&&Math.abs(b.t1-ca!.t)<.02),`${e.kind} ${c.motion} 打球の着く時刻と合う`);
    seen.add(c.motion);caught++;
   }else assert.ok(!ca,`${e.kind} ${c.motion} は捕球ではない`);
  }
  assert.ok(caught>200,`捕球 ${caught}`);
  for(const m of ['ground-out','fly-out','double-play','bunt'])assert.ok(seen.has(m),m);
 });
 test('fielder card (11/6 night): position labels cover all nine and outfielders use the game\'s 外 for the position defense',()=>{
  for(const p of POSITIONS){assert.ok(POS_LABEL[p]&&POS_LABEL[p].length===1);assert.ok(POS_DATA[p]);}
  assert.equal(POS_DATA.LF,'外');assert.equal(POS_DATA.SS,'遊');
 });
 test('fielder card (11/6 night): shown over the commentary strip (not on the field), name + 肩 + 守備 with the same grade tiles as the batter, auto-hides, none at 4x+ or when skipping, stays with the fine-play effect',()=>{
  const w=readFileSync('src/pro/WatchScreen.tsx','utf8'),css=readFileSync('src/pro/watch.css','utf8');
  assert.ok(w.includes('<div className="wt-callbox">')&&w.includes('{l.fcard&&fieldCard(l.fcard)}</div>'),'実況の帯に重ねる');
  assert.ok(/<Mini v=\{dv\.arm\} label="肩"\/><Mini v=\{dv\.field\} label="守備"\/>/.test(w),'肩・守備は打者と同じ Mini');
  assert.ok(w.includes('defenseAtPosition(p,POS_DATA[c.pos],raw)'),'その守備位置での値');
  assert.ok(w.includes('sp<=2)showCard('),'4倍以上は出さない');
  assert.ok(w.includes('d.fine?Math.max(1400/sp,(d.len-ca.t)*1000/sp+400)'),'ファインプレーは動きの終わりまで出して演出につなぐ');
  assert.ok(w.includes("sp>=2?1100:1400"),'1.1〜1.4 秒');
  for(const f of ['const settle=','const skipPlate=','const skipInning=','const skipGame='])assert.ok(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[^\\n]*dropCard').test(w),f+' で札を消す');
  assert.ok(w.includes('l.hold=null;l.moves=null;dropCard(l);'),'次の打者の投球には残さない');
  assert.ok(w.includes("fxNew.kind==='FINE'")&&w.includes('Math.max(900,fxNew.ms)'),'ファインプレーは演出と一緒');
  const card=css.slice(css.indexOf('.wt-root .wt-fcard{'));
  assert.ok(/\.wt-fcard\{[^}]*pointer-events:none/.test(card),'押せない(タップで閉じない)');
  assert.ok(!/fieldCard[^;]*onClick/.test(w),'タップで閉じる形にしない');
 });
}
