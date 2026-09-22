import type { MatchResult } from "../../types/game";
import { ResultModal } from "../common/ResultModal";
import { ScoreBoard } from "./ScoreBoard";

interface MatchResultModalProps {
  result?: MatchResult;
  open: boolean;
  onClose: () => void;
}

export function MatchResultModal({ result, open, onClose }: MatchResultModalProps) {
  if (!result) return null;

  return (
    <ResultModal
      open={open}
      title={result.isWin ? "見事な勝利です！" : "惜しくも敗れました。"}
      message={result.summary}
      onClose={onClose}
    >
      <ScoreBoard result={result} />
      {result.inningLogs.length > 0 && (
        <div className="mt-4 rounded-xl border-2 border-blue-950 bg-blue-50 p-3">
          <p className="mb-2 text-sm font-black text-blue-700">試合ログ</p>
          <div className="grid max-h-48 gap-2 overflow-auto pr-1">
            {result.inningLogs.map((log, index) => (
              <p key={`${log}-${index}`} className="rounded-lg border-2 border-blue-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                {log}
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border-2 border-blue-950 bg-yellow-50 p-3 text-center">
          <p className="text-sm font-black text-blue-700">成長ポイント</p>
          <p className="text-2xl font-black">+{result.growthPoints}</p>
        </div>
        <div className="rounded-xl border-2 border-blue-950 bg-green-50 p-3 text-center">
          <p className="text-sm font-black text-blue-700">資金増加</p>
          <p className="text-2xl font-black">+{result.fundsGained}G</p>
        </div>
        <div className="rounded-xl border-2 border-blue-950 bg-blue-50 p-3 text-center">
          <p className="text-sm font-black text-blue-700">学校評判</p>
          <p className="text-2xl font-black">
            {result.reputationChange > 0 ? "+" : ""}
            {result.reputationChange}
          </p>
        </div>
      </div>
    </ResultModal>
  );
}
