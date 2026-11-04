// 監督して戦う試合(2026-11-04 vc43 作り直し)。
// 持ち主「今年の名場面を見るとかじゃなくて、CS、開幕戦、日本シリーズが出た場合、自分で監督操作が出来るみたいな感じにして」。
// 「1年進める」の途中、自分のチームの大事な試合(開幕戦・プレーオフ(CS)・国内の王座決定戦・世界/宇宙の王座決定戦)の前で止め、
// 「監督して戦う」か「おまかせで進める」を選ぶ。監督した試合の結果は、そのままシーズン(勝敗・順位・成績・勝ち上がり・報酬)に入る。
// 乱数: その日の試合は今までどおり1本の乱数の列を順に使う。自分の試合は、その位置から監督の指示を受けながら回す。
// 何も指示しなければ、おまかせ(1年進める)とまったく同じ結果。指示を出すと、その試合と、その後の結果が変わる。
import {gameSteps,playGame,rng,simulateDays,type GameResult,type GameState,type LiveStep,type OwnRunner,type WatchOrder} from './engine';
import {newPostseason,simulatePostseason} from './postseason';
import {circuitOf} from './leagues';
import {seriesName} from './watch';
import {emptyFielding} from './fielding-stats';

export type KeyKind='opening'|'post';
export interface KeyGame {kind:KeyKind;label:string;key:string}
/** 次に進める日に、自分のチームの大事な試合があるか。あれば、その試合の名前と、止まった場所の印(key)。 */
export function keyGameAhead(state:GameState):KeyGame|null{
 const season=state.season,club=state.club;
 if(!season.completed){
  if(season.day!==0||season.results.length>0)return null;
  return {kind:'opening',label:'開幕戦',key:`${club}|${season.number}|r0`};
 }
 if(season.postseason?.stage==='complete')return null;
 const post=season.postseason??newPostseason(season),space=circuitOf(season)==='SPACE';
 const s=post.series.find(x=>x.stage===post.stage&&!x.winner&&(x.higher===club||x.lower===club));
 if(!s)return null;
 return {kind:'post',label:`${seriesName(s,space)} 第${s.results.length+1}戦`,key:`${club}|${season.number}|p${post.day}|${s.id}|${s.results.length}`};
}
/** その日を1日進める(自分の試合だけ ownGame で回せる)。 */
export function advanceKeyDay(state:GameState,ownGame?:OwnRunner):GameState{
 return state.season.completed?simulatePostseason(state,1,ownGame):simulateDays(state,1,ownGame);
}
export interface ManagedGame extends KeyGame {base:GameState;home:string;away:string;rng:number;control:number}
/** 監督する試合の、試合の直前の状態(同じ日の先の試合を済ませた後)と乱数の位置。保存データは変えない。 */
export function managedGame(state:GameState):ManagedGame|null{
 const k=keyGameAhead(state);if(!k)return null;
 let found:ManagedGame|null=null;
 const capture:OwnRunner=(st,home,away,random)=>{
  if(!found)found={...k,base:structuredClone(st),home,away,rng:random.state>>>0,control:away===state.club?0:1};
  return playGame(st,home,away,random);
 };
 advanceKeyDay(state,capture);
 return found;
}
/** 画面で回す試合(指示を受けられる)。成績は「今日」の分だけを別の表に付ける(シーズンの表には入れる時に付ける)。 */
export function liveGame(g:ManagedGame):Generator<LiveStep,GameResult,WatchOrder|null|undefined>{
 return gameSteps(g.base,g.home,g.away,rng(g.rng),{interactive:true,control:g.control,tables:{batting:{},pitching:{},fielding:emptyFielding()}});
}
/** 監督した試合をシーズンに入れて、その日を進める。inputs は画面で渡した値の並び。 */
export function commitManaged(state:GameState,control:number,inputs:(WatchOrder|null)[]):GameState{
 return advanceKeyDay(state,(st,home,away,random)=>playGame(st,home,away,random,{control,inputs}));
}
/** 試合を最後まで回した結果(指示の並びを渡して)。テストと、画面の結果の確かめに使う。 */
export function finishLive(g:ManagedGame,inputs:(WatchOrder|null)[]):GameResult{
 const gen=liveGame(g);let step=gen.next(),at=0;
 while(!step.done)step=gen.next(inputs[at++]??null);
 return step.value;
}

// ---- 途中で閉じた時の続き(端末に覚える。セーブデータとは別なので、セーブは壊れない) ----
export interface SavedManage {v:1;key:string;control:number;inputs:(WatchOrder|null)[]}
export const manageKey=(profile:string)=>`diamond-nine-managed-${profile}`;
const validOrder=(o:unknown):boolean=>o===null||(!!o&&typeof o==='object'&&typeof (o as {kind?:unknown}).kind==='string'&&['bunt','steal','ibb','pinch','runner','field','pitcher'].includes((o as {kind:string}).kind));
export function readManage(profile:string,key:string,storage?:Pick<Storage,'getItem'>):SavedManage|null{
 try{const v=JSON.parse((storage??localStorage).getItem(manageKey(profile))??'null');
  if(!v||v.v!==1||v.key!==key||!Number.isInteger(v.control)||!Array.isArray(v.inputs)||v.inputs.length>20000||!v.inputs.every(validOrder))return null;
  return v as SavedManage;}catch{return null;}
}
export function saveManage(profile:string,data:SavedManage,storage?:Pick<Storage,'setItem'>){try{(storage??localStorage).setItem(manageKey(profile),JSON.stringify(data));}catch{/* 覚えられなくても試合はできる(閉じたら最初から) */}}
export function clearManage(profile:string,storage?:Pick<Storage,'removeItem'>){try{(storage??localStorage).removeItem(manageKey(profile));}catch{/* なし */}}
