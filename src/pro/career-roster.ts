import { fitsPosition, playerMap } from './data';
import { effectiveOverall, type GameState } from './engine';
import { pitchingRoleLabel,wikiPositionPenalty } from './wiki-players';

export function bestUpgrade(state: GameState, id: string) {
  const player = playerMap[id];
  if (!player || !state.owned[id] || state.lineup.includes(id) || state.pitchers.includes(id)) return null;
  const pitching = player.role === 'pitcher';
  const starter = pitchingRoleLabel(player)==='先発';
  const roster = pitching ? state.pitchers : state.lineup;
  const candidates = roster.map((oldId, index) => ({ oldId, index }))
    .filter(({ oldId, index }) => pitching ? (starter ? index < 6 : index >= 6) : fitsPosition(player, state.defense[oldId]))
    .map(slot => {const position=state.defense[slot.oldId],before=effectiveOverall(playerMap[slot.oldId], state.owned, state.training),after=effectiveOverall(player, state.owned, state.training);return {...slot,before,after,gain:after-before+(pitching?0:(fitsPosition(playerMap[slot.oldId],position)?wikiPositionPenalty(playerMap[slot.oldId],position):22)-wikiPositionPenalty(player,position))*.14};})
    .sort((a, b) => b.gain-a.gain || a.index - b.index);
  const best = candidates[0];
  return best && best.gain > 0 ? { ...best, pitching, position: pitching ? starter ? '先発' : '救援' : state.defense[best.oldId] } : null;
}

export function benchUpgrades(state:GameState){return Object.keys(state.owned).map(id=>({id,upgrade:bestUpgrade(state,id)})).filter((x):x is {id:string;upgrade:NonNullable<ReturnType<typeof bestUpgrade>>}=>!!x.upgrade).sort((a,b)=>b.upgrade.gain-a.upgrade.gain);}

export function equipScoutedPlayer(state: GameState, id: string): GameState {
  const upgrade = bestUpgrade(state, id);
  if (!upgrade) return state;
  if (upgrade.pitching) return { ...state, pitchers: state.pitchers.map((old, i) => i === upgrade.index ? id : old) };
  const defense = { ...state.defense };
  delete defense[upgrade.oldId];
  defense[id] = upgrade.position;
  return { ...state, defense, lineup: state.lineup.map((old, i) => i === upgrade.index ? id : old) };
}
