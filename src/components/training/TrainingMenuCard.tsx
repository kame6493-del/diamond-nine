import {
  CircleDot,
  Dumbbell,
  Footprints,
  Handshake,
  HeartPulse,
  MessageSquare,
  Shield,
} from "lucide-react";
import type { ReactNode } from "react";
import type { TrainingMenu } from "../../types/game";
import { GameButton } from "../common/GameButton";
import { abilityLabels } from "../players/abilityLabels";

interface TrainingMenuCardProps {
  menu: TrainingMenu;
  disabled: boolean;
  onSelect: (menu: TrainingMenu) => void;
}

const iconMap: Record<string, ReactNode> = {
  Bat: <Dumbbell size={30} />,
  Glove: <Shield size={30} />,
  Footprints: <Footprints size={30} />,
  CircleDot: <CircleDot size={30} />,
  Handshake: <Handshake size={30} />,
  MessagesSquare: <MessageSquare size={30} />,
  HeartPulse: <HeartPulse size={30} />,
};

export function TrainingMenuCard({ menu, disabled, onSelect }: TrainingMenuCardProps) {
  return (
    <article className="training-card overflow-hidden rounded-xl border-4 border-blue-950 bg-white p-4 shadow-[0_6px_0_rgba(8,47,73,0.22)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border-2 border-blue-950 bg-gradient-to-b from-yellow-200 to-yellow-400 p-3 text-blue-800 shadow-[0_3px_0_rgba(8,47,73,0.22)]">
            {iconMap[menu.icon] ?? <Dumbbell size={30} />}
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-950">{menu.name}</h3>
            <p className="text-sm font-bold text-slate-600">{menu.description}</p>
          </div>
        </div>
        <span className="rounded-lg border-2 border-blue-950 bg-blue-100 px-3 py-1 font-black">
          AP {menu.actionCost}
        </span>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(menu.effects).map(([ability, value]) => (
          <span
            key={ability}
            className="rounded-full border-2 border-blue-950 bg-green-50 px-2 py-1 text-sm font-black text-slate-700"
          >
            {abilityLabels[ability as keyof typeof abilityLabels] ?? ability} {value > 0 ? "+" : ""}
            {value}
          </span>
        ))}
        <span
          className={`rounded-full border-2 border-blue-950 px-2 py-1 text-sm font-black ${
            menu.fatigueChange > 0 ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
          }`}
        >
          疲労 {menu.fatigueChange > 0 ? "+" : ""}
          {menu.fatigueChange}
        </span>
      </div>
      <GameButton
        className="w-full"
        variant={menu.id === "rest" ? "success" : "primary"}
        disabled={disabled}
        onClick={() => onSelect(menu)}
      >
        今週はこれ
      </GameButton>
    </article>
  );
}
