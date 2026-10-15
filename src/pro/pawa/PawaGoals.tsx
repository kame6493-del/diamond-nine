import {ChevronRight} from 'lucide-react';
import type {GameState} from '../engine';
import {leagueGoal,type LeagueGoal} from '../league-goal';
import {seasonGoals} from '../ambitions';
import {DAILY_MISSIONS,useDaily} from '../daily';
import {achievementNames,recordAchievements,type AchievementId} from '../achievements';
import {spaceUnlocked} from '../leagues';

/** 上のリーグへの挑戦の目標。big=目標・達成記録の一番上と右の列、そうでなければ試合の画面の1行。 */
export function LeagueGoalCard({goal,big=false,onOpen}:{goal:LeagueGoal;big?:boolean;onOpen?:()=>void}){
 const pips=Array.from({length:goal.goal},(_,i)=><i key={i} className={i<goal.value?'is-on':''} aria-hidden="true">★</i>);
 if(!big)return <button className={'pw-lg-line pw-lg-'+goal.stage} onClick={onOpen} aria-label={`挑戦の目標: ${goal.title}。${goal.condition}。${goal.value}/${goal.goal}`}>
  <span className="pw-lg-tag">挑戦</span><b>{goal.condition}</b><span className="pw-lg-pips">{pips}</span><em>{goal.value}/{goal.goal}</em><span className="pw-lg-to">→ {goal.title.replace('に挑戦','')}</span>
 </button>;
 return <section className={'pw-lg-card pw-lg-'+goal.stage} aria-label="挑戦の目標">
  <p className="pw-lg-kicker">挑戦の目標</p>
  <h3>{goal.title}</h3>
  <p className="pw-lg-cond">{goal.condition}</p>
  <div className="pw-lg-meter"><span className="pw-lg-pips">{pips}</span><b>{goal.value}<small>/{goal.goal}</small></b></div>
  <p className="pw-lg-note">{goal.note}</p>
 </section>;
}

/** 右の列: 挑戦の目標・今日の目標・シーズンの目標・達成記録。押すと目標・達成記録の画面へ。 */
export function PawaGoalsAside({state,onOpen}:{state:GameState;onOpen:()=>void}){
 const goal=leagueGoal(state),daily=useDaily(),goals=seasonGoals(state);
 const open=goals.filter(g=>!g.claimed),next=open.slice(0,4),records=recordAchievements(state).achievements??{};
 const ids=(Object.keys(achievementNames) as AchievementId[]).filter(id=>!id.startsWith('space')||spaceUnlocked(state));
 return <aside className="pw-aside" aria-label="目標と達成記録">
  <div className="pw-aside-btn" onClick={onOpen}>
   <LeagueGoalCard goal={goal} big/>
   <section className="pw-aside-sec"><h4>今日の目標<small>{daily.claimed.length}/{DAILY_MISSIONS.length} 受取</small></h4><ul>{DAILY_MISSIONS.map(m=>{const got=daily.claimed.includes(m.id),done=daily.done.includes(m.id);return <li key={m.id} className={got?'is-got':done?'is-ready':''}><i aria-hidden="true">{got||done?'✓':''}</i><span>{m.label}</span><em>{got?'受取済':done?'受け取れる':`＋${m.points}pt`}</em></li>;})}</ul></section>
   <section className="pw-aside-sec"><h4>シーズンの目標<small>{goals.length-open.length}/{goals.length} 達成</small></h4><ul>{next.map(g=><li key={g.id}><i aria-hidden="true"/><span>{g.detail}</span><em>{Math.min(g.value,g.goal)}/{g.goal}</em></li>)}{!next.length&&<li className="is-got"><i aria-hidden="true">✓</i><span>今シーズンの目標はすべて達成</span></li>}</ul></section>
   <section className="pw-aside-sec"><h4>達成記録<small>{Object.keys(records).length}/{ids.length}</small></h4><ul className="pw-aside-rec">{ids.map(id=><li key={id} className={records[id]!==undefined?'is-got':''}><span>{achievementNames[id]}</span><em>{records[id]!==undefined?`${records[id]}年目`:'未達成'}</em></li>)}</ul></section>
   <button className="pw-aside-more" onClick={e=>{e.stopPropagation();onOpen();}}>目標・達成記録をひらく<ChevronRight size={16}/></button>
  </div>
 </aside>;
}
