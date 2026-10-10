import {useState,type CSSProperties,type ReactNode} from 'react';
import {ChevronRight} from 'lucide-react';
import {playerMap,players,type Player} from '../data';
import {effectiveOverall,type GameState} from '../engine';
import {bestUpgrade} from '../career-roster';
import {MLB_GUARANTEE_EVERY,MLB_SCOUT_CHANCE,SCOUT_BATTER_SHARE,SCOUT_UPGRADE_CHANCE,SIMPLE_SCOUT_COST,mlbScoutCountdown} from '../simple-game';
import {scoutDuration,scoutPresentation,type ScoutTier} from '../scout-presentation';
import {mlbPlayers} from '../mlb-players';
import {DRAFT_EVENT,DRAFT_ROOKIE_CHANCE,draftEventActive,draftEventEndLabel,draftRookiePool} from '../draft-event';
import {ScoutShare} from '../ScoutShare';
import {scoutShareData} from '../share-kit';
import {isRookie} from '../development';
import {PawaCard,GradeRow,cardRatings} from './PawaCard';

const count=(n:number)=>n.toLocaleString('ja-JP');

/** Pack tap → card opens → the player arrives. Lengths follow scoutDuration(tier). */
export function PawaScoutCharge({tier,onSkip,title}:{tier:ScoutTier;onSkip?:()=>void;title?:string}){
 return <div className={'nv-charge nv-tier-'+tier} style={{'--nv-time':`${scoutDuration(tier,false)}ms`} as CSSProperties} role="status" aria-label="スカウト演出中">
  {title&&<h2 className="nv-charge-title">{title}</h2>}
  <div className="nv-charge-stage" aria-hidden="true">
   <span className="nv-rays"/>
   <img className="nv-charge-pack" src="/assets/pro/pawa/pack-scene.webp" alt=""/>
   <span className="nv-flash"/>
   <img className="nv-charge-back" src="/assets/pro/pawa/card-back.webp" alt=""/>
  </div>
  <p className="nv-charge-step"><span>パックを開封！</span><span>カードを開封！</span><span>選手が登場！</span></p>
  {onSkip&&<button className="nv-skip" onClick={onSkip}>SKIP ▶▶</button>}
 </div>;
}

export function PawaArrival({tier,overall,major,title}:{tier:ScoutTier;overall:number;major:boolean;title?:string}){
 return <div className={'nv-arrival nv-tier-'+tier}>
  <p>{title??(major?'海外選手を獲得！':'選手獲得！')}</p>
  <strong><small>総合</small>{overall}</strong>
  {tier!=='standard'&&<span>{tier==='rainbow'?'総合95以上の大当たり！':major?'海外選手が登場！':'総合85以上の当たり！'}</span>}
 </div>;
}

