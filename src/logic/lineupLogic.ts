import type { TeamLineup } from "../types/game";
import type { Player } from "../types/player";

const playerBattingScore = (player: Player): number =>
  player.contact * 0.38 +
  player.power * 0.26 +
  player.speed * 0.22 +
  player.mental * 0.08 +
  player.trust * 0.06;

const playerPitchingScore = (player: Player): number =>
  player.velocity * 0.24 +
  player.control * 0.3 +
  player.stamina * 0.22 +
  player.breakingBall * 0.16 +
  player.mental * 0.08 +
  (player.position === "投手" ? 8 : 0);

export const getPlayerDisplayScore = (player: Player): number =>
  Math.round(
    (player.power +
      player.contact +
      player.speed +
      player.arm +
      player.defense +
      player.catching +
      player.control +
      player.stamina) /
      8,
  );

export const sortBattingCandidates = (players: Player[]): Player[] =>
  [...players].sort((a, b) => playerBattingScore(b) - playerBattingScore(a));

export const sortPitchingCandidates = (players: Player[]): Player[] =>
  [...players].sort((a, b) => playerPitchingScore(b) - playerPitchingScore(a));

export const createDefaultLineup = (players: Player[]): TeamLineup => {
  const battingOrderIds = sortBattingCandidates(players)
    .slice(0, Math.min(9, players.length))
    .map((player) => player.id);
  const pitchers = sortPitchingCandidates(players);
  const captain = [...players].sort((a, b) => b.trust + b.mental - (a.trust + a.mental))[0];

  return {
    battingOrderIds,
    startingPitcherId: pitchers[0]?.id,
    reliefPitcherId: pitchers[1]?.id,
    captainId: captain?.id,
  };
};

export const normalizeLineup = (lineup: TeamLineup | undefined, players: Player[]): TeamLineup => {
  if (players.length === 0) return { battingOrderIds: [] };

  const playerIds = new Set(players.map((player) => player.id));
  const validOrder = (lineup?.battingOrderIds ?? []).filter((id, index, ids) => playerIds.has(id) && ids.indexOf(id) === index);
  const missing = sortBattingCandidates(players)
    .map((player) => player.id)
    .filter((id) => !validOrder.includes(id));
  const battingOrderIds = [...validOrder, ...missing].slice(0, Math.min(9, players.length));
  const pitchers = sortPitchingCandidates(players);
  const startingPitcherId = lineup?.startingPitcherId && playerIds.has(lineup.startingPitcherId)
    ? lineup.startingPitcherId
    : pitchers[0]?.id;
  const reliefPitcherId = lineup?.reliefPitcherId && playerIds.has(lineup.reliefPitcherId)
    ? lineup.reliefPitcherId
    : pitchers.find((player) => player.id !== startingPitcherId)?.id;
  const captainId = lineup?.captainId && playerIds.has(lineup.captainId)
    ? lineup.captainId
    : [...players].sort((a, b) => b.trust + b.mental - (a.trust + a.mental))[0]?.id;

  return {
    battingOrderIds,
    startingPitcherId,
    reliefPitcherId,
    captainId,
  };
};

export const getBenchPlayers = (lineup: TeamLineup, players: Player[]): Player[] => {
  const activeIds = new Set(lineup.battingOrderIds);
  if (lineup.startingPitcherId) activeIds.add(lineup.startingPitcherId);
  return players.filter((player) => !activeIds.has(player.id));
};

export const moveBattingOrder = (lineup: TeamLineup, playerId: string, direction: -1 | 1): TeamLineup => {
  const index = lineup.battingOrderIds.indexOf(playerId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= lineup.battingOrderIds.length) return lineup;
  const next = [...lineup.battingOrderIds];
  [next[index], next[target]] = [next[target], next[index]];
  return { ...lineup, battingOrderIds: next };
};

export const swapInBattingOrder = (lineup: TeamLineup, slotIndex: number, playerId: string): TeamLineup => {
  if (slotIndex < 0 || slotIndex >= lineup.battingOrderIds.length) return lineup;
  const next = [...lineup.battingOrderIds];
  const existingIndex = next.indexOf(playerId);
  if (existingIndex >= 0) {
    [next[slotIndex], next[existingIndex]] = [next[existingIndex], next[slotIndex]];
  } else {
    next[slotIndex] = playerId;
  }
  return { ...lineup, battingOrderIds: next };
};

export const getActiveLineupPlayers = (lineup: TeamLineup, players: Player[]): Player[] => {
  const order = lineup.battingOrderIds
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player));
  const pitcher = players.find((player) => player.id === lineup.startingPitcherId);
  if (pitcher && !order.some((player) => player.id === pitcher.id)) return [...order, pitcher];
  return order.length > 0 ? order : players;
};
