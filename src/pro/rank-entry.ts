// DIAMOND NINE オンラインランキング: セーブから「登録する中身」を作る(通信しない・純粋な関数だけ)。
// 形は firestore.rules の d9Entry と同じ。validEntry() でルールと同じ確かめをして、断られる物は送らない。
import {playerMap} from './data';
import type {GameState,Season} from './engine';
import {circuitOf,type Circuit} from './leagues';
import {recordAchievements,type AchievementId} from './achievements';
import type {SnapshotPlayer} from './season-team';

export type RankLeague='npb'|'mlb'|'space';
export interface RankLeagueInfo {id:RankLeague;circuit:Circuit;label:string;title:string;achievement:AchievementId;minYear:number;games:number}
// 画面の並び: 持ち主の言う「海外リーグ最短優勝・宇宙リーグ最短優勝」を先に、国内(日本一)を最後に。
export const RANK_LEAGUES:RankLeagueInfo[]=[
 {id:'mlb',circuit:'MLB',label:'海外リーグ',title:'世界王座決定戦優勝',achievement:'worldChampion',minYear:4,games:162},
 {id:'space',circuit:'SPACE',label:'宇宙リーグ',title:'宇宙王座決定戦優勝',achievement:'spaceChampion',minYear:5,games:162},
 {id:'npb',circuit:'NPB',label:'国内リーグ',title:'日本一',achievement:'npbChampion',minYear:1,games:143},
];
export const rankLeague=(id:RankLeague)=>RANK_LEAGUES.find(l=>l.id===id)!;
export const rankLeagueOf=(circuit:Circuit)=>RANK_LEAGUES.find(l=>l.circuit===circuit)!;

export interface RankBatter {i:string;n:string;pos:string;o:number;c:number;p:number;s:number;f:number}
export interface RankPitcher {i:string;n:string;o:number;v:number;ct:number;st:number;bk:number}
/** 端末の中での登録の中身。送る時は toWire で打順・先発を文字列1本ずつにする(at・nt はサーバーの時刻を ranking.ts で足す)。 */
export interface RankEntry {n:string;tn:string;y:number;v:string;rec:{w:number;l:number;d:number};b:RankBatter[];sp:RankPitcher[]}
/** サーバーに置く形。b・sp は firestore.rules の d9Lineup・d9Rotation の正規表現と同じ形の文字列(選手 ID は送らない)。 */
export interface RankWire {n:string;tn:string;y:number;v:string;rec:{w:number;l:number;d:number};b:string;sp:string}

