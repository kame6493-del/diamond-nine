// 観戦モード(2026-11-04 vc43): 1試合を1打席ずつ観て、監督ができる画面。
// 見た目の手本は ChatGPT に作らせたデザイン案(Downloads/ios_release/d9_watch_1103/ui)。画像は人形・ボール・ベースだけ使い、残りは CSS。
// 同じ日の作り直し(持ち主「自分で監督操作が出来るみたいな感じにして」): 振り返り(今年の名場面)はやめ、「1年進める」の途中で止まった
// 大事な試合(開幕戦・プレーオフ・王座決定戦)をここで戦う。監督の指示は試合の結果に効き、結果はそのままシーズンに入る(managed.ts)。
// 何も指示しなければ、おまかせと同じ結果。画面で渡した値の並び(inputs)を覚えておき、途中で閉じても続きから再開できる。
// 11/4 追加(持ち主): 「おまかせで観る」(監督の操作なし・最初は2倍・途中で「ここから監督する」)、グラウンドでボール・打球・走者・守備が動く
// (watch-play.ts)、監督の「作戦」(長打狙い・ミート打ち・積極的に・慎重に/直球中心・変化球中心・ボール球中心・ストライク中心。tactics.ts)。
// 11/4 追加(持ち主「試合中に1打席の結果が出た際に、打率とか防御率とか動くようにしてください」): 打席の結果を見せた瞬間に、打者と投手の札・
// 成績表の今季の成績(試合前の表+この試合のここまで。live-stats.ts)を変え、変わった数字を少し光らせる(良くなった=緑・悪くなった=赤)。
// 計算は先の打席まで進んでいるので、見せた時の「この試合の成績」を写して使う(shownBat/shownPit)。結果を見せた打者・投手は次の打席が始まるまで札に残す(hold)。
import {useEffect,useLayoutEffect,useReducer,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {substituteBlock,IBB_PER_INNING,type BatStats,type GameResult,type GameState,type LiveEvent,type LiveSituation,type LiveStep,type PitStats,type WatchOrder} from './engine';
import {liveGame,type ManagedGame} from './managed';
import {formatAvg,formatIP,playerMap,teamById,type Ratings} from './data';
import {circuitOf} from './leagues';
import {isSpaceAlien} from './mlb-opponents';
import {alienVelocity} from './space-aliens';
import {gameSound,prepareWatchAudio,stopGameAudio} from './game-audio';
import {benchOf,callText,countOf,gradeClass,gradeOf,homeRunMillis,isPlateAppearance,liveRatings,paMillis,pitchesFor,pitchMillis,playMillis,readSpeed,saveSpeed,speeds,AUTO_SPEED_KEY,SPEED_KEY,type Speed} from './watch';
import {fieldPlay,trackAt,SPOTS,type FieldPlay} from './watch-play';
import {BAT_TACTICS,PITCH_TACTICS,batTacticFor,batTacticLabel,batTacticNote,pitchFit,pitchLength,pitchTacticLabel,pitchTacticNote,type BatTactic,type PitchTactic} from './tactics';
import {avgText,batLine,batMove,eraText,ipText,pitLine,pitMove,snapshot,type BatLine,type BatMove,type Move,type PitLine,type PitMove} from './live-stats';
import {createPortal} from 'react-dom';
import './watch.css';

type Gen=Generator<LiveStep,GameResult,WatchOrder|null|undefined>;
/** 1打席の見せる順番: 盗塁の動き → 投球 → 打球と走者。 */
type Step={type:'pitches';e:LiveEvent}|{type:'play';e:LiveEvent;d:FieldPlay};
export type WatchMode='manage'|'watch';
interface Live {
 g:ManagedGame;gen:Gen;base:GameState;control:number;inputs:(WatchOrder|null)[];started:boolean;
 sit:LiveSituation|null;queue:LiveEvent[];nextSit:LiveSituation|null;result:GameResult|null;finished:GameResult|null;
 phase:'decide'|'pitch';pitches:string[];pitchShown:number;last:LiveEvent|null;
 log:{text:string;gold?:boolean}[];highlights:{inning:number;side:number;text:string}[];
 pitchCount:Record<string,number>;slotOf:Record<string,number>;posOf:Record<string,string>;
 pending:WatchOrder|null;paNo:number;fx:{kind:'hr';title:string;sub:string}|null;flash:string|null;
 steps:Step[];play:{d:FieldPlay;start:number;ms:number;e:LiveEvent}|null;shownBases:(string|null)[]|null;animated:boolean;
 tabBat:Record<string,BatStats>|null;tabPit:Record<string,PitStats>|null;shownBat:Record<string,BatStats>;shownPit:Record<string,PitStats>;
 hold:Hold|null;moves:{n:number;bat:BatMove|null;pit:PitMove|null}|null;moveNo:number;
}
/** 結果を見せた打席の打者と投手(次の打席が始まるまで札に残す)。 */
interface Hold {side:number;batter:string;slot:number;pitcher:string;pitchers?:string[][]}
const POS:Record<string,string>={捕:'捕',一:'一',二:'二',三:'三',遊:'遊',外:'外',DH:'指'};
const posLabel=(p?:string)=>p?POS[p]??p:'';
const nameOf=(id:string)=>playerMap[id]?.name??id;
const runLabel=(runs:number)=>runs>=4?'満塁ホームラン':runs===1?'ソロ':`${runs}ラン`;

type OrderKind='bunt'|'steal'|'ibb';
const tacticShort=(t:BatTactic|null)=>t?batTacticLabel[t]:'なし';
/** 指示が出せない理由(出せる時は '')。画面のボタンと、打席の直前の確かめの両方で使う。 */
function orderBlock(kind:OrderKind,sit:LiveSituation|null,control:number):string{
 if(control<0)return '観るだけの試合です(自分のチームが出ていない)';
 if(!sit)return '試合が終わりました';
 const atBat=sit.side===control;
 if(kind==='bunt')return !atBat?'送りバントは攻撃の時だけ':sit.outs>=2?'2死では送りバントできない':!(sit.bases[0]||sit.bases[1])?'一塁か二塁に走者がいる時だけ':'';
 if(kind==='steal')return !atBat?'盗塁は攻撃の時だけ':!sit.bases[0]?'一塁に走者がいる時だけ':sit.bases[1]?'二塁が空いている時だけ':'';
 return atBat?'敬遠は守りの時だけ':sit.bases.every(Boolean)?'満塁では敬遠できない':sit.ibbLeft<=0?`敬遠は1イニング${IBB_PER_INNING}回まで`:'';
}
/** 段のメダルとバー。 */
function Grade({v,label,wide=false}:{v:number;label:string;wide?:boolean}){
 return <div className={'wt-ab'+(wide?' is-wide':'')}><small>{label}</small><b className={gradeClass(v)}>{gradeOf(v)}</b><i><u className={gradeClass(v)} style={{width:`${Math.max(6,Math.min(100,v))}%`}}/></i></div>;
}
function Velocity({r,id,wide=false}:{r:Ratings;id:string;wide?:boolean}){
 const v=Math.round(r.velocity),shown=isSpaceAlien(playerMap[id])?alienVelocity(v):v,score=Math.max(0,Math.min(110,(r.velocity-120)/45*99));
 return <div className={'wt-ab'+(wide?' is-wide':'')}><small>球速</small><b className={'wt-kmh '+gradeClass(score)}>{shown}<em>km</em></b><i><u className={gradeClass(score)} style={{width:`${Math.max(6,Math.min(100,score))}%`}}/></i></div>;
}
/** 変わった数字: 「.287→.290」の形で、良くなった(up)・悪くなった(down)の色で少し光らせる。n は光らせ直すための番号。 */
function Moved({from,to,move,n,unit='',arrow=true}:{from:string;to:string;move?:Move;n?:number;unit?:string;arrow?:boolean}){
 if(!move||from===to)return <b>{to}{unit}</b>;
 // 打率・防御率は「.287→.290」、数(本塁打・打点・投球回など)は新しい数だけを光らせる。
 return <b key={n} className={'wt-mv is-'+move}>{arrow&&<><s>{from}</s><i aria-hidden="true">→</i></>}{to}{unit}</b>;
}
/** 札の今季の成績(打者): 打率・本塁打・打点。m=この打席で変わった所。 */
function BatSeason({line,m,n}:{line:BatLine;m:BatMove|null;n?:number}){
 return <div className="wt-sl" aria-label="今季の成績"><p><small>今季 打率</small><Moved from={m?avgText(m.from):''} to={avgText(line)} move={m?.avg} n={n}/></p>
  <p><small>本塁打</small><Moved from={m?String(m.from.hr):''} to={String(line.hr)} move={m?.hr} arrow={false} n={n}/><small>打点</small><Moved from={m?String(m.from.rbi):''} to={String(line.rbi)} move={m?.rbi} arrow={false} n={n}/></p></div>;
}
/** 札の今季の成績(投手): 防御率・投球回・奪三振・自責点。 */
function PitSeason({line,m,n}:{line:PitLine;m:PitMove|null;n?:number}){
 return <div className="wt-sl" aria-label="今季の成績"><p><small>今季 防御率</small><Moved from={m?eraText(m.from):''} to={eraText(line)} move={m?.era} n={n}/></p>
  <p><Moved from={m?ipText(m.from):''} to={ipText(line)} move={m?.ip} arrow={false} n={n} unit="回"/><small>奪三振</small><Moved from={m?String(m.from.so):''} to={String(line.so)} move={m?.so} arrow={false} n={n}/><small>自責</small><Moved from={m?String(m.from.er):''} to={String(line.er)} move={m?.er} arrow={false} n={n}/></p></div>;
}
/** 上の帯の試合名とチーム名: 幅に合わせて字を縮めて全部出す(11px より小さくなる時は2行に折り返す)。 */
function FitTitle({label,teams}:{label:string;teams:string}){
 const box=useRef<HTMLParagraphElement|null>(null),inner=useRef<HTMLSpanElement|null>(null);
 const [size,setSize]=useState<{px:number;wrap:boolean}>({px:14,wrap:false});
 useLayoutEffect(()=>{
  const fit=()=>{const b=box.current,i=inner.current;if(!b||!i)return;
   // 1行に並べた時の幅を測る(折り返している時も1行に戻して測るので、行ったり来たりしない)。
   i.style.whiteSpace='nowrap';i.style.flexWrap='nowrap';i.style.maxWidth='none';
   const cs=getComputedStyle(b),room=b.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
   const w=i.scrollWidth/size.px*14;// 14px の時の幅
   i.style.whiteSpace='';i.style.flexWrap='';i.style.maxWidth='';
   const px=Math.min(14,Math.floor(room/Math.max(1,w)*14*2)/2);
   const next=px>=11?{px,wrap:false}:{px:11,wrap:true};
   if(next.px!==size.px||next.wrap!==size.wrap)setSize(next);};
  fit();window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit);
 });
 return <p ref={box} className={'wt-title wt-title-live'+(size.wrap?' is-wrap':'')}><span ref={inner} className="wt-fit" style={{fontSize:size.px}}><b>{label}</b><span>{teams}</span></span></p>;
}
function Sheet({title,onClose,children,className=''}:{title:string;onClose:()=>void;children:ReactNode;className?:string}){
 return <div className="wt-sheet-back" onClick={onClose}><div className={'wt-sheet '+className} role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}><header><h2>{title}</h2><button className="wt-x" aria-label="閉じる" onClick={onClose}>閉じる</button></header>{children}</div></div>;
}

