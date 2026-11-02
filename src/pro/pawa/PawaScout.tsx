import {useState,type CSSProperties,type ReactNode} from 'react';
import {X} from 'lucide-react';
import {playerMap,players,type Player,type Ratings} from '../data';
import {effectiveOverall,type GameState} from '../engine';
import {bestUpgrade} from '../career-roster';
import {MLB_GUARANTEE_EVERY,MLB_SCOUT_CHANCE,SIMPLE_SCOUT_COST,mlbScoutCountdown,scoutOdds} from '../simple-game';
import {scoutDuration,scoutPresentation,type ScoutTier} from '../scout-presentation';
import {mlbPlayers} from '../mlb-players';
import {DRAFT_EVENT,DRAFT_ROOKIE_CHANCE,draftEventActive,draftEventEndLabel,draftRookiePool} from '../draft-event';
import {ScoutShare} from '../ScoutShare';
import {scoutShareData} from '../share-kit';
import {isRookie,ownedRatings,playerAge} from '../development';
import {aptitudeMark as aptitudeMarkOf,AptMark} from './PawaTeam';
import {fitsPosition} from '../data';
import {pitcherRolePenalty,pitcherSlotRole} from '../pitcher-aptitude';
import {collectionProgress} from '../player-browser';
import {PawaCard,Rank,cardRatings,fitName} from './PawaCard';
import {useMonetize} from '../monetization';
import {PackShop} from '../PackShop';

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

