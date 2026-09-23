import type {Player} from './data';
import {ratingOverall,ownedRatings} from './development';

export type ScoutTier='standard'|'gold'|'rainbow';
// Use the OVR printed on the card, never legacy rarity. No effect on draw odds.
export function scoutPresentation(player:Player|null,owned:Record<string,number>={},training:Record<string,number>={}){
 const overall=player?ratingOverall(player,ownedRatings(player,owned,training)):0;
 const tier:ScoutTier=overall>=95?'rainbow':overall>=85||player?.mlb?'gold':'standard';
 return {overall,tier};
}
export function scoutDuration(tier:ScoutTier='standard',reducedMotion=typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
 return reducedMotion?180:tier==='rainbow'?3000:tier==='gold'?2300:1600;
}
