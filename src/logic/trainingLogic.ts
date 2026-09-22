import type { Facility, GameState, TrainingMenu, TrainingResult } from "../types/game";
import type { AbilityKey, Injury, InjurySeverity, Player } from "../types/player";
import { clamp, clampFloat, randomBetween } from "./rand";
import { calculateTeamRank } from "./rankLogic";

const trainableAbilityKeys: AbilityKey[] = [
  "power",
  "contact",
  "speed",
  "arm",
  "defense",
  "catching",
  "velocity",
  "control",
  "stamina",
  "breakingBall",
  "mental",
  "trust",
  "mood",
  "fatigue",
];

const facilityIdsByTraining: Record<TrainingMenu["id"], Facility["id"][]> = {
  batting: ["ground", "indoor"],
  fielding: ["ground", "indoor"],
  running: ["ground", "dorm"],
  pitching: ["ground", "clinic"],
  teamwork: ["clubhouse", "ground"],
  meeting: ["clubhouse", "dataRoom"],
  rest: ["cafeteria", "clinic", "dorm"],
};

const growthTypeMultiplier: Record<Player["growthType"], number> = {
  早熟: 1.04,
  普通: 1,
  晩成: 1.08,
  天才肌: 1.14,
};

const injuryEfficiency = (injury?: Injury): number => {
  if (!injury) return 1;
  if (injury.severity === "軽傷") return 0.75;
  if (injury.severity === "中傷") return 0.45;
  return 0;
};

const getFacilityModifier = (menu: TrainingMenu, facilities: Facility[]): number => {
  const ids = facilityIdsByTraining[menu.id];
  const totalLevel = facilities
    .filter((facility) => ids.includes(facility.id))
    .reduce((sum, facility) => sum + facility.level, 0);
  return 1 + totalLevel * 0.04;
};

const createInjury = (fatigue: number, clinicLevel: number): Injury | undefined => {
  const injuryRoll = Math.random();
  const prevention = clinicLevel * 0.018;
  const risk = clampFloat(0.06 + Math.max(0, fatigue - 78) * 0.012 - prevention, 0.03, 0.34);
  if (injuryRoll > risk) return undefined;

  const severityRoll = Math.random();
  let severity: InjurySeverity = "軽傷";
  let weeksRemaining = 1;
  if (severityRoll > 0.82) {
    severity = "重傷";
    weeksRemaining = 4;
  } else if (severityRoll > 0.48) {
    severity = "中傷";
    weeksRemaining = 2;
  }
  return { severity, weeksRemaining };
};

