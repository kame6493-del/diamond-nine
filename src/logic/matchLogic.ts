import type { Facility, GameState, MatchResult, MatchType, TeamRank, TournamentId } from "../types/game";
import type { Player, SpecialAbility } from "../types/player";
import { average, rankToScore } from "./rankLogic";
import { clamp, clampFloat, createId, pickOne, randomBetween } from "./rand";
import { getTournamentDisplayName } from "./tournamentLogic";

export interface TeamPower {
  offense: number;
  defense: number;
  pitching: number;
  total: number;
}

export interface SimulateMatchOptions {
  forcedOpponentRank?: TeamRank;
  matchType?: MatchType;
  tournamentId?: TournamentId;
  tournamentName?: string;
  round?: number;
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

const hasAbility = (player: Player, ability: SpecialAbility): boolean =>
  player.specialAbilities.includes(ability);

const abilityCount = (players: Player[], ability: SpecialAbility): number =>
  players.filter((player) => hasAbility(player, ability)).length;

const boostedAverage = (
  players: Player[],
  key: keyof Pick<Player, "speed" | "defense" | "arm">,
  ability: SpecialAbility,
  bonus: number,
): number => average(players.map((player) => player[key] + (hasAbility(player, ability) ? bonus : 0)));

export const calculateTeamPower = (players: Player[]): TeamPower => {
  if (players.length === 0) {
    return { offense: 1, defense: 1, pitching: 1, total: 1 };
  }

  const pitcher = getAcePitcher(players);
  const averageContact = average(players.map((player) => player.contact));
  const averagePower = average(players.map((player) => player.power));
  const averageSpeed = boostedAverage(players, "speed", "盗塁上手", 8);
  const averageMood = average(players.map((player) => player.mood)) + abilityCount(players, "ムード○") * 2.5;
  const averageTrust = average(players.map((player) => player.trust));

  const chanceBonus = abilityCount(players, "チャンス強い") * 0.75;
  const stickyBonus = abilityCount(players, "粘り打ち") * 0.55;
  const offense =
    averageContact * 0.34 +
    averagePower * 0.29 +
    averageSpeed * 0.21 +
    averageMood * 0.1 +
    averageTrust * 0.05 +
    chanceBonus +
    stickyBonus;

  const defense =
    boostedAverage(players, "defense", "堅守", 8) * 0.35 +
    average(players.map((player) => player.catching)) * 0.3 +
    boostedAverage(players, "arm", "強肩", 8) * 0.2 +
    pitcher.control * 0.1 +
    averageTrust * 0.05;

  const pitching =
    pitcher.velocity * 0.25 +
    pitcher.control * 0.3 +
    pitcher.stamina * 0.25 +
    pitcher.breakingBall * 0.15 +
    pitcher.mental * 0.05 +
    (hasAbility(pitcher, "ピンチ強い") ? 3.5 : 0) +
    (hasAbility(pitcher, "尻上がり") ? 2.5 : 0);

  return {
    offense: Math.min(100, offense),
    defense: Math.min(100, defense),
    pitching: Math.min(100, pitching),
    total: Math.min(100, offense * 0.36 + defense * 0.28 + pitching * 0.36),
  };
};

export const getStrategySuccessRate = (
  baseSuccessRate: number,
  player: Player,
  facilities: Facility[],
): number => {
  const personalityBonus =
    player.personality === "冷静" || player.personality === "勝負師"
      ? 8
      : player.personality === "お調子者"
        ? -3
        : 3;
  const moodBonus = (player.mood - 50) * 0.12;
  const dataRoomBonus = (facilities.find((facility) => facility.id === "dataRoom")?.level ?? 1) * 2;
  return clamp(baseSuccessRate + player.trust * 0.25 + personalityBonus + moodBonus + dataRoomBonus, 5, 95);
};

const opponentRankByDate = (state: GameState): TeamRank => {
  if (state.month === 8) return state.reputation > 60 ? "B" : "C";
  if (state.month === 7) return state.reputation > 50 ? "C" : "D";
  if (state.month === 10) return state.reputation > 45 ? "D" : "E";
  if (state.month === 4) return state.reputation > 40 ? "D" : "E";
  return "F";
};

export const getScheduledMatchName = (state: GameState): string | undefined =>
  getTournamentDisplayName(state);

const normalizeOptions = (options?: TeamRank | SimulateMatchOptions): SimulateMatchOptions => {
  if (!options) return {};
  if (typeof options === "string") return { forcedOpponentRank: options };
  return options;
};

const scoringPlayerName = (players: Player[]): string => {
  const fielders = players.filter((player) => player.position !== "投手");
  return pickOne(fielders.length > 0 ? fielders : players).name;
};

const makeRunLog = (
  inning: number,
  side: "表" | "裏",
  teamName: string,
  runs: number,
  playerName?: string,
): string => {
  if (runs >= 3) return `${inning}回${side}、${teamName}が一挙${runs}点！ベンチが総立ちです。`;
  if (runs === 2) return `${inning}回${side}、${teamName}が連打で2点を追加。`;
  if (playerName) return `${inning}回${side}、${playerName}のタイムリーで${teamName}が1点！`;
  return `${inning}回${side}、${teamName}が1点を返しました。`;
};

const simulateInningRuns = (
  attack: number,
  runPrevention: number,
  inning: number,
  isBehind: boolean,
  specialPressure: number,
): number => {
  const lateGame = inning >= 7 ? 0.03 : 0;
  const behindBonus = isBehind ? specialPressure : 0;
  const chance = clampFloat(0.22 + (attack - runPrevention) * 0.007 + lateGame + behindBonus, 0.04, 0.72);
  if (Math.random() > chance) return 0;

  let runs = 1;
  if (Math.random() < chance * 0.48) runs += 1;
  if (Math.random() < chance * 0.22) runs += 1;
  if (Math.random() < Math.max(0, attack - runPrevention) * 0.004) runs += 1;
  return Math.min(5, runs);
};

const simulateScore = (
  players: Player[],
  teamPower: TeamPower,
  opponentBase: number,
  strategyBonus: number,
): { ourScore: number; opponentScore: number; inningLogs: string[] } => {
  let ourScore = 0;
  let opponentScore = 0;
  const inningLogs: string[] = ["1回表、静かな立ち上がり。両軍ベンチが流れを探ります。"];
  const adversityBonus = abilityCount(players, "逆境") > 0 ? 0.08 : 0.02;
  const stickyPressure = abilityCount(players, "粘り打ち") * 0.008;
  const chancePressure = abilityCount(players, "チャンス強い") * 0.01;
  const pitcher = getAcePitcher(players);
  const latePitchingBonus = hasAbility(pitcher, "尻上がり") ? 4 : 0;
  const pinchBonus = hasAbility(pitcher, "ピンチ強い") ? 3 : 0;

  for (let inning = 1; inning <= 9; inning += 1) {
    const ourRuns = simulateInningRuns(
      teamPower.offense + strategyBonus + stickyPressure * 100 + chancePressure * 100,
      opponentBase,
      inning,
      ourScore < opponentScore,
      adversityBonus,
    );
    if (ourRuns > 0) {
      ourScore += ourRuns;
      inningLogs.push(makeRunLog(inning, "表", "青空高校", ourRuns, scoringPlayerName(players)));
    }

    const prevention = (teamPower.defense + teamPower.pitching) / 2 + (inning >= 6 ? latePitchingBonus : 0) + pinchBonus;
    const opponentRuns = simulateInningRuns(opponentBase, prevention, inning, opponentScore < ourScore, 0.03);
    if (opponentRuns > 0) {
      opponentScore += opponentRuns;
      inningLogs.push(makeRunLog(inning, "裏", "相手校", opponentRuns));
    }

    if (inning === 5 && ourScore === opponentScore) {
      inningLogs.push("5回終了、互いに譲らない展開。ミーティングで守備位置を確認します。");
    }
    if (inning === 7 && ourScore < opponentScore && abilityCount(players, "逆境") > 0) {
      inningLogs.push("7回表、逆境に強い選手たちがベンチを鼓舞しています。");
    }
  }

  if (ourScore === opponentScore) {
    const ourExtra = simulateInningRuns(teamPower.offense + strategyBonus + 4, opponentBase, 10, false, adversityBonus);
    const opponentExtra = simulateInningRuns(opponentBase, (teamPower.defense + teamPower.pitching) / 2, 10, false, 0.03);
    ourScore += ourExtra;
    opponentScore += opponentExtra;
    inningLogs.push("延長10回、タイブレークの緊張感がグラウンドを包みます。");
    if (ourScore === opponentScore) {
      if (teamPower.total + strategyBonus >= opponentBase + randomBetween(-5, 5)) {
        ourScore += 1;
        inningLogs.push(`延長10回表、${scoringPlayerName(players)}が執念の勝ち越し打！`);
      } else {
        opponentScore += 1;
        inningLogs.push("延長10回裏、相手校にサヨナラ打を浴びました。");
      }
    }
  }

  inningLogs.push(
    ourScore > opponentScore
      ? "9回裏、最後の打球をさばいて試合終了！守り切りました。"
      : "9回裏、反撃は届かず試合終了。それでも経験値は残ります。",
  );

  return { ourScore, opponentScore, inningLogs };
};

export const simulateMatch = (
  state: GameState,
  players: Player[],
  facilities: Facility[],
  options?: TeamRank | SimulateMatchOptions,
): { state: GameState; players: Player[]; result: MatchResult } => {
  const normalized = normalizeOptions(options);
  const matchType = normalized.matchType ?? "practice";
  const teamPower = calculateTeamPower(players);
  const opponentRank = normalized.forcedOpponentRank ?? opponentRankByDate(state);
  const opponentBase = rankToScore(opponentRank) + randomBetween(-5, 6) + (matchType === "official" ? 2 : 0);
  const strategyPlayer = pickOne(players);
  const strategyRate = getStrategySuccessRate(matchType === "official" ? 42 : 48, strategyPlayer, facilities);
  const strategySuccess = Math.random() * 100 <= strategyRate;
  const strategyBonus = strategySuccess ? randomBetween(1.5, 5.5) : randomBetween(-2.5, 0.5);

  const score = simulateScore(players, teamPower, opponentBase, strategyBonus);
  const isWin = score.ourScore > score.opponentScore;
  const starPlayer = pickOne(players);
  const round = normalized.round ?? 0;
  const officialBonus = matchType === "official" ? Math.max(1, round) : 0;
  const growthPoints = isWin ? 16 + officialBonus * 4 : 9 + officialBonus;
  const fundsGained = isWin ? 700 + officialBonus * 260 : 280 + officialBonus * 120;
  const reputationChange = isWin ? 3 + officialBonus : matchType === "official" ? 0 : -1;

  const nextPlayers = players.map((player) => ({
    ...player,
    trust: clamp(player.trust + (isWin ? 4 + officialBonus : 2), 0, 100),
    mood: clamp(player.mood + (isWin ? 6 : -4), 0, 100),
    fatigue: clamp(player.fatigue + (matchType === "official" ? 10 : 7), 0, 100),
    exp: player.exp + (isWin ? 16 + officialBonus * 3 : 9 + officialBonus),
  }));

  const title = normalized.tournamentName
    ? `${normalized.tournamentName}${round}回戦`
    : matchType === "official"
      ? "公式戦"
      : "練習試合";
  const summary = isWin
    ? `${title}に勝利しました。${strategySuccess ? "作戦もはまり、" : ""}終盤まで集中を切らしませんでした。`
    : `${title}は惜敗。課題は残りましたが、次につながる内容です。`;

  const result: MatchResult = {
    id: createId("match"),
    date: `${state.year}年目 ${state.month}月${state.week}週`,
    matchType,
    tournamentId: normalized.tournamentId,
    tournamentName: normalized.tournamentName,
    round: normalized.round,
    opponentName: pickOne(opponentNames),
    opponentRank,
    ourScore: score.ourScore,
    opponentScore: score.opponentScore,
    isWin,
    starPlayerId: starPlayer.id,
    starPlayerName: starPlayer.name,
    growthPoints,
    fundsGained,
    reputationChange,
    summary,
    inningLogs: score.inningLogs,
  };

  return {
    state: {
      ...state,
      funds: state.funds + fundsGained,
      growthPoints: state.growthPoints + growthPoints,
      reputation: clamp(state.reputation + reputationChange, 0, 100),
      notifications: [
        isWin ? "見事な勝利です！" : "惜しくも敗れました。",
        `${result.opponentName}戦 ${score.ourScore}-${score.opponentScore}`,
        ...state.notifications,
      ].slice(0, 8),
    },
    players: nextPlayers,
    result,
  };
};
