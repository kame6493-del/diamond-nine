// 試合のプレーの演出の絵(2026-11-05)。見た目の元: ChatGPT イメージの見本帳(gpt_ui_1105/d9gpt1105_effects_1〜5)。
// 斜めの金の太い文字(濃い縁取り+赤の影)・後ろの光の筋(回る)・1回だけ広がる光・火花・紙吹雪・虹の弧(大きい物だけ)。
// グラウンドの枠の中(親の .fc-wrap)だけに出し、押せない(pointer-events:none)。強い点滅はしない(光は1回広がって消える)。
import type {CSSProperties} from 'react';
import type {Fx,FxLevel} from './play-fx';
import './play-fx.css';

export function PlayFx({fx,level,n}:{fx:Fx;level:FxLevel;n:number}){
 const flashy=level==='flashy',big=fx.tier==='big',mid=fx.tier==='mid';
 const sparks=flashy?(big?18:mid?14:10):level==='normal'?(big?10:6):0;
 const confetti=flashy&&(big||mid)?(big?36:20):level==='normal'&&big?14:0;
 const style={'--d':`${fx.ms}ms`} as CSSProperties;
 return <div key={n} className={`pfx is-${fx.tier} k-${fx.kind.toLowerCase()} lv-${level}`} style={style} aria-hidden="true">
  {level!=='calm'&&<div className="pfx-glow"/>}
  {level!=='calm'&&<div className="pfx-rays"/>}
  {big&&level!=='calm'&&<div className="pfx-rainbow"/>}
  {Array.from({length:sparks},(_,i)=>{const a=i/sparks*360+(i%2?9:0),r=(fx.tier==='small'?34:46)+(i%3)*9;return <i key={'s'+i} className="pfx-spark" style={{'--a':`${a}deg`,'--r':`${r}%`,animationDelay:`${(i%4)*35}ms`} as CSSProperties}/>;})}
  {Array.from({length:confetti},(_,i)=><i key={'c'+i} className="pfx-cf" style={{left:`${(i*41+7)%100}%`,animationDelay:`${(i%9)*60}ms`,background:['#ffd23f','#ff4d6d','#4dabff','#5ee07a','#ffffff','#c084fc'][i%6],'--x':`${((i*53)%40)-20}px`} as CSSProperties}/>)}
  <div className="pfx-title"><b data-t={fx.title} style={{'--n':Array.from(fx.title).length} as CSSProperties}>{fx.title}</b>{fx.sub&&<em>{fx.sub}</em>}</div>
 </div>;
}
