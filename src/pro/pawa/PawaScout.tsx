import {useState,type CSSProperties,type ReactNode} from 'react';
import {X} from 'lucide-react';
import {playerMap,players,type Player,type Ratings} from '../data';
import {effectiveOverall,type GameState} from '../engine';
import {bestUpgrade} from '../career-roster';
import {MLB_GUARANTEE_EVERY,MLB_SCOUT_CHANCE,SCOUT_BATTER_SHARE,SCOUT_UPGRADE_CHANCE,SIMPLE_SCOUT_COST,mlbScoutCountdown} from '../simple-game';
import {scoutDuration,scoutPresentation,type ScoutTier} from '../scout-presentation';
import {mlbPlayers} from '../mlb-players';
import {DRAFT_EVENT,DRAFT_ROOKIE_CHANCE,draftEventActive,draftEventEndLabel,draftRookiePool} from '../draft-event';
import {ScoutShare} from '../ScoutShare';
import {scoutShareData} from '../share-kit';
import {isRookie,ownedRatings,playerAge} from '../development';
import {aptitudeMark as aptitudeMarkOf} from './PawaTeam';
import {collectionProgress} from '../player-browser';
import {PawaCard,Rank,cardRatings} from './PawaCard';

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

/** 能力を横一列に(新しい選手の値と、入れ替え先の選手との差)。 */
export function AbilityRow({player,ratings,old,mode}:{player:Player;ratings:Ratings;old?:Ratings|null;mode:'batter'|'pitcher'}){
 const rows=(mode==='pitcher'?[['球速','velocity'],['制球','control'],['スタミナ','stamina'],['変化','breaking']]:[['ミート','contact'],['パワー','power'],['走力','speed'],['肩','arm'],['守備','field']]) as [string,keyof Ratings][];
 return <div className="pw-sc-abil">{rows.map(([label,key])=>{const v=ratings[key] as number,d=old?v-(old[key] as number):0;return <span key={key} className="pw-sc-cell"><small>{label}</small>{key==='velocity'?<b className="pw-sc-velo">{player.ratings.velocity}<em>km/h</em></b>:<Rank value={v} label={label} showValue/>}{old&&<i className={d>0?'up':d<0?'down':''}>{d>0?`+${d}`:d===0?'±0':d}</i>}</span>;})}</div>;
}

