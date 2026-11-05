// 開発用(出荷物には入らない): 試合の画面のグラウンドの動きを、場面を決めて繰り返し見る。録画の確かめに使う。
// http://127.0.0.1:<port>/motion-demo.html?k=groundout(場面の名前は下の SCENES)
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {choreograph,pitchClip,stillScene,type Choreo,type SimCtx} from '../src/pro/field-sim';
import {FieldCanvas,type FieldScene} from '../src/pro/FieldCanvas';
import {playWord} from '../src/pro/watch';
import type {LiveEvent,LiveKind} from '../src/pro/engine';
import type {PlayDetail} from '../src/pro/plays';
import {PlayFx} from '../src/pro/PlayFx';
import {fxFor,readFxLevel,type Fx} from '../src/pro/play-fx';
import {teamColor,uniformsFor} from '../src/pro/team-colors';
import '../src/pro/watch.css';
import '../src/pro/match.css';

const ctx:SimCtx={fielders:{P:'p',C:'c','1B':'f1','2B':'f2','3B':'f3',SS:'ss',LF:'lf',CF:'cf',RF:'rf'},rate:id=>({speed:id==='fast'?95:60,field:62,arm:id==='cf'?80:62})};
/** 実況の表と同じ向きの言葉になる inning・slot を探す。 */
function at(kind:LiveKind,word:string){for(let i=0;i<9;i++)for(let s=0;s<9;s++)if(!word||playWord(kind,i,s)===word)return {inning:i,slot:s};return {inning:0,slot:0};}
interface Scene {label:string;kind:LiveKind;word?:string;before:(string|null)[];after:(string|null)[];pitches:string[];batter?:string;play?:PlayDetail;runs?:number;walkoff?:boolean;outs?:number}
const B='bat';
const SCENES:Record<string,Scene>={
 pitch:{label:'投球(ボール・見逃し・ファウル・空振り)',kind:'K',before:[null,null,null],after:[null,null,null],pitches:['B','S','F','B','S']},
 strikeout:{label:'空振り三振',kind:'K',before:[null,null,null],after:[null,null,null],pitches:['S','S']},
 groundout:{label:'ショートゴロ 一塁へ(走者一塁)',kind:'OUT',word:'ショートゴロ',before:['r1',null,null],after:['r1',null,null],pitches:['B','X']},
 groundout2:{label:'セカンドゴロ・ファインプレー',kind:'OUT',word:'セカンドゴロ',before:[null,null,null],after:[null,null,null],pitches:['X']},
 firstgo:{label:'ファーストゴロ(投手が一塁へ)',kind:'OUT',word:'ファーストゴロ',before:[null,null,null],after:[null,null,null],pitches:['X']},
 fly:{label:'外野フライ(走者二塁は戻る)',kind:'OUT',word:'レフトフライ',before:[null,'r2',null],after:[null,'r2',null],pitches:['S','X']},
 tagup:{label:'犠牲フライ タッチアップ',kind:'SF',word:'センター',before:[null,null,'r3'],after:[null,null,null],pitches:['X']},
 single:{label:'単打(二塁走者が還る・滑り込み)',kind:'1B',word:'ライト',before:[null,'fast',null],after:[B,null,null],pitches:['B','X']},
 single2:{label:'三遊間を抜く単打',kind:'1B',word:'三遊間',before:['r1',null,null],after:[B,'r1',null],pitches:['X']},
 double:{label:'二塁打 中継(一塁走者が還る)',kind:'2B',word:'左中間',before:['fast',null,null],after:[null,B,null],pitches:['X']},
 triple:{label:'三塁打 中継・滑り込み',kind:'3B',word:'ライト',before:[null,null,null],after:[null,null,B],pitches:['F','X']},
 homerun:{label:'ホームラン(走者二人)',kind:'HR',word:'レフト',before:['r1',null,'r3'],after:[null,null,null],pitches:['B','X']},
 steal:{label:'盗塁成功',kind:'SB',before:['fast',null,null],after:[null,'fast',null],pitches:[]},
 caught:{label:'盗塁失敗',kind:'CS',before:['r1',null,null],after:[null,null,null],pitches:[]},
 bunt:{label:'送りバント',kind:'BUNT',before:['r1',null,null],after:[null,'r1',null],pitches:['X']},
 error:{label:'エラー',kind:'E',word:'ショート',before:[null,null,null],after:[B,null,null],pitches:['X']},
 walk:{label:'フォアボール(押し出し)',kind:'BB',before:['r1','r2','r3'],after:[B,'r1','r2'],pitches:['B','B','B','B']},
 // 11/5 昼: 試合の計算のプレー(plays.ts)どおりの動き
 dp643:{label:'ショートゴロ 6-4-3 のダブルプレー',kind:'DP',before:['r1',null,null],after:[null,null,null],pitches:['B','X'],outs:2,play:{bb:'gb',fielder:6,word:'ショートゴロ',seq:'6-4-3',dp:true,fates:[{id:'r1',from:0,to:-1,out:'force',at:1,by:[6,4]},{id:B,from:-1,to:-1,out:'force',at:0,by:[4,3]}]}},
 dp463:{label:'セカンドゴロ 4-6-3 のダブルプレー',kind:'DP',before:['r1',null,null],after:[null,null,null],pitches:['X'],outs:2,play:{bb:'gb',fielder:4,word:'セカンドゴロ',seq:'4-6-3',dp:true,fates:[{id:'r1',from:0,to:-1,out:'force',at:1,by:[4,6]},{id:B,from:-1,to:-1,out:'force',at:0,by:[6,3]}]}},
 force:{label:'フォースアウト(一二塁のサードゴロ、三塁を踏む)',kind:'FC',before:['r1','r2',null],after:[B,'r1',null],pitches:['X'],play:{bb:'gb',fielder:5,word:'サードゴロ',seq:'5',fc:true,fates:[{id:'r2',from:1,to:-1,out:'force',at:2,by:[5]},{id:'r1',from:0,to:1},{id:B,from:-1,to:0}]}},
 force64:{label:'フォースアウト(ショートゴロ、二塁でアウト・打者は一塁)',kind:'FC',before:['r1',null,null],after:[B,null,null],pitches:['X'],play:{bb:'gb',fielder:6,word:'ショートゴロ',seq:'6-4',fc:true,fates:[{id:'r1',from:0,to:-1,out:'force',at:1,by:[6,4]},{id:B,from:-1,to:0}]}},
 tagout:{label:'タッチアウト(二塁走者が三塁へ、ショートから送球)',kind:'FC',before:[null,'r2',null],after:[B,null,null],pitches:['X'],play:{bb:'gb',fielder:6,word:'ショートゴロ',seq:'6-5',fc:true,fates:[{id:'r2',from:1,to:-1,out:'tag',at:2,by:[6,5]},{id:B,from:-1,to:0}]}},
 finedive:{label:'ファインプレー(ショートが飛びつく)',kind:'OUT',before:[null,null,null],after:[null,null,null],pitches:['X'],play:{bb:'gb',fielder:6,word:'ショートゴロ',seq:'6-3',fine:'dive',fates:[{id:B,from:-1,to:-1,out:'force',at:0,by:[6,3]}]}},
 fineof:{label:'ファインプレー(センターがダイビングキャッチ)',kind:'OUT',before:[null,null,null],after:[null,null,null],pitches:['X'],play:{bb:'fb',fielder:8,word:'センターフライ',seq:'8',fine:'dive',fates:[{id:B,from:-1,to:-1,out:'fly',by:[8]}]}},
 laser:{label:'レーザービーム(タッチアップの走者を本塁で刺す)',kind:'DP',before:[null,null,'r3'],after:[null,null,null],pitches:['X'],outs:2,play:{bb:'fb',fielder:8,word:'センターフライ',seq:'8-2',dp:true,laser:true,fates:[{id:B,from:-1,to:-1,out:'fly',by:[8]},{id:'r3',from:2,to:-1,out:'tag',at:3,by:[8,2]}]}},
 doubled:{label:'飛び出しの併殺(セカンドライナー、一塁へ)',kind:'DP',before:['r1',null,null],after:[null,null,null],pitches:['X'],outs:2,play:{bb:'ld',fielder:4,word:'セカンドライナー',seq:'4-3',dp:true,fates:[{id:B,from:-1,to:-1,out:'fly',by:[4]},{id:'r1',from:0,to:-1,out:'doubled',at:0,by:[4,3]}]}},
 walkoff:{label:'サヨナラヒット',kind:'1B',word:'ライト',before:[null,'fast',null],after:[B,null,null],pitches:['X'],runs:1,walkoff:true},
 grand:{label:'満塁ホームラン',kind:'HR',word:'レフト',before:['r1','r2','r3'],after:[null,null,null],pitches:['X'],runs:4},
};
function Demo(){
 const q=new URLSearchParams(location.search),key=q.get('k')??'groundout',sp=Number(q.get('s')??1),sc=SCENES[key]??SCENES.groundout;
 const pos=at(sc.kind,sc.word??'');
 const e:LiveEvent={kind:sc.kind,inning:pos.inning,side:0,batter:sc.batter??B,slot:pos.slot,pitcher:'p',runs:sc.runs??(sc.kind==='HR'?sc.before.filter(Boolean).length+1:0),outs:sc.outs??1,bases:sc.after,score:[0,0],line:[[],[]],hits:[0,0],errors:[0,0],...(sc.play?{play:sc.play}:{})};
 const [fx,setFx]=useState<{f:Fx;n:number}|null>(null);
 const away=q.get('away')??'g',home=q.get('home')??'c',unis=uniformsFor(teamColor(away),teamColor(home));
 const still=stillScene(ctx,e,sc.before);
 const [clip,setClip]=useState<{c:Choreo;start:number;speed:number}|null>(null);
 const [n,setN]=useState(0);
 useEffect(()=>{let alive=true;const timers:number[]=[];const wait=(ms:number)=>new Promise<void>(r=>timers.push(window.setTimeout(r,ms)));
  (async()=>{await wait(700);
   for(let i=0;i<sc.pitches.length&&alive;i++){const c=pitchClip(ctx,e,sc.before,sc.pitches[i],{last:i===sc.pitches.length-1,bunt:sc.kind==='BUNT'&&i===sc.pitches.length-1});setClip({c,start:performance.now(),speed:sp});await wait(c.len*1000/sp+(sc.pitches[i]==='X'?0:150/sp));}
   if(!alive)return;const d=choreograph(e,sc.before,ctx);if(d.len>.15){setClip({c:d,start:performance.now(),speed:sp});await wait(d.len*1000/sp+80);}
   const f=fxFor(e,{comeback:false,walkoff:!!sc.walkoff,speed:sp,level:readFxLevel()});if(f&&alive){setFx({f,n:Date.now()});await wait(f.ms+300);setFx(null);}else await wait(800);
   if(alive){setClip(null);await wait(500);setN(x=>x+1);}})();
  return()=>{alive=false;timers.forEach(clearTimeout);};},[n]);// 繰り返す
 const scene:FieldScene={still,clip,defColor:'blue',batColor:'red',defUni:unis[1],batUni:unis[0],lefty:false,leftyBat:q.get('lb')==='1'};
 return <div className="wt-root" style={{position:'static',height:'100%',padding:0}}><div style={{display:'flex',flexDirection:'column',height:'100%',maxWidth:520,margin:'0 auto'}}>
  <p style={{margin:'8px 10px',fontWeight:800,height:40}} data-scene={key}>{sc.label} {clip?.c.motion??''} {sp}倍</p>
  <div style={{height:Number(q.get('fh')??420),display:'flex',flexDirection:'column',padding:'0 10px'}}><FieldCanvas scene={scene} className={'wt-field mt-field'+(fx&&fx.f.tier!=='small'?' is-shake':'')}>{fx&&<PlayFx fx={fx.f} level={readFxLevel()} n={fx.n}/>}</FieldCanvas></div>
 </div></div>;
}
createRoot(document.getElementById('root')!).render(<Demo/>);
