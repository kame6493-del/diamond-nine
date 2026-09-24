import {Flag,Globe2,Trophy} from 'lucide-react';
import type {GameState,Season} from './engine';
import {achievementNames,recordAchievements,type AchievementId} from './achievements';
import './achievements.css';
import {spaceUnlocked} from './leagues';

export function AchievementsPanel({state,season,expanded=false}:{state:GameState;season:Season;expanded?:boolean}){
 const records=recordAchievements(state).achievements??{},ids=(Object.keys(achievementNames) as AchievementId[]).filter(id=>!id.startsWith('space')||spaceUnlocked(state));
 const recent=ids.filter(id=>records[id]===season.number).at(-1);
 return <>
  {recent&&<section className="achievement-banner" role="status"><Trophy size={30}/><div><span>ACHIEVEMENT</span><h2>{achievementNames[recent]}を達成！</h2><p>あなたのチームは、{records[recent]}年目に{achievementNames[recent]}を達成しました。</p></div><b>{records[recent]}<small>年目</small></b></section>}
  <details className="s-fold achievement-records" open={expanded||undefined}><summary>達成記録 <span>{Object.keys(records).length} / {ids.length}</span></summary><div className="achievement-grid">{ids.map(id=>{const year=records[id];return <div className={year?'achieved':''} key={id}>{id==='mlbEntry'?<Globe2 size={22}/>:id==='worldChampion'?<Trophy size={22}/>:<Flag size={22}/>}<div><strong>{achievementNames[id]}</strong><p>{year?`${year}年目に達成`:'未記録'}</p></div>{year&&<b>✓</b>}</div>;})}</div></details>
 </>;
}
