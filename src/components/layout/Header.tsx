import { Trophy } from "lucide-react";
import { AssetImage } from "../assets/AssetImage";

export function Header() {
  return (
    <header className="asset-header overflow-hidden rounded-xl border-4 border-blue-950 bg-gradient-to-r from-blue-800 via-blue-600 to-blue-400 p-3 shadow-game">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
        <div className="relative z-10 grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
          <AssetImage
            asset="mascotBadge"
            alt="がっこう野球部ものがたり ロゴ"
            noFrame
            imgClassName="mx-auto max-h-32 w-full max-w-[180px] object-contain sm:mx-0"
          />
          <div>
            <p className="inline-flex items-center rounded-full border-2 border-blue-950 bg-yellow-300 px-3 py-1 text-sm font-black text-blue-950">
              週刊高校野球部育成シミュレーション
            </p>
            <h1 className="mt-2 text-2xl font-black leading-tight text-white drop-shadow-[0_3px_0_rgba(8,47,73,0.55)] sm:text-3xl">
              がっこう野球部ものがたり
            </h1>
            <p className="mt-2 max-w-xl rounded-lg border-2 border-blue-950 bg-white/95 px-3 py-2 text-sm font-black text-blue-950 sm:text-base">
              弱小校から始める、明るい野球部育成シミュレーション
            </p>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-3 rounded-xl border-2 border-blue-950 bg-yellow-100/95 p-3">
          <Trophy className="shrink-0 text-yellow-500" size={28} />
          <p className="font-black text-blue-950">春夏秋の大会を勝ち上がれ</p>
          <AssetImage
            asset="mascotPointing"
            alt="案内マスコット"
            noFrame
            imgClassName="ml-auto h-20 object-contain"
          />
        </div>
      </div>
    </header>
  );
}
