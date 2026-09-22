import { CalendarDays, Coins, Gauge, Star, Trophy, Zap } from "lucide-react";
import type { GameState } from "../../types/game";
import { AssetImage } from "../assets/AssetImage";
import { ProgressBar } from "../common/ProgressBar";

interface StatusBarProps {
  gameState: GameState;
}

export function StatusBar({ gameState }: StatusBarProps) {
  const items = [
    {
      label: "年月",
      value: `${gameState.year}年目 ${gameState.month}月${gameState.week}週`,
      icon: <CalendarDays size={20} />,
    },
    { label: "資金", value: `${gameState.funds.toLocaleString()}G`, icon: <Coins size={20} /> },
    { label: "成長P", value: gameState.growthPoints, icon: <Zap size={20} /> },
    { label: "評判", value: gameState.reputation, icon: <Star size={20} /> },
    { label: "ランク", value: gameState.teamRank, icon: <Trophy size={20} /> },
    { label: "天気", value: gameState.weather, icon: <Gauge size={20} /> },
  ];

  return (
    <section className="asset-status grid gap-3 rounded-xl border-4 border-blue-950 bg-white p-3 shadow-game lg:grid-cols-[170px_1.1fr_2fr]">
      <AssetImage
        asset="resourceCounters"
        alt="ヘッダーステータス参考"
        noFrame
        imgClassName="hidden h-full max-h-28 w-full rounded-lg border-2 border-blue-950 object-cover object-left lg:block"
      />
      <div>
        <ProgressBar
          label="行動力"
          value={gameState.actionPower}
          max={gameState.maxActionPower}
          tone={gameState.actionPower < 30 ? "red" : "green"}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => (
          <div
            key={item.label}
            className="min-h-16 rounded-xl border-2 border-blue-950 bg-blue-50 px-3 py-2"
          >
            <p className="flex items-center gap-1 text-xs font-black text-blue-700">
              {item.icon}
              {item.label}
            </p>
            <p className="text-lg font-black text-slate-950">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
