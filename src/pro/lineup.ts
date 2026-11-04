// 監督して戦う試合のスタメン(2026-11-05)。持ち主「監督試合する際、スタメンを決められるようにしてください」。
// 「監督して戦う」を押したら、試合の前に打順・守備位置・先発投手・控えとの入れ替えを決められる(決めなくても「このまま始める」)。
// 決めたスタメンは、その試合にだけ使う(「ふだんのオーダーにも使う」を入れた時だけ、チームのオーダーも同じにする)。
// 先発投手はローテーション(投手の並びの1〜6番目)の中から。選んだ投手を今日の枠(season.day%6)と入れ替える。
import {canBat,fitsPosition,playerMap} from './data';
import type {GameState} from './engine';
import {seasonConditions} from './conditions';
import {positionDefensePenalty} from './position-defense';
import {pitcherRolePenalty,type PitcherRole} from './pitcher-aptitude';

export interface StartOrder {lineup:string[];defense:Record<string,string>;pitchers:string[]}
export const POSITION_NEED:Record<string,number>={捕:1,一:1,二:1,三:1,遊:1,外:3};
const POS_NAME:Record<string,string>={捕:'捕手',一:'一塁',二:'二塁',三:'三塁',遊:'遊撃',外:'外野',DH:'指名打者'};
export const posName=(p:string)=>POS_NAME[p]??p;
/** ふだんのオーダー(「1年進める」で使う物)。おすすめのボタンで戻す先。 */
export const usualOrder=(s:Pick<GameState,'lineup'|'defense'|'pitchers'>):StartOrder=>({lineup:[...s.lineup],defense:Object.fromEntries(s.lineup.map(id=>[id,s.defense[id]])),pitchers:[...s.pitchers]});
/** DH を使うか(ふだんのオーダーに指名打者がいる)。 */
export const usesDH=(s:Pick<GameState,'lineup'|'defense'>)=>s.lineup.some(id=>s.defense[id]==='DH');
/** 今日の先発の枠。 */
export const starterSlot=(s:Pick<GameState,'season'>)=>s.season.day%6;
export const starterOf=(o:StartOrder,s:Pick<GameState,'season'>)=>o.pitchers[starterSlot(s)];
/** 控えの野手(持っている選手のうち、打順にも投手にもいない、打てる選手)。 */
export function benchOf(s:Pick<GameState,'owned'>,o:StartOrder){return Object.keys(s.owned).filter(id=>playerMap[id]&&canBat(playerMap[id])&&!o.lineup.includes(id)&&!o.pitchers.includes(id));}

/** 始められない理由(始められる時は '')。守備位置が重なる・足りない・投手がいない・人数が足りない。 */
export function orderBlock(s:Pick<GameState,'owned'|'lineup'|'defense'|'pitchers'|'season'>,o:StartOrder):string{
 if(o.lineup.length!==9||new Set(o.lineup).size!==9||o.lineup.some(id=>!id))return '打順は9人そろえてください';
 for(const id of o.lineup){const p=playerMap[id];if(!p||!s.owned[id])return 'チームにいない選手が入っています';if(!canBat(p))return `${p.name}は打てません`;if(o.pitchers.includes(id))return `${p.name}は投手の枠に入っています`;}
 const count:Record<string,number>={};for(const id of o.lineup){const p=o.defense[id];if(!p)return `${playerMap[id].name}の守備位置を決めてください`;count[p]=(count[p]??0)+1;}
 const dh=usesDH(s);
 for(const [p,n] of Object.entries(POSITION_NEED)){const have=count[p]??0;if(have>n)return p==='外'?`外野が${have}人います(3人まで)`:`${posName(p)}が${have}人います`;if(have<n)return p==='外'?`外野が${have}人です(3人必要)`:`${posName(p)}がいません`;}
 if(dh&&(count.DH??0)!==1)return (count.DH??0)>1?'指名打者が2人以上います':'指名打者がいません';
 if(!dh&&count.DH)return '指名打者は使えません';
 const extra=Object.keys(count).find(p=>!(p in POSITION_NEED)&&p!=='DH');if(extra)return `守備位置「${extra}」は使えません`;
 if(o.pitchers.length!==s.pitchers.length||[...o.pitchers].sort().join()!==[...s.pitchers].sort().join())return '投手の顔ぶれは変えられません';
 const st=starterOf(o,s);if(!st||!playerMap[st])return '先発投手がいません';
 return '';
}
/** 試合の画面とシーズンに入れる時に使う状態(その試合だけのスタメン)。 */
export function withStartOrder<T extends Pick<GameState,'lineup'|'defense'|'pitchers'>>(s:T,o:StartOrder|null|undefined):T{
 if(!o)return s;
 const defense={...s.defense};for(const id of s.lineup)delete defense[id];for(const id of o.lineup)defense[id]=o.defense[id];
 return {...s,lineup:[...o.lineup],defense,pitchers:[...o.pitchers]};
}
/** 同じオーダーか(ふだんのオーダーと比べる)。 */
export const sameOrder=(a:StartOrder,b:StartOrder)=>a.lineup.join()===b.lineup.join()&&a.lineup.every(id=>a.defense[id]===b.defense[id])&&a.pitchers.join()===b.pitchers.join();

