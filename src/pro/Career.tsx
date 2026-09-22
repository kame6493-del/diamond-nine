import { useState, type ReactNode } from 'react';
import { ArrowRight, Check, Diamond, Gift, Play, Shield, Sparkles, Star, Trophy, Users, Zap } from 'lucide-react';
import { effectiveOverall, type GameState, type ScoutFocus, type GameResult } from './engine';
import { playerMap, players, teamById, type Player } from './data';
import { SCOUT_COST } from './progression';
import { bestUpgrade } from './career-roster';
import { milestonesFor } from './franchise';
import { ScoutFocusPicker } from './Expansion';
import { Confetti } from './ScoutOpening';
import {ManagerDesk,ContractBoard} from './ManagerDesk';
import {CardAbilities} from './CardAbilities';

type CardRenderer = (player: Player) => ReactNode;
const number = (n: number) => n.toLocaleString('ja-JP');
function ScoutMeter({ state }: { state: GameState }) {
  const ready = state.gems >= SCOUT_COST;
  return <div className={`career-meter ${ready ? 'ready' : ''}`}>
    <div><span>{ready ? '新戦力を迎えられます' : '次の1枚まで'}</span><b>{ready ? `${Math.floor(state.gems / SCOUT_COST)}枚分のポイント` : `あと ${SCOUT_COST - state.gems}pt`}</b></div>
    <div className="career-meter-track" role="progressbar" aria-label="1枚スカウトまでのポイント" aria-valuemin={0} aria-valuemax={SCOUT_COST} aria-valuenow={Math.min(state.gems, SCOUT_COST)}><i style={{ width: `${Math.min(100, state.gems / SCOUT_COST * 100)}%` }} /></div>
    <small>1試合60pt ＋ 勝利20pt / 引き分け10pt{state.franchise.stadium > 1 ? ` ＋ 球場${(state.franchise.stadium - 1) * 5}pt` : ''}</small>
  </div>;
}
export function CareerHome({ state, advance, onScout, onTeam, onSeason, onClub, onGame, renderCard,onClaim,onEquip }: {
  state: GameState; advance: (days: number) => void; onScout: () => void; onTeam: () => void; onSeason: () => void; onClub: () => void; onGame: (game: GameResult) => void; renderCard: CardRenderer;onClaim?:()=>void;onEquip?:(id:string)=>void;
}) {
  const roster = [...state.lineup, ...state.pitchers];
  const power = Math.round(roster.reduce((n, id) => n + effectiveOverall(playerMap[id], state.owned, state.training), 0) / roster.length);
  const mine = state.season.standings.find(t => t.team === state.club)!;
  const ready = state.gems >= SCOUT_COST;
  const byOverall = (a: string, b: string) => effectiveOverall(playerMap[b], state.owned, state.training) - effectiveOverall(playerMap[a], state.owned, state.training);
  const featured = [...[...state.lineup].sort(byOverall).slice(0, 2), ...[...state.pitchers].sort(byOverall).slice(0, 2)];
  const missions = milestonesFor(state).filter(m => !state.franchise.claimed.includes(m.id) && m.value(state) >= m.goal);
  return <div className="career-home">
    <div className="career-banner"><span><i />育成モード</span><p>R選手から出発。試合で貯めて、一枚ずつ強くなる。</p></div>
    <div className="career-opening-grid">
      <section className="career-hero">
        <div className="eyebrow light">FROM ROOKIES TO CHAMPIONS</div>
        <h2>{state.pulls ? <>その一枚が、<br /><em>次の勝利になる。</em></> : <>小さなチームの、<br /><em>大きなはじまり。</em></>}</h2>
        <p>{state.season.completed ? '143試合の経験を胸に。短期決戦と、次の一年へ。' : state.season.day===0?'まずは5試合。選手の活躍を見て、最初の補強へ。':state.gems>=SCOUT_COST?'新戦力を迎えられます。補強して、次の試合で確かめよう。':`ここまで${mine.w}勝。次の試合で、チームの成長を確かめよう。`}</p>
        <div className="career-club-score"><span className="career-emblem">{state.franchise.mark}</span><div><small>YOUR CLUB</small><strong>{state.name}</strong></div><div className="career-ovr"><b>{power}</b><small>TEAM OVR</small></div></div>
        <div className="career-hero-actions"><button className="btn gold" onClick={() => state.season.completed ? onSeason() : advance(5)}><Play size={18} />{state.season.completed ? '日本一への道を見る' : `${Math.min(5, 143 - state.season.day)}試合プレイ`}<ArrowRight size={17} /></button>{!state.season.completed && <button className="btn outline" onClick={() => advance(1)}>1試合ずつ進める</button>}</div>
        <div className="career-record"><span>SEASON {String(state.season.number).padStart(2, '0')} · {state.season.day} / 143試合</span><strong>{mine.w}勝 <i>{mine.l}敗 {mine.d}分</i></strong></div>
      </section>
      <section className={`career-wallet panel ${ready ? 'ready' : ''}`}>
        <div className="eyebrow">YOUR NEXT PLAYER</div><div className="career-coin"><Diamond size={28} /></div><span>スカウトポイント</span><div className="career-balance"><b>{number(state.gems)}</b><small>pt</small></div>
        <ScoutMeter state={state} /><button className="btn gold full-button" disabled={!ready} onClick={onScout}><Sparkles size={18} />1枚スカウトへ <small>300pt</small></button>
        <p>{ready ? '獲得した選手を、その場でオーダーへ。' : '5試合遊べば、勝敗にかかわらず1枚分。'}</p>
        {state.franchise.tickets > 0 && <button className="text-button" onClick={onScout}><Gift size={16} />UR確定チケット ×{state.franchise.tickets}</button>}
      </section>
    </div>
    <ManagerDesk state={state} onTeam={onTeam} onScout={onScout} onClub={onClub} onSeason={onSeason} onClaim={onClaim} onEquip={onEquip}/>
    {missions.length > 0 && <button className="career-mission" onClick={onClub}><Gift size={23} /><span><strong>{missions.length}件のミッション達成！</strong><small>追加ポイントで、次の新戦力へ。</small></span><b>報酬を受け取る <ArrowRight size={16} /></b></button>}
    {state.season.results.length > 0 && <section className="panel career-games"><div className="section-title"><div><div className="eyebrow">LATEST GAMES</div><h2>一歩ずつ、勝てるチームに。</h2></div><button className="text-button" onClick={onSeason}>シーズンと成績 <ArrowRight size={15} /></button></div><div>{state.season.results.slice(-5).map(game => {
      const home = game.home === state.club, score = home ? game.homeRuns : game.awayRuns, rival = home ? game.awayRuns : game.homeRuns;
      const result = score > rival ? 'WIN' : score === rival ? 'DRAW' : 'LOSE';
      return <button key={game.day} onClick={() => onGame(game)}><small>GAME {game.day}</small><b className={result.toLowerCase()}>{result}</b><strong>{score}<i> − </i>{rival}</strong><span>vs {teamById(home ? game.away : game.home).short}</span></button>;
    })}</div></section>}
    <section className="panel"><div className="section-title"><div><div className="eyebrow">YOUR GROWING TEAM</div><h2>いまのチームの主役たち。</h2></div><button className="text-button" onClick={onTeam}>チーム編成 <ArrowRight size={15} /></button></div><div className="career-roster">{featured.map(id => <div key={id}>{renderCard(playerMap[id])}</div>)}</div><div className="career-collection-note"><span><Users size={16} />所持 {Object.keys(state.owned).length}種類</span><span><Sparkles size={16} />累計 {state.pulls}枚スカウト</span><button className="text-button" onClick={onClub}>球団名・育成を変更 <ArrowRight size={14} /></button></div></section>
    <p className="fine-print">以前のクラブは「設定・データ → 以前のクラブに切り替える」から続けられます。育成モードの進行は別に保存されます。</p>
  </div>;
}

