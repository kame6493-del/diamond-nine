import type {
  Facility,
  GameState,
  LiveMatchState,
  MatchResult,
  MatchStrategy,
  MatchStrategyId,
  MatchType,
  TeamRank,
  TeamLineup,
  TournamentId,
} from "../types/game";
import type { Player } from "../types/player";
import { getActiveLineupPlayers, normalizeLineup } from "./lineupLogic";
import { calculateTeamPower, getStrategySuccessRate } from "./matchLogic";
import { rankToScore } from "./rankLogic";
import { clamp, clampFloat, createId, pickOne, randomBetween } from "./rand";

export const matchStrategies: MatchStrategy[] = [
  {
    id: "balanced",
    name: "おまかせ",
    description: "普段通りに戦います。采配回数を消費しません。",
    baseSuccessRate: 100,
  },
  {
    id: "aggressive",
    name: "強攻策",
    description: "打線に思い切り振らせます。成功すると複数得点を狙えます。",
    baseSuccessRate: 46,
  },
  {
    id: "bunt",
    name: "送りバント",
    description: "堅く進めて1点を取りに行きます。信頼度が高いほど安定します。",
    baseSuccessRate: 62,
  },
  {
    id: "steal",
    name: "盗塁",
    description: "足で揺さぶります。走力と信頼度が効きます。",
    baseSuccessRate: 50,
  },
  {
    id: "pinchHitter",
    name: "代打",
    description: "控えの打者を送り込みます。ここぞの一打を狙います。",
    baseSuccessRate: 48,
  },
  {
    id: "defenseShift",
    name: "守備位置変更",
    description: "相手の流れを切ります。守備時に特に有効です。",
    baseSuccessRate: 58,
  },
  {
    id: "pitcherTalk",
    name: "継投/声かけ",
    description: "投手を落ち着かせます。終盤やピンチに効きます。",
    baseSuccessRate: 56,
  },
  {
    id: "pitchingChange",
    name: "投手交代",
    description: "控え投手へ継投します。疲れた流れを切ります。",
    baseSuccessRate: 58,
  },
];

interface CreateLiveMatchOptions {
  forcedOpponentRank?: TeamRank;
  matchType?: MatchType;
  tournamentId?: TournamentId;
  tournamentName?: string;
  round?: number;
  teamLineup?: TeamLineup;
}

const opponentNames = [
  "港町商業",
  "白峰学園",
  "東雲工業",
  "緑丘高校",
  "桜川学院",
  "西浜実業",
  "北星高校",
  "青嶺学園",
  "朝凪水産",
  "木漏れ日学園",
];

const opponentRankByDate = (state: GameState): TeamRank => {
  if (state.month === 8) return state.reputation > 60 ? "B" : "C";
  if (state.month === 7) return state.reputation > 50 ? "C" : "D";
  if (state.month === 10) return state.reputation > 45 ? "D" : "E";
  if (state.month === 4) return state.reputation > 40 ? "D" : "E";
  return "F";
};

const getAcePitcher = (players: Player[]): Player => {
  const pitchers = players.filter((player) => player.position === "投手");
  const target = pitchers.length > 0 ? pitchers : players;
  return [...target].sort(
    (a, b) =>
      b.velocity +
      b.control +
      b.stamina +
      b.breakingBall +
      b.mental -
      (a.velocity + a.control + a.stamina + a.breakingBall + a.mental),
  )[0];
};

const getStrategy = (strategyId: MatchStrategyId): MatchStrategy =>
  matchStrategies.find((strategy) => strategy.id === strategyId) ?? matchStrategies[0];

const getLiveActivePlayers = (match: LiveMatchState, players: Player[]): Player[] => {
  const ids = new Set(match.battingOrderIds);
  if (match.currentPitcherId) ids.add(match.currentPitcherId);
  const active = players.filter((player) => ids.has(player.id));
  return active.length > 0 ? active : players;
};

const getCurrentBatter = (match: LiveMatchState, players: Player[]): Player => {
  const order = match.battingOrderIds.length > 0 ? match.battingOrderIds : players.map((player) => player.id);
  return players.find((player) => player.id === order[match.currentBatterIndex % order.length]) ?? players[0];
};

const getCurrentPitcher = (match: LiveMatchState, players: Player[]): Player => {
  return players.find((player) => player.id === match.currentPitcherId) ?? getAcePitcher(players);
};

