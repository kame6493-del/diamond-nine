import { Building2, Coins, TrendingUp } from "lucide-react";
import type { Facility } from "../../types/game";
import { GameButton } from "../common/GameButton";
import { ProgressBar } from "../common/ProgressBar";

interface FacilityCardProps {
  facility: Facility;
  funds: number;
  onUpgrade: (facility: Facility) => void;
}

export const getUpgradeCost = (facility: Facility): number =>
  Math.round(facility.baseCost * facility.level * 1.18);

export function FacilityCard({ facility, funds, onUpgrade }: FacilityCardProps) {
  const cost = getUpgradeCost(facility);
  const isMax = facility.level >= facility.maxLevel;

  return (
    <article className="asset-panel rounded-xl border-4 border-blue-950 bg-white p-4 shadow-[0_6px_0_rgba(8,47,73,0.18)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border-2 border-blue-950 bg-green-200 p-3 text-green-700 shadow-[0_3px_0_rgba(8,47,73,0.18)]">
            <Building2 size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-950">{facility.name}</h3>
            <p className="text-sm font-bold text-slate-600">{facility.description}</p>
          </div>
        </div>
        <span className="rounded-lg border-2 border-blue-950 bg-yellow-300 px-3 py-1 text-lg font-black">
          Lv.{facility.level}
        </span>
      </div>
      <ProgressBar label="施設レベル" value={facility.level} max={facility.maxLevel} tone="green" />
      <p className="my-3 rounded-xl border-2 border-blue-950 bg-blue-50 p-3 font-black text-blue-800">
        {facility.effect}
      </p>
      <GameButton
        className="w-full"
        icon={isMax ? <TrendingUp size={20} /> : <Coins size={20} />}
        variant={isMax ? "ghost" : "secondary"}
        disabled={isMax || funds < cost}
        onClick={() => onUpgrade(facility)}
      >
        {isMax ? "最大レベル" : `${cost.toLocaleString()}Gで強化`}
      </GameButton>
    </article>
  );
}
