import {useEffect,useRef,useState} from 'react';
import {Clock,Coins,PlayCircle,Play,Bell} from 'lucide-react';
import type {GameState} from './engine';
import {localDay,monetizeBridge,useMonetize} from './monetization';
import {PackShop} from './PackShop';
import {firstPack,readOncePacks} from './point-products';
import {
 DRINK_RESTORE,STAMINA_AD_POINTS,STAMINA_HARD_CAP,STAMINA_PT_DAILY_LIMIT,STAMINA_PT_SMALL_RESTORE,STAMINA_PT_FULL_COST,DRINK_SET_COUNT,DRINK_SET_COST,canBuyDrinkSet,regenLabel,
 FREE_SEASONS,STAMINA_ENABLED,canBuyStaminaOption,costToFinish,currentRules,formatWait,freeSeasonsLeft,gamesLeft,loadStamina,seasonCost,staminaPtBuysLeft,staminaPtPrice,staminaPtRestore,staminaStage,
 requestStaminaRecover,takeStaminaRecoverRequest,useStamina,type StaminaPtOption,type StaminaView,
} from './stamina';
import './stamina.css';

const count=(n:number)=>n.toLocaleString('ja-JP');
const season=(left:number)=>`${left}試合をまとめて`;
// 絵は ChatGPT イメージで作った物(2026-10-19、背景透過)。public/assets/pro/stamina/
const ART='/assets/pro/stamina/';
const Bolt=({size}:{size:number})=><img className="st-bolt" src={ART+'stamina-bolt.webp'} alt="" width={size} height={size} aria-hidden="true"/>;

// 画面上部の小さな行動力の表示。押すと試合の画面へ。
export function StaminaChip({onOpen}:{onOpen:()=>void}){
 if(!STAMINA_ENABLED)return null;
 return <StaminaChipLive onOpen={onOpen}/>;
}
function StaminaChipLive({onOpen}:{onOpen:()=>void}){
 const v=useStamina();
 // 2026-11-01: 押すと試合の画面で回復の欄(待つ・広告・ポイント・ドリンク)が開く
 return <button type="button" className={'st-chip'+(v.points<=0?' is-empty':'')} onClick={()=>{requestStaminaRecover();onOpen();}} aria-label={`行動力 ${v.points} / ${v.max}${v.full?'':`、次の回復まで ${formatWait(v.nextInMs)}`}`}>
  <Bolt size={20}/><b>{v.points}</b><small>/{v.max}</small>
 </button>;
}

export interface StaminaActions {
 onPlay:()=>void;
 // pt で回復(少し/満タン)。成功したら [使ったpt, 足した量]、できなければ null。
 onBuy:(option:StaminaPtOption)=>[number,number]|null;
 onDrink:()=>boolean;
 // 回復ドリンク3本をポイントで買う(vc36)。
 onBuyDrinks?:()=>boolean;
 // 広告(アプリ版のみ)。広告が閉じるまで操作を止めるため、開始と終了を知らせる。
 onAdStart:()=>void;
 onAdReward:(amount:number)=>void;
 onAdEnd:()=>void;
}

