import { ArrowDown, ArrowUp, BadgeCheck, Star, UserRoundCheck } from "lucide-react";
import type { TeamLineup } from "../../types/game";
import type { Player } from "../../types/player";
import { getBenchPlayers, getPlayerDisplayScore, sortPitchingCandidates } from "../../logic/lineupLogic";
import { GameButton } from "../common/GameButton";
import { GamePanel } from "../common/GamePanel";

interface LineupSetupPanelProps {
  players: Player[];
  teamLineup: TeamLineup;
  onMoveBattingOrder: (playerId: string, direction: -1 | 1) => void;
  onSetStarter: (playerId: string) => void;
  onSetRelief: (playerId: string) => void;
  onSetCaptain: (playerId: string) => void;
}

export function LineupSetupPanel({
  players,
  teamLineup,
  onMoveBattingOrder,
  onSetStarter,
  onSetRelief,
  onSetCaptain,
}: LineupSetupPanelProps) {
  const battingPlayers = teamLineup.battingOrderIds
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player));
  const pitchers = sortPitchingCandidates(players).slice(0, 6);
  const benchPlayers = getBenchPlayers(teamLineup, players);

  return (
    <GamePanel title="スタメン・打順" icon={<UserRoundCheck size={22} />}>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="grid gap-2">
          {battingPlayers.map((player, index) => (
            <div
              key={player.id}
              className="grid gap-2 rounded-xl border-2 border-blue-950 bg-white p-3 shadow-[0_3px_0_rgba(8,47,73,0.16)] sm:grid-cols-[48px_1fr_auto] sm:items-center"
            >
              <div className="rounded-lg border-2 border-blue-950 bg-yellow-200 py-2 text-center text-xl font-black text-blue-950">
                {index + 1}
              </div>
              <div>
                <p className="text-lg font-black text-slate-950">
                  {player.name}
                  {teamLineup.captainId === player.id && (
                    <span className="ml-2 rounded-full border border-yellow-500 bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                      主将
                    </span>
                  )}
                </p>
                <p className="text-sm font-bold text-slate-600">
                  {player.position} / 総合 {getPlayerDisplayScore(player)} / 調子 {player.mood}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  aria-label={`${player.name}を上へ`}
                  className="rounded-lg border-2 border-blue-950 bg-blue-100 p-2 disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => onMoveBattingOrder(player.id, -1)}
                >
                  <ArrowUp size={18} />
                </button>
                <button
                  aria-label={`${player.name}を下へ`}
                  className="rounded-lg border-2 border-blue-950 bg-blue-100 p-2 disabled:opacity-40"
                  disabled={index === battingPlayers.length - 1}
                  onClick={() => onMoveBattingOrder(player.id, 1)}
                >
                  <ArrowDown size={18} />
                </button>
                <GameButton variant="ghost" className="min-h-9 px-3 py-1 text-sm" onClick={() => onSetCaptain(player.id)}>
                  主将
                </GameButton>
              </div>
            </div>
          ))}
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded-xl border-2 border-blue-950 bg-blue-50 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-black text-blue-700">
              <Star size={18} />
              投手起用
            </p>
            <div className="grid gap-2">
              {pitchers.map((player) => (
                <div key={player.id} className="rounded-lg border-2 border-blue-950 bg-white p-2">
                  <p className="font-black">{player.name}</p>
                  <p className="text-xs font-bold text-slate-600">
                    球速 {player.velocity} / 制球 {player.control} / スタミナ {player.stamina}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <GameButton
                      variant={teamLineup.startingPitcherId === player.id ? "secondary" : "ghost"}
                      className="min-h-9 px-3 py-1 text-sm"
                      onClick={() => onSetStarter(player.id)}
                    >
                      先発
                    </GameButton>
                    <GameButton
                      variant={teamLineup.reliefPitcherId === player.id ? "success" : "ghost"}
                      className="min-h-9 px-3 py-1 text-sm"
                      onClick={() => onSetRelief(player.id)}
                    >
                      控え投手
                    </GameButton>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border-2 border-blue-950 bg-green-50 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-black text-blue-700">
              <BadgeCheck size={18} />
              控え
            </p>
            <div className="flex flex-wrap gap-2">
              {benchPlayers.length > 0 ? (
                benchPlayers.map((player) => (
                  <span key={player.id} className="rounded-full border-2 border-blue-950 bg-white px-3 py-1 text-sm font-black">
                    {player.name}
                  </span>
                ))
              ) : (
                <p className="font-bold text-slate-600">控え選手がいません。</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </GamePanel>
  );
}
