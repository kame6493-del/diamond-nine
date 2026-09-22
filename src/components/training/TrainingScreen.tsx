import { AlertTriangle, Dumbbell } from "lucide-react";
import type { GameState, TrainingMenu } from "../../types/game";
import type { Player } from "../../types/player";
import { trainingMenus } from "../../data/trainingMenus";
import { GamePanel } from "../common/GamePanel";
import { MascotMessage } from "../mascot/MascotMessage";
import { TrainingMenuCard } from "./TrainingMenuCard";

interface TrainingScreenProps {
  gameState: GameState;
  players: Player[];
  onTraining: (menu: TrainingMenu) => void;
}

export function TrainingScreen({ gameState, players, onTraining }: TrainingScreenProps) {
  const tiredPlayers = players.filter((player) => player.fatigue >= 75);
  const mascotMessage =
    tiredPlayers.length > 0
      ? "疲れてる選手がいるみたい。休ませるのも大事！"
      : gameState.daysUntilTournament <= 14
        ? "大会まであと少しだよ！"
        : "今週はどの練習にする？";

  return (
    <div className="grid gap-4">
      <MascotMessage message={mascotMessage} pose={tiredPlayers.length > 0 ? "mascotSweating" : "mascotPointing"} />
      {tiredPlayers.length > 0 && (
        <div className="rounded-xl border-4 border-red-700 bg-red-50 p-3 text-red-800 shadow-game">
          <p className="flex items-center gap-2 text-lg font-black">
            <AlertTriangle size={22} />
            少し疲れが見えます。
          </p>
          <p className="font-bold">{tiredPlayers.map((player) => player.name).join("、")} は怪我に注意。</p>
        </div>
      )}
      <GamePanel title="練習メニュー" icon={<Dumbbell size={22} />}>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {trainingMenus.map((menu) => (
            <TrainingMenuCard
              key={menu.id}
              menu={menu}
              disabled={gameState.actionPower < menu.actionCost}
              onSelect={onTraining}
            />
          ))}
        </div>
      </GamePanel>
    </div>
  );
}
