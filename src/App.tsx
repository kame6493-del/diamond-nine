import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import type {
  EventLogItem,
  Facility,
  GameState,
  LiveMatchState,
  MatchResult,
  MatchStrategyId,
  Screen,
  TeamLineup,
  TrainingMenu,
  TrainingResult,
} from "./types/game";
import type { Player, ScoutingCandidate } from "./types/player";
import { Header } from "./components/layout/Header";
import { NavigationTabs } from "./components/layout/NavigationTabs";
import { StatusBar } from "./components/layout/StatusBar";
import { AssetImage } from "./components/assets/AssetImage";
import { AssetPreviewScreen } from "./components/assets/AssetPreviewScreen";
import { HomeScreen } from "./components/home/HomeScreen";
import { TrainingScreen } from "./components/training/TrainingScreen";
import { TrainingResultModal } from "./components/training/TrainingResultModal";
import { MatchScreen } from "./components/match/MatchScreen";
import { MatchResultModal } from "./components/match/MatchResultModal";
import { PlayerListScreen } from "./components/players/PlayerListScreen";
import { SchoolScreen } from "./components/school/SchoolScreen";
import { getUpgradeCost } from "./components/school/FacilityCard";
import { ScoutScreen } from "./components/scout/ScoutScreen";
import { getScoutSuccessRate } from "./components/scout/ScoutCandidateCard";
import { DataScreen } from "./components/data/DataScreen";
import { ResultModal } from "./components/common/ResultModal";
import { applyRandomEvent, getDateLabel } from "./logic/eventLogic";
import { createDefaultLineup, moveBattingOrder, normalizeLineup } from "./logic/lineupLogic";
import { advanceLiveMatch, createLiveMatch, finalizeLiveMatch } from "./logic/liveMatchLogic";
import { advanceWeek, retireThirdYears } from "./logic/progressionLogic";
import { calculateTeamRank } from "./logic/rankLogic";
import { clamp, createId } from "./logic/rand";
import { clearSave, loadGame, saveGame } from "./logic/saveLogic";
import { prepareOfficialMatch, resolveTournamentAfterMatch } from "./logic/tournamentLogic";
import {
  createInitialFacilities,
  createInitialGameState,
  createInitialPlayers,
  createInitialScoutingCandidates,
  generateScoutingCandidate,
} from "./logic/teamLogic";
import { applyTraining } from "./logic/trainingLogic";

type ModalState =
  | { type: "training"; result: TrainingResult }
  | { type: "match"; result: MatchResult }
  | { type: "message"; title: string; message: string; details?: string[] };

interface PendingLiveMatch {
  state: GameState;
  players: Player[];
  matchHistory: MatchResult[];
  eventLog: EventLogItem[];
  shouldAdvanceWeek: boolean;
}

const createInitialData = () => {
  const saved = loadGame();
  if (saved) return saved;
  const players = createInitialPlayers();
  return {
    gameState: createInitialGameState(),
    players,
    teamLineup: createDefaultLineup(players),
    facilities: createInitialFacilities(),
    scoutingCandidates: createInitialScoutingCandidates(),
    matchHistory: [],
    eventLog: [],
  };
};

const getAnnualLogCategory = (message: string): EventLogItem["category"] => {
  if (message.includes("新入生")) return "recruit";
  if (message.includes("卒業") || message.includes("引退")) return "graduation";
  if (message.includes("大会")) return "tournament";
  return "event";
};

