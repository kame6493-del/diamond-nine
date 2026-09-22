import {
  Database,
  Dumbbell,
  House,
  Image,
  School,
  Search,
  Trophy,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Screen } from "../../types/game";

interface NavigationTabsProps {
  activeScreen: Screen;
  onChange: (screen: Screen) => void;
}

const tabs: Array<{ id: Screen; label: string; icon: ReactNode }> = [
  { id: "home", label: "ホーム", icon: <House size={20} /> },
  { id: "training", label: "練習", icon: <Dumbbell size={20} /> },
  { id: "match", label: "試合", icon: <Trophy size={20} /> },
  { id: "players", label: "選手", icon: <UsersRound size={20} /> },
  { id: "school", label: "学校", icon: <School size={20} /> },
  { id: "scout", label: "スカウト", icon: <Search size={20} /> },
  { id: "data", label: "データ", icon: <Database size={20} /> },
  { id: "assets", label: "アセット", icon: <Image size={20} /> },
];

export function NavigationTabs({ activeScreen, onChange }: NavigationTabsProps) {
  return (
    <nav className="asset-tabs-bar flex gap-2 overflow-x-auto rounded-xl border-4 border-blue-950 bg-white/90 p-2 shadow-game">
      {tabs.map((tab) => {
        const isActive = tab.id === activeScreen;
        return (
          <button
            key={tab.id}
            className={`asset-tab flex min-h-12 min-w-[116px] items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-base font-black shadow-[0_4px_0_rgba(8,47,73,0.28)] transition active:translate-y-0.5 active:shadow-none sm:min-w-0 sm:flex-1 ${
              isActive
                ? "border-blue-950 bg-gradient-to-b from-yellow-200 to-yellow-400 text-blue-950"
                : "border-blue-950 bg-gradient-to-b from-blue-400 to-blue-700 text-white hover:from-green-300 hover:to-green-600"
            }`}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
