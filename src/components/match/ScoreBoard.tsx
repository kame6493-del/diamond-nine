import type { MatchResult } from "../../types/game";

interface ScoreBoardProps {
  result: MatchResult;
}

export function ScoreBoard({ result }: ScoreBoardProps) {
  const matchLabel = result.tournamentName
    ? `${result.tournamentName}${result.round ?? ""}${result.round ? "回戦" : ""}`
    : result.matchType === "official"
      ? "公式戦"
      : "練習試合";

  return (
    <div className="scoreboard-panel overflow-hidden rounded-xl border-4 border-blue-950 bg-slate-950 p-4 text-white shadow-game">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-yellow-300">{result.date}</p>
          <p className="text-xs font-black text-blue-200">{matchLabel}</p>
        </div>
        <p className="rounded-full border-2 border-yellow-300 px-3 py-1 text-sm font-black">
          {result.isWin ? "WIN" : "LOSE"}
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <div>
          <p className="text-sm font-bold text-blue-200">がっこう野球部</p>
          <p className="text-5xl font-black text-yellow-300">{result.ourScore}</p>
        </div>
        <p className="text-3xl font-black text-white">-</p>
        <div>
          <p className="text-sm font-bold text-blue-200">
            {result.opponentName} ({result.opponentRank})
          </p>
          <p className="text-5xl font-black text-white">{result.opponentScore}</p>
        </div>
      </div>
      <p className="mt-3 text-center text-lg font-black text-green-300">活躍選手：{result.starPlayerName}</p>
    </div>
  );
}
