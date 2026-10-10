import {useEffect,useRef,useState} from 'react';
import {Sparkles} from 'lucide-react';
import {formatAvg,formatIP,positionLabel,teamById,type Player} from '../data';
import {battingAverage,effectiveOverall,era,ops,type GameState} from '../engine';
import {awakeningCosts,growthProfile,stageNames} from '../development';
import {trainPlayer} from '../franchise';
import {traitDescriptions} from '../wiki-traits';
import {equipTwoWayPlayer} from '../simple-game';
import {formatUZR,playerSeasonUZR} from '../fielding-stats';
import {PawaCard,GradeRow,cardRatings} from './PawaCard';
import {AptMark,aptitudeMark} from './PawaTeam';

type Tab='status'|'awaken'|'stats'|'skill';
/** 選手カード詳細(ref_04)。覚醒・二刀流起用は PlayerDetails と同じ関数を呼ぶ。 */
export function PawaPlayer({player,state,onChange,onAwaken,catalog=false}:{player:Player;state:GameState;onChange:(s:GameState)=>void;onAwaken:()=>void;catalog?:boolean}){
 const [tab,setTab]=useState<Tab>('status');
 const [result,setResult]=useState<{before:number;after:number;stage:number}|null>(null);
 const success=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(result)success.current?.focus({preventScroll:true});},[result]);
 const owned=!!state.owned[player.id],level=state.training[player.id]??0,cost=awakeningCosts[level];
 const growth=growthProfile(player),overall=effectiveOverall(player,state.owned,state.training);
 const b=state.season.batting[`${state.club}|${player.id}`],p=state.season.pitching[`${state.club}|${player.id}`];
 const traits=player.traits.filter(t=>!['暫定査定','基本能力型','実戦派'].includes(t));
 const twoWay=!!player.mlb?.twoWay,pitches=player.mlb?.pitches??player.wikiAssessment?.pitches??[];
 const bothEquipped=state.lineup.includes(player.id)&&state.defense[player.id]==='DH'&&state.pitchers.includes(player.id);
 const pitcher=player.role==='pitcher';
 const batStats=[['打率',b?.ab?formatAvg(battingAverage(b)):'—'],['本塁打',b?.hr??0],['打点',b?.rbi??0],['OPS',b?.pa?formatAvg(ops(b)):'—'],['盗塁',b?.sb??0],['UZR',formatUZR(playerSeasonUZR(state.season,state.club,player.id))]];
 const pitStats=[['奪三振',p?.so??0],['防御率',p?.outs?era(p).toFixed(2):'—'],['投球回',formatIP(p?.outs??0)],['セーブ',p?.saves??0]];
 const awaken=()=>{
  const updated=trainPlayer(state,player.id);if(updated===state)return;
  setResult({before:overall,after:effectiveOverall(player,updated.owned,updated.training),stage:updated.training[player.id]});
  onChange(updated);onAwaken();
 };
 const tabs:[Tab,string][]=catalog?[['status','ステータス'],['skill','特殊能力']]:[['status','ステータス'],['awaken','覚醒'],['stats','成績'],['skill','特殊能力']];
 return <div className="nv-player">
  {catalog&&<p className="nv-note">入手時の能力 · {owned?'入手済み':'未入手'}</p>}
  <div className={'nv-player-card'+(catalog&&!owned?' is-missing':'')}><PawaCard player={player} state={state} size="l" base={catalog}/></div>
  <div className="nv-player-name"><h3>{player.name}</h3><p>{teamById(player.team).short}{player.mlb?' · 海外':' · 国内'}{level>0&&!catalog?` · 覚醒 ${level}/5`:''}</p></div>
  <div className="nv-tabs nv-tabs-small" role="tablist">{tabs.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>

  {tab==='status'&&<>
   <dl className="nv-bio"><div><dt>ポジション</dt><dd>{pitcher?'投手':player.positions.map(positionLabel).join('・')||'指名打者'}</dd></div><div><dt>投打</dt><dd>{player.throws??'—'}投{player.bats}打</dd></div><div><dt>年齢</dt><dd>{growth.age!==null?`${growth.age}歳`:'—'}</dd></div><div><dt>タイプ</dt><dd>{growth.label}</dd></div></dl>
   <GradeRow player={player} ratings={cardRatings(player,state,catalog)} mode={pitcher?'pitcher':'batter'} big/>
   {twoWay&&<GradeRow player={player} ratings={cardRatings(player,state,catalog)} mode="batter" big/>}
   {pitcher&&<section className="nv-apt-box"><h4>適性</h4><div><span>先発<AptMark mark={aptitudeMark(player,'先')}/></span><span>中継ぎ<AptMark mark={aptitudeMark(player,'中')}/></span><span>抑え<AptMark mark={aptitudeMark(player,'抑')}/></span></div></section>}
   {!catalog&&twoWay&&owned&&<div className="nv-two-way"><p>1枚で先発とDHの両方に起用できます。</p><button className="nv-navy" disabled={bothEquipped} onClick={()=>onChange(equipTwoWayPlayer(state,player.id))}>{bothEquipped?'投手＋DHで二刀流起用中':'投手＋DHで二刀流起用'}</button></div>}
   {!catalog&&owned&&level<5&&<button className="nv-gold nv-wide" onClick={()=>setTab('awaken')}><Sparkles size={18}/>選手を覚醒する</button>}
  </>}

  {tab==='awaken'&&!catalog&&<section className="nv-awaken" aria-label="選手の覚醒">
   <header><h4>覚醒 <span>{level} / 5 · {stageNames[level]}</span></h4><p>現在の総合 <b>{overall}</b></p></header>
   <ol className="nv-awaken-steps" aria-label={`覚醒 ${level} / 5`}>{[1,2,3,4,5].map(n=><li key={n} className={n<=level?'done':n===level+1?'next':''}><img src={`/assets/pro/pawa/awaken-${n}.webp`} alt=""/><b>{stageNames[n]}</b><small>{awakeningCosts[n-1].toLocaleString('ja-JP')} pt</small></li>)}</ol>
   {owned?<>
    {level<5&&<>
     <div className="nv-budget"><div><small>必要ポイント</small><strong>{cost.toLocaleString('ja-JP')} pt</strong></div><div><small>所持ポイント</small><strong>{state.gems.toLocaleString('ja-JP')} pt</strong></div></div>
     <div className="nv-bar" role="progressbar" aria-label={`第${level+1}段階へのポイント`} aria-valuemin={0} aria-valuemax={cost} aria-valuenow={Math.min(cost,state.gems)}><i style={{width:`${Math.min(100,state.gems/cost*100)}%`}}/></div>
     <p className={'nv-afford '+(state.gems<cost?'short':'ready')}>{state.gems<cost?`あと${(cost-state.gems).toLocaleString('ja-JP')}ptで覚醒`:`覚醒後の所持ポイント ${(state.gems-cost).toLocaleString('ja-JP')} pt`}</p>
    </>}
    <button className="nv-gold nv-wide" disabled={level>=5||state.gems<cost} onClick={awaken}><Sparkles size={18}/>{level>=5?'完全覚醒しました':`第${level+1}段階へ覚醒する`}</button>
    {level<5&&<p className="nv-note">スカウトと共通のポイントを使います。覚醒すると能力が上がります。</p>}
   </>:<p className="nv-note">入手した選手だけ覚醒できます。</p>}
   {result&&<div key={result.stage} ref={success} tabIndex={-1} className="nv-awaken-success" role="status"><strong>第{result.stage}段階へ覚醒成功！</strong><span>総合 {result.before} → <b>{result.after}</b></span></div>}
  </section>}

  {tab==='stats'&&!catalog&&<section className="nv-pstats"><h4>今シーズンの成績{twoWay?' · 投手':''}</h4><dl>{(pitcher?pitStats:batStats).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   {twoWay&&<><h4>今シーズンの成績 · 打撃</h4><dl>{batStats.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></>}</section>}

  {tab==='skill'&&<section className="nv-skills"><h4>特殊能力</h4><ul>{traits.map((t,i)=><li key={`${t}-${i}`} className={traitDescriptions[t]?'is-active':''}><b>{t}</b>{traitDescriptions[t]&&<small>{traitDescriptions[t]}</small>}</li>)}{!traits.length&&<li>なし</li>}</ul>
   {!!pitches.length&&<><h4>持ち球</h4><ul className="nv-pitches">{player.wikiAssessment?.secondFastball&&<li><b>{player.wikiAssessment.secondFastball}</b></li>}{pitches.map((x,i)=><li key={i}><b>{x.name}</b><small>{x.level}</small></li>)}</ul></>}
  </section>}
 </div>;
}
