export type Position =
  | "投手"
  | "捕手"
  | "一塁手"
  | "二塁手"
  | "三塁手"
  | "遊撃手"
  | "外野手";

export type Handedness = "右投右打" | "右投左打" | "左投左打" | "左投右打";
export type Personality =
  | "まじめ"
  | "熱血"
  | "冷静"
  | "お調子者"
  | "努力家"
  | "勝負師";
export type GrowthType = "早熟" | "普通" | "晩成" | "天才肌";
export type SpecialAbility =
  | "チャンス強い"
  | "粘り打ち"
  | "盗塁上手"
  | "堅守"
  | "強肩"
  | "逆境"
  | "ムード○"
  | "尻上がり"
  | "ピンチ強い";

export type AbilityKey =
  | "power"
  | "contact"
  | "speed"
  | "arm"
  | "defense"
  | "catching"
  | "velocity"
  | "control"
  | "stamina"
  | "breakingBall"
  | "mental"
  | "trust"
  | "mood"
  | "fatigue";

export type InjurySeverity = "軽傷" | "中傷" | "重傷";

export interface Injury {
  severity: InjurySeverity;
  weeksRemaining: number;
}

export interface Player {
  id: string;
  name: string;
  year: 1 | 2 | 3;
  position: Position;
  handedness: Handedness;
  personality: Personality;
  growthType: GrowthType;
  talent: number;
  power: number;
  contact: number;
  speed: number;
  arm: number;
  defense: number;
  catching: number;
  velocity: number;
  control: number;
  stamina: number;
  breakingBall: number;
  mental: number;
  trust: number;
  mood: number;
  fatigue: number;
  specialAbilities: SpecialAbility[];
  exp: number;
  injury?: Injury;
}

export interface ScoutingCandidate extends Player {
  scoutCost: number;
  scoutPointCost: number;
  promiseLevel: number;
}
