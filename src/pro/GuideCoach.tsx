// 指さしの案内(2026-11-05 持ち主「チュートリアルとかも、どこをどこ押せばいいとか、ある程度分かりやすくして」)。
// 押す所を光る枠と指で示し、短い1文の吹き出しを出す。示した所を押すと次へ進む(タップで閉じる窓にはしない)。「飛ばす」は小さく常に出す。
// pass=true: 押した所のボタンもそのまま働く(タブ・1年進める・監督して戦う・次へ)。false: 説明だけ(押しても作戦の窓などは開かない)。
// 見た目は ChatGPT の案(gpt_ui_1105/d9gpt1105_tutorial_*.png)。指の絵も ChatGPT イメージ(assets/pro/guide/finger.webp)。
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import './guide-coach.css';

export interface GuideStep {id:string;text:string;target:string;pass:boolean}
type Box={x:number;y:number;w:number;h:number};
const visible=(el:Element)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0?r:null;};
export function findTarget(sel:string):HTMLElement|null{
 for(const el of Array.from(document.querySelectorAll<HTMLElement>(sel)))if(visible(el))return el;
 return null;
}

export function GuideCoach({step,no,total,onNext,onSkip,label='チュートリアル'}:{step:GuideStep;no:number;total:number;onNext:()=>void;onSkip:()=>void;label?:string}){
 const [box,setBox]=useState<Box|null>(null),next=useRef(onNext);next.current=onNext;
 // 11/6 持ち主「チュートリアルをスキップできる感じのモノを」: 「スキップ」は一言で確かめてから終える(アプリの中の小さな札。OS の窓は使わない)。
 const [ask,setAsk]=useState(false);
 // 示す所を画面に入れる(最初だけ)
 useEffect(()=>{const el=findTarget(step.target);if(el){const r=el.getBoundingClientRect();if(r.top<60||r.bottom>window.innerHeight-150)el.scrollIntoView({block:'center',behavior:'auto'});}},[step.id]);
 // 位置を追う(画面が動いても枠がずれないように)
 useLayoutEffect(()=>{
  let raf=0,alive=true;
  const tick=()=>{if(!alive)return;const el=findTarget(step.target),r=el?el.getBoundingClientRect():null;
   setBox(b=>{if(!r)return b?null:b;const n={x:r.left,y:r.top,w:r.width,h:r.height};return b&&Math.abs(b.x-n.x)<.5&&Math.abs(b.y-n.y)<.5&&Math.abs(b.w-n.w)<.5&&Math.abs(b.h-n.h)<.5?b:n;});
   raf=window.setTimeout(tick,120) as unknown as number;};
  tick();return()=>{alive=false;clearTimeout(raf);};
 },[step.target]);
 // 示した所を押したら次へ。説明だけの段は、押してもその下のボタンは働かせない。
 useEffect(()=>{
  const onClick=(e:MouseEvent)=>{const el=findTarget(step.target);if(!el||!(e.target instanceof Node)||!el.contains(e.target))return;
   if(!step.pass){e.preventDefault();e.stopPropagation();}
   next.current();};
  document.addEventListener('click',onClick,true);return()=>document.removeEventListener('click',onClick,true);
 },[step.id,step.target,step.pass]);
 const vw=typeof window!=='undefined'?window.innerWidth:400,vh=typeof window!=='undefined'?window.innerHeight:800;
 const pad=5,ring=box&&{left:box.x-pad,top:box.y-pad,width:box.w+pad*2,height:box.h+pad*2};
 // 指は枠の右下から、指先が枠の真ん中の少し下に来るように
 const fw=64,finger=box&&{left:Math.min(vw-fw,Math.max(0,box.x+box.w*.62-fw*.37)),top:Math.min(vh-fw,box.y+box.h*.55-fw*.38)};
 // 吹き出しは枠の下(下に余裕が無ければ上)
 const below=!box||box.y+box.h+150<vh,bubble=box?(below?{top:Math.min(vh-120,box.y+box.h+pad+fw*.7)}:{top:Math.max(8,box.y-pad-104)}):{top:vh*.38};
 return <div className="gc-layer" aria-live="polite">
  {ring&&<div className="gc-ring" style={ring} aria-hidden="true"/>}
  {finger&&<img className="gc-finger" src="/assets/pro/guide/finger.webp" alt="" width={fw} height={fw} style={finger}/>}
  <div className="gc-bubble" style={bubble} role="status"><span className="gc-step">{label} {no}/{total}</span><p>{step.text}</p></div>
  {ask?<div className="gc-ask" role="alertdialog" aria-label="チュートリアルを終える"><p>チュートリアルを終えますか?<small>設定からもう一度見られます</small></p><div><button type="button" className="gc-ask-no" onClick={()=>setAsk(false)}>続ける</button><button type="button" className="gc-ask-yes" onClick={onSkip}>終える</button></div></div>
  :<button type="button" className="gc-skip" onClick={()=>setAsk(true)}>スキップ ≫</button>}
 </div>;
}

/** 監督の試合をはじめてする時だけの案内(作戦・速さ・交代・飛ばす → 結果を見て「次へ」)。最後の段は試合が終わって「次へ」が出てから。 */
export function MatchGuide({steps,onDone,onIndex}:{steps:GuideStep[];onDone:()=>void;onIndex?:(i:number)=>void}){
 const [i,setI]=useState(0),[ready,setReady]=useState(true);
 useEffect(()=>{onIndex?.(i);},[i]);// eslint-disable-line react-hooks/exhaustive-deps
 const step=steps[i];
 // 最後の「次へ」は、ボタンが出るまで待つ(試合の途中は何も出さない)。
 useEffect(()=>{if(!step)return;if(i<steps.length-1){setReady(true);return;}
  setReady(!!findTarget(step.target));const t=window.setInterval(()=>setReady(!!findTarget(step.target)),300);return()=>clearInterval(t);},[i,step,steps.length]);
 if(!step||!ready)return null;
 return <GuideCoach step={step} no={i+1} total={steps.length} label="監督の操作" onNext={()=>{if(i+1>=steps.length)onDone();else setI(i+1);}} onSkip={onDone}/>;
}
