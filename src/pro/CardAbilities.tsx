import { grade,gradeColor,type Player,type Ratings } from './data';
import { velocityLabel } from './wiki-players';
import type { CSSProperties } from 'react';
export function CardAbilities({player,bonus=0,ratings=player.ratings,mode=player.role}:{player:Player;bonus?:number;ratings?:Ratings;mode?:'batter'|'pitcher'}) {
 const pitcher=mode==='pitcher';
 const abilities=pitcher?[['制球',ratings.control],['スタミナ',ratings.stamina],['変化',ratings.breaking]] as const:[['ミート',ratings.contact],['パワー',ratings.power],['走力',ratings.speed],['肩',ratings.arm],['守備',ratings.field]] as const;
 return <div className={`card-abilities ${pitcher?'pitching-abilities':''}`}>
  {pitcher&&<div className="card-speed" aria-label={`${velocityLabel(player)} ${player.ratings.velocity}キロ`}><small>球速</small><strong>{player.ratings.velocity}</strong><em>km/h</em></div>}
  {abilities.map(([label,base])=>{const value=Math.min(99,base+bonus);return <div key={label} aria-label={`${label} ${grade(value)} ${value}`}><small>{label}</small><strong style={{color:gradeColor(value),'--grade':gradeColor(value)} as CSSProperties}>{grade(value)}</strong><em>{value}</em></div>;})}
 </div>;
}
