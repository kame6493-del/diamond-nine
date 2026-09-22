import { Medal, Sparkles } from "lucide-react";
import type { Player } from "../../types/player";
import { getAbilityRank } from "../../logic/rankLogic";
import { GamePanel } from "../common/GamePanel";
import { ProgressBar } from "../common/ProgressBar";
import { abilityLabels, coreAbilityKeys } from "./abilityLabels";

interface PlayerDetailPanelProps {
  player?: Player;
}

export function PlayerDetailPanel({ player }: PlayerDetailPanelProps) {
  if (!player) {
    return (
      <GamePanel title="選手詳細" icon={<Medal size={22} />}>
        <p className="text-lg font-bold text-slate-600">選手を選ぶと詳しい能力が表示されます。</p>
      </GamePanel>
    );
  }

  return (
    <GamePanel title={player.name} icon={<Medal size={22} />}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border-2 border-slate-800 bg-yellow-50 p-3">
          <p className="text-sm font-black text-blue-700">プロフィール</p>
          <p className="text-lg font-black text-slate-950">
            {player.year}年 / {player.position} / {player.handedness}
          </p>
          <p className="font-bold text-slate-700">
            {player.personality}・{player.growthType}・才能 {player.talent.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border-2 border-slate-800 bg-green-50 p-3">
          <p className="text-sm font-black text-blue-700">特殊能力</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {player.specialAbilities.length > 0 ? (
              player.specialAbilities.map((ability) => (
                <span
                  key={ability}
                  className="inline-flex items-center gap-1 rounded-full border-2 border-slate-800 bg-white px-2 py-1 text-sm font-black"
                >
                  <Sparkles size={14} className="text-yellow-500" />
                  {ability}
                </span>
              ))
            ) : (
              <span className="font-bold text-slate-500">まだありません</span>
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {coreAbilityKeys.map((key) => (
          <div key={key} className="rounded-lg border-2 border-slate-800 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-black text-slate-800">{abilityLabels[key]}</span>
              <span className="rounded-md border-2 border-slate-800 bg-blue-100 px-2 py-0.5 text-sm font-black">
                {key === "fatigue" || key === "mood" || key === "trust" ? player[key] : getAbilityRank(player[key])}
              </span>
            </div>
            <ProgressBar value={player[key]} tone={key === "fatigue" && player[key] > 75 ? "red" : "green"} />
          </div>
        ))}
      </div>
    </GamePanel>
  );
}