export function PawaScout({state,onDraw,onDrawMany,onEquip,drawing,hasDrawn,onSeason,onPlayer,onSkip,adSlot}:{state:GameState;onDraw:()=>void;onDrawMany?:(n:number)=>void;onEquip:(id:string)=>void;drawing:boolean;hasDrawn:boolean;onSeason:()=>void;onPlayer?:(p:Player)=>void;onSkip?:()=>void;adSlot?:ReactNode}){
 const [kept,setKept]=useState(-1);
 const pull=hasDrawn?state.lastPulls[0]:null,player=pull?playerMap[pull.playerId]:null;
 const upgrade=player?bestUpgrade(state,player.id):null,canDraw=state.gems>=SIMPLE_SCOUT_COST;
 const remaining=mlbScoutCountdown(state),major=!!player?.mlb&&!drawing;
 const {tier,overall}=scoutPresentation(player,state.owned,state.training);
 const draftWeek=draftEventActive(new Date());
 const equipped=player&&[...state.lineup,...state.pitchers].includes(player.id);
 const old=upgrade?playerMap[upgrade.oldId]:null;
 return <div className="nv-scout">
  {draftWeek&&<section className="nv-event" aria-label={DRAFT_EVENT.name}><span>期間限定 〜{draftEventEndLabel()}</span><h2>{DRAFT_EVENT.name} 開催中！</h2><p>国内選手のうち{Math.round(DRAFT_ROOKIE_CHANCE*100)}%がルーキー（昨年のドラフト指名{draftRookiePool.length}人）から登場。</p></section>}

  {drawing?<PawaScoutCharge tier={tier} onSkip={onSkip}/>:player&&pull?<section className={'nv-panel nv-result nv-tier-'+tier} aria-live="polite">
   <header><h2>スカウト結果</h2>{pull.isNew&&<span className="nv-new">NEW</span>}</header>
   <PawaArrival tier={tier} overall={overall} major={major}/>
   <div className="nv-result-main">
    <PawaCard player={player} state={state} size="l" onClick={()=>onPlayer?.(player)}/>
    <div className="nv-result-side"><b>{player.name}</b><small>{pull.isNew?'新しい選手が加入！':pull.copies<=6?'重複獲得で能力 ＋1（最大＋5）':'ポイント ＋80'}</small><GradeRow player={player} ratings={cardRatings(player,state)}/></div>
   </div>
   {upgrade&&old&&kept!==state.pulls?<div className="nv-compare">
    <h3>{upgrade.pitching?'今の投手':'今の'+(upgrade.index+1)+'番'}よりも強い選手です</h3>
    <div className="nv-compare-cards">
     <div><small>現在 · {upgrade.pitching?upgrade.position:`${upgrade.index+1}番 · ${upgrade.position}`}</small><PawaCard player={old} state={state} size="s" onClick={()=>onPlayer?.(old)}/><b>{old.name}</b><em>総合 {effectiveOverall(old,state.owned,state.training)}</em></div>
     <span aria-hidden="true">»</span>
     <div className="is-new"><small>今回の獲得選手</small><PawaCard player={player} state={state} size="s"/><b>{player.name}</b><em>総合 {overall}</em></div>
    </div>
    <button className="nv-gold nv-wide" onClick={()=>onEquip(player.id)}>この選手と入れ替える<ChevronRight size={18}/></button>
    <button className="nv-navy nv-wide" onClick={()=>setKept(state.pulls)}>保管する（あとで検討）</button>
    <small>※選手はチーム画面からも入れ替えできます。</small>
   </div>:<p className="nv-note">{equipped?'チームに編成済みです。':'控えに加入しました。チーム画面で起用できます。'}</p>}
   <ScoutShare key={'share-'+state.pulls} data={scoutShareData(player,state.owned,state.training,tier,pull.isNew,isRookie(player))}/>
  </section>:<section className="nv-scout-hero">
   <h1>スカウト</h1><p>新たな選手が、ここに集う。</p>
   <div className="nv-packs" aria-hidden="true"><img src="/assets/pro/pawa/pack-scene.webp" alt=""/><img src="/assets/pro/pawa/pack-scene.webp" alt=""/><img src="/assets/pro/pawa/pack-scene.webp" alt=""/></div>
   <p className="nv-hero-sub">国内・海外の選手カードを1枚獲得</p>
  </section>}

  <div className="nv-draws">
   <button className="nv-gold" disabled={!canDraw||drawing} onClick={onDraw}><b>{hasDrawn?'もう1人引く':'1人引く'}</b><span><img src="/assets/pro/pawa/coin.webp" alt=""/>{count(SIMPLE_SCOUT_COST)} pt</span></button>
  </div>
  <p className={'nv-balance '+(canDraw?'ok':'short')}>{canDraw?`所持 ${count(state.gems)} pt · あと${Math.floor(state.gems/SIMPLE_SCOUT_COST)}回引けます`:`所持 ${count(state.gems)} pt · あと${count(SIMPLE_SCOUT_COST-state.gems)} ptで引けます`}</p>
  {!canDraw&&<button className="nv-link" onClick={onSeason}>試合を進めてポイントを貯める<ChevronRight size={15}/></button>}
  {adSlot}

  <section className="nv-panel nv-guarantee"><img src="/assets/pro/pawa/emblem-overseas.webp" alt=""/><div><p>海外選手確定まで あと <b>{remaining}</b> 回</p><div className="nv-bar nv-bar-blue" role="progressbar" aria-label="海外選手確定までのスカウト進行" aria-valuemin={0} aria-valuemax={MLB_GUARANTEE_EVERY} aria-valuenow={MLB_GUARANTEE_EVERY-remaining}><i style={{width:(MLB_GUARANTEE_EVERY-remaining)/MLB_GUARANTEE_EVERY*100+'%'}}/></div><small>{MLB_GUARANTEE_EVERY-remaining} / {MLB_GUARANTEE_EVERY} · ポイントでのスカウトで進行・シーズンをまたいで引き継ぎ</small></div></section>

  <details className="nv-panel nv-odds"><summary>スカウト提供割合</summary>
   <ul><li><span>海外選手</span><b>{MLB_SCOUT_CHANCE*100}%</b></li><li><span>国内選手</span><b>{100-MLB_SCOUT_CHANCE*100}%</b></li><li className="is-hot"><span>補強チャンス<small>今の主力の平均より総合が高い選手だけから選ぶ（国内の抽選のうち）</small></span><b>{Math.round(SCOUT_UPGRADE_CHANCE*100)}%</b></li></ul>
   <p>国内リーグ {players.length-mlbPlayers.length}人／海外リーグ {mlbPlayers.length}人。1人 {count(SIMPLE_SCOUT_COST)} pt。国内リーグの抽選は、先に野手 {Math.round(SCOUT_BATTER_SHARE*100)}%・投手 {100-Math.round(SCOUT_BATTER_SHARE*100)}%で分け、そのうち{Math.round(SCOUT_UPGRADE_CHANCE*100)}%は「補強チャンス」として、今の主力の平均（野手は打線9人、投手は投手14人の総合の平均）より総合が高い選手だけから選びます（該当者がいないときは通常の抽選）。それぞれのグループ内は同じ確率です。{draftWeek&&`${DRAFT_EVENT.name}の期間中（〜${draftEventEndLabel()}）は、国内リーグの抽選のうち${Math.round(DRAFT_ROOKIE_CHANCE*100)}%をルーキー${draftRookiePool.length}人から、残り${100-Math.round(DRAFT_ROOKIE_CHANCE*100)}%を国内リーグ全員から同じ確率で選びます。`}30回ごとの確定時は未所持の海外選手から同じ確率で抽選し、全員所持の場合は海外選手全員が対象になります。</p>
   <p>すでに持っている選手を獲得した場合、その選手の能力が ＋1 上がります（最大 ＋5）。</p>
  </details>
 </div>;
}
