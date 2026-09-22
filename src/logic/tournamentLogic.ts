import type { GameState, MatchResult, TeamRank, TournamentId, TournamentState } from "../types/game";

interface TournamentConfig {
  id: TournamentId;
  name: string;
  startMonth: number;
  startWeek: number;
  maxRounds: number;
  ranks: TeamRank[];
}

export const tournamentConfigs: Record<TournamentId, TournamentConfig> = {
  spring: {
    id: "spring",
    name: "春大会",
    startMonth: 4,
    startWeek: 4,
    maxRounds: 3,
    ranks: ["E", "D", "C"],
  },
  summer: {
    id: "summer",
    name: "夏の地区大会",
    startMonth: 7,
    startWeek: 2,
    maxRounds: 4,
    ranks: ["D", "C", "C", "B"],
  },
  national: {
    id: "national",
    name: "全国大会",
    startMonth: 8,
    startWeek: 2,
    maxRounds: 4,
    ranks: ["C", "B", "A", "S"],
  },
  autumn: {
    id: "autumn",
    name: "秋大会",
    startMonth: 10,
    startWeek: 2,
    maxRounds: 3,
    ranks: ["E", "D", "C"],
  },
};

export interface OfficialMatchInfo {
  tournament: TournamentState;
  opponentRank: TeamRank;
}

const createTournamentState = (config: TournamentConfig): TournamentState => ({
  id: config.id,
  name: config.name,
  round: 1,
  maxRounds: config.maxRounds,
  wins: 0,
  active: true,
});

export const getTournamentToStart = (state: GameState): TournamentConfig | undefined => {
  if (state.activeTournament?.active) return undefined;
  const candidates = Object.values(tournamentConfigs).filter(
    (config) => config.startMonth === state.month && config.startWeek === state.week,
  );
  return candidates.find((config) => config.id !== "national" || state.qualifiedForNational);
};

export const prepareOfficialMatch = (
  state: GameState,
): { state: GameState; info?: OfficialMatchInfo; startedMessage?: string } => {
  let nextState = state;
  let startedMessage: string | undefined;

  const startingConfig = getTournamentToStart(state);
  if (startingConfig) {
    nextState = {
      ...nextState,
      activeTournament: createTournamentState(startingConfig),
      notifications: [`${startingConfig.name}が開幕しました。`, ...nextState.notifications].slice(0, 8),
    };
    startedMessage = `${startingConfig.name}が開幕しました。勝ち上がるほど相手校が強くなります。`;
  }

  const tournament = nextState.activeTournament;
  if (!tournament?.active) {
    return { state: nextState, startedMessage };
  }

  const config = tournamentConfigs[tournament.id];
  return {
    state: nextState,
    startedMessage,
    info: {
      tournament,
      opponentRank: config.ranks[Math.min(tournament.round - 1, config.ranks.length - 1)],
    },
  };
};

export const resolveTournamentAfterMatch = (
  state: GameState,
  result: MatchResult,
): { state: GameState; messages: string[]; shouldRetireSeniors: boolean } => {
  const tournament = state.activeTournament;
  if (!tournament?.active || result.matchType !== "official") {
    return { state, messages: [], shouldRetireSeniors: false };
  }

  const messages: string[] = [];
  const wonTitle = tournament.round >= tournament.maxRounds;
  const performanceGain = result.isWin ? 4 + tournament.round * 2 : Math.max(1, tournament.round);
  let nextState: GameState = {
    ...state,
    seasonPerformance: state.seasonPerformance + performanceGain,
  };

  if (!result.isWin) {
    messages.push(`${tournament.name}は${tournament.round}回戦で敗退しました。`);
    nextState = {
      ...nextState,
      activeTournament: undefined,
      qualifiedForNational:
        tournament.id === "national" ? false : tournament.id === "summer" ? false : state.qualifiedForNational,
      notifications: [`${tournament.name}が終了しました。`, ...state.notifications].slice(0, 8),
    };
    return {
      state: nextState,
      messages,
      shouldRetireSeniors: tournament.id === "summer" || tournament.id === "national",
    };
  }

  if (wonTitle) {
    messages.push(`${tournament.name}を制覇しました！`);
    nextState = {
      ...nextState,
      activeTournament: undefined,
      qualifiedForNational: tournament.id === "summer" ? true : tournament.id === "national" ? false : state.qualifiedForNational,
      reputation: Math.min(100, state.reputation + (tournament.id === "national" ? 10 : 6)),
      notifications: [
        `${tournament.name}を制覇しました！`,
        tournament.id === "summer" ? "全国大会への出場が決まりました。" : "学校中が大きく盛り上がっています。",
        ...state.notifications,
      ].slice(0, 8),
    };
    return {
      state: nextState,
      messages,
      shouldRetireSeniors: tournament.id === "national",
    };
  }

  const nextRound = tournament.round + 1;
  messages.push(`${tournament.name}${tournament.round}回戦突破。次は${nextRound}回戦です。`);
  nextState = {
    ...nextState,
    activeTournament: {
      ...tournament,
      round: nextRound,
      wins: tournament.wins + 1,
    },
    notifications: [`${tournament.name}${tournament.round}回戦突破！`, ...state.notifications].slice(0, 8),
  };
  return { state: nextState, messages, shouldRetireSeniors: false };
};

export const getTournamentDisplayName = (state: GameState): string | undefined => {
  const tournament = state.activeTournament;
  if (tournament?.active) {
    return `${tournament.name} ${tournament.round}回戦`;
  }
  const starting = getTournamentToStart(state);
  if (starting) return `${starting.name} 1回戦`;
  if (state.month === 8 && state.week === 2 && !state.qualifiedForNational) return "夏合宿";
  return undefined;
};
