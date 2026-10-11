import {useEffect,useRef,useState} from 'react';
import {Sparkles} from 'lucide-react';
import {formatAvg,formatIP,positionLabel,teamById,type Player} from '../data';
import {battingAverage,effectiveOverall,era,ops,type GameState} from '../engine';
import {awakeningCosts,growthProfile,ratingOverall,stageNames} from '../development';
import {trainPlayer} from '../franchise';
import {traitDescriptions} from '../wiki-traits';
import {equipTwoWayPlayer} from '../simple-game';
import {formatUZR,playerSeasonUZR} from '../fielding-stats';
import {PawaCard,OvrShield,Rank,cardRatings} from './PawaCard';
import {AptMark,aptitudeMark} from './PawaTeam';

// 特殊能力の色分け(打撃・走塁・守備・投手・その他)。参考画像の色のタグ。
const traitKind=(t:string)=>/盗塁|走塁|走/.test(t)?'run':/守備|送球|捕|ブロック|肩/.test(t)?'field':/奪三振|キレ|ノビ|制球|球|打者|ピンチ|リリース|クイック|回復|威圧|乱調|荒れ|四球|一発|逃げ/.test(t)?'pitch':/チャンス|打法|ヒッター|アーチ|ミート|選球|固め|初球|対/.test(t)?'bat':'other';

