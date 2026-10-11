import {useEffect,useRef,useState} from 'react';
import {playerMap,type Player} from '../data';
import type {GameState} from '../engine';
import {scoutDuration,scoutPresentation} from '../scout-presentation';
import {gameSound,prepareGameAudio,stopGameAudio} from '../game-audio';
import {STARTER_MIN_OVERALL} from '../starter-scout';
import {PawaCard} from './PawaCard';
import {PawaArrival,PawaScoutCharge} from './PawaScout';

/** スタートスカウト(ref_01 右)。保存・演出の順番は StarterScout と同じ。 */
export function PawaStarter({state,sound,onPick,onFinish,onPlayer}:{state:GameState;sound:boolean;onPick:(index:number,name:string)=>boolean;onFinish:(name:string)=>void;onPlayer:(p:Player)=>void}){
 const [opening,setOpening]=useState(false),[chosen,setChosen]=useState<number|null>(null),locked=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),finish=useRef<(()=>void)|null>(null),soundRef=useRef(sound);
 const [teamName,setTeamName]=useState(state.name);
 useEffect(()=>setTeamName(state.name),[state.name]);
 soundRef.current=sound;
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);finish.current=null;stopGameAudio();},[]);
 const offer=state.starterScout;
 if(!offer||offer.completed)return null;
 const validName=teamName.trim().length>0;
 const player=offer.selected?playerMap[offer.selected]:null,{tier,overall}=scoutPresentation(player,state.owned,state.training);
 const choose=(index:number)=>{
  if(locked.current||offer.selected||!validName)return;
  locked.current=true;
  if(!onPick(index,teamName.trim())){locked.current=false;return;}
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
 return <section className="pw-starter" aria-label="スタートスカウト">
  <div className="pw-titlebar"><h1>スタートスカウト</h1><span className="pw-must">必ず <b>OVR{STARTER_MIN_OVERALL}</b> 以上の選手が登場！</span></div>
  {!player?<>
   <p className="pw-lead">好きな選手を1人選んで、チームに迎えよう。</p>
   <div className="pw-stage-field">
    <div className="pw-backs">{offer.choices.map((id,index)=><button key={id} className={'pw-back-card'+(chosen===index?' is-chosen':'')} aria-label={`${index+1}枚目のカードを選ぶ`} aria-pressed={chosen===index} onClick={()=>setChosen(index)} disabled={opening||!validName}><img src="/assets/pro/pawa/card-back.webp" alt=""/></button>)}</div>
    <p className="pw-pick-hint">{chosen===null?'カードをタップして、1人選んでください。':`${chosen+1}枚目を選んでいます`}</p>
   </div>
   <div className="pw-panel pw-about"><h2>スタートスカウトについて</h2><p>この中から好きな選手を1人選んで、チームに迎えることができます。</p><p>登場する選手は すべて <b>OVR{STARTER_MIN_OVERALL} 以上</b>！ キミのチームの核となる選手を選ぼう。ポイントは使いません。</p></div>
   <button className="pw-btn pw-yellow pw-wide pw-start" disabled={chosen===null||opening||!validName} onClick={()=>chosen!==null&&choose(chosen)}><span className="pw-ball" aria-hidden="true"/>このカードに決める</button>
   <a className="pw-link" href="/guide.html" target="_blank" rel="noopener noreferrer">はじめての方へ · 遊び方ガイド ↗</a>
  </>:opening?<PawaScoutCharge tier={tier} title="カードをオープン！" onSkip={()=>finish.current?.()}/>:<div className={'pw-panel pw-result pw-tier-'+tier}>
   <PawaArrival tier={tier} overall={overall} major={false} title="最初の主力が加入！"/>
   <div className="pw-result-solo"><PawaCard player={player} state={state} size="l" onClick={()=>onPlayer(player)}/></div>
   <div className="pw-namebox"><label htmlFor="pw-team-name">チーム名</label><input id="pw-team-name" value={teamName} maxLength={20} placeholder="チーム名を入力" autoComplete="off" enterKeyHint="done" aria-describedby="pw-name-help" onChange={e=>setTeamName(e.target.value)}/></div>
   <small id="pw-name-help" className="pw-note">※あと{Math.max(0,20-teamName.length)}文字まで入力できます。あとから設定でも変更できます。</small>
   <button className="pw-btn pw-yellow pw-wide starter-begin" disabled={!validName} onClick={()=>onFinish(teamName.trim())}><span className="pw-ball" aria-hidden="true"/>チームに入れて開幕する</button>
   <p className="pw-note">適性に合った位置へ自動で編成します。</p>
  </div>}
 </section>;
}