/** 観戦の画面はアプリの見た目(.nv-app のボタンの決まり)の外、body の直下に出す。 */
export interface WatchProps {state:GameState;game:ManagedGame;saved?:(WatchOrder|null)[]|null;sound:boolean;mode?:WatchMode;onSave?:(inputs:(WatchOrder|null)[],mode:WatchMode)=>void;onPause:(inputs:(WatchOrder|null)[],mode:WatchMode)=>void;onFinish:(inputs:(WatchOrder|null)[],result:GameResult)=>void}
export function WatchScreen(props:WatchProps){
 const view=<WatchView {...props}/>;
 return typeof document==='undefined'?view:createPortal(view,document.body);
}
function WatchView({state,game,saved,sound,mode:startMode='manage',onSave,onPause,onFinish}:WatchProps){
 const key=game.key;
 // おまかせで観る(watch): 監督の操作なし・最初は2倍(監督の時とは別に速さを覚える)。途中で「ここから監督する」に切り替えられる。
 const [mode,setMode]=useState<WatchMode>(startMode),modeRef=useRef(mode);modeRef.current=mode;
 const speedKey=(m:WatchMode)=>m==='watch'?AUTO_SPEED_KEY:SPEED_KEY;
 const [speed,setSpeedState]=useState<Speed>(()=>readSpeed(undefined,speedKey(startMode),startMode==='watch'?2:1));
 const [sheet,setSheet]=useState<null|'duel'|'sub'|'opp'|'box'|'tactic'|{runner:number}>(null);
 const [hint,setHint]=useState('');
 const [,render]=useReducer((x:number)=>x+1,0);
 const L=useRef<Live|null>(null),timer=useRef<number|undefined>(undefined),speedRef=useRef(speed),soundRef=useRef(sound),sheetRef=useRef(sheet);
 speedRef.current=speed;soundRef.current=sound;sheetRef.current=sheet;
 const club=state.club,season=game.base.season,space=circuitOf(state.season)==='SPACE';
 const teamName=(id:string)=>id===club?state.name:teamById(id,season).short;
 const teamShort=(id:string)=>{const n=teamName(id);return n.length>5?n.slice(0,4):n;};
 const play=(k:Parameters<typeof gameSound>[0])=>{if(soundRef.current)gameSound(k);};
 const clear=()=>{if(timer.current!==undefined){clearTimeout(timer.current);timer.current=undefined;}};
 const later=(ms:number,fn:()=>void)=>{clear();timer.current=window.setTimeout(()=>{timer.current=undefined;fn();},Math.max(0,ms));};

 // ---- 試合を開く(途中で閉じていた時は、覚えた指示の並びで続きまで進める) ----
 const open=()=>{
  clear();stopGameAudio();
  const l:Live={g:game,gen:liveGame(game),base:game.base,control:game.control,inputs:[],started:false,sit:null,queue:[],nextSit:null,result:null,finished:null,phase:'decide',pitches:[],pitchShown:0,last:null,log:[],highlights:[],pitchCount:{},slotOf:{},posOf:{},pending:null,paNo:0,fx:null,flash:null,steps:[],play:null,shownBases:null,animated:false,tabBat:null,tabPit:null,shownBat:{},shownPit:{},hold:null,moves:null,moveNo:0};
  L.current=l;
  pump(l,null,true);reveal(l,true);
  const back=saved??[];let guard=0;
  while(l.inputs.length<back.length&&!l.finished&&guard++<20000){pump(l,back[l.inputs.length],true);reveal(l,true);}
  l.fx=null;l.flash=null;
 };
 /** 次の「打席の前」まで計算を進め、途中の出来事を並べる(まだ見せない)。渡した値は全部覚える(続きから・シーズンに入れる時に使う)。 */
 const pump=(l:Live,order:WatchOrder|null,quiet=false)=>{
  const next=(v:WatchOrder|null|undefined)=>{if(l.started)l.inputs.push(v??null);l.started=true;return l.gen.next(v);};
  let step=next(order);
  while(!step.done){if(step.value.type==='decide'){l.nextSit=step.value.s;l.tabBat=step.value.s.batToday;l.tabPit=step.value.s.pitToday;break;}l.queue.push(step.value.e);step=next(undefined);}
  if(step.done){l.result=step.value;l.nextSit=null;}
  if(!quiet)onSave?.(l.inputs,modeRef.current);
 };
 const remember=(l:Live,s:LiveSituation|null)=>{if(!s)return;s.lineups.forEach((ids,side)=>ids.forEach((id,i)=>{l.slotOf[`${side}|${id}`]=i;l.posOf[`${side}|${id}`]=s.defense[side][id];}));};
 /** 並んだ出来事を見せる。quiet=飛ばし(演出なし)。show=成績の変わった所を光らせる(開いた時・試合終了までの飛ばしでは光らせない)。 */
 const reveal=(l:Live,quiet:boolean,show=!quiet)=>{
  let homeRun:LiveEvent|null=null,lastPA:LiveEvent|null=null;
  const beforeBat=l.shownBat,beforePit=l.shownPit;
  for(const e of l.queue){
   const prev=l.last?.score??l.sit?.score??[0,0];
   const name=nameOf(e.batter);
   const text=callText(e.kind,name,e.slot,e.runs,e.inning,{replaced:e.replaced?nameOf(e.replaced):undefined,pitcher:nameOf(e.pitcher)});
   const lead=(s:number[])=>s[e.side]-s[1-e.side],gold=e.runs>0&&lead(prev)<=0&&lead(e.score)>0;
   l.log.unshift({text:gold?`${text}${lead(prev)<0?'逆転!':'勝ち越し!'}`:text,gold});
   if(e.runs>0)l.highlights.push({inning:e.inning,side:e.side,text});
   if(isPlateAppearance(e.kind)){
    lastPA=e;
    const thrown=l.phase==='pitch'&&l.pitches.length?l.pitches.length:pitchesFor(e.kind,++l.paNo*2654435761).length;
    l.pitchCount[`${1-e.side}|${e.pitcher}`]=(l.pitchCount[`${1-e.side}|${e.pitcher}`]??0)+thrown;
    if(!quiet){
     if(e.kind==='HR'){play('homerun');homeRun=e;}
     else if(['1B','2B','3B','E'].includes(e.kind)){if(!l.animated)play('hit');if(e.runs)play('cheer');}
     else if(e.kind==='K')play('strikeout');else{play('catch');if(e.runs)play('cheer');}
    }
   }
   l.last=e;
  }
  l.queue=[];
  const before=l.sit;
  // この試合の成績を、見せた所まで写す(打席の結果を見せたこの瞬間に、札と成績表の数が変わる)。
  l.shownBat=snapshot(l.tabBat??undefined);l.shownPit=snapshot(l.tabPit??undefined);
  if(show&&lastPA){
   const e=lastPA,bt=e.side===0?l.g.away:l.g.home,pt=e.side===0?l.g.home:l.g.away,bk=`${bt}|${e.batter}`,pk=`${pt}|${e.pitcher}`;
   l.hold={side:e.side,batter:e.batter,slot:e.slot,pitcher:e.pitcher,pitchers:before?.pitchers};
   l.moves={n:++l.moveNo,bat:batMove(batLine(season.batting[bk],beforeBat[bk]),batLine(season.batting[bk],l.shownBat[bk])),pit:pitMove(pitLine(season.pitching[pk],beforePit[pk]),pitLine(season.pitching[pk],l.shownPit[pk]))};
  }else if(!show){l.hold=null;l.moves=null;}
  l.sit=l.nextSit;l.nextSit=null;remember(l,l.sit);l.phase='decide';l.pitches=[];l.pitchShown=0;l.steps=[];l.play=null;l.shownBases=null;l.animated=false;
  if(homeRun&&!quiet){
   const slot=homeRun.slot+1,season_=homeRunNumber(l,homeRun);
   l.fx={kind:'hr',title:'HOME RUN!',sub:`${slot}番 ${nameOf(homeRun.batter)}${season_?` 第${season_}号`:''} ${runLabel(homeRun.runs)}`};
  }
  if(l.sit&&!quiet&&l.sit.bases.every(Boolean)&&!(before?.bases.every(Boolean)))l.flash='満塁';
  if(l.result){
   l.finished=l.result;l.result=null;
   const e=l.last,walkoff=!!e&&e.side===1&&e.runs>0&&e.inning>=9&&l.finished.homeRuns>l.finished.awayRuns;
   l.flash=walkoff?'サヨナラ!':e?.kind==='K'?'三振でゲームセット':'ゲームセット';
   play('gameset');if(walkoff)play('cheer');
  }
 };
 /** 自分のチームの打者の今季何号か(レギュラーシーズンの試合だけ。記録の成績表から数える)。 */
 const homeRunNumber=(l:Live,e:LiveEvent)=>{
  const team=e.side===0?l.g.away:l.g.home;if(team!==club||l.g.kind==='post')return 0;
  return (season.batting[`${team}|${e.batter}`]?.hr??0)+(l.sit?.batToday[`${team}|${e.batter}`]?.hr??0);
 };
 /** 1打席: 盗塁の動き → 球を投げる演出 → 打球・走者・守備が動く → 結果を見せる → 次の打者を待つ。 */
 const startPlate=()=>{
  const l=L.current;if(!l||l.finished||sheetRef.current)return;
  l.hold=null;l.moves=null;// 次の打者が打席に入る
  let order=modeRef.current==='watch'?null:l.pending;l.pending=null;
  if(order&&orderBlock(order.kind as OrderKind,l.sit,l.control))order=null;// 状況が変わって出せなくなった指示は捨てる
  pump(l,order);
  const steps:Step[]=[];let bases=l.sit?.bases??[null,null,null];
  for(const e of l.queue){
   if(isPlateAppearance(e.kind)){steps.push({type:'pitches',e});const d=fieldPlay(e,bases);if(d.length>0)steps.push({type:'play',e,d});}
   else if(e.kind==='SB'||e.kind==='CS')steps.push({type:'play',e,d:fieldPlay(e,bases)});
   bases=e.bases;
  }
  if(!steps.length){reveal(l,false);render();wait();return;}
  l.steps=steps;l.phase='pitch';l.animated=true;runStep(l);
 };
 const runStep=(l:Live)=>{
  if(L.current!==l||l.phase!=='pitch')return;
  const st=l.steps.shift();
  if(!st){reveal(l,false);render();wait();return;}
  const sp=speedRef.current;
  if(st.type==='pitches'){
   l.paNo++;l.pitches=pitchesFor(st.e.kind,l.paNo*2654435761,pitchLength(st.e.tactic?.[0]??null));l.pitchShown=0;render();
   const per=pitchMillis(sp);
   const next=()=>{const c=L.current;if(c!==l||c.phase!=='pitch')return;c.pitchShown++;render();
    if(c.pitchShown<c.pitches.length)later(per,next);else{if(!c.steps.length||c.steps[0].type!=='play')c.shownBases=st.e.bases;later(per*.5,()=>runStep(c));}};
   later(per,next);return;
  }
  if(['ground','liner','fly','hr','bunt'].includes(st.d.type))play('hit');
  const ms=playMillis(sp)*st.d.length;
  l.play={d:st.d,start:performance.now(),ms,e:st.e};render();
  later(ms,()=>{const c=L.current;if(c!==l||c.phase!=='pitch')return;c.play=null;c.shownBases=st.e.bases;render();runStep(c);});
 };
 const wait=()=>{
  const l=L.current;if(!l||l.finished||sheetRef.current)return;
  const s=speedRef.current,extra=(l.fx?homeRunMillis(s):0)+(l.moves&&(l.moves.bat||l.moves.pit)?400/s:0);// 成績が変わった時は少しだけ長く見せる
  if(l.fx)window.setTimeout(()=>{if(L.current===l){l.fx=null;render();}},homeRunMillis(s));
  if(l.flash){const f=l.flash;window.setTimeout(()=>{if(L.current===l&&l.flash===f){l.flash=null;render();}},Math.max(900,1600/s));}
  later(paMillis(s)*.55+extra,startPlate);
 };
 /** 投げている途中なら、その打席の結果まで一気に見せる(交代・指示はそこで止まって受ける)。 */
 const settle=()=>{const l=L.current;if(!l)return;clear();if(l.phase==='pitch'){l.pitchShown=l.pitches.length;l.steps=[];l.play=null;reveal(l,true,true);}};

 useEffect(()=>{open();render();if(L.current&&!L.current.finished&&!sheetRef.current)wait();return clear;// eslint-disable-next-line react-hooks/exhaustive-deps
 },[key]);
 useEffect(()=>{if(sound)void prepareWatchAudio();},[sound]);
 useEffect(()=>{const o=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=o;clear();stopGameAudio();};},[]);
 // シートを開くと止まり、閉じると前の速さで続く。
 useEffect(()=>{if(sheet){settle();render();}else if(L.current&&!L.current.finished){clear();wait();}// eslint-disable-next-line react-hooks/exhaustive-deps
 },[sheet]);

 const l=L.current;
 if(!l)return null;
 const g=l.g,ids=[g.away,g.home],sit=l.sit,fin=l.finished,control=l.control;
 const finish=()=>{const c=L.current;if(!c?.finished)return;clear();stopGameAudio();onFinish(c.inputs,c.finished);};
 const back=()=>{const c=L.current;if(!c)return;if(c.finished){finish();return;}settle();clear();stopGameAudio();onPause(c.inputs,modeRef.current);};
 const shownSit=sit;// 投げている途中も、いま打席に立っている打者を見せる
 const setSpeed=(n:Speed)=>{setSpeedState(n);speedRef.current=n;saveSpeed(n,undefined,speedKey(mode));setHint('');if(l.phase==='decide'&&!fin&&!sheet){clear();wait();}};
 const takeOver=()=>{setMode('manage');modeRef.current='manage';setHint('ここから監督します。指示・作戦・選手交代ができます。');};
 const takeOrder=()=>{let order=mode==='watch'?null:l.pending;l.pending=null;if(order&&orderBlock(order.kind as OrderKind,l.sit,control))order=null;return order;};
 const skipPlate=()=>{if(fin)return;clear();setHint('');if(l.phase==='pitch'){l.pitchShown=l.pitches.length;l.steps=[];l.play=null;reveal(l,true,true);}else{l.hold=null;l.moves=null;pump(l,takeOrder());reveal(l,true,true);}render();wait();};
 const skipGame=()=>{if(fin)return;clear();setHint('');if(l.phase==='pitch'){l.pitchShown=l.pitches.length;l.steps=[];l.play=null;reveal(l,true);}let guard=0;while(!l.finished&&guard++<5000){pump(l,takeOrder(),true);reveal(l,true);}onSave?.(l.inputs,modeRef.current);render();};
 /** シートを開く前に、投げている途中の打席を終わらせて止める(交代はそこで受ける)。 */
 const openSheet=(s:NonNullable<typeof sheet>)=>{settle();setHint('');setSheet(s);};
 const ratingsFor=(side:number,id:string,pitchers=shownSit?.pitchers)=>liveRatings(l.base,ids[side],id,pitchers?.[side]);
 // この試合の成績は、見せた所までの写し(計算は先の打席まで進んでいる)。試合後は成績表の数。
 const box=fin?{bat:Object.fromEntries(fin.box!.batting.map(b=>[`${b.team}|${b.playerId}`,b])),pit:Object.fromEntries(fin.box!.pitching.map(p=>[`${p.team}|${p.playerId}`,p]))}:{bat:l.shownBat,pit:l.shownPit};
 // 今季の成績 = 試合の直前の表(短期決戦の時は短期決戦の表) + この試合のここまで。
 const batOf=(team:string,id:string)=>batLine(season.batting[`${team}|${id}`],box.bat[`${team}|${id}`]),pitOf=(team:string,id:string)=>pitLine(season.pitching[`${team}|${id}`],box.pit[`${team}|${id}`]);

 // ---- 監督の操作 ----
 const atBat=!!sit&&sit.side===control,onDefense=!!sit&&control>=0&&sit.side!==control;
 const watchOnly=control<0?'観るだけの試合です(自分のチームが出ていない)':'';
 const why={bunt:orderBlock('bunt',sit,control),steal:orderBlock('steal',sit,control),ibb:orderBlock('ibb',sit,control),sub:watchOnly||(!sit?'試合が終わりました':'')};
 void atBat;
 const order=(kind:OrderKind)=>{
  if(why[kind]){setHint(why[kind]);return;}
  settle();
  const cur=L.current!;if(!cur.sit)return;
  // settle で打席が終わって次の打者になった時は、改めて確かめる。
  const later_=orderBlock(kind,cur.sit,control);if(later_){setHint(later_);render();if(!sheetRef.current&&!cur.finished){clear();wait();}return;}
  cur.pending=cur.pending?.kind===kind?null:{kind};setHint(cur.pending?`${({bunt:'送りバント',steal:'盗塁',ibb:'敬遠'})[kind]}の指示を出しました(次の打席で)`:'指示を取り消しました');
  render();if(!sheetRef.current&&!cur.finished){clear();wait();}
 };
 /** 作戦: その場で試合の計算に入れる(試合は進まない)。シートは開いたまま。 */
 const applyTactic=(o:WatchOrder)=>{const cur=L.current!;settle();if(!cur.sit||cur.finished)return;pump(cur,o);reveal(cur,true);render();};
 const applySub=(o:WatchOrder)=>{
  const cur=L.current!;settle();if(!cur.sit)return;
  pump(cur,o);// 交代は試合の計算に入る(通らない交代は押せないようにしてある)
  reveal(cur,true);setSheet(null);render();
 };

 // ---- 画面の部品 ----
 const scoreboard=()=>{
  const line=fin?fin.line:(l.last?.line??sit?.line??[[],[]]),score=fin?[fin.awayRuns,fin.homeRuns]:(sit?.score??l.last?.score??[0,0]);
  const hits=fin?[0,1].map(s=>fin.box!.batting.filter(b=>b.team===ids[s]).reduce((n,b)=>n+b.hits,0)):(sit?.hits??l.last?.hits??[0,0]);
  const errors=fin?fin.errors??[0,0]:(sit?.errors??l.last?.errors??[0,0]);
  const n=Math.max(9,line[0].length,line[1].length),cell=(v:number|undefined)=>v===undefined?'':v<0?'x':String(v);
  return <table className="wt-score"><thead><tr><th className="wt-tm">チーム</th>{Array.from({length:n},(_,i)=><th key={i}>{i+1}</th>)}<th className="r">R</th><th>H</th><th>E</th></tr></thead>
   <tbody>{[0,1].map(s=><tr key={s}><td className={'wt-tm '+(ids[s]===club?'is-mine':'is-rival')}>{teamShort(ids[s])}</td>{Array.from({length:n},(_,i)=><td key={i}>{cell(line[s][i])}</td>)}<td className="r">{score[s]}</td><td>{hits[s]}</td><td>{errors[s]}</td></tr>)}</tbody></table>;
 };
 /** グラウンドの上の端に小さく: いま結果が出た打者の打率(動かない時は打点)と、投手の防御率(動かない時は奪三振)。札が画面の下で隠れていても分かるように。 */
 const statPops=()=>{
  const h=l.hold,mv=l.moves;if(!h||!mv)return null;
  const bm=mv.bat,pm=mv.pit,pop=(cls:string,who:string,label:string,from:string,to:string,move:Move,arrow=true)=><span key={cls+mv.n} className={`wt-pop ${cls} is-${move}`}><small>{who}</small>{label} {arrow&&<>{from}<i aria-hidden="true">→</i></>}<b>{to}</b></span>;
  const b=bm&&(bm.avg?pop('is-bat',nameOf(h.batter),'打率',avgText(bm.from),avgText(bm.to),bm.avg):bm.rbi?pop('is-bat',nameOf(h.batter),'打点',String(bm.from.rbi),String(bm.to.rbi),bm.rbi):null);
  const p=pm&&(pm.era?pop('is-pit',nameOf(h.pitcher),'防御率',eraText(pm.from),eraText(pm.to),pm.era):pm.so?pop('is-pit',nameOf(h.pitcher),'奪三振',String(pm.from.so),String(pm.to.so),pm.so):null);
  return <>{b}{p}</>;
 };
 const field=()=>{
  if(!shownSit)return null;
  const s=shownSit,def=1-s.side,color=(side:number)=>ids[side]===club?'blue':ids[1-side]===club?'red':side===0?'blue':'red';
  const bases:[number,number][]=[[78,68],[50,40],[22,68]];let of=0;
  const shown=l.shownBases??s.bases,pl=l.play,moving=new Set(pl?pl.d.tracks.map(t=>t.who):[]);
  const lastPitch=l.phase==='pitch'&&l.pitchShown>0?l.pitches[l.pitchShown-1]:'';
  const throwing=l.phase==='pitch'&&!pl&&l.pitchShown<l.pitches.length?l.pitches[l.pitchShown]:'';
  const batterGone=!!pl&&moving.has('r:'+pl.e.batter)&&isPlateAppearance(pl.e.kind);
  // 内野・外野(.wt-dia)の下に、捕手の分の芝の帯を足してある。座標の % は .wt-dia の中の %。
  return <div className={'wt-field'+(shown.every(Boolean)?' is-loaded':'')} aria-label="グラウンド"><div className="wt-dia-layer">
   {bases.map(([x,y],b)=><img key={'b'+b} className={'wt-base'+(shown[b]?' is-on':'')} src="/assets/pro/watch/base.webp" alt="" style={{left:`${x}%`,top:`${y}%`}}/>)}
   {s.lineups[def].map(id=>{const p=s.defense[def][id];if(p==='DH')return null;const k=p==='外'?'外'+(of++%3):p;const pos=SPOTS[k];if(!pos||moving.has('f:'+k))return null;return <img key={id} className={'wt-fig'+(k==='捕'?' is-catcher':'')} src={`/assets/pro/watch/fielder_${color(def)}.webp`} alt="" style={{left:`${pos[0]}%`,top:topOf(pos[1],pos[2])}}/>;})}
   {!moving.has('f:投')&&<img className="wt-fig is-pitcher" src={`/assets/pro/watch/pitcher_${color(def)}.webp`} alt="" style={{left:'50%',top:'63%'}}/>}
   <img className="wt-base is-home" src="/assets/pro/watch/home.webp" alt="" style={{left:'50%',top:'91%'}}/>
   {!batterGone&&<img className={'wt-fig is-batter'+(['S','F','X'].includes(lastPitch)?' is-swing':'')} src={`/assets/pro/watch/batter_${color(s.side)}.webp`} alt="" style={{left:'41%',top:'93%'}}/>}
   {throwing&&<i key={'p'+l.paNo+'-'+l.pitchShown} className={'wt-pitchball'+(throwing==='B'?' is-ball':'')} style={{'--d':`${Math.round(pitchMillis(speed)*.8)}ms`} as CSSProperties}/>}
   {!pl&&shown.map((id,b)=>{if(!id)return null;const [x,y]=bases[b],r=ratingsFor(s.side,id);return <span key={'r'+b}><img className="wt-fig is-runner" src={`/assets/pro/watch/runner_${color(s.side)}.webp`} alt="" style={{left:`${x}%`,top:`${y}%`}}/>{mode==='manage'&&<button className="wt-tag" style={{left:`${x}%`,top:`${y-14}%`}} onClick={()=>openSheet({runner:b})} aria-label={`${['一','二','三'][b]}塁走者 ${nameOf(id)} 走力${gradeOf(r.speed)}`}>走力<b className={gradeClass(r.speed)}>{gradeOf(r.speed)}</b></button>}</span>;})}
   {pl&&<PlayLayer key={pl.start} play={pl} runner={color(pl.e.side)} fielder={color(1-pl.e.side)}/>}
   </div>
   {pl&&pl.d.word&&<span className="wt-play-word" aria-hidden="true">{pl.d.word}</span>}
   {statPops()}
  </div>;
 };
 const countPanel=()=>{
  const c=l.phase==='pitch'?countOf(l.pitches.slice(0,l.pitchShown)):{b:0,s:0},outs=sit?.outs??(fin?3:0),bases=l.shownBases??sit?.bases??[null,null,null];
  const lamp=(n:number,max:number,cls:string)=>Array.from({length:max},(_,i)=><i key={i} className={i<n?cls:''}/>);
  return <div className={'wt-count'+(bases.every(Boolean)?' is-loaded':'')}>
   <div className="wt-inn"><b>{sit?`${sit.inning}回${sit.side===0?'表':'裏'}`:'試合終了'}</b><span>{sit?`${Math.min(2,outs)}死${bases.some(Boolean)?' '+['一','二','三'].filter((_,i)=>bases[i]).join('・')+'塁':''}`:''}{bases.every(Boolean)&&<em>満塁</em>}</span></div>
   <div className="wt-lamps"><p><small>B</small>{lamp(c.b,3,'is-b')}</p><p><small>S</small>{lamp(c.s,2,'is-s')}</p><p><small>O</small>{lamp(Math.min(2,outs),2,'is-o')}</p></div>
   <div className="wt-dia" aria-label="塁">{[1,2,0].map(i=><i key={i} className={'d'+i+(bases[i]?' is-on':'')}/>)}</div>
  </div>;
 };
 const duelCards=()=>{
  // 打席の結果を見せた直後は、その打者と投手を次の打席が始まるまで残す(変わった成績を見せる)。
  const h=l.hold,s=h??(shownSit&&{side:shownSit.side,batter:shownSit.batter,slot:shownSit.slot,pitcher:shownSit.pitcher,pitchers:shownSit.pitchers});
  if(!s)return null;const bt=ids[s.side],pt=ids[1-s.side];
  const b=box.bat[`${bt}|${s.batter}`] as BatStats|undefined,p=box.pit[`${pt}|${s.pitcher}`] as PitStats|undefined;
  const br=ratingsFor(s.side,s.batter,s.pitchers),pr=ratingsFor(1-s.side,s.pitcher,s.pitchers);
  const mv=h?l.moves:null,bm=mv?.bat??null,pm=mv?.pit??null,n=mv?.n;
  return <div className="wt-duel" role="button" tabIndex={0} onClick={()=>openSheet('duel')} onKeyDown={e=>{if(e.key==='Enter')openSheet('duel');}} aria-label="打者と投手の能力を大きく見る">
   <div className={'wt-card '+(bt===club?'is-mine':'is-rival')}><h3><em>{s.slot+1}番</em><span>{nameOf(s.batter)}</span></h3>
    <BatSeason line={batOf(bt,s.batter)} m={bm} n={n}/>
    <div className="wt-abs">{<><Grade v={br.contact} label="ミート"/><Grade v={br.power} label="パワー"/><Grade v={br.speed} label="走力"/><Grade v={br.field} label="守備"/></>}</div>
    <p key={bm?'t'+n:'t'} className={'wt-today'+(bm?' is-moved':'')}>今日 {b&&b.pa?`${b.ab}打数${b.hits}安打${b.rbi?` ${b.rbi}打点`:''}${b.hr?` ${b.hr}本`:''}`:'初打席'}</p></div>
   <div className={'wt-card '+(pt===club?'is-mine':'is-rival')}><h3><em className="is-p">投手</em><span>{nameOf(s.pitcher)}</span></h3>
    <PitSeason line={pitOf(pt,s.pitcher)} m={pm} n={n}/>
    <div className="wt-abs"><Velocity r={pr} id={s.pitcher}/><Grade v={pr.control} label="制球"/><Grade v={pr.stamina} label="スタミナ"/><Grade v={pr.breaking} label="変化球"/></div>
    <p key={pm?'t'+n:'t'} className={'wt-today'+(pm?' is-moved':'')}>今日 {p?`${formatIP(p.outs)}回 ${l.pitchCount[`${1-s.side}|${s.pitcher}`]??0}球 ${p.er}自責 ${p.so}奪三振`:'登板直後'}</p></div>
  </div>;
 };
 const managerPanel=()=>{
  const btn=(k:'bunt'|'steal'|'ibb',label:string)=><button className={'wt-mg'+(why[k]?' is-off':'')+(l.pending?.kind===k?' is-pending':'')} aria-disabled={!!why[k]} onClick={()=>order(k)}>{label}{k==='ibb'&&sit&&onDefense&&<small>残り{sit.ibbLeft}</small>}{l.pending?.kind===k&&<small className="is-on">指示中</small>}</button>;
  const tacticOn=!!sit&&(!!sit.tactics.team||!!sit.tactics.pitch||Object.keys(sit.tactics.batter).length>0);
  return <section className="wt-manager" aria-label="監督の操作"><h3>監督の操作</h3><div className="wt-mgs is-5">{btn('bunt','送りバント')}{btn('steal','盗塁')}{btn('ibb','敬遠')}<button className={'wt-mg'+(why.sub?' is-off':'')} aria-disabled={!!why.sub} onClick={()=>{if(why.sub){setHint(why.sub);return;}openSheet('sub');}}>選手交代</button><button className={'wt-mg is-tactic'+(why.sub?' is-off':'')+(tacticOn?' is-pending':'')} aria-disabled={!!why.sub} onClick={()=>{if(why.sub){setHint(why.sub);return;}openSheet('tactic');}}>作戦{tacticOn&&<small className="is-on">中</small>}</button></div>{hint&&<p className="wt-hint" role="status">{hint}</p>}</section>;
 };
 /** 今の作戦(画面の上に小さく)。 */
 const tacticLine=()=>{
  if(mode!=='manage'||control<0||!sit)return null;const t=sit.tactics,mineBat=sit.side===control;
  const now=mineBat?batTacticFor(t,sit.batter):null,own=mineBat&&t.batter[sit.batter];
  return <p className="wt-tactic-now" aria-label="今の作戦"><em>作戦</em><span>打撃 {tacticShort(t.team)}{Object.keys(t.batter).length>0?`(個別${Object.keys(t.batter).length}人)`:''}</span><span>投手 {t.pitch?pitchTacticLabel[t.pitch]:'なし'}</span>{own&&now&&<span className="is-now">今の打者 {batTacticLabel[now]}</span>}</p>;
 };
 const speedBar=()=><div className="wt-speed" role="group" aria-label="速さ">{speeds.map(n=><button key={n} className={speed===n?'is-on':''} aria-pressed={speed===n} onClick={()=>setSpeed(n)}>{n}倍</button>)}<i/><button onClick={skipPlate} disabled={!!fin}>次の打席へ</button><button onClick={skipGame} disabled={!!fin}>試合終了まで</button></div>;
 const mine=control===0?[fin?.awayRuns??0,fin?.homeRuns??0]:[fin?.homeRuns??0,fin?.awayRuns??0];
 const verdict=!fin?'':mine[0]>mine[1]?'勝ち':mine[0]<mine[1]?'負け':'引き分け';
 const finalPanel=()=>fin&&<section className="wt-final"><h3><span>試合終了・{verdict}</span>{teamName(g.away)} {fin.awayRuns} - {fin.homeRuns} {teamName(g.home)}</h3>
  <p>この結果がシーズンの成績・順位{g.kind==='post'?'・勝ち上がり':''}に入ります。{mode==='watch'?'(おまかせと同じ結果)':''}</p>
  <div className="wt-final-btns"><button className="wt-gold" onClick={()=>openSheet('box')}>成績表を見る</button><button className="wt-navy" onClick={finish}>結果を残して次へ</button></div></section>;

 // ---- シート ----
 const duelSheet=()=>{
  if(!shownSit)return null;const s=shownSit,bt=ids[s.side],pt=ids[1-s.side];
  const br=ratingsFor(s.side,s.batter),pr=ratingsFor(1-s.side,s.pitcher),b=box.bat[`${bt}|${s.batter}`] as BatStats|undefined,p=box.pit[`${pt}|${s.pitcher}`] as PitStats|undefined,sb=batOf(bt,s.batter),sp=pitOf(pt,s.pitcher);
  const color=(t:string)=>t===club?'blue':'red';
  return <Sheet title="打者と投手の対決" onClose={()=>setSheet(null)} className="wt-duel-sheet">
   <div className="wt-vs"><div className={'is-'+color(bt)}><img src={`/assets/pro/watch/batter_${color(bt)}.webp`} alt=""/><b><em>{s.slot+1}番</em>{nameOf(s.batter)}</b><small>{teamName(bt)}</small></div><strong aria-hidden="true">VS</strong><div className={'is-'+color(pt)}><img src={`/assets/pro/watch/pitcher_${color(pt)}.webp`} alt=""/><b><em className="is-p">投手</em>{nameOf(s.pitcher)}</b><small>{teamName(pt)}</small></div></div>
   <div className="wt-vs-cols"><div className="wt-abs is-big"><Grade wide v={br.contact} label="ミート"/><Grade wide v={br.power} label="パワー"/><Grade wide v={br.speed} label="走力"/><Grade wide v={br.field} label="守備"/></div><div className="wt-abs is-big"><Velocity wide r={pr} id={s.pitcher}/><Grade wide v={pr.control} label="制球"/><Grade wide v={pr.stamina} label="スタミナ"/><Grade wide v={pr.breaking} label="変化球"/></div></div>
   <div className="wt-vs-cols"><dl className="wt-stat is-red"><dt>今日の成績</dt><dd>{b&&b.pa?`${b.ab}打数${b.hits}安打 ${b.rbi}打点 ${b.hr}本塁打`:'まだ打席なし'}</dd><dt>今季の成績(この試合を含む)</dt><dd>打率{avgText(sb)} {sb.hr}本 {sb.rbi}打点</dd></dl><dl className="wt-stat is-blue"><dt>今日の成績</dt><dd>{p?`${formatIP(p.outs)}回 ${l.pitchCount[`${1-s.side}|${s.pitcher}`]??0}球 ${p.er}自責 ${p.so}奪三振`:'登板直後'}</dd><dt>今季の成績(この試合を含む)</dt><dd>防御率{eraText(sp)} {ipText(sp)}回 {sp.so}奪三振 {sp.er}自責 {sp.wins}勝</dd></dl></div>
   <div className="wt-legend"><span>能力の段</span>{['G','F','E','D','C','B','A','S','S+'].map(x=><b key={x}><span className={'g-'+(x==='S+'?'SP':x)}>{x}</span></b>)}<small>左ほど低い・右ほど高い。99を超える(宇宙リーグ)と S+。値は試合の計算に使う物と同じ(覚醒・育成・調子・相手の補正込み)。</small></div>
   {mode==='manage'&&<section className="wt-manager"><h3>この打席の指示</h3><div className="wt-mgs">{(['bunt','steal','ibb'] as const).map(k=><button key={k} className={'wt-mg'+(why[k]?' is-off':'')+(l.pending?.kind===k?' is-pending':'')} aria-disabled={!!why[k]} onClick={()=>order(k)}>{({bunt:'送りバント',steal:'盗塁',ibb:'敬遠'})[k]}</button>)}<button className={'wt-mg'+(l.pending?'':' is-pending')} onClick={()=>{if(L.current)L.current.pending=null;setHint('指示なし');render();}}>指示なし</button></div>{hint&&<p className="wt-hint" role="status">{hint}</p>}</section>}
  </Sheet>;
 };
 const runnerSheet=(b:number)=>{
  if(!sit||!sit.bases[b])return null;const id=sit.bases[b]!,team=ids[sit.side],def=1-sit.side,r=ratingsFor(sit.side,id);
  const catcher=sit.lineups[def].find(x=>sit.defense[def][x]==='捕'),cr=catcher?ratingsFor(def,catcher):null,sb=batOf(team,id);
  return <Sheet title={`${['一','二','三'][b]}塁の走者`} onClose={()=>setSheet(null)}>
   <div className="wt-runner"><h3>{nameOf(id)}<small>{teamName(team)}</small></h3><div className="wt-abs is-big"><Grade wide v={r.speed} label="走力"/><Grade wide v={r.contact} label="ミート"/></div><p>今季の盗塁 <b>{sb.sb}</b>(今日 {box.bat[`${team}|${id}`]?.sb??0})</p></div>
   {catcher&&cr&&<div className="wt-runner"><h3>相手の捕手 {nameOf(catcher)}</h3><div className="wt-abs is-big"><Grade wide v={cr.arm} label="肩"/><Grade wide v={cr.catching} label="捕球"/></div></div>}
   <p className="wt-note">盗塁の成功は、走者の走力と捕手の肩・捕球で決まります(投手のクイックは試合の計算に無いので出していません)。</p>
  </Sheet>;
 };
 return <div className="wt-root" role="dialog" aria-modal="true" aria-label="試合観戦">
  <div className="wt-wrap">
   <header className="wt-head"><button className="wt-back" aria-label={fin?'結果を残して次へ':'試合を中断して戻る'} onClick={back}>{fin?'次へ':'中断'}</button><p className="wt-logo"><b>DIAMOND NINE</b><span>{mode==='watch'?'おまかせで観る':'監督して戦う'}</span></p><div><button onClick={()=>openSheet('opp')}>相手チーム</button><button onClick={()=>openSheet('box')}>成績表</button></div></header>
   <FitTitle label={g.label} teams={`${teamName(g.away)} - ${teamName(g.home)}`}/>
   {scoreboard()}
   <>
   {mode==='watch'?<p className="wt-status">おまかせで観ています。結果は「1年進める」と同じです。</p>:tacticLine()??<p className="wt-status">監督して戦っています。この試合の結果は、そのままシーズンに入ります。</p>}
   {field()}
   {countPanel()}
   {duelCards()}
   <div className={'wt-call'+(l.log[0]?.gold?' is-gold':'')} aria-live="polite"><em aria-hidden="true">実況</em><span>{l.log[0]?.text??'プレイボール!'}</span></div>
   {finalPanel()}
   <div className="wt-dock">{!fin&&mode==='manage'&&managerPanel()}{!fin&&mode==='watch'&&control>=0&&<button className="wt-takeover wt-gold" onClick={takeOver}>ここから監督する</button>}{speedBar()}</div>
   </>
  </div>
  {l.fx&&<div className="wt-hr" style={{'--d':`${homeRunMillis(speed)}ms`} as CSSProperties} onClick={()=>{l.fx=null;render();}} aria-live="assertive"><div className="wt-hr-ball"/><p className="wt-hr-word">HOME RUN!</p><p className="wt-hr-sub">{l.fx.sub}</p>{Array.from({length:28},(_,i)=><i key={i} className="wt-cf" style={{left:`${(i*37)%100}%`,animationDelay:`${(i%7)*.08}s`,background:['#f5c542','#ffffff','#4f8cff','#ffde7a'][i%4]}}/>)}</div>}
  {l.flash&&<div className="wt-flash" aria-live="assertive">{l.flash}</div>}
  {sheet==='duel'&&duelSheet()}
  {sheet&&typeof sheet==='object'&&runnerSheet(sheet.runner)}
  {sheet==='sub'&&sit&&control>=0&&<SubSheet l={l} sit={sit} ids={ids} club={club} ratingsFor={ratingsFor} box={box} batOf={batOf} pitOf={pitOf} onApply={applySub} onClose={()=>setSheet(null)}/>}
  {sheet==='opp'&&<TeamSheet team={control===0?g.home:control===1?g.away:g.home} other={control<0?g.away:null} l={l} ids={ids} teamName={teamName} ratingsFor={ratingsFor} batOf={batOf} pitOf={pitOf} onClose={()=>setSheet(null)}/>}
  {sheet==='tactic'&&sit&&control>=0&&<TacticSheet sit={sit} control={control} ratingsFor={ratingsFor} onApply={applyTactic} onClose={()=>setSheet(null)}/>}
  {sheet==='box'&&<BoxSheet l={l} ids={ids} club={club} teamName={teamName} batOf={batOf} pitOf={pitOf} onClose={()=>setSheet(null)}/>}
 </div>;
}

