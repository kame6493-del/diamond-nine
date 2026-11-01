import type { GameResult, GameState } from './engine';
import {matchRewardForPlatform,premiumMatchBonusActive} from './platform-economy';

export type Profile = 'career' | 'free';
export const SCOUT_COST = 300;
export const isCareer = (state: GameState) => state.mode === 'career';
export const currencyName = (_state: GameState) => 'pt';
// 2026-10-19 持ち主「さくさく進むようになったので、ポイントを抑えて、自分で手を動かして稼ぐことを多く。
// チームが強くなるまではスカウトをある程度引けるように」。進めるだけで入る分(試合・完走・短期決戦・シーズン目標)を下げ、
// 補強支援(累計スカウトが少ないうちだけ)で序盤を厚くする。数値と理由は ECONOMY_UPDATE.md。
// 2026-10-30 夜 持ち主「もっとガンガンガチャ回せて育成できるように」: 完走 50 → 1,500、
// 試合 2/2/3 → 5/5/15、短期決戦 30/60/150 → 500/1,000/2,500、補強支援を厚く長く。1年が5分で回るので、1年あたりは2倍前後に留める
// (bot で 3,000/10/30 にすると重く遊ぶ人が1日500回引けてしまい、パックの意味が無くなった)。数値は RELEASE-STATUS.md の 10/30 夜の節。
// 2026-11-01 夜 持ち主「大盤振る舞い過ぎて速攻でクリアできてしまう。課金圧がちゃんとなるように。徐々に強くしていく過程を」。
// 行動力をやめて1年をいくらでも進められるので、1年ごとに入る量を 10/28(vc25)の水準へ戻す。数値と測った表は BALANCE_1101.md。
export const SEASON_COMPLETE_POINTS = 600;
export const GAME_POINTS = 3;
export const GAME_WIN_POINTS = 2;
// プレミアムパス: シーズンを終えるたびに ＋6,000pt(スカウト2回分)。毎年効く中身(2026-11-01)。アプリ版でパスが有効な時だけ。
export const PASS_SEASON_POINTS = 6000;
// 補強支援: シーズンを終えるたびに、累計スカウト回数(pulls)に応じて。40回からは無し。
export const SUPPORT_STEPS = [{under: 6, points: 3000}] as const;
// 12シーズン目まで(引かずにためる人に配り続けないため)。
export const SUPPORT_LAST_SEASON = 3;
export const supportPoints = (state: GameState) => state.season.number > SUPPORT_LAST_SEASON ? 0 : SUPPORT_STEPS.find(s => (state.pulls ?? 0) < s.under)?.points ?? 0;
export const passSeasonPoints = () => premiumMatchBonusActive() ? PASS_SEASON_POINTS : 0;
export const seasonReward = (state: GameState) => SEASON_COMPLETE_POINTS + supportPoints(state) + passSeasonPoints();
export const postseasonReward = (_state: GameState, champion: boolean, finalist: boolean) =>
  champion ? 500 : finalist ? 250 : 100;
export function gameReward(state: GameState, game: GameResult): number {
  const stadium = state.franchise.stadium - 1;
  const mine = game.home === state.club ? game.homeRuns : game.awayRuns;
  const opponent = game.home === state.club ? game.awayRuns : game.homeRuns;
  return matchRewardForPlatform(GAME_POINTS + (mine > opponent ? GAME_WIN_POINTS : 0) + stadium);
}
