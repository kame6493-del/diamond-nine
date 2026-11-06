import {shownKmh} from '../velocity-display';
import {useEffect,useState,type CSSProperties,type ReactNode} from 'react';
import {X} from 'lucide-react';
import {playerMap,players,type Player,type Ratings} from '../data';
import {effectiveOverall,type GameState} from '../engine';
import {bestUpgrade} from '../career-roster';
import {MLB_SCOUT_CHANCE,MULTI_SCOUT_COST,MULTI_SCOUT_COUNT,SIMPLE_SCOUT_COST,scoutOdds} from '../simple-game';
import {PawaMultiResult,PawaMultiReveal} from './PawaMultiScout';
import {scoutDuration,scoutPresentation,type ScoutTier} from '../scout-presentation';
import {mlbPlayers} from '../mlb-players';
import {ScoutShare} from '../ScoutShare';
import {scoutShareData} from '../share-kit';
import {isRookie,ownedRatings,playerAge} from '../development';
import {aptitudeMark as aptitudeMarkOf,AptMark} from './PawaTeam';
import {fitsPosition} from '../data';
import {pitcherRolePenalty,pitcherSlotRole} from '../pitcher-aptitude';
import {collectionProgress} from '../player-browser';
import {PawaCard,Rank,cardRatings,fitName} from './PawaCard';
import {useMonetize} from '../monetization';
import {aptitudeNames,positionNames} from '../positions-ja';
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
 return <div className="pw-sc-abil">{rows.map(([label,key])=>{const v=ratings[key] as number,d=old?v-(old[key] as number):0;return <span key={key} className="pw-sc-cell"><small>{label}</small>{key==='velocity'?<b className="pw-sc-velo">{shownKmh(player.ratings.velocity)}<em>km/h</em></b>:<Rank value={v} label={label} showValue/>}{old&&<i className={d>0?'up':d<0?'down':''}>{d>0?`+${d}`:d===0?'±0':d}</i>}</span>;})}</div>;
}

