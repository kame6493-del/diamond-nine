import {useEffect,useRef,useState} from 'react';
import {Sparkles} from 'lucide-react';
import {formatAvg,formatIP,positionLabel,teamById,type Player,type Ratings} from '../data';
import {battingAverage,effectiveOverall,era,ops,type GameState} from '../engine';
import {awakeningCosts,growthProfile,ownedRatings,ratingOverall,stageNames} from '../development';
import {trainPlayer} from '../franchise';
import {traitDescriptions} from '../wiki-traits';
import {equipTwoWayPlayer} from '../simple-game';
import {formatUZR,playerSeasonUZR} from '../fielding-stats';
import {PawaCard,OvrShield,Rank,cardRatings} from './PawaCard';
import {careerLines,seasonLines} from './PawaInfo';
import {AptMark,aptitudeMark} from './PawaTeam';
import {isSpaceAlien} from '../mlb-opponents';
import {alienAge,alienFeatures,alienOverall,alienStat,alienVelocity} from '../space-aliens';

// 特殊能力の色分け(打撃・走塁・守備・投手・その他)。参考画像の色のタグ。
const traitKind=(t:string)=>/盗塁|走塁|走/.test(t)?'run':/守備|送球|捕|ブロック|肩/.test(t)?'field':/奪三振|キレ|ノビ|制球|球|打者|ピンチ|リリース|クイック|回復|威圧|乱調|荒れ|四球|一発|逃げ/.test(t)?'pitch':/チャンス|打法|ヒッター|アーチ|ミート|選球|固め|初球|対/.test(t)?'bat':'other';

