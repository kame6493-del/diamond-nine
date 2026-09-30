// Replaced at build time only for the native app bundles (scripts/build-mobile.mjs).
// Browser saves and browser rewards retain their original values; no migration removes points.
declare const __DIAMOND_ANDROID__: boolean;
declare const __DIAMOND_APP__: boolean;
export const androidEdition = typeof __DIAMOND_ANDROID__ !== 'undefined' && __DIAMOND_ANDROID__;
// iOS and Android apps share one economy (ads + premium pass). The browser keeps 1.0x.
export const appEdition = androidEdition || (typeof __DIAMOND_APP__ !== 'undefined' && __DIAMOND_APP__);
export const APP_MATCH_RATE = .8;
export const PREMIUM_MATCH_MULTIPLIER = 2;
// Set by the native monetization bridge from the store entitlement (cached until confirmed).
// Only per-game match rewards change; goals, season, postseason and scout odds do not.
let premiumMatchBonus = false;
export const setPremiumMatchBonus = (on:boolean) => { premiumMatchBonus = appEdition && on; };
export const premiumMatchBonusActive = () => premiumMatchBonus;
export const matchRewardForPlatform = (points:number) =>
 appEdition ? Math.floor(points * APP_MATCH_RATE * (premiumMatchBonus ? PREMIUM_MATCH_MULTIPLIER : 1)) : points;
