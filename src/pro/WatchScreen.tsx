// 観戦モード(2026-11-04 vc43): 1試合を1打席ずつ観て、監督ができる画面。
// 見た目の手本は ChatGPT に作らせたデザイン案(Downloads/ios_release/d9_watch_1103/ui)。画像は人形・ボール・ベースだけ使い、残りは CSS。
// 同じ日の作り直し(持ち主「自分で監督操作が出来るみたいな感じにして」): 振り返り(今年の名場面)はやめ、「1年進める」の途中で止まった
// 大事な試合(開幕戦・ポストシーズン・決定戦)をここで戦う。監督の指示は試合の結果に効き、結果はそのままシーズンに入る(managed.ts)。
// 何も指示しなければ、おまかせと同じ結果。画面で渡した値の並び(inputs)を覚えておき、途中で閉じても続きから再開できる。
// 11/4 追加(持ち主): 「おまかせで観る」(監督の操作なし・最初は2倍・途中で「ここから監督する」)、グラウンドでボール・打球・走者・守備が動く
// (watch-play.ts)、監督の「作戦」(長打狙い・ミート打ち・積極的に・慎重に/直球中心・変化球中心・ボール球中心・ストライク中心。tactics.ts)。
// 11/4 追加(持ち主「試合中に1打席の結果が出た際に、打率とか防御率とか動くようにしてください」): 打席の結果を見せた瞬間に、打者と投手の札・
// 成績表の今季の成績(試合前の表+この試合のここまで。live-stats.ts)を変え、変わった数字を少し光らせる(良くなった=緑・悪くなった=赤)。
// 計算は先の打席まで進んでいるので、見せた時の「この試合の成績」を写して使う(shownBat/shownPit)。結果を見せた打者・投手は次の打席が始まるまで札に残す(hold)。
// 11/4 夜(持ち主「右と左別に立つようにして。あとスクロールせずに結果見れるようにして。監督として細かくある程度指示出せるようにして」
// 「さっき言った長打狙いとかその辺」「おまかせで観るはいらない」): 右打者は三塁側・左打者は一塁側に立つ(両打ちは投手の反対。watch-play.ts の batSide)、
// 左投手は左腕で投げる。画面はスクロールなしの1画面(グラウンドが残りの高さを使う)。長打狙い〜ストライク中心は、操作の欄に常に並べて1タップで
// 次の打者・今の投手に出す(打者ごと・投手ごと)。結果の一文に作戦が効いたかを足す(tactics.ts の tacticNote)。「おまかせで観る」は外した。
// 11/4 夜おそく(持ち主「試合の時、ミート・パワー・走力が、投手のコントロール・スタミナ・球速が、能力として見れるようにして」「投球数は1球ずつ
// ちゃんと増えるようにして」「奪三振数も見えるようにして」「バットに当たった音が金属音なので…前提はプロ野球なので」): 打者と投手の帯に能力の段と短い棒を
// 常に出す(段の色と記号は、対決・交代のシートと同じ gradeOf/gradeClass)。投手のスタミナは今日の残り(1球ごとに減る。watch.ts の staminaLeft)。
// 球数は1球見せるたびに +1、飛ばした時は残りをまとめて足す(watch.ts の tally*)。打球音は木製バット(game-audio.ts)。
// 11/5 作り直し(持ち主「1から別に試合画面作り直していいです。守備の動きに関しても、リアルにある程度再現してください」「UI 全部やって」):
// グラウンドは本物の縮尺(塁間 27.43m)の動き(field-sim.ts)をキャンバスに描く(FieldCanvas.tsx)。投手の投球・打者の振り・捕手・野手の追う・捕る・投げる・
// カバー・中継・走者の滑り込み・喜び/がっかりを、結果(LiveEvent)に合わせて組み立てる。人形のコマは ChatGPT イメージで今の絵柄に合わせて描いた(sprite-atlas.ts)。
// 試合の計算・作戦・交代・倍速・成績の動き・1画面は前のまま。演出(ホームラン・チェンジ)は押さなくても消え、下のボタンを止めない。
// 11/5 昼: 併殺・野選・ファインプレー・好返球の実況と演出(PlayFx、段階つき・押さなくても消える)、チームのイメージカラー(スコアボード・帯・人形)、
// 敬遠の回数の制限なし、速さは1つのボタンで 1→2→4→8→16、成績表に併殺。
// 11/6 夜(持ち主「守備でボールを取った時に、名前と肩・守の能力が出るようにしてください」): 打球を捕った瞬間(field-sim の catchAt)に、
// 捕った野手の守備位置・名前・肩・守備(その守備位置での値。position-defense の defenseAtPosition)を、実況の帯の上に重ねて小さく出す(FieldCard)。
// グラウンドの中には出さない(ボール・走者・野手を隠さない)。打者の帯とも重ならない。押さなくても 1倍 1.4秒・2倍 1.1秒で消える。
// 4倍以上と飛ばしでは出さない。ファインプレーの演出(PlayFx)が出る時は、演出が消えるまで一緒に出し、守備を光らせる。
import {useEffect,useLayoutEffect,useReducer,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {substituteBlock,type BatStats,type GameResult,type GameState,type LiveEvent,type LiveSituation,type LiveStep,type PitStats,type WatchOrder} from './engine';
import {liveGame,type ManagedGame} from './managed';
import {formatAvg,formatIP,fitsPosition,playerMap,teamById,type Ratings} from './data';
import {defenseAtPosition} from './position-defense';
import {posFitLine} from './lineup';
import {GRADE_GUIDE} from './AbilityTag';
import {circuitOf} from './leagues';
import {isSpaceAlien} from './mlb-opponents';
import {alienVelocity} from './space-aliens';
import {gameSound,prepareWatchAudio,stopGameAudio,stopScheduledSounds} from './game-audio';
import {soundCues,thinCues} from './play-sounds';
import {MatchGuide} from './GuideCoach';
import {MATCH_GUIDE} from './guide';
import {benchOf,callText,countOf,holdsAfter,tacticWho,gradeClass,gradeOf,isPlateAppearance,liveRatings,longArm,newTally,paMillis,pitchMillis,pitchPlan,playMillis,readSpeed,saveSpeed,speeds,SPEED_KEY,staminaLeft,tallyBegin,tallyEnd,tallyPitch,type PitchTally,type Speed} from './watch';
import {choreograph,pitchClip,stillScene,fieldMap,batSide,throwHand,POS_LABEL,POS_DATA,type Choreo,type Pos,type SimCtx} from './field-sim';
import {FieldCanvas,toScreen,type FieldScene,type Projection} from './FieldCanvas';
import {leadOff} from './field-sim';
import {BAT_TACTICS,PITCH_TACTICS,batTacticFor,batTacticLabel,batTacticNote,pitchFit,pitchTacticFor,pitchTacticLabel,pitchTacticNote,tacticNote,type BatTactic,type PitchTactic} from './tactics';
import {avgText,batLine,batMove,eraText,ipText,pitLine,pitMove,snapshot,type BatLine,type BatMove,type Move,type PitLine,type PitMove} from './live-stats';
import {createPortal} from 'react-dom';
import {teamColorIn,uniformsFor,readableOnDark,type Uniform} from './team-colors';
import {fxFor,readFxLevel,type Fx} from './play-fx';
import {PlayFx} from './PlayFx';
import {playCall,NO_POS} from './plays';
import './watch.css';
import './match.css';

type Gen=Generator<LiveStep,GameResult,WatchOrder|null|undefined>;
/** 1打席の見せる順番: 盗塁の動き → 投球 → 打球と走者。 */
type Step={type:'pitches';e:LiveEvent;before:(string|null)[]}|{type:'play';e:LiveEvent;before:(string|null)[]};
export type WatchMode='manage'|'watch';
interface Live {
 g:ManagedGame;gen:Gen;base:GameState;control:number;inputs:(WatchOrder|null)[];started:boolean;
 sit:LiveSituation|null;queue:LiveEvent[];nextSit:LiveSituation|null;result:GameResult|null;finished:GameResult|null;
 phase:'decide'|'pitch';pitches:string[];pitchShown:number;last:LiveEvent|null;
 log:{text:string;gold?:boolean;note?:{text:string;good:boolean}|null}[];highlights:{inning:number;side:number;text:string}[];
 pitchCount:Record<string,number>;tally:PitchTally;slotOf:Record<string,number>;posOf:Record<string,string>;
 pending:WatchOrder|null;paNo:number;fx:Fx|null;fxN:number;endSit:LiveSituation|null;flash:string|null;
 steps:Step[];play:{d:Choreo;start:number;ms:number;e:LiveEvent}|null;clip:{c:Choreo;start:number;speed:number}|null;shownBases:(string|null)[]|null;animated:boolean;
 tabBat:Record<string,BatStats>|null;tabPit:Record<string,PitStats>|null;shownBat:Record<string,BatStats>;shownPit:Record<string,PitStats>;
 hold:Hold|null;moves:{n:number;bat:BatMove|null;pit:PitMove|null}|null;moveNo:number;
 fcard:FCard|null;fcardN:number;
}
/** 捕った野手の札(11/6 夜)。side=守っているチーム(0=ビジター)。n が変わった時だけ出し直しの動きをする。 */
interface FCard {id:string;side:number;pos:Pos;fine:boolean;n:number;ms:number;expect?:string}
/** 結果を見せた打席の打者と投手(次の打席が始まるまで札に残す)。 */
interface Hold {side:number;batter:string;slot:number;pitcher:string;pitchers?:string[][]}
const POS:Record<string,string>={捕:'捕',一:'一',二:'二',三:'三',遊:'遊',外:'外',DH:'指'};
const posLabel=(p?:string)=>p?POS[p]??p:'';
const nameOf=(id:string)=>playerMap[id]?.name??id;
/** 試合の計算のプレー(e.play.fielder: 1=投〜9=右)で打球を処理した野手。外野は打順の並びで左・中・右。 */
function playFielder(sit:LiveSituation|null,e:LiveEvent):string|null{if(!e.play||!sit)return null;const def=1-e.side,no=e.play.fielder;if(no===1)return e.pitcher;const m=['','','捕','一','二','三','遊'],lu=sit.lineups[def],df=sit.defense[def];return (no<=6?lu.find(x=>df[x]===m[no]):lu.filter(x=>df[x]==='外')[no-7])??null;}
const runLabel=(runs:number)=>runs>=4?'満塁ホームラン':runs===1?'ソロ':`${runs}ラン`;

export type OrderKind='bunt'|'steal'|'ibb';
const tacticShort=(t:BatTactic|null)=>t?batTacticLabel[t]:'なし';
/** 指示が出せない理由(出せる時は '')。画面のボタンと、打席の直前の確かめの両方で使う。 */
export function orderBlock(kind:OrderKind,sit:LiveSituation|null,control:number):string{
 if(control<0)return '観るだけの試合です(自分のチームが出ていない)';
 if(!sit)return '試合が終わりました';
 const atBat=sit.side===control;
 if(kind==='bunt')return !atBat?'送りバントは攻撃の時だけ':sit.outs>=2?'2死では送りバントできない':!(sit.bases[0]||sit.bases[1])?'一塁か二塁に走者がいる時だけ':'';
 if(kind==='steal')return !atBat?'盗塁は攻撃の時だけ':!sit.bases[0]?'一塁に走者がいる時だけ':sit.bases[1]?'二塁が空いている時だけ':'';
 // 11/5: 敬遠の回数の制限を無くした(持ち主「回数制限あるの意味不明」)。満塁でも申告敬遠できる(押し出しで1点)。
 return atBat?'敬遠は守りの時だけ':'';
}
/** 段のメダルとバー。 */
function Grade({v,label,wide=false}:{v:number;label:string;wide?:boolean}){
 return <div className={'wt-ab'+(wide?' is-wide':'')}><small>{label}</small><b className={gradeClass(v)}>{gradeOf(v)}</b><i><u className={gradeClass(v)} style={{width:`${Math.max(6,Math.min(100,v))}%`}}/></i></div>;
}
function Velocity({r,id,wide=false}:{r:Ratings;id:string;wide?:boolean}){
 const v=Math.round(r.velocity),shown=isSpaceAlien(playerMap[id])?alienVelocity(v):v,score=Math.max(0,Math.min(110,(r.velocity-120)/45*99));
 return <div className={'wt-ab'+(wide?' is-wide':'')}><small>球速</small><b className={'wt-kmh '+gradeClass(score)}>{shown}<em>km</em></b><i><u className={gradeClass(score)} style={{width:`${Math.max(6,Math.min(100,score))}%`}}/></i></div>;
}
/** 帯の小さな能力(11/4 夜おそく): 上に名前、下に段と短い棒。段の色と記号はシートの Grade と同じ。
 *  left を渡すとスタミナ: 棒は今日の残り(1球ごとに減る)、残り3割を切ると赤。 */
export function Mini({v,label,left}:{v:number;label:string;left?:number}){
 const w=left===undefined?Math.max(6,Math.min(100,v)):Math.round(left*100);
 return <div className={'wt-mini'+(left!==undefined?' is-stamina'+(left<.3?' is-low':''):'')} aria-label={`${label} ${gradeOf(v)}${left!==undefined?` 今日の残り${w}%`:''}`} data-left={left!==undefined?w:undefined}>
  <small>{label}</small><b className={gradeClass(v)}>{gradeOf(v)}</b><i><u className={gradeClass(v)} style={{width:`${w}%`}}/></i></div>;
}
function MiniVelocity({r,id}:{r:Ratings;id:string}){
 const v=Math.round(r.velocity),shown=isSpaceAlien(playerMap[id])?alienVelocity(v):v,score=Math.max(0,Math.min(110,(r.velocity-120)/45*99));
 return <div className="wt-mini is-kmh" aria-label={`球速 ${shown}km/h`}><small>球速</small><b className={gradeClass(score)}>{shown}<em>km</em></b><i><u className={gradeClass(score)} style={{width:`${Math.max(6,Math.min(100,score))}%`}}/></i></div>;
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
export interface WatchProps {state:GameState;game:ManagedGame;saved?:(WatchOrder|null)[]|null;sound:boolean;mode?:WatchMode;guide?:boolean;onGuideDone?:()=>void;onSave?:(inputs:(WatchOrder|null)[],mode:WatchMode)=>void;onPause:(inputs:(WatchOrder|null)[],mode:WatchMode)=>void;onFinish:(inputs:(WatchOrder|null)[],result:GameResult)=>void}
export function WatchScreen(props:WatchProps){
 // 監督の試合をはじめてする時だけ、作戦・速さ・交代・飛ばすボタンを指さしで案内する(11/5)。
 // 11/6 持ち主「チュートリアルなのに勝手に試合が進む」: 案内の説明(作戦・速さ・交代・飛ばす)の間は試合を止める。
 // 最後の段(結果を見て「次へ」)になったら、いつもどおり進む。案内を終えた・スキップした時も進む。
 const [gi,setGi]=useState(0),hold=!!props.guide&&gi<MATCH_GUIDE.length-1;
 const view=<><WatchView {...props} hold={hold}/>{props.guide&&<MatchGuide steps={MATCH_GUIDE} onIndex={setGi} onDone={()=>props.onGuideDone?.()}/>}</>;
 return typeof document==='undefined'?view:createPortal(view,document.body);
}
function WatchView({state,game,saved,sound,mode:startMode='manage',onSave,onPause,onFinish,hold=false}:WatchProps&{hold?:boolean}){
 const holdRef=useRef(hold);holdRef.current=hold;
 const key=game.key;
 // おまかせで観る(watch): 監督の操作なし・最初は2倍(監督の時とは別に速さを覚える)。途中で「ここから監督する」に切り替えられる。
 void startMode;const mode:WatchMode='manage',modeRef=useRef(mode);// 「おまかせで観る」は外した(11/4 夜)。前に観ていた試合も監督の試合として続きから
 const speedKey=(_m:WatchMode)=>SPEED_KEY;
 const [speed,setSpeedState]=useState<Speed>(()=>readSpeed(undefined,speedKey(mode),1));
 const [sheet,setSheet]=useState<null|'duel'|'sub'|'opp'|'box'|'tactic'|{runner:number}>(null);
 const [hint,setHint]=useState('');
 const [proj,setProj]=useState<Projection|null>(null);
 const [,render]=useReducer((x:number)=>x+1,0);
 const L=useRef<Live|null>(null),timer=useRef<number|undefined>(undefined),speedRef=useRef(speed),soundRef=useRef(sound),sheetRef=useRef(sheet);
 speedRef.current=speed;soundRef.current=sound;sheetRef.current=sheet;
 const club=state.club,season=game.base.season,space=circuitOf(state.season)==='SPACE';
 const teamName=(id:string)=>id===club?state.name:teamById(id,season).short;
 const teamShort=(id:string)=>{const n=teamName(id);return n.length>5?n.slice(0,4):n;};
 // 11/5: チームのイメージカラー(team-colors.ts)。スコアボード・帯・人形のユニフォームを同じ色に。両チームが近い色ならビジターを白い上着に。
 const tc=(id:string)=>teamColorIn(state,id),unis:[Uniform,Uniform]=uniformsFor(tc(game.away),tc(game.home));
 const tmStyle=(id:string)=>({color:readableOnDark(tc(id).main),boxShadow:`inset 3px 0 0 ${tc(id).main}`});
 // 音: 4倍以上は重ならないように間引く(0.25秒に1つ)。8倍以上は試合の終わりと歓声だけ。
 const lastSound=useRef(0);
 const play=(k:Parameters<typeof gameSound>[0],delay=0)=>{if(!soundRef.current)return;const sp=speedRef.current;
  if(sp>=8&&k!=='gameset'&&k!=='cheer')return;
  if(sp>=4){const now=performance.now();if(now-lastSound.current<250&&k!=='gameset')return;lastSound.current=now;}
  gameSound(k,delay);};
 /** 動きに合わせた音(捕る・投げる・塁を踏む・滑る・弾む)を、その瞬間に鳴るよう予約する。倍速は間引く。 */
 const cue=(c:Parameters<typeof soundCues>[0],opts:Parameters<typeof soundCues>[1]={})=>{if(!soundRef.current)return;const sp=speedRef.current;for(const x of thinCues(soundCues(c,opts),sp))gameSound(x.kind,x.t/sp);};
 /** 動きの計算に渡す: 守っている9人と、選手の足・守備・肩(試合の計算と同じ能力)。 */
 const simCtx=(l:Live,side:number):SimCtx=>{
  const s=l.sit,def=1-side,tm=[l.g.away,l.g.home];if(!s)return {fielders:{},rate:()=>({speed:50,field:50,arm:50})};
  const fielders=fieldMap(s.lineups[def],s.defense[def],s.pitcher),onDef=new Set(Object.values(fielders)),memo=new Map<string,{speed:number;field:number;arm:number}>();
  return {fielders,rate:id=>{let r=memo.get(id);if(!r){const sd=onDef.has(id)?def:side;const x=liveRatings(l.base,tm[sd],id,s.pitchers[sd]);r={speed:x.speed,field:x.field,arm:x.arm};memo.set(id,r);}return r;}};
 };
 const clear=()=>{if(timer.current!==undefined){clearTimeout(timer.current);timer.current=undefined;}};
 // 捕った野手の札: 出す時刻と消す時刻のタイマー(試合を進めるタイマーとは別。飛ばし・シート・閉じる時に消す)。
 const cardTimers=useRef<number[]>([]);
 const dropCard=(l:Live|null=L.current)=>{for(const t of cardTimers.current)clearTimeout(t);cardTimers.current=[];if(l)l.fcard=null;};
 /** 札を delay ミリ秒後に出し、ms ミリ秒で消す。ファインプレーの演出の時は、同じ野手の札を演出に合わせて出し直す(間を空けない)。 */
 const showCard=(l:Live,c:Omit<FCard,'n'|'ms'>,delay:number,ms:number)=>{
  const on=()=>{if(L.current!==l)return;const same=l.fcard&&l.fcard.id===c.id&&l.fcard.side===c.side;
   const card:FCard={...c,fine:c.fine||!!(same&&l.fcard!.fine),n:++l.fcardN,ms};l.fcard=card;render();
   cardTimers.current.push(window.setTimeout(()=>{if(L.current===l&&l.fcard===card){l.fcard=null;render();}},ms));};
  if(delay<=0)on();else cardTimers.current.push(window.setTimeout(on,delay));
 };
 const later=(ms:number,fn:()=>void)=>{clear();timer.current=window.setTimeout(()=>{timer.current=undefined;fn();},Math.max(0,ms));};

 // ---- 試合を開く(途中で閉じていた時は、覚えた指示の並びで続きまで進める) ----
 const open=()=>{
  clear();dropCard(null);stopGameAudio();
  const l:Live={g:game,gen:liveGame(game),base:game.base,control:game.control,inputs:[],started:false,sit:null,queue:[],nextSit:null,result:null,finished:null,phase:'decide',pitches:[],pitchShown:0,last:null,log:[],highlights:[],pitchCount:{},tally:newTally(),slotOf:{},posOf:{},pending:null,paNo:0,fx:null,fxN:0,endSit:null,flash:null,steps:[],play:null,clip:null,shownBases:null,animated:false,tabBat:null,tabPit:null,shownBat:{},shownPit:{},hold:null,moves:null,moveNo:0,fcard:null,fcardN:0};
  l.tally=newTally(l.pitchCount);L.current=l;
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
  let homeRun:LiveEvent|null=null,lastPA:LiveEvent|null=null,fxNew:Fx|null=null,fineE:LiveEvent|null=null;
  const sitBefore=l.sit;
  const beforeBat=l.shownBat,beforePit=l.shownPit;
  for(const e of l.queue){
   const prev=l.last?.score??l.sit?.score??[0,0];
   const name=nameOf(e.batter);
   const fielderName=(()=>{const id=playFielder(l.sit,e);return id?nameOf(id):null;})();
   const call=e.play&&(e.play.dp||e.play.fc||e.play.fine||e.play.laser||e.play.tp)?playCall(e.play,name,fielderName):'';
   const text=callText(e.kind,name,e.slot,e.runs,e.inning,{replaced:e.replaced?nameOf(e.replaced):undefined,pitcher:nameOf(e.pitcher),word:e.play?.word,call:call||undefined});
   const lead=(s:number[])=>s[e.side]-s[1-e.side],gold=e.runs>0&&lead(prev)<=0&&lead(e.score)>0;
   const note=isPlateAppearance(e.kind)&&e.tactic?tacticNote(e.kind,e.tactic[0],e.tactic[1]):null;
   l.log.unshift({text:gold?`${text}${lead(prev)<0?'逆転!':'勝ち越し!'}`:text,gold,note});
   if(!quiet&&isPlateAppearance(e.kind)){const walkoff=!!l.result&&e===l.queue[l.queue.length-1]&&e.side===1&&e.runs>0&&e.inning>=9&&l.result.homeRuns>l.result.awayRuns;
    const f=fxFor(e,{comeback:gold&&lead(prev)<0,walkoff,speed:speedRef.current,level:readFxLevel()});if(f){fxNew=f;fineE=f.kind==='FINE'?e:null;}}
   if(e.runs>0)l.highlights.push({inning:e.inning,side:e.side,text});
   if(isPlateAppearance(e.kind)){
    lastPA=e;
    // 球数: 投げる演出で見せた球はもう足してある。残り(飛ばした時は全部)をここで足す。並びは観ても飛ばしても pitchPlan で同じ。
    const thrown=l.phase==='pitch'&&l.pitches.length?l.pitches.length:pitchPlan(e.kind,++l.paNo,e.tactic?.[0]??null).length;
    tallyEnd(l.tally,`${1-e.side}|${e.pitcher}`,thrown);
    if(!quiet){
     // 本塁打は芯で捉えた木製バットの音(打球が飛ぶ所で鳴らしてある)と歓声。
     if(e.kind==='HR'){if(!l.animated)play('hitStrong');{const c=crowd(e);if(c)play(c,.12);}homeRun=e;}
     else if(['1B','2B','3B','E'].includes(e.kind)){if(!l.animated)play(e.kind==='E'?'hitJammed':'hitStrong');if(e.runs){const c=crowd(e);if(c)play(c);}}
     // 捕った音・三振のミットの音は、動きの中で捕った瞬間に鳴らしてある(cue)。動きが無かった時だけここで鳴らす。
     else if(e.kind==='K'){if(!l.animated)play('strikeout');}else{if(!l.animated)play('catch');if(e.runs){const c=crowd(e);if(c)play(c);}}
    }
   }
   l.last=e;
  }
  l.queue=[];
  const before=l.sit;
  // この試合の成績を、見せた所まで写す(打席の結果を見せたこの瞬間に、札と成績表の数が変わる)。
  l.shownBat=snapshot(l.tabBat??undefined);l.shownPit=snapshot(l.tabPit??undefined);
  if(show&&lastPA&&!holdsAfter(lastPA,l.nextSit)){
   // 攻守が替わった・次の打席から投手が替わる: 帯はすぐ次の場面の打者と投手にする(前の投手を残さない)。
   l.hold=null;l.moves=null;if(l.nextSit&&l.nextSit.side!==lastPA.side)l.flash='チェンジ';
  }else if(show&&lastPA){
   const e=lastPA,bt=e.side===0?l.g.away:l.g.home,pt=e.side===0?l.g.home:l.g.away,bk=`${bt}|${e.batter}`,pk=`${pt}|${e.pitcher}`;
   l.hold={side:e.side,batter:e.batter,slot:e.slot,pitcher:e.pitcher,pitchers:before?.pitchers};
   l.moves={n:++l.moveNo,bat:batMove(batLine(season.batting[bk],beforeBat[bk]),batLine(season.batting[bk],l.shownBat[bk])),pit:pitMove(pitLine(season.pitching[pk],beforePit[pk]),pitLine(season.pitching[pk],l.shownPit[pk]))};
  }else if(!show){l.hold=null;l.moves=null;}
  l.sit=l.nextSit;l.nextSit=null;remember(l,l.sit);l.phase='decide';l.pitches=[];l.pitchShown=0;l.steps=[];l.play=null;l.clip=null;l.shownBases=null;l.animated=false;
  // 演出(11/5): ホームランは何号・何ランを下の札に。効果音は段階ごと(評判の良いフリー素材だけ。既に入っている物を使う)。
  if(fxNew&&!quiet){
   if(homeRun&&(fxNew.kind==='HR'||fxNew.kind==='GRAND')){const season_=homeRunNumber(l,homeRun);fxNew={...fxNew,sub:`${homeRun.slot+1}番 ${nameOf(homeRun.batter)}${season_?` 第${season_}号`:''} ${runLabel(homeRun.runs)}`};}
   l.fx=fxNew;l.fxN++;
   // ファインプレー: 捕った野手の札を演出と一緒に出す(演出が消えるまで)。
   if(fxNew.kind==='FINE'&&fineE?.play&&sitBefore){const def=1-fineE.side,pos=NO_POS[fineE.play.fielder] as Pos|undefined,id=pos?fieldMap(sitBefore.lineups[def],sitBefore.defense[def],fineE.pitcher)[pos]:undefined;
    if(pos&&id)showCard(l,{id,side:def,pos,fine:true,expect:playFielder(sitBefore,fineE)??undefined},0,Math.max(900,fxNew.ms));}
   if(fxNew.tier==='big'){play('rainbow');play('rainbowCheer',.15);}else if(fxNew.tier==='mid'){play('gold');}else if(fxNew.kind!=='K')play('reveal');
  }
  if(l.sit&&!quiet&&l.sit.bases.every(Boolean)&&!(before?.bases.every(Boolean)))l.flash='満塁';
  if(l.result){
   l.endSit=before;
   l.finished=l.result;l.result=null;
   const e=l.last,walkoff=!!e&&e.side===1&&e.runs>0&&e.inning>=9&&l.finished.homeRuns>l.finished.awayRuns;
   l.flash=walkoff&&l.fx?.kind==='WALKOFF'?null:walkoff?'サヨナラ!':e?.kind==='K'?'三振でゲームセット':'ゲームセット';
   play('gameset');if(walkoff)play('cheer');
   if(l.fx){const n=l.fxN,ms=l.fx.ms;window.setTimeout(()=>{if(L.current===l&&l.fxN===n){l.fx=null;render();}},ms);}
  }
 };
 /** 点が入った時の観客: 自分のチームの点は歓声、相手の点はため息(観るだけの試合は歓声)。 */
 // 11/6 持ち主「うーんみたいな変な声があるので、それは要らない」: 相手の点のため息(人の声)は外した。相手の点は音なし、自分の点は球場の歓声。
 const crowd=(e:LiveEvent)=>{const c=L.current?.control??-1;return c>=0&&e.side!==c?null:'cheer' as const;};
 /** 自分のチームの打者の今季何号か(レギュラーシーズンの試合だけ。記録の成績表から数える)。 */
 const homeRunNumber=(l:Live,e:LiveEvent)=>{
  const team=e.side===0?l.g.away:l.g.home;if(team!==club||l.g.kind==='post')return 0;
  return (season.batting[`${team}|${e.batter}`]?.hr??0)+(l.sit?.batToday[`${team}|${e.batter}`]?.hr??0);
 };
 /** 1打席: 盗塁の動き → 球を投げる演出 → 打球・走者・守備が動く → 結果を見せる → 次の打者を待つ。 */
 const startPlate=()=>{
  const l=L.current;if(!l||l.finished||sheetRef.current)return;
  l.hold=null;l.moves=null;dropCard(l);// 次の打者が打席に入る(捕った野手の札も、次の打者の投球には残さない)
  let order=l.pending;l.pending=null;
  if(order&&orderBlock(order.kind as OrderKind,l.sit,l.control))order=null;// 状況が変わって出せなくなった指示は捨てる
  pump(l,order);
  const steps:Step[]=[];let bases=l.sit?.bases??[null,null,null];
  for(const e of l.queue){
   if(isPlateAppearance(e.kind)){steps.push({type:'pitches',e,before:bases});steps.push({type:'play',e,before:bases});}
   else if(e.kind==='SB'||e.kind==='CS')steps.push({type:'play',e,before:bases});
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
   l.paNo++;l.pitches=pitchPlan(st.e.kind,l.paNo,st.e.tactic?.[0]??null);l.pitchShown=0;tallyBegin(l.tally,`${1-st.e.side}|${st.e.pitcher}`);render();
   if(!l.pitches.length){runStep(l);return;}// 申告敬遠は球を投げない
   const ctx=simCtx(l,st.e.side),bunt=st.e.kind==='BUNT'||st.e.kind==='BUNT_FAIL';
   // 1球ごと: 投手が投げる動き → 球が届く → カウントと投手の球数(とスタミナの棒)が1つ進む。ファウルは木製バットの軽い音。
   const one=()=>{const c=L.current;if(c!==l||c.phase!=='pitch')return;const i=c.pitchShown,pitch=c.pitches[i];
    const clip=pitchClip(ctx,st.e,st.before,pitch,{last:i===c.pitches.length-1,bunt:bunt&&i===c.pitches.length-1});
    const sp=speedRef.current;c.clip={c:clip,start:performance.now(),speed:sp};cue(clip,{lastK:st.e.kind==='K'&&i===c.pitches.length-1});render();
    later(clip.len*1000/sp,()=>{const d=L.current;if(d!==l||d.phase!=='pitch')return;d.pitchShown++;tallyPitch(d.tally);// ファウルの音は打った瞬間に鳴らす(cue)。前は球の動きが終わってから鳴っていた
     if(d.pitchShown<d.pitches.length){render();later(pitch==='X'?0:120/speedRef.current,one);}
     else{if(!d.steps.length||d.steps[0].type!=='play')d.shownBases=st.e.bases;render();runStep(d);}});};
   one();return;
  }
  const ctx=simCtx(l,st.e.side),d=choreograph(st.e,st.before,ctx);
  if(d.len<=0.15){l.clip=null;l.shownBases=st.e.bases;runStep(l);return;}
  // 打球音: 安打・長打・本塁打・犠牲フライ=芯で捉えた強い当たり、凡打・バント・エラー=詰まった当たり。
  if(!['strikeout','walk','steal','caught-stealing','none'].includes(d.motion))play(['1B','2B','3B','HR','SF'].includes(st.e.kind)?'hitStrong':'hitJammed');
  const ms=d.len*1000/sp;
  l.clip={c:d,start:performance.now(),speed:sp};l.play={d,start:performance.now(),ms,e:st.e};cue(d);render();
  // 捕った瞬間に、捕った野手の札(1倍・2倍だけ。4倍以上は出さない。ファインプレーは演出の時に出す)。
  const ca=d.catchAt,cid=ca?ctx.fielders[ca.pos]:undefined;
  // ファインプレーは、捕ってから動きが終わるまで出したままにして、そのまま演出の札につなぐ。
  if(ca&&cid&&sp<=2)showCard(l,{id:cid,side:1-st.e.side,pos:ca.pos,fine:!!d.fine,expect:st.e.play?playFielder(l.sit,st.e)??'?':cid},ca.t*1000/sp,d.fine?Math.max(1400/sp,(d.len-ca.t)*1000/sp+400):sp>=2?1100:1400);
  later(ms+80,()=>{const c=L.current;if(c!==l||c.phase!=='pitch')return;c.play=null;c.clip=null;c.shownBases=st.e.bases;render();runStep(c);});
 };
 const wait=()=>{
  const l=L.current;if(!l||l.finished||sheetRef.current||holdRef.current)return;
  const s=speedRef.current,fx=l.fx,extra=(fx?fx.ms*.7:0)+(l.moves&&(l.moves.bat||l.moves.pit)?400/s:0);// 演出の間と、成績が変わった時は少しだけ長く見せる
  if(fx){const n=l.fxN;window.setTimeout(()=>{if(L.current===l&&l.fxN===n){l.fx=null;render();}},fx.ms);}
  if(l.flash){const f=l.flash;window.setTimeout(()=>{if(L.current===l&&l.flash===f){l.flash=null;render();}},Math.max(900,1600/s));}
  later(paMillis(s)*.55+extra,startPlate);
 };
 /** 投げている途中なら、その打席の結果まで一気に見せる(交代・指示はそこで止まって受ける)。 */
 const settle=()=>{const l=L.current;if(!l)return;clear();dropCard(l);stopScheduledSounds();if(l.phase==='pitch'){l.pitchShown=l.pitches.length;l.steps=[];l.play=null;l.clip=null;reveal(l,true,true);}};

 useEffect(()=>{open();render();if(L.current&&!L.current.finished&&!sheetRef.current)wait();return clear;// eslint-disable-next-line react-hooks/exhaustive-deps
 },[key]);
 useEffect(()=>{if(sound)void prepareWatchAudio();},[sound]);
 // 案内が終わったら、止めていた試合を進める。
 useEffect(()=>{if(!hold&&L.current&&!L.current.finished&&!sheetRef.current&&L.current.phase==='decide'){clear();wait();}// eslint-disable-next-line react-hooks/exhaustive-deps
 },[hold]);
 useEffect(()=>{const o=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=o;clear();dropCard(null);stopGameAudio();};},[]);
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
 const takeOrder=()=>{let order=l.pending;l.pending=null;if(order&&orderBlock(order.kind as OrderKind,l.sit,control))order=null;return order;};
 const skipPlate=()=>{if(fin)return;clear();dropCard(l);stopScheduledSounds();setHint('');if(l.phase==='pitch'){l.pitchShown=l.pitches.length;l.steps=[];l.play=null;l.clip=null;reveal(l,true,true);}else{l.hold=null;l.moves=null;pump(l,takeOrder());reveal(l,true,true);}render();wait();};
 /** 次のイニングへ(11/5 持ち主「イニングスキップも出来るようにして」): 今の回の残り(表・裏とも)を止まらずに進め、次の回の最初の打席の前で止まる。
  *  指示の渡し方は「次の打席へ」を続けて押したのと同じ(出していた指示は次の打席に1回だけ)なので、結果も同じ。 */
 const skipInning=()=>{if(fin)return;clear();dropCard(l);stopScheduledSounds();setHint('');
  if(l.phase==='pitch'){l.pitchShown=l.pitches.length;l.steps=[];l.play=null;l.clip=null;reveal(l,true);}
  const inning=l.sit?.inning??0;let guard=0;l.hold=null;l.moves=null;
  while(!l.finished&&l.sit&&l.sit.inning===inning&&guard++<400){pump(l,takeOrder(),true);reveal(l,true);}
  onSave?.(l.inputs,modeRef.current);render();if(!l.finished)wait();};
 const skipGame=()=>{if(fin)return;clear();dropCard(l);stopScheduledSounds();setHint('');if(l.phase==='pitch'){l.pitchShown=l.pitches.length;l.steps=[];l.play=null;l.clip=null;reveal(l,true);}let guard=0;while(!l.finished&&guard++<5000){pump(l,takeOrder(),true);reveal(l,true);}onSave?.(l.inputs,modeRef.current);render();};
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
 const applyTactic=(o:WatchOrder)=>{const cur=L.current!;settle();if(!cur.sit||cur.finished)return;pump(cur,o);reveal(cur,true,true);render();};
 /** 作戦を出す相手の場面: 投げている途中は、計算はもう次の打席の前まで進んでいるので、その次の打席(nextSit)。 */
 const target=():LiveSituation|null=>l.phase==='pitch'?l.nextSit:l.sit;
 /** 1タップの作戦(11/4 夜): 次の打者・今の投手に、その打席から。投げている途中でも止めずに、計算の次の打席に入れる。同じ物をもう一度押すと取り消す。 */
 const quickTactic=(kind:'bat'|'pitch',k:string)=>{
  const cur=L.current;if(!cur||cur.finished||control<0)return;
  const t=cur.phase==='pitch'?cur.nextSit:cur.sit;if(!t)return;
  const mineBat=t.side===control;if((kind==='bat')!==mineBat)return;
  const id=mineBat?t.batter:t.pitcher,own=mineBat?t.tactics.batter[id]:t.tactics.pitcher?.[id];
  const next=own===k?null:k;
  const o:WatchOrder={kind:'tactic',scope:mineBat?'batter':'pitcher',id,tactic:next};
  if(cur.phase==='pitch'){pump(cur,o);}else{pump(cur,o);reveal(cur,true,true);}
  const label=next?(mineBat?batTacticLabel[next as BatTactic]:pitchTacticLabel[next as PitchTactic]):'';
  setHint(next?`${nameOf(id)}に「${label}」(この打席から)`:`${nameOf(id)}の作戦を取り消しました`);render();
 };
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
   <tbody>{[0,1].map(s=><tr key={s}><td className={'wt-tm '+(ids[s]===club?'is-mine':'is-rival')} style={tmStyle(ids[s])}>{teamShort(ids[s])}</td>{Array.from({length:n},(_,i)=><td key={i}>{cell(line[s][i])}</td>)}<td className="r">{score[s]}</td><td>{hits[s]}</td><td>{errors[s]}</td></tr>)}</tbody></table>;
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
  const s0=shownSit??(fin&&l.fx?l.endSit:null);if(!s0)return null;
  const s=s0,color=(side:number):'blue'|'red'=>ids[side]===club?'blue':ids[1-side]===club?'red':side===0?'blue':'red';
  const shown=l.shownBases??s.bases,pl=l.play;
  const still=stillScene(simCtx(l,s.side),{batter:s.batter,pitcher:s.pitcher},shown);
  const scene:FieldScene={still,clip:l.clip,defColor:color(1-s.side),batColor:color(s.side),defUni:unis[1-s.side],batUni:unis[s.side],lefty:throwHand(s.pitcher)==='L',leftyBat:batSide(s.batter,s.pitcher)==='L'};
  const banner=pl?.d.banner;
  const fxNow=l.fx,lv=readFxLevel(),shake=!!fxNow&&fxNow.tier!=='small'&&lv==='flashy';
  return <FieldCanvas scene={scene} className={'wt-field mt-field'+(shown.every(Boolean)?' is-loaded':'')+(shake?' is-shake':'')} onSize={setProj}>
   <span className="wt-sr" aria-live="off" data-motion={pl?.d.motion??(l.clip?'pitch':'still')} data-batter-hand={batSide(s.batter,s.pitcher)} data-pitcher-hand={throwHand(s.pitcher)} data-bats={playerMap[s.batter]?.bats??''}>グラウンド</span>
   {!pl&&!l.clip&&proj&&shown.map((id,b)=>{if(!id)return null;const [x,y]=toScreen(proj,leadOff(b)),r=ratingsFor(s.side,id);return <button key={'r'+b} className="wt-tag mt-tag" style={{left:x,top:y-proj.S*8.2}} onClick={()=>openSheet({runner:b})} aria-label={`${['一','二','三'][b]}塁走者 ${nameOf(id)} 走力${gradeOf(r.speed)}`}>走力<b className={gradeClass(r.speed)}>{gradeOf(r.speed)}</b></button>;})}
   {pl&&pl.d.word&&<span className="wt-play-word" aria-hidden="true">{pl.d.word}</span>}
   {pl&&banner&&<span key={pl.start} className="mt-banner" style={{animationDelay:`${Math.round(banner.t*1000/speed)}ms`}} aria-hidden="true">{banner.text}</span>}
   {statPops()}
   {countPanel()}
   {fxNow&&<PlayFx fx={fxNow} level={lv} n={l.fxN}/>}
   {fxNow&&fxNow.sub&&(fxNow.kind==='HR'||fxNow.kind==='GRAND')&&<p className="pfx-hrsub" key={'h'+l.fxN}>{fxNow.sub}</p>}
  </FieldCanvas>;
 };
 /** カウント・アウト・走者・回(グラウンドの左下に小さく重ねる。ファウルの所で、選手とは重ならない)。 */
 const countPanel=()=>{
  const c=l.phase==='pitch'?countOf(l.pitches.slice(0,l.pitchShown)):{b:0,s:0},outs=sit?.outs??(fin?3:0),bases=l.shownBases??sit?.bases??[null,null,null];
  const lamp=(n:number,max:number,cls:string)=>Array.from({length:max},(_,i)=><i key={i} className={i<n?cls:''}/>);
  return <div className={'wt-count is-overlay'+(bases.every(Boolean)?' is-loaded':'')} aria-label="カウント・アウト・走者">
   <div className="mt-mini-score" aria-hidden="true">{[0,1].map(x=><p key={x} className={ids[x]===club?'is-mine':'is-rival'}><span style={{color:readableOnDark(tc(ids[x]).main)}}>{teamShort(ids[x])}</span><b>{(sit?.score??l.last?.score??[0,0])[x]}</b></p>)}</div>
   <div className="wt-inn"><b>{sit?`${sit.inning}回${sit.side===0?'表':'裏'}`:'試合終了'}</b><span>{sit&&bases.some(Boolean)?(bases.every(Boolean)?'満塁':['一','二','三'].filter((_,i)=>bases[i]).join('・')+'塁'):''}</span></div>
   <div className="wt-lamps"><p><small>B</small>{lamp(c.b,3,'is-b')}</p><p><small>S</small>{lamp(c.s,2,'is-s')}</p><p><small>O</small>{lamp(Math.min(2,outs),2,'is-o')}</p></div>
  </div>;
 };
 /** 捕った野手の札(11/6 夜): 守備位置・名前、肩・守備の段と短い棒(打者の帯の Mini と同じ)。値はその守備位置での値(本職でない所は下がる)。 */
 const fieldCard=(c:FCard)=>{
  const p=playerMap[c.id],raw=ratingsFor(c.side,c.id),label=POS_LABEL[c.pos],dv=p&&c.pos!=='P'?defenseAtPosition(p,POS_DATA[c.pos],raw):{arm:raw.arm,field:raw.field};
  const team=ids[c.side],expect=c.expect??'';
  return <div key={c.n} className={'wt-fcard'+(c.fine?' is-fine':'')+(team===club?' is-mine':' is-rival')} style={{'--tc':tc(team).main,'--fc-ms':`${c.ms}ms`} as CSSProperties} data-id={c.id} data-pos={c.pos} data-expect={expect} aria-label={`${label} ${nameOf(c.id)} 肩${gradeOf(dv.arm)} 守備${gradeOf(dv.field)}`}>
   <p className="wt-fcard-who"><em>{label}</em><b>{nameOf(c.id)}</b>{c.fine&&<small>好守</small>}</p>
   <div className="wt-minis"><Mini v={dv.arm} label="肩"/><Mini v={dv.field} label="守備"/></div>
  </div>;
 };
 /** 打者と投手の帯(11/4 夜おそく): 能力の段と短い棒を常に出す(打者=ミート・パワー・走力、投手=球速・制球・スタミナ)。
  *  投手のスタミナの棒は今日の残り(1球ごとに減る)。成績は 打率・本塁打・打点・今日 / 防御率・球数・奪三振(今日と今季)。押すと詳しい能力のシート。 */
 const duelCards=()=>{
  // 打席の結果を見せた直後は、その打者と投手を次の打席が始まるまで残す(変わった成績を見せる)。
  const h=l.hold,s=h??(shownSit&&{side:shownSit.side,batter:shownSit.batter,slot:shownSit.slot,pitcher:shownSit.pitcher,pitchers:shownSit.pitchers});
  if(!s)return null;const bt=ids[s.side],pt=ids[1-s.side];
  const b=box.bat[`${bt}|${s.batter}`] as BatStats|undefined,p=box.pit[`${pt}|${s.pitcher}`] as PitStats|undefined;
  const mv=h?l.moves:null,bm=mv?.bat??null,pm=mv?.pit??null,n=mv?.n;
  const bl=batOf(bt,s.batter),pl=pitOf(pt,s.pitcher),hand=batSide(s.batter,s.pitcher),arm=throwHand(s.pitcher);
  const bats=playerMap[s.batter]?.bats==='両'?'両打':hand==='L'?'左打':'右打';
  const br=ratingsFor(s.side,s.batter,s.pitchers),pr=ratingsFor(1-s.side,s.pitcher,s.pitchers);
  const pitches=l.pitchCount[`${1-s.side}|${s.pitcher}`]??0,starter=longArm(s.pitcher,(sit??shownSit)?.usedPitchers[1-s.side],(sit??shownSit)?.pitchers[1-s.side]);
  const left=staminaLeft(pr.stamina,pitches,starter),soToday=p?.so??0,soFrom=pm?.so?soToday-(pm.to.so-pm.from.so):soToday;
  return <div className="wt-duel is-strip is-abil" role="button" tabIndex={0} onClick={()=>openSheet('duel')} onKeyDown={e=>{if(e.key==='Enter')openSheet('duel');}} aria-label="打者と投手(押すと詳しい能力)">
   <div className={'wt-card '+(bt===club?'is-mine':'is-rival')} style={{'--tc':tc(bt).main} as CSSProperties}><h3><em>{s.slot+1}番</em><span>{nameOf(s.batter)}</span><i className="wt-hand">{bats}</i></h3>
    <div className="wt-minis"><Mini v={br.contact} label="ミート"/><Mini v={br.power} label="パワー"/><Mini v={br.speed} label="走力"/></div>
    <p className="wt-strip-line"><small>打率</small><Moved from={bm?avgText(bm.from):''} to={avgText(bl)} move={bm?.avg} n={n}/><Moved from={bm?String(bm.from.hr):''} to={String(bl.hr)} move={bm?.hr} arrow={false} n={n} unit="本"/></p>
    <p className="wt-strip-line"><small>打点</small><Moved from={bm?String(bm.from.rbi):''} to={String(bl.rbi)} move={bm?.rbi} arrow={false} n={n}/><span className="wt-today">今日{b&&b.pa?`${b.ab}-${b.hits}`:'-'}</span></p></div>
   <div className={'wt-card '+(pt===club?'is-mine':'is-rival')} style={{'--tc':tc(pt).main} as CSSProperties}><h3><em className="is-p">投</em><span>{nameOf(s.pitcher)}</span><i className="wt-hand">{arm==='L'?'左投':'右投'}</i></h3>
    <div className="wt-minis"><MiniVelocity r={pr} id={s.pitcher}/><Mini v={pr.control} label="制球"/><Mini v={pr.stamina} label="スタミナ" left={left}/></div>
    <p className="wt-strip-line"><small>防御率</small><Moved from={pm?eraText(pm.from):''} to={eraText(pl)} move={pm?.era} n={n}/><span className="wt-today" data-pitches={pitches}>{pitches}球</span></p>
    <p className="wt-strip-line wt-so" data-so-today={soToday} data-so-season={pl.so}><small>奪三振 今日</small><Moved from={String(soFrom)} to={String(soToday)} move={pm?.so} arrow={false} n={n}/><small>今季</small><Moved from={pm?String(pm.from.so):''} to={String(pl.so)} move={pm?.so} arrow={false} n={n}/></p></div>
  </div>;
 };
 /** 作戦の切り替え(常に並べる): 攻撃の時は次の打者へ(長打狙い・ミート打ち・積極的に・慎重に)、守りの時は今の投手へ(直球中心〜ストライク中心)。 */
 /** 帯にいま出ている打者(mineBat)または投手。結果を見せている間は残した人、投げている途中はいま打席の人。 */
 const shownWho=(mineBat:boolean)=>{const s=l.hold??shownSit;return s?(mineBat?s.batter:s.pitcher):null;};
 const quickRow=()=>{
  const t=target();if(!t||control<0)return null;const mineBat=t.side===control;
  const id=mineBat?t.batter:t.pitcher,own=mineBat?t.tactics.batter[id]??null:t.tactics.pitcher?.[id]??null;
  const team=mineBat?t.tactics.team:t.tactics.pitch,now=mineBat?batTacticFor(t.tactics,id):pitchTacticFor(t.tactics,id);
  const keys=(mineBat?BAT_TACTICS:PITCH_TACTICS) as string[];
  const label=(k:string)=>mineBat?batTacticLabel[k as BatTactic]:pitchTacticLabel[k as PitchTactic];
  return <div className={'wt-quick '+(mineBat?'is-bat':'is-pitch')} role="group" aria-label={mineBat?`次の打者 ${nameOf(id)} への作戦`:`投手 ${nameOf(id)} への作戦`}>
   <p className="wt-quick-who"><small>{tacticWho(mineBat,id,shownWho(mineBat))}</small><b>{nameOf(id)}</b></p>
   {keys.map(k=>{const on=now===k,mineOnly=own===k,lb=label(k),cut=lb.endsWith('中心')?lb.length-2:lb.length;
    return <button key={k} className={'wt-qt'+(on?' is-on':'')+(on&&!mineOnly&&team===k?' is-team':'')} aria-pressed={on} onClick={()=>quickTactic(mineBat?'bat':'pitch',k)}><b>{lb.slice(0,cut)}</b>{cut<lb.length&&<small>{lb.slice(cut)}</small>}</button>;})}
  </div>;
 };
 const managerPanel=()=>{
  const t=target(),mineBat=!!t&&t.side===control;
  const btn=(k:'bunt'|'steal'|'ibb',label:string)=><button className={'wt-mg'+(why[k]?' is-off':'')+(l.pending?.kind===k?' is-pending':'')} aria-disabled={!!why[k]} onClick={()=>order(k)}>{label}{l.pending?.kind===k&&<small className="is-on">指示中</small>}</button>;
  const tacticOn=!!sit&&(!!sit.tactics.team||!!sit.tactics.pitch||Object.keys(sit.tactics.batter).length>0||Object.keys(sit.tactics.pitcher??{}).length>0);
  // その場面で使える指示だけを出す(攻撃の時は送りバント・盗塁、守りの時は敬遠)。走者の位置などで出せない時は灰色。
  return <section className="wt-manager is-compact" aria-label="監督の操作">{quickRow()}<div className="wt-mgs is-row">{mineBat?<>{btn('bunt','送りバント')}{btn('steal','盗塁')}</>:btn('ibb','敬遠')}<button className={'wt-mg'+(why.sub?' is-off':'')} data-guide="sub" aria-disabled={!!why.sub} onClick={()=>{if(why.sub){setHint(why.sub);return;}openSheet('sub');}}>{mineBat?'代打・代走':'守備・投手交代'}</button><button className={'wt-mg is-tactic'+(why.sub?' is-off':'')+(tacticOn?' is-pending':'')} aria-disabled={!!why.sub} onClick={()=>{if(why.sub){setHint(why.sub);return;}openSheet('tactic');}}>作戦一覧</button></div>{hint&&<p className="wt-hint" role="status">{hint}</p>}</section>;
 };
 // 11/5: 速さは1つのボタンで 1→2→4→8→16→1(持ち主「4倍・8倍・16倍速も入れて」)。今の速さを大きく出す。選んだ速さは次の試合にも残る。
 const nextSpeed=speeds[(speeds.indexOf(speed)+1)%speeds.length] as Speed;
 const speedBar=()=><div className="wt-speed" role="group" aria-label="速さ"><button className="wt-speed-cycle is-on" data-speed={speed} aria-label={`速さ ${speed}倍(押すと${nextSpeed}倍)`} onClick={()=>setSpeed(nextSpeed)}><b>{speed}倍</b><small>▶ {nextSpeed}倍</small></button><i/><button className="wt-skip" onClick={skipPlate} disabled={!!fin}>次の<br/>打席へ</button><button className="wt-skip" data-guide="inning" onClick={skipInning} disabled={!!fin}>次の<br/>イニングへ</button><button className="wt-skip" onClick={skipGame} disabled={!!fin}>試合<br/>終了まで</button></div>;
 const mine=control===0?[fin?.awayRuns??0,fin?.homeRuns??0]:[fin?.homeRuns??0,fin?.awayRuns??0];
 const verdict=!fin?'':control<0?'':mine[0]>mine[1]?'勝ち':mine[0]<mine[1]?'負け':'引き分け';
 /** 試合終了: 勝敗・スコア・勝ち負けの投手・その試合の主な成績(自分のチームの打者の上位と投手、相手の本塁打)を1画面に。 */
 const finalPanel=()=>{
  if(!fin)return null;const bx=fin.box!,my=ids[control>=0?control:0],other=ids[control>=0?1-control:1];
  const dec=(k:'wins'|'losses'|'saves')=>bx.pitching.find(p=>p[k]>0);
  const score=(b:BatStats)=>b.hr*6+b.hits*2+b.rbi*2+b.bb*.5+(b.sb??0);
  const stars=bx.batting.filter(b=>b.team===my&&b.pa>0).sort((a,b)=>score(b)-score(a)).slice(0,3).filter(b=>score(b)>0);
  const pits=bx.pitching.filter(p=>p.team===my).slice(0,2),theirHr=bx.batting.filter(b=>b.team===other&&b.hr>0);
  const batText=(b:BatStats)=>`${b.ab}打数${b.hits}安打${b.hr?` ${b.hr}本塁打`:''}${b.rbi?` ${b.rbi}打点`:''}${b.sb?` ${b.sb}盗塁`:''}`;
  return <section className="wt-final is-compact"><h3>{verdict&&<span className={'is-'+(verdict==='勝ち'?'win':verdict==='負け'?'lose':'draw')}>{verdict}</span>}<b>{teamShort(g.away)} {fin.awayRuns} - {fin.homeRuns} {teamShort(g.home)}</b></h3>
   <p className="wt-final-dec">{dec('wins')&&<span><em className="is-w">勝</em>{nameOf(dec('wins')!.playerId)}</span>}{dec('losses')&&<span><em className="is-l">負</em>{nameOf(dec('losses')!.playerId)}</span>}{dec('saves')&&<span><em className="is-s">S</em>{nameOf(dec('saves')!.playerId)}</span>}</p>
   <ul className="wt-final-stars">{stars.map(b=><li key={b.playerId}><b>{nameOf(b.playerId)}</b><span>{batText(b)}</span></li>)}
    {pits.map(p=><li key={'p'+p.playerId}><b>{nameOf(p.playerId)}</b><span>{formatIP(p.outs)}回 {l.pitchCount[`${control>=0?control:0}|${p.playerId}`]??0}球 {p.so}奪三振 {p.er}自責</span></li>)}
    {theirHr.slice(0,2).map(b=><li key={'h'+b.playerId} className="is-rival"><b>{nameOf(b.playerId)}</b><span>(相手){b.hr}本塁打 {b.rbi}打点</span></li>)}</ul>
   <p className="wt-final-note">この結果がシーズンの成績・順位{g.kind==='post'?'・勝ち上がり':''}に入ります。</p>
   <div className="wt-final-btns"><button className="wt-navy" onClick={()=>openSheet('box')}>成績表</button><button className="wt-gold" onClick={finish}>次へ</button></div></section>;
 };

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
  <div className="wt-wrap wt-one">
   <header className="wt-head"><button className="wt-back" aria-label={fin?'次へ':'試合を中断して戻る'} onClick={back}>{fin?'次へ':'中断'}</button><FitTitle label={g.label} teams={`${teamName(g.away)} - ${teamName(g.home)}`}/><div><button onClick={()=>openSheet('opp')}>相手チーム</button><button onClick={()=>openSheet('box')}>成績表</button></div></header>
   {scoreboard()}
   {(!fin||l.fx)&&field()}
   <div className="wt-callbox"><div className={'wt-call'+(l.log[0]?.gold?' is-gold':'')} aria-live="polite"><em aria-hidden="true">実況</em><span>{l.log[0]?.note&&<b className={'wt-note-tag is-'+(l.log[0].note.good?'good':'bad')}>{l.log[0].note.text}</b>}{l.log[0]?.text??'プレイボール!'}</span></div>
    {l.fcard&&fieldCard(l.fcard)}</div>
   {!fin&&duelCards()}
   {!l.fx&&finalPanel()}
   {!fin&&<div className="wt-dock">{control>=0&&managerPanel()}{speedBar()}</div>}
  </div>
  {/* 演出は field() の中(グラウンドの枠の中)に出す(PlayFx) */}
  {l.flash&&<div className="wt-flash" aria-live="assertive">{l.flash}</div>}
  {sheet==='duel'&&duelSheet()}
  {sheet&&typeof sheet==='object'&&runnerSheet(sheet.runner)}
  {sheet==='sub'&&sit&&control>=0&&<SubSheet l={l} sit={sit} ids={ids} club={club} ratingsFor={ratingsFor} box={box} batOf={batOf} pitOf={pitOf} onApply={applySub} onClose={()=>setSheet(null)}/>}
  {sheet==='opp'&&<TeamSheet team={control===0?g.home:control===1?g.away:g.home} other={control<0?g.away:null} l={l} ids={ids} teamName={teamName} ratingsFor={ratingsFor} batOf={batOf} pitOf={pitOf} onClose={()=>setSheet(null)}/>}
  {sheet==='tactic'&&sit&&control>=0&&<TacticSheet sit={sit} control={control} ratingsFor={ratingsFor} onApply={applyTactic} onClose={()=>setSheet(null)}/>}
  {sheet==='box'&&<BoxSheet l={l} ids={ids} club={club} teamName={teamName} batOf={batOf} pitOf={pitOf} onClose={()=>setSheet(null)}/>}
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
  <div className="wt-final-btns is-sticky"><button className="wt-gold" onClick={onClose}>決定</button></div>
 </div></div>;
}

