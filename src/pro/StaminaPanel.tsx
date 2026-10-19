import {useState} from 'react';
import {Clock,CupSoda,Coins,Crown,PlayCircle,Play,Zap,Bell} from 'lucide-react';
import type {GameState} from './engine';
import {monetizeBridge,useMonetize} from './monetization';
import {
 DRINK_RESTORE,PASS_STAMINA_MAX,PASS_STAMINA_REGEN_MS,STAMINA_AD_POINTS,STAMINA_HARD_CAP,STAMINA_PT_COST,
 affordableGames,costForGames,formatWait,freeGamesLeft,gamesLeft,useStamina,type StaminaView,
} from './stamina';
import './stamina.css';

const count=(n:number)=>n.toLocaleString('ja-JP');

// 画面上部の小さな行動力の表示。押すと試合の画面へ。
export function StaminaChip({onOpen}:{onOpen:()=>void}){
 const v=useStamina();
 return <button type="button" className={'st-chip'+(v.points<=0?' is-empty':'')} onClick={onOpen} aria-label={`行動力 ${v.points} / ${v.max}${v.full?'':`、次の回復まで ${formatWait(v.nextInMs)}`}`}>
  <Zap size={15} aria-hidden="true"/><b>{v.points}</b><small>/{v.max}</small>
 </button>;
}

export interface StaminaActions {
 onPlay:(games:number)=>void;
 // pt で回復。成功したら true。
 onBuy:()=>boolean;
 onDrink:()=>boolean;
 // 広告(アプリ版のみ)。広告が閉じるまで操作を止めるため、開始と終了を知らせる。
 onAdStart:()=>void;
 onAdReward:(amount:number)=>void;
 onAdEnd:()=>void;
}