// ---- グラウンドの動き(打球・走者・守備) ----
/** 縦の位置(% と、捕手だけの px のずれ)。 */
const topOf=(y:number,dy=0)=>dy?`calc(${y}% + ${dy}px)`:y+'%';
// 位置は requestAnimationFrame で直接書き換える(1コマごとに React を描き直さない)。最初の位置は描く時に出す。
function PlayLayer({play,runner,fielder}:{play:{d:FieldPlay;start:number;ms:number};runner:string;fielder:string}){
 const refs=useRef<Record<string,HTMLElement|null>>({}),ball=useRef<HTMLElement|null>(null),shadow=useRef<HTMLElement|null>(null);
 const actors=play.d.tracks.filter(t=>t.who!=='ball'),balls=play.d.tracks.filter(t=>t.who==='ball');
 const place=(p:number)=>{
  for(const t of actors){const el=refs.current[t.who];if(!el)continue;const a=trackAt(t,p);el.style.left=a.x+'%';el.style.top=topOf(a.y,a.dy);el.style.opacity=String(a.o);el.classList.toggle('is-run',a.moving);}
  let cur=balls[0];for(const t of balls)if(p>=t.t0)cur=t;
  if(cur&&ball.current&&shadow.current){const a=trackAt(cur,p);ball.current.style.left=a.x+'%';ball.current.style.top=`calc(${a.y}% + ${a.dy-a.h*1.6}px)`;ball.current.style.transform=`translate(-50%,-50%) scale(${1+a.h/45})`;ball.current.style.opacity=String(a.o);shadow.current.style.left=a.x+'%';shadow.current.style.top=topOf(a.y,a.dy);shadow.current.style.opacity=String(a.o*(a.h>1?.55:0));}
 };
 useLayoutEffect(()=>{let raf=0;const tick=()=>{const p=Math.min(1,(performance.now()-play.start)/Math.max(1,play.ms));place(p);if(p<1)raf=requestAnimationFrame(tick);};tick();return()=>cancelAnimationFrame(raf);// eslint-disable-next-line react-hooks/exhaustive-deps
 },[play]);
 const at0=(t:typeof actors[number])=>{const a=trackAt(t,0);return {left:a.x+'%',top:topOf(a.y,a.dy),opacity:a.o};};
 return <div className={'wt-play is-'+play.d.type} aria-hidden="true">
  {actors.map(t=>t.who.startsWith('f:')?<img key={t.who} ref={el=>{refs.current[t.who]=el;}} className="wt-fig is-chase" src={`/assets/pro/watch/${t.who==='f:投'?'pitcher':'fielder'}_${fielder}.webp`} alt="" style={at0(t)}/>
   :<img key={t.who} ref={el=>{refs.current[t.who]=el;}} className="wt-fig is-runner" src={`/assets/pro/watch/runner_${runner}.webp`} alt="" style={at0(t)}/>)}
  {balls.length>0&&<><i ref={shadow} className="wt-ball-shadow"/><i ref={ball} className="wt-ball"/></>}
 </div>;
}