// ---- 選手交代 ----
// 11/4 夜(持ち主「守備交代するときにポジションが出てないから、何が何かわからない」): 守っている9人に守備位置(投・捕・一・二・三・遊・左・中・右)と
// 打順を付け、「1. 代える位置」→「2. 入れる選手」の順に選ぶ。控えには本職・守れる所と、その位置の守備の段(A〜G)を出し、本職でない時は一言。
// 守っている選手どうしの位置の入れ替えもできる(代打・代走で入った選手を別の位置へ)。左・中・右は、グラウンドの絵と同じく打順の並びで決める。
type SubTab='pinch'|'runner'|'field'|'pitcher';
const OF_NAMES=['左','中','右'];
/** 守備位置の呼び名(外野は打順の並びで 左・中・右。グラウンドの絵と同じ決まり)。 */
export function positionNames(lineup:string[],defense:Record<string,string>):Record<string,string>{
 let of=0;const out:Record<string,string>={};
 for(const id of lineup){const p=defense[id];out[id]=p==='外'?OF_NAMES[of++%3]:p==='DH'?'指':p;}
 return out;
}
const canPlay=(id:string)=>{const f=posFitLine(id);return f.length?f.map(x=>`${x.pos}${x.mark}`).join(' '):'—';};
function SubSheet({l,sit,ids,club,ratingsFor,box,batOf,pitOf,onApply,onClose}:{l:Live;sit:LiveSituation;ids:string[];club:string;ratingsFor:(side:number,id:string)=>Ratings;box:{bat:Record<string,BatStats>;pit:Record<string,PitStats>};batOf:(t:string,id:string)=>BatLine;pitOf:(t:string,id:string)=>PitLine;onApply:(o:WatchOrder)=>void;onClose:()=>void}){
 void club;
 const side=l.control,atBat=sit.side===side,team=ids[side];
 const lineup=sit.lineups[side],defense=sit.defense[side],removed=sit.removed[side],names=positionNames(lineup,defense);
 const firstRunner=sit.bases.findIndex(Boolean);
 const [tab,setTab]=useState<SubTab>(atBat?'pinch':'field');
 const [base,setBase]=useState(firstRunner<0?0:firstRunner);
 const fielderSlots=lineup.map((id,i)=>[id,i] as const).filter(([id])=>defense[id]!=='DH');
 const [slot,setSlot]=useState<number|null>(null);
 // pick: 入れる選手。bench=控えから、swap=守っている選手と位置を入れ替え。
 const [pick,setPick]=useState<{id:string;swap:boolean}|null>(null);
 const tabWhy:Record<SubTab,string>={pinch:atBat?'':'代打は攻撃の時だけ',runner:!atBat?'代走は攻撃の時だけ':firstRunner<0?'塁に走者がいない':'',field:atBat?'守備交代は守りの時だけ':'',pitcher:atBat?'投手交代は守りの時だけ':''};
 const bench=Object.keys(l.base.owned).filter(id=>!l.base.pitchers.includes(id)&&playerMap[id]&&!lineup.includes(id)).sort((a,b)=>Number(removed.includes(a))-Number(removed.includes(b))||(playerMap[a].name<playerMap[b].name?-1:1));
 const target=tab==='pinch'?sit.slot:tab==='runner'?lineup.indexOf(sit.bases[base]??''):tab==='field'?slot??-1:-1;
 const targetId=target>=0?lineup[target]:tab==='pitcher'?sit.pitcher:'';
 const targetPos=target>=0?defense[lineup[target]]:'';
 const choose=(t:SubTab)=>{if(tabWhy[t])return;setTab(t);setPick(null);setSlot(null);};
 const decide=()=>{if(!pick||tabWhy[tab])return;
  if(tab==='pinch')onApply({kind:'pinch',slot:sit.slot,id:pick.id});
  else if(tab==='runner')onApply({kind:'runner',base,id:pick.id});
  else if(tab==='field'&&slot!==null){if(pick.swap)onApply({kind:'move',slot:lineup.indexOf(pick.id),position:targetPos});else onApply({kind:'field',slot,id:pick.id});}
  else if(tab==='pitcher')onApply({kind:'pitcher',id:pick.id});
 };
 /** その位置の守備の段(本職でなければ下がる。試合の計算と同じ defenseAtPosition)。 */
 const posGrade=(id:string,pos:string)=>{const p=playerMap[id];if(!p||!pos||pos==='DH')return null;const v=defenseAtPosition(p,pos,ratingsFor(side,id)).field;return {v,fit:fitsPosition(p,pos)};};
 const gradeBadge=(g:{v:number;fit:boolean}|null)=>g&&<b className={'wt-medal '+gradeClass(g.v)}>{gradeOf(g.v)}</b>;
 const benchRow=(id:string)=>{const block=substituteBlock(lineup,removed,id),r=ratingsFor(side,id),sb=batOf(team,id),on=pick?.id===id&&!pick.swap;
  const g=tab==='field'?posGrade(id,targetPos):tab==='pinch'||tab==='runner'?posGrade(id,targetPos):null;
  return <div key={id} className={'wt-pr'+(block?' is-off':'')+(on?' is-pick':'')}><img src={`/assets/pro/watch/batter_${block?'red':'blue'}.webp`} alt="" className={block?'is-gray':''}/><div className="wt-pr-name"><b>{playerMap[id].name}</b><small>守れる所 {canPlay(id)}</small>{g&&<small className={'wt-fit'+(g.fit?'':' is-bad')}>{names[targetId]??posLabel(targetPos)}の守備 {gradeBadge(g)}{g.fit?'':' 本職ではありません'}</small>}</div>
   <div className="wt-pr-ab"><div className="wt-abs is-row">{tab==='runner'?<><Grade v={r.speed} label="走力"/><Grade v={r.contact} label="ミート"/><Grade v={r.field} label="守備"/><Grade v={r.arm} label="肩"/></>:<><Grade v={r.contact} label="ミート"/><Grade v={r.power} label="パワー"/><Grade v={r.speed} label="走力"/><Grade v={r.field} label="守備"/></>}</div><p>今季 打率{avgText(sb)} {sb.hr}本 {sb.sb}盗塁</p></div>
   <button className={block?'wt-pr-btn is-off':'wt-pr-btn'} aria-disabled={!!block} onClick={()=>{if(!block)setPick({id,swap:false});}}>{block??(on?'選択中':tab==='field'?'この選手を入れる':'この選手を出す')}</button></div>;};
 const swapRow=(id:string)=>{const i=lineup.indexOf(id),pos=defense[id],to=posGrade(id,targetPos),back=posGrade(targetId,pos),on=pick?.id===id&&pick.swap;
  return <div key={'s'+id} className={'wt-pr is-swap'+(on?' is-pick':'')}><span className="wt-posbig">{names[id]}</span><div className="wt-pr-name"><b>{i+1}番 {nameOf(id)}</b><small>{names[id]}→{names[targetId]} の守備 {gradeBadge(to)}{to&&!to.fit?' 本職ではありません':''}</small><small>{nameOf(targetId)}は{names[id]}へ {gradeBadge(back)}{back&&!back.fit?' 本職ではありません':''}</small></div>
   <button className="wt-pr-btn" onClick={()=>setPick({id,swap:true})}>{on?'選択中':'位置を入れ替える'}</button></div>;};
 const penRow=(id:string)=>{const used=sit.usedPitchers[side].includes(id),current=id===sit.pitcher,r=ratingsFor(side,id),today=box.pit[`${team}|${id}`],ss=pitOf(team,id),on=pick?.id===id;
  const block=current?'いま投げている':used?'この投手はもう投げた':null,arm=throwHand(id)==='L'?'左投':'右投';
  return <div key={id} className={'wt-pr'+(block?' is-off':'')+(on?' is-pick':'')}><img src="/assets/pro/watch/pitcher_blue.webp" alt="" className={block?'is-gray':''}/><div className="wt-pr-name"><b>{playerMap[id].name}</b><small>{arm}・{today?`今日 ${formatIP(today.outs)}回 ${l.pitchCount[`${side}|${id}`]??0}球`:'今日 未登板'}</small></div>
   <div className="wt-pr-ab"><div className="wt-abs is-row"><Velocity r={r} id={id}/><Grade v={r.stamina} label="スタミナ"/><Grade v={r.control} label="制球"/><Grade v={r.breaking} label="変化球"/></div><p>今季 防御率{eraText(ss)} {ss.wins}勝 {ss.saves}S</p></div>
   <button className={block?'wt-pr-btn is-off':'wt-pr-btn'} aria-disabled={!!block} onClick={()=>{if(!block)setPick({id,swap:false});}}>{block??(on?'選択中':'この投手に替える')}</button></div>;};
 // 交代後の予定(打順・守備位置)
 const after=(()=>{const lu=[...lineup],df={...defense};
  if(pick&&target>=0&&tab!=='pitcher'){if(pick.swap){const other=pick.id,p=df[other];df[other]=df[targetId];df[targetId]=p;}else{lu[target]=pick.id;df[pick.id]=df[targetId];delete df[targetId];}}
  return {lu,df,names:positionNames(lu,df)};})();
 const tr=targetId?ratingsFor(side,targetId):null,pToday=box.pit[`${team}|${sit.pitcher}`];
 return <div className="wt-sheet-back" onClick={onClose}><div className="wt-sheet wt-sub" role="dialog" aria-modal="true" aria-label="選手交代" onClick={e=>e.stopPropagation()}>
  <header><h2>選手交代</h2><button className="wt-x" aria-label="閉じる" onClick={onClose}>閉じる</button></header>
  <div className="wt-tabs" role="tablist">{(atBat?['pinch','runner']:['field','pitcher'] as SubTab[]).map(t=><button key={t} role="tab" aria-selected={tab===t} aria-disabled={!!tabWhy[t as SubTab]} className={(tab===t?'is-on':'')+(tabWhy[t as SubTab]?' is-off':'')} onClick={()=>choose(t as SubTab)}>{({pinch:'代打',runner:'代走',field:'守備交代',pitcher:'投手交代'} as Record<string,string>)[t]}</button>)}</div>
  {tab==='field'&&<>
   <h4 className="wt-band">1. 代える位置を選ぶ</h4>
   <div className="wt-posgrid">{fielderSlots.map(([id,i])=>{const g=posGrade(id,defense[id]);return <button key={id} className={slot===i?'is-on':''} aria-pressed={slot===i} onClick={()=>{setSlot(i);setPick(null);}}><b>{names[id]}</b><span><small>{i+1}番</small><i>{nameOf(id)}</i></span>{g&&<em className="wt-pg-def"><small>守備</small>{gradeBadge(g)}</em>}</button>;})}
    <button className="is-pitcher" onClick={()=>choose('pitcher')}><b>投</b><span><small>投手</small><i>{nameOf(sit.pitcher)}</i></span><em>交代へ</em></button></div>
   {slot===null?<p className="wt-note">代える選手の位置を押してください。次に、入れる選手(控え)か、位置を入れ替える選手を選びます。</p>:<>
    <h4 className="wt-band">2. {names[targetId]}({target+1}番 {nameOf(targetId)})に入れる選手</h4>
    <div className="wt-list">{bench.length?bench.map(benchRow):<p className="wt-note">ベンチに出せる選手がいません。</p>}</div>
    <h4 className="wt-band">守っている選手と位置を入れ替える</h4>
    <div className="wt-list">{fielderSlots.filter(([id])=>id!==targetId&&!(defense[id]==='外'&&targetPos==='外')).map(([id])=>swapRow(id))}</div>
   </>}
  </>}
  {tab==='runner'&&<div className="wt-choose">{sit.bases.map((id,b)=>id&&<button key={b} className={base===b?'is-on':''} onClick={()=>{setBase(b);setPick(null);}}>{['一','二','三'][b]}塁 {nameOf(id)}({names[id]??''})</button>)}</div>}
  {(tab==='pinch'||tab==='runner'||tab==='pitcher')&&tr&&<div className="wt-target"><img src={`/assets/pro/watch/${tab==='pitcher'?'pitcher':tab==='runner'?'runner':'batter'}_blue.webp`} alt=""/><div><h3>{tab==='pitcher'?<em className="is-p">投手</em>:<em>{target+1}番 {names[targetId]}</em>}{nameOf(targetId)}<small>{tab==='pitcher'?`いま投げている・${throwHand(targetId)==='L'?'左投':'右投'}`:tab==='runner'?`${['一','二','三'][base]}塁の走者`:'いまの打者'}</small></h3>
   <div className="wt-abs is-row">{tab==='pitcher'?<><Velocity r={tr} id={targetId}/><Grade v={tr.stamina} label="スタミナ"/><Grade v={tr.control} label="制球"/><Grade v={tr.breaking} label="変化球"/></>:<><Grade v={tr.contact} label="ミート"/><Grade v={tr.power} label="パワー"/><Grade v={tr.speed} label="走力"/><Grade v={tr.field} label="守備"/></>}</div>
   <p className="wt-today">今日 {tab==='pitcher'?(pToday?`${formatIP(pToday.outs)}回 ${l.pitchCount[`${side}|${sit.pitcher}`]??0}球 ${pToday.er}自責 ${pToday.so}奪三振 スタミナ残り${Math.round(staminaLeft(tr.stamina,l.pitchCount[`${side}|${sit.pitcher}`]??0,longArm(sit.pitcher,sit.usedPitchers[side],sit.pitchers[side]))*100)}%`:'—'):(box.bat[`${team}|${targetId}`]?`${box.bat[`${team}|${targetId}`].ab}打数${box.bat[`${team}|${targetId}`].hits}安打`:'—')}</p></div></div>}
  {(tab==='pinch'||tab==='runner')&&<><p className="wt-note">入った選手は、{nameOf(targetId)}の守備位置({names[targetId]})に入ります。守りの回に「守備・投手交代」→「守備交代」で、位置を入れ替えられます。</p>
   <h4 className="wt-band">ベンチの選手({tab==='pinch'?'代打':'代走'})</h4><div className="wt-list">{bench.length?bench.map(benchRow):<p className="wt-note">ベンチに出せる選手がいません。チーム画面で控えを増やすと、代打・代走・守備交代に出せます。</p>}</div></>}
  {tab==='pitcher'&&<><h4 className="wt-band">ブルペン(投手交代)</h4><div className="wt-list">{sit.pitchers[side].filter(id=>id!==sit.pitcher).map(penRow)}</div></>}
  {tab!=='pitcher'&&(tab!=='field'||slot!==null)&&<><h4 className="wt-band">打順と守備位置(交代後の予定)</h4><table className="wt-order"><thead><tr><th>打順</th><th>選手名</th><th>守備</th></tr></thead><tbody>{after.lu.map((id,i)=><tr key={i} className={i===target||(pick?.swap&&id===pick.id)?'is-target':''}><td>{i+1}</td><td>{nameOf(id)}</td><td>{after.names[id]}</td></tr>)}</tbody></table></>}
  <p className="wt-note">{GRADE_GUIDE}。守れる所の ◎=本職 ○=守れる △=苦手。退いた選手・もう投げた投手は、この試合に戻れません。</p>
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
  <div className="wt-scroll">{tab==='pit'?<table className="wt-roster"><thead><tr><th></th><th>投手</th><th>球速</th><th>制球</th><th>スタミナ</th><th>変化</th><th>今季</th></tr></thead><tbody>{pitchers.map(pitRow)}</tbody></table>
   :<table className="wt-roster"><thead><tr><th>打順</th><th>選手</th><th>位置</th><th>ミート</th><th>パワー</th><th>走力</th><th>守備</th><th>今季</th></tr></thead><tbody>{tab==='bat'?lineup.map((id,i)=>batRow(id,i)):bench.length?bench.map(id=>batRow(id,null)):<tr><td colSpan={8}>控えの野手はいません</td></tr>}</tbody></table>}</div>
  <p className="wt-note">{GRADE_GUIDE}。能力は試合の計算に使う値(相手の補正込み)。宇宙リーグの相手は99を超えて S+ になる能力があります。</p>
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
  <div className="wt-scroll"><table className="wt-bx"><thead><tr><th>打順</th><th>名前</th><th>守</th><th>打数</th><th>安打</th><th>打点</th><th>本</th><th>四死</th><th>三振</th><th>併殺</th><th>今季打率</th></tr></thead>
   <tbody>{rows.map(({b,slot})=><tr key={b.playerId}><td className="wt-no">{slot<9?slot+1:''}</td><td className="wt-nm">{nameOf(b.playerId)}</td><td>{posLabel(l.posOf[`${side}|${b.playerId}`])}</td><td>{b.ab}</td><td>{b.hits}</td><td>{b.rbi}</td><td>{b.hr?<b className="wt-hr-mark">{b.hr}</b>:0}</td><td>{b.bb+b.hbp}</td><td>{b.so}</td><td>{b.gdp??0}</td><td>{avgText(batOf(team,b.playerId))}</td></tr>)}</tbody></table></div>
  <h4 className="wt-band">投手成績</h4>
  <div className="wt-scroll"><table className="wt-bx"><thead><tr><th></th><th>名前</th><th>回</th><th>球数</th><th>被安</th><th>自責</th><th>奪三</th><th>四死</th><th>今季防御率</th></tr></thead>
   <tbody>{pits.map(p=><tr key={p.playerId}><td>{p.wins?<em className="is-w">勝</em>:p.losses?<em className="is-l">負</em>:p.saves?<em className="is-s">S</em>:''}</td><td className="wt-nm">{nameOf(p.playerId)}</td><td>{formatIP(p.outs)}</td><td>{l.pitchCount[`${side}|${p.playerId}`]??'-'}</td><td>{p.hits}</td><td>{p.er}</td><td>{p.so}</td><td>{p.bb+p.hbp}</td><td>{eraText(pitOf(team,p.playerId))}</td></tr>)}</tbody></table></div>
  <h4 className="wt-band">試合のハイライト</h4>
  <ul className="wt-hl">{highlights.length?highlights.slice(0,8).map((h,i)=><li key={i}><em>{h.inning}回{h.side===0?'表':'裏'}</em><span>{h.text}</span></li>):<li><span>まだ点が入っていません</span></li>}</ul>
  <p className="wt-note">今季打率・今季防御率は、試合前までの今季の成績にこの試合のここまでを足した数です(試合の後にシーズンに入る数と同じ)。球数は演出の数です(試合の計算は1打席ずつで、球数は使っていません)。守備位置の「外」は外野。</p>
 </Sheet>;
}
