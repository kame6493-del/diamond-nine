import type { Facility, GameState } from "../types/game";
import type { Player } from "../types/player";
import { calculateTeamRank } from "./rankLogic";
import { clamp, pickOne } from "./rand";
import { generateAnnualRecruits } from "./teamLogic";

const weatherPool: GameState["weather"][] = ["晴れ", "晴れ", "くもり", "雨"];

const tournamentDistance = (month: number, week: number): number => {
  const current = (month - 1) * 4 + week;
  const tournaments = [
    4 * 4,
    (7 - 1) * 4 + 2,
    (8 - 1) * 4 + 2,
    (10 - 1) * 4 + 2,
  ];
  const next = tournaments.find((value) => value >= current) ?? tournaments[0] + 48;
  return Math.max(0, (next - current) * 7);
};

const tickInjuries = (players: Player[]): Player[] =>
  players.map((player) => {
    if (!player.injury) return player;
    const weeksRemaining = player.injury.weeksRemaining - 1;
    if (weeksRemaining <= 0) {
      const { injury: _injury, ...rest } = player;
      return rest;
    }
    return { ...player, injury: { ...player.injury, weeksRemaining } };
  });

const getScoutRoomLevel = (facilities: Facility[]): number =>
  facilities.find((facility) => facility.id === "scoutRoom")?.level ?? 1;

export const retireThirdYears = (
  state: GameState,
  players: Player[],
): { state: GameState; players: Player[]; message?: string } => {
  if (state.lastRetirementYear === state.year) {
    return { state, players };
  }

  const seniors = players.filter((player) => player.year === 3);
  if (seniors.length === 0) {
    return { state, players };
  }

  const trustBonus = Math.min(12, 4 + seniors.length * 2);
  const nextPlayers = players
    .filter((player) => player.year < 3)
    .map((player) => ({
      ...player,
      trust: clamp(player.trust + trustBonus, 0, 100),
      mood: clamp(player.mood + 3, 0, 100),
    }));

  const names = seniors.map((player) => player.name).join("、");
  const message = `3年生が引退しました。${names}の背中を受け、後輩の信頼度が+${trustBonus}。`;

  return {
    state: {
      ...state,
      retiredSeniors: [...state.retiredSeniors, ...seniors],
      lastRetirementYear: state.year,
      notifications: [message, ...state.notifications].slice(0, 8),
    },
    players: nextPlayers,
    message,
  };
};

export const getAnnualEventMessage = (
  state: GameState,
  players: Player[],
  facilities: Facility[] = [],
): { players: Player[]; state: GameState; messages: string[] } => {
  const messages: string[] = [];
  let nextPlayers = players;
  let nextState = state;

  if (state.month === 4 && state.week === 1) {
    const scoutRoomLevel = getScoutRoomLevel(facilities);
    const targetCount = clamp(
      3 + (state.reputation >= 45 ? 1 : 0) + (state.lastYearPerformance >= 16 ? 1 : 0),
      3,
      5,
    );
    const promised = state.incomingRecruits.map((player) => ({
      ...player,
      year: 1 as const,
      fatigue: 0,
      trust: 20,
      injury: undefined,
    }));
    const generatedCount = Math.max(0, targetCount - promised.length);
    const generated = generateAnnualRecruits(
      state.reputation,
      scoutRoomLevel,
      state.lastYearPerformance,
      generatedCount,
    ).slice(0, generatedCount);
    const recruits = [...promised, ...generated];

    nextPlayers = [...players, ...recruits];
    nextState = { ...nextState, incomingRecruits: [] };

    const rare = recruits.filter(
      (player) =>
        player.growthType === "天才肌" ||
        player.specialAbilities.includes("尻上がり") ||
        player.specialAbilities.includes("盗塁上手") ||
        player.specialAbilities.includes("堅守"),
    );
    messages.push(
      rare.length > 0
        ? `新入生${recruits.length}人が加入。注目株は${rare.map((player) => player.name).join("、")}です。`
        : `新入生${recruits.length}人が加入しました。春の風がグラウンドに来ています。`,
    );
  }

  if (state.month === 6 && state.week === 1) {
    messages.push("夏大会前の追い込みです。疲労管理が勝負の分かれ目です。");
  }

  if (state.month === 8 && state.week === 2 && !state.qualifiedForNational && !state.activeTournament) {
    nextPlayers = nextPlayers.map((player) => ({
      ...player,
      mood: clamp(player.mood + 6, 0, 100),
      trust: clamp(player.trust + 4, 0, 100),
      fatigue: clamp(player.fatigue + 5, 0, 100),
      stamina: clamp(player.stamina + 1, 1, 100),
    }));
    messages.push("夏合宿でチームの空気が一段引き締まりました。全国へ届かなかった悔しさも練習に変えます。");
  }

  if (state.month === 9 && state.week === 1 && state.lastRetirementYear !== state.year) {
    const retired = retireThirdYears(nextState, nextPlayers);
    nextState = retired.state;
    nextPlayers = retired.players;
    if (retired.message) messages.push(retired.message);
  }

  if (state.month === 10 && state.week === 1) {
    messages.push("秋大会準備が始まりました。新チームの守備連携を固めたい時期です。");
  }

  if (state.month === 12 && state.week === 1) {
    nextPlayers = nextPlayers.map((player) => ({
      ...player,
      stamina: clamp(player.stamina + 2, 1, 100),
      mental: clamp(player.mental + 2, 1, 100),
    }));
    messages.push("冬トレが始まりました。地味な積み重ねが春に効きます。");
  }

  if (state.month === 1 && state.week === 1) {
    nextPlayers = nextPlayers.map((player) => ({
      ...player,
      mood: clamp(player.mood + 8, 0, 100),
    }));
    nextState = { ...nextState, scoutPoints: nextState.scoutPoints + 1 };
    messages.push("初詣でチームの健康と一勝をお願いしました。");
  }

  if (state.month === 2 && state.week === 1) {
    nextState = { ...nextState, scoutPoints: nextState.scoutPoints + 2 };
    messages.push("スカウトの季節です。地域の注目選手を見に行けます。");
  }

  return { players: nextPlayers, state: nextState, messages };
};