// view: テストで行動力の値を固定するため(画面では使わない)。
// 2026-11-01: 行動力を使わない間は「1年進める」だけを出す。
export function StaminaPlay(props:{state:GameState;busy:boolean;pawa:boolean;actions:StaminaActions;view?:StaminaView}){
 if(STAMINA_ENABLED)return <StaminaPlayLive {...props}/>;
 const {state,busy,pawa,actions}=props,left=gamesLeft(state);
 return <div className={'st-play is-plain'+(pawa?' is-pawa':'')}><div className="st-buttons">
  <button type="button" className={(pawa?'pw-btn pw-yellow':'s-primary')+' st-go'} disabled={busy} onClick={()=>actions.onPlay()}>
   <span><Play size={16} fill="currentColor" aria-hidden="true"/>1年進める</span>
   <small>{season(left)}</small>
  </button>
 </div></div>;
}
function StaminaPlayLive({state,busy,pawa,actions,view}:{state:GameState;busy:boolean;pawa:boolean;actions:StaminaActions;view?:StaminaView}){
 const live=useStamina(),v=view??live,m=useMonetize();
 const [open,setOpen]=useState(false),[confirm,setConfirm]=useState<StaminaPtOption|'drinks'|null>(null),[note,setNote]=useState(''),[shop,setShop]=useState(false);
 // 上部の行動力の札から来た時は回復の欄を開いておく
 useEffect(()=>{if(takeStaminaRecoverRequest())setOpen(true);});
 const left=gamesLeft(state),stage=staminaStage(state),yearCost=seasonCost(state),restCost=costToFinish(state);
 const enough=v.points>=restCost;
 // 1年ぶんがたまるまでの時間
 const needMs=enough?0:v.nextInMs+Math.max(0,restCost-v.points-1)*v.regenMs;
 const primary=pawa?'pw-btn pw-yellow':'s-primary',secondary=pawa?'pw-btn pw-white':'s-button';
 const empty=!enough,showRecover=empty||open;
 const adInfo=m?.staminaReward,adLeft=adInfo?.left??0,adReady=!!m&&!!adInfo&&!!monetizeBridge()?.showStaminaAd;
 const [adBusy,setAdBusy]=useState(false);
 const watchAd=async()=>{
  const bridge=monetizeBridge();if(!bridge?.showStaminaAd||busy||adBusy||adLeft<=0)return;
  setNote('');setAdBusy(true);actions.onAdStart();
  try{
   const r=await bridge.showStaminaAd(a=>actions.onAdReward(a));
   setNote(r==='rewarded'?`行動力 ＋${STAMINA_AD_POINTS}`:r==='dismissed'?'最後まで見ると回復します。':r==='limit'?'今日の広告の回復は終わりました。':r==='failed'?'広告を読み込めませんでした。少し待ってから、もう一度押してください。':r==='busy'?'ほかの広告を表示中です。閉じてからもう一度押してください。':'');
  }finally{setAdBusy(false);actions.onAdEnd();}
 };
 // ポイントの回復: 値段は同じ日の回数で上がる(stamina.ts)。押すと確かめる画面を出す
 const rec=loadStamina(),now=Date.now(),rules=currentRules(),day=localDay();
 const ptLeft=staminaPtBuysLeft(rec,day);
 const opt=(o:StaminaPtOption)=>({price:staminaPtPrice(o,rec,day),amount:staminaPtRestore(o,rec,now,rules),ok:canBuyStaminaOption(o,rec,state.gems,now,rules,day)});
 const small=opt('small'),fullOpt=opt('full');
 const buy=()=>{if(!confirm)return;const o=confirm;setConfirm(null);if(o==='drinks'){setNote(actions.onBuyDrinks?.()?`回復ドリンク ＋${DRINK_SET_COUNT}本`:'買えませんでした。');return;}const r=actions.onBuy(o);setNote(r?`${count(r[0])} pt で行動力 ＋${r[1]}`:'回復できませんでした。');};
 const ptShort=ptLeft>0&&state.gems<Math.min(small.price,fullOpt.price);
 const canShop=!!monetizeBridge(),firstOpen=canShop&&!!m?.packs?.prices[firstPack.id]&&!readOncePacks().includes(firstPack.id);
 const drink=()=>{setNote(actions.onDrink()?`回復ドリンクで行動力 ＋${DRINK_RESTORE}`:'回復できませんでした。');};
 const [notifyNote,setNotifyNote]=useState('');
 const askNotify=()=>{void (typeof window!=="undefined"?window.diamondReminder:undefined)?.ask().then(ok=>setNotifyNote(ok?'満タンになったらお知らせします。':'通知が許可されませんでした。端末の設定から変えられます。'));};
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
  {busy?null:<>{empty&&<div className="st-empty" role="status"><img src={ART+'stamina-tired.webp'} alt="" aria-hidden="true" width={300} height={251}/><p><b>行動力が足りません。</b>あと {formatWait(needMs)} で1年ぶん（{restCost}）がたまります。下の回復から選べます。{ptShort&&canShop&&<>ポイントが足りない時は <button type="button" className="st-shop-link" onClick={()=>setShop(true)}>ポイント購入</button> もできます。</>}</p></div>}
  <div className="st-buttons">
   <button type="button" className={primary+' st-go'} disabled={busy||!enough} onClick={()=>actions.onPlay()}>
    <span><Play size={16} fill="currentColor" aria-hidden="true"/>1年進める</span>
    <small>{restCost?`行動力 −${restCost}`:'行動力を使わない'} · {season(left)}</small>
   </button>
   <button type="button" className={secondary+' st-open'} aria-expanded={open} onClick={()=>setOpen(o=>!o)}><span>回復</span><small>{v.drinks?<><img className="st-mini-drink" src={ART+'stamina-drink.webp'} alt="" aria-hidden="true"/>×{v.drinks}</>:'ほか'}</small></button>
  </div></>}
  {showRecover&&!busy&&<div className="st-recover" aria-label="行動力の回復">
   <div className="st-opt">
    <span className="st-opt-icon"><Clock size={18}/></span>
    <div><b>待つ（無料）</b><small>{v.full?'いまは満タンです':<>{regenLabel(v.regenMs)}で1回復 · 満タンまで {formatWait(v.fullInMs)}</>}</small>{notifyNote&&<small role="status">{notifyNote}</small>}</div>
    {typeof window!=="undefined"&&window.diamondReminder&&!v.full&&<button type="button" className={secondary} onClick={askNotify}><Bell size={15}/>満タンで通知</button>}
   </div>
   <div className="st-opt">
    <span className="st-opt-icon"><PlayCircle size={18}/></span>
    <div><b>広告を見る</b><small>{adReady?`1回 ＋${STAMINA_AD_POINTS} · 今日あと ${adLeft} / ${adInfo!.limit} 回`:'アプリ版で使えます'}</small></div>
    <button type="button" className={secondary} disabled={!adReady||adLeft<=0||adBusy||busy} onClick={()=>void watchAd()}>{adBusy?'読み込み中…':adLeft<=0&&adReady?'今日は終了':`＋${STAMINA_AD_POINTS}`}</button>
   </div>
   {([['small','少し回復',small],['full','満タンまで回復',fullOpt]] as const).map(([o,label,x])=><div className="st-opt" key={o}>
    <span className="st-opt-icon"><Coins size={18}/></span>
    <div><b>ポイントで{label}</b><small>{count(x.price)} pt で ＋{x.amount||(o==='full'?0:STAMINA_PT_SMALL_RESTORE)}{o==='full'&&x.amount<=0?'（いまは満タン）':''} · 今日あと {ptLeft} / {STAMINA_PT_DAILY_LIMIT} 回</small></div>
    <button type="button" className={secondary} disabled={!x.ok||busy} onClick={()=>{setNote('');setConfirm(o);}}>{ptLeft<=0?'今日は終了':x.amount<=0?'満タン':state.gems<x.price?'pt が足りない':`＋${x.amount}`}</button>
   </div>)}
   {ptLeft>0&&<p className="st-pt-rule">同じ日の2回目は1.5倍・3回目は2倍の値段です（日付が変わると元に戻ります）。所持 {count(state.gems)} pt</p>}
   {v.drinks>0&&<div className="st-opt">
    <span className="st-opt-icon is-art"><img src={ART+'stamina-drink.webp'} alt="" aria-hidden="true" width={67} height={96}/></span>
    <div><b>回復ドリンク</b><small>1本 ＋{DRINK_RESTORE} · 所持 {v.drinks}本（ログインで1日1本もらえます）</small></div>
    <button type="button" className={secondary} disabled={busy||v.points+DRINK_RESTORE>STAMINA_HARD_CAP} onClick={drink}>使う</button>
   </div>}
   {actions.onBuyDrinks&&<div className="st-opt">
    <span className="st-opt-icon is-art"><img src={ART+'stamina-drink.webp'} alt="" aria-hidden="true" width={67} height={96}/></span>
    <div><b>回復ドリンクを買う</b><small>{DRINK_SET_COUNT}本（1本 ＋{DRINK_RESTORE}）{count(DRINK_SET_COST)} pt · 回数の上限なし・とっておける</small></div>
    <button type="button" className={secondary} disabled={busy||!canBuyDrinkSet(rec,state.gems)} onClick={()=>{setNote('');setConfirm('drinks');}}>{state.gems<DRINK_SET_COST?'pt が足りない':`${DRINK_SET_COUNT}本`}</button>
   </div>}
   {canShop&&<div className="st-opt">
    <span className="st-opt-icon"><Coins size={18}/></span>
    <div><b>ポイントを買う</b><small>{firstOpen?`はじめての購入だけ ¥${count(firstPack.priceYen)} で ${count(firstPack.points)} pt（満タン回復 ${Math.floor(firstPack.points/STAMINA_PT_FULL_COST)}回分 または スカウト${firstPack.points/3000}回分）`:`¥480 で 10,000 pt から。満タン回復（${count(STAMINA_PT_FULL_COST)} pt）にもスカウトにも使えます`}</small></div>
    <button type="button" className={secondary} disabled={busy} onClick={()=>setShop(true)}>見る</button>
   </div>}
   {/* 2026-10-30: 回復の欄のプレミアムパスの案内はやめた(パスはメニューから) */}
   {note&&<p className="st-note" role="status">{note}</p>}
  </div>}
  {!showRecover&&note&&<p className="st-note" role="status">{note}</p>}
  {confirm==='drinks'&&<div className="st-modal" onClick={()=>setConfirm(null)}><div className="st-dialog" role="dialog" aria-modal="true" aria-label="回復ドリンクを買う" onClick={e=>e.stopPropagation()}>
   <h3>回復ドリンクを{DRINK_SET_COUNT}本買いますか？</h3>
   <p className="st-dialog-main"><Bolt size={22}/>所持 {v.drinks}本 → <b>{v.drinks+DRINK_SET_COUNT}本</b>（1本 ＋{DRINK_RESTORE}）</p>
   <p>使うポイント <b>{count(DRINK_SET_COST)} pt</b>（所持 {count(state.gems)} → {count(Math.max(0,state.gems-DRINK_SET_COST))} pt）</p>
   <p className="st-dialog-sub">使ったポイントは戻せません。</p>
   <div className="st-dialog-acts"><button type="button" className={secondary} onClick={()=>setConfirm(null)}>やめる</button><button type="button" className={primary} disabled={!canBuyDrinkSet(rec,state.gems)} onClick={buy}>買う</button></div>
  </div></div>}
  {confirm&&confirm!=='drinks'&&(()=>{const x=confirm==='small'?small:fullOpt;return <div className="st-modal" onClick={()=>setConfirm(null)}><div className="st-dialog" role="dialog" aria-modal="true" aria-label="ポイントで回復" onClick={e=>e.stopPropagation()}>
   <h3>ポイントで行動力を回復しますか？</h3>
   <p className="st-dialog-main"><Bolt size={22}/>行動力 {v.points} → <b>{v.points+x.amount}</b></p>
   <p>使うポイント <b>{count(x.price)} pt</b>（所持 {count(state.gems)} → {count(Math.max(0,state.gems-x.price))} pt）</p>
   <p className="st-dialog-sub">今日あと {ptLeft} 回。使ったポイントは戻せません。</p>
   <div className="st-dialog-acts"><button type="button" className={secondary} onClick={()=>setConfirm(null)}>やめる</button><button type="button" className={primary} disabled={!x.ok} onClick={buy}>回復する</button></div>
  </div></div>;})()}
  {shop&&<div className="st-modal" onClick={()=>setShop(false)}><div className="st-dialog st-shop" role="dialog" aria-modal="true" aria-label="ポイント購入" onClick={e=>e.stopPropagation()}>
   <h3>ポイント購入</h3><PackShop/>
   <button type="button" className={secondary+' st-shop-close'} onClick={()=>setShop(false)}>閉じる</button>
  </div></div>}
 </div>;
}