// ---- 操作 ----
/** 打順の i と j を入れ替える(守備位置は選手に付いたまま)。 */
export function swapOrder(o:StartOrder,i:number,j:number):StartOrder{const lineup=[...o.lineup];[lineup[i],lineup[j]]=[lineup[j],lineup[i]];return {...o,lineup};}
/** 守備位置を pos にする。同じ位置の人がいれば(外野は3人を超える時)、その人と入れ替える。 */
export function setPosition(o:StartOrder,id:string,pos:string):StartOrder{
 const defense={...o.defense},from=defense[id],limit=POSITION_NEED[pos]??1;
 const holders=o.lineup.filter(x=>x!==id&&defense[x]===pos);
 if(holders.length>=limit&&from)defense[holders[holders.length-1]]=from;
 defense[id]=pos;return {...o,defense};
}
/** 控え(bench)を打順の i に入れる。入る選手は、出る選手の守備位置を引き継ぐ。 */
export function benchIn(o:StartOrder,i:number,bench:string):StartOrder{
 const lineup=[...o.lineup],out=lineup[i],defense={...o.defense};lineup[i]=bench;defense[bench]=defense[out];delete defense[out];return {...o,lineup,defense};
}
/** 先発を id にする(今日の枠の投手と、並びを入れ替える)。 */
export function chooseStarter(o:StartOrder,s:Pick<GameState,'season'>,id:string):StartOrder{
 const pitchers=[...o.pitchers],at=pitchers.indexOf(id),slot=starterSlot(s);if(at<0||at>5)return o;[pitchers[at],pitchers[slot]]=[pitchers[slot],pitchers[at]];return {...o,pitchers};
}
/** ローテーションの投手の、前の登板からの日数(表示だけ。試合の計算に投手の疲れは無い)。null=まだ投げていない。 */
export function restDays(s:Pick<GameState,'season'>,o:StartOrder,id:string):number|null{
 const slot=o.pitchers.indexOf(id);if(slot<0||slot>5)return null;
 // ふだんの並びで、その枠が最後に投げた日
 const day=s.season.day,ago=((day%6)-slot+6)%6||6;
 return day-ago<0?null:ago-1;
}
/** 今日の調子(14日ごとに3人が好調・絶好調・不調。conditions.ts と同じ)。 */
export function formOf(s:GameState,id:string):number{return seasonConditions(s).find(c=>c.playerId===id)?.boost??0;}
/** 本職か(その守備位置を守れるか)。 */
export const isNative=(id:string,pos:string)=>pos==='DH'||!!playerMap[id]&&fitsPosition(playerMap[id],pos);

// ---- 適性の表示(11/5 朝 持ち主「選手のポジション適性がわからない。投手も同じ」) ----
export type FitMark='◎'|'○'|'△'|'×';
export interface PosFit {pos:string;mark:FitMark;main:boolean;text:string}
const FIELD_POS=['捕','一','二','三','遊','外'];
/** 守備位置の適性。◎=本職(登録の守備位置)、○=守れる、△=守れるが苦手(守備が少し下がる)、×=守ったことがない(守備が大きく下がる)。
 *  計算は試合と同じ positionDefensePenalty(本職でない位置ほど守備が下がる)。 */
export function posFit(id:string,pos:string):PosFit{
 const p=playerMap[id];
 if(!p||pos==='DH')return {pos,mark:'○',main:false,text:pos==='DH'?'打つだけ(守らない)':'—'};
 const main=p.position===pos||(p.position==='内'&&['一','二','三','遊'].includes(pos));
 if(main)return {pos,mark:'◎',main:true,text:'本職'};
 if(!fitsPosition(p,pos))return {pos,mark:'×',main:false,text:'本職ではありません(守備が大きく下がります)'};
 const pen=positionDefensePenalty(p,pos);
 return pen>=18?{pos,mark:'△',main:false,text:'本職ではありません(守備が少し下がります)'}:{pos,mark:'○',main:false,text:'本職ではありません(守れます)'};
}
/** 守れる位置の短い一覧(「捕◎ 一○ 三△」)。× は出さない。本職を先頭に。 */
export function posFitLine(id:string):PosFit[]{
 const all=FIELD_POS.map(pos=>posFit(id,pos)).filter(f=>f.mark!=='×');
 const order:Record<FitMark,number>={'◎':0,'○':1,'△':2,'×':3};
 return all.sort((a,b)=>order[a.mark]-order[b.mark]||FIELD_POS.indexOf(a.pos)-FIELD_POS.indexOf(b.pos));
}
/** 投手の役割の適性(先発・中継ぎ・抑え)。試合の計算と同じ pitcherRolePenalty: 0=◎か○、5=△、12=×。公表の適性(wiki)がある時はその◎○をそのまま使う。 */
export function roleFits(id:string):{role:PitcherRole;name:string;mark:FitMark}[]{
 const p=playerMap[id];const names:Record<PitcherRole,string>={先:'先発',中:'中継ぎ',抑:'抑え'};
 return (['先','中','抑'] as PitcherRole[]).map(role=>{
  if(!p)return {role,name:names[role],mark:'×' as FitMark};
  const w=p.wikiAssessment?.pitcherRoles?.[role],pen=pitcherRolePenalty(p,role);
  const mark:FitMark=w==='◎'||w==='○'?w:pen===0?'◎':pen<=5?'△':'×';
  return {role,name:names[role],mark};
 });
}
