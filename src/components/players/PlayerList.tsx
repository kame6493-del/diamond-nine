import type { Player } from "../../types/player";
import { PlayerCard } from "./PlayerCard";

interface PlayerListProps {
  players: Player[];
  selectedPlayerId?: string;
  onSelect: (player: Player) => void;
}

export function PlayerList({ players, selectedPlayerId, onSelect }: PlayerListProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {players.map((player) => (
        <PlayerCard
          key={player.id}
          player={player}
          selected={player.id === selectedPlayerId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
