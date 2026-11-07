// 11/7(vc47 / 1.5.4、午後の直し vc48 / 1.5.5)の試験。持ち主「試合画面もっと大きくしてください。上の方に色々スコアボードとか情報ありますけど、これなくして。
// タイムボタンからこういうのは見れるようにしてください。試合画面を大きくして、試合画面を良い感じに見れるようにしてください」。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projection,toScreen,figH,padBottom,followSpot,HOME_CAM} from '../src/pro/FieldCanvas';
import {MATCH_GUIDE} from '../src/pro/guide';
import {PLATE,BAGS,READY} from '../src/pro/field-sim';

export function register1107Tests(test:(name:string,run:()=>void)=>void){
 test('big match screen (11/7): the scoreboard, header, batter/pitcher strip and tactics leave the screen; the field, a small corner badge, the commentary line and one row of buttons stay',()=>{
  const w=readFileSync('src/pro/WatchScreen.tsx','utf8'),main=w.slice(w.indexOf('<div className="wt-wrap wt-one wt-big">'),w.indexOf('{l.flash&&'));
  assert.ok(main.length>100,'試合の画面の本体');
  for(const x of ['scoreboard()','wt-head','FitTitle'])assert.ok(!main.includes(x),`常には出さない: ${x}`);
  // 11/7 午後(持ち主「選手の能力とか成績くらいは出るようにして。あと指示も出せるようにくらいは」): 打者と投手の帯と作戦・指示は常に出す
  for(const x of ['field()','<div className="wt-callbox">','speedBar()','{!fin&&duelCards()}','{control>=0&&managerPanel()}'])assert.ok(main.includes(x),`出す: ${x}`);
  const bar=w.slice(w.indexOf('const speedBar='),w.indexOf('const mine='));assert.ok(bar.includes('{timeBtn()}'),'下の1列にタイム');
  // 隅の札: 点・回・B/S/O・走者
  const cp=w.slice(w.indexOf('const countPanel='),w.indexOf('const fieldCard='));
  for(const x of ['mt-mini-score','wt-inn','wt-lamps','wt-bases','<small>B</small>','<small>S</small>','<small>O</small>'])assert.ok(cp.includes(x),`札に ${x}`);
  const css=readFileSync('src/pro/timeout.css','utf8');
  assert.ok(/\.wt-big \.wt-count\.is-overlay\{[^}]*rgba\(6,16,42,\.(\d+)\)/.test(css)&&Number(css.match(/\.wt-big \.wt-count\.is-overlay\{[^}]*rgba\(6,16,42,\.(\d+)\)/)![1])<80,'札は半透明');
  assert.ok(/\.wt-big \.wt-count\.is-overlay\{[^}]*pointer-events:none/.test(css),'札は押せない(下の走者のボタンを邪魔しない)');
  assert.ok(/\.wt-big \.mt-mini-score\{[^}]*display:grid/.test(css),'点は背の高い画面でも札に出す');
  assert.ok(css.includes('orientation:landscape'),'横向きの並び');
  for(const m of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(m[1])>=11,`字 ${m[1]}px`);
 });
 test('time window (11/7): タイム pauses the game and shows the score, batter and pitcher, and the manager orders; sheets opened from it return to it; closing goes straight back to the game',()=>{
  const w=readFileSync('src/pro/WatchScreen.tsx','utf8'),ts=w.slice(w.indexOf('const timeSheet='),w.indexOf('const timeBtn='));
  for(const x of ["['score','スコア']","['duel','打者・投手']","['manage','采配']",'scoreboard()','duelCards(false)','duelBody(false)','managerPanel()',"openSheet('box')","openSheet('opp')",'試合に戻る','中断して戻る','onClick={back}'])assert.ok(ts.includes(x),`タイムに ${x}`);
  assert.ok(w.includes("const closeSheet=()=>{const back=fromTime.current;fromTime.current=false;setSheet(back?'time':null);};"),'タイムから開いたシートはタイムに戻る');
  assert.ok(w.includes("fromTime.current=sheetRef.current==='time'&&s!=='time'"));
  assert.ok(/useEffect\(\(\)=>\{if\(sheet\)\{settle\(\);render\(\);\}else if/.test(w),'シート(タイムも)を開くと試合は止まる');
  assert.ok(!/onClose=\{\(\)=>setSheet\(null\)\}/.test(w),'どのシートも closeSheet で閉じる');
  assert.ok(MATCH_GUIDE.some(x=>x.target==='.wt-root .wt-time-btn'),'案内はタイムも指す');
  assert.ok(w.includes("const duelCards=(keep=true)")&&w.includes("onClick:()=>openSheet('duel')"),'帯を押すと詳しい能力');
  const css=readFileSync('src/pro/timeout.css','utf8');assert.ok(/\.wt-big \.wt-duel\.is-strip \.wt-mini\{[^}]*grid-template-rows:auto/.test(css),'帯の能力は1行(薄く)');
 });
 test('field camera (11/7): a tall phone uses its height (deeper view, figures a little bigger), a wide screen is laid a little flatter and larger; the plate, bases and every fielder stay inside',()=>{
  const old=(W:number,H:number)=>Math.min((H-padBottom(H))/(95*.8),W/(80*(1-41.5/420)));
  for(const [W,H] of [[390,640],[390,560],[620,370],[560,330],[344,222]]){
   const pr=projection(W,H,HOME_CAM);
   for(const p of [PLATE,...BAGS,...Object.values(READY)]){const [x,y]=toScreen(pr,p);assert.ok(x>=0&&x<=W&&y>=0&&y<=H,`${W}x${H} ${p} → ${Math.round(x)},${Math.round(y)}`);}
   const [,yh]=toScreen(pr,PLATE),[,y2]=toScreen(pr,BAGS[1]);assert.ok(yh-y2>=BAGS[1][1]*old(W,H)*.8*.95,`${W}x${H} 内野は前より小さくしない`);
   assert.ok(pr.T>=.68&&pr.T<=1.15);
  }
  const tall=projection(390,640,HOME_CAM);assert.ok(tall.T>1&&figH(tall,0)>figH({...tall,T:.8},0),'縦長は奥行きを伸ばし、人形も少し大きい');
  const wide=projection(620,370,HOME_CAM);assert.ok(wide.S>old(620,370)*1.1&&wide.T<.8,'横長は大きく映す');
  const usual=projection(392,300,HOME_CAM);assert.ok(usual.T<=.8+1e-9);
 });
 test('fielder tag (11/7 夕): the tag sits just above the fielder, inside the picture, and never over the corner badge',()=>{
  const W=390,H=486,tw=150,th=24;
  let [l,t]=followSpot(200,300,40,tw,th,W,H);assert.ok(t+th<=300-40&&l>=4&&l+tw<=W-4,'頭の上');
  [l,t]=followSpot(380,300,40,tw,th,W,H);assert.ok(l+tw<=W-4,'右の端で切れない');
  [l,t]=followSpot(5,300,40,tw,th,W,H);assert.ok(l>=4,'左の端で切れない');
  [l,t]=followSpot(200,30,40,tw,th,W,H);assert.ok(t>=30&&t+th<=H,'上が切れる時は足の下');
  [l,t]=followSpot(120,H-10,40,tw,th,W,H);assert.ok(t+th<=H-62,'左下の札の所には出さない');
  const css=readFileSync('src/pro/timeout.css','utf8');assert.ok(/\.fc-follow\{[^}]*pointer-events:none/.test(css),'押せない');
 });
}
