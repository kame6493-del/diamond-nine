import {clamp,fitsPosition,type Player,type Ratings} from './data';
import {wikiPositionPenalty} from './wiki-players';

// Unknown positions must be harder than even a listed low-level secondary
// position (up to 36 points). Catching and the middle infield need more practice.
const unfamiliarPenalty:Record<string,number>={'一':40,'外':42,'三':44,'二':48,'遊':52,'捕':58};
export function positionDefensePenalty(player:Player,position:string):number{
 if(position==='DH')return 0;
 return fitsPosition(player,position)?wikiPositionPenalty(player,position):unfamiliarPenalty[position]??44;
}

// Placement affects performance for this game only, never the owned card.
export function defenseAtPosition(player:Player,position:string,ratings:Ratings=player.ratings){
 const fit=fitsPosition(player,position),penalty=positionDefensePenalty(player,position);
 return {
  skill:clamp(ratings.field,0,99)*.85+clamp(ratings.catching,0,99)*.15-penalty,
  arm:clamp(ratings.arm-(fit?0:position==='捕'?40:25),0,99),
  field:clamp(ratings.field-(fit?0:penalty),0,99),
 };
}
