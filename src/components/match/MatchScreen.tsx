import { Play, Shield, Trophy, Zap } from "lucide-react";
import type { GameState, LiveMatchState, MatchResult, MatchStrategyId, TeamLineup } from "../../types/game";
import type { Player } from "../../types/player";
import { calculateTeamPower, getScheduledMatchName } from "../../logic/matchLogic";
import { GameButton } from "../common/GameButton";
import { GamePanel } from "../common/GamePanel";
import { ProgressBar } from "../common/ProgressBar";
import { MascotMessage } from "../mascot/MascotMessage";
import { LineupSetupPanel } from "./LineupSetupPanel";
import { LiveMatchPanel } from "./LiveMatchPanel";
import { ScoreBoard } from "./ScoreBoard";

interface MatchScreenProps {
  gameState: GameState;
  players: Player[];
  teamLineup: TeamLineup;
  matchHistory: MatchResult[];
  liveMatch?: LiveMatchState;
  onPracticeMatch: () => void;
  onOfficialMatch: () => void;
  onUseStrategy: (strategyId: MatchStrategyId, selectedPlayerId?: string) => void;
  onFinishLiveMatch: () => void;
  onMoveBattingOrder: (playerId: string, direction: -1 | 1) => void;
  onSetStarter: (playerId: string) => void;
  onSetRelief: (playerId: string) => void;
  onSetCaptain: (playerId: string) => void;
}

export function MatchScreen({
  gameState,
  players,
  teamLineup,
  matchHistory,
  liveMatch,
  onPracticeMatch,
  onOfficialMatch,
  onUseStrategy,
  onFinishLiveMatch,
  onMoveBattingOrder,
  onSetStarter,
  onSetRelief,
  onSetCaptain,
}: MatchScreenProps) {
  const power = calculateTeamPower(players);
  const scheduledMatch = getScheduledMatchName(gameState);
  const scheduledOfficialMatch = scheduledMatch && scheduledMatch !== "夏合宿";
  const latest = matchHistory[0];

  if (liveMatch) {
    return (
      <LiveMatchPanel
        liveMatch={liveMatch}
        players={players}
        onUseStrategy={onUseStrategy}
        onFinish={onFinishLiveMatch}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <MascotMessage
        message={scheduledOfficialMatch ? "まもなく試合開始です。" : "信頼度が高いほど作戦が通りやすくなるよ！"}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <GamePanel title="チーム戦力" icon={<Trophy size={22} />}>
          <div className="grid gap-4">
            <ProgressBar label="攻撃力" value={power.offense} tone="yellow" />
            <ProgressBar label="守備力" value={power.defense} tone="green" />
            <ProgressBar label="投手力" value={power.pitching} tone="blue" />
            <div className="rounded-xl border-2 border-blue-950 bg-blue-50 p-4 text-center">
              <p className="text-sm font-black text-blue-700">総合戦力</p>
              <p className="text-4xl font-black text-slate-950">{Math.round(power.total)}</p>
            </div>
          </div>
        </GamePanel>
        <GamePanel title="試合予定" icon={<Play size={22} />}>
          <div className="grid gap-3">
            <div className="rounded-xl border-2 border-blue-950 bg-yellow-50 p-4">
              <p className="text-sm font-black text-blue-700">次の大会・予定</p>
              <p className="text-2xl font-black text-slate-950">
                {scheduledMatch ?? `大会まであと${gameState.daysUntilTournament}日`}
              </p>
            </div>
            <GameButton icon={<Play size={20} />} variant="success" onClick={onPracticeMatch}>
              練習試合をする
            </GameButton>
            {scheduledOfficialMatch && (
              <GameButton icon={<Trophy size={20} />} variant="secondary" onClick={onOfficialMatch}>
                公式戦を開始
              </GameButton>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm font-black">
              <div className="rounded-xl border-2 border-blue-950 bg-white p-3">
                <Zap size={18} className="text-yellow-500" />
                信頼度が作戦成功率に影響
              </div>
              <div className="rounded-xl border-2 border-blue-950 bg-white p-3">
                <Shield size={18} className="text-green-600" />
                守備と投手力で失点を抑制
              </div>
            </div>
          </div>
        </GamePanel>
      </div>
      {latest && (
        <GamePanel title="直近の試合" icon={<Trophy size={22} />}>
          <ScoreBoard result={latest} />
        </GamePanel>
      )}
      <LineupSetupPanel
        players={players}
        teamLineup={teamLineup}
        onMoveBattingOrder={onMoveBattingOrder}
        onSetStarter={onSetStarter}
        onSetRelief={onSetRelief}
        onSetCaptain={onSetCaptain}
      />
    </div>
  );
}
