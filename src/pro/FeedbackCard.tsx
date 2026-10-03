import {useState} from 'react';
import {MessageSquare,X} from 'lucide-react';
import {feedbackUrl} from './feedback';
import {track} from './analytics';

// Asks testers for a minute of feedback once they have finished a season. The app
// build only; dismissed for good with the close button or after it is opened.
const KEY='diamond-nine-feedback-card';
const read=()=>{try{return localStorage.getItem(KEY);}catch{return '1';}};
export function FeedbackCard({seasons}:{seasons:number}){
 const [hidden,setHidden]=useState(()=>read()==='1');
 const app=typeof window!=='undefined'&&!!window.diamondNativeFiles;
 if(hidden||!app||seasons<1)return null;
 const close=()=>{try{localStorage.setItem(KEY,'1');}catch{/* shows again next launch */}setHidden(true);};
 return <aside className="feedback-card" aria-label="ご意見のお願い">
  <MessageSquare size={20} aria-hidden="true"/>
  <div><strong>テスト版を遊んでいただき、ありがとうございます</strong><p>分かりにくい所や不具合があれば、1分で送れるフォームで教えてください。次の更新で直します。</p>
   <a className="s-button" href={feedbackUrl()} target="_blank" rel="noopener noreferrer" onClick={()=>{track('feedback_open',{from:'card'});close();}}>ご意見を送る</a></div>
  <button type="button" onClick={close} aria-label="ご意見のお願いを閉じる"><X size={16}/></button>
 </aside>;
}
