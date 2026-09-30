import {useSyncExternalStore} from 'react';

// App-only monetization. The native bridge (mobile/monetize.ts) sets
// window.diamondMonetize; the browser build never has it, so nothing here
// loads ad or billing code on the web.
export const REWARD_AD_POINTS = 600;
export const REWARD_AD_DAILY_LIMIT = 5;
export const PREMIUM_DAILY_POINTS = 300;
export const INTERSTITIAL_EVERY_SCOUTS = 3;
export const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000;
export const PREMIUM_PRODUCT_ID = 'premium_pass';

export type PremiumStatus = 'checking' | 'unavailable' | 'ready';
export interface PremiumSnapshot {
 status: PremiumStatus;
 owned: boolean;
 // true only after the store answered in this session; false means cached/offline.
 verified: boolean;
 price: string | null;
 busy: boolean;
 message: string;
}
export interface RewardSnapshot {available: boolean; busy: boolean; left: number; limit: number; points: number}
export interface MonetizeSnapshot {premium: PremiumSnapshot; reward: RewardSnapshot; privacyOptions: boolean}
export type RewardOutcome = 'rewarded' | 'dismissed' | 'failed' | 'limit' | 'busy';
export interface MonetizeBridge {
 snapshot(): MonetizeSnapshot;
 subscribe(listener: () => void): () => void;
 buyPremium(): Promise<void>;
 restorePremium(): Promise<void>;
 // onReward runs at most once, and only from the ad SDK's reward callback.
 showRewardAd(onReward: (points: number) => void): Promise<RewardOutcome>;
 noteScout(): void;
 // Shows only at a natural break, never to pass owners, never twice within the cooldown.
 showInterstitial(reason: 'season' | 'scout'): Promise<boolean>;
 // Returns points to add (0 when not owned, not verified or already claimed today).
 claimPremiumDaily(): number;
 showPrivacyOptions(): Promise<void>;
}
declare global {interface Window {diamondMonetize?: MonetizeBridge}}

export const monetizeBridge = (): MonetizeBridge | undefined =>
 typeof window === 'undefined' ? undefined : window.diamondMonetize;

const noop = () => () => {};
const none = () => null;
export function useMonetize(): MonetizeSnapshot | null {
 const bridge = monetizeBridge();
 return useSyncExternalStore(bridge ? bridge.subscribe : noop, bridge ? bridge.snapshot : none, bridge ? bridge.snapshot : none);
}

// ---- pure helpers (shared by the bridge and the tests) ----
export const localDay = (date = new Date()) =>
 `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export interface DailyCount {day: string; used: number}
export const parseDaily = (raw: string | null): DailyCount | null => {
 try {
  const v = raw ? JSON.parse(raw) : null;
  return v && typeof v.day === 'string' && Number.isInteger(v.used) && v.used >= 0 ? v : null;
 } catch {return null;}
};
export const dailyLeft = (record: DailyCount | null, today: string, limit: number) =>
 Math.max(0, limit - (record?.day === today ? record.used : 0));
export const spendDaily =(record: DailyCount | null, today: string): DailyCount =>
 ({day: today, used: (record?.day === today ? record.used : 0) + 1});

export interface InterstitialPacing {premium: boolean; lastShownAt: number; now: number; scoutsSince: number}
export const interstitialDue = (reason: 'season' | 'scout', p: InterstitialPacing) =>
 !p.premium && p.now - p.lastShownAt >= INTERSTITIAL_COOLDOWN_MS &&
 (reason === 'season' || p.scoutsSince >= INTERSTITIAL_EVERY_SCOUTS);