export const MAX_YEAR=500;
const POSITIONS=['捕','一','二','三','遊','外','DH'];
const NG=/(死ね|しね|殺す|ころす|ちんこ|ちんぽ|まんこ|セックス|せっくす|うんこ|きちがい|キチガイ|ガイジ|がいじ|fuck|shit|nigger|sex|porn|http|www\.)/i;
const kataToHira=(s:string)=>s.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
/** 表示名・チーム名に使えない言葉が入っているか。端末ではルールより少し広く見る(全角・空白・カタカナも)。 */
export function hasNgWord(s:string):boolean{
 const t=s.normalize('NFKC').replace(/[\s　・._\-]/g,'');
 return NG.test(s)||NG.test(t)||NG.test(kataToHira(t));
}
// 12文字まで。絵文字など2単位の文字があっても、ルールの size() <= 12 を確実に通るよう UTF-16 の単位でも12に収める
export const cleanName=(s:string)=>{const a=Array.from(s.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').trim()).slice(0,12);while(a.join('').length>12)a.pop();return a.join('');};
export const validDisplayName=(s:string)=>{const n=cleanName(s);return n.length>=1&&n===s&&!hasNgWord(n);};
/** チーム名(20文字まで)。セーブのチーム名(state.name)を初めの値にし、宇宙リーグ制覇の記録では本人が直せる。 */
export const cleanTeamName=(s:string)=>{const a=Array.from(s.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').trim()).slice(0,20);while(a.join('').length>20)a.pop();return a.join('');};
export const validTeamName=(s:string)=>{const n=cleanTeamName(s);return n.length>=1&&n===s&&!hasNgWord(n);};
/** セーブにあるチーム名(優勝した年の写し → 今のチーム名)。 */
export const saveTeamName=(state:GameState,lg:RankLeague)=>cleanTeamName(championSeason(state,lg)?.shareTeam?.name||state.name||'');

// ---------- 宇宙リーグ制覇の記録(2026-11-03 vc41 持ち主「宇宙リーグ制覇した人の名前、チーム名、オーダーを残す。1回きりでいい」) ----------
// d9_space_hof/{uid} に1人1回だけ。中身は最短優勝の1件と同じ形(表示名・チーム名・年数・成績・打順9人・先発6人・版・時刻)。
// 1回きりはルールで縛る: 作成だけ許し、更新は断る。消すことはできる(個人の記録を消す権利のため)が、
// 同時に作る d9_space_once/{uid}(時刻だけ・消せない)が残るので、消した後にもう一度は書けない。
export const HOF_LEAGUE:RankLeague='space';
/** 初回の表示名。端末ごとに1回だけ作って覚える(ranking.ts)。 */
export const autoDisplayName=(random=Math.random)=>'監督'+String(Math.floor(random()*9000)+1000);

export const championYearsLabel=(y:number,hof=false)=>`${y}年で${hof?'制覇':'優勝'}`;
const champion=(s:Season,club:string)=>s.completed&&s.postseason?.stage==='complete'&&s.postseason.champion===club;
const allSeasons=(state:GameState)=>[state.season,...(state.parkedSeason?[state.parkedSeason]:[]),...(state.additionalParkedSeasons??[]),...state.history];

/** そのリーグで一番早く優勝した年(達成記録)。育成モード(career)だけ。以前のクラブ(free)は 15,600pt と強い選手で始まるので出さない。 */
export function bestYear(state:GameState,lg:RankLeague):number|null{
 if(state.mode!=='career')return null;
 const y=recordAchievements(state).achievements?.[rankLeague(lg).achievement];
 return typeof y==='number'&&Number.isInteger(y)&&y>=rankLeague(lg).minYear&&y<=MAX_YEAR?y:null;
}
/** 一番早く優勝した年のシーズン(スタメンの写し shareTeam が残っている時だけ)。過去8季を超えて消えた年は null。 */
export function championSeason(state:GameState,lg:RankLeague):Season|null{
 const y=bestYear(state,lg);if(y===null)return null;
 const info=rankLeague(lg);
 return allSeasons(state).find(s=>s&&s.number===y&&circuitOf(s)===info.circuit&&champion(s,state.club)&&s.shareTeam)??null;
}

const int=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,Math.round(Number.isFinite(x)?x:0)));
const fit=(s:string,n:number)=>{const a=Array.from(s).slice(0,n);while(a.join('').length>n)a.pop();return a.join('');};
const shortName=(id:string)=>fit((playerMap[id]?.name??'?').replace(/[,;\u0000-\u001f]/g,'・'),20)||'?';
const batter=(p:SnapshotPlayer):RankBatter=>({i:p.id,n:shortName(p.id),pos:p.position,o:int(p.overall,1,150),c:int(p.ratings.contact,0,99),p:int(p.ratings.power,0,99),s:int(p.ratings.speed,0,99),f:int(p.ratings.field,0,99)});
const pitcher=(p:SnapshotPlayer):RankPitcher=>({i:p.id,n:shortName(p.id),o:int(p.overall,1,150),v:int(p.ratings.velocity,0,170),ct:int(p.ratings.control,0,99),st:int(p.ratings.stamina,0,99),bk:int(p.ratings.breaking,0,99)});

/** 登録する中身。作れない時(写しが無い・形がルールに合わない)は null。 */
export function buildEntry(state:GameState,lg:RankLeague,displayName:string,version:string,teamName?:string):RankEntry|null{
 const season=championSeason(state,lg);if(!season?.shareTeam)return null;
 const me=season.standings.find(s=>s.team===state.club);if(!me)return null;
 const team=season.shareTeam;
 const entry:RankEntry={
  n:cleanName(displayName),
  tn:fit(cleanTeamName(teamName??(team.name||state.name||'')),20)||'DIAMOND NINE',
  y:season.number,
  v:fit(version||'web',24)||'web',
  rec:{w:me.w,l:me.l,d:me.d},
  b:team.batters.map(batter),
  sp:team.pitchers.slice(0,6).map(pitcher),
 };
 // チーム名に使えない言葉があれば、チーム名は出さずに決まった名前にする(表示名は本人が直す)
 if(hasNgWord(entry.tn))entry.tn='DIAMOND NINE';
 return validEntry(entry,lg)?entry:null;
}

const str=(s:unknown,lo:number,hi:number)=>typeof s==='string'&&s.length>=lo&&s.length<=hi;
const inRange=(x:unknown,lo:number,hi:number)=>typeof x==='number'&&Number.isInteger(x)&&x>=lo&&x<=hi;
/** firestore.rules の d9Entry と同じ確かめ。長さは UTF-16 の単位(JS の length)で見て、ルールより緩くならないようにする。 */
export function validEntry(e:RankEntry,lg:RankLeague):boolean{
 const info=rankLeague(lg),len=(s:string)=>s.length;
 if(!e||!str(e.n,1,12)||hasNgWord(e.n)||!str(e.tn,1,20)||hasNgWord(e.tn))return false;
 if(!inRange(e.y,info.minYear,MAX_YEAR)||!str(e.v,1,24))return false;
 if(!e.rec||![e.rec.w,e.rec.l,e.rec.d].every(x=>inRange(x,0,162))||e.rec.w+e.rec.l+e.rec.d!==info.games)return false;
 if(!Array.isArray(e.b)||e.b.length!==9||new Set(e.b.map(x=>x.i)).size!==9)return false;
 if(!e.b.every(x=>str(x.i,1,40)&&len(x.n)>=1&&len(x.n)<=20&&!/[,;]/.test(x.n)&&!hasNgWord(x.n)&&POSITIONS.includes(x.pos)&&inRange(x.o,1,150)&&[x.c,x.p,x.s,x.f].every(v=>inRange(v,0,99))))return false;
 const pos=e.b.map(x=>x.pos);
 if(new Set(pos).size!==7||pos.filter(p=>p==='外').length!==3)return false;
 if(!Array.isArray(e.sp)||e.sp.length!==6||new Set(e.sp.map(x=>x.i)).size!==6)return false;
 {const w=toWire(e);if(w.b.length>450||w.sp.length>300)return false;}
 return e.sp.every(x=>str(x.i,1,40)&&len(x.n)>=1&&len(x.n)<=20&&!/[,;]/.test(x.n)&&!hasNgWord(x.n)&&inRange(x.o,1,150)&&inRange(x.v,0,170)&&[x.ct,x.st,x.bk].every(v=>inRange(v,0,99)));
}

// ---------- 送る形(文字列)と戻す形 ----------
const BAT_RE=/^([^,;]{1,20}),(捕|一|二|三|遊|外|DH),(\d{1,3}),(\d{1,2}),(\d{1,2}),(\d{1,2}),(\d{1,2})$/;
const PIT_RE=/^([^,;]{1,20}),(\d{1,3}),(\d{1,3}),(\d{1,2}),(\d{1,2}),(\d{1,2})$/;
export function toWire(e:RankEntry):RankWire{
 return {n:e.n,tn:e.tn,y:e.y,v:e.v,rec:{w:e.rec.w,l:e.rec.l,d:e.rec.d},
  b:e.b.map(x=>[x.n,x.pos,x.o,x.c,x.p,x.s,x.f].join(',')).join(';'),
  sp:e.sp.map(x=>[x.n,x.o,x.v,x.ct,x.st,x.bk].join(',')).join(';')};
}
/** サーバーの1件を画面の形に戻す。形が崩れた行は null(表に出さない)。 */
export function fromWire(w:unknown):RankEntry|null{
 const x=w as RankWire;
 if(!x||typeof x!=='object'||typeof x.n!=='string'||typeof x.tn!=='string'||typeof x.y!=='number'||typeof x.b!=='string'||typeof x.sp!=='string'||!x.rec)return null;
 const b=x.b.split(';').map(t=>BAT_RE.exec(t)),sp=x.sp.split(';').map(t=>PIT_RE.exec(t));
 if(b.length!==9||sp.length!==6||b.some(m=>!m)||sp.some(m=>!m))return null;
 return {n:x.n,tn:x.tn,y:x.y,v:typeof x.v==='string'?x.v:'',rec:{w:+x.rec.w||0,l:+x.rec.l||0,d:+x.rec.d||0},
  b:b.map((m,i)=>({i:String(i),n:m![1],pos:m![2],o:+m![3],c:+m![4],p:+m![5],s:+m![6],f:+m![7]})),
  sp:sp.map((m,i)=>({i:String(i),n:m![1],o:+m![2],v:+m![3],ct:+m![4],st:+m![5],bk:+m![6]}))};
}
