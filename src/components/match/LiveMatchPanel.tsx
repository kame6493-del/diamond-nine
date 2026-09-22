import { ClipboardList, Shield, Swords, Trophy } from "lucide-react";
import type { LiveMatchState, MatchStrategyId } from "../../types/game";
import type { Player } from "../../types/player";
import { matchStrategies } from "../../logic/liveMatchLogic";
import { GameButton } from "../common/GameButton";
import { GamePanel } from "../common/GamePanel";

interface LiveMatchPanelProps {
  liveMatch: LiveMatchState;
  players: Player[];
  onUseStrategy: (strategyId: MatchStrategyId, selectedPlayerId?: string) => void;
  onFinish: () => void;
}

const getPlayer = (players: Player[], playerId?: string): Player | undefined =>
  players.find((player) => player.id === playerId);

const getCurrentBatter = (liveMatch: LiveMatchState, players: Player[]): Player | undefined => {
  const order = liveMatch.battingOrderIds.length > 0 ? liveMatch.battingOrderIds : players.map((player) => player.id);
  return getPlayer(players, order[liveMatch.currentBatterIndex % order.length]);
};

const getBenchPlayers = (liveMatch: LiveMatchState, players: Player[]): Player[] => {
  const activeIds = new Set(liveMatch.battingOrderIds);
  if (liveMatch.currentPitcherId) activeIds.add(liveMatch.currentPitcherId);
  liveMatch.usedBenchIds.forEach((id) => activeIds.add(id));
  return players.filter((player) => !activeIds.has(player.id));
};