const getStrategyActor = (
  strategyId: MatchStrategyId,
  players: Player[],
  match: LiveMatchState,
  selectedPlayerId?: string,
): Player => {
  const selected = selectedPlayerId ? players.find((player) => player.id === selectedPlayerId) : undefined;
  if ((strategyId === "pinchHitter" || strategyId === "pitchingChange") && selected) return selected;
  if (strategyId === "pitcherTalk" || strategyId === "pitchingChange") return getCurrentPitcher(match, players);
  if (strategyId === "aggressive" || strategyId === "bunt" || strategyId === "balanced") {
    return getCurrentBatter(match, players);
  }
  if (strategyId === "steal") {
    return [...players].sort((a, b) => b.speed + b.trust - (a.speed + a.trust))[0];
  }
  return [...players].sort((a, b) => b.trust + b.mental - (a.trust + a.mental))[0];
};

const getStrategySuccess = (
  strategyId: MatchStrategyId,
  players: Player[],
  facilities: Facility[],
  match: LiveMatchState,
  selectedPlayerId?: string,
): { success: boolean; rate: number; actor: Player; strategy: MatchStrategy } => {
  const strategy = getStrategy(strategyId);
  const actor = getStrategyActor(strategyId, players, match, selectedPlayerId);
  const speedBonus = strategyId === "steal" ? (actor.speed - 50) * 0.18 : 0;
  const rate =
    strategyId === "balanced"
      ? 100
      : clamp(getStrategySuccessRate(strategy.baseSuccessRate, actor, facilities) + speedBonus, 8, 92);
  return { success: Math.random() * 100 <= rate, rate, actor, strategy };
};

const getRunText = (inning: number, half: "top" | "bottom", team: string, runs: number, actor?: Player): string => {
  if (runs >= 3) return `${inning}回${half === "top" ? "表" : "裏"}、${team}が一挙${runs}点！`;
  if (runs === 2) return `${inning}回${half === "top" ? "表" : "裏"}、${team}が連打で2点を追加。`;
  if (actor) return `${inning}回表、${actor.name}のタイムリーで青空高校が1点！`;
  return `${inning}回裏、相手校が1点を返しました。`;
};

const rollRuns = (attack: number, defense: number, boost = 0): number => {
  const chance = clampFloat(0.2 + (attack - defense) * 0.008 + boost, 0.03, 0.78);
  if (Math.random() > chance) return 0;
  let runs = 1;
  if (Math.random() < chance * 0.48) runs += 1;
  if (Math.random() < chance * 0.2) runs += 1;
  if (Math.random() < chance * 0.08) runs += 1;
  return Math.min(5, runs);
};

const nextHalf = (match: LiveMatchState): Pick<LiveMatchState, "inning" | "half"> => {
  if (match.half === "top") return { inning: match.inning, half: "bottom" };
  return { inning: match.inning + 1, half: "top" };
};

const shouldFinish = (match: LiveMatchState): boolean => {
  if (match.inning < 9) return false;
  if (match.half === "top") return false;
  if (match.ourScore !== match.opponentScore) return true;
  return match.inning >= 10;
};

export const createLiveMatch = (
  state: GameState,
  players: Player[],
  options: CreateLiveMatchOptions = {},
): LiveMatchState => {
  const opponentRank = options.forcedOpponentRank ?? opponentRankByDate(state);
  const lineup = normalizeLineup(options.teamLineup, players);
  const activePlayers = getActiveLineupPlayers(lineup, players);
  const battingOrderIds = lineup.battingOrderIds.length > 0
    ? lineup.battingOrderIds
    : activePlayers.map((player) => player.id);
  const starPlayer = pickOne(activePlayers);
  const label = options.tournamentName
    ? `${options.tournamentName}${options.round ?? 1}回戦`
    : options.matchType === "official"
      ? "公式戦"
      : "練習試合";

  return {
    id: createId("live"),
    date: `${state.year}年目 ${state.month}月${state.week}週`,
    matchType: options.matchType ?? "practice",
    tournamentId: options.tournamentId,
    tournamentName: options.tournamentName,
    round: options.round,
    opponentName: pickOne(opponentNames),
    opponentRank,
    inning: 1,
    half: "top",
    ourScore: 0,
    opponentScore: 0,
    logs: [`${label}、プレイボール！監督の采配が流れを左右します。`],
    battingOrderIds,
    currentBatterIndex: 0,
    currentPitcherId: lineup.startingPitcherId ?? getAcePitcher(players).id,
    usedBenchIds: [],
    substitutionUsesRemaining: options.matchType === "official" ? 4 : 3,
    strategyUsesRemaining: options.matchType === "official" ? 5 : 4,
    maxStrategyUses: options.matchType === "official" ? 5 : 4,
    finished: false,
    starPlayerId: starPlayer.id,
    starPlayerName: starPlayer.name,
  };
};

