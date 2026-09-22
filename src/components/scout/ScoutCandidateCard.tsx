import { Search, Star, UserRoundPlus } from "lucide-react";
import type { Facility, GameState } from "../../types/game";
import type { ScoutingCandidate } from "../../types/player";
import { clamp } from "../../logic/rand";
import { getAbilityRank } from "../../logic/rankLogic";
import { GameButton } from "../common/GameButton";

interface ScoutCandidateCardProps {
  candidate: ScoutingCandidate;
  gameState: GameState;
  facilities: Facility[];
  onScout: (candidate: ScoutingCandidate) => void;
}

export const getScoutSuccessRate = (
  candidate: ScoutingCandidate,
  gameState: GameState,
  facilities: Facility[],
): number => {
  const scoutRoomLevel = facilities.find((facility) => facility.id === "scoutRoom")?.level ?? 1;
  return clamp(28 + gameState.reputation * 0.35 + scoutRoomLevel * 7 + candidate.promiseLevel * 0.18, 10, 92);
};

export function ScoutCandidateCard({
  candidate,
  gameState,
  facilities,
  onScout,
}: ScoutCandidateCardProps) {
  const successRate = getScoutSuccessRate(candidate, gameState, facilities);
  const averageAbility = Math.round(
    (candidate.contact +
      candidate.power +
      candidate.speed +
      candidate.defense +
      candidate.arm +
      candidate.control +
      candidate.stamina) /
      7,
  );
  const canScout =
    gameState.funds >= candidate.scoutCost && gameState.scoutPoints >= candidate.scoutPointCost;

  return (
    <article className="rounded-lg border-4 border-slate-900 bg-white p-4 shadow-[0_6px_0_rgba(15,23,42,0.14)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border-2 border-slate-900 bg-yellow-300 p-3 text-blue-700">
            <Search size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-950">{candidate.name}</h3>
            <p className="text-sm font-bold text-slate-600">
              {candidate.position} / {candidate.handedness} / {candidate.growthType}
            </p>
          </div>
        </div>
        <span className="rounded-lg border-2 border-slate-900 bg-blue-100 px-3 py-1 text-xl font-black">
          {getAbilityRank(averageAbility)}
        </span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-sm font-black">
        <div className="rounded-lg border-2 border-slate-800 bg-green-50 p-2">
          <Star size={16} className="text-yellow-500" />
          才能 {candidate.talent.toFixed(2)}
        </div>
        <div className="rounded-lg border-2 border-slate-800 bg-blue-50 p-2">
          成功率 {successRate}%
        </div>
      </div>
      <p className="mb-3 rounded-lg border-2 border-slate-800 bg-yellow-50 p-3 font-bold">
        勧誘費 {candidate.scoutCost.toLocaleString()}G / スカウトP {candidate.scoutPointCost}
      </p>
      <GameButton
        className="w-full"
        icon={<UserRoundPlus size={20} />}
        variant="success"
        disabled={!canScout}
        onClick={() => onScout(candidate)}
      >
        勧誘する
      </GameButton>
    </article>
  );
}
