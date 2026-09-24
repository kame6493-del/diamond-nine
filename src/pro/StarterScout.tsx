import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowRight,Crown,Gift,Sparkles} from 'lucide-react';
import {playerMap,type Player} from './data';
import type {GameState} from './engine';
import {TradingCard} from './CardDeck';
import {ScoutCharge,ScoutArrival,scoutDuration} from './ScoutEffects';
import {scoutPresentation} from './scout-presentation';
import {gameSound,prepareGameAudio,stopGameAudio} from './game-audio';
import {STARTER_MIN_OVERALL} from './starter-scout';
import './starter-scout.css';

export function StarterScout({state,sound,onPick,onFinish,onPlayer}:{state:GameState;sound:boolean;onPick:(index:number)=>boolean;onFinish:()=>void;onPlayer:(p:Player)=>void}){
 const [opening,setOpening]=useState(false),locked=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),finish=useRef<(()=>void)|null>(null),soundRef=useRef(sound);
 soundRef.current=sound;
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);finish.current=null;stopGameAudio();},[]);
 const offer=state.starterScout;
 if(!offer||offer.completed)return null;
 const player=offer.selected?playerMap[offer.selected]:null,{tier,overall}=scoutPresentation(player,state.owned,state.training);
 const choose=(index:number)=>{
  if(locked.current||offer.selected)return;
  locked.current=true;
  if(!onPick(index)){locked.current=false;return;}
  setOpening(true);
  const id=offer.choices[index],presentation=scoutPresentation(playerMap[id],{...state.owned,[id]:(state.owned[id]??0)+1},state.training);
  stopGameAudio();if(soundRef.current){void prepareGameAudio();gameSound('draw');gameSound('impact',.65);}
  finish.current=()=>{
   if(!finish.current)return;finish.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;
   stopGameAudio();if(soundRef.current){gameSound(presentation.tier==='rainbow'?'rainbow':'gold');if(presentation.tier==='rainbow')gameSound('voice',.5);}
   setOpening(false);
  };
  timer.current=setTimeout(()=>finish.current?.(),scoutDuration(presentation.tier));
 };
 return <section className="starter-event" aria-label="スタートスカウト">
  <div className="starter-event-label"><Gift size={16}/>初回限定 · スタートスカウト</div><a className="starter-help" href="/guide.html" target="_blank" rel="noopener noreferrer">はじめての方へ · 遊び方ガイド ↗</a>
  {!player?<>
   <h1>3枚から、1枚選ぼう。</h1><p className="starter-intro">最初の主力選手をプレゼント！<br/>好きなカードをタップして獲得。</p>
   <div className="starter-guarantee"><Crown size={17}/><span>全カード <b>総合 {STARTER_MIN_OVERALL} 以上</b></span></div>
   <div className="starter-choice-grid">{offer.choices.map((id,index)=><button key={id} className="starter-choice animate__animated animate__fadeInUp" style={{'--animate-delay':`${index*.12}s`,animationDelay:`${index*.12}s`} as CSSProperties} aria-label={`${index+1}枚目のカードを選ぶ`} onClick={()=>choose(index)} disabled={opening}>
    <span className="starter-card-back"><span className="starter-card-crown"><Crown/></span><b>9</b><span className="starter-card-brand">DIAMOND<br/>NINE</span><span className="starter-card-stars" aria-hidden="true">✦ ✦ ✦</span></span>
    <span className="starter-choice-number">0{index+1}<ArrowRight size={15}/></span>
   </button>)}</div>
   <div className="starter-event-note"><Sparkles size={16}/><p>ポイント消費なし · 選べるのは1枚<br/><small>初期チームに、選んだ選手が加わります。</small></p></div>
  </>:<div className={'starter-reward s-scout-panel scout-tier-'+tier}>
   {opening?<><h1>カードをオープン！</h1><ScoutCharge tier={tier} onSkip={()=>finish.current?.()}/></>:<div className="s-scout-main">
    <div className="s-scout-result"><ScoutArrival tier={tier} overall={overall} major={false}/><p className="starter-joined">最初の主力が加入！</p><div className={'scout-reveal animate__animated '+(tier==='rainbow'?'animate__zoomInDown':'animate__bounceIn')}><TradingCard player={player} state={state} onPlayer={onPlayer}/></div></div>
    <button className="s-primary starter-begin" onClick={onFinish}>チームに入れて開幕する<ArrowRight size={18}/></button><p className="starter-continue-note">適性に合った位置へ自動で編成します。</p>
   </div>}
  </div>}
 </section>;
}
