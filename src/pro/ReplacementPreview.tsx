import type {Player} from './data';
import {teamById} from './data';
import {effectiveOverall,type GameState} from './engine';
import {ownedRatings} from './development';
import {CardAbilities} from './CardAbilities';
import {pitcherSlotRole,pitcherRolePenalty,pitchingRatingsForRole} from './pitcher-aptitude';
import './replacement-preview.css';

/** Keep the incumbent's current abilities visible while choosing a replacement. */
export function ReplacementPreview({player,state,position,mode,onPlayer}:{player:Player;state:GameState;position:string;mode:'batter'|'pitcher';onPlayer?:(p:Player)=>void}){
 const index=state.pitchers.indexOf(player.id),role=mode==='pitcher'&&index>=0?pitcherSlotRole(index):undefined;
 const ratings=pitchingRatingsForRole(player,ownedRatings(player,state.owned,state.training),role);
 return <section className="replacement-preview" aria-label="入れ替え前の選手能力">
  <div className="replacement-preview-heading"><div><small>現在の選手 · {position}</small><strong>{onPlayer?<button onClick={()=>onPlayer(player)}>{player.name}</button>:player.name}</strong><span>{teamById(player.team).short}{(state.training[player.id]??0)>0&&` · 覚醒 ${state.training[player.id]}/5`}</span></div><div className="replacement-preview-overall"><small>総合</small><b>{effectiveOverall(player,state.owned,state.training)}</b></div></div>
  <CardAbilities player={player} mode={mode} ratings={ratings}/>
  {role&&pitcherRolePenalty(player,role)>0&&<small>適性不足 · 能力は起用時の補正後</small>}
 </section>;
}
