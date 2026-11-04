// 観戦モード(2026-11-04 vc43)の画面の外の決まり。計算そのものは engine.ts の gameSteps。
// 観られる試合: 開幕戦・リーグ優勝が決まった試合・最終戦の首位攻防・自分のチームが出たプレーオフ・国内/世界/宇宙の王座決定戦。
// 「1年進める」は途中で止めない。1年が終わった後に、シーズンの画面から開いて振り返って観る。
import {circuitOf} from './leagues';
import {stageLabel,type PostSeries} from './postseason';
import {grade,playerMap,players,canBat,type Ratings} from './data';
import {mlbOpponentPlayers} from './mlb-opponents';
import {gameRatings} from './matchup';
import {growthBonus} from './development';
import {seasonConditions} from './conditions';
import {pitcherSlotRole,pitchingRatingsForRole} from './pitcher-aptitude';
import type {GameResult,GameState,LiveKind,WatchKind} from './engine';

export interface Watchable {key:string;label:string;short:string;game:GameResult;mine:boolean;series?:string}
const kindLabel:Record<Exclude<WatchKind,'post'>,string>={opening:'開幕戦',clinch:'リーグ優勝が決まった試合',showdown:'最終戦 首位攻防'};
export const seriesName=(s:Pick<PostSeries,'stage'>,space:boolean)=>space&&s.stage==='world'?'宇宙王座決定戦':stageLabel(s.stage);
/** 今のシーズンで観られる試合(控えのある試合だけ)。次のシーズンへ進むと控えは消える。 */
export function watchList(state:GameState):Watchable[]{
 const season=state.season,space=circuitOf(season)==='SPACE',list:Watchable[]=[];
 if(!season.completed)return list;
 season.results.forEach((g,i)=>{if(g.replay&&g.replay.kind!=='post'){const label=kindLabel[g.replay.kind];list.push({key:`r${i}`,label,short:label,game:g,mine:true});}});
 for(const s of season.postseason?.series??[])s.results.forEach((g,i)=>{if(!g.replay)return;const name=seriesName(s,space);list.push({key:`${s.id}#${i}`,label:`${name} 第${i+1}戦`,short:`${name} 第${i+1}戦`,game:g,mine:g.home===state.club||g.away===state.club,series:s.id});});
 return list;
}
/** 監督が操作できる側(0=先攻,1=後攻,-1=観るだけ)。 */
export const controlSide=(state:GameState,g:GameResult)=>g.away===state.club?0:g.home===state.club?1:-1;

// ---- 能力の見せ方 ----
/** 段。99 を超える(宇宙リーグの相手・育成4段)時は S+。 */
export const gradeOf=(v:number)=>v>99?'S+':grade(v);
/** 段の色の名前(CSS の .g-S 等)。 */
export const gradeClass=(v:number)=>'g-'+(v>99?'SP':grade(v));
/** 計算に使うのと同じ能力(覚醒・育成・成長・調子・相手の補正込み)。base は replayState で作ったその試合の時の状態。 */
export function liveRatings(base:GameState,team:string,id:string,pitchers?:string[]):Ratings{
 const p=playerMap[id],mine=team===base.club,c=circuitOf(base.season);
 const form=mine?seasonConditions(base).find(x=>x.playerId===id)?.boost??0:0;
 const bonus=mine?Math.min(5,Math.max(0,(base.owned[id]??1)-1))+growthBonus(base.careerGrowth,id)+form:c==='SPACE'?4:c==='NPB'?-4:-2;
 const stage=mine?(base.training[id]??0):c==='SPACE'?4:0;
 const r=gameRatings(p,bonus,stage);
 if(p.role!=='pitcher'||!pitchers)return r;
 const at=pitchers.indexOf(id);return at<0?r:pitchingRatingsForRole(p,r,pitcherSlotRole(at));
}
/** 相手のベンチ(打順に入っていない打てる選手)。 */
export function teamPool(team:string){return (team.startsWith('mlb-')?mlbOpponentPlayers:players).filter(p=>p.team===team);}
export function benchOf(team:string,lineup:string[],pitchers:string[]){return teamPool(team).filter(p=>canBat(p)&&!lineup.includes(p.id)&&!pitchers.includes(p.id)).map(p=>p.id);}

// ---- 1球ずつの見せ方(演出だけ。結果は打席の計算で決まっている) ----
// 打席の結果に合うカウントの流れを作る。試合の乱数とは別の数を使うので、試合の結果は変わらない。
export function pitchesFor(kind:LiveKind,seed:number,lengthen=0):string[]{
 let s=seed>>>0;const r=()=>{s=(Math.imul(s,1103515245)+12345)>>>0;return s/4294967296;};
 if(kind==='IBB')return ['B','B','B','B'];
 if(kind==='BUNT'||kind==='BUNT_FAIL')return r()<.5?['X']:['F','X'];
 if(kind==='HBP')return [...Array.from({length:Math.floor(r()*3)},()=>r()<.5?'B':'S'),'X'];
 const seq:string[]=[];let b=0,k=0;const endBall=kind==='BB',endK=kind==='K';
 // lengthen: 慎重に=粘ってファウル・見送りが増える(+2)、積極的に=早いカウントで打つ(-1)。演出だけ。
 const n=Math.max(0,Math.floor(r()*5)+lengthen);
 for(let i=0;i<n;i++){const ball=r()<.45;if(ball&&b<3){b++;seq.push('B');}else if(!ball&&k<2){k++;seq.push(r()<.4?'F':'S');}else if(!ball&&lengthen>0)seq.push('F');}
 if(endBall){while(b<4){b++;seq.push('B');}}else if(endK){while(k<3){k++;seq.push('S');}}else seq.push('X');
 return seq;
}
export const countOf=(seq:string[])=>({b:Math.min(3,seq.filter(x=>x==='B').length),s:Math.min(2,seq.filter(x=>x==='S'||x==='F').length)});

