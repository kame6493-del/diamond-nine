import type { RandomEvent } from "../types/game";
import { clamp, createId, pickOne, randomBetween } from "../logic/rand";

export const randomEvents: RandomEvent[] = [
  {
    id: "snack",
    title: "マネージャーの差し入れ",
    description: "おにぎりとスポーツドリンクで少し元気が戻りました。",
    apply: (players, state) => ({
      players: players.map((player) => ({
        ...player,
        fatigue: clamp(player.fatigue - 10, 0, 100),
        mood: clamp(player.mood + 5, 0, 100),
      })),
      state,
      message: "マネージャーの差し入れ：fatigue -10, mood +5",
    }),
  },
  {
    id: "morning",
    title: "早朝自主練",
    description: "ひとりの選手が朝から黙々と振り込んでいました。",
    apply: (players, state) => {
      const target = pickOne(players);
      const ability = pickOne(["contact", "power", "defense", "control"] as const);
      const gain = Math.floor(Math.random() * 3) + 1;
      return {
        players: players.map((player) =>
          player.id === target.id
            ? {
                ...player,
                [ability]: clamp(player[ability] + gain, 1, 100),
                fatigue: clamp(player.fatigue + 5, 0, 100),
              }
            : player,
        ),
        state,
        message: `${target.name}が早朝自主練。${ability} +${gain}, fatigue +5`,
      };
    },
  },
  {
    id: "cleaning",
    title: "部室掃除",
    description: "整理された部室で、チームの会話が自然に増えました。",
    apply: (players, state) => ({
      players: players.map((player) => ({
        ...player,
        trust: clamp(player.trust + 3, 0, 100),
        mood: clamp(player.mood + 3, 0, 100),
      })),
      state,
      message: "部室掃除：trust +3, mood +3",
    }),
  },
  {
    id: "fight",
    title: "小さなケンカ",
    description: "練習中に意見がぶつかりました。次の声かけが大事です。",
    apply: (players, state) => ({
      players: players.map((player) => ({
        ...player,
        mood: clamp(player.mood - 5, 0, 100),
        trust: clamp(player.trust - 3, 0, 100),
      })),
      state,
      message: "小さなケンカ：mood -5, trust -3",
    }),
  },
  {
    id: "battingSpark",
    title: "打撃開眼",
    description: "打球の角度が変わり、ベンチが一気に明るくなりました。",
    apply: (players, state) => {
      const fielders = players.filter((player) => player.position !== "投手");
      const target = pickOne(fielders.length > 0 ? fielders : players);
      return {
        players: players.map((player) =>
          player.id === target.id
            ? {
                ...player,
                contact: clamp(player.contact + 5, 1, 100),
                power: clamp(player.power + 3, 1, 100),
              }
            : player,
        ),
        state,
        message: `${target.name}が打撃開眼：contact +5, power +3`,
      };
    },
  },
  {
    id: "fieldingAce",
    title: "守備の名手",
    description: "ノックの最後に、見事なグラブさばきが出ました。",
    apply: (players, state) => {
      const target = pickOne(players);
      return {
        players: players.map((player) =>
          player.id === target.id
            ? {
                ...player,
                defense: clamp(player.defense + 4, 1, 100),
                catching: clamp(player.catching + 4, 1, 100),
              }
            : player,
        ),
        state,
        message: `${target.name}が守備の名手に一歩近づいた：defense +4, catching +4`,
      };
    },
  },
  {
    id: "pitcherAwake",
    title: "投手の覚醒",
    description: "ブルペンで球筋が変わったと捕手がうなずきました。",
    apply: (players, state) => {
      const pitchers = players.filter((player) => player.position === "投手");
      const target = pickOne(pitchers.length > 0 ? pitchers : players);
      return {
        players: players.map((player) =>
          player.id === target.id
            ? {
                ...player,
                control: clamp(player.control + 5, 1, 100),
                stamina: clamp(player.stamina + 4, 1, 100),
              }
            : player,
        ),
        state,
        message: `${target.name}が投手の覚醒：control +5, stamina +4`,
      };
    },
  },
  {
    id: "fatigue",
    title: "疲労蓄積",
    description: "全体的に体が重そうです。休養日を考える時期かもしれません。",
    apply: (players, state) => ({
      players: players.map((player) => ({
        ...player,
        fatigue: clamp(player.fatigue + 7, 0, 100),
      })),
      state,
      message: "疲労蓄積：怪我リスク上昇",
    }),
  },
  {
    id: "obVisit",
    title: "OB訪問",
    description: "卒業生が練習を見に来て、短いアドバイスを残してくれました。",
    apply: (players, state) => ({
      players: players.map((player) => ({
        ...player,
        trust: clamp(player.trust + 4, 0, 100),
        mental: clamp(player.mental + 1, 1, 100),
      })),
      state: {
        ...state,
        reputation: clamp(state.reputation + 1, 0, 100),
      },
      message: "OB訪問：trust +4, mental +1, 評判 +1",
    }),
  },
  {
    id: "shoppingStreetDonation",
    title: "商店街からの寄付",
    description: "近所の商店街から、ボール代にと差し入れが届きました。",
    apply: (players, state) => {
      const donation = clamp(randomBetween(300, 900), 300, 900);
      return {
        players,
        state: {
          ...state,
          funds: state.funds + donation,
          reputation: clamp(state.reputation + 1, 0, 100),
        },
        message: `商店街からの寄付：資金 +${donation}G, 評判 +1`,
      };
    },
  },
  {
    id: "rainPractice",
    title: "雨天練習",
    description: "雨音の中で、室内メニューと作戦確認に切り替えました。",
    apply: (players, state) => ({
      players: players.map((player) => ({
        ...player,
        control: player.position === "投手" ? clamp(player.control + 1, 1, 100) : player.control,
        defense: player.position !== "投手" ? clamp(player.defense + 1, 1, 100) : player.defense,
        trust: clamp(player.trust + 2, 0, 100),
        fatigue: clamp(player.fatigue - (state.weather === "雨" ? 2 : 0), 0, 100),
      })),
      state: {
        ...state,
        weather: "雨",
      },
      message: "雨天練習：守備確認と投手制球を微調整、trust +2",
    }),
  },
];

export const toLogItem = (title: string, message: string, date: string) => ({
  id: createId("event"),
  date,
  title,
  message,
});