export const applyTraining = (
  state: GameState,
  players: Player[],
  facilities: Facility[],
  menu: TrainingMenu,
): { state: GameState; players: Player[]; result: TrainingResult } => {
  if (state.actionPower < menu.actionCost) {
    return {
      state: {
        ...state,
        notifications: ["行動力が不足しています。", ...state.notifications].slice(0, 8),
      },
      players,
      result: {
        success: false,
        title: "行動力が不足しています。",
        message: "今週は休養か、軽めのメニューに切り替えましょう。",
        changes: [],
        actionCost: 0,
      },
    };
  }

  const facilityModifier = getFacilityModifier(menu, facilities);
  const clinicLevel = facilities.find((facility) => facility.id === "clinic")?.level ?? 1;
  const dormLevel = facilities.find((facility) => facility.id === "dorm")?.level ?? 1;
  const cafeteriaLevel = facilities.find((facility) => facility.id === "cafeteria")?.level ?? 1;
  const rainPenalty = state.weather === "雨" && menu.id !== "rest" ? 0.88 : 1;
  const indoorLevel = facilities.find((facility) => facility.id === "indoor")?.level ?? 1;
  const weatherModifier = state.weather === "雨" ? rainPenalty + indoorLevel * 0.02 : 1;

  const changes: TrainingResult["changes"] = [];
  const nextPlayers = players.map((player) => {
    const efficiency = injuryEfficiency(player.injury);
    const moodModifier = 0.75 + (player.mood / 100) * 0.5;
    const fatigueModifier = 1.1 - (player.fatigue / 100) * 0.5;
    const randomModifier = randomBetween(0.85, 1.15);
    const trainingMultiplier =
      growthTypeMultiplier[player.growthType] *
      (menu.id === "pitching" && player.position !== "投手" ? 0.35 : 1);

    const growthAmount =
      menu.baseTrainingValue *
      trainingMultiplier *
      player.talent *
      moodModifier *
      fatigueModifier *
      facilityModifier *
      weatherModifier *
      randomModifier *
      efficiency;

    const gains: Partial<Record<AbilityKey, number>> = {};
    let updated: Player = { ...player };

    trainableAbilityKeys.forEach((key) => {
      const weight = menu.effects[key];
      if (!weight) return;

      if (key === "fatigue") {
        const recoveryBoost = menu.id === "rest" || menu.id === "meeting" ? 1 + cafeteriaLevel * 0.05 : 1;
        const delta = weight * growthAmount * recoveryBoost;
        updated = { ...updated, fatigue: clamp(updated.fatigue + delta, 0, 100) };
        gains.fatigue = Math.round(delta);
        return;
      }

      const rawDelta = growthAmount * weight;
      const delta = rawDelta >= 1 ? Math.round(rawDelta) : Math.random() < rawDelta ? 1 : 0;
      if (delta <= 0) return;
      updated = { ...updated, [key]: clamp(updated[key] + delta, 0, 100) };
      gains[key] = delta;
    });

    if (menu.id === "rest") {
      const recovery = Math.abs(menu.fatigueChange) + cafeteriaLevel * 2 + clinicLevel;
      updated = {
        ...updated,
        fatigue: clamp(updated.fatigue - recovery, 0, 100),
        mood: clamp(updated.mood + 3 + dormLevel, 0, 100),
      };
      if (updated.injury && Math.random() < 0.35 + clinicLevel * 0.05) {
        const weeksRemaining = updated.injury.weeksRemaining - 1;
        if (weeksRemaining <= 0) {
          const { injury: _injury, ...rest } = updated;
          updated = rest;
        } else {
          updated = { ...updated, injury: { ...updated.injury, weeksRemaining } };
        }
      }
      gains.fatigue = -recovery;
      gains.mood = (gains.mood ?? 0) + 3 + dormLevel;
    } else {
      updated = {
        ...updated,
        fatigue: clamp(updated.fatigue + menu.fatigueChange, 0, 100),
        exp: updated.exp + Math.round(growthAmount * 4),
      };
      gains.fatigue = (gains.fatigue ?? 0) + menu.fatigueChange;
      if (menu.id !== "meeting" && updated.fatigue >= 82) {
        const moodDrop = updated.fatigue >= 92 ? 6 : 3;
        updated = { ...updated, mood: clamp(updated.mood - moodDrop, 0, 100) };
        gains.mood = (gains.mood ?? 0) - moodDrop;
      }
    }

    let injuryMessage: string | undefined;
    if (menu.id !== "rest" && menu.id !== "meeting" && updated.fatigue >= 80 && !player.injury) {
      const injury = createInjury(updated.fatigue, clinicLevel);
      if (injury) {
        updated = { ...updated, injury };
        injuryMessage = `${injury.severity}：${injury.weeksRemaining}週`;
      }
    }

    changes.push({
      playerId: player.id,
      playerName: player.name,
      gains,
      injury: injuryMessage,
    });

    return updated;
  });

  const gainedGrowthPoints = menu.id === "rest" ? 0 : Math.max(1, Math.round(players.length * 0.8));
  const notifications = [
    "練習の成果が出ました！",
    menu.id === "rest" ? "少し疲れが見えます。休養で立て直しました。" : "選手たちの動きが良くなってきました。",
    ...changes.filter((change) => change.injury).map((change) => `${change.playerName}が${change.injury}の怪我をしました。`),
    ...state.notifications,
  ].slice(0, 8);

  return {
    state: {
      ...state,
      actionPower: clampFloat(state.actionPower - menu.actionCost, 0, state.maxActionPower),
      growthPoints: state.growthPoints + gainedGrowthPoints,
      teamRank: calculateTeamRank(nextPlayers),
      notifications,
    },
    players: nextPlayers,
    result: {
      success: true,
      title: "練習の成果が出ました！",
      message:
        menu.id === "teamwork" || menu.id === "meeting"
          ? "チームの雰囲気が良くなりました。"
          : "選手たちの動きが良くなってきました。",
      changes,
      actionCost: menu.actionCost,
    },
  };
};
