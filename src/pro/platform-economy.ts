// Replaced at build time only for the native Android bundle. Browser saves and
// browser rewards retain their original values; no migration removes points.
declare const __DIAMOND_ANDROID__: boolean;
export const androidEdition = typeof __DIAMOND_ANDROID__ !== 'undefined' && __DIAMOND_ANDROID__;
export const matchRewardForPlatform = (points:number) => androidEdition ? Math.floor(points * .8) : points;