// view: テストで行動力の値を固定するため(画面では使わない)。
export function StaminaPlay({state,busy,pawa,actions,view}:{state:GameState;busy:boolean;pawa:boolean;actions:StaminaActions;view?:StaminaView}){
 const live=useStamina(),v=view??live,m=useMonetize();
 const [open,setOpen]=useState(false),[confirm,setConfirm]=useState(false),[note,setNote]=useState('');
 const left=gamesLeft(state),free=freeGamesLeft(state),can=affordableGames(state,v.points);
 const cost=costForGames(state,can),oneCost=costForGames(state,1);
 const primary=pawa?'pw-btn pw-yellow':'s-primary',secondary=pawa?'pw-btn pw-white':'s-button';
 const empty=can<=0,showRecover=empty||open;
 const pass=!!m?.premium.owned;
 const adInfo=m?.staminaReward,adLeft=adInfo?.left??0,adReady=!!m&&!!adInfo&&!!monetizeBridge()?.showStaminaAd;
 const [adBusy,setAdBusy]=useState(false);
 const watchAd=async()=>{
  const bridge=monetizeBridge();if(!bridge?.showStaminaAd||busy||adBusy||adLeft<=0)return;
  setNote('');setAdBusy(true);actions.onAdStart();
  try{
   const r=await bridge.showStaminaAd(a=>actions.onAdReward(a));
   setNote(r==='rewarded'?`行動力 ＋${STAMINA_AD_POINTS}`:r==='dismissed'?'最後まで見ると回復します。':r==='limit'?'今日の広告の回復は終わりました。':r==='failed'?'広告を読み込めませんでした。時間をおいてお試しください。':'');
  }finally{setAdBusy(false);actions.onAdEnd();}
 };
 const buy=()=>{if(!confirm){setConfirm(true);return;}setConfirm(false);setNote(actions.onBuy()?`${count(STAMINA_PT_COST)} pt で行動力 ＋${v.max}`:'回復できませんでした。');};
 const drink=()=>{setNote(actions.onDrink()?`回復ドリンクで行動力 ＋${DRINK_RESTORE}`:'回復できませんでした。');};
 const [notifyNote,setNotifyNote]=useState('');
 const askNotify=()=>{void (typeof window!=="undefined"?window.diamondReminder:undefined)?.ask().then(ok=>setNotifyNote(ok?'満タンになったらお知らせします。':'通知が許可されませんでした。端末の設定から変えられます。'));};
 const ptOk=state.gems>=STAMINA_PT_COST&&v.points+v.max<=STAMINA_HARD_CAP;

 return <div className={'st-play'+(pawa?' is-pawa':'')}>
  <div className="st-meter" role="group" aria-label="行動力">
   <span className="st-meter-label"><Zap size={16} aria-hidden="true"/>行動力</span>
   <div className="st-bar" role="progressbar" aria-valuenow={v.points} aria-valuemin={0} aria-valuemax={v.max}><i style={{width:`${Math.min(100,v.points/v.max*100)}%`}}/></div>
   <b className="st-num">{v.points}<small>/{v.max}</small></b>
   <span className="st-time">{v.full?(v.points>v.max?'上限を超えて回復中':'満タン'):<>次の回復 <b>{formatWait(v.nextInMs)}</b> · 満タンまで {formatWait(v.fullInMs)}</>}</span>
  </div>
  {free>0&&<p className="st-free">開幕から{free}試合は行動力なしで進められます（はじめのシーズンだけ）</p>}
  {busy?null:!empty?<div className="st-buttons">
   <button type="button" className={primary+' st-go'} disabled={busy} onClick={()=>actions.onPlay(can)}>
    <span><Play size={16} fill="currentColor" aria-hidden="true"/>{can>=left?`シーズン最後まで ${can}試合`:`${can}試合 進める`}</span>
    <small>{cost?`行動力 −${cost}`:'行動力を使わない'}{can<left&&` · 残り${left}試合`}</small>
   </button>
   {can>1&&<button type="button" className={secondary+' st-one'} disabled={busy} onClick={()=>actions.onPlay(1)}><span>1試合</span><small>{oneCost?'−1':'0'}</small></button>}
   <button type="button" className={secondary+' st-open'} aria-expanded={open} onClick={()=>setOpen(o=>!o)}><span>回復</span><small>{v.drinks?`ドリンク${v.drinks}`:'ほか'}</small></button>
  </div>:<p className="st-empty" role="status"><b>行動力が足りません。</b>あと {formatWait(v.nextInMs)} で1試合ぶん回復します。下の3つから選べます。</p>}
  {showRecover&&!busy&&<div className="st-recover" aria-label="行動力の回復">
   <div className="st-opt">
    <span className="st-opt-icon"><Clock size={18}/></span>
    <div><b>待つ（無料）</b><small>{v.full?'いまは満タンです':<>{Math.round(v.regenMs/60000)}分で1回復 · 満タンまで {formatWait(v.fullInMs)}</>}</small>{notifyNote&&<small role="status">{notifyNote}</small>}</div>
    {typeof window!=="undefined"&&window.diamondReminder&&!v.full&&<button type="button" className={secondary} onClick={askNotify}><Bell size={15}/>満タンで通知</button>}
   </div>
   <div className="st-opt">
    <span className="st-opt-icon"><PlayCircle size={18}/></span>
    <div><b>広告を見る</b><small>{adReady?`1回 ＋${STAMINA_AD_POINTS} · 今日あと ${adLeft} / ${adInfo!.limit} 回`:'アプリ版で使えます'}</small></div>
    <button type="button" className={secondary} disabled={!adReady||adLeft<=0||adBusy||busy} onClick={()=>void watchAd()}>{adBusy?'読み込み中…':adLeft<=0&&adReady?'今日は終了':`＋${STAMINA_AD_POINTS}`}</button>
   </div>
   <div className="st-opt">
    <span className="st-opt-icon"><Coins size={18}/></span>
    <div><b>ポイントで回復</b><small>{count(STAMINA_PT_COST)} pt で ＋{v.max}（所持 {count(state.gems)} pt）</small></div>
    {confirm?<span className="st-confirm"><button type="button" className={primary} disabled={!ptOk} onClick={buy}>使う</button><button type="button" className={secondary} onClick={()=>setConfirm(false)}>やめる</button></span>
    :<button type="button" className={secondary} disabled={!ptOk||busy} onClick={buy}>{state.gems<STAMINA_PT_COST?'pt が足りない':`＋${v.max}`}</button>}
   </div>
   {v.drinks>0&&<div className="st-opt">
    <span className="st-opt-icon"><CupSoda size={18}/></span>
    <div><b>回復ドリンク</b><small>1本 ＋{DRINK_RESTORE} · 所持 {v.drinks}本（ログインと今日の目標でもらえます）</small></div>
    <button type="button" className={secondary} disabled={busy||v.points+DRINK_RESTORE>STAMINA_HARD_CAP} onClick={drink}>使う</button>
   </div>}
   {m&&!pass&&<p className="st-pass"><Crown size={14}/>プレミアムパスで上限 {PASS_STAMINA_MAX}・{Math.round(PASS_STAMINA_REGEN_MS/60000)}分ごとに回復（設定から）</p>}
   {note&&<p className="st-note" role="status">{note}</p>}
  </div>}
  {!showRecover&&note&&<p className="st-note" role="status">{note}</p>}
 </div>;
}
