import { RefreshCw, Search } from "lucide-react";
import type { Facility, GameState } from "../../types/game";
import type { ScoutingCandidate } from "../../types/player";
import { GameButton } from "../common/GameButton";
import { GamePanel } from "../common/GamePanel";
import { MascotMessage } from "../mascot/MascotMessage";
import { ScoutCandidateCard } from "./ScoutCandidateCard";

interface ScoutScreenProps {
  gameState: GameState;
  facilities: Facility[];
  candidates: ScoutingCandidate[];
  onScout: (candidate: ScoutingCandidate) => void;
  onRefreshCandidates: () => void;
}

export function ScoutScreen({
  gameState,
  facilities,
  candidates,
  onScout,
  onRefreshCandidates,
}: ScoutScreenProps) {
  return (
    <div className="grid gap-4">
      <MascotMessage message="評判とスカウト室が上がるほど、いい返事をもらいやすいよ！" />
      <GamePanel
        title="スカウト"
        icon={<Search size={22} />}
        actions={
          <GameButton
            icon={<RefreshCw size={20} />}
            variant="secondary"
            disabled={gameState.funds < 300}
            onClick={onRefreshCandidates}
          >
            300Gで候補更新
          </GameButton>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border-2 border-slate-800 bg-yellow-50 p-3">
            <p className="text-sm font-black text-blue-700">スカウトP</p>
            <p className="text-2xl font-black">{gameState.scoutPoints}</p>
          </div>
          <div className="rounded-lg border-2 border-slate-800 bg-green-50 p-3">
            <p className="text-sm font-black text-blue-700">翌年度候補</p>
            <p className="text-2xl font-black">{gameState.incomingRecruits.length}人</p>
          </div>
          <div className="rounded-lg border-2 border-slate-800 bg-blue-50 p-3">
            <p className="text-sm font-black text-blue-700">学校評判</p>
            <p className="text-2xl font-black">{gameState.reputation}</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {candidates.map((candidate) => (
            <ScoutCandidateCard
              key={candidate.id}
              candidate={candidate}
              gameState={gameState}
              facilities={facilities}
              onScout={onScout}
            />
          ))}
        </div>
      </GamePanel>
    </div>
  );
}
