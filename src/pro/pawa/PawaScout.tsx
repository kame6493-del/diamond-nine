import {useState,type CSSProperties,type ReactNode} from 'react';
import {ArrowDown,ArrowUp,ChevronRight} from 'lucide-react';
import {playerMap,players,type Player,type Ratings} from '../data';
import {effectiveOverall,type GameState} from '../engine';
import {bestUpgrade} from '../career-roster';
import {MLB_GUARANTEE_EVERY,MLB_SCOUT_CHANCE,SCOUT_BATTER_SHARE,SCOUT_UPGRADE_CHANCE,SIMPLE_SCOUT_COST,mlbScoutCountdown} from '../simple-game';
import {scoutDuration,scoutPresentation,type ScoutTier} from '../scout-presentation';
import {mlbPlayers} from '../mlb-players';
import {DRAFT_EVENT,DRAFT_ROOKIE_CHANCE,draftEventActive,draftEventEndLabel,draftRookiePool} from '../draft-event';
import {ScoutShare} from '../ScoutShare';
import {scoutShareData} from '../share-kit';
import {isRookie,ownedRatings} from '../development';
import {collectionProgress} from '../player-browser';
import {PawaCard,Rank,StatList,cardRatings} from './PawaCard';

const count=(n:number)=>n.toLocaleString('ja-JP');
const packOf=(tier:ScoutTier)=>`/assets/pro/pawa/pack-${tier==='standard'?'normal':tier}.webp`;

/** カードを1枚引く演出: 裏向きのカードが場に置かれ → 当たりほど縁が金・虹に光り揺れる → 68%の所でめくれて光が弾け、選手カードの表が出る。
 *  文字は出さない(画面のどこを押してもスキップ)。長さは scoutDuration(tier)、音は SimpleApp の drawSounds/revealSounds が同じ時刻で鳴らす。 */
export function PawaScoutCharge({tier,onSkip,player,state}:{tier:ScoutTier;onSkip?:()=>void;player?:Player|null;state?:GameState;title?:string}){
 return <div className={'pw-rv pw-tier-'+tier} style={{'--nv-time':`${scoutDuration(tier,false)}ms`} as CSSProperties} role="status" aria-label={tier==='rainbow'?'虹カードを引いています':tier==='gold'?'金カードを引いています':'カードを引いています'} onClick={onSkip}>
  <img className="pw-rv-bg" src="/assets/pro/pawa/draw-stage.webp" alt=""/>
  <span className="pw-rv-aura" aria-hidden="true"/>
  {tier!=='standard'&&<span className="pw-rv-sparks" aria-hidden="true">{Array.from({length:14},(_,i)=><i key={i} style={{'--i':i} as CSSProperties}/>)}</span>}
  <img className="pw-rv-burst" src="/assets/pro/pawa/draw-burst.webp" alt="" aria-hidden="true"/>
  <div className="pw-rv-card" aria-hidden="true"><div className="pw-rv-flip">
   <img className="pw-rv-back" src="/assets/pro/pawa/draw-card-back.webp" alt=""/>
   <div className="pw-rv-front">{player&&state&&<PawaCard player={player} state={state} size="l"/>}</div>
  </div></div>
  <span className="pw-rv-flash" aria-hidden="true"/>
  {onSkip&&<button className="pw-skip" onClick={e=>{e.stopPropagation();onSkip();}}>スキップ ▶▶</button>}
 </div>;
}

/** 結果の見出し: レア度の札と総合値だけ(「選手登場」のような文字は出さない)。 */
export function PawaArrival({tier,overall,major,isNew}:{tier:ScoutTier;overall:number;major:boolean;isNew?:boolean;title?:string}){
 return <div className={'pw-arrival pw-tier-'+tier}>
  <span className="pw-tierchip">{tier==='rainbow'?'虹カード':tier==='gold'?(major?'海外選手・金カード':'金カード'):'カード'}</span>
  {isNew!==undefined&&<span className={isNew?'pw-newchip':'pw-dupchip'}>{isNew?'NEW':'重複'}</span>}
  <strong><small>総合</small>{overall}</strong>
 </div>;
}

function Compare({player,old,state,pitching}:{player:Player;old:Player;state:GameState;pitching:boolean}){
 const a:Ratings=ownedRatings(player,state.owned,state.training),b:Ratings=ownedRatings(old,state.owned,state.training);
 const rows=(pitching?[['球速','velocity'],['制球','control'],['スタミナ','stamina'],['変化','breaking']]:[['ミート','contact'],['パワー','power'],['走力','speed'],['肩','arm'],['守備','field']]) as [string,keyof Ratings][];
 return <table className="pw-compare-table"><thead><tr><th>項目</th><th>新しい選手</th><th>現在の選手</th><th>差</th></tr></thead><tbody>{rows.map(([label,key])=>{const x=a[key] as number,y=b[key] as number,d=x-y;return <tr key={key}><th>{label}</th><td>{key==='velocity'?`${x}km/h`:<Rank value={x} showValue/>}</td><td>{key==='velocity'?`${y}km/h`:<Rank value={y} showValue/>}</td><td className={d>0?'up':d<0?'down':''}>{d>0?<ArrowUp size={14}/>:d<0?<ArrowDown size={14}/>:null}{d>0?`+${d}`:d}</td></tr>;})}</tbody></table>;
}

