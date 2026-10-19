import {useEffect,useRef,useState} from 'react';
import {Clock,Coins,Crown,PlayCircle,Play,Bell} from 'lucide-react';
import type {GameState} from './engine';
import {monetizeBridge,useMonetize} from './monetization';
import {
 DRINK_RESTORE,PASS_STAMINA_MAX,PASS_STAMINA_REGEN_MS,STAMINA_AD_POINTS,STAMINA_HARD_CAP,STAMINA_PT_COST,
 FREE_SEASONS,affordableGames,costForGames,formatWait,freeSeasonsLeft,gamesLeft,seasonCost,staminaStage,useStamina,type StaminaView,
} from './stamina';
import './stamina.css';

const count=(n:number)=>n.toLocaleString('ja-JP');
const season=(left:number)=>`残り${left}試合をまとめて`;
// 絵は ChatGPT イメージで作った物(2026-10-19、背景透過)。public/assets/pro/stamina/
const ART='/assets/pro/stamina/';
const Bolt=({size}:{size:number})=><img className="st-bolt" src={ART+'stamina-bolt.webp'} alt="" width={size} height={size} aria-hidden="true"/>;

// 画面上部の小さな行動力の表示。押すと試合の画面へ。
export function StaminaChip({onOpen}:{onOpen:()=>void}){
 const v=useStamina();
 return <button type="button" className={'st-chip'+(v.points<=0?' is-empty':'')} onClick={onOpen} aria-label={`行動力 ${v.points} / ${v.max}${v.full?'':`、次の回復まで ${formatWait(v.nextInMs)}`}`}>
  <Bolt size={20}/><b>{v.points}</b><small>/{v.max}</small>
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
 const left=gamesLeft(state),stage=staminaStage(state),yearCost=seasonCost(state),restCost=costForGames(state,left);
 const can=affordableGames(state,v.points),partCost=costForGames(state,can),oneCost=costForGames(state,1);
 const enough=v.points>=restCost;
 // 1年ぶんがたまるまでの時間
 const needMs=enough?0:v.nextInMs+Math.max(0,restCost-v.points-1)*v.regenMs;
 const primary=pawa?'pw-btn pw-yellow':'s-primary',secondary=pawa?'pw-btn pw-white':'s-button';
 const empty=!enough,showRecover=empty||open;
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
 // 回復した時はきらめき、満タンになった時はバッジを一度だけ動かす。
 const prev=useRef(v.points),[burst,setBurst]=useState(0),[fullPop,setFullPop]=useState(0);
 useEffect(()=>{
  if(v.points>prev.current){setBurst(b=>b+1);if(v.points>=v.max&&prev.current<v.max)setFullPop(f=>f+1);}
  prev.current=v.points;
 },[v.points,v.max]);

 return <div className={'st-play'+(pawa?' is-pawa':'')}>
  <div className="st-meter" role="group" aria-label="行動力">
   <span className="st-meter-label"><Bolt size={28}/>行動力</span>
   <div className="st-bar" style={{['--st-frame' as string]:`url(${ART}stamina-frame.webp)`}} role="progressbar" aria-valuenow={v.points} aria-valuemin={0} aria-valuemax={v.max}><span className="st-track"><i style={{width:`${Math.min(100,v.points/v.max*100)}%`}}/></span>{burst>0&&<img key={burst} className="st-burst" src={ART+'stamina-sparkle.webp'} alt="" aria-hidden="true"/>}</div>
   <b className="st-num">{v.points}<small>/{v.max}</small></b>
   <span className="st-time">{v.full?(v.points>v.max?'上限を超えて回復中':<span className="st-full"><img key={fullPop} className={fullPop?'is-pop':''} src={ART+'stamina-full.webp'} alt="" aria-hidden="true"/>満タン</span>):<>次の回復 <b>{formatWait(v.nextInMs)}</b> · 満タンまで {formatWait(v.fullInMs)}</>}</span>
  </div>
  {stage==='free'?<p className="st-free">{FREE_SEASONS}シーズン目までは行動力を使いません（あと{freeSeasonsLeft(state)}シーズン）</p>
  :<p className="st-rule">1年進める ＝ 行動力 <b>{yearCost}</b>{stage==='warmup'?'（スカウト10回までは半分）':stage==='late'?'（上のリーグ）':''}</p>}
  {busy?null:<>{empty&&<div className="st-empty" role="status"><img src={ART+'stamina-tired.webp'} alt="" aria-hidden="true" width={300} height={251}/><p><b>行動力が足りません。</b>あと {formatWait(needMs)} で残りの1年ぶん（{restCost}）がたまります。下の3つから選べます。</p></div>}
  <div className="st-buttons">
   <button type="button" className={primary+' st-go'} disabled={busy||!enough} onClick={()=>actions.onPlay(left)}>
    <span><Play size={16} fill="currentColor" aria-hidden="true"/>1年進める</span>
    <small>{restCost?`行動力 −${restCost}`:'行動力を使わない'} · {season(left)}</small>
   </button>
   <button type="button" className={secondary+' st-one'} disabled={busy||oneCost>v.points} onClick={()=>actions.onPlay(1)}><span>1試合</span><small>{oneCost?`−${oneCost}`:'0'}</small></button>
   <button type="button" className={secondary+' st-open'} aria-expanded={open} onClick={()=>setOpen(o=>!o)}><span>回復</span><small>{v.drinks?<><img className="st-mini-drink" src={ART+'stamina-drink.webp'} alt="" aria-hidden="true"/>×{v.drinks}</>:'ほか'}</small></button>
  </div>
  {empty&&can>0&&<button type="button" className={secondary+' st-part'} onClick={()=>actions.onPlay(can)}>今の行動力で進められる所まで（{can}試合・−{partCost}）</button>}</>}
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
    <span className="st-opt-icon is-art"><img src={ART+'stamina-drink.webp'} alt="" aria-hidden="true" width={67} height={96}/></span>
    <div><b>回復ドリンク</b><small>1本 ＋{DRINK_RESTORE} · 所持 {v.drinks}本（ログインと今日の目標でもらえます）</small></div>
    <button type="button" className={secondary} disabled={busy||v.points+DRINK_RESTORE>STAMINA_HARD_CAP} onClick={drink}>使う</button>
   </div>}
   {m&&!pass&&<p className="st-pass"><Crown size={14}/>プレミアムパスで上限 {PASS_STAMINA_MAX}・{Math.round(PASS_STAMINA_REGEN_MS/60000)}分ごとに回復（設定から）</p>}
   {note&&<p className="st-note" role="status">{note}</p>}
  </div>}
  {!showRecover&&note&&<p className="st-note" role="status">{note}</p>}
 </div>;
}
