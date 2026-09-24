import {useEffect,useRef,useState} from 'react';
import {ArrowRight,BookOpen,Check,Play,Shuffle} from 'lucide-react';
import type {GameState} from './engine';
import type {Profile} from './progression';
import {starterScoutActive} from './starter-scout';
import {SIMPLE_SCOUT_COST} from './simple-game';
import {awakeningCosts} from './development';
import './beginner-tutorial.css';

type Phase='starter'|'team'|'season'|'finish';
type Progress={phase:Phase;season:number;day:number};
type Page='season'|'team'|'scout'|'catalog';
const keyFor=(profile:Profile)=>`diamond-nine-tutorial-v1-${profile}`;
const progressFor=(phase:Phase,state:GameState):Progress=>({phase,season:state.season.number,day:state.season.day});

// Tutorial progress is separate from the club save. Existing clubs are not
// interrupted, and replaying the guide never resets or awards game resources.
function readProgress(profile:Profile,state:GameState):Progress|null{
 try{
  const raw=localStorage.getItem(keyFor(profile));
  if(raw==='done')return null;
  if(raw){
   const value=JSON.parse(raw) as Progress;
   if(['starter','team','season','finish'].includes(value?.phase)&&Number.isInteger(value.season)&&value.season>0&&Number.isInteger(value.day)&&value.day>=0){
    return starterScoutActive(state)?progressFor('starter',state):value;
   }
  }
 }catch{/* Keep the game usable when browser storage is unavailable. */}
 return starterScoutActive(state)?progressFor('starter',state):null;
}

export function BeginnerTutorial({state,profile,page,replay,busy,onPage,onAuto,onPlay}:{state:GameState;profile:Profile;page:Page;replay:number;busy:boolean;onPage:(page:Page)=>void;onAuto:()=>void;onPlay:()=>void}){
 const [progress,setProgress]=useState<Progress|null>(()=>readProgress(profile,state));
 const replaySeen=useRef(replay),panel=useRef<HTMLElement>(null),previousPhase=useRef(progress?.phase);
 const starter=starterScoutActive(state);
 useEffect(()=>{
  try{localStorage.setItem(keyFor(profile),progress?JSON.stringify(progress):'done');}catch{}
 },[profile,progress]);
 useEffect(()=>{
  if(replay===replaySeen.current)return;
  replaySeen.current=replay;
  setProgress(progressFor(starter?'starter':'team',state));
  if(!starter)onPage('team');
 },[replay,starter,state,onPage]);
 useEffect(()=>{
  if(!progress)return;
  if(progress.phase==='starter'&&!starter){setProgress(progressFor('team',state));onPage('team');}
  // Finishing a real match, through either tutorial or normal controls, moves
  // the lesson on. Merely opening the guide must never simulate a match.
  else if(progress.phase==='season'&&!busy&&(state.season.number!==progress.season||state.season.day>progress.day))setProgress(progressFor('finish',state));
 },[progress,starter,state,busy,onPage]);
 useEffect(()=>{
  if(progress?.phase&&previousPhase.current!==progress.phase)panel.current?.scrollIntoView({block:'start',behavior:'auto'});
  previousPhase.current=progress?.phase;
 },[progress?.phase]);
 if(!progress)return null;
 const step=progress.phase==='starter'?1:progress.phase==='team'?2:3;
 const finish=()=>setProgress(null);
 const teamNext=()=>{setProgress(progressFor('season',state));onPage('season');};
 const finished=progress.phase==='finish';
 const title=progress.phase==='starter'?'最初の1枚を選ぼう':progress.phase==='team'?'チームを整えよう':progress.phase==='season'?'まずは1試合、進めてみよう':'準備OK。ここからは、あなたの采配で。';
 return <section ref={panel} className={'beginner-tutorial'+(finished?' tutorial-finished':'')} aria-label="はじめてのチュートリアル">
  <div className="tutorial-top"><span><BookOpen size={14}/>{finished?'チュートリアル完了':`はじめてガイド ${step} / 3`}</span>{!finished&&<button type="button" onClick={finish}>スキップ</button>}</div>
  {!finished&&<div className="tutorial-progress" aria-label={`ステップ${step}、全3ステップ`}>{['カード','編成','試合'].map((label,i)=><span key={label} className={i+1<=step?'reached':''}>{i+1<step?<Check size={11}/>:<b>{i+1}</b>}{label}</span>)}</div>}
  <h2 aria-live="polite">{title}</h2>
  {progress.phase==='starter'&&<p>下の3枚から、好きなカードを1枚タップ。<br/>選手が出たら「チームに入れて開幕する」を押そう。</p>}
  {progress.phase==='team'&&<><p>迷ったら「おまかせ編成」でOK。打順と守備位置を整えます。<br/>選手名をタップすると、能力や特殊能力も見られます。</p><div className="tutorial-actions">{page!=='team'?<button className="s-primary" type="button" disabled={busy} onClick={()=>onPage('team')}>チームを開く<ArrowRight size={15}/></button>:<><button className="s-primary" type="button" disabled={busy} onClick={()=>{onAuto();teamNext();}}><Shuffle size={15}/>おまかせ編成して次へ</button><button className="tutorial-text" type="button" disabled={busy} onClick={teamNext}>今の編成で次へ</button></>}</div></>}
  {progress.phase==='season'&&<><p>試合は自動で進みます。終了後は、この画面で選手の成績を確認。<br/>負けた試合でもポイントが貯まります。</p><div className="tutorial-actions">{page!=='season'?<button className="s-primary" type="button" disabled={busy} onClick={()=>onPage('season')}>試合・成績を開く<ArrowRight size={15}/></button>:state.season.completed?<button className="s-primary" type="button" onClick={()=>setProgress(progressFor('finish',state))}>成績を確認した<Check size={15}/></button>:<button className="s-primary" type="button" disabled={busy} onClick={onPlay}><Play size={15}/>{busy?'試合を進めています…':'1試合進めてみる'}</button>}</div></>}
  {finished&&<><p>試合を重ねてポイントを貯めたら、補強か育成へ。<br/>「シーズン終了まで」で、1年をまとめて楽しめます。</p><div className="tutorial-next"><div><b>選手を集める</b><span>スカウトで1人 {SIMPLE_SCOUT_COST.toLocaleString('ja-JP')} pt</span></div><div><b>選手を育てる</b><span>選手名→覚醒。第1段階は{awakeningCosts[0].toLocaleString('ja-JP')} pt</span></div></div><div className="tutorial-actions"><button type="button" className="s-primary" onClick={finish}>チュートリアルを終える<Check size={15}/></button><a href="/guide.html" target="_blank" rel="noopener noreferrer">詳しい遊び方 ↗</a></div></>}
  {!finished&&<small className="tutorial-replay-note">あとで設定から見直せます。</small>}
 </section>;
}
