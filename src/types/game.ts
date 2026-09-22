import type { AbilityKey, Player, ScoutingCandidate } from "./player";

export type Screen =
  | "home"
  | "training"
  | "match"
  | "players"
  | "school"
  | "scout"
  | "data"
  | "assets";

export type TeamRank = "S" | "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type Weather = "晴れ" | "くもり" | "雨";
export type TournamentId = "spring" | "summer" | "national" | "autumn";
export type MatchType = "practice" | "official";
export type MatchHalf = "top" | "bottom";
export type MatchStrategyId =
  | "balanced"
  | "aggressive"
  | "bunt"
  | "steal"
  | "pinchHitter"
  | "defenseShift"
  | "pitcherTalk"
  | "pitchingChange";

export interface TeamLineup {
  battingOrderIds: string[];
  startingPitcherId?: string;
  reliefPitcherId?: string;
  captainId?: string;
}

export interface TournamentState {
  id: TournamentId;
  name: string;
  round: number;
  maxRounds: number;
  wins: number;
  active: boolean;
}

export interface MatchStrategy {
  id: MatchStrategyId;
  name: string;
  description: string;
  baseSuccessRate: number;
}

export interface LiveMatchState {
  id: string;
  date: string;
  matchType: MatchType;
  tournamentId?: TournamentId;
  tournamentName?: string;
  round?: number;
  opponentName: string;
  opponentRank: TeamRank;
  inning: number;
  half: MatchHalf;
  ourScore: number;
  opponentScore: number;
  logs: string[];
  battingOrderIds: string[];
  currentBatterIndex: number;
  currentPitcherId?: string;
  usedBenchIds: string[];
  substitutionUsesRemaining: number;
  strategyUsesRemaining: number;
  maxStrategyUses: number;
  finished: boolean;
  starPlayerId: string;
  starPlayerName: string;
}

export interface GameState {
  year: number;
  month: number;
  week: number;
  actionPower: number;
  maxActionPower: number;
  funds: number;
  growthPoints: number;
  scoutPoints: number;
  reputation: number;
  teamRank: TeamRank;
  daysUntilTournament: number;
  weather: Weather;
  notifications: string[];
  incomingRecruits: Player[];
  retiredSeniors: Player[];
  activeTournament?: TournamentState;
  qualifiedForNational: boolean;
  seasonPerformance: number;
  lastYearPerformance: number;
  lastRetirementYear: number;
}

export interface Facility {
  id:
    | "ground"
    | "indoor"
    | "clubhouse"
    | "cafeteria"
    | "dorm"
    | "clinic"
    | "scoutRoom"
    | "dataRoom";
  name: string;
  level: number;
  maxLevel: number;
  baseCost: number;
  description: string;
  effect: string;
}

export interface TrainingMenu {
  id:
    | "batting"
    | "fielding"
    | "running"
    | "pitching"
    | "teamwork"
    | "meeting"
    | "rest";
  name: string;
  icon: string;
  actionCost: number;
  baseTrainingValue: number;
  effects: Partial<Record<AbilityKey, number>>;
  fatigueChange: number;
  description: string;
}

export interface TrainingPlayerChange {
  playerId: string;
  playerName: string;
  gains: Partial<Record<AbilityKey, number>>;
  injury?: string;
}

export interface TrainingResult {
  success: boolean;
  title: string;
  message: string;
  changes: TrainingPlayerChange[];
  actionCost: number;
}

export interface RandomEvent {
  id: string;
  title: string;
  description: string;
  apply: (players: Player[], state: GameState) => {
    players: Player[];
    state: GameState;
    message: string;
  };
}

export interface EventLogItem {
  id: string;
  date: string;
  title: string;
  message: string;
  category?: "event" | "match" | "tournament" | "recruit" | "graduation";
}

export interface MatchResult {
  id: string;
  date: string;
  matchType: MatchType;
  tournamentId?: TournamentId;
  tournamentName?: string;
  round?: number;
  opponentName: string;
  opponentRank: TeamRank;
  ourScore: number;
  opponentScore: number;
  isWin: boolean;
  starPlayerId: string;
  starPlayerName: string;
  growthPoints: number;
  fundsGained: number;
  reputationChange: number;
  summary: string;
  inningLogs: string[];
}

export interface SaveData {
  gameState: GameState;
  players: Player[];
  teamLineup: TeamLineup;
  facilities: Facility[];
  scoutingCandidates: ScoutingCandidate[];
  matchHistory: MatchResult[];
  eventLog: EventLogItem[];
}
