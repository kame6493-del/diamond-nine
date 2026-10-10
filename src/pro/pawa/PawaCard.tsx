import type {CSSProperties} from 'react';
import {grade,teamById,type Player,type Ratings} from '../data';
import {ownedRatings,ratingOverall} from '../development';
import type {GameState} from '../engine';
import {JerseyArt} from '../CardDeck';
import {pitchingRoleLabel} from '../wiki-players';

export type Tier='standard'|'gold'|'rainbow';
// Same thresholds as the scout reveal (scout-presentation.ts).
export const tierFor=(player:Player,overall:number):Tier=>overall>=95?'rainbow':overall>=85||player.mlb?'gold':'standard';
export const roleLabel=(p:Player)=>p.mlb?.twoWay?'投/DH':p.role==='pitcher'?pitchingRoleLabel(p):(p.positions[0]??'DH');
export const cardRatings=(p:Player,state:GameState,base=false):Ratings=>base?p.ratings:ownedRatings(p,state.owned,state.training);

/** 選手カード(パワプロ風の参考画像): 枠の色(通常=青・金・虹)、総合のランク札、チーム色のユニフォームの絵、
 * OVR と守備位置。人の絵は描かない。 */
export function PawaCard({player,state,base=false,size='m',onClick,label}:{player:Player;state:GameState;base?:boolean;size?:'s'|'m'|'l';onClick?:()=>void;label?:string}){
 const ratings=cardRatings(player,state,base),overall=ratingOverall(player,ratings),tier=tierFor(player,overall);
 const team=teamById(player.team);
 const body=<>
  <i className="nc-rank" data-rank={grade(Math.min(99,overall))} aria-hidden="true"/>
  <span className="nc-art"><JerseyArt player={player}/></span>
  <span className="nc-ovr"><small>OVR</small><b>{overall}</b></span>
  <span className="nc-pos">{roleLabel(player)}</span>
  {size!=='s'&&<span className="nc-plate"><b>{player.name}</b><small>{team.short}{player.mlb?' · 海外':''}</small></span>}
 </>;
 const cls=`nv-card nc-${size} nc-${tier}`;
 const style={'--team-tint':team.color} as CSSProperties;
 return onClick?<button type="button" className={cls} style={style} onClick={onClick} aria-label={label??`${player.name} 総合${overall}`}>{body}</button>:<div className={cls} style={style} aria-label={label}>{body}</div>;
}

/** Big rank letter + number (ミート S 92 …), the ref's detail/lineup ability row. */
export function GradeRow({player,ratings,mode=player.role,big=false}:{player:Player;ratings:Ratings;mode?:'batter'|'pitcher';big?:boolean}){
 const list=mode==='pitcher'?[['球速',null],['制球',ratings.control],['スタミナ',ratings.stamina],['変化',ratings.breaking]] as const:[['ミート',ratings.contact],['パワー',ratings.power],['走力',ratings.speed],['肩',ratings.arm],['守備',ratings.field]] as const;
 return <div className={'nv-grades'+(big?' is-big':'')}>{list.map(([label,value])=>value===null
  ?<div key={label} className="nv-grade nv-velocity"><small>{label}</small><b>{player.ratings.velocity}</b><em>km/h</em></div>
  :<div key={label} className="nv-grade" aria-label={`${label} ${grade(Math.min(99,value))} ${Math.min(99,value)}`}><small>{label}</small><i data-rank={grade(Math.min(99,value))}>{grade(Math.min(99,value))}</i><em>{Math.min(99,value)}</em></div>)}</div>;
}
