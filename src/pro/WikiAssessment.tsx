import { canBat,players,teamById,type Player } from './data';
import { wikiInfo } from './wiki-players';
import { traitDescriptions } from './wiki-traits';
import './wiki-assessment.css';
export function WikiAssessmentDetail({player}:{player:Player}){
 const w=player.wikiAssessment;if(!w)return <p className="ability-reference">この選手はWikiの2026年版に未掲載です。収録成績からの補完査定を使用しています。</p>;
 const applies=(t:string)=>!!traitDescriptions[t]&&(/^(奪三振|キレ○|四球|乱調|荒れ球|一発|逃げ球|対左打者|対ピンチ|ノビ)/.test(t)?player.role==='pitcher':canBat(player));
 const active=w.traits.filter(applies),reference=w.traits.filter(t=>!applies(t));
 return <section className="wiki-assessment-detail" aria-label="Wiki掲載査定の詳細"><div className="wiki-source-label">2026 WIKI ASSESSMENT <a href={w.sourceUrl} target="_blank" rel="noreferrer">この選手の掲載査定 ↗</a></div>
  <div className="wiki-aptitudes">{w.ratings.trajectory!==undefined&&<span>弾道 <b>{w.ratings.trajectory}</b></span>}{Object.entries(w.positionLevels).map(([pos,level])=><span key={pos}>{pos} <b>{level}/7</b></span>)}{Object.entries(w.pitcherRoles).map(([role,fit])=><span key={role}>{{先:'先発',中:'中継ぎ',抑:'抑え'}[role]} <b>{fit}</b></span>)}</div>
  {w.ratings.trajectory!==undefined&&<p className="fine-print">弾道は本塁打の出やすさに反映。2を基準に、1段階ごとに確率を6%補正します。</p>}
  {!!Object.keys(w.positionLevels).length&&<p className="fine-print">守備適性7が本職。6以下は適性に応じて打球処理に補正が入ります。</p>}
  {(w.pitches.length>0||w.secondFastball)&&<div className="wiki-pitches"><h3>持ち球</h3>{w.secondFastball&&<div><span>{w.secondFastball}</span><small>第二直球</small></div>}{w.pitches.map(p=><div key={p.name}><span>{p.name}</span><span className="pitch-dots" aria-label={`変化量 ${p.level} / 7`}>{Array.from({length:7},(_,i)=><i key={i} className={i<p.level?'filled':''}/>)}</span><b>{p.level}</b></div>)}<p className="fine-print">各球種の変化量を変化球総合へ反映。総合値は本作の換算です。</p></div>}
  {active.length>0&&<div className="wiki-trait-group"><h3>特殊能力 <small>試合に反映</small></h3><div className="wiki-trait-effects">{active.map(t=><span key={t}><b>{t}</b><small>{traitDescriptions[t]}</small></span>)}</div></div>}
  {reference.length>0&&<details className="wiki-reference-traits"><summary>その他の掲載特性 · {reference.length}</summary><div className="traits">{reference.map(t=><span key={t}>{t}</span>)}</div><p className="fine-print">未対応の特性や、この選手の起用では発動しない特性です。参考情報として掲載し、追加効果はありません。</p></details>}
  <p className="fine-print">基本能力はWikiの2026年版掲載値を採用。{w.ratings.catching===undefined?'捕球は掲載値が欠けているため補完査定です。':''}{w.performanceYears.length>0?`掲載文中の成績年度：${w.performanceYears.join('・')}年。`:''}覚醒・育成分は別途加算。実際の2026年成績は別タブで確認できます。</p>
 </section>;
}
export function WikiSourcesPanel(){
 const matched=players.filter(p=>p.wikiAssessment).length;
 return <section className="panel wiki-sources"><div className="eyebrow">ASSESSMENT SOURCE</div><h2>12球団、選手ごとの掲載査定。</h2><p>能力の第一基準は「パワプロNPB実在選手限定 能力査定」Wikiの2026年版です。全{players.length}人中{matched}人に掲載査定を採用し、未掲載の{players.length-matched}人は補完査定です。</p><div className="wiki-source-grid">{wikiInfo.sources.map(s=><a key={s.team} href={s.url} target="_blank" rel="noreferrer"><strong>{teamById(s.team).short}<span>{players.filter(p=>p.team===s.team&&p.wikiAssessment).length}人 ↗</span></strong><small>更新 {s.updatedAt}</small></a>)}</div><p className="fine-print">取得日：2026年9月22日。掲載値には前年成績を基にした査定も含まれます。掲載値と現実の2026年成績は別に保持。未掲載・欠けた項目をWikiの数値として補完することはありません。球速もWiki掲載値を優先し、未掲載の場合は公開球速集計、次に推定値を使用します。特殊能力の効果量・変化球総合・総合力は本作独自の換算です。</p></section>;
}
