import {useSyncExternalStore} from 'react';
import type {GameState} from './engine';
import {circuitOf,seasonGames} from './leagues';

// 行動力(2026-10-19 持ち主「1年進めるのにソシャゲみたいに時間制限」→「1年丸々で進める。さくさく」
// →「選手がそろうまでは自由に、そこから徐々に」)。
// 「1年進める」1回に行動力を使う。量は段階で変わる(seasonCost)。
// 待てば必ず回復するので、お金を払わなくても必ず先へ進める。
// クラブのセーブとは別に端末へ置く(リセット・読み込み・クラブの切り替えで満タンに戻らない)。
// 数値の理由は STAMINA_UPDATE.md。
export const STAMINA_MAX=30;
export const STAMINA_REGEN_MS=3*60*1000;
// プレミアムパス: 上限を上げ、回復を速く。
export const PASS_STAMINA_MAX=40;
export const PASS_STAMINA_REGEN_MS=2*60*1000;
// 回復で上限を超えて持てる量の天井(ドリンクを無駄にしないため超過は許す)。
export const STAMINA_HARD_CAP=200;
// pt で回復: 上限ぶん足す(国内なら3シーズンぶん)。スカウト1回と同じ 3,000pt。
export const STAMINA_PT_COST=3000;
// 配るドリンク1本で足す量。ログインで1本、今日の目標を全部で1本。
export const DRINK_RESTORE=10;// 国内の1年ぶん
// 広告1回で足す量と1日の回数(スカウトの広告とは別に数える)。
export const STAMINA_AD_POINTS=10;
export const STAMINA_AD_DAILY_LIMIT=3;
// 段階(STAMINA_UPDATE.md)。
// 序盤: 3シーズン目まで行動力を使わない(選手を集める間は自由に)。
export const FREE_SEASONS=3;
// 慣らし: 4シーズン目から、スカウトが10回に届くまでは国内の1年が半分(5)。
export const WARMUP_PULLS=10;
// 1年に使う行動力: 国内10・海外12・宇宙15(上のリーグほど、急ぎたい人に pt とパスが効く)。
export const SEASON_COST={warmup:5,NPB:10,MLB:12,SPACE:15} as const;

export interface StaminaRules {max:number;regenMs:number}
export const staminaRules=(pass:boolean):StaminaRules=>pass?{max:PASS_STAMINA_MAX,regenMs:PASS_STAMINA_REGEN_MS}:{max:STAMINA_MAX,regenMs:STAMINA_REGEN_MS};

export interface StaminaRecord {
 v:1;
 points:number;
 // 回復を数え始めた時刻(端末時計の ms)。
 at:number;
 // これまでに見た一番新しい時刻。これより前に戻っていたら回復させない。
 seen:number;
 drinks:number;
 // 配布の受け取り(日付ごと)。
 gift:{day:string;login:boolean;all:boolean};
}
const KEY='diamond-nine-stamina';
const okNum=(n:unknown,min=0):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=min;
export const freshStamina=(now:number,rules:StaminaRules=staminaRules(false)):StaminaRecord=>({v:1,points:rules.max,at:now,seen:now,drinks:0,gift:{day:'',login:false,all:false}});
// 既存のセーブを持つ人(この記録が無い人)と壊れた記録は満タンから始める。
export function parseStamina(raw:string|null,now:number,rules:StaminaRules=staminaRules(false)):StaminaRecord{
 try{
  const v=raw?JSON.parse(raw):null;
  if(!v||v.v!==1||!okNum(v.points)||!okNum(v.at)||!okNum(v.seen)||!okNum(v.drinks))return freshStamina(now,rules);
  const g=v.gift&&typeof v.gift.day==='string'?{day:v.gift.day,login:!!v.gift.login,all:!!v.gift.all}:{day:'',login:false,all:false};
  return {v:1,points:Math.min(STAMINA_HARD_CAP,Math.floor(v.points)),at:Math.min(v.at,v.seen),seen:v.seen,drinks:Math.min(99,Math.floor(v.drinks)),gift:g};
 }catch{return freshStamina(now,rules);}
}

