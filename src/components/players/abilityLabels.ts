import type { AbilityKey } from "../../types/player";

export const abilityLabels: Record<AbilityKey, string> = {
  power: "パワー",
  contact: "ミート",
  speed: "走力",
  arm: "肩力",
  defense: "守備",
  catching: "捕球",
  velocity: "球速",
  control: "制球",
  stamina: "スタミナ",
  breakingBall: "変化球",
  mental: "メンタル",
  trust: "信頼度",
  mood: "やる気",
  fatigue: "疲労",
};

export const coreAbilityKeys: AbilityKey[] = [
  "contact",
  "power",
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
