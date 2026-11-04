// 能力の段に、いつも項目名と短い棒を付けて出す部品(11/5 朝 持ち主「ミート・パワー・走力とか、どのアルファベットがどれを示してるか分からない」)。
// 「ミート C ▬▬▬」の形。段の色は試合の画面と同じ(S 金・A 赤・B 橙・C 黄橙・D 黄緑・E 緑・F 青・G 灰)。スタメン・控え・先発投手で使う。
import {gradeColor,playerMap} from './data';
import {isSpaceAlien} from './mlb-opponents';
import {alienVelocity} from './space-aliens';
import {gradeOf} from './watch';
import './ability-tag.css';

export const GRADE_GUIDE='段は S が最高、G が最低(S・A・B・C・D・E・F・G)';
const pct=(v:number)=>Math.max(6,Math.min(100,v));
export function AbilityTag({label,v}:{label:string;v:number}){
 const g=gradeOf(v),c=gradeColor(Math.min(99,v));
 return <span className="ab-tag" aria-label={`${label} ${g}`}><small>{label}</small><b style={{color:c}}>{g}</b><i aria-hidden="true"><u style={{width:`${pct(v)}%`,background:c}}/></i></span>;
}
/** 球速は段でなく km/h の数で出す(棒は 120〜165km を0〜99 に)。 */
export function VelocityTag({kmh,id}:{kmh:number;id:string}){
 const v=Math.round(kmh),shown=playerMap[id]&&isSpaceAlien(playerMap[id])?alienVelocity(v):v,score=Math.max(0,Math.min(99,(kmh-120)/45*99)),c=gradeColor(score);
 return <span className="ab-tag is-kmh" aria-label={`球速 ${shown}km`}><small>球速</small><b style={{color:c}}>{shown}<em>km</em></b><i aria-hidden="true"><u style={{width:`${pct(score)}%`,background:c}}/></i></span>;
}