// ---- 作戦 ----
function TacticSheet({sit,control,ratingsFor,onApply,onClose}:{sit:LiveSituation;control:number;ratingsFor:(side:number,id:string)=>Ratings;onApply:(o:WatchOrder)=>void;onClose:()=>void}){
 const t=sit.tactics,lineup=sit.lineups[control],mineBat=sit.side===control;
 const [who,setWho]=useState(mineBat?sit.batter:lineup[0]);
 const pitcher=mineBat?sit.usedPitchers[control].at(-1)??null:sit.pitcher,pr=pitcher?ratingsFor(control,pitcher):null;
 const fit=(k:PitchTactic)=>pr&&(k==='fastball'||k==='breaking')?pitchFit(k,pr.velocity,pr.breaking):null;
 const fitText=(d:number|null)=>d===null?'':d>.3?'この投手に合っている':d<-.3?'この投手には合っていない':'どちらとも言えない';
 const opt=(on:boolean,label:string,note:string,onClick:()=>void,extra='')=><button className={'wt-tc'+(on?' is-on':'')} aria-pressed={on} onClick={onClick}><b>{label}</b><small>{note}</small>{extra&&<em>{extra}</em>}</button>;
 return <div className="wt-sheet-back" onClick={onClose}><div className="wt-sheet wt-tactic" role="dialog" aria-modal="true" aria-label="作戦" onClick={e=>e.stopPropagation()}>
  <header><h2>作戦</h2><button className="wt-x" aria-label="閉じる" onClick={onClose}>閉じる</button></header>
  <p className="wt-note">作戦はこの試合の間ずっと効きます(いつでも変えられます)。打撃の作戦は自分の攻撃、投手の作戦は自分の守りの時に効きます。</p>
  <h4 className="wt-band">攻撃: チーム全体</h4>
  <div className="wt-tcs">{opt(!t.team,'なし','ふだんどおり',()=>onApply({kind:'tactic',scope:'team',tactic:null}))}{BAT_TACTICS.map(k=><span key={k}>{opt(t.team===k,batTacticLabel[k],batTacticNote[k],()=>onApply({kind:'tactic',scope:'team',tactic:k}))}</span>)}</div>
  <h4 className="wt-band">攻撃: 打者ごと(チーム全体より優先)</h4>
  <div className="wt-choose wt-batters">{lineup.map((id,i)=><button key={id} className={(who===id?'is-on':'')+(t.batter[id]?' has-tactic':'')} onClick={()=>setWho(id)}>{i+1} {nameOf(id)}{t.batter[id]&&<small>{batTacticLabel[t.batter[id]]}</small>}</button>)}</div>
  <div className="wt-tcs">{opt(!t.batter[who],'チームに合わせる',`今は ${tacticShort(t.team)}`,()=>onApply({kind:'tactic',scope:'batter',id:who,tactic:null}))}{BAT_TACTICS.map(k=><span key={k}>{opt(t.batter[who]===k,batTacticLabel[k],batTacticNote[k],()=>onApply({kind:'tactic',scope:'batter',id:who,tactic:k}))}</span>)}</div>
  <h4 className="wt-band">守り: 投手への指示</h4>
  {pr&&pitcher&&<p className="wt-note">いまの投手 {nameOf(pitcher)}: 球速 {Math.round(pr.velocity)}km・変化球 {gradeOf(pr.breaking)}</p>}
  <div className="wt-tcs">{opt(!t.pitch,'なし','ふだんどおり',()=>onApply({kind:'tactic',scope:'pitch',tactic:null}))}{PITCH_TACTICS.map(k=><span key={k}>{opt(t.pitch===k,pitchTacticLabel[k],pitchTacticNote[k],()=>onApply({kind:'tactic',scope:'pitch',tactic:k}),fitText(fit(k)))}</span>)}</div>
  <p className="wt-note">効き方は数%〜十数%です。作戦を出した試合の結果も、そのままシーズンに入ります。</p>
  <div className="wt-final-btns is-sticky"><button className="wt-gold" onClick={onClose}>この作戦で続ける</button></div>
 </div></div>;
}

