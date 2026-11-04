// 監督して戦う試合(2026-11-04 vc43 作り直し)。
// 持ち主「今年の名場面を見るとかじゃなくて、CS、開幕戦、日本シリーズが出た場合、自分で監督操作が出来るみたいな感じにして」。
// 「1年進める」の途中、自分のチームの大事な試合(開幕戦・プレーオフ(CS)・国内の王座決定戦・世界/宇宙の王座決定戦)の前で止め、
// 「監督して戦う」か「おまかせで進める」を選ぶ。監督した試合の結果は、そのままシーズン(勝敗・順位・成績・勝ち上がり・報酬)に入る。
// 乱数: その日の試合は今までどおり1本の乱数の列を順に使う。自分の試合は、その位置から監督の指示を受けながら回す。
// 何も指示しなければ、おまかせ(1年進める)とまったく同じ結果。指示を出すと、その試合と、その後の結果が変わる。
import {gameSteps,playGame,rng,simulateDays,type GameResult,type GameState,type LiveStep,type OwnRunner,type WatchOrder} from './engine';
import {newPostseason,simulatePostseason,type PostSeries} from './postseason';
import {circuitOf} from './leagues';
import {seriesName} from './watch';
import {emptyFielding} from './fielding-stats';
import {orderBlock,withStartOrder,type StartOrder} from './lineup';

export type KeyKind='opening'|'post';
export interface KeyGame {kind:KeyKind;label:string;key:string;series?:string;reason?:string}
/** 次に進める日に、自分のチームの大事な試合があるか。あれば、その試合の名前と、止まった場所の印(key)。
 * 11/4 夜(持ち主「CS シリーズは全部じゃなくて、大事な試合だけ監督として出来るようにして」): 短期決戦は、各シリーズの第1戦と、
 * どちらかがあと1勝で勝ち抜け・優勝になる試合(王手。アドバンテージの勝ちも数える。最終戦もここに入る)だけ。途中の試合は null(止まらない)。
 * reason=なぜ大事かの一言(ホームの札の見出し)。 */
export function keyGameAhead(state:GameState):KeyGame|null{
 const season=state.season,club=state.club;
 if(!season.completed){
  if(season.day!==0||season.results.length>0)return null;
  return {kind:'opening',label:'開幕戦',key:`${club}|${season.number}|r0`,reason:'開幕戦'};
 }
 if(season.postseason?.stage==='complete')return null;
 const post=season.postseason??newPostseason(season),circuit=circuitOf(season),space=circuit==='SPACE';
 const s=post.series.find(x=>x.stage===post.stage&&!x.winner&&(x.higher===club||x.lower===club));
 if(!s)return null;
 const reason=keyReason(s,club,circuit,post.series.filter(x=>x!==s&&x.results.length>0&&(x.higher===club||x.lower===club)).length===0);
 if(!reason)return null;
 return {kind:'post',label:`${seriesName(s,space)} 第${s.results.length+1}戦`,key:`${club}|${season.number}|p${post.day}|${s.id}|${s.results.length}`,series:seriesKey(state,s.id),reason};
}
/** 短期決戦の試合が大事か(第1戦・王手)。大事でなければ ''。first=自分のチームの最初のシリーズ(「CS 進出!」)。 */
export function keyReason(s:Pick<PostSeries,'stage'|'wins'|'target'|'results'|'higher'>,club:string,circuit:string,first:boolean):string{
 const name=seriesName(s,circuit==='SPACE'),mine=s.higher===club?0:1;
 const prize=s.stage==='japan'?'国内王座':s.stage==='world'?(circuit==='SPACE'?'宇宙王座':'世界王座'):'勝ち抜け';
 const reachMine=s.wins[mine]>=s.target-1,reachThem=s.wins[1-mine]>=s.target-1;
 if(reachMine&&reachThem)return `最終決戦! 勝てば${prize}`;
 if(reachMine)return `王手! 勝てば${prize}`;
 if(reachThem)return '負ければ終わり';
 if(s.results.length===0)return first?'プレーオフ進出!':`${name} 第1戦`;
 return '';
}
/** 短期決戦の印(シーズンとシリーズ)。「このシリーズの残りを一気に進める」に使う。 */
export const seriesKey=(state:GameState,id:string)=>`${state.club}|${state.season.number}|${id}`;
// ---- 止まるかどうか(2026-11-04 持ち主「CS とか日本シリーズとかも一気に進めれるように。というか、選べるようにして」) ----
// noStop=設定の「大事な試合でも止まらない」(端末に覚える。最初は止まる)。skipSeries=このシリーズの残りを一気に進めると選んだシリーズ。
export interface StopRules {noStop:boolean;skipSeries:string|null}
export function stopAt(state:GameState,rules:StopRules):KeyGame|null{
 if(rules.noStop)return null;
 const k=keyGameAhead(state);
 if(!k||(k.series&&k.series===rules.skipSeries))return null;
 return k;
}
export const NO_STOP_KEY='diamond-nine-keygame-nostop';
export function readNoStop(storage?:Pick<Storage,'getItem'>):boolean{try{return (storage??localStorage).getItem(NO_STOP_KEY)==='1';}catch{return false;}}
export function saveNoStop(on:boolean,storage?:Pick<Storage,'setItem'|'removeItem'>){try{const s=storage??localStorage;if(on)s.setItem(NO_STOP_KEY,'1');else s.removeItem(NO_STOP_KEY);}catch{/* 覚えられなくても止まるだけ */}}
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
/** 監督した試合をシーズンに入れて、その日を進める。inputs は画面で渡した値の並び。
 *  order=その試合だけのスタメン(2026-11-05。スタメンを決める画面)。その試合の間だけ自分のチームの打順・守備・投手の並びを替え、終わったら戻す。 */