export function LiveMatchPanel({ liveMatch, players, onUseStrategy, onFinish }: LiveMatchPanelProps) {
  const isTop = liveMatch.half === "top";
  const currentBatter = getCurrentBatter(liveMatch, players);
  const currentPitcher = getPlayer(players, liveMatch.currentPitcherId);
  const scoreDiff = liveMatch.ourScore - liveMatch.opponentScore;
  const momentumLabel = scoreDiff > 0 ? "リード中" : scoreDiff < 0 ? "追いかける展開" : "互角";
  const benchSign = isTop
    ? scoreDiff < 0
      ? "強攻か代打で流れを作る"
      : "出塁と進塁を大事に"
    : liveMatch.inning >= 7
      ? "継投と守備位置を慎重に"
      : "投手を落ち着かせる";
  const batterLabel = isTop ? "現在打者" : "次の攻撃の打者";
  const fieldBatterLabel = isTop ? currentBatter?.name ?? "打者" : "相手打者";
  const benchPlayers = getBenchPlayers(liveMatch, players);
  const pinchCandidates = [...benchPlayers]
    .sort((a, b) => b.contact + b.power + b.mental - (a.contact + a.power + a.mental))
    .slice(0, 5);
  const pitchingCandidates = players
    .filter((player) => player.id !== liveMatch.currentPitcherId && !liveMatch.usedBenchIds.includes(player.id))
    .sort((a, b) => b.velocity + b.control + b.stamina - (a.velocity + a.control + a.stamina))
    .slice(0, 5);
  const matchLabel = liveMatch.tournamentName
    ? `${liveMatch.tournamentName}${liveMatch.round ?? ""}${liveMatch.round ? "回戦" : ""}`
    : liveMatch.matchType === "official"
      ? "公式戦"
      : "練習試合";

  return (
    <div className="grid gap-4">
      <GamePanel title="試合中" icon={<Trophy size={22} />}>
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="broadcast-field rounded-xl border-4 border-blue-950 p-4 shadow-game">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="rounded-full border-2 border-blue-950 bg-yellow-300 px-3 py-1 text-sm font-black text-blue-950">
                {liveMatch.inning}回{isTop ? "表" : "裏"}・{isTop ? "攻撃" : "守備"}
              </div>
              <div className="rounded-full border-2 border-blue-950 bg-white px-3 py-1 text-sm font-black text-blue-950">
                采配 {liveMatch.strategyUsesRemaining}/{liveMatch.maxStrategyUses} / 交代 {liveMatch.substitutionUsesRemaining}
              </div>
            </div>
            <div className="field-diamond">
              <div className="base base-second">2</div>
              <div className="base base-third">3</div>
              <div className="base base-first">1</div>
              <div className="base base-home">H</div>
              <div className="mound">
                <span>{currentPitcher?.name ?? "投手"}</span>
              </div>
              <div className="batter-box">
                <span>{fieldBatterLabel}</span>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border-2 border-blue-950 bg-yellow-200 px-3 py-2 text-center font-black text-blue-950">
                {momentumLabel}
              </div>
              <div className="rounded-xl border-2 border-blue-950 bg-white px-3 py-2 text-center font-black text-blue-950">
                {liveMatch.inning >= 7 ? "終盤勝負" : "序盤の組み立て"}
              </div>
              <div className="rounded-xl border-2 border-blue-950 bg-green-200 px-3 py-2 text-center font-black text-blue-950">
                ベンチサイン
              </div>
            </div>
            <p className="mt-2 rounded-xl border-2 border-blue-950 bg-white/90 px-3 py-2 text-sm font-black text-blue-950">
              {benchSign}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-blue-950 bg-white/90 p-3">
                <p className="text-xs font-black text-blue-700">{batterLabel}</p>
                <p className="text-lg font-black">{currentBatter?.name ?? "-"}</p>
                <p className="text-sm font-bold text-slate-600">
                  ミート {currentBatter?.contact ?? "-"} / パワー {currentBatter?.power ?? "-"} / 走力 {currentBatter?.speed ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border-2 border-blue-950 bg-white/90 p-3">
                <p className="text-xs font-black text-blue-700">現在投手</p>
                <p className="text-lg font-black">{currentPitcher?.name ?? "-"}</p>
                <p className="text-sm font-bold text-slate-600">
                  球速 {currentPitcher?.velocity ?? "-"} / 制球 {currentPitcher?.control ?? "-"} / スタミナ {currentPitcher?.stamina ?? "-"}
                </p>
              </div>
            </div>
          </div>
          <div className="scoreboard-panel overflow-hidden rounded-xl border-4 border-blue-950 bg-slate-950 p-4 text-white shadow-game">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-yellow-300">{matchLabel}</p>
              <p className="text-lg font-black">
                {liveMatch.inning}回{isTop ? "表" : "裏"}・{isTop ? "攻撃中" : "守備中"}
              </p>
            </div>
            <p className="rounded-full border-2 border-yellow-300 px-3 py-1 text-sm font-black">
              采配 {liveMatch.strategyUsesRemaining}/{liveMatch.maxStrategyUses}
            </p>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div>
              <p className="text-sm font-bold text-blue-200">青空高校</p>
              <p className="text-6xl font-black text-yellow-300">{liveMatch.ourScore}</p>
            </div>
            <p className="text-3xl font-black text-white">-</p>
            <div>
              <p className="text-sm font-bold text-blue-200">
                {liveMatch.opponentName} ({liveMatch.opponentRank})
              </p>
              <p className="text-6xl font-black text-white">{liveMatch.opponentScore}</p>
            </div>
          </div>
          </div>
        </div>
      </GamePanel>

      <GamePanel title="監督采配" icon={isTop ? <Swords size={22} /> : <Shield size={22} />}>
        {liveMatch.finished ? (
          <div className="grid gap-3">
            <p className="rounded-xl border-2 border-blue-950 bg-yellow-50 p-4 text-lg font-black">
              試合終了です。結果を確認しましょう。
            </p>
            <GameButton variant="secondary" onClick={onFinish}>
              結果を見る
            </GameButton>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {matchStrategies
              .filter((strategy) => strategy.id !== "pinchHitter" && strategy.id !== "pitchingChange")
              .map((strategy) => {
              const disabled = strategy.id !== "balanced" && liveMatch.strategyUsesRemaining <= 0;
              const defenseOnly = strategy.id === "defenseShift" || strategy.id === "pitcherTalk";
              const attackOnly = strategy.id === "aggressive" || strategy.id === "bunt" || strategy.id === "steal";
              const contextMuted = (isTop && defenseOnly) || (!isTop && attackOnly);
              return (
                <button
                  key={strategy.id}
                  className={`asset-button rounded-xl border-4 border-blue-950 p-3 text-left shadow-[0_5px_0_rgba(8,47,73,0.24)] transition hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 ${
                    strategy.id === "balanced"
                      ? "bg-gradient-to-b from-white to-blue-100 text-blue-950"
                      : contextMuted
                        ? "bg-gradient-to-b from-slate-100 to-slate-200 text-slate-700"
                        : "bg-gradient-to-b from-yellow-200 via-yellow-300 to-amber-400 text-blue-950"
                  }`}
                  disabled={disabled}
                  onClick={() => onUseStrategy(strategy.id)}
                >
                  <span className="block text-lg font-black">{strategy.name}</span>
                  <span className="mt-1 block text-sm font-bold leading-relaxed">{strategy.description}</span>
                </button>
              );
            })}
          </div>
        )}
      </GamePanel>

      {!liveMatch.finished && (
        <GamePanel title="選手指定采配" icon={<Shield size={22} />}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border-2 border-blue-950 bg-yellow-50 p-3">
              <p className="mb-2 text-sm font-black text-blue-700">代打候補</p>
              <div className="grid gap-2">
                {pinchCandidates.length > 0 ? (
                  pinchCandidates.map((player) => (
                    <button
                      key={player.id}
                      className="asset-button rounded-xl border-2 border-blue-950 bg-gradient-to-b from-yellow-200 to-amber-400 p-3 text-left font-black text-blue-950 disabled:opacity-50"
                      disabled={!isTop || liveMatch.strategyUsesRemaining <= 0 || liveMatch.substitutionUsesRemaining <= 0}
                      onClick={() => onUseStrategy("pinchHitter", player.id)}
                    >
                      代打 {player.name}
                      <span className="mt-1 block text-sm font-bold">
                        ミート {player.contact} / パワー {player.power} / メンタル {player.mental}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="font-bold text-slate-600">控え野手がいません。</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border-2 border-blue-950 bg-blue-50 p-3">
              <p className="mb-2 text-sm font-black text-blue-700">継投候補</p>
              <div className="grid gap-2">
                {pitchingCandidates.length > 0 ? (
                  pitchingCandidates.map((player) => (
                    <button
                      key={player.id}
                      className="asset-button rounded-xl border-2 border-blue-950 bg-gradient-to-b from-blue-300 to-blue-700 p-3 text-left font-black text-white disabled:opacity-50"
                      disabled={isTop || liveMatch.strategyUsesRemaining <= 0 || liveMatch.substitutionUsesRemaining <= 0}
                      onClick={() => onUseStrategy("pitchingChange", player.id)}
                    >
                      継投 {player.name}
                      <span className="mt-1 block text-sm font-bold">
                        球速 {player.velocity} / 制球 {player.control} / スタミナ {player.stamina}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="font-bold text-slate-600">継投候補がいません。</p>
                )}
              </div>
            </div>
          </div>
        </GamePanel>
      )}

      <GamePanel title="実況ログ" icon={<ClipboardList size={22} />}>
        <div className="grid max-h-80 gap-2 overflow-auto pr-1">
          {liveMatch.logs.map((log, index) => (
            <p
              key={`${log}-${index}`}
              className="rounded-xl border-2 border-blue-950 bg-white px-3 py-2 text-sm font-bold text-slate-700"
            >
              {log}
            </p>
          ))}
        </div>
      </GamePanel>
    </div>
  );
}
