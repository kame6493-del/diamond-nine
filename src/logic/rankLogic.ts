import type { Player } from "../types/player";
import type { TeamRank } from "../types/game";

export const getAbilityRank = (value: number): TeamRank => {
  if (value >= 90) return "S";
  if (value >= 80) return "A";
  if (value >= 70) return "B";
  if (value >= 60) return "C";
  if (value >= 50) return "D";
  if (value >= 40) return "E";
  if (value >= 30) return "F";
  return "G";
};

export const rankToScore = (rank: TeamRank): number => {
  const scores: Record<TeamRank, number> = {
    S: 92,
    A: 82,
    B: 72,
    C: 62,
    D: 52,
    E: 42,
    F: 34,
    G: 24,
  };
  return scores[rank];
};

export const average = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const calculateTeamOverall = (players: Player[]): number => {
  if (players.length === 0) return 1;
  const fielders = players.filter((player) => player.position !== "投手");
  const pitchers = players.filter((player) => player.position === "投手");
  const targetFielders = fielders.length > 0 ? fielders : players;
  const targetPitchers = pitchers.length > 0 ? pitchers : players;

  const offense =
    average(targetFielders.map((player) => player.contact)) * 0.35 +
    average(targetFielders.map((player) => player.power)) * 0.3 +
    average(targetFielders.map((player) => player.speed)) * 0.2 +
    average(players.map((player) => player.mood)) * 0.1 +
    average(players.map((player) => player.trust)) * 0.05;

  const defense =
    average(players.map((player) => player.defense)) * 0.35 +
    average(players.map((player) => player.catching)) * 0.3 +
    average(players.map((player) => player.arm)) * 0.2 +
    average(targetPitchers.map((player) => player.control)) * 0.1 +
    average(players.map((player) => player.trust)) * 0.05;

  const pitching =
    average(targetPitchers.map((player) => player.velocity)) * 0.25 +
    average(targetPitchers.map((player) => player.control)) * 0.3 +
    average(targetPitchers.map((player) => player.stamina)) * 0.25 +
    average(targetPitchers.map((player) => player.breakingBall)) * 0.15 +
    average(targetPitchers.map((player) => player.mental)) * 0.05;

  return offense * 0.35 + defense * 0.3 + pitching * 0.35;
};

export const calculateTeamRank = (players: Player[]): TeamRank =>
  getAbilityRank(calculateTeamOverall(players));