// ---- 選手交代 ----
type SubTab='pinch'|'runner'|'field'|'pitcher';
function SubSheet({l,sit,ids,club,ratingsFor,box,batOf,pitOf,onApply,onClose}:{l:Live;sit:LiveSituation;ids:string[];club:string;ratingsFor:(side:number,id:string)=>Ratings;box:{bat:Record<string,BatStats>;pit:Record<string,PitStats>};batOf:(t:string,id:string)=>BatLine;pitOf:(t:string,id:string)=>PitLine;onApply:(o:WatchOrder)=>void;onClose:()=>void}){
 const side=l.control,atBat=sit.side===side,team=ids[side];
 const lineup=sit.lineups[side],defense=sit.defense[side],removed=sit.removed[side];
 const firstRunner=sit.bases.findIndex(Boolean);
 const [tab,setTab]=useState<SubTab>(atBat?'pinch':'field');
 const [base,setBase]=useState(firstRunner<0?0:firstRunner);
 const fielderSlots=lineup.map((id,i)=>[id,i] as const).filter(([id])=>defense[id]!=='DH');
 const [slot,setSlot]=useState(fielderSlots[0]?.[1]??0);
 const [position,setPosition]=useState('');
 const [pick,setPick]=useState<string|null>(null);
 const tabWhy:Record<SubTab,string>={pinch:atBat?'':'代打は攻撃の時だけ',runner:!atBat?'代走は攻撃の時だけ':firstRunner<0?'塁に走者がいない':'',field:atBat?'守備固めは守りの時だけ':'',pitcher:atBat?'投手交代は守りの時だけ':''};
 const bench=Object.keys(l.base.owned).filter(id=>!l.base.pitchers.includes(id)&&playerMap[id]&&!lineup.includes(id)).sort((a,b)=>Number(removed.includes(a))-Number(removed.includes(b))||(playerMap[a].name<playerMap[b].name?-1:1));
 const target=tab==='pinch'?sit.slot:tab==='runner'?lineup.indexOf(sit.bases[base]??''):tab==='field'?slot:-1;
 const targetId=target>=0?lineup[target]:sit.pitcher;
 const choose=(t:SubTab)=>{if(tabWhy[t])return;setTab(t);setPick(null);};
 const decide=()=>{if(!pick||tabWhy[tab])return;
  if(tab==='pinch')onApply({kind:'pinch',slot:sit.slot,id:pick});
  else if(tab==='runner')onApply({kind:'runner',base,id:pick});
  else if(tab==='field')onApply({kind:'field',slot,id:pick,position:position||undefined});
  else onApply({kind:'pitcher',id:pick});
 };
 const tr=ratingsFor(tab==='pitcher'?1-sit.side:sit.side===side?side:side,targetId);
 const benchRow=(id:string)=>{const block=substituteBlock(lineup,removed,id),r=ratingsFor(side,id),sb=batOf(team,id);const p=playerMap[id];
  return <div key={id} className={'wt-pr'+(block?' is-off':'')+(pick===id?' is-pick':'')}><img src={`/assets/pro/watch/batter_${block?'red':'blue'}.webp`} alt="" className={block?'is-gray':''}/><div className="wt-pr-name"><b>{p.name}</b><small>守備 {[p.position,...(p.positions??[])].filter((x,i,a)=>x&&a.indexOf(x)===i).map(posLabel).slice(0,3).join('・')||'—'}</small></div>
   <div className="wt-pr-ab"><div className="wt-abs is-row"><Grade v={r.contact} label="ミート"/><Grade v={r.power} label="パワー"/><Grade v={r.speed} label="走力"/><Grade v={r.field} label="守備"/></div><p>今季 打率{avgText(sb)} {sb.hr}本 {sb.sb}盗塁</p></div>
   <button className={block?'wt-pr-btn is-off':'wt-pr-btn'} aria-disabled={!!block} onClick={()=>{if(!block)setPick(id);}}>{block??(pick===id?'選択中':'この選手を出す')}</button></div>;};
 const penRow=(id:string)=>{const used=sit.usedPitchers[side].includes(id),current=id===sit.pitcher,r=ratingsFor(side,id),today=box.pit[`${team}|${id}`],ss=pitOf(team,id);
  const block=current?'いま投げている':used?'この投手はもう投げた':null;
  return <div key={id} className={'wt-pr'+(block?' is-off':'')+(pick===id?' is-pick':'')}><img src="/assets/pro/watch/pitcher_blue.webp" alt="" className={block?'is-gray':''}/><div className="wt-pr-name"><b>{playerMap[id].name}</b><small>{today?`今日 ${formatIP(today.outs)}回`:'今日 未登板'}</small></div>
   <div className="wt-pr-ab"><div className="wt-abs is-row"><Velocity r={r} id={id}/><Grade v={r.control} label="制球"/><Grade v={r.stamina} label="スタミナ"/><Grade v={r.breaking} label="変化球"/></div><p>今季 防御率{eraText(ss)} {ss.wins}勝 {ss.saves}S</p></div>
   <button className={block?'wt-pr-btn is-off':'wt-pr-btn'} aria-disabled={!!block} onClick={()=>{if(!block)setPick(id);}}>{block??(pick===id?'選択中':'この投手に替える')}</button></div>;};
 const preview=(i:number)=>pick&&i===target&&tab!=='pitcher'?pick:lineup[i];
 const previewPos=(i:number)=>{const id=lineup[i];if(tab==='field'&&position&&pick){if(i===target)return position;if(defense[id]===position)return defense[lineup[target]];}return defense[id];};
 const positions=[...new Set(fielderSlots.map(([id])=>defense[id]))];
 return <div className="wt-sheet-back" onClick={onClose}><div className="wt-sheet wt-sub" role="dialog" aria-modal="true" aria-label="選手交代" onClick={e=>e.stopPropagation()}>
  <header><h2>選手交代</h2><button className="wt-x" aria-label="閉じる" onClick={onClose}>閉じる</button></header>
  <div className="wt-tabs" role="tablist">{(['pinch','runner','field','pitcher'] as SubTab[]).map(t=><button key={t} role="tab" aria-selected={tab===t} aria-disabled={!!tabWhy[t]} className={(tab===t?'is-on':'')+(tabWhy[t]?' is-off':'')} onClick={()=>choose(t)}>{({pinch:'代打',runner:'代走',field:'守備固め',pitcher:'投手交代'})[t]}</button>)}</div>
  {Object.values(tabWhy).some(Boolean)&&<p className="wt-note">{atBat?'いまは攻撃中: 代打・代走が出せます(守備固め・投手交代は守りの回に)。':'いまは守りの回: 守備固め・投手交代ができます(代打・代走は攻撃の回に)。'}</p>}
  {tab==='runner'&&<div className="wt-choose">{sit.bases.map((id,b)=>id&&<button key={b} className={base===b?'is-on':''} onClick={()=>{setBase(b);setPick(null);}}>{['一','二','三'][b]}塁 {nameOf(id)}</button>)}</div>}
  {tab==='field'&&<div className="wt-choose">{fielderSlots.map(([id,i])=><button key={id} className={slot===i?'is-on':''} onClick={()=>{setSlot(i);setPick(null);setPosition('');}}>{posLabel(defense[id])} {nameOf(id)}</button>)}<label>入る選手の守備<select value={position} onChange={e=>setPosition(e.target.value)}><option value="">同じ位置({posLabel(defense[lineup[slot]])})</option>{positions.filter(p=>p!==defense[lineup[slot]]).map(p=><option key={p} value={p}>{posLabel(p)}に入る(今の{posLabel(p)}は{posLabel(defense[lineup[slot]])}へ)</option>)}</select></label></div>}
  <div className="wt-target"><img src={`/assets/pro/watch/${tab==='pitcher'?'pitcher':tab==='runner'?'runner':tab==='field'?'fielder':'batter'}_blue.webp`} alt=""/><div><h3>{tab==='pitcher'?<em className="is-p">投手</em>:<em>{target+1}番</em>}{nameOf(targetId)}<small>{tab==='pitcher'?'いま投げている':tab==='runner'?`${['一','二','三'][base]}塁の走者`:tab==='field'?`守備 ${posLabel(defense[targetId])}`:'いまの打者'}</small></h3>
   <div className="wt-abs is-row">{tab==='pitcher'?<><Velocity r={tr} id={targetId}/><Grade v={tr.control} label="制球"/><Grade v={tr.stamina} label="スタミナ"/><Grade v={tr.breaking} label="変化球"/></>:<><Grade v={tr.contact} label="ミート"/><Grade v={tr.power} label="パワー"/><Grade v={tr.speed} label="走力"/><Grade v={tr.field} label="守備"/></>}</div>
   <p className="wt-today">今日 {tab==='pitcher'?(box.pit[`${team}|${targetId}`]?`${formatIP(box.pit[`${team}|${targetId}`].outs)}回 ${box.pit[`${team}|${targetId}`].er}失点`:'—'):(box.bat[`${team}|${targetId}`]?`${box.bat[`${team}|${targetId}`].ab}打数${box.bat[`${team}|${targetId}`].hits}安打`:'—')}</p></div></div>
  <h4 className="wt-band">{tab==='pitcher'?'ブルペン(投手交代)':`ベンチの選手(${({pinch:'代打',runner:'代走',field:'守備固め'} as Record<string,string>)[tab]})`}</h4>
  <div className="wt-list">{tab==='pitcher'?sit.pitchers[side].filter(id=>id!==sit.pitcher).map(penRow):bench.length?bench.map(benchRow):<p className="wt-note">ベンチに出せる選手がいません。チーム画面で控えを増やすと、代打・代走・守備固めに出せます。</p>}</div>
  {tab!=='pitcher'&&<><h4 className="wt-band">打順と守備位置(交代後の予定)</h4><table className="wt-order"><thead><tr><th>打順</th><th>選手名</th><th>守備</th></tr></thead><tbody>{lineup.map((_,i)=><tr key={i} className={i===target?'is-target':''}><td>{i+1}</td><td>{nameOf(preview(i))}</td><td>{posLabel(previewPos(i))}</td></tr>)}</tbody></table></>}
  <p className="wt-note">退いた選手・もう投げた投手は、この試合に戻れません。</p>
  <div className="wt-final-btns is-sticky"><button className="wt-gold" disabled={!pick||!!tabWhy[tab]} onClick={decide}>決定</button><button className="wt-navy" onClick={onClose}>やめる</button></div>
 </div></div>;
}