export function PawaScout({state,onDraw,onEquip,drawing,hasDrawn,onSeason,onPlayer,onSkip,adSlot}:{state:GameState;onDraw:()=>void;onDrawMany?:(n:number)=>void;onEquip:(id:string)=>void;drawing:boolean;hasDrawn:boolean;onSeason:()=>void;onPlayer?:(p:Player)=>void;onSkip?:()=>void;adSlot?:ReactNode}){
 const [kept,setKept]=useState(-1),[odds,setOdds]=useState(false);
 const pull=hasDrawn?state.lastPulls[0]:null,player=pull?playerMap[pull.playerId]:null;
 const upgrade=player?bestUpgrade(state,player.id):null,canDraw=state.gems>=SIMPLE_SCOUT_COST;
 const remaining=mlbScoutCountdown(state),major=!!player?.mlb&&!drawing;
 const {tier,overall}=scoutPresentation(player,state.owned,state.training);
 const draftWeek=draftEventActive(new Date());
 const equipped=player&&[...state.lineup,...state.pitchers].includes(player.id);
 const old=upgrade?playerMap[upgrade.oldId]:null;
 const showResult=!!player&&!!pull&&!drawing;
 const cards=players.filter(p=>!p.opponentOnly),progress=collectionProgress(cards,state.owned);
 const avg=(ids:string[])=>Math.round(ids.reduce((n,id)=>n+effectiveOverall(playerMap[id],state.owned,state.training),0)/Math.max(1,ids.length));
 const collection=<section className="pw-panel pw-collect" aria-label="カードの集まり具合"><div className="pw-collect-top"><b>カード収集</b><span><strong>{progress.collected}</strong> / {progress.total} 枚</span></div><div className="pw-bar pw-bar-green" role="progressbar" aria-label="カード収集" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.collected}><i style={{width:`${progress.collected/progress.total*100}%`}}/></div><div className="pw-collect-team"><span>打線の総合 <b>{avg(state.lineup)}</b></span><span>投手陣の総合 <b>{avg(state.pitchers)}</b></span></div></section>;
 return <div className="pw-scout">
  {draftWeek&&<section className="pw-event" aria-label={DRAFT_EVENT.name}><span>期間限定 〜{draftEventEndLabel()}</span><h2>{DRAFT_EVENT.name} 開催中！</h2><p>国内選手のうち{Math.round(DRAFT_ROOKIE_CHANCE*100)}%がルーキー（昨年のドラフト指名{draftRookiePool.length}人）から登場。</p></section>}

  {drawing?<PawaScoutCharge tier={tier} onSkip={onSkip} player={player} state={state}/>:showResult?<section className={'pw-panel pw-result pw-tier-'+tier} aria-live="polite">
   <PawaArrival tier={tier} overall={overall} major={major} isNew={pull!.isNew}/>
   <div className="pw-result-main">
    <PawaCard player={player!} state={state} size="l" onClick={()=>onPlayer?.(player!)}/>
    <div className="pw-result-side"><b>{player!.name}</b><small>{pull!.isNew?'新しい選手が加入！':pull!.copies<=6?'重複獲得で能力 ＋1（最大＋5）':'ポイント ＋80'}</small></div>
   </div>
   <StatList player={player!} ratings={cardRatings(player!,state)}/>
   {player!.mlb?.twoWay&&<StatList player={player!} ratings={cardRatings(player!,state)} mode="batter"/>}
   {upgrade&&old&&kept!==state.pulls?<div className="pw-compare">
    <h3>今の{upgrade.pitching?upgrade.position:`${upgrade.index+1}番(${upgrade.position})`}より強い選手です</h3>
    <div className="pw-compare-cards">
     <div className="is-new"><small>スカウトで獲得した選手</small><PawaCard player={player!} state={state} size="s"/><b>{player!.name}</b><em>総合 {overall}</em></div>
     <span aria-hidden="true">⇄</span>
     <div><small>現在の主力選手</small><PawaCard player={old} state={state} size="s" onClick={()=>onPlayer?.(old)}/><b>{old.name}</b><em>総合 {effectiveOverall(old,state.owned,state.training)}</em></div>
    </div>
    <h4>主な能力の比較</h4>
    <Compare player={player!} old={old} state={state} pitching={upgrade.pitching}/>
    <div className="pw-compare-actions"><button className="pw-btn pw-gray" onClick={()=>setKept(state.pulls)}>控えに置く</button><button className="pw-btn pw-yellow" onClick={()=>onEquip(player!.id)}>この選手と入れ替える</button></div>
   </div>:<p className="pw-note">{equipped?'チームに編成済みです。':'控えに加入しました。チーム画面で起用できます。'}</p>}
   <ScoutShare key={'share-'+state.pulls} data={scoutShareData(player!,state.owned,state.training,tier,pull!.isNew,isRookie(player!))}/>
  </section>:<section className="pw-panel pw-scout-top">
   <div className="pw-banner"><img src="/assets/pro/pawa/emblem-overseas.webp" alt=""/><div><b>選手スカウト</b><span>国内・海外の選手カードを1枚獲得</span><em>海外選手 出現率 {MLB_SCOUT_CHANCE*100}%！</em></div></div>
   <div className="pw-tier-legend"><img src="/assets/pro/pawa/draw-card-back.webp" alt="" width={70} height={98}/><ul><li data-tier="standard"><b>カード</b><span>ふつうの当たり</span></li><li data-tier="gold"><b>金カード</b><span>総合85以上・海外選手</span></li><li data-tier="rainbow"><b>虹カード</b><span>総合95以上</span></li></ul></div>
  </section>}

  {!drawing&&!showResult&&collection}
  <section className="pw-panel pw-draw pw-draw-dock">
   <button className="pw-btn pw-yellow pw-draw-btn" disabled={!canDraw||drawing} onClick={onDraw}><span className="pw-ball" aria-hidden="true"/><span><b>{hasDrawn?'もう1人スカウト':'1人スカウト'}</b><em><i className="pw-p">P</i>{count(SIMPLE_SCOUT_COST)} pt</em></span></button>
   <p className={'pw-balance '+(canDraw?'ok':'short')}>所持 <b>{count(state.gems)} pt</b> · {canDraw?`あと${Math.floor(state.gems/SIMPLE_SCOUT_COST)}回引けます`:`あと${count(SIMPLE_SCOUT_COST-state.gems)} ptで引けます`}</p>
   {!canDraw&&<button className="pw-link" onClick={onSeason}>試合を進めてポイントを貯める<ChevronRight size={16}/></button>}
  </section>
  {adSlot}

  <section className="pw-panel pw-guarantee"><img src="/assets/pro/pawa/emblem-overseas.webp" alt=""/><div><p>海外選手確定まで あと <b>{remaining}</b> 回</p><div className="pw-bar" role="progressbar" aria-label="海外選手確定までのスカウト進行" aria-valuemin={0} aria-valuemax={MLB_GUARANTEE_EVERY} aria-valuenow={MLB_GUARANTEE_EVERY-remaining}><i style={{width:(MLB_GUARANTEE_EVERY-remaining)/MLB_GUARANTEE_EVERY*100+'%'}}/></div><small>{MLB_GUARANTEE_EVERY-remaining} / {MLB_GUARANTEE_EVERY} · シーズンをまたいで引き継ぎ</small></div></section>

  <section className="pw-panel pw-odds"><header><h2>提供割合</h2><button className="pw-btn pw-white pw-mini" onClick={()=>setOdds(v=>!v)} aria-expanded={odds}>{odds?'閉じる':'くわしく'}</button></header>
   <ul><li className="is-world"><span><b>海外選手</b><small>30回ごとに未所持の海外選手が確定</small></span><em>{(MLB_SCOUT_CHANCE*100).toFixed(3)}%</em></li><li className="is-hot"><span><b>補強チャンス</b><small>国内の抽選のうち。今の主力の平均より総合が高い選手だけから選ぶ</small></span><em>{(SCOUT_UPGRADE_CHANCE*100).toFixed(3)}%</em></li><li><span><b>その他の国内選手</b><small>国内の抽選のうち</small></span><em>{(100-SCOUT_UPGRADE_CHANCE*100).toFixed(3)}%</em></li></ul>
   {odds&&<p>国内リーグ {players.length-mlbPlayers.length}人／海外リーグ {mlbPlayers.length}人。1人 {count(SIMPLE_SCOUT_COST)} pt。通常は国内リーグ {100-MLB_SCOUT_CHANCE*100}%・海外リーグ {MLB_SCOUT_CHANCE*100}%です。国内リーグの抽選は、先に野手 {Math.round(SCOUT_BATTER_SHARE*100)}%・投手 {100-Math.round(SCOUT_BATTER_SHARE*100)}%で分け、そのうち{Math.round(SCOUT_UPGRADE_CHANCE*100)}%は「補強チャンス」として、今の主力の平均（野手は打線9人、投手は投手14人の総合の平均）より総合が高い選手だけから選びます（該当者がいないときは通常の抽選）。それぞれのグループ内は同じ確率です。{draftWeek&&`${DRAFT_EVENT.name}の期間中（〜${draftEventEndLabel()}）は、国内リーグの抽選のうち${Math.round(DRAFT_ROOKIE_CHANCE*100)}%をルーキー${draftRookiePool.length}人から、残り${100-Math.round(DRAFT_ROOKIE_CHANCE*100)}%を国内リーグ全員から同じ確率で選びます。`}30回ごとの確定時は未所持の海外選手から同じ確率で抽選し、全員所持の場合は海外選手全員が対象になります。同じ選手を獲得すると、その選手の能力が ＋1 上がります（最大 ＋5）。</p>}
  </section>
 </div>;
}
