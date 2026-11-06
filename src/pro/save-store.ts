// 保存(2026-11-06 夜 持ち主「保存できません、設定から書き出して、が消えない」)。
// 原因: セーブに全試合の成績表(box)を入れていた。国内は1年 約860試合、海外は約2,430試合ぶん。
// 海外の1年目で、いまのシーズン+前のシーズンの成績表だけで 400〜500万字(localStorage は 1字2バイトで数えるので 10MB の枠を超える)。
// リセットの控え(-snapshot-*)も消されずに残り、枠を食っていた。
// 直し: (1) 枠が足りない時は、セーブを縮めて書く(LZ。JSON の 1/10〜1/15 ほど。頭に D9Z1: を付ける。読む時は素の JSON も縮めた物も読める)。リセットの控えはいつも縮めて書く。
// (2) 前のシーズンの成績表(box)・自分のチームが出ていない試合の成績表・観戦の控えは保存しない(画面で使うのはいまのシーズンの自分の試合の分だけ)。
// 書けなかった時は縮めて書く。それでもだめなら、指されていないリセットの控えを消して、もう一度書く。
import {saveKeyFor,type GameResult,type GameState,type Season} from './engine';
import type {Profile} from './progression';
import {encodeSave} from './save-codec';
export {encodeSave,decodeSave,parseSave} from './save-codec';

type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'|'key'|'length'>;
const mine=(g:GameResult,club:string)=>!!g&&(g.home===club||g.away===club);
function slimResults(results:GameResult[],club:string,keepOwn:boolean):GameResult[]{
 let changed=false;
 const out=results.map(g=>{
  if(!g||(g.box===undefined&&g.replay===undefined)||(keepOwn&&mine(g,club)))return g;
  changed=true;const {box,replay,...rest}=g;void box;void replay;return rest;
 });
 return changed?out:results;
}
function slimSeason(season:Season,club:string,keepOwn:boolean):Season{
 const results=Array.isArray(season.results)?slimResults(season.results,club,keepOwn):season.results;
 const post=season.postseason;
 const series=post?.series?.map(s=>Array.isArray(s.results)?{...s,results:slimResults(s.results,club,keepOwn)}:s);
 return {...season,results,...(post?{postseason:{...post,series:series??post.series}}:{})};
}
/** 保存用に縮めたセーブ。遊んでいる時の状態(メモリの中)は変えない。deep=true は止めているシーズンの自分の成績表も外す。 */
export function compactForSave(state:GameState,deep=false):GameState{
 const club=state.club;
 return {...state,
  season:slimSeason(state.season,club,true),
  ...(state.parkedSeason?{parkedSeason:slimSeason(state.parkedSeason,club,!deep)}:{}),
  ...(state.additionalParkedSeasons?{additionalParkedSeasons:state.additionalParkedSeasons.map(s=>slimSeason(s,club,false))}:{}),
  history:state.history.map(s=>slimSeason(s,club,false)),
 };
}
const backupPointer=(profile:Profile)=>`${saveKeyFor(profile)}-reset-backup`;
/** 指されていないリセットの控えを消す(指されている1つは残す)。消した数を返す。 */
export function pruneSnapshots(profile:Profile,store:Store):number{
 const key=saveKeyFor(profile),keep=store.getItem(backupPointer(profile)),old:string[]=[];
 for(let i=0;i<store.length;i++){const k=store.key(i);if(k&&k.startsWith(`${key}-snapshot-`)&&k!==keep)old.push(k);}
 for(const k of old)store.removeItem(k);
 return old.length;
}
/** セーブを書く。同じ中身なら書かない。書けたら true。
 * ふだんは素の JSON(速い)。枠が足りない時は縮めて(LZ)書く。それでもだめなら、指されていない古いリセットの控えを消してもう一度。 */
export function writeSave(state:GameState,profile:Profile,store:Store=localStorage):boolean{
 const key=saveKeyFor(profile),slim=compactForSave(state);
 const put=(text:string)=>{if(store.getItem(key)!==text)store.setItem(key,text);};
 try{put(JSON.stringify(slim));return true;}catch{/* 枠が足りない */}
 try{put(encodeSave(slim));return true;}catch{/* まだ足りない */}
 try{if(pruneSnapshots(profile,store)>0){put(encodeSave(slim));return true;}}catch{/* まだ足りない */}
 try{put(encodeSave(compactForSave(state,true)));return true;}catch{return false;}
}
