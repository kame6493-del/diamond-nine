export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

export const clampFloat = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min);

export const pickOne = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const createId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
