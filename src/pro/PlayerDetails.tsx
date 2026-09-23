import {useState} from 'react';
import {Sparkles} from 'lucide-react';
import {formatAvg,formatIP,type Player} from './data';
import {battingAverage,effectiveOverall,era,ops,type GameState} from './engine';
import {awakeningCosts,growthProfile,stageNames} from './development';
import {trainPlayer} from './franchise';
import {traitDescriptions} from './wiki-traits';
import {TradingCard} from './CardDeck';
import {equipTwoWayPlayer} from './simple-game';

export function PlayerDetails({player,state,onChange,onAwaken,catalog=false}:{player:Player;state:GameState;onChange:(s:GameState)=>void;onAwaken:()=>void;catalog?:boolean}){
 const [effect,setEffect]=useState(0);
 const b=state.season.batting[`${state.club}|${player.id}`],p=state.season.pitching[`${state.club}|${player.id}`],level=state.training[player.id]??0;
 const growth=growthProfile(player),cost=awakeningCosts[level];
 const traits=player.traits.filter(t=>!['暫定査定','基本能力型','実戦派'].includes(t));
 const twoWay=!!player.mlb?.twoWay,pitches=player.mlb?.pitches??player.wikiAssessment?.pitches??[];
 const bothEquipped=state.lineup.includes(player.id)&&state.defense[player.id]==='DH'&&state.pitchers.includes(player.id);
 const batStats=[['打率',b?.ab?formatAvg(battingAverage(b)):'—'],['本塁打',b?.hr??0],['打点',b?.rbi??0],['OPS',b?.pa?formatAvg(ops(b)):'—'],['盗塁',b?.sb??0]];
 const pitStats=[['奪三振',p?.so??0],['防御率',p?.outs?era(p).toFixed(2):'—'],['投球回',formatIP(p?.outs??0)],['セーブ',p?.saves??0]];
 return <>
  {catalog&&<p className="catalog-detail-label">入手時の能力 · {state.owned[player.id]?'入手済み':'未入手'}</p>}
  <div className={'detail-card '+(catalog&&!state.owned[player.id]?'catalog-detail-unowned':'')}><TradingCard player={player} state={state} baseOnly={catalog}/></div>
  <p className="player-bio">{growth.age!==null?`${growth.age}歳 · `:''}{growth.label} · {player.throws??'—'}投{player.bats}打 · 適性 {player.positions.join(' / ')||'DH'}</p>
  {!catalog&&twoWay&&!!state.owned[player.id]&&<div className="two-way-offer"><p>1枚で先発とDHの両方に起用できます。</p><button className="s-button" disabled={bothEquipped} onClick={()=>onChange(equipTwoWayPlayer(state,player.id))}>{bothEquipped?'投手＋DHで二刀流起用中':'投手＋DHで二刀流起用'}</button></div>}
  {!catalog&&<><p className="s-detail-label">今シーズンの成績{twoWay?' · 投手':''}</p><div className="s-detail-stats">{(player.role==='pitcher'?pitStats:batStats).map(([label,value])=><div key={label}><small>{label}</small><b>{value}</b></div>)}</div>
  {twoWay&&<><p className="s-detail-label">今シーズンの成績 · 打撃</p><div className="s-detail-stats">{batStats.map(([label,value])=><div key={label}><small>{label}</small><b>{value}</b></div>)}</div></>}</>}
  <section className="special-abilities"><h3>特殊能力</h3><div>{traits.map((trait,i)=><span key={`${trait}-${i}`} className={traitDescriptions[trait]?'trait-active':'trait-reference'}><b>{trait}</b>{traitDescriptions[trait]&&<small>{traitDescriptions[trait]}</small>}</span>)}{!traits.length&&<span>なし</span>}</div></section>
  {!!pitches.length&&<section className="pitch-repertoire"><h3>持ち球</h3><div>{player.wikiAssessment?.secondFastball&&<span>{player.wikiAssessment.secondFastball}</span>}{pitches.map((pitch,i)=><span key={i}>{pitch.name} <b>{pitch.level}</b></span>)}</div></section>}
  {!catalog&&<section className="awakening-panel"><div className="awakening-heading"><div><p>STAGE AWAKENING</p><h3>覚醒 {level} / 5 <span>{stageNames[level]}</span></h3></div><Sparkles size={25}/></div>
   <div className="awakening-track" aria-label={`覚醒 ${level} / 5`}>{[1,2,3,4,5].map(n=><div key={n} className={n<=level?'done':''}><b>{n}</b><small>{stageNames[n]}</small></div>)}</div>
   <div className="growth-overall"><div><small>現在の総合</small><b>{effectiveOverall(player,state.owned,state.training)}</b></div></div>
   {!!state.owned[player.id]&&<><button className="s-primary awaken-button" disabled={level>=5||state.gems<cost} onClick={()=>{const updated=trainPlayer(state,player.id);if(updated===state)return;onChange(updated);onAwaken();setEffect(v=>v+1);}}><Sparkles size={17}/>{level>=5?'完全覚醒しました':`第${level+1}段階へ覚醒 · ${cost?.toLocaleString('ja-JP')} pt`}</button>{level<5&&<div className="awakening-savings" role="progressbar" aria-label={`第${level+1}段階へのポイント`} aria-valuemin={0} aria-valuemax={cost} aria-valuenow={Math.min(cost,state.gems)}><i style={{width:`${Math.min(100,state.gems/cost*100)}%`}}/></div>}<p className="growth-wallet">所持 {state.gems.toLocaleString()} pt{level<5&&state.gems<cost?` · あと${(cost-state.gems).toLocaleString('ja-JP')}pt`:''}</p>{level<5&&<p className="awakening-cost-note">スカウトと共通の所持ポイントを使います。段階が進むほど必要ptが増えます。</p>}</>}
   {effect>0&&<div key={effect} className="awakening-success animate__animated animate__bounceIn" role="status">覚醒成功！ 総合 {effectiveOverall(player,state.owned,state.training)}</div>}
  </section>}
 </>;
}