// 今の時刻まで回復を進める。時計が前回より戻っていたら回復させない(戻った分の時間は数えない)。
export function settle(r:StaminaRecord,now:number,rules:StaminaRules):StaminaRecord{
 if(!okNum(now))return r;
 if(now<r.seen)return r;
 if(r.points>=rules.max)return {...r,at:now,seen:now};
 const steps=Math.floor(Math.max(0,now-r.at)/rules.regenMs);
 const points=Math.min(rules.max,r.points+steps);
 return {...r,points,at:points>=rules.max?now:r.at+steps*rules.regenMs,seen:now};
}
export interface StaminaView {points:number;max:number;regenMs:number;full:boolean;nextInMs:number;fullInMs:number;frozen:boolean;drinks:number}
export function staminaView(r:StaminaRecord,now:number,rules:StaminaRules):StaminaView{
 const s=settle(r,now,rules),frozen=now<r.seen,full=s.points>=rules.max;
 // 時計が戻っている間は、前回の時刻に追いつくまで回復しない。
 const base=frozen?r.seen:now,into=Math.max(0,base-s.at)%rules.regenMs;
 const nextInMs=full?0:rules.regenMs-into+(frozen?r.seen-now:0);
 const fullInMs=full?0:nextInMs+(rules.max-s.points-1)*rules.regenMs;
 return {points:s.points,max:rules.max,regenMs:rules.regenMs,full,nextInMs,fullInMs,frozen,drinks:s.drinks};
}
// 満タンになる時刻(通知用)。満タンなら null。
export const fullAt=(r:StaminaRecord,now:number,rules:StaminaRules)=>{const v=staminaView(r,now,rules);return v.full?null:now+v.fullInMs;};

export function spendStamina(r:StaminaRecord,cost:number,now:number,rules:StaminaRules):StaminaRecord|null{
 if(!Number.isInteger(cost)||cost<0)return null;
 const s=settle(r,now,rules);
 if(s.points<cost)return null;
 if(cost===0)return s;
 const wasFull=s.points>=rules.max,points=s.points-cost;
 return {...s,points,at:wasFull&&points<rules.max?Math.max(now,s.seen):s.at};
}
export function addStamina(r:StaminaRecord,amount:number,now:number,rules:StaminaRules):StaminaRecord{
 const s=settle(r,now,rules),points=Math.min(STAMINA_HARD_CAP,s.points+Math.max(0,Math.floor(amount)));
 return {...s,points,at:points>=rules.max?Math.max(now,s.seen):s.at};
}
export const canBuyWithPoints=(r:StaminaRecord,gems:number,now:number,rules:StaminaRules)=>gems>=STAMINA_PT_COST&&settle(r,now,rules).points+rules.max<=STAMINA_HARD_CAP;
export function useDrink(r:StaminaRecord,now:number,rules:StaminaRules):StaminaRecord|null{
 if(r.drinks<=0)return null;
 const s=settle(r,now,rules);if(s.points+DRINK_RESTORE>STAMINA_HARD_CAP)return null;
 return addStamina({...s,drinks:s.drinks-1},DRINK_RESTORE,now,rules);
}
// 配布(1日1回ずつ)。[次の記録, 受け取った本数]
export function claimDrinkGift(r:StaminaRecord,kind:'login'|'all',day:string):[StaminaRecord,number]{
 const g=r.gift.day===day?r.gift:{day,login:false,all:false};
 if(g[kind])return [r,0];
 return [{...r,drinks:Math.min(99,r.drinks+1),gift:{...g,[kind]:true}},1];
}

// ---- 試合と行動力 ----
export type StaminaStage='free'|'warmup'|'mid'|'late';
export function staminaStage(state:GameState):StaminaStage{
 if(state.season.number<=FREE_SEASONS)return 'free';
 const c=circuitOf(state.season);
 if(c!=='NPB')return 'late';
 return (state.pulls??0)<WARMUP_PULLS?'warmup':'mid';
}
export function seasonCost(state:GameState):number{
 const stage=staminaStage(state);
 if(stage==='free')return 0;
 if(stage==='warmup')return SEASON_COST.warmup;
 const c=circuitOf(state.season);
 return c==='SPACE'?SEASON_COST.SPACE:c==='MLB'?SEASON_COST.MLB:SEASON_COST.NPB;
}
export const freeSeasonsLeft=(state:GameState)=>Math.max(0,FREE_SEASONS-state.season.number+1);
export const gamesLeft=(state:GameState)=>state.season.completed?0:Math.max(0,seasonGames(state.season)-state.season.day);
// 試合を進める操作は「1年進める」だけ(2026-10-19 持ち主「1試合とか細かく進めるのいらない」)。
// 途中まで進んだ年でも、残りを終える時は1年ぶんを使う。
export const costToFinish=(state:GameState)=>gamesLeft(state)>0?seasonCost(state):0;

