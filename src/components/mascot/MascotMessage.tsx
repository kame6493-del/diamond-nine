import type { CutAssetKey } from "../../constants/assets";
import { AssetImage } from "../assets/AssetImage";

interface MascotMessageProps {
  message: string;
  pose?: Extract<
    CutAssetKey,
    "mascotStanding" | "mascotPointing" | "mascotClipboard" | "mascotCheering" | "mascotSweating"
  >;
}

export function MascotMessage({ message, pose = "mascotPointing" }: MascotMessageProps) {
  return (
    <aside className="asset-talk grid gap-3 rounded-xl border-4 border-blue-950 bg-yellow-100 p-4 shadow-game sm:grid-cols-[120px_1fr] sm:items-center">
      <AssetImage asset={pose} alt="案内マスコット" noFrame imgClassName="mx-auto h-32 object-contain" />
      <div className="rounded-xl border-2 border-blue-950 bg-white p-4 shadow-[0_4px_0_rgba(8,47,73,0.12)]">
        <p className="text-sm font-black text-blue-700">きいろ監督補佐</p>
        <p className="text-xl font-black leading-relaxed text-slate-950">{message}</p>
      </div>
    </aside>
  );
}
