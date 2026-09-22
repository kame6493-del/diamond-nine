import type { EventLogItem, GameState, MatchResult, SaveData, TeamLineup } from "../types/game";
import type { Player, ScoutingCandidate } from "../types/player";
import { initialFacilities } from "../data/facilities";
import { initialPlayers } from "../data/initialPlayers";
import { createDefaultLineup, normalizeLineup } from "./lineupLogic";
import { calculateTeamRank } from "./rankLogic";
import { createInitialGameState } from "./teamLogic";

const storageKeys = {
  gameState: "gameState",
  players: "players",
  facilities: "facilities",
  teamLineup: "teamLineup",
  scoutingCandidates: "scoutingCandidates",
  matchHistory: "matchHistory",
  eventLog: "eventLog",
} as const;

export const saveGame = (data: SaveData): void => {
  localStorage.setItem(storageKeys.gameState, JSON.stringify(data.gameState));
  localStorage.setItem(storageKeys.players, JSON.stringify(data.players));
  localStorage.setItem(storageKeys.teamLineup, JSON.stringify(data.teamLineup));
  localStorage.setItem(storageKeys.facilities, JSON.stringify(data.facilities));
  localStorage.setItem(storageKeys.scoutingCandidates, JSON.stringify(data.scoutingCandidates));
  localStorage.setItem(storageKeys.matchHistory, JSON.stringify(data.matchHistory));
  localStorage.setItem(storageKeys.eventLog, JSON.stringify(data.eventLog));
};

const migratePlayer = <T extends Player>(player: T): T => ({
  ...player,
  talent: player.talent ?? 1,
  trust: player.trust ?? 20,
  mood: player.mood ?? 55,
  fatigue: player.fatigue ?? 0,
  specialAbilities: player.specialAbilities ?? [],
  exp: player.exp ?? 0,
});

const ensurePlayableRoster = (players: Player[]): Player[] => {
  if (players.length >= 9) return players;

  const existingIds = new Set(players.map((player) => player.id));
  const walkOns = initialPlayers
    .filter((player) => !existingIds.has(player.id))
    .slice(0, 9 - players.length)
    .map((player) => migratePlayer({ ...player, year: 1 as const, fatigue: 0, exp: 0 }));

  return [...players, ...walkOns];
};

const migrateGameState = (raw: Partial<GameState>): GameState => {
  const base = createInitialGameState();
  return {
    ...base,
    ...raw,
    maxActionPower: raw.maxActionPower ?? base.maxActionPower,
    actionPower: raw.actionPower ?? base.actionPower,
    scoutPoints: raw.scoutPoints ?? base.scoutPoints,
    notifications: raw.notifications ?? base.notifications,
    incomingRecruits: (raw.incomingRecruits ?? []).map((player) => migratePlayer(player)),
    retiredSeniors: (raw.retiredSeniors ?? []).map((player) => migratePlayer(player)),
    qualifiedForNational: raw.qualifiedForNational ?? false,
    seasonPerformance: raw.seasonPerformance ?? 0,
    lastYearPerformance: raw.lastYearPerformance ?? 0,
    lastRetirementYear: raw.lastRetirementYear ?? 0,
    activeTournament: raw.activeTournament?.active ? raw.activeTournament : undefined,
  };
};

const migrateMatch = (match: Partial<MatchResult>): MatchResult => ({
  id: match.id ?? `match-${Date.now()}`,
  date: match.date ?? "日付不明",
  matchType: match.matchType ?? (match.tournamentName ? "official" : "practice"),
  tournamentId: match.tournamentId,
  tournamentName: match.tournamentName,
  round: match.round,
  opponentName: match.opponentName ?? "相手校",
  opponentRank: match.opponentRank ?? "F",
  ourScore: match.ourScore ?? 0,
  opponentScore: match.opponentScore ?? 0,
  isWin: match.isWin ?? (match.ourScore ?? 0) > (match.opponentScore ?? 0),
  starPlayerId: match.starPlayerId ?? "",
  starPlayerName: match.starPlayerName ?? "選手",
  growthPoints: match.growthPoints ?? 0,
  fundsGained: match.fundsGained ?? 0,
  reputationChange: match.reputationChange ?? 0,
  summary: match.summary ?? "試合を終えました。",
  inningLogs: match.inningLogs ?? [],
});

const migrateEvent = (event: Partial<EventLogItem>): EventLogItem => ({
  id: event.id ?? `event-${Date.now()}`,
  date: event.date ?? "日付不明",
  title: event.title ?? "イベント",
  message: event.message ?? "",
  category: event.category ?? "event",
});

export const loadGame = (): SaveData | undefined => {
  const rawGameState = localStorage.getItem(storageKeys.gameState);
  const rawPlayers = localStorage.getItem(storageKeys.players);
  const rawTeamLineup = localStorage.getItem(storageKeys.teamLineup);
  const rawFacilities = localStorage.getItem(storageKeys.facilities);
  const rawScoutingCandidates = localStorage.getItem(storageKeys.scoutingCandidates);
  const rawMatchHistory = localStorage.getItem(storageKeys.matchHistory);
  const rawEventLog = localStorage.getItem(storageKeys.eventLog);

  if (!rawGameState || !rawPlayers || !rawFacilities || !rawScoutingCandidates) {
    return undefined;
  }

  const parsedFacilities = JSON.parse(rawFacilities);
  const players = ensurePlayableRoster((JSON.parse(rawPlayers) as Player[]).map((player) => migratePlayer(player)));
  const parsedLineup = rawTeamLineup ? (JSON.parse(rawTeamLineup) as Partial<TeamLineup>) : createDefaultLineup(players);
  const gameState = migrateGameState(JSON.parse(rawGameState));
  return {
    gameState: { ...gameState, teamRank: calculateTeamRank(players) },
    players,
    teamLineup: normalizeLineup(parsedLineup as TeamLineup, players),
    facilities: initialFacilities.map((base) => ({
      ...base,
      ...(parsedFacilities as typeof initialFacilities).find((facility) => facility.id === base.id),
    })),
    scoutingCandidates: (JSON.parse(rawScoutingCandidates) as ScoutingCandidate[]).map((player) =>
      migratePlayer(player),
    ),
    matchHistory: rawMatchHistory ? (JSON.parse(rawMatchHistory) as Partial<MatchResult>[]).map(migrateMatch) : [],
    eventLog: rawEventLog ? (JSON.parse(rawEventLog) as Partial<EventLogItem>[]).map(migrateEvent) : [],
  };
};

export const clearSave = (): void => {
  Object.values(storageKeys).forEach((key) => localStorage.removeItem(key));
};
