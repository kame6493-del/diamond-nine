import {useSyncExternalStore} from 'react';
import type {GameState} from './engine';
import {circuitOf,seasonGames} from './leagues';

// 行動力(2026-10-19 持ち主「1年進めるのにソシャゲみたいに時間制限」→「1年丸々で進める。さくさく」
// →「選手がそろうまでは自由に、そこから徐々に」)。
// 「1年進める」1回に行動力を使う。量は段階で変わる(seasonCost)。
// 待てば必ず回復するので、お金を払わなくても必ず先へ進める。
// クラブのセーブとは別に端末へ置く(リセット・読み込み・クラブの切り替えで満タンに戻らない)。
// 数値の理由は STAMINA_UPDATE.md。
// 2026-10-30 夜 持ち主「もっとガンガンガチャ回せて育成できるように。行動力制限もっと減らして」: 上限 30 → 100。
// 2026-11-02 vc36 持ち主「やっぱりスタミナ制度をつけてください。課金が絶対されるような感じで」: 100 → 30(国内の3年ぶん)。
export const STAMINA_MAX=30;
// 2026-11-01 夜 持ち主「課金圧が強すぎて遊べなさすぎるのもあれなので、行動力要素いらないかも」: 行動力を使わない。
// 「1年進める」はいつでも押せる。待つ・広告・ポイントでの回復の欄も出さない。記録(端末の diamond-nine-stamina)は消さずに残し、
// 上限を超えて持っていた分と回復ドリンクは、一度だけポイントに替えて返す(settleStaminaRefund)。仕組みは戻せるよう残す。
// 2026-11-02 vc36: 戻した(上の持ち主の言葉)。数値と1日に進める年数の表は mobile/BALANCE_1101.md の vc36 の節。
// 2026-11-03 vc39 持ち主「やっぱり行動力要素要りません。その代わりに課金したら大きくポイントが増えるように」: もう一度やめた。
// 「1年進める」はいつでも押せる。札・回復ボタン・回復の画面・ドリンク・動画での回復は出さない。持っていた分は settleStaminaRefund で
// 一度だけポイントに替える(率は下と BALANCE_1101.md の vc39 の節)。
export const STAMINA_ENABLED=false;
// 2026-10-30 持ち主「課金圧が強すぎる」: 3分 → 2分で1回復(国内の1年は30分 → 20分で戻る)。
// 2026-10-30 夜: 2分 → 30秒で1回復(国内の1年は20分 → 5分で戻る)。
// 2026-11-02 vc36: 30秒 → 30分で1回復(国内の1年 = 5時間、満タン = 15時間、1日に48)。
export const STAMINA_REGEN_MS=30*60*1000;
// プレミアムパス: 上限を上げ、回復を速く。
// 2026-10-30 夜: 40 → 150。
// 2026-11-02 vc36: 150 → 45(国内の4年半ぶん)。
export const PASS_STAMINA_MAX=45;
// 2026-10-30: パスは 2分 → 1分(無料より速いまま)。
// 2026-10-30 夜: 1分 → 15秒(無料の倍の速さのまま)。
// 2026-11-02 vc36: 15秒 → 20分(無料の1.5倍の速さ。1日に72)。
export const PASS_STAMINA_REGEN_MS=20*60*1000;
// 回復で上限を超えて持てる量の天井(ドリンクを無駄にしないため超過は許す)。
// 2026-10-30 夜: 200 → 400(上限が大きくなったため)。
export const STAMINA_HARD_CAP=400;
// pt で回復: 上限ぶん足す(国内なら3シーズンぶん)。4,000pt(2026-10-19 経済の見直しで 3,000→4,000)。
// 3シーズンで入る自動のポイントより高くして、pt で行動力を買い続けると増える、を起こさない。
// 2026-11-02 vc36: 4,000 → 5,000(満タン＝国内の3年ぶん。3年で入る無課金のポイントより少し安い)。
// 2026-11-02 vc38: 5,000 → 10,000(3年ぶん。1年あたり約3,330pt)。5,000 だと、満タン回復で進めた3年に入るポイント(無課金で約12,000)が
// 値段の倍を超え、ポイントで回復し続けるほど増えた。1日の1回目だけ少し得、2回目からは損になる値段にした(BALANCE_1101.md vc38)。
export const STAMINA_PT_COST=10000;
// pt の回復で足す量はパスがあっても同じ。
// 2026-10-30 夜: ＋30 → ＋100(無料の上限ぶん)。行動力をほぼ縛らない方針にしたので、pt で買って増える形も許す。
export const STAMINA_PT_RESTORE=30;
// 配るドリンク1本で足す量。ログインで1本、今日の目標を全部で1本。
// 2026-10-30 夜: ＋10 → ＋30(国内の3年ぶん)。
// 2026-11-02 vc36: ＋30 → ＋10(国内の1年ぶん)。
export const DRINK_RESTORE=10;
// 広告1回で足す量と1日の回数(スカウトの広告とは別に数える)。
// 2026-10-30 夜: ＋10 → ＋30。
// 2026-11-02 vc36: ＋30 → ＋5(半年ぶん。「動画で少し回復」)。
export const STAMINA_AD_POINTS=5;
// 2026-10-30: 1日3回 → 5回。
// 2026-10-30 夜: 5回 → 10回。
// 2026-11-02 vc36: 10回 → 2回。
export const STAMINA_AD_DAILY_LIMIT=2;
// 段階(STAMINA_UPDATE.md)。
// 序盤: 5シーズン目まで行動力を使わない(選手を集める間は自由に)。2026-10-30 に 3 → 5。
// 2026-10-30 夜: 5 → 10。
// 2026-11-02 vc36: 10 → 3(はじめの3シーズンは行動力なしで遊んでもらう)。
export const FREE_SEASONS=3;
// 慣らし: 4シーズン目から、スカウトが10回に届くまでは国内の1年が半分(5)。
// 2026-11-02 vc36: 慣らしはやめた(0)。4シーズン目から国内は1年10。
export const WARMUP_PULLS=0;
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
 // ポイントで回復した回数(日付ごと。2026-11-01)。
 ptBuys?:{day:string;count:number};
 // ドリンク3本の組を買った回数(日付ごと。2026-11-02 vc38)。
 drinkBuys?:{day:string;count:number};
 // 行動力をやめた時の精算を済ませたか(2026-11-01)。
 refunded?:boolean;
 // vc36 で行動力を戻した時に満タンから始め直したか(2026-11-02)。
 restarted?:boolean;
 // vc39 で行動力をもう一度やめた時の精算を済ませたか(2026-11-03)。
 retired?:boolean;
}
const KEY='diamond-nine-stamina';
const okNum=(n:unknown,min=0):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=min;
export const freshStamina=(now:number,rules:StaminaRules=staminaRules(false)):StaminaRecord=>({v:1,points:rules.max,at:now,seen:now,drinks:0,gift:{day:'',login:false,all:false},restarted:true});
// 既存のセーブを持つ人(この記録が無い人)と壊れた記録は満タンから始める。
export function parseStamina(raw:string|null,now:number,rules:StaminaRules=staminaRules(false)):StaminaRecord{
 try{
  const v=raw?JSON.parse(raw):null;
  if(!v||v.v!==1||!okNum(v.points)||!okNum(v.at)||!okNum(v.seen)||!okNum(v.drinks))return freshStamina(now,rules);
  const g=v.gift&&typeof v.gift.day==='string'?{day:v.gift.day,login:!!v.gift.login,all:!!v.gift.all}:{day:'',login:false,all:false};
  const pb=v.ptBuys&&typeof v.ptBuys.day==='string'&&okNum(v.ptBuys.count)?{ptBuys:{day:v.ptBuys.day,count:Math.min(99,Math.floor(v.ptBuys.count))}}:{};
  const db=v.drinkBuys&&typeof v.drinkBuys.day==='string'&&okNum(v.drinkBuys.count)?{drinkBuys:{day:v.drinkBuys.day,count:Math.min(99,Math.floor(v.drinkBuys.count))}}:{};
  return {v:1,points:Math.min(STAMINA_HARD_CAP,Math.floor(v.points)),at:Math.min(v.at,v.seen),seen:v.seen,drinks:Math.min(99,Math.floor(v.drinks)),gift:g,...pb,...db,...(v.refunded===true?{refunded:true}:{}),...(v.restarted===true?{restarted:true}:{}),...(v.retired===true?{retired:true}:{})};
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
export const canBuyWithPoints=(r:StaminaRecord,gems:number,now:number,rules:StaminaRules)=>gems>=STAMINA_PT_COST&&settle(r,now,rules).points+STAMINA_PT_RESTORE<=STAMINA_HARD_CAP;

// ---- ポイントで回復(2026-11-01 持ち主「体力の回復をポイントで買えるように。良い感じのバランスで」) ----
// 2つから選ぶ: 「少し回復」＋30(国内の3年ぶん)と「満タンまで回復」(上限まで。無料なら最大＋100)。
// 値段: 少し 1,500pt(スカウト1回 3,000pt の半分)・満タン 4,000pt(スカウト1回より高い)。
// 1日に合わせて3回まで。同じ日の2回目は1.5倍、3回目は2倍(少し 1,500→2,250→3,000 / 満タン 4,000→6,000→8,000)。
// 理由は mobile/RELEASE-STATUS.md(2026-11-01)。日付は端末の日付(ログインボーナスと同じ数え方)。
export type StaminaPtOption='small'|'full';
// 2026-11-02 vc36: 少し 1,500pt で＋30 → 2,000pt で＋10(1年ぶん)、満タン 5,000pt(＋30)。
// 2026-11-02 vc38: 2,000 → 3,500(1年に入る無課金のポイント 約4,000 より少し安い)。
export const STAMINA_PT_SMALL_COST=3500;
export const STAMINA_PT_SMALL_RESTORE=10;
export const STAMINA_PT_FULL_COST=STAMINA_PT_COST;
export const STAMINA_PT_DAILY_LIMIT=3;
export const STAMINA_PT_STEP=[1,1.5,2] as const;
const ptBuysOn=(r:StaminaRecord,day:string)=>r.ptBuys&&r.ptBuys.day===day?r.ptBuys.count:0;
export const staminaPtBuysLeft=(r:StaminaRecord,day:string)=>Math.max(0,STAMINA_PT_DAILY_LIMIT-ptBuysOn(r,day));
export function staminaPtPrice(option:StaminaPtOption,r:StaminaRecord,day:string):number{
 const n=Math.min(STAMINA_PT_STEP.length-1,ptBuysOn(r,day)),base=option==='small'?STAMINA_PT_SMALL_COST:STAMINA_PT_FULL_COST;
 return Math.round(base*STAMINA_PT_STEP[n]/50)*50;
}
// 足す量: 少しは＋30、満タンは上限までの不足ぶん(上限以上なら0)。
export function staminaPtRestore(option:StaminaPtOption,r:StaminaRecord,now:number,rules:StaminaRules):number{
 const pts=settle(r,now,rules).points;
 return option==='small'?(pts+STAMINA_PT_SMALL_RESTORE<=STAMINA_HARD_CAP?STAMINA_PT_SMALL_RESTORE:0):Math.max(0,rules.max-pts);
}
export function canBuyStaminaOption(option:StaminaPtOption,r:StaminaRecord,gems:number,now:number,rules:StaminaRules,day:string){
 return staminaPtBuysLeft(r,day)>0&&staminaPtRestore(option,r,now,rules)>0&&gems>=staminaPtPrice(option,r,day);
}
// [次の記録, 使ったpt, 足した量]。買えない時は null。
export function buyStaminaOption(option:StaminaPtOption,r:StaminaRecord,gems:number,now:number,rules:StaminaRules,day:string):[StaminaRecord,number,number]|null{
 if(!canBuyStaminaOption(option,r,gems,now,rules,day))return null;
 const price=staminaPtPrice(option,r,day),amount=staminaPtRestore(option,r,now,rules);
 const next=addStamina(r,amount,now,rules);
 return [{...next,ptBuys:{day,count:ptBuysOn(r,day)+1}},price,amount];
}
// 回復ドリンクをポイントで買う(2026-11-02 vc36 持ち主「回復ドリンクの購入」)。3本 6,000pt(＋10×3)。
// 1日の回数の上限は無く、持っておいて好きな時に使える分、満タン回復(5,000pt で＋30)より少し高い。99本まで。
// 2026-11-02 vc38: 6,000 → 10,500(1本 3,500pt = 少し回復の1回目と同じ)・1日1組まで。6,000(1本2,000)だと、ドリンクで進めた1年に入る
// ポイント(約4,000)の方が多く、回数の上限も無いので、買っては進めるだけでポイントが増え続けた。
export const DRINK_SET_COUNT=3;
export const DRINK_SET_COST=10500;
export const DRINK_SET_DAILY_LIMIT=1;
const drinkBuysOn=(r:StaminaRecord,day:string)=>r.drinkBuys&&r.drinkBuys.day===day?r.drinkBuys.count:0;
// day を渡すと1日の回数(DRINK_SET_DAILY_LIMIT)も見る。
export const drinkSetBuysLeft=(r:StaminaRecord,day:string)=>Math.max(0,DRINK_SET_DAILY_LIMIT-drinkBuysOn(r,day));
export const canBuyDrinkSet=(r:StaminaRecord,gems:number,day?:string)=>gems>=DRINK_SET_COST&&r.drinks+DRINK_SET_COUNT<=99&&(day===undefined||drinkSetBuysLeft(r,day)>0);
export function buyDrinkSet(r:StaminaRecord,gems:number,day?:string):[StaminaRecord,number]|null{
 if(!canBuyDrinkSet(r,gems,day))return null;
 const next={...r,drinks:r.drinks+DRINK_SET_COUNT};
 return [day===undefined?next:{...next,drinkBuys:{day,count:drinkBuysOn(r,day)+1}},DRINK_SET_COST];
}
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
 if(!STAMINA_ENABLED)return 0;
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

// ---- 行動力をやめた時の精算(2026-11-01 vc34、2026-11-03 vc39 でもう一度) ----
// vc35 と同じ考え方: 無料の上限(30)を超えて持っていた分は、ポイント・動画・ドリンクで足した分なので返す。上限までの分は時間で戻った分なので返さない。
// 持っていた回復ドリンクも返す。率は vc38 の値段: 行動力1あたり 350pt(少し回復 3,500pt で＋10)、ドリンク1本 3,500pt(3本 10,500pt)。
// パスの人の上限(45)との差も「超えた分」に数える(遊ぶ人が損をしない側)。合わせて 500,000pt まで(400−30=370 と 99本でも 476,000)。
// vc34/vc35 で返し終わって、その後に行動力を使っていない人(refunded で restarted が無い)は、もう返す物が無いので0。
export const REFUND_PER_POINT=350,REFUND_PER_DRINK=3500,REFUND_CAP=500000;
export function staminaRefund(r:StaminaRecord):number{
 if(r.retired)return 0;
 if(r.refunded&&!r.restarted)return 0;
 const over=Math.max(0,r.points-STAMINA_MAX),drinks=Math.max(0,r.drinks);
 return Math.min(REFUND_CAP,over*REFUND_PER_POINT+drinks*REFUND_PER_DRINK);
}
// [次の記録, 返すpt]。返し終わったら retired(と refunded)を立て、超過とドリンクを0にする。
export function settleStaminaRefund(r:StaminaRecord):[StaminaRecord,number]{
 if(r.retired)return [r,0];
 const points=staminaRefund(r);
 return [{...r,points:Math.min(r.points,STAMINA_MAX),drinks:0,refunded:true,retired:true},points];
}
// ---- 行動力を戻した時(2026-11-02 vc36) ----
// 前の記録を持つ人は、一度だけ今の上限の満タンから始め直す。vc34/vc35 でポイントに替えて返した人(refunded)から
// ポイントは取り戻さない。返していない人が上限を超えて持っていた分(ポイント・広告・ドリンクで足した分)は減らさない。
// 回復ドリンクもそのまま。時刻は今から数え直す。
export function restartStamina(r:StaminaRecord,now:number,rules:StaminaRules):StaminaRecord{
 if(r.restarted)return r;
 const points=r.refunded?rules.max:Math.max(rules.max,Math.min(STAMINA_HARD_CAP,r.points));
 return {...r,points,at:now,seen:Math.max(now,r.seen),restarted:true};
}
export const hasStaminaRecord=()=>{try{return localStorage.getItem(KEY)!==null;}catch{return false;}};

// 段階が始まって初めて行動力を使う時の案内(1回だけ)。
const INTRO_KEY='diamond-nine-stamina-intro';
export const staminaIntroDue=(state:GameState)=>{if(seasonCost(state)<=0)return false;try{return localStorage.getItem(INTRO_KEY)!=='1';}catch{return false;}};
export const markStaminaIntro=()=>{try{localStorage.setItem(INTRO_KEY,'1');}catch{/* 次にまた出る */}};

// 回復の間隔の表示(30秒・15秒のように1分未満もある)。
export const regenLabel=(ms:number)=>ms%60000===0?`${ms/60000}分`:`${Math.round(ms/1000)}秒`;
export const formatWait=(ms:number)=>{
 const s=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
 return h?`${h}時間${String(m).padStart(2,'0')}分`:m?`${m}分${String(sec).padStart(2,'0')}秒`:`${sec}秒`;
};

// 画面上部の行動力の札を押した時: 試合の画面で回復の欄を開く(1回だけ受け取る)。
let recoverRequested=false;
// 受け取られないまま残らないよう(シーズン終了の画面など)、少しで取り消す
export const requestStaminaRecover=()=>{recoverRequested=true;emit();setTimeout(()=>{recoverRequested=false;},2000);};
export const takeStaminaRecoverRequest=()=>{const r=recoverRequested;recoverRequested=false;return r;};

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
