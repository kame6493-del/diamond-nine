import { UsersRound } from "lucide-react";
import type { Player } from "../../types/player";
import { GamePanel } from "../common/GamePanel";
import { PlayerDetailPanel } from "./PlayerDetailPanel";
import { PlayerList } from "./PlayerList";

interface PlayerListScreenProps {
  players: Player[];
  selectedPlayer?: Player;
  onSelectPlayer: (player: Player) => void;
}

export function PlayerListScreen({ players, selectedPlayer, onSelectPlayer }: PlayerListScreenProps) {
  const sortedPlayers = [...players].sort((a, b) => b.year - a.year || a.position.localeCompare(b.position));

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
      <GamePanel title="部員一覧" icon={<UsersRound size={22} />}>
        <PlayerList players={sortedPlayers} selectedPlayerId={selectedPlayer?.id} onSelect={onSelectPlayer} />
      </GamePanel>
      <PlayerDetailPanel player={selectedPlayer} />
    </div>
  );
}