export function CareerScout({ state, focus, setFocus, onPull, onTicket, onPlay, onTeam, onEquip, renderCard,onSign }: {
  state: GameState; focus: ScoutFocus; setFocus: (focus: ScoutFocus) => void; onPull: () => void; onTicket: () => void; onPlay: () => void; onTeam: () => void; onEquip: (id: string) => void; renderCard: CardRenderer;onSign?:(id:string)=>void;
}) {
  const next = state.pulls + 1, until = 5 - state.pulls % 5, floor = (state.pulls + until) % 10 === 0 ? 'SSR' : 'SR';
  const last = state.lastPulls[0];
  return <div className="career-scout">
    <section className="career-scout-hero"><div><div className="eyebrow light">ONE CARD. A NEW CHAPTER.</div><span className="pill gold-pill"><Sparkles size={13} />1枚スカウト</span><h2>この一枚から、<br /><em>チームが変わる。</em></h2><p>試合で貯めたポイントで、実在のNPB選手を獲得。<br />12球団・{number(players.length)}人が、あなたのチームへ。</p></div><div className="career-pack-art" aria-hidden="true"><span>DIAMOND</span><Diamond size={58} /><b>NINE</b><small>2026 · PLAYER COLLECTION</small></div></section>
    <section className="panel career-draw"><div><div className="eyebrow">SCOUT POINTS</div><h2>{number(state.gems)} <small>pt</small></h2><ScoutMeter state={state} /></div><div><button className="btn gold" disabled={state.gems < SCOUT_COST} onClick={onPull}><Sparkles size={19} />1枚スカウト <b>300pt</b></button><button className="text-button" onClick={onPlay}><Play size={15} />試合でポイントを貯める</button></div></section>
    <div className="career-guarantees"><div><Star size={23} /><span><small>累計スカウト {state.pulls}枚</small><strong>{until === 1 ? `次の1枚は${floor}以上！` : `あと${until}枚で${floor}以上`}</strong><p>5の倍数でSR以上、10の倍数でSSR以上。</p></span></div><div><Trophy size={23} /><span><small>UR確定カウント</small><strong>あと{50 - state.pity}枚以内にUR</strong><p>UR獲得でカウントリセット。テーマ共通。</p></span></div></div>
    <div className="career-stamps" aria-label="次の節目までのスカウト進捗">{Array.from({ length: 10 }, (_, i) => <span key={i} className={i < state.pulls % 10 ? 'done' : i === state.pulls % 10 ? 'next' : ''}><b>{i < state.pulls % 10 ? <Check size={16} /> : Math.floor(state.pulls / 10) * 10 + i + 1}</b><small>{i === 9 ? 'SSR+' : i === 4 ? 'SR+' : '1枚'}</small></span>)}</div>
    <ContractBoard state={state} onSign={onSign}/>
    <ScoutFocusPicker focus={focus} setFocus={setFocus} />
    {state.franchise.tickets > 0 && <section className="panel career-ticket"><Gift size={28} /><div><h3>UR確定チケット ×{state.franchise.tickets}</h3><p>143試合を走り抜いたご褒美。UR選手1人を迎えよう。</p><small>UR全{players.filter(p => p.rarity === 'UR').length}人の均等抽選。ポイント・通常スカウトのカウントは使いません。</small></div><button className="btn gold" onClick={onTicket}>チケットで1枚引く</button></section>}
    {last && <section className="panel career-last"><div>{renderCard(playerMap[last.playerId])}</div><div><div className="eyebrow">LAST SCOUT · 獲得済み</div><h2>{playerMap[last.playerId].name}</h2><UpgradeOffer state={state} id={last.playerId} onEquip={onEquip} onTeam={onTeam} /></div></section>}
    <details className="panel career-rules"><summary>提供割合・スカウトのルール</summary><p>通常の1枚は UR 3% / SSR 12% / SR 35% / R 50%。同じレアリティ内では均等抽選。テーマ対象の選手のみ抽選の重みが3倍です。</p><p>累計5の倍数の回はRの抽選結果をSRに、10の倍数の回はR・SRをSSRに引き上げます（UR 3% / SSR 12% / SR 85%、10の倍数ではUR 3% / SSR 97%）。URを49回引けなかった次の1枚はUR 100%を優先します。次は累計{next}枚目です。</p><p>保証で上がったレアリティ内でも、選んだテーマの重みを使います。URチケットはテーマを適用せず、累計枚数とURカウントにも含めません。重複は覚醒として最大＋5。7枚目以降は育成80ptを獲得。カードは抽選時点で獲得・自動保存されます。</p><p>スカウトポイントは試合や達成報酬で獲得します。課金・有価物との交換はありません。</p></details>
  </div>;
}