export const advanceLiveMatch = (
  match: LiveMatchState,
  strategyId: MatchStrategyId,
  players: Player[],
  facilities: Facility[],
  selectedPlayerId?: string,
): LiveMatchState => {
  if (match.finished) return match;

  const strategy = getStrategy(strategyId);
  const usesStrategy = strategy.id !== "balanced";
  const usesSubstitution = strategy.id === "pinchHitter" || strategy.id === "pitchingChange";
  if (usesStrategy && match.strategyUsesRemaining <= 0) {
    return {
      ...match,
      logs: [`采配回数が残っていません。ベンチは普段通りのサインに戻しました。`, ...match.logs],
    };
  }
  if (usesSubstitution && match.substitutionUsesRemaining <= 0) {
    return {
      ...match,
      logs: [`選手交代の枠が残っていません。ベンチは現在のメンバーで勝負します。`, ...match.logs],
    };
  }
  if (usesSubstitution && !selectedPlayerId) {
    return {
      ...match,
      logs: [`交代する選手が選ばれていません。`, ...match.logs],
    };
  }

  let battingOrderIds = [...match.battingOrderIds];
  let currentPitcherId = match.currentPitcherId;
  let usedBenchIds = [...match.usedBenchIds];
  const currentBatter = getCurrentBatter(match, players);
  const selectedPlayer = selectedPlayerId ? players.find((player) => player.id === selectedPlayerId) : undefined;
  if (strategy.id === "pinchHitter" && selectedPlayer) {
    battingOrderIds[match.currentBatterIndex % battingOrderIds.length] = selectedPlayer.id;
    usedBenchIds = Array.from(new Set([...usedBenchIds, currentBatter.id, selectedPlayer.id]));
  }
  if (strategy.id === "pitchingChange" && selectedPlayer) {
    const currentPitcher = currentPitcherId ? players.find((player) => player.id === currentPitcherId) : undefined;
    currentPitcherId = selectedPlayer.id;
    usedBenchIds = Array.from(new Set([...usedBenchIds, ...(currentPitcher ? [currentPitcher.id] : []), selectedPlayer.id]));
  }

  const workingMatch = { ...match, battingOrderIds, currentPitcherId, usedBenchIds };
  const activePlayers = getLiveActivePlayers(workingMatch, players);
  const teamPower = calculateTeamPower(activePlayers);
  const opponentBase = rankToScore(match.opponentRank) + (match.matchType === "official" ? 2 : 0);
  const strategyCheck = getStrategySuccess(strategy.id, players, facilities, workingMatch, selectedPlayerId);
  const isTop = match.half === "top";
  const inningLabel = `${match.inning}回${isTop ? "表" : "裏"}`;
  const logs: string[] = [];
  let ourScore = match.ourScore;
  let opponentScore = match.opponentScore;

  if (strategy.id === "pinchHitter" && selectedPlayer) {
    logs.push(`${inningLabel}、代打 ${selectedPlayer.name}。ベンチの切り札を送ります。`);
  }
  if (strategy.id === "pitchingChange" && selectedPlayer) {
    logs.push(`${inningLabel}、投手交代。${selectedPlayer.name}がマウンドへ向かいます。`);
  }

  if (usesStrategy) {
    logs.push(
      strategyCheck.success
        ? `${inningLabel}、${strategy.name}が成功。${strategyCheck.actor.name}がサインに応えました。`
        : `${inningLabel}、${strategy.name}は不発。相手バッテリーに読まれました。`,
    );
  }

  if (isTop) {
    let attackBoost = 0;
    if (strategy.id === "aggressive") attackBoost = strategyCheck.success ? 8 : -4;
    if (strategy.id === "pinchHitter") attackBoost = strategyCheck.success ? 7 : -3;
    if (strategy.id === "bunt") attackBoost = strategyCheck.success ? 4 : -2;
    if (strategy.id === "steal") attackBoost = strategyCheck.success ? 7 : -5;
    const runs = rollRuns(teamPower.offense + attackBoost, opponentBase, strategy.id === "bunt" ? -0.04 : 0);
    if (runs > 0) {
      ourScore += runs;
      logs.push(getRunText(match.inning, match.half, "青空高校", runs, strategyCheck.actor));
    } else {
      logs.push(`${inningLabel}、青空高校は無得点。次の守りで流れを渡したくありません。`);
    }
  } else {
    let defenseBoost = 0;
    if (strategy.id === "defenseShift") defenseBoost = strategyCheck.success ? 8 : -2;
    if (strategy.id === "pitchingChange") defenseBoost = strategyCheck.success ? 9 : -3;
    if (strategy.id === "pitcherTalk") defenseBoost = strategyCheck.success ? 7 : -2;
    const prevention = (teamPower.defense + teamPower.pitching) / 2 + defenseBoost;
    const runs = rollRuns(opponentBase, prevention, match.inning >= 7 ? 0.03 : 0);
    if (runs > 0) {
      opponentScore += runs;
      logs.push(getRunText(match.inning, match.half, "相手校", runs));
    } else {
      logs.push(`${inningLabel}、青空高校が三者凡退に抑えました。`);
    }
  }

  const advanced = { ...match, ourScore, opponentScore };
  const finished = shouldFinish(advanced);
  const next = finished ? { inning: match.inning, half: match.half } : nextHalf(match);
  const finishLog =
    finished && ourScore > opponentScore
      ? "試合終了！ベンチの采配と選手の集中力で守り切りました。"
      : finished
        ? "試合終了。悔しい結果ですが、次につながる経験を得ました。"
        : undefined;

  return {
    ...match,
    ...next,
    ourScore,
    opponentScore,
    battingOrderIds,
    currentPitcherId,
    usedBenchIds,
    currentBatterIndex:
      isTop && battingOrderIds.length > 0
        ? (match.currentBatterIndex + 1) % battingOrderIds.length
        : match.currentBatterIndex,
    finished,
    substitutionUsesRemaining: usesSubstitution
      ? match.substitutionUsesRemaining - 1
      : match.substitutionUsesRemaining,
    strategyUsesRemaining: usesStrategy ? match.strategyUsesRemaining - 1 : match.strategyUsesRemaining,
    logs: [...(finishLog ? [finishLog] : []), ...logs.reverse(), ...match.logs].slice(0, 30),
  };
};

