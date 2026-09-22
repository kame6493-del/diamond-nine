import { CalendarDays, ClipboardList, Trophy, UsersRound } from "lucide-react";
import type { GameState, MatchResult } from "../../types/game";
import type { Player } from "../../types/player";
import { calculateTeamPower, getScheduledMatchName } from "../../logic/matchLogic";
import { AssetImage } from "../assets/AssetImage";
import { GameButton } from "../common/GameButton";
import { GamePanel } from "../common/GamePanel";
import { ProgressBar } from "../common/ProgressBar";
import { MascotMessage } from "../mascot/MascotMessage";

interface HomeScreenProps {
  gameState: GameState;
  players: Player[];
  matchHistory: MatchResult[];
  onGoTraining: () => void;
  onGoMatch: () => void;
}

const schedule = [
  "4月：新入生加入 / 春大会",
  "6月：夏大会前の追い込み",
  "7月：夏の地区大会",
  "8月：全国大会 / 合宿",
  "9月：3年生引退 / 秋大会準備",
  "10月：秋大会",
  "12月：冬トレ",
  "1月：初詣",
  "2月：スカウト",
  "3月：卒業 / 新年度準備",
];

export function HomeScreen({
  gameState,
  players,
  matchHistory,
  onGoTraining,
  onGoMatch,
}: HomeScreenProps) {
  const tired = players.filter((player) => player.fatigue >= 75).length;
  const injured = players.filter((player) => player.injury).length;
  const teamPower = calculateTeamPower(players);
  const scheduledMatch = getScheduledMatchName(gameState);
  const scheduledOfficialMatch = scheduledMatch && scheduledMatch !== "夏合宿";
  const latest = matchHistory[0];
  const mascotMessage = scheduledOfficialMatch
    ? "まもなく試合開始です。"
    : gameState.daysUntilTournament <= 14
      ? "大会まであと少しだよ！"
      : tired > 0
        ? "疲れてる選手がいるみたい。休ませるのも大事！"
        : "今日もグラウンドが呼んでるよ！";

  return (
    <div className="grid gap-4">
      <MascotMessage message={mascotMessage} />
      <GamePanel title="きいろ補佐の作戦ボード" icon={<ClipboardList size={22} />}>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-center">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border-2 border-blue-950 bg-yellow-100 p-3 font-black">
              次の一手は練習、休養、試合確認から選べます。
            </div>
            <div className="rounded-xl border-2 border-blue-950 bg-green-100 p-3 font-black">
              疲労80以上は怪我リスクが上がります。
            </div>
            <div className="rounded-xl border-2 border-blue-950 bg-blue-100 p-3 font-black">
              信頼度は試合中の作戦成功率に効きます。
            </div>
          </div>
          <div className="grid grid-cols-[1fr_100px] items-center gap-3 rounded-xl border-2 border-blue-950 bg-white p-3">
            <AssetImage
              asset="weeklyScheduleCards"
              alt="週間予定カード参考"
              noFrame
              imgClassName="h-32 w-full rounded-lg object-cover object-left"
            />
            <AssetImage asset="mascotCheering" alt="応援マスコット" noFrame imgClassName="h-32 object-contain" />
          </div>
        </div>
      </GamePanel>
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <GamePanel title="現在状況" icon={<ClipboardList size={22} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-blue-950 bg-yellow-50 p-4">
              <p className="text-sm font-black text-blue-700">大会まで</p>
              <p className="text-4xl font-black text-slate-950">{gameState.daysUntilTournament}日</p>
            </div>
            <div className="rounded-xl border-2 border-blue-950 bg-blue-50 p-4">
              <p className="text-sm font-black text-blue-700">チームランク</p>
              <p className="text-4xl font-black text-slate-950">{gameState.teamRank}</p>
            </div>
            <div className="rounded-xl border-2 border-blue-950 bg-green-50 p-4">
              <p className="text-sm font-black text-blue-700">部員</p>
              <p className="text-4xl font-black text-slate-950">{players.length}人</p>
            </div>
            <div className="rounded-xl border-2 border-blue-950 bg-red-50 p-4">
              <p className="text-sm font-black text-blue-700">ケア対象</p>
              <p className="text-4xl font-black text-slate-950">{tired + injured}人</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            <ProgressBar label="攻撃力" value={teamPower.offense} tone="yellow" />
            <ProgressBar label="守備力" value={teamPower.defense} tone="green" />
            <ProgressBar label="投手力" value={teamPower.pitching} tone="blue" />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <GameButton onClick={onGoTraining}>練習へ</GameButton>
            <GameButton variant="secondary" onClick={onGoMatch}>
              試合へ
            </GameButton>
          </div>
        </GamePanel>
        <GamePanel title="通知メッセージ" icon={<CalendarDays size={22} />}>
          <div className="grid gap-2">
            {gameState.notifications.map((message, index) => (
              <div key={`${message}-${index}`} className="rounded-xl border-2 border-blue-950 bg-white p-3 font-bold">
                {message}
              </div>
            ))}
          </div>
        </GamePanel>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <GamePanel title="年間イベント" icon={<CalendarDays size={22} />}>
          <AssetImage
            asset="calendarMonth"
            alt="カレンダーUI参考"
            noFrame
            imgClassName="mb-3 h-28 w-full rounded-lg border-2 border-blue-950 object-cover object-left"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {schedule.map((item) => (
              <div key={item} className="rounded-xl border-2 border-blue-950 bg-green-50 p-3 font-black">
                {item}
              </div>
            ))}
          </div>
        </GamePanel>
        <GamePanel title="直近の結果" icon={<Trophy size={22} />}>
          {latest ? (
            <div className="rounded-xl border-2 border-blue-950 bg-blue-50 p-4">
              <p className="text-sm font-black text-blue-700">{latest.date}</p>
              <p className="text-2xl font-black text-slate-950">
                {latest.opponentName}戦 {latest.ourScore}-{latest.opponentScore}
              </p>
              <p className="font-bold text-slate-700">{latest.summary}</p>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-blue-950 bg-yellow-50 p-4">
              <UsersRound className="mb-2 text-blue-700" size={28} />
              <p className="text-lg font-black">まだ試合結果はありません。</p>
            </div>
          )}
        </GamePanel>
      </div>
    </div>
  );
}