// ---- 実況の文と、グラウンドの打球の向き(同じ表から選ぶので、実況と打球の向きは食い違わない) ----
export const dirs=['レフト','センター','ライト','右中間','左中間','三遊間','一二塁間'];
export const outs=['ショートゴロ','セカンドゴロ','センターフライ','レフトフライ','サードゴロ','ライトフライ','ファーストゴロ','ピッチャーゴロ'];
export const hrDirs=['レフト','センター','ライト','右中間','左中間'];
export const sfDirs=['レフト','センター','ライト'];
export const errDirs=['ショート','セカンド','サード'];
/** 実況と打球の向きで使う、表の中の1つ(打席ごとに決まる。試合の乱数は使わない)。 */
export const pickOf=<T,>(a:T[],inning:number,slot:number)=>a[(inning*7+slot*3)%a.length];
/** その打席の打球の向きの言葉(実況に出す物)。打球が無い時は ''。 */
export function playWord(kind:LiveKind,inning:number,slot:number):string{
 const p=<T,>(a:T[])=>pickOf(a,inning,slot);
 switch(kind){case 'HR':return p(hrDirs);case '3B':case '2B':case '1B':return p(dirs);case 'SF':return p(sfDirs);case 'E':return p(errDirs);case 'OUT':return p(outs);default:return '';}
}
export function callText(kind:LiveKind,name:string,slot:number,runs:number,inning:number,extra?:{replaced?:string;pitcher?:string}):string{
 const who=`${slot+1}番 ${name}`,w=playWord(kind,inning,slot),rbi=runs>0?`、${runs}点が入る!`:'';
 switch(kind){
  case 'HR':return `${who}、${w}スタンドへ ホームラン!${runs>1?` ${runs}点!`:''}`;
  case '3B':return `${who}、${w}を破る三塁打${rbi||'!'}`;
  case '2B':return `${who}、${w}を破る二塁打${rbi||'!'}`;
  case '1B':return `${who}、${w}へヒット${rbi||'。'}`;
  case 'BB':return `${who}、フォアボール${rbi||'。'}`;
  case 'IBB':return `${who}を敬遠。一塁へ歩かせる${rbi||'。'}`;
  case 'HBP':return `${who}、デッドボール${rbi||'。'}`;
  case 'K':return `${who}、空振り三振!`;
  case 'SF':return `${who}、${w}へ犠牲フライ${rbi}`;
  case 'E':return `${who}の打球を${w}がはじいた! エラーで出塁${rbi||'。'}`;
  case 'BUNT':return runs>0?`${who}、スクイズ成功${rbi}`:`${who}、送りバント成功。走者が進む。`;
  case 'BUNT_FAIL':return `${who}、バント失敗…小フライでアウト。`;
  case 'SB':return `${name}、盗塁成功!`;
  case 'CS':return `${name}、盗塁失敗。タッチアウト。`;
  case 'PINCH':return `選手交代: 代打 ${name}${extra?.replaced?`(${extra.replaced} に代わって)`:''}`;
  case 'RUNNER':return `選手交代: 代走 ${name}${extra?.replaced?`(${extra.replaced} に代わって)`:''}`;
  case 'FIELD':return `選手交代: 守備に ${name}${extra?.replaced?`(${extra.replaced} に代わって)`:''}`;
  case 'PITCHER':return `投手交代: ${extra?.pitcher??name} がマウンドへ`;
  default:return `${who}、${w}。`;
 }
}
export const isPlateAppearance=(kind:LiveKind)=>!['SB','CS','PINCH','RUNNER','FIELD','PITCHER'].includes(kind);

// ---- 速さ(端末に覚える) ----
export const SPEED_KEY='diamond-nine-watch-speed';
export const speeds=[1,2,4] as const;
export type Speed=typeof speeds[number];
/** おまかせで観る時の速さ(監督の時とは別に覚える。最初は2倍)。 */
export const AUTO_SPEED_KEY='diamond-nine-watch-speed-auto';
export function readSpeed(storage?:Pick<Storage,'getItem'>,key=SPEED_KEY,fallback:Speed=1):Speed{try{const n=Number((storage??localStorage).getItem(key));return (speeds as readonly number[]).includes(n)?n as Speed:fallback;}catch{return fallback;}}
export function saveSpeed(n:Speed,storage?:Pick<Storage,'setItem'>,key=SPEED_KEY){try{(storage??localStorage).setItem(key,String(n));}catch{/* 覚えられなくても観られる */}}
/** 1打席の長さ(ミリ秒)。1倍 2.4秒・2倍 1.2秒・4倍 0.6秒。 */
export const paMillis=(speed:Speed)=>2400/speed;
/** ホームランの演出の長さ。1倍 2.6秒。飛ばしの時は出さない。 */
export const homeRunMillis=(speed:Speed)=>2600/speed;
/** 打球が飛んで走者が走る時間(1倍 2.0秒・2倍 1.0秒・4倍 0.5秒)。 */
export const playMillis=(speed:Speed)=>2000/speed;
/** 1球の時間(投げる演出)。 */
export const pitchMillis=(speed:Speed)=>paMillis(speed)*.16;