export const finalizeLiveMatch = (
  match: LiveMatchState,
  state: GameState,
  players: Player[],
): { state: GameState; players: Player[]; result: MatchResult } => {
  const isWin = match.ourScore > match.opponentScore;
  const round = match.round ?? 0;
  const officialBonus = match.matchType === "official" ? Math.max(1, round) : 0;
  const growthPoints = isWin ? 16 + officialBonus * 4 : 9 + officialBonus;
  const fundsGained = isWin ? 700 + officialBonus * 260 : 280 + officialBonus * 120;
  const reputationChange = isWin ? 3 + officialBonus : match.matchType === "official" ? 0 : -1;

  const nextPlayers = players.map((player) => ({
    ...player,
    trust: clamp(player.trust + (isWin ? 4 + officialBonus : 2), 0, 100),
    mood: clamp(player.mood + (isWin ? 6 : -4), 0, 100),
    fatigue: clamp(player.fatigue + (match.matchType === "official" ? 10 : 7), 0, 100),
    exp: player.exp + (isWin ? 16 + officialBonus * 3 : 9 + officialBonus),
  }));

  const result: MatchResult = {
    id: createId("match"),
    date: match.date,
    matchType: match.matchType,
    tournamentId: match.tournamentId,
    tournamentName: match.tournamentName,
    round: match.round,
    opponentName: match.opponentName,
    opponentRank: match.opponentRank,
    ourScore: match.ourScore,
    opponentScore: match.opponentScore,
    isWin,
    starPlayerId: match.starPlayerId,
    starPlayerName: match.starPlayerName,
    growthPoints,
    fundsGained,
    reputationChange,
    summary: isWin
      ? "采配が流れを呼び込み、見事な勝利です！"
      : "惜しくも敗れました。采配の経験は次の試合に残ります。",
    inningLogs: [...match.logs].reverse(),
  };

  return {
    state: {
      ...state,
      funds: state.funds + fundsGained,
      growthPoints: state.growthPoints + growthPoints,
      reputation: clamp(state.reputation + reputationChange, 0, 100),
      notifications: [
        isWin ? "見事な勝利です！" : "惜しくも敗れました。",
        `${result.opponentName}戦 ${match.ourScore}-${match.opponentScore}`,
        ...state.notifications,
      ].slice(0, 8),
    },
    players: nextPlayers,
    result,
  };
};
