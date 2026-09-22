import { Database, Trophy } from "lucide-react";
import type { EventLogItem, GameState, MatchResult } from "../../types/game";
import type { Player } from "../../types/player";
import { SaveLoadPanel } from "../common/SaveLoadPanel";
import { GamePanel } from "../common/GamePanel";

interface DataScreenProps {
  gameState: GameState;
  players: Player[];
  matchHistory: MatchResult[];
  eventLog: EventLogItem[];
  onSave: () => void;
  onLoad: () => void;
  onReset: () => void;
}

const categoryLabel: Record<NonNullable<EventLogItem["category"]>, string> = {
  event: "イベント",
  match: "試合",
  tournament: "大会",
  recruit: "新入生",
  graduation: "卒業",
};

export function DataScreen({
  gameState,
  players,
  matchHistory,
  eventLog,
  onSave,
  onLoad,
  onReset,
}: DataScreenProps) {
  const wins = matchHistory.filter((match) => match.isWin).length;
  const losses = matchHistory.length - wins;
  const officialWins = matchHistory.filter((match) => match.matchType === "official" && match.isWin).length;
  const latestTournament = matchHistory.find((match) => match.tournamentName);

  return (
    <div className="grid gap-4">
      <SaveLoadPanel onSave={onSave} onLoad={onLoad} onReset={onReset} />
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <GamePanel title="チームデータ" icon={<Database size={22} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border-2 border-slate-800 bg-yellow-50 p-3">
              <p className="text-sm font-black text-blue-700">戦績</p>
              <p className="text-2xl font-black">
                {wins}勝 {losses}敗
              </p>
            </div>
            <div className="rounded-lg border-2 border-slate-800 bg-green-50 p-3">
              <p className="text-sm font-black text-blue-700">部員数</p>
              <p className="text-2xl font-black">{players.length}人</p>
            </div>
            <div className="rounded-lg border-2 border-slate-800 bg-blue-50 p-3">
              <p className="text-sm font-black text-blue-700">評判</p>
              <p className="text-2xl font-black">{gameState.reputation}</p>
            </div>
            <div className="rounded-lg border-2 border-slate-800 bg-white p-3">
              <p className="text-sm font-black text-blue-700">翌年度候補</p>
              <p className="text-2xl font-black">{gameState.incomingRecruits.length}人</p>
            </div>
            <div className="rounded-lg border-2 border-slate-800 bg-yellow-50 p-3">
              <p className="text-sm font-black text-blue-700">公式戦勝利</p>
              <p className="text-2xl font-black">{officialWins}勝</p>
            </div>
            <div className="rounded-lg border-2 border-slate-800 bg-green-50 p-3">
              <p className="text-sm font-black text-blue-700">今年度成績P</p>
              <p className="text-2xl font-black">{gameState.seasonPerformance}</p>
            </div>
          </div>
        </GamePanel>
        <GamePanel title="試合履歴" icon={<Trophy size={22} />}>
          <div className="grid max-h-80 gap-2 overflow-auto pr-1">
            {matchHistory.length > 0 ? (
              matchHistory.map((match) => (
                <div key={match.id} className="rounded-lg border-2 border-slate-800 bg-white p-3">
                  <p className="text-sm font-black text-blue-700">{match.date}</p>
                  {match.tournamentName && (
                    <p className="text-xs font-black text-green-700">
                      {match.tournamentName}
                      {match.round ? `${match.round}回戦` : ""}
                    </p>
                  )}
                  <p className="text-lg font-black">
                    {match.isWin ? "勝利" : "敗戦"} {match.opponentName} {match.ourScore}-{match.opponentScore}
                  </p>
                  <p className="font-bold text-slate-600">活躍：{match.starPlayerName}</p>
                </div>
              ))
            ) : (
              <p className="font-bold text-slate-500">まだ試合履歴はありません。</p>
            )}
          </div>
        </GamePanel>
      </div>
      <GamePanel title="大会メモ" icon={<Trophy size={22} />}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border-2 border-slate-800 bg-yellow-50 p-3">
            <p className="text-sm font-black text-blue-700">進行中</p>
            <p className="text-xl font-black">
              {gameState.activeTournament
                ? `${gameState.activeTournament.name}${gameState.activeTournament.round}回戦`
                : "なし"}
            </p>
          </div>
          <div className="rounded-lg border-2 border-slate-800 bg-blue-50 p-3">
            <p className="text-sm font-black text-blue-700">全国大会</p>
            <p className="text-xl font-black">{gameState.qualifiedForNational ? "出場権あり" : "未定"}</p>
          </div>
          <div className="rounded-lg border-2 border-slate-800 bg-green-50 p-3">
            <p className="text-sm font-black text-blue-700">直近大会</p>
            <p className="text-xl font-black">{latestTournament?.tournamentName ?? "まだなし"}</p>
          </div>
        </div>
      </GamePanel>
      <GamePanel title="イベントログ" icon={<Database size={22} />}>
        <div className="grid max-h-96 gap-2 overflow-auto pr-1">
          {eventLog.length > 0 ? (
            eventLog.map((event) => (
              <div key={event.id} className="rounded-lg border-2 border-slate-800 bg-yellow-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-blue-700">{event.date}</p>
                  {event.category && (
                    <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-xs font-black text-blue-700">
                      {categoryLabel[event.category]}
                    </span>
                  )}
                </div>
                <p className="text-lg font-black">{event.title}</p>
                <p className="font-bold text-slate-700">{event.message}</p>
              </div>
            ))
          ) : (
            <p className="font-bold text-slate-500">まだイベントログはありません。</p>
          )}
        </div>
      </GamePanel>
    </div>
  );
}