function UpgradeOffer({ state, id, onEquip, onTeam }: { state: GameState; id: string; onEquip: (id: string) => void; onTeam: () => void }) {
  const upgrade = bestUpgrade(state, id), playing = state.lineup.includes(id) || state.pitchers.includes(id);
  return <div className="career-upgrade">{upgrade ? <><span className="career-upgrade-tag"><Zap size={15} />チーム強化のチャンス</span><div className="career-comparison"><div><small>現在 · {upgrade.position}</small><strong>{playerMap[upgrade.oldId].name}</strong><b>{upgrade.before}</b></div><ArrowRight size={22} /><div><small>新戦力 · OVR</small><strong>{playerMap[id].name}</strong><b>{upgrade.after}<em>起用評価 ＋{upgrade.gain.toFixed(1)}</em></b></div></div><div className="upgrade-abilities"><div><small>現在の選手</small><CardAbilities player={playerMap[upgrade.oldId]} bonus={Math.min(5,Math.max(0,(state.owned[upgrade.oldId]??1)-1))+(state.training[upgrade.oldId]??0)}/></div><div><small>獲得した選手</small><CardAbilities player={playerMap[id]} bonus={Math.min(5,Math.max(0,(state.owned[id]??1)-1))+(state.training[id]??0)}/></div></div><button className="btn primary full-button" onClick={() => onEquip(id)}><Users size={17} />この選手をオーダーに入れる</button><p>元の選手は控えに残ります。守備位置・投手の役割を合わせて起用します。</p></> : <><span className="career-upgrade-tag"><Check size={16} />{playing ? 'オーダーに編成済み' : '選手コレクションに加入'}</span><p>{playing ? '覚醒・育成の補正は試合にも反映されます。' : '控えや育成で活躍のチャンス。編成画面から起用できます。'}</p></>}<button className="text-button" onClick={onTeam}>編成を見にいく <ArrowRight size={15} /></button></div>;
}