// ---- 相手チーム ----
function TeamSheet({team,other,l,ids,teamName,ratingsFor,batOf,pitOf,onClose}:{team:string;other:string|null;l:Live;ids:string[];teamName:(id:string)=>string;ratingsFor:(side:number,id:string)=>Ratings;batOf:(t:string,id:string)=>BatLine;pitOf:(t:string,id:string)=>PitLine;onClose:()=>void}){
 const [shown,setShown]=useState(team),[tab,setTab]=useState<'bat'|'pit'|'bench'>('bat');
 const side=ids.indexOf(shown),sit=l.sit;
 const lineup=sit?.lineups[side]??[],defense=sit?.defense[side]??{},pitchers=sit?.pitchers[side]??[];
 const bench=benchOf(shown,lineup,pitchers).filter(id=>!(sit?.removed[side]??[]).includes(id)).slice(0,10);
 const av=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
 const bats=lineup.map(id=>ratingsFor(side,id)),arms=pitchers.slice(0,10).map(id=>ratingsFor(side,id));
 const strength=[['打撃',av(bats.map(r=>(r.contact+r.power)/2))],['投手',av(arms.map(r=>(r.control+r.breaking+Math.max(0,(r.velocity-120)/45*99))/3))],['守備',av(bats.map(r=>r.field))]] as const;
 const batRow=(id:string,i:number|null)=>{const r=ratingsFor(side,id),s=batOf(shown,id);return <tr key={id}><td className="wt-no">{i===null?'控':i+1}</td><td className="wt-nm">{nameOf(id)}</td><td>{i===null?posLabel(playerMap[id].position):posLabel(defense[id])}</td>{[r.contact,r.power,r.speed,r.field].map((v,k)=><td key={k}><b className={'wt-medal '+gradeClass(v)}>{gradeOf(v)}</b></td>)}<td className="wt-ss">{avgText(s)}<br/>{s.hr}本</td></tr>;};
 const pitRow=(id:string,i:number)=>{const r=ratingsFor(side,id),s=pitOf(shown,id),used=sit?.usedPitchers[side].includes(id);return <tr key={id} className={sit?.pitcher===id?'is-target':''}><td className="wt-no">{i<6?'先':'中'}</td><td className="wt-nm">{nameOf(id)}{used&&<small>登板</small>}</td><td>{isSpaceAlien(playerMap[id])?alienVelocity(Math.round(r.velocity)):Math.round(r.velocity)}</td>{[r.control,r.stamina,r.breaking].map((v,k)=><td key={k}><b className={'wt-medal '+gradeClass(v)}>{gradeOf(v)}</b></td>)}<td className="wt-ss">{eraText(s)}<br/>{s.wins}勝</td></tr>;};
 return <Sheet title={other?'チームの能力':'相手チーム'} onClose={onClose} className="wt-team">
  {other&&<div className="wt-choose">{ids.map(id=><button key={id} className={shown===id?'is-on':''} onClick={()=>setShown(id)}>{teamName(id)}</button>)}</div>}
  <div className="wt-team-head"><img src={`/assets/pro/watch/fielder_${side>=0&&ids[side]===l.base.club?'blue':'red'}.webp`} alt=""/><div><h3>{teamName(shown)}</h3><div className="wt-strength"><span>チームの強さ</span>{strength.map(([k,v])=><p key={k}><small>{k}</small><b className={gradeClass(v)}>{gradeOf(v)}</b></p>)}</div></div></div>
  <div className="wt-tabs" role="tablist">{([['bat','打者'],['pit','投手'],['bench','ベンチ']] as const).map(([k,t])=><button key={k} role="tab" aria-selected={tab===k} className={tab===k?'is-on':''} onClick={()=>setTab(k)}>{t}</button>)}</div>
  <div className="wt-scroll">{tab==='pit'?<table className="wt-roster"><thead><tr><th></th><th>投手</th><th>km</th><th>制球</th><th>スタ</th><th>変化</th><th>今季</th></tr></thead><tbody>{pitchers.map(pitRow)}</tbody></table>
   :<table className="wt-roster"><thead><tr><th>打順</th><th>選手</th><th>守</th><th>ミ</th><th>パ</th><th>走</th><th>守</th><th>今季</th></tr></thead><tbody>{tab==='bat'?lineup.map((id,i)=>batRow(id,i)):bench.length?bench.map(id=>batRow(id,null)):<tr><td colSpan={8}>控えの野手はいません</td></tr>}</tbody></table>}</div>
  <p className="wt-note">能力は試合の計算に使う値(相手の補正込み)。ミ=ミート・パ=パワー・走=走力・守=守備、スタ=スタミナ。宇宙リーグの相手は99を超えて S+ になる能力があります。</p>
 </Sheet>;
}