/** 選手詳細(ref_09 左)。覚醒・二刀流起用は PlayerDetails と同じ関数を呼ぶ。 */
export function PawaPlayer({player,state,onChange,onAwaken,catalog=false}:{player:Player;state:GameState;onChange:(s:GameState)=>void;onAwaken:()=>void;catalog?:boolean}){
 const [result,setResult]=useState<{before:number;after:number;stage:number;changes:{label:string;before:number;after:number}[]}|null>(null);
 const success=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(result)success.current?.focus({preventScroll:true});},[result]);
 useEffect(()=>setResult(null),[player.id]);
 const owned=!!state.owned[player.id],level=state.training[player.id]??0,cost=awakeningCosts[level];
 const growth=growthProfile(player),overall=effectiveOverall(player,state.owned,state.training,state.careerGrowth),ratings=cardRatings(player,state,catalog);
 const lines=seasonLines(state.season,state.club,player),b=lines.bat,p=lines.pit,career=careerLines(state,player.id);
 const cb=career.bat,cp=career.pit,careerBat=[['試合',cb.games],['打率',cb.ab?formatAvg(cb.hits/cb.ab):'—'],['本塁打',cb.hr],['打点',cb.rbi],['盗塁',cb.sb],['OPS',cb.pa?formatAvg(ops({...cb,playerId:'',team:'',runs:0,so:0})):'—']],careerPit=[['登板',cp.games],['勝-敗',`${cp.wins}-${cp.losses}`],['セーブ',cp.saves],['防御率',cp.outs?(cp.er*27/cp.outs).toFixed(2):'—'],['奪三振',cp.so],['投球回',formatIP(cp.outs)]];
 const traits=player.traits.filter(t=>!['暫定査定','基本能力型','実戦派'].includes(t));
 const twoWay=!!player.mlb?.twoWay,pitches=player.mlb?.pitches??player.wikiAssessment?.pitches??[];
 const bothEquipped=state.lineup.includes(player.id)&&state.defense[player.id]==='DH'&&state.pitchers.includes(player.id);
 // 宇宙リーグの相手(宇宙人)は、名前・所属・数字を宇宙の見た目で出す。試合の計算は元の能力のまま。
 const alien=isSpaceAlien(player),num=(v:number)=>alien?alienStat(v):Math.min(99,v);
 const pitcher=player.role==='pitcher',team=teamById(player.team,alien?{circuit:'SPACE'}:undefined);
 const batStats=[['打率',b?.ab?formatAvg(battingAverage(b)):'—'],['本塁打',b?.hr??0],['打点',b?.rbi??0],['OPS',b?.pa?formatAvg(ops(b)):'—'],['安打',b?.hits??0],['盗塁',b?.sb??0],['二塁打',b?.doubles??0],['三塁打',b?.triples??0],['四球',b?.bb??0],['三振',b?.so??0],['併殺打',b?.gdp??0],['試合',b?.games??0],['打席',b?.pa??0],['UZR',formatUZR(playerSeasonUZR(state.season,state.club,player.id))]];
 const pitStats=[['防御率',p?.outs?era(p).toFixed(2):'—'],['勝-敗',`${p?.wins??0}-${p?.losses??0}`],['セーブ',p?.saves??0],['奪三振',p?.so??0],['WHIP',p?.outs?((p.hits+p.bb)*3/p.outs).toFixed(2):'—'],['投球回',formatIP(p?.outs??0)],['登板',p?.games??0],['先発',p?.starts??0],['四球',p?.bb??0],['被安打',p?.hits??0],['被本塁打',p?.hr??0]];
 const awaken=()=>{
  const updated=trainPlayer(state,player.id);if(updated===state)return;
  const a=ownedRatings(player,state.owned,state.training,state.careerGrowth),b=ownedRatings(player,updated.owned,updated.training,updated.careerGrowth);
  const keys:[string,keyof Ratings][]=pitcher?[['球速','velocity'],['制球','control'],['スタミナ','stamina'],['変化','breaking'],...(twoWay?[['ミート','contact'],['パワー','power']] as [string,keyof Ratings][]:[])]:[['ミート','contact'],['パワー','power'],['走力','speed'],['肩','arm'],['守備','field']];
  const changes=keys.map(([label,k])=>({label,before:a[k] as number,after:b[k] as number})).filter(c=>c.after!==c.before);
  setResult({before:overall,after:effectiveOverall(player,updated.owned,updated.training,updated.careerGrowth),stage:updated.training[player.id],changes});
  onChange(updated);onAwaken();
 };
 const shown=alien?alienOverall(catalog?ratingOverall(player,player.ratings):overall):catalog?ratingOverall(player,player.ratings):overall;
 const batRows=[['ミート',ratings.contact],['パワー',ratings.power],['走力',ratings.speed],['肩',ratings.arm],['守備',ratings.field]] as const;
 const pitRows=[['制球',ratings.control],['スタミナ',ratings.stamina],['変化',ratings.breaking]] as const;
 return <div className="pw-player">
  {catalog&&<p className="pw-note">入手時の能力 · {owned?'入手済み':'未入手'}</p>}
  <div className="pw-player-top">
   <div className={catalog&&!owned?'is-missing':''}><PawaCard player={player} state={state} size="m" base={catalog}/></div>
   <div className="pw-player-info">
    <p className="pw-team-line"><span className="pw-mark" style={{color:team.color}}>{team.mark}</span>{team.short}{alien?' · 宇宙':player.mlb?' · 海外':''}</p>
    <h3>{player.name}</h3>
    <p className="pw-hand">{player.throws??'—'}投{player.bats}打</p>
    <dl><div><dt>ポジション</dt><dd>{pitcher?'投手':player.positions.map(positionLabel).join('・')||'指名打者'}</dd></div><div><dt>年齢</dt><dd>{alien?`${alienAge(player.id)}歳`:growth.age!==null?`${growth.age}歳`:'—'}</dd></div><div><dt>タイプ</dt><dd>{growth.label}</dd></div>{!catalog&&level>0&&<div><dt>覚醒</dt><dd>{level} / 5</dd></div>}</dl>
   </div>
  </div>

  {alien&&<p className="pw-note pw-alien-note">宇宙人の数字は宇宙の目盛りです。ランクの札(S〜G)は地球の目盛りで、試合の強さは宇宙リーグの相手のままです。</p>}
  <section className="pw-sec"><h4>能力</h4>
   <div className="pw-ability"><OvrShield value={shown} size="l"/>
    <div className="pw-ability-grid">{pitcher&&<div className="pw-cell"><small>球速</small><b className="pw-velo">{alien?alienVelocity(player.ratings.velocity):player.ratings.velocity}<em>km/h</em></b></div>}{(pitcher?pitRows:batRows).map(([l,v])=><div key={l} className="pw-cell"><small>{l}</small><Rank value={v} label={l}/><b>{num(v)}</b></div>)}</div>
   </div>
   {twoWay&&<div className="pw-ability-grid pw-ability-extra">{batRows.map(([l,v])=><div key={l} className="pw-cell"><small>{l}</small><Rank value={v} label={l}/><b>{num(v)}</b></div>)}</div>}
  </section>

  {pitcher&&<section className="pw-sec"><h4>役割適性</h4><div className="pw-apt-box">{(['先','中','抑'] as const).map(r=><span key={r}><small>{r==='先'?'先発':r==='中'?'中継ぎ':'抑え'}</small><AptMark mark={aptitudeMark(player,r)}/></span>)}</div></section>}

  <section className="pw-sec"><h4>特殊能力</h4><ul className="pw-traits">{alien&&alienFeatures(player.id).map(f=><li key={f.name} className="pw-trait pw-trait-other pw-trait-alien"><b>{f.name}</b><small>{f.note}</small></li>)}{traits.map((t,i)=><li key={`${t}-${i}`} className={'pw-trait pw-trait-'+traitKind(t)+(traitDescriptions[t]?'':' is-ref')}><b>{t}</b>{traitDescriptions[t]&&<small>{traitDescriptions[t]}</small>}</li>)}{!traits.length&&!alien&&<li className="pw-trait pw-trait-other"><b>なし</b></li>}</ul>
   {!!pitches.length&&<><h4>持ち球</h4><ul className="pw-traits">{player.wikiAssessment?.secondFastball&&<li className="pw-trait pw-trait-pitch"><b>{player.wikiAssessment.secondFastball}</b></li>}{pitches.map((x,i)=><li key={i} className="pw-trait pw-trait-pitch"><b>{x.name} <span>{x.level}</span></b></li>)}</ul></>}
  </section>

  {!catalog&&<section className="pw-sec pw-awaken" aria-label="選手の覚醒"><h4>覚醒 <span>{level} / 5 · {stageNames[level]}</span></h4>
   <ol className="pw-awaken-steps" aria-label={`覚醒 ${level} / 5`}>{[1,2,3,4,5].map(n=><li key={n} className={n<=level?'done':n===level+1?'next':''}><b>{stageNames[n]}</b><img src={`/assets/pro/pawa/awaken-${n}.webp`} alt=""/><small>Lv.{n}</small><em>{awakeningCosts[n-1].toLocaleString('ja-JP')}<br/>pt</em></li>)}</ol>
   {!owned&&<p className="pw-note">入手した選手だけ覚醒できます。</p>}
  </section>}

  {!catalog&&twoWay&&owned&&<div className="pw-two-way"><p>1枚で先発とDHの両方に起用できます。</p><button className="pw-btn pw-blue" disabled={bothEquipped} onClick={()=>onChange(equipTwoWayPlayer(state,player.id))}>{bothEquipped?'投手＋DHで二刀流起用中':'投手＋DHで二刀流起用'}</button></div>}

  {!catalog&&<section className="pw-sec"><h4>今シーズンの成績{!lines.own&&` · ${team.short}`}{twoWay?' · 投手':''}</h4><dl className="pw-pstats">{(pitcher?pitStats:batStats).map(([l,v])=><div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>
   {twoWay&&<><h4>今シーズンの成績 · 打撃</h4><dl className="pw-pstats">{batStats.map(([l,v])=><div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl></>}
   {career.seasons>0&&<><h4>通算(このチームで{career.seasons}シーズン{career.stored>=8?' · 直近8シーズンまで':''})</h4><dl className="pw-pstats">{(pitcher?careerPit:careerBat).map(([l,v])=><div key={l as string}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>{twoWay&&<dl className="pw-pstats">{careerBat.map(([l,v])=><div key={l as string}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>}</>}</section>}

  {/* 覚醒ボタンは画面の下に固定。押した結果(変わった能力の前→後)はボタンのすぐ上に出るので、特能が多い選手でもスクロールせずに見える。 */}
  {!catalog&&owned&&<div className="pw-awaken-bar">
   {result&&<div key={result.stage} ref={success} tabIndex={-1} className="pw-awaken-success" role="status">
    <strong>第{result.stage}段階「{stageNames[result.stage]}」へ覚醒！</strong>
    <p className="pw-awaken-ovr">総合 {result.before} → <b>{result.after}</b>{result.after>result.before&&<em>＋{result.after-result.before}</em>}</p>
    {result.changes.length>0&&<ul className="pw-awaken-changes">{result.changes.map(c=><li key={c.label}><small>{c.label}</small><span>{c.before}</span><i aria-hidden="true">→</i><b>{c.label==='球速'?`${c.after}km/h`:c.after}</b><em>＋{c.after-c.before}</em></li>)}</ul>}
   </div>}
   {level<5&&<p className={'pw-afford '+(state.gems<cost?'short':'ready')}><span>必要 <b>{cost.toLocaleString('ja-JP')} pt</b></span><span>{state.gems<cost?`あと ${(cost-state.gems).toLocaleString('ja-JP')} pt`:`所持 ${state.gems.toLocaleString('ja-JP')} pt`}</span></p>}
   <button className="pw-btn pw-red pw-wide" disabled={level>=5||state.gems<cost} onClick={awaken}><Sparkles size={20}/>{level>=5?'完全覚醒しました':`覚醒する(第${level+1}段階「${stageNames[level+1]}」)`}</button>
  </div>}
 </div>;
}
