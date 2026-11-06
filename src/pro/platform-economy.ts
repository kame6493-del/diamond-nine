// Replaced at build time only for the native app bundles (scripts/build-mobile.mjs).
// Browser saves and browser rewards retain their original values; no migration removes points.
declare const __DIAMOND_ANDROID__: boolean;
declare const __DIAMOND_APP__: boolean;
export const androidEdition = typeof __DIAMOND_ANDROID__ !== 'undefined' && __DIAMOND_ANDROID__;
// iOS app bundle only (scripts/build-mobile.mjs without --android). The iOS app links to no other store and no other app.
declare const __DIAMOND_IOS__: boolean;
export const iosEdition = typeof __DIAMOND_IOS__ !== 'undefined' && __DIAMOND_IOS__;
// iOS and Android apps share one economy (ads + premium pass). Ordinary match pay
// matches the browser; the premium pass doubles it.
export const appEdition = androidEdition || (typeof __DIAMOND_APP__ !== 'undefined' && __DIAMOND_APP__);
export const APP_MATCH_RATE = 1;
// 2026-10-16: 2 → 1.5 倍。
// 2026-11-03 vc39: 1.5 → 2 倍。
export const PREMIUM_MATCH_MULTIPLIER = 2;
// Set by the native monetization bridge from the store entitlement (cached until confirmed).
// Only per-game match rewards change; goals, season, postseason and scout odds do not.
let premiumMatchBonus = false;
export const setPremiumMatchBonus = (on:boolean) => { premiumMatchBonus = appEdition && on; };
export const premiumMatchBonusActive = () => premiumMatchBonus;
export const matchRewardForPlatform = (points:number) =>
 appEdition ? Math.floor(points * APP_MATCH_RATE * (premiumMatchBonus ? PREMIUM_MATCH_MULTIPLIER : 1)) : points;
