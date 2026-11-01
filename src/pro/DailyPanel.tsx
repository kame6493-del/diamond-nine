import {CalendarCheck,Check,Gift} from 'lucide-react';
import {DAILY_ALL_BONUS,DAILY_MISSIONS,takeDailyMission,useDaily} from './daily';
import {track} from './analytics';
import './daily.css';

// Today's three goals. Finishing one lights its button; tapping it adds the points.
export function DailyPanel({disabled,onReward}:{disabled?:boolean;onReward:(points:number,note:string)=>void}){
 const record=useDaily(),left=DAILY_MISSIONS.filter(m=>!record.done.includes(m.id)).length;
 const claim=(id:typeof DAILY_MISSIONS[number]['id'],label:string)=>{
  const points=takeDailyMission(id);if(!points)return;
  track('daily_mission',{mission:id,points});
  onReward(points,`今日の目標「${label}」達成 ＋${points.toLocaleString('ja-JP')} pt`);
 };
 return <section className={'daily-panel'+(record.all?' is-complete':'')} aria-label="今日の目標">
  <header><CalendarCheck size={18}/><h2>今日の目標</h2><span>{record.all?'全部達成！':left?`あと${left}つ · 全部達成で さらに＋${DAILY_ALL_BONUS}pt`:`受け取ると さらに＋${DAILY_ALL_BONUS}pt`}</span></header>
  <ul>{DAILY_MISSIONS.map(m=>{const done=record.done.includes(m.id),got=record.claimed.includes(m.id);
   return <li key={m.id} className={got?'got':done?'ready':''}>
    <span className="daily-check" aria-hidden="true">{got||done?<Check size={14}/>:null}</span>
    <span className="daily-label">{m.label}</span>
    {got?<em>受け取り済み</em>:done?<button type="button" className="daily-claim" disabled={disabled} onClick={()=>claim(m.id,m.label)}><Gift size={14}/>＋{m.points}pt</button>:<b>＋{m.points}pt</b>}
   </li>;})}</ul>
 </section>;
}