export function PawaScout({state,onDraw,onEquip,drawing,hasDrawn,onSeason,onPlayer,onSkip,adSlot}:{state:GameState;onDraw:()=>void;onDrawMany?:(n:number)=>void;onEquip:(id:string)=>void;drawing:boolean;hasDrawn:boolean;onSeason:()=>void;onPlayer?:(p:Player)=>void;onSkip?:()=>void;adSlot?:ReactNode}){
 const [kept,setKept]=useState(-1),[odds,setOdds]=useState(false);
 const pull=hasDrawn?state.lastPulls[0]:null,player=pull?playerMap[pull.playerId]:null;
 const upgrade=player?bestUpgrade(state,player.id):null,canDraw=state.gems>=SIMPLE_SCOUT_COST;
 const remaining=mlbScoutCountdown(state);
 const {tier,overall}=scoutPresentation(player,state.owned,state.training);
 const draftWeek=draftEventActive(new Date());
 const equipped=player&&[...state.lineup,...state.pitchers].includes(player.id);
 const old=upgrade&&kept!==state.pulls?playerMap[upgrade.oldId]:null;
 const showResult=!!player&&!!pull&&!drawing;
 const cards=players.filter(p=>!p.opponentOnly),progress=collectionProgress(cards,state.owned);
 const avg=(ids:string[])=>Math.round(ids.reduce((n,id)=>n+effectiveOverall(playerMap[id],state.owned,state.training),0)/Math.max(1,ids.length));
 const mode:'batter'|'pitcher'=upgrade?(upgrade.pitching?'pitcher':'batter'):player?.role==='pitcher'?'pitcher':'batter';
 const ratings=player?cardRatings(player,state):null,oldRatings=old?ownedRatings(old,state.owned,state.training):null;
 const age=player?playerAge(player):null,oldOverall=old?effectiveOverall(old,state.owned,state.training):0;
 return <div className="pw-scout pw-fit">
  <section className="pw-sc-strip" aria-label="チームとカードの集まり具合">
   <div><small>カード収集</small><b>{progress.collected}<em>/{progress.total}</em></b></div>
   <div><small>打線の総合</small><b>{avg(state.lineup)}</b></div>
   <div><small>投手陣の総合</small><b>{avg(state.pitchers)}</b></div>
   <div><small>海外確定まで</small><b>{remaining}<em>回</em></b></div>
  </section>
  {draftWeek&&<p className="pw-sc-event"><b>{DRAFT_EVENT.name}</b> 〜{draftEventEndLabel()} · 国内の{Math.round(DRAFT_ROOKIE_CHANCE*100)}%がルーキー</p>}

  <div className="pw-sc-stage">
  {drawing?<PawaScoutCharge tier={tier} onSkip={onSkip} player={player} state={state}/>:showResult&&ratings?<section className={'pw-sc-result pw-tier-'+tier} aria-live="polite">
   <div className="pw-sc-head">
    <button className="pw-sc-card" onClick={()=>onPlayer?.(player!)} aria-label={`${player!.name}の詳細`}><PawaCard player={player!} state={state} size="m"/></button>
    <div className="pw-sc-id">
     <p className="pw-sc-chips"><span className="pw-tierchip">{tier==='rainbow'?'虹カード':tier==='gold'?(player!.mlb?'海外・金':'金カード'):'カード'}</span><span className={pull!.isNew?'pw-newchip':'pw-dupchip'}>{pull!.isNew?'NEW':pull!.copies<=6?'重複 能力+1':'重複 +80pt'}</span></p>
     <h2>{player!.name}</h2>
     <p className="pw-sc-meta">{player!.role==='pitcher'?(['先','中','抑'] as const).map(r=>`${r==='先'?'先発':r==='中'?'中継':'抑え'}${aptitudeMarkOf(player!,r)}`).join(' '):player!.positions.join('・')||'DH'}{player!.mlb?' · 海外':''}{age!==null?` · ${age}歳`:''}</p>
     <p className="pw-sc-ovr"><small>総合</small><b>{overall}</b>{old&&<em className={overall>oldOverall?'up':''}>今の選手 {oldOverall}</em>}</p>
    </div>
   </div>
   <AbilityRow player={player!} ratings={ratings} old={oldRatings} mode={mode}/>
   {player!.mlb?.twoWay&&<AbilityRow player={player!} ratings={ratings} mode={mode==='pitcher'?'batter':'pitcher'}/>}
   {(()=>{const t=player!.traits.filter(x=>!['暫定査定','基本能力型','実戦派'].includes(x));return t.length>0&&<ul className="pw-bench-traits pw-sc-traits" aria-label="特殊能力">{t.slice(0,10).map((x,i)=><li key={x+i}>{x}</li>)}{t.length>10&&<li className="is-more">ほか{t.length-10}</li>}</ul>;})()}
   {old&&upgrade?<div className="pw-sc-swap"><p>今の<b>{upgrade.pitching?upgrade.position:`${upgrade.index+1}番(${upgrade.position})`}</b> {old.name}(総合{oldOverall})より強い</p><div><button className="pw-btn pw-white" onClick={()=>setKept(state.pulls)}>控えに置く</button><button className="pw-btn pw-yellow" onClick={()=>onEquip(player!.id)}>入れ替える</button></div></div>
   :<p className="pw-sc-note">{equipped?'チームに編成済みです。':'控えに加入しました。チーム画面で起用できます。'}</p>}
   <ScoutShare key={'share-'+state.pulls} data={scoutShareData(player!,state.owned,state.training,tier,pull!.isNew,isRookie(player!))}/>
  </section>:<section className="pw-sc-idle">
   <img src="/assets/pro/pawa/draw-card-back.webp" alt="" width={120} height={168}/>
   <div><h2>選手カードを1枚引く</h2><ul className="pw-tier-legend-list"><li data-tier="standard"><b>カード</b>ふつう</li><li data-tier="gold"><b>金カード</b>総合85以上・海外</li><li data-tier="rainbow"><b>虹カード</b>総合95以上</li></ul><p>国内{100-MLB_SCOUT_CHANCE*100}%・海外{MLB_SCOUT_CHANCE*100}%。補強チャンス{Math.round(SCOUT_UPGRADE_CHANCE*100)}%は今の主力より強い選手から。</p></div>
  </section>}
  </div>

  <section className="pw-sc-dock">
   <button className="pw-btn pw-yellow pw-draw-btn" disabled={!canDraw||drawing} onClick={onDraw}><span className="pw-ball" aria-hidden="true"/><span><b>{hasDrawn?'もう1枚引く':'1枚引く'}</b><em><i className="pw-p">P</i>{count(SIMPLE_SCOUT_COST)} pt</em></span></button>
   <div className="pw-sc-dockinfo"><p className={'pw-balance '+(canDraw?'ok':'short')}>所持 <b>{count(state.gems)}</b> pt<br/>{canDraw?`あと${Math.floor(state.gems/SIMPLE_SCOUT_COST)}回`:`あと${count(SIMPLE_SCOUT_COST-state.gems)}pt`}</p>{canDraw?<button className="pw-btn pw-white pw-mini" onClick={()=>setOdds(true)}>提供割合</button>:<button className="pw-btn pw-white pw-mini" onClick={onSeason}>試合へ</button>}</div>
  </section>
  {adSlot&&<div className="pw-sc-ad">{adSlot}</div>}

  {odds&&<div className="pw-modal pw-sheet-modal" onClick={()=>setOdds(false)}><div className="pw-sheet" role="dialog" aria-modal="true" aria-label="提供割合" onClick={e=>e.stopPropagation()}>
   <header className="pw-sheet-head"><h2>提供割合</h2><button className="pw-close" onClick={()=>setOdds(false)} aria-label="閉じる"><X size={22}/></button></header>
   <section className="pw-panel pw-odds"><ul><li className="is-world"><span><b>海外選手</b><small>30回ごとに未所持の海外選手が確定(あと{remaining}回 · {MLB_GUARANTEE_EVERY-remaining}/{MLB_GUARANTEE_EVERY})</small></span><em>{(MLB_SCOUT_CHANCE*100).toFixed(3)}%</em></li><li className="is-hot"><span><b>補強チャンス</b><small>国内の抽選のうち。今の主力の平均より総合が高い選手だけから選ぶ</small></span><em>{(SCOUT_UPGRADE_CHANCE*100).toFixed(3)}%</em></li><li><span><b>その他の国内選手</b><small>国内の抽選のうち</small></span><em>{(100-SCOUT_UPGRADE_CHANCE*100).toFixed(3)}%</em></li></ul>
   <p>国内リーグ {players.length-mlbPlayers.length}人／海外リーグ {mlbPlayers.length}人。1人 {count(SIMPLE_SCOUT_COST)} pt。通常は国内リーグ {100-MLB_SCOUT_CHANCE*100}%・海外リーグ {MLB_SCOUT_CHANCE*100}%です。国内リーグの抽選は、先に野手 {Math.round(SCOUT_BATTER_SHARE*100)}%・投手 {100-Math.round(SCOUT_BATTER_SHARE*100)}%で分け、そのうち{Math.round(SCOUT_UPGRADE_CHANCE*100)}%は「補強チャンス」として、今の主力の平均（野手は打線9人、投手は投手14人の総合の平均）より総合が高い選手だけから選びます（該当者がいないときは通常の抽選）。それぞれのグループ内は同じ確率です。{draftWeek&&`${DRAFT_EVENT.name}の期間中（〜${draftEventEndLabel()}）は、国内リーグの抽選のうち${Math.round(DRAFT_ROOKIE_CHANCE*100)}%をルーキー${draftRookiePool.length}人から、残り${100-Math.round(DRAFT_ROOKIE_CHANCE*100)}%を国内リーグ全員から同じ確率で選びます。`}30回ごとの確定時は未所持の海外選手から同じ確率で抽選し、全員所持の場合は海外選手全員が対象になります。同じ選手を獲得すると、その選手の能力が ＋1 上がります（最大 ＋5）。</p></section>
  </div></div>}
 </div>;
}