export function SingleScoutOpening({ state, onClose, onAgain, onTeam, onPlay, onEquip, onReveal, renderCard }: {
  state: GameState; onClose: () => void; onAgain: () => void; onTeam: () => void; onPlay: () => void; onEquip: (id: string) => void; onReveal: () => void; renderCard: CardRenderer;
}) {
  const [opened, setOpened] = useState(false), pull = state.lastPulls[0], player = playerMap[pull.playerId];
  return <div className={`single-opening ${opened ? `opened rarity-${player.rarity}` : ''}`}>
    {opened && <Confetti />}<div className="eyebrow">{opened ? pull.isNew ? 'WELCOME TO YOUR TEAM' : 'PLAYER AWAKENING' : 'YOUR NEXT CHAPTER'}</div>
    <h2>{opened ? pull.isNew ? '新しい仲間が、やってきた。' : 'その出会いが、力になる。' : 'さあ、あなたの一枚を。'}</h2>
    {opened ? <div className="single-reveal"><div className="single-card"><span className="single-rarity">{player.rarity} · {pull.isNew ? 'NEW PLAYER' : `覚醒 ＋${Math.min(5, pull.copies - 1)}`}</span>{renderCard(player)}</div><div><h3>{player.name}</h3><p>{teamById(player.team).short} · {player.position} / {pull.contract ? '指名契約で獲得' : pull.guaranteed ? '確定枠で獲得' : '獲得済み'}</p>{(pull.trainingReward??0)>0&&<div className="notice">覚醒は最大です。重複ボーナスとして育成＋{pull.trainingReward}ptを獲得しました。</div>}<UpgradeOffer state={state} id={player.id} onEquip={onEquip} onTeam={onTeam} /><div className="single-next"><button className="btn gold" onClick={state.gems >= SCOUT_COST ? onAgain : onPlay}>{state.gems >= SCOUT_COST ? <><Sparkles size={17} />もう1枚 · 300pt</> : <><Play size={17} />試合でポイントを貯める</>}</button><button className="btn outline" onClick={onClose}>スカウトに戻る</button></div><small>残り {number(state.gems)} スカウトpt</small></div></div> : <><button className="single-sealed" onClick={() => { setOpened(true); onReveal(); }} aria-label="カードをめくる"><span>DIAMOND NINE</span><Diamond size={78} /><strong>2026</strong><small>タップして、めくる <ArrowRight size={15} /></small></button><p className="single-saved"><Shield size={14} />この一枚は獲得済み。閉じても選手は残ります。</p></>}
  </div>;
}
