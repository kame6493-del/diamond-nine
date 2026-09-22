import type { TrainingResult } from "../../types/game";
import { AssetImage } from "../assets/AssetImage";
import { ResultModal } from "../common/ResultModal";
import { abilityLabels } from "../players/abilityLabels";

interface TrainingResultModalProps {
  result?: TrainingResult;
  open: boolean;
  onClose: () => void;
}

export function TrainingResultModal({ result, open, onClose }: TrainingResultModalProps) {
  if (!result) return null;

  return (
    <ResultModal open={open} title={result.title} message={result.message} onClose={onClose}>
      <AssetImage
        asset="trainingResultPanel"
        alt="成長結果UI参考"
        noFrame
        imgClassName="mb-3 h-24 w-full rounded-lg border-2 border-blue-950 object-cover object-left"
      />
      <div className="grid gap-2">
        {result.changes.slice(0, 8).map((change) => (
          <div key={change.playerId} className="rounded-xl border-2 border-blue-950 bg-slate-50 p-3">
            <p className="font-black text-slate-950">{change.playerName}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(change.gains).map(([key, value]) => (
                <span key={key} className="rounded-full border border-blue-200 bg-white px-2 py-1 text-sm font-bold text-slate-700">
                  {abilityLabels[key as keyof typeof abilityLabels]} {Number(value) > 0 ? "+" : ""}
                  {String(value)}
                </span>
              ))}
              {change.injury && (
                <span className="rounded-full bg-red-100 px-2 py-1 text-sm font-black text-red-700">
                  怪我 {change.injury}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </ResultModal>
  );
}