// ---- 成績表 ----
function BoxSheet({l,ids,club,teamName,batOf,pitOf,onClose}:{l:Live;ids:string[];club:string;teamName:(id:string)=>string;batOf:(t:string,id:string)=>BatLine;pitOf:(t:string,id:string)=>PitLine;onClose:()=>void}){
 const [side,setSide]=useState(Math.max(0,ids.indexOf(club)));
 const fin=l.finished;
 // 途中は見せた所までの写し(計算は先の打席まで進んでいる)。
 const batting=fin?fin.box!.batting:Object.values(l.shownBat);
 const pitching=fin?fin.box!.pitching:Object.values(l.shownPit);
 const team=ids[side];
 const rows=batting.filter(b=>b.team===team).map(b=>({b,slot:l.slotOf[`${side}|${b.playerId}`]??99})).sort((a,b)=>a.slot-b.slot);
 const pits=pitching.filter(p=>p.team===team);
 const highlights=fin?fin.box!.highlights.map(h=>({inning:h.inning,side:h.team===ids[0]?0:1,text:`${nameOf(h.batter)}、${h.play||'得点'}で${h.runs}点(${h.awayScore}-${h.homeScore})`})):l.highlights;
 const decision=(k:'wins'|'losses'|'saves')=>pitching.find(p=>p[k]>0);
 return <Sheet title="成績表" onClose={onClose} className="wt-box">
  <div className="wt-box-head"><span>{fin?'試合終了':'途中経過'}</span><b>{teamName(ids[0])} {fin?fin.awayRuns:l.sit?.score[0]??0} - {fin?fin.homeRuns:l.sit?.score[1]??0} {teamName(ids[1])}</b>
   {fin&&<p>{decision('wins')&&<span><em className="is-w">勝ち</em>{nameOf(decision('wins')!.playerId)}</span>}{decision('losses')&&<span><em className="is-l">負け</em>{nameOf(decision('losses')!.playerId)}</span>}{decision('saves')&&<span><em className="is-s">セーブ</em>{nameOf(decision('saves')!.playerId)}</span>}</p>}
</div>
  <div className="wt-tabs" role="tablist">{ids.map((id,i)=><button key={id} role="tab" aria-selected={side===i} className={side===i?'is-on':''} onClick={()=>setSide(i)}>{teamName(id)}</button>)}</div>
  <h4 className="wt-band">打撃成績</h4>
  <div className="wt-scroll"><table className="wt-bx"><thead><tr><th>打順</th><th>名前</th><th>守</th><th>打数</th><th>安打</th><th>打点</th><th>本</th><th>四死</th><th>三振</th><th>今季打率</th></tr></thead>
   <tbody>{rows.map(({b,slot})=><tr key={b.playerId}><td className="wt-no">{slot<9?slot+1:''}</td><td className="wt-nm">{nameOf(b.playerId)}</td><td>{posLabel(l.posOf[`${side}|${b.playerId}`])}</td><td>{b.ab}</td><td>{b.hits}</td><td>{b.rbi}</td><td>{b.hr?<b className="wt-hr-mark">{b.hr}</b>:0}</td><td>{b.bb+b.hbp}</td><td>{b.so}</td><td>{avgText(batOf(team,b.playerId))}</td></tr>)}</tbody></table></div>
  <h4 className="wt-band">投手成績</h4>
  <div className="wt-scroll"><table className="wt-bx"><thead><tr><th></th><th>名前</th><th>回</th><th>球数</th><th>被安</th><th>自責</th><th>奪三</th><th>四死</th><th>今季防御率</th></tr></thead>
   <tbody>{pits.map(p=><tr key={p.playerId}><td>{p.wins?<em className="is-w">勝</em>:p.losses?<em className="is-l">負</em>:p.saves?<em className="is-s">S</em>:''}</td><td className="wt-nm">{nameOf(p.playerId)}</td><td>{formatIP(p.outs)}</td><td>{l.pitchCount[`${side}|${p.playerId}`]??'-'}</td><td>{p.hits}</td><td>{p.er}</td><td>{p.so}</td><td>{p.bb+p.hbp}</td><td>{eraText(pitOf(team,p.playerId))}</td></tr>)}</tbody></table></div>
  <h4 className="wt-band">試合のハイライト</h4>
  <ul className="wt-hl">{highlights.length?highlights.slice(0,8).map((h,i)=><li key={i}><em>{h.inning}回{h.side===0?'表':'裏'}</em><span>{h.text}</span></li>):<li><span>まだ点が入っていません</span></li>}</ul>
  <p className="wt-note">今季打率・今季防御率は、試合前までの今季の成績にこの試合のここまでを足した数です(試合の後にシーズンに入る数と同じ)。球数は演出の数です(試合の計算は1打席ずつで、球数は使っていません)。守備位置の「外」は外野。</p>
 </Sheet>;
}