export function PawaScout({state,onDraw,onDrawMulti,onEquip,drawing,hasDrawn,onSeason,onPlayer,onSkip,adSlot,sound=false}:{state:GameState;onDraw:()=>void;onDrawMulti?:()=>void;onEquip:(id:string)=>void;drawing:boolean;hasDrawn:boolean;onSeason:()=>void;onPlayer?:(p:Player)=>void;onSkip?:()=>void;adSlot?:ReactNode;sound?:boolean}){
 const [kept,setKept]=useState(-1),[odds,setOdds]=useState(false),[shop,setShop]=useState(false);
 // 2026-10-30 持ち主「課金圧が強すぎる」: 待ち受けの大きなパックの帯とプレミアムパスの案内をやめた。購入は下の「ポイント購入」とメニューから。
 const money=useMonetize();
 const posName=positionNames(state.lineup,state.defense);
 // 2026-11-04 vc43: 10回まとめて引いた後は lastPulls が10枚。その時は1枚の結果ではなく、まとめて引く用の演出と一覧を出す。
 const multi=hasDrawn&&state.lastPulls.length>1,canMulti=state.gems>=MULTI_SCOUT_COST;
 const pull=hasDrawn&&!multi?state.lastPulls[0]:null,player=pull?playerMap[pull.playerId]:null;
 const upgrade=player?bestUpgrade(state,player.id):null,canDraw=state.gems>=SIMPLE_SCOUT_COST;
 const {tier,overall}=scoutPresentation(player,state.owned,state.training);
 // 提供割合は抽選と同じ計算(scoutOdds)から
 const rates=scoutOdds(state),pct=(x:number)=>`${+(x*100).toFixed(3)}%`,pct4=(x:number)=>`${(x*100).toFixed(4)}%`;
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
  const label=pit?(pick.i<6?`先発${pick.i+1}`:pick.i===13?'抑え':`中継ぎ${pick.i-5}`):`${pick.i+1}番(${posName[pick.id]??state.defense[pick.id]})`;
  return {p:playerMap[pick.id],label,overall:ov(pick.id),ratings:ownedRatings(playerMap[pick.id],state.owned,state.training,state.careerGrowth)};})();
 const cmp=old&&upgrade&&oldRatings?{p:old,label:upgrade.pitching?(upgrade.index<6?`先発${upgrade.index+1}`:upgrade.index===13?'抑え':`中継ぎ${upgrade.index-5}`):`${upgrade.index+1}番(${posName[state.lineup[upgrade.index]]??upgrade.position})`,overall:oldOverall,ratings:oldRatings}:rival;
 // 2026-11-06 夜 持ち主「スカウト画面ですが、どこ押してもスクロール出来るようになってません」:
 // 前は画面の高さに固定(pw-fit)して真ん中の場だけをスクロールさせていたので、上の帯・下の引くボタンの上をなぞっても動かなかった。
 // 引いている演出の間だけ1画面に固定し(is-run)、それ以外はページごと縦に流す。引くボタンの列だけ下に貼りつける(sticky)。
 useEffect(()=>{if(typeof window!=='undefined')window.scrollTo({top:0,behavior:'auto'});},[drawing,state.pulls]);
 return <div className={'pw-scout'+(drawing?' pw-fit is-run':' is-flow')+(drawing&&multi?' is-mx-run':'')+(multi&&!drawing?' is-mx':'')}>
  <section className="pw-sc-strip" aria-label="チームとカードの集まり具合">
   <div><small>カード収集</small><b>{progress.collected}<em>/{progress.total}</em></b></div>
   <div><small>打線の総合</small><b>{avg(state.lineup)}</b></div>
   <div><small>投手陣の総合</small><b>{avg(state.pitchers)}</b></div>
  </section>

  <div className="pw-sc-stage">
  {drawing&&multi?<PawaMultiReveal key={'mx-'+state.pulls} state={state} sound={sound} onDone={()=>onSkip?.()}/>:multi?<PawaMultiResult state={state} onPlayer={onPlayer}/>:drawing?<PawaScoutCharge tier={tier} onSkip={onSkip} player={player} state={state}/>:showResult&&ratings?<section className={'pw-sc-result pw-tier-'+tier+(cmp?' has-cmp':'')} aria-live="polite">
   <div className="pw-sc-head">
    <button className="pw-sc-card" onClick={()=>onPlayer?.(player!)} aria-label={`${player!.name}の詳細`}><PawaCard player={player!} state={state} size="m"/></button>
    <div className="pw-sc-id">
     <p className="pw-sc-chips"><span className="pw-tierchip">{tier==='rainbow'?'虹カード':tier==='gold'?(player!.mlb?'海外・金':'金カード'):'カード'}</span><span className={pull!.isNew?'pw-newchip':'pw-dupchip'}>{pull!.isNew?'NEW':pull!.copies<=6?'重複 能力+1':'重複 +80pt'}</span></p>
     <h2>{player!.name}</h2>
     <p className="pw-sc-meta">{player!.role==='pitcher'?(['先','中','抑'] as const).map(r=>`${r==='先'?'先発':r==='中'?'中継':'抑え'}${aptitudeMarkOf(player!,r)}`).join(' '):aptitudeNames(player!.positions).join('・')||'指'}{player!.mlb?' · 海外':''}{age!==null?` · ${age}歳`:''}</p>
     <p className="pw-sc-ovr"><small>総合</small><b>{overall}</b>{old&&<em className={overall>oldOverall?'up':''}>今の選手 {oldOverall}</em>}</p>
    </div>
   </div>
   {!cmp&&<AbilityRow player={player!} ratings={ratings} mode={mode}/>}
   {player!.mlb?.twoWay&&<AbilityRow player={player!} ratings={ratings} mode={mode==='pitcher'?'batter':'pitcher'}/>}
   {cmp?<div className={'pw-cmp'+(old?'':' is-info')}>
    <p className="pw-cmp-q">{old?<>今の<b>{cmp.label}</b>より強い選手です。入れ替えますか？</>:<>今の<b>{cmp.label}</b>と比べると</>}</p>
    <table className="pw-cmp-table"><thead><tr><th></th><th className="is-new">{player!.name}<small>総合 {overall}</small></th><th><button data-player-id={cmp.p.id} onClick={()=>onPlayer?.(cmp.p)}>{cmp.p.name}</button><small>総合 {cmp.overall}</small></th><th>差</th></tr></thead>
     <tbody>{((mode==='pitcher'?[['球速','velocity'],['制球','control'],['スタミナ','stamina'],['変化','breaking']]:[['ミート','contact'],['パワー','power'],['走力','speed'],['肩','arm'],['守備','field']]) as [string,keyof Ratings][]).map(([label,key])=>{const x=key==='velocity'?player!.ratings.velocity:ratings[key] as number,y=key==='velocity'?cmp.p.ratings.velocity:cmp.ratings[key] as number,d=x-y;return <tr key={key}><th>{label}</th><td className="is-new">{key==='velocity'?<b className="pw-cmp-velo">{shownKmh(x)}<em>km/h</em></b>:<Rank value={x} label={label} showValue/>}</td><td>{key==='velocity'?<b className="pw-cmp-velo">{shownKmh(y)}<em>km/h</em></b>:<Rank value={y} label={label} showValue/>}</td><td className={d>0?'up':d<0?'down':''}>{d>0?`▲${d}`:d===0?'±0':`▼${-d}`}</td></tr>;})}
     {mode==='pitcher'&&(()=>{const roles=['先','中','抑'] as const,target=roles.find(r=>cmp.label.startsWith(r))??null,score=(m:string)=>m==='◎'?3:m==='○'?2:m==='△'?1:0;
      const cell=(q:Player)=><span className="pw-cmp-apt">{roles.map(r=><span key={r} className={r===target?'is-target':''}><small>{r}</small><AptMark mark={aptitudeMarkOf(q,r)}/></span>)}</span>;
      const d=target?score(aptitudeMarkOf(player!,target))-score(aptitudeMarkOf(cmp.p,target)):0;
      return <tr className="pw-cmp-aptrow"><th>適性{target&&<small>{target==='先'?'先発':target==='中'?'中継ぎ':'抑え'}枠</small>}</th><td className="is-new">{cell(player!)}</td><td>{cell(cmp.p)}</td><td className={d>0?'up':d<0?'down':''}>{!target?'':d>0?'▲':d<0?'▼':'＝'}</td></tr>;})()}
    </tbody></table>
    {old?null
    :<p className="pw-sc-note">{overall>cmp.overall?'守備位置の補正込みで今の選手が上':'今の選手の方が上'} · 控えに加入</p>}
   </div>
   :<p className="pw-sc-note">{equipped?'編成済み':'控えに加入'}</p>}
   {(()=>{const t=player!.traits.filter(x=>!['暫定査定','基本能力型','実戦派'].includes(x));return t.length>0&&<ul className="pw-bench-traits pw-sc-traits" aria-label="特殊能力">{t.slice(0,10).map((x,i)=><li key={x+i}>{x}</li>)}{t.length>10&&<li className="is-more">ほか{t.length-10}</li>}</ul>;})()}
   <ScoutShare key={'share-'+state.pulls} data={scoutShareData(player!,state.owned,state.training,tier,pull!.isNew,isRookie(player!))}/>
  </section>:<section className="pw-sc-idle pw-sc-idle2">
   <div className="pw-sc-idle-top"><img src="/assets/pro/pawa/draw-card-back.webp" alt="" width={120} height={168}/>
   <div><ul className="pw-tier-legend-list"><li data-tier="standard"><b>カード</b>ふつう</li><li data-tier="gold"><b>金カード</b>総合85以上・海外</li><li data-tier="rainbow"><b>虹カード</b>総合95以上</li></ul><p>国内{pct(1-MLB_SCOUT_CHANCE)}・海外{pct(MLB_SCOUT_CHANCE)}</p></div></div>
   <ul className="pw-sc-odds" aria-label="提供割合のあらまし"><li><b>虹カード</b>{pct(rates.bands.filter(b=>b.id.endsWith('Rainbow')).reduce((n,b)=>n+b.rate,0))}</li><li><b>金カード</b>{pct(rates.bands.filter(b=>b.id.endsWith('Gold')).reduce((n,b)=>n+b.rate,0))}</li><li><b>カード</b>{pct(rates.bands.find(b=>b.id==='domStandard')!.rate)}</li></ul>
   <div className="pw-sc-weak"><h3>補強したい所<small>総合が低い順</small></h3><div>{([['打線',state.lineup.map((id,i)=>({id,tag:`${i+1}番 ${posName[id]??state.defense[id]}`}))],['投手陣',state.pitchers.map((id,i)=>({id,tag:i<6?`先発${i+1}`:i===13?'抑え':`中継ぎ${i-5}`}))]] as const).map(([title,list])=><ul key={title} aria-label={title}><li className="pw-sc-weak-h">{title}</li>{[...list].map(x=>({...x,o:effectiveOverall(playerMap[x.id],state.owned,state.training,state.careerGrowth)})).sort((a,b)=>a.o-b.o).slice(0,3).map(x=><li key={x.id}><small>{x.tag}</small><button style={fitName(playerMap[x.id].name,92,13)} data-player-id={x.id} onClick={()=>onPlayer?.(playerMap[x.id])}>{playerMap[x.id].name}</button><b>{x.o}</b></li>)}</ul>)}</div></div>
  </section>}
  </div>

  <section className={'pw-sc-dock'+(showResult&&old?' is-swap':'')}>
   {/* 2026-11-01 入れ替えのボタンは下の欄に固定(上の場をスクロールしなくても押せる) */}
   {showResult&&old&&<div className="pw-cmp-acts pw-sc-swapbar" role="group" aria-label={`${player!.name}と今の${cmp?.label??'選手'}の入れ替え`}><button className="pw-btn pw-white" onClick={()=>setKept(state.pulls)}>控えに置く</button><button className="pw-btn pw-yellow" onClick={()=>onEquip(player!.id)}>この選手と入れ替える</button></div>}
   <div className="pw-sc-draws">
    <button className="pw-btn pw-yellow pw-draw-btn" disabled={!canDraw||drawing} onClick={onDraw}><span className="pw-ball" aria-hidden="true"/><span><b>{hasDrawn?'もう1枚':'1枚引く'}</b><em><i className="pw-p">P</i>{count(SIMPLE_SCOUT_COST)} pt</em></span></button>
    {onDrawMulti&&<button className="pw-btn pw-draw-btn pw-multi-btn" disabled={!canMulti||drawing} onClick={onDrawMulti} aria-label={`10回まとめて引く ${count(MULTI_SCOUT_COST)} pt`}><span><b><span className="pw-multi-n">10回</span>まとめて引く</b><em><i className="pw-p">P</i>{count(MULTI_SCOUT_COST)} pt</em></span></button>}
   </div>
   {onDrawMulti&&!canMulti&&!drawing&&<p className="pw-multi-short" role="note">10回まとめて引くには あと{count(MULTI_SCOUT_COST-state.gems)}pt</p>}
  </section>
  {!drawing&&<section className="pw-sc-more">
   {money?adSlot&&<div className="pw-sc-adbtn">{adSlot}</div>:<div className="pw-sc-adbtn"><div className="reward-ad"><button type="button" className="s-button reward-ad-button" disabled>広告を見て1回引く<small>アプリ版で使えます</small></button></div></div>}
   <div className="pw-sc-dockinfo"><p className={'pw-balance '+(canDraw?'ok':'short')}>所持 <b>{count(state.gems)}</b> pt<br/><span>{canDraw?`あと${count(Math.floor(state.gems/SIMPLE_SCOUT_COST))}回`:`あと${count(SIMPLE_SCOUT_COST-state.gems)}pt`}</span></p><div className="pw-sc-dockacts"><button className="pw-btn pw-white pw-mini pw-buy-mini" onClick={()=>setShop(true)}>ポイント購入</button>{canDraw?<button className="pw-btn pw-white pw-mini" onClick={()=>setOdds(true)}>提供割合</button>:<button className="pw-btn pw-white pw-mini" onClick={onSeason}>試合へ</button>}</div></div>
  </section>}

  {shop&&<div className="pw-modal pw-sheet-modal" onClick={()=>setShop(false)}><div className="pw-sheet pw-shop-sheet" role="dialog" aria-modal="true" aria-label="ポイント購入" onClick={e=>e.stopPropagation()}>
   <header className="pw-sheet-head"><h2>ポイント購入</h2><button className="pw-close" onClick={()=>setShop(false)} aria-label="閉じる"><X size={22}/></button></header>
   <PackShop/>
   <button type="button" className="pw-btn pw-white pw-sheet-close" onClick={()=>setShop(false)}>閉じる</button>
  </div></div>}
  {odds&&<div className="pw-modal pw-sheet-modal" onClick={()=>setOdds(false)}><div className="pw-sheet" role="dialog" aria-modal="true" aria-label="提供割合" onClick={e=>e.stopPropagation()}>
   <header className="pw-sheet-head"><h2>提供割合</h2><button className="pw-close" onClick={()=>setOdds(false)} aria-label="閉じる"><X size={22}/></button></header>
   <section className="pw-panel pw-odds"><ul>{rates.bands.map(b=><li key={b.id} className={b.id.startsWith('mlb')?'is-world':b.id==='domStandard'?'':'is-hot'}><span><b>{b.label}</b><small>{b.detail} · {b.count}人 · 1人 {pct4(b.each)}</small></span><em>{pct(b.rate)}</em></li>)}</ul>
   <p>国内リーグ {players.length-mlbPlayers.length}人／海外リーグ {mlbPlayers.length}人。1人 {count(SIMPLE_SCOUT_COST)} pt。カードの段（総合は覚醒前の値）ごとに上の確率で決め、同じ段の中では全員が同じ確率です。野手・投手やチームの強さ、ポイントの購入・プレミアムパスで確率は変わりません。何回引いても確定する枠（天井）はありません。まとめて引く時も、1回ずつと同じ確率で10回引きます（{count(MULTI_SCOUT_COUNT)}回まとめて {count(MULTI_SCOUT_COST)} pt。確定枠・おまけはありません）。同じ選手を獲得すると、その選手の能力が ＋1 上がります（最大 ＋5）。7枚目からは {count(300)} pt に替わります。</p></section>
  </div></div>}
 </div>;
}