export function PawaScout({state,onDraw,onEquip,drawing,hasDrawn,onSeason,onPlayer,onSkip,adSlot}:{state:GameState;onDraw:()=>void;onEquip:(id:string)=>void;drawing:boolean;hasDrawn:boolean;onSeason:()=>void;onPlayer?:(p:Player)=>void;onSkip?:()=>void;adSlot?:ReactNode}){
 const [kept,setKept]=useState(-1),[odds,setOdds]=useState(false),[shop,setShop]=useState(false);
 // 2026-10-30 持ち主「課金圧が強すぎる」: 待ち受けの大きなパックの帯とプレミアムパスの案内をやめた。購入は下の「ポイント購入」とメニューから。
 const money=useMonetize();
 const pull=hasDrawn?state.lastPulls[0]:null,player=pull?playerMap[pull.playerId]:null;
 const upgrade=player?bestUpgrade(state,player.id):null,canDraw=state.gems>=SIMPLE_SCOUT_COST;
 const remaining=mlbScoutCountdown(state);
 const {tier,overall}=scoutPresentation(player,state.owned,state.training);
 const draftWeek=draftEventActive(new Date());
 // 提供割合は抽選と同じ計算(scoutOdds)から。次の1回の確率
 const rates=scoutOdds(state,new Date()),pct=(x:number)=>`${(x*100).toFixed(3)}%`;
 const equipped=player&&[...state.lineup,...state.pitchers].includes(player.id);
 const old=upgrade&&kept!==state.pulls?playerMap[upgrade.oldId]:null;
 const showResult=!!player&&!!pull&&!drawing;
 const cards=players.filter(p=>!p.opponentOnly),progress=collectionProgress(cards,state.owned);
 const avg=(ids:string[])=>Math.round(ids.reduce((n,id)=>n+effectiveOverall(playerMap[id],state.owned,state.training,state.careerGrowth),0)/Math.max(1,ids.length));
 const mode:'batter'|'pitcher'=upgrade?(upgrade.pitching?'pitcher':'batter'):player?.role==='pitcher'?'pitcher':'batter';
 const ratings=player?cardRatings(player,state):null,oldRatings=old?ownedRatings(old,state.owned,state.training,state.careerGrowth):null;
 const age=player?playerAge(player):null,oldOverall=old?effectiveOverall(old,state.owned,state.training,state.careerGrowth):0;
 // 入れ替え候補が無いとき(今の選手の方が強い等)も、同じ守備位置・役割で一番総合が低い今の選手と並べて見せる
 const rival=(()=>{if(!player||upgrade||equipped)return null;const ov=(id:string)=>effectiveOverall(playerMap[id],state.owned,state.training,state.careerGrowth);
  const pit=player.role==='pitcher',list=pit?state.pitchers.map((id,i)=>({id,i})).filter(x=>pitcherRolePenalty(player,pitcherSlotRole(x.i))===0):state.lineup.map((id,i)=>({id,i})).filter(x=>fitsPosition(player,state.defense[x.id]));
  const pick=[...list].sort((a,b)=>ov(a.id)-ov(b.id))[0];if(!pick)return null;
  const label=pit?(pick.i<6?`先発${pick.i+1}`:pick.i===13?'抑え':`中継ぎ${pick.i-5}`):`${pick.i+1}番(${state.defense[pick.id]})`;
  return {p:playerMap[pick.id],label,overall:ov(pick.id),ratings:ownedRatings(playerMap[pick.id],state.owned,state.training,state.careerGrowth)};})();
 const cmp=old&&upgrade&&oldRatings?{p:old,label:upgrade.pitching?(upgrade.index<6?`先発${upgrade.index+1}`:upgrade.index===13?'抑え':`中継ぎ${upgrade.index-5}`):`${upgrade.index+1}番(${upgrade.position})`,overall:oldOverall,ratings:oldRatings}:rival;
 return <div className="pw-scout pw-fit">
  <section className="pw-sc-strip" aria-label="チームとカードの集まり具合">
   <div><small>カード収集</small><b>{progress.collected}<em>/{progress.total}</em></b></div>
   <div><small>打線の総合</small><b>{avg(state.lineup)}</b></div>
   <div><small>投手陣の総合</small><b>{avg(state.pitchers)}</b></div>
   <div><small>海外確定まで</small><b>{remaining}<em>回</em></b></div>
  </section>
  {draftWeek&&<p className="pw-sc-event"><b>{DRAFT_EVENT.name}</b> 〜{draftEventEndLabel()} · 国内の{Math.round(DRAFT_ROOKIE_CHANCE*100)}%がルーキー</p>}

  <div className="pw-sc-stage">
  {drawing?<PawaScoutCharge tier={tier} onSkip={onSkip} player={player} state={state}/>:showResult&&ratings?<section className={'pw-sc-result pw-tier-'+tier+(cmp?' has-cmp':'')} aria-live="polite">
   <div className="pw-sc-head">
    <button className="pw-sc-card" onClick={()=>onPlayer?.(player!)} aria-label={`${player!.name}の詳細`}><PawaCard player={player!} state={state} size="m"/></button>
    <div className="pw-sc-id">
     <p className="pw-sc-chips"><span className="pw-tierchip">{tier==='rainbow'?'虹カード':tier==='gold'?(player!.mlb?'海外・金':'金カード'):'カード'}</span><span className={pull!.isNew?'pw-newchip':'pw-dupchip'}>{pull!.isNew?'NEW':pull!.copies<=6?'重複 能力+1':'重複 +80pt'}</span></p>
     <h2>{player!.name}</h2>
     <p className="pw-sc-meta">{player!.role==='pitcher'?(['先','中','抑'] as const).map(r=>`${r==='先'?'先発':r==='中'?'中継':'抑え'}${aptitudeMarkOf(player!,r)}`).join(' '):player!.positions.join('・')||'DH'}{player!.mlb?' · 海外':''}{age!==null?` · ${age}歳`:''}</p>
     <p className="pw-sc-ovr"><small>総合</small><b>{overall}</b>{old&&<em className={overall>oldOverall?'up':''}>今の選手 {oldOverall}</em>}</p>
    </div>
   </div>
   {!cmp&&<AbilityRow player={player!} ratings={ratings} mode={mode}/>}
   {player!.mlb?.twoWay&&<AbilityRow player={player!} ratings={ratings} mode={mode==='pitcher'?'batter':'pitcher'}/>}
   {cmp?<div className={'pw-cmp'+(old?'':' is-info')}>
    <p className="pw-cmp-q">{old?<>今の<b>{cmp.label}</b>より強い選手です。入れ替えますか？</>:<>今の<b>{cmp.label}</b>と比べると</>}</p>
    <table className="pw-cmp-table"><thead><tr><th></th><th className="is-new">{player!.name}<small>総合 {overall}</small></th><th><button data-player-id={cmp.p.id} onClick={()=>onPlayer?.(cmp.p)}>{cmp.p.name}</button><small>総合 {cmp.overall}</small></th><th>差</th></tr></thead>
     <tbody>{((mode==='pitcher'?[['球速','velocity'],['制球','control'],['スタミナ','stamina'],['変化','breaking']]:[['ミート','contact'],['パワー','power'],['走力','speed'],['肩','arm'],['守備','field']]) as [string,keyof Ratings][]).map(([label,key])=>{const x=key==='velocity'?player!.ratings.velocity:ratings[key] as number,y=key==='velocity'?cmp.p.ratings.velocity:cmp.ratings[key] as number,d=x-y;return <tr key={key}><th>{label}</th><td className="is-new">{key==='velocity'?<b className="pw-cmp-velo">{x}<em>km/h</em></b>:<Rank value={x} label={label} showValue/>}</td><td>{key==='velocity'?<b className="pw-cmp-velo">{y}<em>km/h</em></b>:<Rank value={y} label={label} showValue/>}</td><td className={d>0?'up':d<0?'down':''}>{d>0?`▲${d}`:d===0?'±0':`▼${-d}`}</td></tr>;})}
     {mode==='pitcher'&&(()=>{const roles=['先','中','抑'] as const,target=roles.find(r=>cmp.label.startsWith(r))??null,score=(m:string)=>m==='◎'?3:m==='○'?2:m==='△'?1:0;
      const cell=(q:Player)=><span className="pw-cmp-apt">{roles.map(r=><span key={r} className={r===target?'is-target':''}><small>{r}</small><AptMark mark={aptitudeMarkOf(q,r)}/></span>)}</span>;
      const d=target?score(aptitudeMarkOf(player!,target))-score(aptitudeMarkOf(cmp.p,target)):0;
      return <tr className="pw-cmp-aptrow"><th>適性{target&&<small>{target==='先'?'先発':target==='中'?'中継ぎ':'抑え'}枠</small>}</th><td className="is-new">{cell(player!)}</td><td>{cell(cmp.p)}</td><td className={d>0?'up':d<0?'down':''}>{!target?'':d>0?'▲':d<0?'▼':'＝'}</td></tr>;})()}
    </tbody></table>
    {old?null
    :<p className="pw-sc-note">{overall>cmp.overall?'総合は上ですが、守備位置の補正を入れると今の選手の方が上です。':'今の選手の方が総合が上です。'}控えに加入しました(チーム画面で起用できます)。</p>}
   </div>
   :<p className="pw-sc-note">{equipped?'チームに編成済みです。':'控えに加入しました。チーム画面で起用できます。'}</p>}
   {(()=>{const t=player!.traits.filter(x=>!['暫定査定','基本能力型','実戦派'].includes(x));return t.length>0&&<ul className="pw-bench-traits pw-sc-traits" aria-label="特殊能力">{t.slice(0,10).map((x,i)=><li key={x+i}>{x}</li>)}{t.length>10&&<li className="is-more">ほか{t.length-10}</li>}</ul>;})()}
   <ScoutShare key={'share-'+state.pulls} data={scoutShareData(player!,state.owned,state.training,tier,pull!.isNew,isRookie(player!))}/>
  </section>:<section className="pw-sc-idle pw-sc-idle2">
   <div className="pw-sc-idle-top"><img src="/assets/pro/pawa/draw-card-back.webp" alt="" width={120} height={168}/>
   <div><h2>選手カードを1枚引く</h2><ul className="pw-tier-legend-list"><li data-tier="standard"><b>カード</b>ふつう</li><li data-tier="gold"><b>金カード</b>総合85以上・海外</li><li data-tier="rainbow"><b>虹カード</b>総合95以上</li></ul><p>国内{100-MLB_SCOUT_CHANCE*100}%・海外{MLB_SCOUT_CHANCE*100}%。国内の選手は全員同じ確率です。</p></div></div>
   <ul className="pw-sc-odds" aria-label="提供割合のあらまし"><li><b>国内</b>{100-MLB_SCOUT_CHANCE*100}%</li><li><b>海外</b>{MLB_SCOUT_CHANCE*100}%</li><li><b>海外確定まで</b>あと{remaining}回</li></ul>
   <div className="pw-sc-weak"><h3>補強したい所<small>総合が低い順</small></h3><div>{([['打線',state.lineup.map((id,i)=>({id,tag:`${i+1}番 ${state.defense[id]}`}))],['投手陣',state.pitchers.map((id,i)=>({id,tag:i<6?`先発${i+1}`:i===13?'抑え':`中継ぎ${i-5}`}))]] as const).map(([title,list])=><ul key={title} aria-label={title}><li className="pw-sc-weak-h">{title}</li>{[...list].map(x=>({...x,o:effectiveOverall(playerMap[x.id],state.owned,state.training,state.careerGrowth)})).sort((a,b)=>a.o-b.o).slice(0,3).map(x=><li key={x.id}><small>{x.tag}</small><button style={fitName(playerMap[x.id].name,92,13)} data-player-id={x.id} onClick={()=>onPlayer?.(playerMap[x.id])}>{playerMap[x.id].name}</button><b>{x.o}</b></li>)}</ul>)}</div></div>
  </section>}
  </div>

  <section className={'pw-sc-dock'+(showResult&&old?' is-swap':'')}>
   {/* 2026-11-01 入れ替えのボタンは下の欄に固定(上の場をスクロールしなくても押せる) */}
   {showResult&&old&&<div className="pw-cmp-acts pw-sc-swapbar" role="group" aria-label={`${player!.name}と今の${cmp?.label??'選手'}の入れ替え`}><button className="pw-btn pw-white" onClick={()=>setKept(state.pulls)}>控えに置く</button><button className="pw-btn pw-yellow" onClick={()=>onEquip(player!.id)}>この選手と入れ替える</button></div>}
   <button className="pw-btn pw-yellow pw-draw-btn" disabled={!canDraw||drawing} onClick={onDraw}><span className="pw-ball" aria-hidden="true"/><span><b>{hasDrawn?'もう1枚':'1枚引く'}</b><em><i className="pw-p">P</i>{count(SIMPLE_SCOUT_COST)} pt</em></span></button>
   {money?adSlot&&<div className="pw-sc-adbtn">{adSlot}</div>:<div className="pw-sc-adbtn"><div className="reward-ad"><button type="button" className="s-button reward-ad-button" disabled>広告を見て1回引く<small>アプリ版で使えます</small></button></div></div>}
   <div className="pw-sc-dockinfo"><p className={'pw-balance '+(canDraw?'ok':'short')}>所持 <b>{count(state.gems)}</b> pt<br/><span>{canDraw?`あと${count(Math.floor(state.gems/SIMPLE_SCOUT_COST))}回`:`あと${count(SIMPLE_SCOUT_COST-state.gems)}pt`}</span></p><div className="pw-sc-dockacts"><button className="pw-btn pw-white pw-mini pw-buy-mini" onClick={()=>setShop(true)}>ポイント購入</button>{canDraw?<button className="pw-btn pw-white pw-mini" onClick={()=>setOdds(true)}>提供割合</button>:<button className="pw-btn pw-white pw-mini" onClick={onSeason}>試合へ</button>}</div></div>
   {!canDraw&&!drawing&&!!money&&money.reward.left>0&&<p className="reward-ad-short" role="note">ポイントが足りない時は「広告を見て1回引く」で、動画を最後まで見ると1回引けます（今日あと {money.reward.left} 回）</p>}
  </section>

  {shop&&<div className="pw-modal pw-sheet-modal" onClick={()=>setShop(false)}><div className="pw-sheet pw-shop-sheet" role="dialog" aria-modal="true" aria-label="ポイント購入" onClick={e=>e.stopPropagation()}>
   <header className="pw-sheet-head"><h2>ポイント購入</h2><button className="pw-close" onClick={()=>setShop(false)} aria-label="閉じる"><X size={22}/></button></header>
   <PackShop/>
   <button type="button" className="pw-btn pw-white pw-sheet-close" onClick={()=>setShop(false)}>閉じる</button>
  </div></div>}
  {odds&&<div className="pw-modal pw-sheet-modal" onClick={()=>setOdds(false)}><div className="pw-sheet" role="dialog" aria-modal="true" aria-label="提供割合" onClick={e=>e.stopPropagation()}>
   <header className="pw-sheet-head"><h2>提供割合</h2><button className="pw-close" onClick={()=>setOdds(false)} aria-label="閉じる"><X size={22}/></button></header>
   <section className="pw-panel pw-odds"><ul><li className="is-world"><span><b>海外選手</b><small>30回ごとに未所持の海外選手が確定(あと{remaining}回 · {MLB_GUARANTEE_EVERY-remaining}/{MLB_GUARANTEE_EVERY})</small></span><em>{pct(rates.mlb)}</em></li>{rates.rookie>0&&<li className="is-hot"><span><b>ルーキー</b><small>{DRAFT_EVENT.name}の期間中だけ · {draftRookiePool.length}人</small></span><em>{pct(rates.rookie)}</em></li>}<li><span><b>国内選手</b><small>{players.length-mlbPlayers.length}人 · 全員同じ確率</small></span><em>{pct(rates.domestic)}</em></li></ul>
   <p>国内リーグ {players.length-mlbPlayers.length}人／海外リーグ {mlbPlayers.length}人。1人 {count(SIMPLE_SCOUT_COST)} pt。通常は国内リーグ {100-MLB_SCOUT_CHANCE*100}%・海外リーグ {MLB_SCOUT_CHANCE*100}%です。国内リーグの選手は、野手・投手やチームの強さに関係なく、全員が同じ確率です（今のチームに合わせて出やすくする仕組みはありません）。{draftWeek&&`${DRAFT_EVENT.name}の期間中（〜${draftEventEndLabel()}）は、国内リーグの抽選のうち${Math.round(DRAFT_ROOKIE_CHANCE*100)}%をルーキー${draftRookiePool.length}人から、残り${100-Math.round(DRAFT_ROOKIE_CHANCE*100)}%を国内リーグ全員から同じ確率で選びます。`}30回ごとの確定時は未所持の海外選手から同じ確率で抽選し、全員所持の場合は海外選手全員が対象になります。同じ選手を獲得すると、その選手の能力が ＋1 上がります（最大 ＋5）。</p></section>
  </div></div>}
 </div>;
}