/** 選手詳細(ref_09 左)。覚醒・二刀流起用は PlayerDetails と同じ関数を呼ぶ。 */
export function PawaPlayer({player,state,onChange,onAwaken,catalog=false}:{player:Player;state:GameState;onChange:(s:GameState)=>void;onAwaken:()=>void;catalog?:boolean}){
 const [result,setResult]=useState<{before:number;after:number;stage:number}|null>(null);
 const success=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(result)success.current?.focus({preventScroll:true});},[result]);
 const owned=!!state.owned[player.id],level=state.training[player.id]??0,cost=awakeningCosts[level];
 const growth=growthProfile(player),overall=effectiveOverall(player,state.owned,state.training),ratings=cardRatings(player,state,catalog);
 const b=state.season.batting[`${state.club}|${player.id}`],p=state.season.pitching[`${state.club}|${player.id}`];
 const traits=player.traits.filter(t=>!['暫定査定','基本能力型','実戦派'].includes(t));
 const twoWay=!!player.mlb?.twoWay,pitches=player.mlb?.pitches??player.wikiAssessment?.pitches??[];
 const bothEquipped=state.lineup.includes(player.id)&&state.defense[player.id]==='DH'&&state.pitchers.includes(player.id);
 const pitcher=player.role==='pitcher',team=teamById(player.team);
 const batStats=[['打率',b?.ab?formatAvg(battingAverage(b)):'—'],['本塁打',b?.hr??0],['打点',b?.rbi??0],['OPS',b?.pa?formatAvg(ops(b)):'—'],['盗塁',b?.sb??0],['UZR',formatUZR(playerSeasonUZR(state.season,state.club,player.id))]];
 const pitStats=[['奪三振',p?.so??0],['防御率',p?.outs?era(p).toFixed(2):'—'],['投球回',formatIP(p?.outs??0)],['セーブ',p?.saves??0]];
 const awaken=()=>{
  const updated=trainPlayer(state,player.id);if(updated===state)return;
  setResult({before:overall,after:effectiveOverall(player,updated.owned,updated.training),stage:updated.training[player.id]});
  onChange(updated);onAwaken();
 };
 const shown=catalog?ratingOverall(player,player.ratings):overall;
 const batRows=[['ミート',ratings.contact],['パワー',ratings.power],['走力',ratings.speed],['肩',ratings.arm],['守備',ratings.field]] as const;
 const pitRows=[['制球',ratings.control],['スタミナ',ratings.stamina],['変化',ratings.breaking]] as const;
 return <div className="pw-player">
  {catalog&&<p className="pw-note">入手時の能力 · {owned?'入手済み':'未入手'}</p>}
  <div className="pw-player-top">
   <div className={catalog&&!owned?'is-missing':''}><PawaCard player={player} state={state} size="m" base={catalog}/></div>
   <div className="pw-player-info">
    <p className="pw-team-line"><span className="pw-mark" style={{color:team.color}}>{team.mark}</span>{team.short}{player.mlb?' · 海外':''}</p>
    <h3>{player.name}</h3>
    <p className="pw-hand">{player.throws??'—'}投{player.bats}打</p>
    <dl><div><dt>ポジション</dt><dd>{pitcher?'投手':player.positions.map(positionLabel).join('・')||'指名打者'}</dd></div><div><dt>年齢</dt><dd>{growth.age!==null?`${growth.age}歳`:'—'}</dd></div><div><dt>タイプ</dt><dd>{growth.label}</dd></div>{!catalog&&level>0&&<div><dt>覚醒</dt><dd>{level} / 5</dd></div>}</dl>
   </div>
  </div>

  <section className="pw-sec"><h4>能力</h4>
   <div className="pw-ability"><OvrShield value={shown} size="l"/>
    <div className="pw-ability-grid">{pitcher&&<div className="pw-cell"><small>球速</small><b className="pw-velo">{player.ratings.velocity}<em>km/h</em></b></div>}{(pitcher?pitRows:batRows).map(([l,v])=><div key={l} className="pw-cell"><small>{l}</small><Rank value={v} label={l}/><b>{Math.min(99,v)}</b></div>)}</div>
   </div>
   {twoWay&&<div className="pw-ability-grid pw-ability-extra">{batRows.map(([l,v])=><div key={l} className="pw-cell"><small>{l}</small><Rank value={v} label={l}/><b>{Math.min(99,v)}</b></div>)}</div>}
  </section>

  {pitcher&&<section className="pw-sec"><h4>役割適性</h4><div className="pw-apt-box">{(['先','中','抑'] as const).map(r=><span key={r}><small>{r==='先'?'先発':r==='中'?'中継ぎ':'抑え'}</small><AptMark mark={aptitudeMark(player,r)}/></span>)}</div></section>}

  <section className="pw-sec"><h4>特殊能力</h4><ul className="pw-traits">{traits.map((t,i)=><li key={`${t}-${i}`} className={'pw-trait pw-trait-'+traitKind(t)+(traitDescriptions[t]?'':' is-ref')}><b>{t}</b>{traitDescriptions[t]&&<small>{traitDescriptions[t]}</small>}</li>)}{!traits.length&&<li className="pw-trait pw-trait-other"><b>なし</b></li>}</ul>
   {!!pitches.length&&<><h4>持ち球</h4><ul className="pw-traits">{player.wikiAssessment?.secondFastball&&<li className="pw-trait pw-trait-pitch"><b>{player.wikiAssessment.secondFastball}</b></li>}{pitches.map((x,i)=><li key={i} className="pw-trait pw-trait-pitch"><b>{x.name} <span>{x.level}</span></b></li>)}</ul></>}
  </section>

  {!catalog&&<section className="pw-sec pw-awaken" aria-label="選手の覚醒"><h4>覚醒 <span>{level} / 5 · {stageNames[level]}</span></h4>
   <ol className="pw-awaken-steps" aria-label={`覚醒 ${level} / 5`}>{[1,2,3,4,5].map(n=><li key={n} className={n<=level?'done':n===level+1?'next':''}><b>{stageNames[n]}</b><img src={`/assets/pro/pawa/awaken-${n}.webp`} alt=""/><small>Lv.{n}</small><em>{awakeningCosts[n-1].toLocaleString('ja-JP')}<br/>pt</em></li>)}</ol>
   {owned?<>
    {level<5&&<><div className="pw-budget"><div><small>必要ポイント</small><strong>{cost.toLocaleString('ja-JP')} pt</strong></div><div><small>所持ポイント</small><strong>{state.gems.toLocaleString('ja-JP')} pt</strong></div></div>
     <div className="pw-bar" role="progressbar" aria-label={`第${level+1}段階へのポイント`} aria-valuemin={0} aria-valuemax={cost} aria-valuenow={Math.min(cost,state.gems)}><i style={{width:`${Math.min(100,state.gems/cost*100)}%`}}/></div>
     <p className={'pw-afford '+(state.gems<cost?'short':'ready')}>{state.gems<cost?`あと${(cost-state.gems).toLocaleString('ja-JP')}ptで覚醒`:`覚醒後の所持ポイント ${(state.gems-cost).toLocaleString('ja-JP')} pt`}</p></>}
    <button className="pw-btn pw-red pw-wide" disabled={level>=5||state.gems<cost} onClick={awaken}><Sparkles size={20}/>{level>=5?'完全覚醒しました':`覚醒する(第${level+1}段階)`}</button>
    {level<5&&<p className="pw-note">スカウトと共通のポイントを使います。覚醒すると能力が上がります。</p>}
   </>:<p className="pw-note">入手した選手だけ覚醒できます。</p>}
   {result&&<div key={result.stage} ref={success} tabIndex={-1} className="pw-awaken-success" role="status"><strong>第{result.stage}段階へ覚醒成功！</strong><span>総合 {result.before} → <b>{result.after}</b></span></div>}
  </section>}

  {!catalog&&twoWay&&owned&&<div className="pw-two-way"><p>1枚で先発とDHの両方に起用できます。</p><button className="pw-btn pw-blue" disabled={bothEquipped} onClick={()=>onChange(equipTwoWayPlayer(state,player.id))}>{bothEquipped?'投手＋DHで二刀流起用中':'投手＋DHで二刀流起用'}</button></div>}

  {!catalog&&<section className="pw-sec"><h4>今シーズンの成績{twoWay?' · 投手':''}</h4><dl className="pw-pstats">{(pitcher?pitStats:batStats).map(([l,v])=><div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>
   {twoWay&&<><h4>今シーズンの成績 · 打撃</h4><dl className="pw-pstats">{batStats.map(([l,v])=><div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl></>}</section>}
 </div>;
}
