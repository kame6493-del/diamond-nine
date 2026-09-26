import type { GameResult, GameState } from './engine';
import {matchRewardForPlatform} from './platform-economy';

export type Profile = 'career' | 'free';
export const SCOUT_COST = 300;
export const isCareer = (state: GameState) => state.mode === 'career';
export const currencyName = (_state: GameState) => 'pt';
export const seasonReward = (_state: GameState) => 300;
export const postseasonReward = (_state: GameState, champion: boolean, finalist: boolean) =>
  champion ? 600 : finalist ? 300 : 150;
export function gameReward(state: GameState, game: GameResult): number {
  const stadium = state.franchise.stadium - 1;
  const mine = game.home === state.club ? game.homeRuns : game.awayRuns;
  const opponent = game.home === state.club ? game.awayRuns : game.homeRuns;
  return matchRewardForPlatform(18 + (mine > opponent ? 8 : mine === opponent ? 4 : 0) + stadium);
}
