import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { battingAverage,ops,type BatStats,type GameState } from './engine';
import { formatAvg,playerMap,type Player } from './data';

export function battingTotals(rows: BatStats[]) {
  const sum = (key: keyof BatStats) => rows.reduce((total, b) => total + (b[key] as number), 0);
  const ab = sum('ab'), hits = sum('hits'), bb = sum('bb'), hbp = sum('hbp'), sf = sum('sf');
  const hr = sum('hr'), rbi = sum('rbi'), tb = hits + sum('doubles') + 2 * sum('triples') + 3 * hr;
  const obp = ab + bb + hbp + sf ? (hits + bb + hbp) / (ab + bb + hbp + sf) : 0;
  return { ab, hits, hr, rbi, avg: ab ? hits / ab : 0, ops: obp + (ab ? tb / ab : 0) };
}
export function SeasonBattingReport({ state,onPlayer }: { state: GameState;onPlayer: (player: Player) => void }) {
  const [sort,setSort] = useState<'pa'|'avg'|'hr'|'rbi'|'ops'>('pa');
  const rows = Object.values(state.season.batting).filter(b => b.team === state.club);
  const total = battingTotals(rows);
  const value = (b: BatStats) => sort === 'avg' ? battingAverage(b) : sort === 'ops' ? ops(b) : b[sort];
  const ordered = [...rows].sort((a,b) => value(b) - value(a) || b.pa - a.pa || a.playerId.localeCompare(b.playerId));
  return <section className="season-batting-report" aria-label="シーズン打撃成績">
    <div className="section-title"><div><div className="eyebrow">SEASON {String(state.season.number).padStart(2,'0')} · FINAL BATTING REPORT</div><h2><BarChart3 size={23} />あなたの選手たちが残した、143試合。</h2></div></div>
    <div className="batting-headlines">{[['チーム打率',total.ab ? formatAvg(total.avg) : '—'],['本塁打',String(total.hr)],['打点',String(total.rbi)],['チームOPS',total.ab ? formatAvg(total.ops) : '—']].map(([label,value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    <div className="batting-report-toolbar"><p>出場した全選手のゲーム内成績</p><label>並び順<select aria-label="シーズン打撃成績の並び順" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}>{[['pa','打席'],['avg','打率'],['hr','本塁打'],['rbi','打点'],['ops','OPS']].map(([key,label])=><option key={key} value={key}>{label}順</option>)}</select></label></div>
    <div className="table-scroll"><table className="data-table final-batting-table"><thead><tr><th>選手</th><th>試合</th><th>打率</th><th>本塁打</th><th>打点</th><th>OPS</th><th>安打</th><th>打席</th><th>出塁率</th><th>長打率</th></tr></thead><tbody>{ordered.map(b => {
      const denominator=b.ab+b.bb+b.hbp+b.sf,obp=denominator?(b.hits+b.bb+b.hbp)/denominator:0,slg=b.ab?(b.hits+b.doubles+2*b.triples+3*b.hr)/b.ab:0;
      return <tr key={b.playerId}><td><button data-player-id={b.playerId} onClick={()=>onPlayer(playerMap[b.playerId])}>{playerMap[b.playerId].name}</button></td><td>{b.games}</td><td className="stat-highlight">{b.ab?formatAvg(battingAverage(b)):'—'}</td><td className="stat-highlight">{b.hr}</td><td className="stat-highlight">{b.rbi}</td><td className="stat-highlight">{denominator?formatAvg(ops(b)):'—'}</td><td>{b.hits}</td><td>{b.pa}</td><td>{denominator?formatAvg(obp):'—'}</td><td>{b.ab?formatAvg(slg):'—'}</td></tr>;
    })}</tbody></table></div>
    <p className="fine-print">打率＝安打÷打数。OPS＝出塁率＋長打率。打点は試合中に走者を還した結果を集計。途中加入の選手は、編成後に出場した試合だけが記録されます。</p>
  </section>;
}