function App() {
  const initialData = useMemo(() => createInitialData(), []);
  const [activeScreen, setActiveScreen] = useState<Screen>("home");
  const [gameState, setGameState] = useState<GameState>(initialData.gameState);
  const [players, setPlayers] = useState<Player[]>(initialData.players);
  const [teamLineup, setTeamLineup] = useState<TeamLineup>(
    normalizeLineup(initialData.teamLineup, initialData.players),
  );
  const [facilities, setFacilities] = useState<Facility[]>(initialData.facilities);
  const [scoutingCandidates, setScoutingCandidates] = useState<ScoutingCandidate[]>(
    initialData.scoutingCandidates,
  );
  const [matchHistory, setMatchHistory] = useState<MatchResult[]>(initialData.matchHistory);
  const [eventLog, setEventLog] = useState<EventLogItem[]>(initialData.eventLog);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>(initialData.players[0]?.id);
  const [liveMatch, setLiveMatch] = useState<LiveMatchState | undefined>();
  const [pendingLiveMatch, setPendingLiveMatch] = useState<PendingLiveMatch | undefined>();
  const [modal, setModal] = useState<ModalState | undefined>();

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? players[0];

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [activeScreen]);

  const commitPlayers = (nextPlayers: Player[]) => {
    setPlayers(nextPlayers);
    setTeamLineup((current) => normalizeLineup(current, nextPlayers));
    if (!nextPlayers.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId(nextPlayers[0]?.id);
    }
  };

  const enrichState = (state: GameState, nextPlayers: Player[]): GameState => ({
    ...state,
    teamRank: calculateTeamRank(nextPlayers),
  });

  const replaceScoutCandidate = (candidateId: string, sourceFacilities = facilities) => {
    const scoutRoomLevel = sourceFacilities.find((facility) => facility.id === "scoutRoom")?.level ?? 1;
    setScoutingCandidates((current) => [
      ...current.filter((candidate) => candidate.id !== candidateId),
      generateScoutingCandidate(gameState.reputation, scoutRoomLevel),
    ]);
  };

  const updateLineup = (nextLineup: TeamLineup) => {
    setTeamLineup(normalizeLineup(nextLineup, players));
  };

  const handleMoveBattingOrder = (playerId: string, direction: -1 | 1) => {
    updateLineup(moveBattingOrder(teamLineup, playerId, direction));
  };

  const handleSetStarter = (playerId: string) => {
    updateLineup({ ...teamLineup, startingPitcherId: playerId });
  };

  const handleSetRelief = (playerId: string) => {
    updateLineup({ ...teamLineup, reliefPitcherId: playerId });
  };

  const handleSetCaptain = (playerId: string) => {
    updateLineup({ ...teamLineup, captainId: playerId });
  };

  const handleTraining = (menu: TrainingMenu) => {
    const trained = applyTraining(gameState, players, facilities, menu);
    if (!trained.result.success) {
      setGameState(trained.state);
      setModal({ type: "training", result: trained.result });
      return;
    }

    let nextState = trained.state;
    let nextPlayers = trained.players;
    let nextEventLog = eventLog;
    let nextMatchHistory = matchHistory;
    let nextModal: ModalState = { type: "training", result: trained.result };

    const randomEvent = applyRandomEvent(nextState, nextPlayers, facilities);
    nextState = randomEvent.state;
    nextPlayers = randomEvent.players;
    if (randomEvent.log) {
      nextEventLog = [randomEvent.log, ...nextEventLog].slice(0, 80);
    }

    const official = prepareOfficialMatch(nextState);
    nextState = official.state;
    if (official.startedMessage) {
      nextEventLog = [
        {
          id: createId("event"),
          date: getDateLabel(nextState),
          title: "大会開幕",
          message: official.startedMessage,
          category: "tournament" as const,
        },
        ...nextEventLog,
      ].slice(0, 100);
    }

    if (official.info) {
      setGameState(enrichState(nextState, nextPlayers));
      commitPlayers(nextPlayers);
      setEventLog(nextEventLog);
      setMatchHistory(nextMatchHistory);
      setPendingLiveMatch({
        state: nextState,
        players: nextPlayers,
        matchHistory: nextMatchHistory,
        eventLog: nextEventLog,
        shouldAdvanceWeek: true,
      });
      setLiveMatch(createLiveMatch(nextState, nextPlayers, {
        forcedOpponentRank: official.info.opponentRank,
        matchType: "official",
        tournamentId: official.info.tournament.id,
        tournamentName: official.info.tournament.name,
        round: official.info.tournament.round,
        teamLineup,
      }));
      setActiveScreen("match");
      setModal(undefined);
      return;
    }

    const progressed = advanceWeek(nextState, nextPlayers, facilities);
    nextState = enrichState(progressed.state, progressed.players);
    nextPlayers = progressed.players;
    if (progressed.messages.length > 0) {
      nextEventLog = [
        ...progressed.messages.map((message) => ({
          id: createId("event"),
          date: `${nextState.year}年目 ${nextState.month}月${nextState.week}週`,
          title: "年間イベント",
          message,
          category: getAnnualLogCategory(message),
        })),
        ...nextEventLog,
      ].slice(0, 100);
    }

    setGameState(nextState);
    commitPlayers(nextPlayers);
    setEventLog(nextEventLog);
    setMatchHistory(nextMatchHistory);
    setModal(nextModal);
  };

  const handlePracticeMatch = () => {
    setPendingLiveMatch(undefined);
    setLiveMatch(createLiveMatch(gameState, players, { forcedOpponentRank: "F", matchType: "practice", teamLineup }));
    setActiveScreen("match");
    setModal(undefined);
  };

  const handleOfficialMatch = () => {
    const official = prepareOfficialMatch(gameState);
    if (!official.info) {
      setModal({
        type: "message",
        title: "公式戦はまだありません。",
        message: "大会週まで練習で準備しましょう。",
      });
      return;
    }

    const nextEventLog = official.startedMessage
      ? [
          {
            id: createId("event"),
            date: getDateLabel(official.state),
            title: "大会開幕",
            message: official.startedMessage,
            category: "tournament" as const,
          },
          ...eventLog,
        ].slice(0, 100)
      : eventLog;

    setGameState(enrichState(official.state, players));
    setEventLog(nextEventLog);
    setPendingLiveMatch({
      state: official.state,
      players,
      matchHistory,
      eventLog: nextEventLog,
      shouldAdvanceWeek: true,
    });
    setLiveMatch(createLiveMatch(official.state, players, {
      forcedOpponentRank: official.info.opponentRank,
      matchType: "official",
      tournamentId: official.info.tournament.id,
      tournamentName: official.info.tournament.name,
      round: official.info.tournament.round,
      teamLineup,
    }));
    setActiveScreen("match");
    setModal(undefined);
  };

  const handleUseStrategy = (strategyId: MatchStrategyId, selectedPlayerId?: string) => {
    if (!liveMatch) return;
    const contextPlayers = pendingLiveMatch?.players ?? players;
    setLiveMatch(advanceLiveMatch(liveMatch, strategyId, contextPlayers, facilities, selectedPlayerId));
  };

  const handleFinishLiveMatch = () => {
    if (!liveMatch?.finished) return;

    const baseState = pendingLiveMatch?.state ?? gameState;
    const basePlayers = pendingLiveMatch?.players ?? players;
    const finalized = finalizeLiveMatch(liveMatch, baseState, basePlayers);
    let nextState = finalized.state;
    let nextPlayers = finalized.players;
    const result = finalized.result;
    let nextMatchHistory = [result, ...(pendingLiveMatch?.matchHistory ?? matchHistory)].slice(0, 50);
    let nextEventLog: EventLogItem[] = [
      {
        id: createId("event"),
        date: getDateLabel(nextState),
        title: result.tournamentName ?? (result.matchType === "official" ? "公式戦" : "練習試合"),
        message: `${result.opponentName}戦 ${result.ourScore}-${result.opponentScore}`,
        category: "match" as const,
      },
      ...(pendingLiveMatch?.eventLog ?? eventLog),
    ].slice(0, 100);

    if (result.matchType === "official") {
      const resolved = resolveTournamentAfterMatch(nextState, result);
      nextState = resolved.state;
      nextEventLog = [
        ...resolved.messages.map((message) => ({
          id: createId("event"),
          date: getDateLabel(nextState),
          title: "大会結果",
          message,
          category: "tournament" as const,
        })),
        ...nextEventLog,
      ].slice(0, 100);

      if (resolved.shouldRetireSeniors) {
        const retired = retireThirdYears(nextState, nextPlayers);
        nextState = retired.state;
        nextPlayers = retired.players;
        if (retired.message) {
          nextEventLog = [
            {
              id: createId("event"),
              date: getDateLabel(nextState),
              title: "3年生引退",
              message: retired.message,
              category: "graduation" as const,
            },
            ...nextEventLog,
          ].slice(0, 100);
        }
      }
    }

    if (pendingLiveMatch?.shouldAdvanceWeek) {
      const progressed = advanceWeek(nextState, nextPlayers, facilities);
      nextState = enrichState(progressed.state, progressed.players);
      nextPlayers = progressed.players;
      if (progressed.messages.length > 0) {
        nextEventLog = [
          ...progressed.messages.map((message) => ({
            id: createId("event"),
            date: `${nextState.year}年目 ${nextState.month}月${nextState.week}週`,
            title: "年間イベント",
            message,
            category: getAnnualLogCategory(message),
          })),
          ...nextEventLog,
        ].slice(0, 100);
      }
    } else {
      nextState = enrichState(nextState, nextPlayers);
    }

    setGameState(nextState);
    commitPlayers(nextPlayers);
    setMatchHistory(nextMatchHistory);
    setEventLog(nextEventLog);
    setLiveMatch(undefined);
    setPendingLiveMatch(undefined);
    setModal({ type: "match", result });
  };

  const handleUpgradeFacility = (facility: Facility) => {
    const cost = getUpgradeCost(facility);
    if (gameState.funds < cost) {
      setModal({ type: "message", title: "資金が不足しています。", message: "もう少し試合や評判で資金を増やしましょう。" });
      return;
    }

    const nextFacilities = facilities.map((item) =>
      item.id === facility.id ? { ...item, level: Math.min(item.maxLevel, item.level + 1) } : item,
    );
    setFacilities(nextFacilities);
    setGameState({
      ...gameState,
      funds: gameState.funds - cost,
      notifications: [`${facility.name}をLv.${facility.level + 1}に強化しました。`, ...gameState.notifications].slice(0, 8),
    });
    setModal({
      type: "message",
      title: "施設を強化しました。",
      message: `${facility.name}の効果が高まりました。`,
    });
  };

  const handleScout = (candidate: ScoutingCandidate) => {
    if (gameState.funds < candidate.scoutCost || gameState.scoutPoints < candidate.scoutPointCost) {
      setModal({ type: "message", title: "資金が不足しています。", message: "資金またはスカウトPが足りません。" });
      return;
    }

    const successRate = getScoutSuccessRate(candidate, gameState, facilities);
    const success = Math.random() * 100 <= successRate;
    const nextState: GameState = {
      ...gameState,
      funds: gameState.funds - candidate.scoutCost,
      scoutPoints: gameState.scoutPoints - candidate.scoutPointCost,
      incomingRecruits: success
        ? [
            ...gameState.incomingRecruits,
            {
              ...candidate,
              id: createId("future"),
              year: 1,
              fatigue: 0,
              trust: 20,
            },
          ]
        : gameState.incomingRecruits,
      notifications: [
        success ? `${candidate.name}の勧誘に成功しました。翌年度に合流予定です。` : `${candidate.name}の勧誘は届きませんでした。`,
        ...gameState.notifications,
      ].slice(0, 8),
    };

    setGameState(nextState);
    setEventLog([
      {
        id: createId("event"),
        date: getDateLabel(gameState),
        title: success ? "スカウト成功" : "スカウト失敗",
        message: success ? `${candidate.name}が翌年度候補になりました。` : `${candidate.name}には今回は届きませんでした。`,
      },
      ...eventLog,
    ].slice(0, 80));
    replaceScoutCandidate(candidate.id);
    setModal({
      type: "message",
      title: success ? "勧誘成功！" : "勧誘失敗",
      message: success
        ? `${candidate.name}が「この学校で野球がしたい」と返事をくれました。`
        : "今回は縁がありませんでした。評判やスカウト室を上げると成功率が伸びます。",
    });
  };

  const handleRefreshCandidates = () => {
    if (gameState.funds < 300) {
      setModal({ type: "message", title: "資金が不足しています。", message: "候補更新には300Gが必要です。" });
      return;
    }
    const scoutRoomLevel = facilities.find((facility) => facility.id === "scoutRoom")?.level ?? 1;
    setScoutingCandidates(
      Array.from({ length: 3 }, () => generateScoutingCandidate(gameState.reputation, scoutRoomLevel)),
    );
    setGameState({
      ...gameState,
      funds: gameState.funds - 300,
      notifications: ["スカウト候補を更新しました。", ...gameState.notifications].slice(0, 8),
    });
  };

  const handleSave = () => {
    saveGame({ gameState, players, teamLineup, facilities, scoutingCandidates, matchHistory, eventLog });
    setGameState({ ...gameState, notifications: ["保存しました。", ...gameState.notifications].slice(0, 8) });
    setModal({ type: "message", title: "保存しました。", message: "このブラウザのlocalStorageに保存しました。" });
  };

  const handleLoad = () => {
    const saved = loadGame();
    if (!saved) {
      setModal({ type: "message", title: "ロードできませんでした。", message: "保存データがまだありません。" });
      return;
    }
    setGameState({ ...saved.gameState, notifications: ["ロードしました。", ...saved.gameState.notifications].slice(0, 8) });
    setPlayers(saved.players);
    setTeamLineup(normalizeLineup(saved.teamLineup, saved.players));
    setFacilities(saved.facilities);
    setScoutingCandidates(saved.scoutingCandidates);
    setMatchHistory(saved.matchHistory);
    setEventLog(saved.eventLog);
    setSelectedPlayerId(saved.players[0]?.id);
    setLiveMatch(undefined);
    setPendingLiveMatch(undefined);
    setModal({ type: "message", title: "ロードしました。", message: "保存済みの監督データを読み込みました。" });
  };

  const handleReset = () => {
    clearSave();
    const fresh = {
      gameState: createInitialGameState(),
      players: createInitialPlayers(),
      facilities: createInitialFacilities(),
      scoutingCandidates: createInitialScoutingCandidates(),
      matchHistory: [],
      eventLog: [],
    };
    const freshLineup = createDefaultLineup(fresh.players);
    setGameState(fresh.gameState);
    setPlayers(fresh.players);
    setTeamLineup(freshLineup);
    setFacilities(fresh.facilities);
    setScoutingCandidates(fresh.scoutingCandidates);
    setMatchHistory(fresh.matchHistory);
    setEventLog(fresh.eventLog);
    setSelectedPlayerId(fresh.players[0]?.id);
    setLiveMatch(undefined);
    setPendingLiveMatch(undefined);
    setActiveScreen("home");
    setModal({ type: "message", title: "最初から始めます。", message: "新しい部の物語が始まりました。" });
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case "training":
        return <TrainingScreen gameState={gameState} players={players} onTraining={handleTraining} />;
      case "match":
        return (
          <MatchScreen
            gameState={gameState}
            players={players}
            teamLineup={teamLineup}
            matchHistory={matchHistory}
            liveMatch={liveMatch}
            onPracticeMatch={handlePracticeMatch}
            onOfficialMatch={handleOfficialMatch}
            onUseStrategy={handleUseStrategy}
            onFinishLiveMatch={handleFinishLiveMatch}
            onMoveBattingOrder={handleMoveBattingOrder}
            onSetStarter={handleSetStarter}
            onSetRelief={handleSetRelief}
            onSetCaptain={handleSetCaptain}
          />
        );
      case "players":
        return (
          <PlayerListScreen
            players={players}
            selectedPlayer={selectedPlayer}
            onSelectPlayer={(player) => setSelectedPlayerId(player.id)}
          />
        );
      case "school":
        return (
          <SchoolScreen
            gameState={gameState}
            facilities={facilities}
            onUpgradeFacility={handleUpgradeFacility}
          />
        );
      case "scout":
        return (
          <ScoutScreen
            gameState={gameState}
            facilities={facilities}
            candidates={scoutingCandidates}
            onScout={handleScout}
            onRefreshCandidates={handleRefreshCandidates}
          />
        );
      case "data":
        return (
          <DataScreen
            gameState={gameState}
            players={players}
            matchHistory={matchHistory}
            eventLog={eventLog}
            onSave={handleSave}
            onLoad={handleLoad}
            onReset={handleReset}
          />
        );
      case "assets":
        return <AssetPreviewScreen />;
      default:
        return (
          <HomeScreen
            gameState={gameState}
            players={players}
            matchHistory={matchHistory}
            onGoTraining={() => setActiveScreen("training")}
            onGoMatch={() => setActiveScreen("match")}
          />
        );
    }
  };

  const closeModal = () => setModal(undefined);

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#fef08a_0%,#ffffff_38%,#bbf7d0_100%)] text-slate-900">
      <div className="mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:px-5 lg:px-8">
        <Header />
        <StatusBar gameState={{ ...gameState, reputation: clamp(gameState.reputation, 0, 100) }} />
        <NavigationTabs activeScreen={activeScreen} onChange={setActiveScreen} />
        <main>{renderScreen()}</main>
        <footer className="flex items-center gap-2 rounded-lg border-2 border-slate-900 bg-white p-3 text-sm font-bold text-slate-600">
          <Info size={18} className="text-blue-600" />
          データは外部サーバーを使わず、このブラウザ内に保存されます。
        </footer>
      </div>
      <div className="pointer-events-none fixed bottom-3 right-3 z-40 hidden w-24 sm:block">
        <AssetImage
          asset="mascotStanding"
          alt="常時表示マスコット"
          noFrame
          imgClassName="h-28 object-contain drop-shadow-[0_6px_0_rgba(8,47,73,0.18)]"
        />
      </div>

      <TrainingResultModal
        open={modal?.type === "training"}
        result={modal?.type === "training" ? modal.result : undefined}
        onClose={closeModal}
      />
      <MatchResultModal
        open={modal?.type === "match"}
        result={modal?.type === "match" ? modal.result : undefined}
        onClose={closeModal}
      />
      <ResultModal
        open={modal?.type === "message"}
        title={modal?.type === "message" ? modal.title : ""}
        message={modal?.type === "message" ? modal.message : ""}
        onClose={closeModal}
      >
        {modal?.type === "message" && modal.details && (
          <div className="grid gap-2">
            {modal.details.map((detail) => (
              <div key={detail} className="rounded-lg border-2 border-slate-800 bg-slate-50 p-3 font-bold">
                {detail}
              </div>
            ))}
          </div>
        )}
      </ResultModal>
    </div>
  );
}

export default App;