export function commitManaged(state:GameState,control:number,inputs:(WatchOrder|null)[],order?:StartOrder|null):GameState{
 return advanceKeyDay(state,(st,home,away,random)=>{
  if(!order)return playGame(st,home,away,random,{control,inputs});
  const keep={lineup:st.lineup,defense:st.defense,pitchers:st.pitchers},use=withStartOrder(st,order);
  st.lineup=use.lineup;st.defense=use.defense;st.pitchers=use.pitchers;
  try{return playGame(st,home,away,random,{control,inputs});}finally{st.lineup=keep.lineup;st.defense=keep.defense;st.pitchers=keep.pitchers;}
 });
}
/** その試合だけのスタメンで回す試合(試合の直前の状態の打順・守備・投手の並びを替える)。 */
export function withOrder(g:ManagedGame,order:StartOrder|null|undefined):ManagedGame{return order?{...g,base:withStartOrder(g.base,order)}:g;}
/** 試合を最後まで回した結果(指示の並びを渡して)。テストと、画面の結果の確かめに使う。 */
export function finishLive(g:ManagedGame,inputs:(WatchOrder|null)[]):GameResult{
 const gen=liveGame(g);let step=gen.next(),at=0;
 while(!step.done)step=gen.next(inputs[at++]??null);
 return step.value;
}

// ---- 途中で閉じた時の続き(端末に覚える。セーブデータとは別なので、セーブは壊れない) ----
export interface SavedManage {v:1;key:string;control:number;inputs:(WatchOrder|null)[];mode?:'manage'|'watch';order?:StartOrder|null}
export const manageKey=(profile:string)=>`diamond-nine-managed-${profile}`;
const validOrder=(o:unknown):boolean=>o===null||(!!o&&typeof o==='object'&&typeof (o as {kind?:unknown}).kind==='string'&&['bunt','steal','ibb','pinch','runner','field','pitcher','move','tactic'].includes((o as {kind:string}).kind));
const validStart=(o:unknown):boolean=>o===undefined||o===null||(!!o&&typeof o==='object'&&Array.isArray((o as StartOrder).lineup)&&Array.isArray((o as StartOrder).pitchers)&&!!(o as StartOrder).defense&&typeof (o as StartOrder).defense==='object');
export function readManage(profile:string,key:string,storage?:Pick<Storage,'getItem'>):SavedManage|null{
 try{const v=JSON.parse((storage??localStorage).getItem(manageKey(profile))??'null');
  if(!v||v.v!==1||v.key!==key||!Number.isInteger(v.control)||!Array.isArray(v.inputs)||v.inputs.length>20000||!v.inputs.every(validOrder))return null;
  if(v.mode!==undefined&&v.mode!=='manage'&&v.mode!=='watch')return null;
  if(!validStart(v.order))return null;
  return v as SavedManage;}catch{return null;}
}
export function saveManage(profile:string,data:SavedManage,storage?:Pick<Storage,'setItem'>){try{(storage??localStorage).setItem(manageKey(profile),JSON.stringify(data));}catch{/* 覚えられなくても試合はできる(閉じたら最初から) */}}
export function clearManage(profile:string,storage?:Pick<Storage,'removeItem'>){try{(storage??localStorage).removeItem(manageKey(profile));}catch{/* なし */}}
/** 続きから開く時のスタメン: 覚えたスタメンが、いまのチームでも通る時だけ使う(通らなければ最初からやり直す)。 */
export function savedOrderOk(state:GameState,o:StartOrder|null|undefined){return !o||!orderBlock(state,o);}
