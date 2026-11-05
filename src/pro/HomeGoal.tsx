// ホームの一番上の大きな目標(2026-11-05 持ち主「目標は大きく書いて。目的が分かるように。例えば国内リーグなら3年連続優勝とか。もっとわかりやすく」)。
// 今の目標を1つ大きく、進み具合を棒と数字で。押すと目標の一覧(いまの段階・次・その先)。
// 達成した時は、短い派手な帯が出て自然に消える(タップ待ちにしない)。目標は次の段階へ自動で替わる。
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,Flag,Lock,Trophy} from 'lucide-react';
import type {GameState} from './engine';
import {goalHeadline,goalLadder,type GoalHeadline} from './league-goal';
import './home-goal.css';

export function HomeGoal({state}:{state:GameState}){
 const g=goalHeadline(state),[open,setOpen]=useState(false);
 const ladder=goalLadder(state);
 const pct=Math.round(Math.min(1,g.value/Math.max(1,g.goal))*100);
 return <section className={'hg-card hg-'+g.stage+(g.done?' is-done':'')} aria-label="いまの目標">
  <button type="button" className="hg-main" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
   <span className="hg-cup" aria-hidden="true"><Trophy size={30}/></span>
   <span className="hg-kicker"><Flag size={14} aria-hidden="true"/>{g.done?'達成':'目標'}</span>
   <strong className="hg-title">{g.title}</strong>
   <span className="hg-meter"><b>{g.meterLabel} {g.value}/{g.goal}</b><span className="hg-bar" role="progressbar" aria-label={g.meterLabel} aria-valuenow={g.value} aria-valuemin={0} aria-valuemax={g.goal}><i style={{width:pct+'%'}}/></span>{g.left!==null&&<em>あと{g.left}{g.unit}</em>}</span>
   <span className="hg-sub">{g.sub}</span>
   <span className="hg-more">{open?'閉じる':'目標の一覧'}<ChevronDown size={14} aria-hidden="true"/></span>
  </button>
  {open&&<ol className="hg-ladder" aria-label="目標の一覧">{ladder.map((x,i)=><li key={x.stage} className={'is-'+x.status}>
   <i aria-hidden="true">{x.status==='done'?<Check size={14}/>:x.status==='now'?i+1:<Lock size={12}/>}</i>
   <span><b>{x.title}</b><small>{x.status==='done'?'達成済み':x.status==='now'?'いまの目標':'その先'} · {x.reward}</small></span>
  </li>)}</ol>}
 </section>;
}

/** 目標を達成した瞬間の帯(約2.4秒で消える。押さなくてよい)。 */
export function GoalFlash({done,next}:{done:string;next:GoalHeadline|null}){
 const band=<div className="hg-flash" role="status" aria-live="polite">
  <div className="hg-flash-band"><Trophy size={30} aria-hidden="true"/><div><em>目標達成!</em><b>{done}</b>{next&&!next.done&&<small>次の目標: {next.title}</small>}</div></div>
 </div>;
 // 画面の一番上に(親の要素の重なりや切り取りに左右されないように body へ)
 return typeof document==='undefined'?band:createPortal(band,document.body);
}

/** 目標が次の段階へ替わったかを見張る。替わった時だけ {done,next} を約2.4秒返す(読み込み直後・別のクラブへの切り替えでは出さない)。 */
export function useGoalFlash(state:GameState,profile:string){
 const g=goalHeadline(state),prev=useRef<{profile:string;stage:string;title:string}|null>(null);
 const [flash,setFlash]=useState<{done:string;next:GoalHeadline}|null>(null);
 useEffect(()=>{
  const order=['npb','mlb','space','done'],p=prev.current;
  if(p&&p.profile===profile&&order.indexOf(g.stage)>order.indexOf(p.stage))setFlash({done:p.title,next:g});
  prev.current={profile,stage:g.stage,title:g.title};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[g.stage,profile]);
 useEffect(()=>{if(!flash)return;const t=setTimeout(()=>setFlash(null),2400);return()=>clearTimeout(t);},[flash]);
 return flash;
}
