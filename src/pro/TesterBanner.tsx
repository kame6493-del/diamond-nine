import {useState} from 'react';
import {Smartphone,X} from 'lucide-react';
import './tester-banner.css';

// Recruits Google Play closed testers from the web version only.
const KEY='diamond-nine-tester-banner-closed';
const GROUP='https://groups.google.com/g/diamond-nine-testers';
const OPT_IN='https://play.google.com/apps/testing/com.diamondninebaseball.game';
const isNativeApp=()=>Boolean((window as {Capacitor?:{isNativePlatform?:()=>boolean}}).Capacitor?.isNativePlatform?.());

export function TesterBanner(){
 const [closed,setClosed]=useState(()=>{try{return localStorage.getItem(KEY)==='1';}catch{return false;}});
 if(closed||isNativeApp())return null;
 const close=()=>{try{localStorage.setItem(KEY,'1');}catch{/* shows again next visit */}setClosed(true);};
 return <aside className="tester-banner" aria-label="Android版テスター募集">
  <Smartphone size={22} aria-hidden="true"/>
  <div>
   <strong>Android版のテスターを募集中!</strong>
   <p>アプリ版の公開には14日間のテストが必要です。Androidスマホをお持ちの方、ぜひ参加してください。</p>
   <div className="tester-banner-steps">
    <a href={GROUP} target="_blank" rel="noopener noreferrer">① グループに参加</a>
    <a href={OPT_IN} target="_blank" rel="noopener noreferrer">② テスターになる</a>
   </div>
  </div>
  <button type="button" onClick={close} aria-label="テスター募集を閉じる"><X size={18}/></button>
 </aside>;
}