// 段階が始まって初めて行動力を使う時の案内(1回だけ)。
const INTRO_KEY='diamond-nine-stamina-intro';
export const staminaIntroDue=(state:GameState)=>{if(seasonCost(state)<=0)return false;try{return localStorage.getItem(INTRO_KEY)!=='1';}catch{return false;}};
export const markStaminaIntro=()=>{try{localStorage.setItem(INTRO_KEY,'1');}catch{/* 次にまた出る */}};

export const formatWait=(ms:number)=>{
 const s=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
 return h?`${h}時間${String(m).padStart(2,'0')}分`:m?`${m}分${String(sec).padStart(2,'0')}秒`:`${sec}秒`;
};

// ---- 端末への保存と購読(ブラウザ) ----
const listeners=new Set<()=>void>();
let memory:string|null=null;// localStorage が使えない時の控え
const read=()=>{try{return localStorage.getItem(KEY);}catch{return memory;}};
const write=(raw:string)=>{memory=raw;try{localStorage.setItem(KEY,raw);}catch{/* この回は記憶だけで続ける */}};
let passOn=false;
export const setStaminaPass=(on:boolean)=>{if(passOn!==on){passOn=on;emit();}};
export const currentRules=()=>staminaRules(passOn);
let cache:{raw:string|null;value:StaminaRecord}|null=null;
export function loadStamina(now=Date.now()):StaminaRecord{
 const raw=read();
 if(!cache||cache.raw!==raw)cache={raw,value:parseStamina(raw,now,currentRules())};
 return cache.value;
}
export function saveStamina(r:StaminaRecord){const raw=JSON.stringify(r);write(raw);cache={raw,value:r};emit();}
function emit(){tick++;for(const l of listeners)l();}
let tick=0,timer:ReturnType<typeof setInterval>|null=null;
// 残り時間の表示のため1秒ごとに更新する(見ている間だけ)。
export function subscribeStamina(l:()=>void){
 listeners.add(l);
 if(!timer&&typeof setInterval!=='undefined')timer=setInterval(()=>{tick++;for(const x of listeners)x();},1000);
 const onStorage=(e:StorageEvent)=>{if(e.key===KEY){cache=null;emit();}};
 if(typeof window!=='undefined')window.addEventListener('storage',onStorage);
 return()=>{listeners.delete(l);if(!listeners.size&&timer){clearInterval(timer);timer=null;}if(typeof window!=='undefined')window.removeEventListener('storage',onStorage);};
}
let viewCache:{tick:number;value:StaminaView}|null=null;
export function staminaSnapshot():StaminaView{
 if(viewCache?.tick===tick)return viewCache.value;
 const now=Date.now(),value=staminaView(loadStamina(now),now,currentRules());
 const prev=viewCache?.value;
 // 中身が同じなら同じ物を返す(useSyncExternalStore の再描画を減らす)。
 const same=prev&&prev.points===value.points&&prev.max===value.max&&prev.drinks===value.drinks&&prev.frozen===value.frozen&&Math.ceil(prev.nextInMs/1000)===Math.ceil(value.nextInMs/1000);
 viewCache={tick,value:same?prev!:value};
 return viewCache.value;
}
const serverView:StaminaView={points:STAMINA_MAX,max:STAMINA_MAX,regenMs:STAMINA_REGEN_MS,full:true,nextInMs:0,fullInMs:0,frozen:false,drinks:0};
export const useStamina=()=>useSyncExternalStore(subscribeStamina,staminaSnapshot,()=>serverView);
// 変更はすべてここを通す(今の時刻で回復を進めてから)。結果が null なら何もしない。
export function updateStamina(fn:(r:StaminaRecord,now:number,rules:StaminaRules)=>StaminaRecord|null):StaminaRecord|null{
 const now=Date.now(),rules=currentRules(),next=fn(loadStamina(now),now,rules);
 if(next)saveStamina(next);
 return next;
}
// 1秒ごとに変わらない要約(画面全体を毎秒描き直さないため)。満タンになる時刻は分単位。
const summaryOf=(v:StaminaView,now:number)=>`${v.points}|${v.max}|${v.full?0:Math.round((now+v.fullInMs)/60000)*60000}`;
export const useStaminaSummary=()=>{
 const raw=useSyncExternalStore(subscribeStamina,()=>summaryOf(staminaSnapshot(),Date.now()),()=>`${STAMINA_MAX}|${STAMINA_MAX}|0`);
 const [points,max,at]=raw.split('|').map(Number);
 return {points,max,fullAt:at||null};
};
