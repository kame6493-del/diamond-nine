import {useEffect,useRef,useState} from 'react';
import {ChevronRight} from 'lucide-react';
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
 return <section className="nv-starter" aria-label="スタートスカウト">
  <header className="nv-starter-head"><h1>スタートスカウト</h1><span>{player?'2':'1'}/3</span></header>
  {!player?<>
   <p className="nv-starter-lead">最初の1枚を選んで、チームの歴史をはじめよう。<br/>あなたのチームの核となる特別な選手カードです。</p>
   <div className="nv-backs">{offer.choices.map((id,index)=><button key={id} className={'nv-back-card nv-back-'+index+(chosen===index?' is-chosen':'')} aria-label={`${index+1}枚目のカードを選ぶ`} aria-pressed={chosen===index} onClick={()=>setChosen(index)} disabled={opening||!validName}><img src="/assets/pro/pawa/card-back.webp" alt=""/></button>)}</div>
   <p className="nv-pick-hint">{chosen===null?'カードを1枚選んでください':`${chosen+1}枚目を選択中`}</p>
   <div className="nv-panel nv-promise"><img src="/assets/pro/pawa/card-back.webp" alt=""/><p>選ばれたカードは<br/><b>OVR <strong>{STARTER_MIN_OVERALL}</strong> 以上</b><br/>の選手が確定！</p></div>
   <ul className="nv-fine"><li>※3枚の中から1枚を選ぶと、選手が確定して獲得できます</li><li>※ポイントは使いません。選べるのは1枚です</li></ul>
   <button className="nv-gold nv-wide" disabled={chosen===null||opening||!validName} onClick={()=>chosen!==null&&choose(chosen)}>このカードを選ぶ<ChevronRight size={18}/></button>
   <a className="nv-link" href="/guide.html" target="_blank" rel="noopener noreferrer">はじめての方へ · 遊び方ガイド ↗</a>
  </>:opening?<PawaScoutCharge tier={tier} title="カードをオープン！" onSkip={()=>finish.current?.()}/>:<div className={'nv-panel nv-result nv-tier-'+tier}>
   <PawaArrival tier={tier} overall={overall} major={false} title="最初の主力が加入！"/>
   <div className="nv-result-solo"><PawaCard player={player} state={state} size="l" onClick={()=>onPlayer(player)}/></div>
   <label className="nv-field">チーム名<input value={teamName} maxLength={20} placeholder="チーム名を入力" autoComplete="off" enterKeyHint="done" aria-describedby="nv-name-help" onChange={e=>setTeamName(e.target.value)}/><small id="nv-name-help">20文字まで。あとから設定でも変更できます。</small></label>
   <button className="nv-gold nv-wide starter-begin" disabled={!validName} onClick={()=>onFinish(teamName.trim())}>チームに入れて開幕する<ChevronRight size={18}/></button>
   <p className="nv-note">適性に合った位置へ自動で編成します。</p>
  </div>}
 </section>;
}
