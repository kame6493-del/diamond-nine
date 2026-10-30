import type { GameResult, GameState } from './engine';
import {matchRewardForPlatform} from './platform-economy';

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
export const SEASON_COMPLETE_POINTS = 1500;
export const GAME_POINTS = 5;
export const GAME_WIN_POINTS = 10;
// 補強支援: シーズンを終えるたびに、累計スカウト回数(pulls)に応じて。40回からは無し。
export const SUPPORT_STEPS = [{under: 15, points: 6000}, {under: 40, points: 3000}, {under: 80, points: 1500}] as const;
// 12シーズン目まで(引かずにためる人に配り続けないため)。
export const SUPPORT_LAST_SEASON = 20;
export const supportPoints = (state: GameState) => state.season.number > SUPPORT_LAST_SEASON ? 0 : SUPPORT_STEPS.find(s => (state.pulls ?? 0) < s.under)?.points ?? 0;
export const seasonReward = (state: GameState) => SEASON_COMPLETE_POINTS + supportPoints(state);
export const postseasonReward = (_state: GameState, champion: boolean, finalist: boolean) =>
  champion ? 2500 : finalist ? 1000 : 500;
export function gameReward(state: GameState, game: GameResult): number {
  const stadium = state.franchise.stadium - 1;
  const mine = game.home === state.club ? game.homeRuns : game.awayRuns;
  const opponent = game.home === state.club ? game.awayRuns : game.homeRuns;
  return matchRewardForPlatform(GAME_POINTS + (mine > opponent ? GAME_WIN_POINTS : 0) + stadium);
}
