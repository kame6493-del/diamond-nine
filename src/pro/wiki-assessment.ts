import type { BattingRecord,PitchingRecord } from './data';

export const assessmentSources = {
  reference: 'https://w.atwiki.jp/ppppa/pages/22.html',
  teamExample: 'https://w.atwiki.jp/ppppa/pages/252.html',
  checked: '2026-09-22',
};
const bound = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function curve(value: number, points: readonly (readonly [number, number])[]) {
  if (value <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) if (value <= points[i][0]) {
    const [x, y] = points[i - 1], [nextX, nextY] = points[i];
    return y + (value - x) / (nextX - x) * (nextY - y);
  }
  return points[points.length - 1][1];
}
// Original smoothed adaptation of the wiki's current 100-point guidelines.
// Use the recorded 2026 season, not the prior-year individual examples.
export function assessBatting(b: BattingRecord | undefined, leagueAverage: number, teamGames: number) {
  if (!b?.pa || !b.ab) return { contact: 30, power: 35 };
  const avg = (b.hits + leagueAverage * 40) / (b.ab + 40) - (leagueAverage - .270) / 2;
  const sample = b.pa >= teamGames * 3.1 ? [0, 99] : b.pa >= 300 ? [2.5, 85] : b.pa >= 200 ? [5, 75] : b.pa >= 100 ? [5, 60] : b.pa >= 60 ? [7.5, 50] : [10, 40];
  const contact = Math.round(bound(curve(avg, [[0, 5], [.100, 20], [.180, 30], [.220, 40], [.250, 50], [.280, 60], [.300, 70], [.320, 80], [.350, 90], [.400, 99]]) - sample[0], 15, sample[1]));
  const seasonalHR = b.hr * 143 / Math.max(1, teamGames);
  const rateHR = Math.min(b.hr * 500 / b.ab, b.hr * 2 + (b.hr >= 5 ? 5 : 0));
  const hrIndex = (seasonalHR + rateHR) / 2;
  const power = Math.round(bound(hrIndex < 2 ? 20 + ((b.tb + .32 * 40) / (b.ab + 40)) * 65 : curve(hrIndex, [[2, 49], [5, 55], [10, 60], [20, 70], [30, 80], [40, 90], [60, 99]]), 15, hrIndex < 2 ? 49 : 99));
  return { contact, power };
}

export function assessPitching(q: PitchingRecord | undefined) {
  if (!q?.outs || !q.games) return { control: 45, stamina: 45 };
  const ip = q.outs / 3, average = ip / q.games, starter = average >= 4;
  const adjustedBB = Math.max(0, q.bb - (q.ibb ?? 0)) + ((q.hbp ?? 0) + (q.wp ?? 0)) / 2;
  const rate = (adjustedBB + 3.1 * 10 / 9) * 9 / (ip + 10);
  const control = Math.round(bound(curve(rate, [[0, 99], [1, 90], [1.5, 85], [2, 80], [2.5, 70], [3, 60], [3.75, 50], [4.75, 40], [6, 30], [9, 20]]) * (ip < 30 ? .92 : ip < 60 ? .94 : ip < 90 ? .96 : ip < 120 ? .98 : 1), 20, starter ? ip < 30 ? 60 : ip < 60 ? 70 : ip < 90 ? 80 : 99 : ip < 30 ? 80 : 99));
  // Start/relief splits and longest start are not in this snapshot. Average
  // innings per appearance + complete games is an explicit approximation.
  const rawStamina = starter ? average * 10 + 5 + Math.min(15, q.cg * 1.5) : 35 + average * 10;
  const stamina = Math.round(bound(rawStamina > 75 ? 75 + (rawStamina - 75) / 2 : rawStamina, 20, starter ? ip < 60 ? 60 : ip < 100 ? 70 : ip < 120 ? 75 : 99 : ip < 20 ? 50 : 60));
  return { control, stamina };
}
