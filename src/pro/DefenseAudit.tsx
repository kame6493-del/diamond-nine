import { ShieldCheck,Info } from 'lucide-react';
import { grade,gradeColor,positionLabel,sourceInfo,uzrInfo,type Player } from './data';
import { assessUZR,formatFieldInnings } from './defense';

export function DefenseAudit({player:p}:{player:Player}){
 const e=p.defenseEvidence,u=p.uzrRecord,a=assessUZR(u);
 return <section className="defense-audit">
  <div className="defense-audit-title"><ShieldCheck size={17}/><strong>この選手の守備査定</strong><span className={p.uzr===null?'provisional':''}>{p.uzr===null?'暫定':'UZR反映'}</span></div>
  {p.uzr!==null&&u?<><div className="uzr-rating-comparison"><div><small>画像のUZR</small><strong className={p.uzr<0?'uzr-negative':''}>{p.uzr>0?'+':''}{p.uzr.toFixed(1)}</strong></div><span>→</span><div><small>守備力・基礎値</small><strong><b style={{color:gradeColor(p.ratings.field)}}>{grade(p.ratings.field)}</b> {p.ratings.field}</strong></div></div><p>提供画像：{uzrInfo.asOf}終了時点 · 守備 {formatFieldInnings(u.outs)}回。守備イニングで補正した独自査定です。{u.outs<600?'出場が少ないため、平均に近づけて評価しています。':''}</p></>:<p>{u?'画像のUZRが「—」のため、':'提供画像にこの選手のUZRがないため、'}守備力の基礎値は暫定60です。平均的な実力を確認できた値ではありません。</p>}
  <div className="defense-facts"><div><small>{positionLabel(p.position)}・守備試合</small><b>{p.fielding.length?e.games:'—'}</b></div><div><small>守備機会</small><b>{p.fielding.length?e.chances:'—'}</b></div><div><small>失策</small><b>{p.fielding.length?e.errors:'—'}</b></div><div><small>守備率</small><b>{e.fieldingPct===null?'—':e.fieldingPct.toFixed(3)}</b></div></div>
  <p className="defense-explainer"><Info size={14}/><span>上の公式守備成績は{p.dataYear===2026?sourceInfo.asOf:'2025年'}時点。捕球は同じ守備位置の失策率から推定。肩力は実測値ではなく、UZRを送球速度には換算しません。</span></p>
  <details><summary>計算の根拠・守備位置別の成績</summary><div className="table-wrap"><table><thead><tr><th>位置</th><th>試合</th><th>刺殺</th><th>補殺</th><th>失策</th></tr></thead><tbody>{p.fielding.map(f=><tr key={f.position}><td>{positionLabel(f.position)}</td><td>{f.games}</td><td>{f.putouts}</td><td>{f.assists}</td><td>{f.errors}</td></tr>)}</tbody></table></div>
  <p>守備力＝60＋2×（UZR×1,200÷（守備イニング＋400））、四捨五入して15〜99。400回分の平均値を加え、短い出場の極端な成績を補正します。係数はゲーム用で、DELTAの公式査定ではありません。{a.adjusted1200!==null&&<> 画像のUZR/1200は{u?.per1200?.toFixed(1)}、ゲーム査定用の補正後は{a.adjusted1200.toFixed(2)}です。</>}</p>
  <p>画像は守備位置の内訳がないため、選手合計の参考値として使用します。UZR単年値だけで実力を確定できるものではありません。覚醒・育成はゲーム能力にのみ加算し、原数値は変えません。</p>
  <p>同位置・同リーグの守備率：{e.positionPct===null?'—':e.positionPct.toFixed(3)}。捕球＝60＋（同位置平均失策率−補正失策率）×1,000、40〜85に制限。平均250機会分で補正。</p>
  <a href={`https://npb.jp/bis/${p.dataYear}/stats/idf1_${p.team}.html`} target="_blank" rel="noreferrer">NPB公式守備成績 ↗</a>{u&&<><br/><a href={uzrInfo.source} target="_blank" rel="noreferrer">DELTA UZR一覧（提供画像の出典） ↗</a><p>転記元：{u.sourceFile} · 画像の行番号 {u.rank}。ダッシュボードの「防御」列とは別の値です。</p></>}</details>
 </section>;
}
