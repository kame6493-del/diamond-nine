import type { Facility, GameState } from "../types/game";
import type { Player, ScoutingCandidate, SpecialAbility } from "../types/player";
import { initialPlayers, initialScoutingCandidates } from "../data/initialPlayers";
import { initialFacilities } from "../data/facilities";
import { calculateTeamRank } from "./rankLogic";
import { clamp, createId, pickOne, randomBetween } from "./rand";

const names = [
  "橘 透",
  "水野 航",
  "倉田 柊",
  "藤堂 陸",
  "花村 蒼",
  "片桐 智",
  "南 雫",
  "結城 響",
  "成瀬 匠",
  "有馬 礼",
];

const specialAbilities: SpecialAbility[] = [
  "チャンス強い",
  "粘り打ち",
  "盗塁上手",
  "堅守",
  "強肩",
  "逆境",
  "ムード○",
  "尻上がり",
  "ピンチ強い",
];

export const createInitialGameState = (): GameState => ({
  year: 1,
  month: 4,
  week: 1,
  actionPower: 100,
  maxActionPower: 100,
  funds: 3000,
  growthPoints: 0,
  scoutPoints: 4,
  reputation: 28,
  teamRank: calculateTeamRank(initialPlayers),
  daysUntilTournament: 21,
  weather: "晴れ",
  notifications: ["新年度が始まりました。弱小校から、まずは一勝を目指しましょう。"],
  incomingRecruits: [],
  retiredSeniors: [],
  qualifiedForNational: false,
  seasonPerformance: 0,
  lastYearPerformance: 0,
  lastRetirementYear: 0,
});

export const createInitialFacilities = (): Facility[] =>
  initialFacilities.map((facility) => ({ ...facility }));

export const createInitialPlayers = (): Player[] =>
  initialPlayers.map((player) => ({ ...player, specialAbilities: [...player.specialAbilities] }));

export const createInitialScoutingCandidates = (): ScoutingCandidate[] =>
  initialScoutingCandidates.map((player) => ({
    ...player,
    specialAbilities: [...player.specialAbilities],
  }));

const positionPool: Player["position"][] = [
  "投手",
  "捕手",
  "一塁手",
  "二塁手",
  "三塁手",
  "遊撃手",
  "外野手",
];

const personalityPool: Player["personality"][] = [
  "まじめ",
  "熱血",
  "冷静",
  "お調子者",
  "努力家",
  "勝負師",
];

const growthPool: Player["growthType"][] = ["早熟", "普通", "晩成", "天才肌"];
const handednessPool: Player["handedness"][] = ["右投右打", "右投左打", "左投左打", "左投右打"];

export const generatePlayer = (quality = 45, prefix = "r"): Player => {
  const position = pickOne(positionPool);
  const talent = randomBetween(0.92, 1.18);
  const ability = () => clamp(randomBetween(quality - 12, quality + 16), 1, 100);
  const pitcherBoost = position === "投手" ? 10 : 0;
  const fieldingBoost = position !== "投手" ? 7 : 0;
  const abilityCount = Math.random() > 0.78 ? 1 : 0;

  return {
    id: createId(prefix),
    name: pickOne(names),
    year: 1,
    position,
    handedness: pickOne(handednessPool),
    personality: pickOne(personalityPool),
    growthType: pickOne(growthPool),
    talent,
    power: ability(),
    contact: ability(),
    speed: ability(),
    arm: clamp(ability() + fieldingBoost + pitcherBoost * 0.4, 1, 100),
    defense: clamp(ability() + fieldingBoost, 1, 100),
    catching: clamp(ability() + (position === "捕手" ? 12 : 0), 1, 100),
    velocity: clamp(ability() + pitcherBoost, 1, 100),
    control: clamp(ability() + pitcherBoost, 1, 100),
    stamina: clamp(ability() + pitcherBoost, 1, 100),
    breakingBall: clamp(ability() + pitcherBoost, 1, 100),
    mental: ability(),
    trust: 20,
    mood: clamp(randomBetween(45, 72), 0, 100),
    fatigue: 0,
    specialAbilities: Array.from({ length: abilityCount }, () => pickOne(specialAbilities)),
    exp: 0,
  };
};

const uniqueSpecialAbilities = (abilities: SpecialAbility[]): SpecialAbility[] =>
  Array.from(new Set(abilities));

const applyRecruitArchetype = (player: Player, quality: number): Player => {
  const roll = Math.random();
  if (roll < 0.04) {
    return {
      ...player,
      growthType: "天才肌",
      talent: randomBetween(1.24, 1.42),
      mental: clamp(player.mental + 10, 1, 100),
      mood: clamp(player.mood + 8, 0, 100),
      specialAbilities: uniqueSpecialAbilities([...player.specialAbilities, pickOne(["逆境", "ムード○", "チャンス強い"])]),
    };
  }
  if (roll < 0.08) {
    return {
      ...player,
      position: "投手",
      talent: Math.max(player.talent, randomBetween(1.12, 1.3)),
      velocity: clamp(quality + randomBetween(18, 30), 1, 100),
      control: clamp(quality + randomBetween(10, 22), 1, 100),
      stamina: clamp(quality + randomBetween(12, 26), 1, 100),
      breakingBall: clamp(quality + randomBetween(8, 22), 1, 100),
      specialAbilities: uniqueSpecialAbilities([...player.specialAbilities, "ピンチ強い", "尻上がり"]),
    };
  }
  if (roll < 0.13) {
    return {
      ...player,
      speed: clamp(quality + randomBetween(20, 34), 1, 100),
      contact: clamp(player.contact + 6, 1, 100),
      specialAbilities: uniqueSpecialAbilities([...player.specialAbilities, "盗塁上手", "粘り打ち"]),
    };
  }
  if (roll < 0.18) {
    return {
      ...player,
      defense: clamp(quality + randomBetween(18, 30), 1, 100),
      catching: clamp(quality + randomBetween(14, 28), 1, 100),
      arm: clamp(quality + randomBetween(12, 26), 1, 100),
      specialAbilities: uniqueSpecialAbilities([...player.specialAbilities, "堅守", "強肩"]),
    };
  }
  return player;
};

export const generateAnnualRecruits = (
  reputation: number,
  scoutRoomLevel: number,
  lastYearPerformance: number,
  minimumCount = 3,
): Player[] => {
  const count = clamp(
    minimumCount + (reputation >= 45 ? 1 : 0) + (lastYearPerformance >= 16 ? 1 : 0),
    3,
    5,
  );
  const baseQuality = 36 + reputation * 0.22 + scoutRoomLevel * 2.4 + lastYearPerformance * 0.55;
  return Array.from({ length: count }, () => {
    const quality = baseQuality + randomBetween(-7, 9);
    return applyRecruitArchetype(generatePlayer(quality, "n"), quality);
  });
};

export const generateScoutingCandidate = (
  reputation: number,
  scoutRoomLevel: number,
): ScoutingCandidate => {
  const quality = 42 + reputation * 0.25 + scoutRoomLevel * 3 + randomBetween(-6, 10);
  const player = generatePlayer(quality, "s");
  return {
    ...player,
    scoutCost: clamp(500 + quality * 8 + randomBetween(0, 240), 350, 1500),
    scoutPointCost: clamp(Math.floor(quality / 24), 1, 5),
    promiseLevel: clamp(quality + randomBetween(5, 20), 35, 95),
  };
};
