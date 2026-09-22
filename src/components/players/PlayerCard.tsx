import { HeartPulse, Star } from "lucide-react";
import type { Player } from "../../types/player";
import { getAbilityRank } from "../../logic/rankLogic";
import { AssetImage } from "../assets/AssetImage";
import { ProgressBar } from "../common/ProgressBar";

interface PlayerCardProps {
  player: Player;
  selected?: boolean;
  onSelect: (player: Player) => void;
}

export function PlayerCard({ player, selected = false, onSelect }: PlayerCardProps) {
  const overall = Math.round(
    (player.contact +
      player.power +
      player.speed +
      player.defense +
      player.catching +
      player.arm +
      player.control +
      player.stamina) /
      8,
  );

  return (
    <button
      className={`player-card w-full overflow-hidden rounded-xl border-4 p-3 text-left shadow-[0_6px_0_rgba(8,47,73,0.22)] transition hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none ${
        selected ? "border-yellow-500 bg-yellow-50" : "border-blue-950 bg-white"
      }`}
      onClick={() => onSelect(player)}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 gap-3">
          <AssetImage
            asset="mascotFacesStrip"
            alt="選手カード顔枠"
            noFrame
            imgClassName="h-20 w-20 shrink-0 rounded-lg border-2 border-blue-950 object-cover object-left"
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-slate-950">{player.name}</p>
            <p className="text-sm font-bold text-slate-600">
              {player.year}年 / {player.position} / {player.handedness}
            </p>
          </div>
        </div>
        <div className="rounded-lg border-2 border-blue-950 bg-gradient-to-b from-yellow-200 to-yellow-400 px-3 py-1 text-xl font-black text-blue-950 shadow-[0_3px_0_rgba(8,47,73,0.25)]">
          {getAbilityRank(overall)}
        </div>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <span className="rounded-full border-2 border-blue-950 bg-green-100 px-2 py-1 text-xs font-black">
          {player.personality}
        </span>
        <span className="rounded-full border-2 border-blue-950 bg-blue-100 px-2 py-1 text-xs font-black">
          {player.growthType}
        </span>
        {player.injury && (
          <span className="rounded-full border-2 border-red-700 bg-red-100 px-2 py-1 text-xs font-black text-red-700">
            {player.injury.severity} あと{player.injury.weeksRemaining}週
          </span>
        )}
      </div>
      <div className="grid gap-2">
        <ProgressBar label="やる気" value={player.mood} tone="yellow" />
        <ProgressBar label="疲労" value={player.fatigue} tone={player.fatigue > 75 ? "red" : "blue"} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm font-black text-slate-700">
        <span className="flex items-center gap-1">
          <Star size={16} className="text-yellow-500" />
          才能 {player.talent.toFixed(2)}
        </span>
        <span className="flex items-center gap-1">
          <HeartPulse size={16} className="text-green-600" />
          信頼 {player.trust}
        </span>
      </div>
    </button>
  );
}
