// 指さしの案内の順番と保存(2026-11-05)。画面は GuideCoach.tsx。セーブデータとは別に端末へ覚える(クラブのデータは変えない)。
import type {GuideStep} from './GuideCoach';

/** はじめての流れ: スカウトで選手を引く → チーム・オーダーを確かめる → 「1年進める」 → 大事な試合で「監督して戦う」。 */
export const MAIN_GUIDE:GuideStep[]=[
 {id:'starter',text:'まずはスカウト。好きなカードを1枚選んで、最初の選手を仲間にしよう',target:'.pw-starter .pw-sc-card, .starter-scout button',pass:true},
 {id:'team-tab',text:'「チーム」で打順と守備を確かめよう',target:'[data-guide="tab-team"]',pass:true},
 {id:'order',text:'迷ったら「おまかせ編成」。打順と守備をまとめて整えます',target:'[data-guide="auto-order"]',pass:true},
 {id:'season-tab',text:'「試合・成績」に戻ろう',target:'[data-guide="tab-season"]',pass:true},
 {id:'year',text:'「1年進める」でシーズンを進めよう。大事な試合の前で止まります',target:'[data-guide="year"]',pass:true},
 {id:'manage',text:'大事な試合は「監督して戦う」で、自分で采配できます',target:'.kg-card .kg-manage',pass:true},
];
/** 監督の試合をはじめてする時だけ: 作戦・速さ・交代・飛ばすボタン → 結果を見て「次へ」。 */
export const MATCH_GUIDE:GuideStep[]=[
 {id:'tactic',text:'作戦はここ。長打狙い・直球中心などを1タップで出せます',target:'.wt-root .wt-quick',pass:false},
 {id:'speed',text:'速さを変えられます(押すたびに 1→2→4→8→16倍)',target:'.wt-root .wt-speed-cycle',pass:false},
 {id:'sub',text:'代打・代走や守備・投手の交代はここ',target:'.wt-root [data-guide="sub"]',pass:false},
 {id:'skip',text:'次の打席・次のイニング・試合終了まで飛ばせます',target:'.wt-root [data-guide="inning"]',pass:false},
 {id:'next',text:'結果を見たら「次へ」。この試合の結果がシーズンに入ります',target:'.wt-root .wt-final .wt-gold',pass:true},
];
export const guideKey=(profile:string)=>`diamond-nine-guide-v2-${profile}`;
export const MATCH_GUIDE_KEY='diamond-nine-guide-match-v1';
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const store=(s?:Store):Store|null=>{try{return s??localStorage;}catch{return null;}};

/** 今の段(なければ null=済み)。前の版のチュートリアルを終えた人には出さない(遊んでいる途中を邪魔しない)。 */
export function readGuide(profile:string,starterActive:boolean,s?:Store):string|null{
 const st=store(s);let v:string|null=null;
 try{v=st?.getItem(guideKey(profile))??null;}catch{/* なし */}
 if(v==='done')return null;
 if(v&&MAIN_GUIDE.some(x=>x.id===v))return v==='starter'&&!starterActive?'team-tab':v;
 let old:string|null=null;try{old=st?.getItem(`diamond-nine-tutorial-v1-${profile}`)??null;}catch{/* なし */}
 if(old==='done'&&!starterActive)return null;
 return starterActive?'starter':'team-tab';
}
export function saveGuide(profile:string,step:string|null,s?:Store){try{store(s)?.setItem(guideKey(profile),step??'done');}catch{/* 覚えられなくても進む */}}
/** 次の段(最後なら null)。 */
export function nextGuide(step:string):string|null{const i=MAIN_GUIDE.findIndex(x=>x.id===step);return i>=0&&i<MAIN_GUIDE.length-1?MAIN_GUIDE[i+1].id:null;}
export const guideIndex=(step:string|null)=>step?MAIN_GUIDE.findIndex(x=>x.id===step):MAIN_GUIDE.length;
export function readMatchGuide(s?:Store):boolean{try{return store(s)?.getItem(MATCH_GUIDE_KEY)!=='done';}catch{return false;}}
export function saveMatchGuideDone(s?:Store){try{store(s)?.setItem(MATCH_GUIDE_KEY,'done');}catch{/* なし */}}
export function resetGuides(profile:string,s?:Store){try{store(s)?.removeItem(guideKey(profile));store(s)?.removeItem(MATCH_GUIDE_KEY);store(s)?.removeItem(`diamond-nine-tutorial-v1-${profile}`);}catch{/* なし */}}