export const advanceWeek = (
  state: GameState,
  players: Player[],
  facilities: Facility[] = [],
): { state: GameState; players: Player[]; messages: string[] } => {
  let nextWeek = state.week + 1;
  let nextMonth = state.month;
  if (nextWeek > 4) {
    nextWeek = 1;
    nextMonth += 1;
  }
  if (nextMonth > 12) {
    nextMonth = 1;
  }

  const weather = pickOne(weatherPool);
  let recoveredPlayers = tickInjuries(players).map((player) => ({
    ...player,
    fatigue: clamp(player.fatigue - 4, 0, 100),
  }));
  const preAdvanceMessages: string[] = [];
  let schoolYear = state.year;
  let stateCarry: Partial<GameState> = {};

  if (state.month === 3 && state.week === 4) {
    const activeGraduates = recoveredPlayers.filter((player) => player.year === 3);
    const graduates = [...state.retiredSeniors, ...activeGraduates];
    recoveredPlayers = recoveredPlayers
      .filter((player) => player.year < 3)
      .map((player) => ({
        ...player,
        year: Math.min(3, player.year + 1) as 1 | 2 | 3,
        fatigue: clamp(player.fatigue - 12, 0, 100),
      }));
    schoolYear += 1;
    stateCarry = {
      retiredSeniors: [],
      activeTournament: undefined,
      qualifiedForNational: false,
      lastYearPerformance: state.seasonPerformance,
      seasonPerformance: 0,
    };
    preAdvanceMessages.push(
      graduates.length > 0
        ? `卒業式。${graduates.map((player) => player.name).join("、")}が巣立ち、新年度準備に入りました。`
        : "卒業式と新年度準備。選手たちはひとつ学年が上がりました。",
    );
  }

  const provisionalState: GameState = {
    ...state,
    ...stateCarry,
    year: schoolYear,
    month: nextMonth,
    week: nextWeek,
    actionPower: state.maxActionPower,
    weather,
    daysUntilTournament: tournamentDistance(nextMonth, nextWeek),
  };

  const annual = getAnnualEventMessage(provisionalState, recoveredPlayers, facilities);
  const allMessages = [...preAdvanceMessages, ...annual.messages];
  const finalState = {
    ...annual.state,
    teamRank: calculateTeamRank(annual.players),
    notifications: [...allMessages, ...annual.state.notifications].slice(0, 8),
  };

  return {
    state: finalState,
    players: annual.players,
    messages: allMessages,
  };
};
