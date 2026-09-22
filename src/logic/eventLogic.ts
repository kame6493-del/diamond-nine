import type { EventLogItem, Facility, GameState } from "../types/game";
import type { Player } from "../types/player";
import { randomEvents, toLogItem } from "../data/events";
import { pickOne } from "./rand";

export const getDateLabel = (state: GameState): string =>
  `${state.year}年目 ${state.month}月${state.week}週`;

export const applyRandomEvent = (
  state: GameState,
  players: Player[],
  facilities: Facility[],
): { state: GameState; players: Player[]; log?: EventLogItem } => {
  const clubhouseLevel = facilities.find((facility) => facility.id === "clubhouse")?.level ?? 1;
  const eventChance = 0.32 + clubhouseLevel * 0.015;
  if (Math.random() > eventChance) {
    return { state, players };
  }

  const event = pickOne(randomEvents);
  const applied = event.apply(players, state);
  return {
    state: {
      ...applied.state,
      notifications: [event.title, applied.message, ...state.notifications].slice(0, 8),
    },
    players: applied.players,
    log: toLogItem(event.title, applied.message, getDateLabel(state)),
  };
};
