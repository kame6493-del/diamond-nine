import { School } from "lucide-react";
import type { Facility, GameState } from "../../types/game";
import { AssetImage } from "../assets/AssetImage";
import { GamePanel } from "../common/GamePanel";
import { MascotMessage } from "../mascot/MascotMessage";
import { FacilityCard } from "./FacilityCard";

interface SchoolScreenProps {
  gameState: GameState;
  facilities: Facility[];
  onUpgradeFacility: (facility: Facility) => void;
}

export function SchoolScreen({ gameState, facilities, onUpgradeFacility }: SchoolScreenProps) {
  return (
    <div className="grid gap-4">
      <MascotMessage message="施設が育つと、同じ練習でも伸び方が変わるよ！" pose="mascotClipboard" />
      <GamePanel title="学校施設" icon={<School size={22} />}>
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_240px] lg:items-center">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border-2 border-blue-950 bg-yellow-50 p-3">
              <p className="text-sm font-black text-blue-700">資金</p>
              <p className="text-2xl font-black">{gameState.funds.toLocaleString()}G</p>
            </div>
            <div className="rounded-xl border-2 border-blue-950 bg-green-50 p-3">
              <p className="text-sm font-black text-blue-700">評判</p>
              <p className="text-2xl font-black">{gameState.reputation}</p>
            </div>
            <div className="rounded-xl border-2 border-blue-950 bg-blue-50 p-3">
              <p className="text-sm font-black text-blue-700">チームランク</p>
              <p className="text-2xl font-black">{gameState.teamRank}</p>
            </div>
          </div>
          <AssetImage
            asset="locationTiles"
            alt="学校施設タイル参考"
            noFrame
            imgClassName="h-32 w-full rounded-lg border-2 border-blue-950 object-cover object-left"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {facilities.map((facility) => (
            <FacilityCard
              key={facility.id}
              facility={facility}
              funds={gameState.funds}
              onUpgrade={onUpgradeFacility}
            />
          ))}
        </div>
      </GamePanel>
    </div>
  );
}
