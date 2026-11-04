import {saveGameFile} from './native-files';
import {PointShop} from './PointShop';
import {PremiumPassCard,RewardAdButton} from './MonetizePanel';
import {PawaGoalsAside} from './pawa/PawaGoals';
import {StaminaChip,StaminaPlay} from './StaminaPanel';
import {DRINK_RESTORE,buyStaminaOption,type StaminaPtOption,addStamina,claimDrinkGift,costToFinish,loadStamina,markStaminaIntro,staminaIntroDue,seasonCost,STAMINA_MAX,STAMINA_REGEN_MS,regenLabel,STAMINA_AD_POINTS,spendStamina,updateStamina,useDrink,useStaminaSummary,currentRules,STAMINA_ENABLED,settleStaminaRefund,hasStaminaRecord,saveStamina,restartStamina,buyDrinkSet} from './stamina';
import {monetizeBridge,seasonInterstitialDue,useMonetize} from './monetization';
import {spaceUnlocked,circuitLabel,circuitOf,seasonGames,leagueFor,leagueProgress,titleFor,NPB_TITLES_TO_MLB,type Circuit} from './leagues';
import {switchLeague} from './engine';
import {setDisplayCircuit} from './space-aliens';
import {AchievementsPanel} from './CareerAchievements';
import {VictoryShare} from './VictoryShare';
import {TeamSeasonStats} from './TeamSeasonStats';
import {LeagueSeasonStats} from './LeagueSeasonStats';
import {SeasonAd} from './SeasonAd';
import {formatUZR,playerSeasonUZR} from './fielding-stats';
import {achievementNames,recordAchievements} from './achievements';
import {firstTitleCelebration,type TitleCelebration as TitleCelebrationEvent} from './title-celebration';
import {TitleCelebration} from './TitleCelebration';
import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Check,ChevronRight,Download,Layers3,Play,RotateCcw,Settings,Sparkles,Upload,Users,Volume2,VolumeX,X} from 'lucide-react';
import {MoreApps} from './MoreApps';
import {formatAvg,formatIP,normalizeName,playerMap,players,teamById,type Player} from './data';
import {battingAverage,era,loadState,migrateState,nextMatchPreview,nextSeason,ops,rankings,saveKeyFor,simulateDays,type GameState,type Season} from './engine';
import {buildByStrategy,trainPlayer} from './franchise';
import {simulatePostseason,stageLabel} from './postseason';
import {bestUpgrade,equipScoutedPlayer} from './career-roster';
import {CardAbilities} from './CardAbilities';
import {ReplacementPreview} from './ReplacementPreview';
import {PlayerHoverPreview} from './PlayerHoverPreview';
import {pitchingRoleLabel} from './wiki-players';
import {SIMPLE_SCOUT_COST,MULTI_SCOUT_COST,drawSimplePlayers,scoutOdds,collectSimpleRewards,drawSimplePlayer,moveSimplePlayer,replacementPool,replaceSimplePlayer} from './simple-game';
import type {Profile} from './progression';
import './simple.css';
import {DeckTeam,TradingCard} from './CardDeck';
import {PlayerCatalog} from './PlayerCatalog';
import {drawSounds,gameSound,prepareGameAudio,revealSounds,stopGameAudio} from './game-audio';
import {readResetBackup,resetTeam,restoreResetBackup,completeResetTeam} from './reset-team';
import './arcade.css';
import {PlayerDetails} from './PlayerDetails';
import {ScoutCharge,ScoutArrival,scoutDuration} from './ScoutEffects';
import {scoutPresentation} from './scout-presentation';
import {StarterScout} from './StarterScout';
import {starterScoutActive,pickStarterCard,finishStarterScout} from './starter-scout';
import {mlbPlayers} from './mlb-players';
import './scout.css';
import {TesterBanner} from './TesterBanner';
import './season-report.css';
import {BeginnerTutorial} from './BeginnerTutorial';
import {track} from './analytics';
import {ScoutShare} from './ScoutShare';
import {scoutShareData} from './share-kit';
import {isRookie} from './development';
import {DailyPanel} from './DailyPanel';
import {DAILY_MISSIONS,LAUNCH_GIFT,localDay,noteDailyMission,takeDailyLogin,takeLaunchGift,useDaily} from './daily';
import {maybeAskReview,noteReviewPlayDay} from './review';
import {FeedbackCard} from './FeedbackCard';
import {seasonGoals} from './ambitions';
import {AUTUMN_EVENT,autumnEventActive,autumnEventEndLabel,claimAutumnBonus} from './autumn-event';
import {markReminderAsked,reminderAskDue} from './reminder';
import {feedbackUrl} from './feedback';
import {readLook,saveLook,type Look} from './look';
import {PawaSeason} from './pawa/PawaSeason';
import {PawaScout} from './pawa/PawaScout';
import {PawaTeam} from './pawa/PawaTeam';
import {PawaCatalog} from './pawa/PawaCatalog';
import {PawaPlayer} from './pawa/PawaPlayer';
import {PawaStarter} from './pawa/PawaStarter';
import {PawaSeasonResult} from './pawa/PawaSeasonResult';
import {RankingScreen} from './RankingScreen';
import {WatchScreen} from './WatchScreen';
import {createPortal} from 'react-dom';
import type {Watchable} from './watch';
import {advanceKeyDay,clearManage,commitManaged,keyGameAhead,managedGame,readManage,readNoStop,saveManage,saveNoStop,stopAt,type ManagedGame} from './managed';
import type {WatchMode} from './WatchScreen';
import type {WatchOrder} from './engine';
import {RankRegisterPrompt,rankPromptFor} from './RankRegisterPrompt';
import {available as rankingAvailable,appVersion,deleteMine,BUSY_MSG as RANK_BUSY} from './ranking';
import type {RankLeague} from './rank-entry';

type Page='season'|'team'|'scout'|'catalog';
const count=(n:number)=>n.toLocaleString('ja-JP');
const bonus=(s:GameState,id:string)=>Math.min(5,Math.max(0,(s.owned[id]??1)-1))+(s.training[id]??0);
const tabs=[{id:'season',label:'試合・成績',icon:Play,art:'tab-season'},{id:'team',label:'チーム',icon:Users,art:'tab-team'},{id:'scout',label:'スカウト',icon:Sparkles,art:'tab-scout'}] as const;
const pawaPad=(n:number)=>String(n).padStart(2,'0');

/** 大事な試合の前で止まった時の選ぶ画面(2026-11-04 vc43)。「監督して戦う」「おまかせで観る」「一気に進める」から選ぶ。
 * 短期決戦では「このシリーズの残りを一気に進める」も。途中で閉じた試合は「続きから」(持ち主 11/4「というか、選べるようにして」)。 */
export function KeyGameStop({stop,name,club,onManage,onRestart,onWatch,onAuto,onSeries}:{stop:{at:GameState;game:ManagedGame;saved:unknown[]|null;mode?:WatchMode};name:string;club:string;onManage:()=>void;onRestart:()=>void;onWatch:()=>void;onAuto:()=>void;onSeries?:()=>void}){
 const {game,at}=stop,season=at.season,label=(id:string)=>id===club?name:teamById(id,season).short;
 const series=game.kind==='post'?at.season.postseason?.series.find(x=>x.stage===at.season.postseason!.stage&&!x.winner&&(x.higher===club||x.lower===club)):undefined;
 const mineWins=series?series.wins[series.higher===club?0:1]:0,theirWins=series?series.wins[series.higher===club?1:0]:0;
 const resume=!!stop.saved&&stop.saved.length>0,resumeWatch=resume&&stop.mode==='watch';
 const view=<div className="wt-root wt-stop-back"><div className="wt-stop" role="dialog" aria-modal="true" aria-label={`${game.label}の前で止まりました`}>
  <p className="wt-stop-eye">大事な試合</p>
  <h2>{game.label}</h2>
  <p className="wt-stop-vs"><span className={game.away===club?'is-mine':''}>{label(game.away)}</span><em>VS</em><span className={game.home===club?'is-mine':''}>{label(game.home)}</span></p>
  {series&&<p className="wt-stop-series">ここまで {mineWins}勝{theirWins}敗{series.advantage>0&&series.higher===club?`(アドバンテージ${series.advantage}勝を含む)`:''}・{series.target}勝で勝ち抜け</p>}
  <p className="wt-stop-text">監督して戦うと、送りバント・盗塁・敬遠・選手交代・作戦を指示できます。結果はそのままシーズンに入ります。</p>
  <div className="wt-stop-btns">
   <button className="wt-gold" onClick={resumeWatch?onWatch:onManage}>{resume?(resumeWatch?'続きから観る':'続きから監督する'):'監督して戦う'}</button>
   {resume&&<button className="wt-navy" onClick={onRestart}>この試合を最初からやり直す</button>}
   {!resumeWatch&&<button className="wt-navy" onClick={onWatch}>おまかせで観る<small>ボールと走者が動く・最初は2倍</small></button>}
   <button className="wt-navy" onClick={onAuto}>一気に進める<small>画面を見ずに結果へ</small></button>
   {series&&onSeries&&<button className="wt-navy is-series" onClick={onSeries}>このシリーズの残りを一気に進める</button>}
  </div>
  <p className="wt-stop-note">おまかせで観る・一気に進めるは「1年進める」と同じ計算です(結果も同じ)。{resume?'途中まで監督した分は使いません。':''}毎回聞かずに進めたい時は、設定の「大事な試合でも止まらない」。</p>
 </div></div>;
 // 観戦の画面と同じく、アプリの見た目(.nv-app のボタンの決まり)の外に出す。
 return typeof document==='undefined'?view:createPortal(view,document.body);
}
function Dialog({title,onClose,children,className=''}:{title:string;onClose:()=>void;children:ReactNode;className?:string}){
 const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const old=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';ref.current?.focus({preventScroll:true});
  const key=(e:KeyboardEvent)=>{
   if(!ref.current?.contains(document.activeElement))return;
   if(e.key==='Escape'){e.preventDefault();close.current();}
   if(e.key==='Tab'){
    const nodes=Array.from(ref.current.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,summary,a[href]')).filter(node=>node.getClientRects().length);
    if(!nodes?.length)return;
    if(e.shiftKey&&(document.activeElement===nodes[0]||document.activeElement===ref.current)){e.preventDefault();nodes[nodes.length-1].focus();}
    else if(!e.shiftKey&&document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0].focus();}
   }
  };
  document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);old?.focus({preventScroll:true});};
 },[]);
 return <div className="simple-overlay" onClick={onClose}><div className={`simple-dialog ${className}`} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}><header><h2>{title}</h2><button className="s-icon" onClick={onClose} aria-label="閉じる"><X size={20}/></button></header>{children}</div></div>;
}

export function SimpleStats({season,club,onPlayer,lineup=[],pitchers=[]}:{season:Season;club:string;onPlayer:(p:Player)=>void;lineup?:string[];pitchers?:string[]}){
 const [view,setView]=useState<'bat'|'pit'>('bat');
 const viewScroll=useRef<number|null>(null);
 const changeView=(next:'bat'|'pit')=>{if(next!==view){viewScroll.current=window.scrollY;setView(next);}};
 useLayoutEffect(()=>{if(viewScroll.current!==null){window.scrollTo({top:viewScroll.current,behavior:'auto'});viewScroll.current=null;}},[view]);
 const bats=Object.values(season.batting).filter(b=>b.team===club);
 const arms=Object.values(season.pitching).filter(p=>p.team===club);
 const batIds=[...new Set([...lineup,...bats.map(b=>b.playerId)])];
 const pitIds=[...new Set([...pitchers,...arms.map(p=>p.playerId)])];
 const batMap=new Map(bats.map(b=>[b.playerId,b])),pitMap=new Map(arms.map(p=>[p.playerId,p]));
 return <div className="season-player-stats">
  <div className="season-stat-switch" role="group" aria-label="表示する個人成績"><button aria-pressed={view==='bat'} onClick={()=>changeView('bat')}>打撃成績</button><button aria-pressed={view==='pit'} onClick={()=>changeView('pit')}>投手成績</button></div>
  <div className="s-stat-columns">
   <section className={'s-panel season-stat-panel'+(view==='bat'?' is-active':'')} aria-label="打撃成績"><h2>打撃成績</h2>
    <table className="s-stats batting-uzr-table"><thead><tr><th>選手</th>{['打率','本塁打','打点','OPS','盗塁','UZR'].map(h=><th key={h}>{h}</th>)}</tr></thead>
     <tbody>{batIds.map(id=>{const b=batMap.get(id),uzr=playerSeasonUZR(season,club,id);return <tr key={id}>
      <th><button title={playerMap[id].name} data-player-id={id} onClick={()=>onPlayer(playerMap[id])}>{playerMap[id].name}</button></th><td>{b?.ab?formatAvg(battingAverage(b)):'—'}</td><td>{b?.hr??0}</td><td>{b?.rbi??0}</td><td>{b?.pa?formatAvg(ops(b)):'—'}</td><td>{b?.sb??0}</td><td className={'uzr-value '+(uzr!==null&&uzr>0?'positive':uzr!==null&&uzr<0?'negative':'')}>{formatUZR(uzr)}</td>
     </tr>;})}</tbody>
    </table>
    <p className="s-uzr-note">UZRはリーグ平均を0とした守備貢献。プラスほど失点を防いでいます。守備なし・未記録は「—」。</p>
    {!batIds.length&&<p className="s-empty">試合を進めると成績が表示されます。</p>}
   </section>
   <section className={'s-panel season-stat-panel'+(view==='pit'?' is-active':'')} aria-label="投手成績"><h2>投手成績</h2><table className="s-stats"><thead><tr><th>選手</th>{['奪三振','防御率','投球回','セーブ'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{pitIds.map(id=>{const p=pitMap.get(id);return <tr key={id}><th><button title={playerMap[id].name} data-player-id={id} onClick={()=>onPlayer(playerMap[id])}>{playerMap[id].name}</button></th><td>{p?.so??0}</td><td>{p?.outs?era(p).toFixed(2):'—'}</td><td>{formatIP(p?.outs??0)}</td><td>{p?.saves??0}</td></tr>;})}</tbody></table>{!pitIds.length&&<p className="s-empty">試合を進めると成績が表示されます。</p>}</section>
  </div>
 </div>;
}

export function SimpleSeason({state,busy,progress,onPlay,onPost,onNext,onPlayer,message,onSwitchLeague,daily,playSlot,watch=[],onWatch}:{watch?:Watchable[];onWatch?:(key:string)=>void;playSlot?:ReactNode;state:GameState;busy:boolean;progress:number;onPlay:(n:number)=>void;onPost:()=>void;onNext:()=>void;onPlayer:(p:Player)=>void;message:string;onSwitchLeague?:(circuit:Circuit)=>void;daily?:ReactNode}){
 const [archive,setArchive]=useState(0);
 const season=state.history.find(s=>s.number===archive)??state.season;
 const current=season===state.season,table=rankings(season,leagueFor(season,state.club)),mine=table.find(t=>t.team===state.club)!;
 const next=current?nextMatchPreview(state):null,latest=season.results.at(-1);
 const ownScore=latest?.[latest.home===state.club?'homeRuns':'awayRuns'],otherScore=latest?.[latest.home===state.club?'awayRuns':'homeRuns'];
 const post=season.postseason,champion=post?.champion,space=circuitOf(season)==='SPACE',major=circuitOf(season)!=='NPB',total=seasonGames(season),career=leagueProgress(state);
 const challengeRevealed=major||career.mlbUnlocked||career.npbStreak>0||recordAchievements(state).achievements?.npbLeague!==undefined;
 const achievements=recordAchievements(state).achievements??{},recentAchievement=(Object.keys(achievementNames) as Array<keyof typeof achievementNames>).filter(id=>achievements[id]===season.number).at(-1);
 // The page stays where the player left it when a season ends or the next one starts (no forced scrolling).
 const report=useRef<HTMLDivElement>(null);
 const endActions=current&&season.completed&&<div className="s-season-end">{post?.stage==='complete'?<><p>{champion===state.club?`${titleFor(season)}、おめでとう！`:`${titleFor(season)}：${champion?teamById(champion,season).short:'—'}`}</p><button className="s-primary" disabled={busy} onClick={()=>{setArchive(0);onNext();}}>{!major&&career.mlbUnlocked&&state.leagueChoice!=='NPB'?'海外リーグ挑戦へ進む':'次のシーズンへ'}<ChevronRight size={18}/></button></>:<><p>{total}試合が終了しました。</p><button className="s-primary" disabled={busy} onClick={onPost}>王座決定戦の終了まで<ChevronRight size={18}/></button></>}</div>;
 return <div className={'s-season-view'+(season.completed?' is-complete':'')}>
  <div className="s-page-title"><div><p className="s-kicker">{circuitLabel(circuitOf(season))} · SEASON {String(season.number).padStart(2,'0')}</p><h1>{season.completed?'シーズンの成績':'試合を進めよう。'}</h1></div>{state.history.length>0&&<select aria-label="表示するシーズン" value={archive} onChange={e=>setArchive(Number(e.target.value))}><option value={0}>今シーズン（SEASON {String(state.season.number).padStart(2,'0')}）</option>{state.history.map(s=><option value={s.number} key={s.number}>SEASON {String(s.number).padStart(2,'0')} · {circuitLabel(circuitOf(s))}</option>)}</select>}</div>
  {current&&autumnEventActive(new Date())&&<section className="draft-week-banner autumn-banner" aria-label={AUTUMN_EVENT.name}><span>期間限定 〜{autumnEventEndLabel()}</span><h2>{AUTUMN_EVENT.name} 開催中！</h2><p>期間中、その日に最初にシーズンを終えるとボーナス ＋{count(AUTUMN_EVENT.bonus)} pt（1日1回）。秋の頂上決戦を勝ち抜こう。</p></section>}
  {current&&daily}
  {current&&<FeedbackCard seasons={state.history.length}/>}
  {current&&<details className="season-goals"><summary><span><small>目標・達成記録</small><strong>{space?'宇宙王座決定戦優勝':major?'世界王座決定戦優勝':career.mlbUnlocked?'海外リーグ挑戦が解放！':challengeRevealed?'リーグ優勝3連覇':'リーグ初優勝'}</strong>{recentAchievement&&<span className="goal-new-record" role="status">{season.number}年目に{achievementNames[recentAchievement]}を達成！</span>}</span><b>{!major&&challengeRevealed&&!career.mlbUnlocked?`${career.npbStreak} / ${NPB_TITLES_TO_MLB} 連覇`:season.day?`現在 ${table.indexOf(mine)+1}位`:'開幕前'}</b><ChevronRight size={18}/></summary><div className="season-goals-body">
  {!challengeRevealed&&<p className="season-goal-intro">まずはレギュラーシーズンでリーグ1位を目指そう。達成した年は、ここに記録されます。</p>}
  {current&&challengeRevealed&&<section className={'league-challenge '+(major?'league-major':career.mlbUnlocked?'league-unlocked':'')} aria-label="リーグ挑戦">
   <div><span>{space?'LEAGUE 03':major?'LEAGUE 02':'LEAGUE 01'}</span><h2>{space?'宇宙リーグ · 最高難易度':major?'海外リーグ挑戦':career.mlbUnlocked?'国内リーグ · 海外リーグ挑戦も選べます':'国内リーグ · リーグ優勝3連覇への道'}</h2><p>{space?'銀河の果てから、未知の野球生命体が集結。地球で鍛えたチームで、異星の強豪たちを打ち破れ。宇宙一を懸けた最高難易度のリーグが始まる。':major?'チームを育てて世界王座決定戦へ。国内リーグに戻って立て直すこともできます。':career.mlbUnlocked?'国内リーグで育成を続けるか、海外リーグへ挑戦するか選べます。':'リーグ1位を3年連続で達成すると海外リーグへ。プレーオフ・国内王座決定戦の結果は問いません。'}</p>{career.mlbUnlocked&&<div className="league-switch"><button className="s-button" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.(major?'NPB':'MLB');}}>{major?'国内リーグで立て直す':'海外リーグに挑戦する'}</button>{space&&<button className="s-button" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.('MLB');}}>海外リーグに戻る</button>}<small>途中の成績を保存して、いつでも再開できます。</small></div>}</div>
   {!major&&<div className="title-streak" role="progressbar" aria-label="リーグ優勝の連覇" aria-valuemin={0} aria-valuemax={NPB_TITLES_TO_MLB} aria-valuenow={career.npbStreak}><div>{Array.from({length:NPB_TITLES_TO_MLB},(_,i)=>i+1).map(n=><span className={n<=career.npbStreak?'won':''} key={n}>★</span>)}</div><b>{career.npbStreak} / {NPB_TITLES_TO_MLB} 連覇</b></div>}
  </section>}
  <AchievementsPanel state={state} season={season} expanded/>
  </div></details>}
  {current&&spaceUnlocked(state)&&!space&&<section className="space-unlock"><div><small>最高難易度 · 未知との対戦</small><h2>宇宙リーグ、解放。</h2><p>世界一になったあなたへ、宇宙から挑戦状が届いた。相手は未知の野球生命体。地球代表として、銀河の球場へ乗り込もう！</p></div><button className="s-primary" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.('SPACE');}}>宇宙リーグに挑戦する<ChevronRight size={18}/></button></section>}
  <div className="season-report-start" ref={report}>
  {endActions}
  <section className="s-season-card" aria-label="シーズンの進行"><div className="s-season-top"><div><span>{season.day?`${table.indexOf(mine)+1}位`:'開幕前'}</span><h2>{state.name}</h2><p><b>{mine.w}</b> 勝 <b>{mine.l}</b> 敗 <b>{mine.d}</b> 分</p></div><div className="s-game-count"><b>{season.day}</b><span>/ {total} 試合</span></div></div><div className="s-progress" role="progressbar" aria-label="シーズン進行" aria-valuenow={season.day} aria-valuemin={0} aria-valuemax={total}><i style={{width:`${season.day/total*100}%`}}/></div>
   {current&&!season.completed&&<><p className="s-next-opponent">次の相手：{next&&teamById(next.opponent,season).short}{next&&<span>先発 {playerMap[next.mine].name}</span>}{major&&next&&<span>相手先発 {playerMap[next.theirs].name}</span>}</p>{playSlot??<div className="s-play-actions"><button className="s-primary" disabled={busy} onClick={()=>onPlay(total)}><Play size={17} fill="currentColor"/>1年進める</button></div>}</>}
   {busy&&<p className="s-working" role="status">試合を計算しています… {progress}%</p>}
  </section>
  <div className="s-inline-result" role="status">{message&&current?<span>{message}</span>:latest?<span>直近の試合 <b>{ownScore} − {otherScore}</b> {teamById(latest.home===state.club?latest.away:latest.home,season).short}戦</span>:<span>試合でポイントを貯めて、新しい選手を迎えよう。</span>}</div>
  <TeamSeasonStats season={season} club={state.club}/>
  <SimpleStats key={circuitOf(season)+season.number} season={season} club={state.club} onPlayer={onPlayer} lineup={current?state.lineup:[]} pitchers={current?state.pitchers:[]}/>
  </div>
  {post?.stage==='complete'&&<details className="s-fold postseason-results"><summary>{major?'プレーオフ':'短期決戦'}の結果を見る</summary>{post.series.filter(s=>s.higher===state.club||s.lower===state.club||s.stage==='world'||s.stage==='japan').map(s=>{const w=current?watch.find(x=>x.series===s.id):undefined;return <p key={s.id}><span>{space&&s.stage==='world'?'宇宙王座決定戦':stageLabel(s.stage)}</span><b>{s.higher===state.club?state.name:teamById(s.higher,season).short} {s.wins[0]} − {s.wins[1]} {s.lower===state.club?state.name:teamById(s.lower,season).short}</b></p>;})}{!post.series.some(s=>s.higher===state.club||s.lower===state.club)&&<p>プレーオフ進出ならず。次のシーズンで再挑戦。</p>}</details>}
  {!current&&<AchievementsPanel state={state} season={season}/>}
  <VictoryShare state={state} season={season}/>
  <LeagueSeasonStats key={circuitOf(season)} season={season} club={state.club} clubName={season.shareTeam?.name??state.name}/>
  {current&&season.completed&&!busy&&<SeasonAd/>}
 </div>;
}

export function SimplePlayerCard({player,state}:{player:Player;state:GameState}){return <div className="s-player-card"><TradingCard player={player} state={state}/></div>;}

export type SeasonCard={number:number;rank:number;teams:number;w:number;l:number;d:number;points:number;better:number|null;star:{name:string;hr:number}|null;goalPoints:number;goals:{title:string;reward:number}[];next:{title:string;detail:string}|null};
// The end-of-season summary: rank, record, change from last season, the club's
// home-run leader and the points earned, with a way straight into scouting.
export function seasonCardFor(state:GameState,points:number,claimedBefore:string[]=[]):SeasonCard{
 const table=rankings(state.season,leagueFor(state.season,state.club)),i=table.findIndex(t=>t.team===state.club),me=table[i];
 const last=state.history.find(h=>h.number===state.season.number-1)?.standings.find(t=>t.team===state.club);
 const top=Object.values(state.season.batting).filter(b=>b.team===state.club).sort((a,b)=>b.hr-a.hr)[0];
 const goals=seasonGoals(state),next=goals.find(g=>!g.claimed);
 return {number:state.season.number,rank:i+1,teams:table.length,w:me.w,l:me.l,d:me.d,points,better:last?me.w-last.w:null,star:top&&top.hr>0&&playerMap[top.playerId]?{name:playerMap[top.playerId].name,hr:top.hr}:null,
  goalPoints:goals.filter(g=>g.claimed&&!claimedBefore.includes(g.id)).reduce((n,g)=>n+g.reward,0),goals:goals.filter(g=>g.claimed&&g.reward>=300).map(g=>({title:g.title,reward:g.reward})),next:next?{title:next.title,detail:next.detail}:null};
}
export function SimpleScout({state,onDraw,onEquip,drawing,hasDrawn,onSeason,onPlayer,onSkip,adSlot}:{state:GameState;onDraw:()=>void;onEquip:(id:string)=>void;drawing:boolean;hasDrawn:boolean;onSeason:()=>void;onPlayer?:(p:Player)=>void;onSkip?:()=>void;adSlot?:ReactNode}){
 const panel=useRef<HTMLElement>(null),result=useRef<HTMLDivElement>(null);
 // Keep the page still while drawing: no auto-scroll, and the result area holds its height until the new card is in.
 const [holdHeight,setHoldHeight]=useState<number|null>(null);
 const draw=()=>{setHoldHeight(result.current?.offsetHeight??null);onDraw();};
 const pull=hasDrawn?state.lastPulls[0]:null,player=pull?playerMap[pull.playerId]:null;
 const upgrade=player?bestUpgrade(state,player.id):null,canDraw=state.gems>=SIMPLE_SCOUT_COST;
 const major=!!player?.mlb&&!drawing,rates=scoutOdds(state),pct=(x:number)=>`${+(x*100).toFixed(3)}%`;
 const {tier,overall}=scoutPresentation(player,state.owned,state.training);
 return <div className="mobile-scout">
  <div className="s-page-title"><div><p className="s-kicker">SCOUT</p><h1>スカウト</h1><p>新たな選手を獲得しよう！</p></div></div>
  <section ref={panel} className={'s-scout-panel scout-tier-'+tier+' '+(major?'major-reveal':'')}><div className="s-scout-main">
   <div ref={result} className={'s-scout-result '+(drawing?'drawing':'')} style={drawing&&holdHeight?{minHeight:holdHeight}:undefined} aria-live="polite" aria-busy={drawing}>
    {drawing&&<ScoutCharge tier={tier} onSkip={onSkip}/>}
    {player&&!drawing?<>
     
     <ScoutArrival key={'arrival-'+state.pulls} tier={tier} overall={overall} major={major}/>
     <span className="s-new-label">{pull!.isNew?'新しい選手が加入！':pull!.copies<=6?'選手が成長！':'ポイント ＋80'}</span>
     <div className={'scout-reveal animate__animated '+(tier==='rainbow'?'animate__zoomInDown':tier==='gold'?'animate__bounceIn':'animate__flipInY')} key={state.pulls+'-'+state.franchise.tickets+'-'+pull?.copies}><TradingCard player={player} state={state} onPlayer={onPlayer}/></div>
     {upgrade?<div className="s-equip-offer"><ReplacementPreview player={playerMap[upgrade.oldId]} state={state} position={upgrade.pitching?upgrade.position:`${upgrade.index+1}番 · ${upgrade.position}`} mode={upgrade.pitching?'pitcher':'batter'} onPlayer={onPlayer}/><button className="s-button" onClick={()=>onEquip(player.id)}><Users size={16}/>この選手と入れ替える</button></div>:[...state.lineup,...state.pitchers].includes(player.id)?<p className="s-equipped"><Check size={16}/>チームに編成済み</p>:<p>控えに加入しました。チーム画面で起用できます。</p>}
     {!pull!.isNew&&pull!.copies<=6&&<p>重複獲得で能力 ＋1（最大＋5）</p>}
     <ScoutShare key={'share-'+state.pulls} data={scoutShareData(player,state.owned,state.training,tier,pull!.isNew,isRookie(player))}/>
    </>:!drawing&&<div className="s-unopened"><div className="s-baseball" aria-hidden="true">⚾</div><h2>選手カードを1枚獲得</h2><p>国内・海外の選手が登場</p></div>}
   </div>
   <button className="s-primary s-draw" disabled={!canDraw||drawing} onClick={draw}><Sparkles size={19}/>{drawing?'スカウト中…':hasDrawn?'もう1人引く':'1人引く'}<span>{count(SIMPLE_SCOUT_COST)+' pt'}</span></button>
   <div className={'s-scout-balance '+(canDraw?'ok':'short')}><span>所持ポイント</span><b>{count(state.gems)}<small>pt</small></b><em>{canDraw?`あと${count(Math.floor(state.gems/SIMPLE_SCOUT_COST))}回引けます`:`あと${count(SIMPLE_SCOUT_COST-state.gems)} ptで引けます`}</em></div>
   {adSlot}
   {!canDraw&&<><p className="scout-missing">次のスカウトまで あと{count(SIMPLE_SCOUT_COST-state.gems)} pt</p><button className="s-text-link" onClick={onSeason}>試合を進めてポイントを貯める<ChevronRight size={15}/></button></>}
  </div><div className="s-scout-note">1人 3,000 pt。確定する枠（天井）はありません。<details><summary>獲得できる選手・抽選確率</summary><ul className="s-scout-rates">{rates.bands.map(b=><li key={b.id}>{b.label}（{b.detail}・{b.count}人）{pct(b.rate)}</li>)}</ul><p>国内リーグ {players.length-mlbPlayers.length}人／海外リーグ {mlbPlayers.length}人。カードの段（総合は覚醒前の値）ごとに上の確率で決め、同じ段の中では全員が同じ確率です。野手・投手やチームの強さ、ポイントの購入・プレミアムパスで確率は変わりません。</p></details></div></section>
 </div>;
}

function PlayerInfo({player,state,onChange,onClose,onAwaken,catalog=false,pawa=false}:{player:Player;state:GameState;onChange:(s:GameState)=>void;onClose:()=>void;onAwaken:()=>void;catalog?:boolean;pawa?:boolean}){return pawa?<Dialog title="選手カード詳細" className="player-dialog nv-player-dialog" onClose={onClose}><PawaPlayer player={player} state={state} onChange={onChange} onAwaken={onAwaken} catalog={catalog}/></Dialog>:<Dialog title="選手情報" className="player-dialog" onClose={onClose}><PlayerDetails player={player} state={state} onChange={onChange} onAwaken={onAwaken} catalog={catalog}/></Dialog>;}

function SimpleSettings({state,onChange,onClose,onProfileChange,onReset,onRestore,onCompleteReset,canRestore,onTutorial,look,onLook,onRanking}:{state:GameState;onChange:(s:GameState)=>void;onClose:()=>void;onProfileChange?:(p:Profile)=>void;onReset:()=>void;onRestore:()=>void;onCompleteReset:()=>void;canRestore:boolean;onTutorial:()=>void;look:Look;onLook:(l:Look)=>void;onRanking?:()=>void}){
 const [name,setName]=useState(state.name),[error,setError]=useState(''),[rankNote,setRankNote]=useState(''),[rankAsk,setRankAsk]=useState(false),[noStop,setNoStop]=useState(()=>readNoStop());const input=useRef<HTMLInputElement>(null);
 const download=()=>{void saveGameFile(new File([JSON.stringify(state)],`diamond-nine-${state.mode==='career'?'career':'free'}-${state.season.number}.json`,{type:'application/json'})).catch(()=>setError('書き出せませんでした。もう一度お試しください。'));};
 // ランキングの記録を消す(自分の3リーグ分と宇宙リーグ制覇の記録)。通信できなくても設定は使える。
 const removeRanking=async()=>{setRankAsk(false);setRankNote('消しています…');try{const r=await deleteMine();setRankNote(r==='none'?'ランキングに登録した記録はありません。':'ランキングの記録を消しました。');}catch(e){setRankNote((e as {busy?:boolean})?.busy?RANK_BUSY:'消せませんでした。ネットにつながっているか確かめて、もう一度押してください。');}};
 const rankingOn=rankingAvailable()&&!!onRanking;
 return <Dialog title="設定" onClose={onClose}>{rankingOn&&<button type="button" className="s-guide-entry rank-entry-button" onClick={onRanking}><span>何年で優勝したか・宇宙リーグ制覇<strong>オンラインランキング</strong></span><ChevronRight size={18}/></button>}<PremiumPassCard/>{monetizeBridge()&&<PointShop/>}<a className="s-guide-entry" href="/guide.html" target="_blank" rel="noopener noreferrer"><span>はじめての方へ<strong>遊び方ガイド</strong></span><ChevronRight size={18}/></a><a className="s-guide-entry" href={feedbackUrl()} target="_blank" rel="noopener noreferrer" onClick={()=>track('feedback_open',{from:'settings'})}><span>不具合・分かりにくい所<strong>ご意見を送る</strong></span><ChevronRight size={18}/></a><a className="s-guide-entry" href="/legal.html" target="_blank" rel="noopener noreferrer"><span>ポイント・購入について<strong>特定商取引法・資金決済法に基づく表示</strong></span><ChevronRight size={18}/></a><MoreApps/><button type="button" className="s-button tutorial-restart" onClick={onTutorial}>チュートリアルを見直す</button><div className="look-switch" role="group" aria-label="見た目"><span>見た目</span><button type="button" aria-pressed={look==='pawa'} onClick={()=>onLook('pawa')}>新しい</button><button type="button" aria-pressed={look==='classic'} onClick={()=>onLook('classic')}>以前</button></div><div className="look-switch keygame-switch" role="group" aria-label="大事な試合でも止まらない"><span>大事な試合<small>開幕戦・プレーオフ・王座決定戦</small></span><button type="button" aria-pressed={!noStop} onClick={()=>{saveNoStop(false);setNoStop(false);}}>止まる</button><button type="button" aria-pressed={noStop} onClick={()=>{saveNoStop(true);setNoStop(true);}}>止まらない</button></div><p className="keygame-note">{noStop?'大事な試合でも止まらず、一気に進めます(「1年進める」と同じ結果)。':'大事な試合の前で止まり、監督する・おまかせで観る・一気に進めるから選べます。'}</p><label className="s-field">チーム名<input value={name} maxLength={20} onChange={e=>setName(e.target.value)}/></label><button className="s-button" disabled={!name.trim()} onClick={()=>{onChange({...state,name:name.trim()});onClose();}}>保存</button><hr/><div className="reset-zone"><h3>最初からチームをつくる</h3><p>退避してやり直すか、獲得カードを含めて完全に消すか選べます。</p><button className="s-button reset-team" onClick={onReset}><RotateCcw size={16}/>退避してリセット</button>{canRestore&&<button className="s-button" onClick={onRestore}>リセット前のチームに戻す</button>}<button className="s-button complete-reset" onClick={onCompleteReset}>カードも消して完全リセット</button></div><hr/><h3>セーブデータ</h3><p>進行はこの端末・ブラウザに自動保存されます。別の端末や公開URLへ引き継ぐときは、書き出したデータを移動先で読み込んでください。</p><div className="s-settings-actions"><button className="s-button" onClick={download}><Download size={16}/>書き出す</button><button className="s-button" onClick={()=>input.current?.click()}><Upload size={16}/>読み込む</button><input hidden ref={input} type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>10_000_000)throw new Error();const s=migrateState(JSON.parse(await file.text()));if(!s)throw new Error();if((s.mode==='career')!==(state.mode==='career')){setError('別のモードのセーブです。先にクラブを切り替えてください。');return;}onChange(collectSimpleRewards(s));onClose();}catch{setError('このセーブデータを読み込めませんでした。');}finally{e.target.value='';}}}/></div>{error&&<p role="alert">{error}</p>}{rankingOn&&<><hr/><div className="rank-delete"><h3>オンラインランキング</h3><p>ランキングに登録した表示名・チーム名・記録・オーダーを、3つのリーグと宇宙リーグ制覇の記録とも消します（宇宙リーグ制覇の記録は1回きりなので、消した後にもう一度は残せません）。</p>{rankAsk?<div className="s-settings-actions"><button className="s-button" onClick={()=>setRankAsk(false)}>やめる</button><button className="s-button complete-reset" onClick={()=>void removeRanking()}>消す</button></div>:<button className="s-button" onClick={()=>setRankAsk(true)}>ランキングの記録を消す</button>}{rankNote&&<p role="status">{rankNote}</p>}</div></>}<details className="s-source"><summary>ゲームについて・以前のクラブ</summary><p>国内・海外の選手カードを集め、チームを育てる野球シミュレーションです。</p><p>選手名は、名字の一部を「〇」にした表示です。</p><p>打席ごとの結果を集計して成績を計算します。国内リーグは143試合・延長12回。リーグ優勝3連覇後は海外リーグの30球団・162試合（独自日程）に昇格。カリフォルニア枠で海外Aリーグ西地区に参加します。海外リーグは延長決着制で、通常シーズンの延長のみ二塁に走者を置きます。両リーグDH制。対戦相手は国内リーグより海外リーグで強い補正があります。故障・加齢・トレードは未実装です。過去8季の成績を保存します。</p><p>オンラインランキング（育成モード）では、各リーグを初めて制した年数の短さを競えます。開いた時と登録した時だけ通信します。</p><p>効果音：効果音ラボ · カード演出：Animate.css</p><a href="/THIRD_PARTY_ASSETS.txt" target="_blank" rel="noreferrer">素材の出典とライセンス ↗</a>{onProfileChange&&<button className="s-button" onClick={()=>onProfileChange(state.mode==='career'?'free':'career')}>{state.mode==='career'?'以前のクラブに切り替える':'育成モードに切り替える'}</button>}</details></Dialog>;
}

export default function SimpleApp({profile='career',onProfileChange}:{profile?:Profile;onProfileChange?:(p:Profile)=>void}){
 const loaded=useMemo(()=>loadState(profile),[profile]);
 const [state,setState]=useState(()=>collectSimpleRewards(loaded.state));
 const [celebration,setCelebration]=useState<TitleCelebrationEvent|null>(null);
 // Season end opens nothing by itself (no band either): the results/celebration open from the season tab's 結果を見る button.
 const [pendingCelebration,setPendingCelebration]=useState<TitleCelebrationEvent|null>(null),[lastCard,setLastCard]=useState<SeasonCard|null>(null);
 const starter=starterScoutActive(state);
 // 宇宙リーグの間は、相手の名前・球団名を宇宙人の物で出す(見た目だけ。space-aliens.ts)。
 setDisplayCircuit(circuitOf(state.season));
 const [tutorialReplay,setTutorialReplay]=useState(0);
 const [look,setLookState]=useState<Look>(readLook),pawa=look==='pawa';
 const changeLook=(next:Look)=>{saveLook(next);setLookState(next);};
 const [sound,setSound]=useState(()=>{try{return localStorage.getItem('diamond-nine-sound')!=='off';}catch{return true;}}),[resetId,setResetId]=useState(0);
 const [canRestore,setCanRestore]=useState(()=>{try{return !!readResetBackup(profile,localStorage);}catch{return false;}});
 const impact=()=>{if(sound)gameSound('join');};
 const [goalsOpen,setGoalsOpen]=useState(false);
 // 監督して戦う(2026-11-04 vc43 作り直し): 「1年進める」の途中、開幕戦・プレーオフ・王座決定戦の前で止まる(managed.ts)。
 // keyStop=止まって「監督して戦う/おまかせで進める」を選ぶところ、managing=試合の画面。止まっている間は他の操作をしない(lock)。
 type Stop={at:GameState;game:ManagedGame;saved:(WatchOrder|null)[]|null;mode?:WatchMode};
 const [keyStop,setKeyStop]=useState<Stop|null>(null),[managing,setManaging]=useState<Stop|null>(null);
 // オンラインランキング: rankOpen=画面を開いているリーグ、rankPending=優勝して登録を勧める待ち(演出・結果を閉じた後に出す)
 const [rankOpen,setRankOpen]=useState<RankLeague|null>(null),[rankPending,setRankPending]=useState<RankLeague|null>(null),[rankVersion,setRankVersion]=useState('web');
 useEffect(()=>{void appVersion().then(setRankVersion);},[]);
 const [page,setPage]=useState<Page>('season'),[selected,setSelected]=useState<string|null>(null),[settings,setSettings]=useState(false),[confirmCompleteReset,setConfirmCompleteReset]=useState(false);
 // Gifts and the tester request wait until the guided first season is over.
 const [tutorialOn,setTutorialOn]=useState(true),[giftPopup,setGiftPopup]=useState(0),[seasonCard,setSeasonCard]=useState<SeasonCard|null>(null),[reminderAsk,setReminderAsk]=useState(false);
 const closeSeasonCard=()=>{setSeasonCard(null);showPendingInterstitial();if(reminderAskDue(state.history.length+(state.season.completed?1:0)))setReminderAsk(true);};
 // 全画面広告(2026-10-28、10-30 に 3シーズンに1回へ): 結果を見たあと画面が切り替わる時(結果を閉じる・次のシーズンへ)に1回だけ。
 // チュートリアル中・操作中・広告の最中は出さず、次の切り替わりまで持ち越す。パス購入者・起動直後・10分以内は monetize 側で止める。
 const interstitialPending=useRef(false),tutorialRef=useRef(true);tutorialRef.current=tutorialOn;
 const showPendingInterstitial=()=>{if(!interstitialPending.current||tutorialRef.current||lock.current)return;interstitialPending.current=false;setTimeout(()=>{if(!lock.current)void monetizeBridge()?.showInterstitial('season');},600);};
 const [message,setMessage]=useState(''),[saveError,setSaveError]=useState(loaded.warning),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[drawing,setDrawing]=useState(false),[hasDrawn,setHasDrawn]=useState(false);
 const lock=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const finishDraw=useRef<(()=>void)|null>(null),soundRef=useRef(sound);soundRef.current=sound;
 useEffect(()=>{if(page==='scout'&&sound)void prepareGameAudio();},[page,sound]);
 useEffect(()=>{try{const serialized=JSON.stringify(state);if(localStorage.getItem(saveKeyFor(profile))!==serialized)localStorage.setItem(saveKeyFor(profile),serialized);setSaveError('');}catch{setSaveError('保存できません。設定からデータを書き出してください。');}},[state,profile]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);finishDraw.current=null;stopGameAudio();},[]);
 // Synchronize other open tabs so a reset cannot be overwritten by stale cards.
 useEffect(()=>{
  const sync=(event:StorageEvent)=>{
   if(event.storageArea!==localStorage)return;
   try{
    if(event.key===saveKeyFor(profile)){
     const raw=localStorage.getItem(saveKeyFor(profile)),incoming=raw?migrateState(JSON.parse(raw)):null;
     if(incoming&&(incoming.mode==='career')===(profile==='career')){
      if(timer.current)clearTimeout(timer.current);finishDraw.current=null;stopGameAudio();lock.current=false;setBusy(false);setDrawing(false);setHasDrawn(false);setSelected(null);setSettings(false);setConfirmCompleteReset(false);setCelebration(null);setMessage('');setResetId(v=>v+1);setState(current=>JSON.stringify(current)===JSON.stringify(incoming)?current:incoming);
     }
    }
    if(event.key?.startsWith(saveKeyFor(profile)))setCanRestore(!!readResetBackup(profile,localStorage));
   }catch{setSaveError('別タブの保存を反映できませんでした。画面を再読み込みしてください。');}
  };
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
 },[profile]);
 const askCompleteReset=()=>{setSettings(false);setConfirmCompleteReset(true);};
 const completeReset=()=>{
  if(lock.current)return;
  try{const fresh=completeResetTeam(profile,localStorage);setState(fresh);setCelebration(null);setHasDrawn(false);setSettings(false);setSelected(null);setConfirmCompleteReset(false);setCanRestore(false);setResetId(v=>v+1);setPage('team');setMessage('完全リセットしました。スタートスカウトで最初の主力を選べます。');}
  catch{setSaveError('完全リセットを完了できませんでした。保存状態を確認してください。');setConfirmCompleteReset(false);}
 };
 const reset=()=>{if(lock.current)return;try{const fresh=resetTeam(state,profile,localStorage);setState(fresh);setCelebration(null);setHasDrawn(false);setSettings(false);setSelected(null);setCanRestore(true);setResetId(v=>v+1);setPage('team');setMessage('チームをリセットしました。');impact();}catch{setSaveError('退避または保存ができなかったため、リセットを中止しました。設定から書き出してください。');setSettings(false);}};
 const restore=()=>{if(lock.current)return;try{setState(restoreResetBackup(state,profile,localStorage));setCelebration(null);setHasDrawn(false);setSettings(false);setSelected(null);setResetId(v=>v+1);setPage('team');setMessage('リセット前のチームに戻しました。');}catch{setSaveError('チームを復元できませんでした。');setSettings(false);}};
 const toggleSound=()=>{if(sound)stopGameAudio();soundRef.current=!sound;setSound(v=>{try{localStorage.setItem('diamond-nine-sound',v?'off':'on');}catch{}return !v;});};
 const change=(s:GameState)=>{if(!lock.current){setCelebration(null);setState(collectSimpleRewards(s));}};
 // 今日の目標「チームの編成を変える」: 打順・守備・投手陣が変わった時だけ数える。
 const teamChange=(s:GameState)=>{if(lock.current)return;if(JSON.stringify([s.lineup,s.defense,s.pitchers])!==JSON.stringify([state.lineup,state.defense,state.pitchers]))noteDailyMission('team');change(s);};
 // App-only bonuses: added with a functional update so they never overwrite a newer save.
 const addPoints=(points:number,note:string)=>{setState(prev=>({...prev,gems:prev.gems+points}));setMessage(note);};
 const monetize=useMonetize(),premiumOwned=!!monetize?.premium.owned&&!!monetize.premium.verified;
 // 買ったポイントの受け取り口(アプリ版)。試合の計算中・引いている最中は終わるまで待ってから足す
 // (play() は終わりに計算結果で上書きするため、途中で足すと消える)。
 useEffect(()=>{
  const bridge=monetizeBridge();if(!bridge?.setPointSink)return;
  let timers:ReturnType<typeof setTimeout>[]=[];
  const give=(points:number)=>{if(lock.current){timers.push(setTimeout(()=>give(points),500));return;}addPoints(points,`ポイント購入 ＋${count(points)} pt を受け取りました`);};
  bridge.setPointSink(points=>give(points));
  return()=>{bridge.setPointSink?.(null);for(const t of timers)clearTimeout(t);timers=[];};
 },[]);
 useEffect(()=>{
  if(!premiumOwned||busy||drawing||lock.current)return;
  const points=monetizeBridge()?.claimPremiumDaily()??0;
  if(points>0)addPoints(points,`プレミアムパスのログインボーナス ＋${count(points)} pt`);
 },[premiumOwned,busy,drawing]);
 // 2026-11-01 行動力をやめた時の精算: 上限を超えて持っていた行動力と回復ドリンクを、一度だけポイントで返す。
 // 先に記録へ「済み」を書いてから足す(二重に返さない)。行動力の記録が無い人は何もしない。
 // 2026-11-02 vc36 行動力を戻した: 前の記録がある人は一度だけ満タンから始め直す(返したポイントは取り戻さない)。
 // 記録が無い人は parseStamina が満タンで始める。
 // 2026-11-03 vc39 もう一度やめた: 印は retired(vc35 の refunded とは別。vc36〜38 で買った分も返す)。
 useEffect(()=>{
  if(!STAMINA_ENABLED||!hasStaminaRecord())return;
  const r=loadStamina();if(!r.restarted&&updateStamina((x,now,rules)=>restartStamina(x,now,rules)))setTimeout(()=>setMessage(m=>'行動力の仕組みが戻りました。満タンから始まります（4シーズン目からの「1年進める」に使います）。'+(m?' · '+m:'')),0);
 },[]);
 useEffect(()=>{
  if(STAMINA_ENABLED||!hasStaminaRecord())return;
  const [next,points]=settleStaminaRefund(loadStamina());
  if(next.retired&&!loadStamina().retired){saveStamina(next);if(points>0){setState(prev=>({...prev,gems:prev.gems+points}));setTimeout(()=>setMessage(m=>`行動力の仕組みをなくしました。持っていた行動力と回復ドリンクを ＋${count(points)} pt に替えました`+(m?' · '+m:'')),0);}}
 },[]);
 const dailyRecord=useDaily();
 // A goal finished on another screen is announced there; the season tab keeps a dot until it is claimed.
 const dailyReady=DAILY_MISSIONS.filter(m=>dailyRecord.done.includes(m.id)&&!dailyRecord.claimed.includes(m.id));
 const [dailyToast,setDailyToast]=useState('');const seenDone=useRef<string|null>(null);
 useEffect(()=>{
  const key=dailyRecord.day+':'+dailyRecord.done.join(',');
  if(seenDone.current!==null&&seenDone.current.split(':')[0]===dailyRecord.day){
   const before=seenDone.current.split(':')[1].split(',').filter(Boolean),fresh=DAILY_MISSIONS.find(m=>dailyRecord.done.includes(m.id)&&!before.includes(m.id)&&!dailyRecord.claimed.includes(m.id));
   if(fresh){setDailyToast(`今日の目標「${fresh.label}」達成！ 試合・成績で ＋${count(fresh.points)} pt を受け取れます`);const t=setTimeout(()=>setDailyToast(''),3500);seenDone.current=key;return()=>clearTimeout(t);}
  }
  seenDone.current=key;
 },[dailyRecord.day,dailyRecord.done.join(','),dailyRecord.claimed.join(',')]);
 useEffect(()=>{
  if(starter||busy||drawing||lock.current)return;
  noteReviewPlayDay(dailyRecord.day);
  const gift=takeLaunchGift(),login=takeDailyLogin();
  if(gift||login)addPoints(gift+login,[gift&&`公開記念ボーナス ＋${count(LAUNCH_GIFT.points)} pt`,login&&`ログインボーナス ＋${count(login)} pt`].filter(Boolean).join(' · '));
  if(gift){track('launch_gift',{points:gift});setGiftPopup(gift);}
 },[starter,busy,drawing,dailyRecord.day,dailyRecord.login]);
 const [adPlaying,setAdPlaying]=useState(false);
 // リワード広告を最後まで見ると、ポイントを使わずにその場で1回引ける(1日の回数は monetization.ts の REWARD_AD_DAILY_LIMIT)。
 // 報酬は広告SDKの報酬コールバックでだけ立ち、引くのは広告が閉じて操作の鍵が外れた後。
 const adDrawPending=useRef(false),drawRef=useRef<(bonus?:number)=>void>(()=>{});
 // 2026-10-28: ホーム・シーズン結果にも「動画を見てスカウト1回」。見終わったらスカウト画面へ移って、その場で1回引く演出。
 const adFrom=useRef<'scout'|'home'|'result'>('scout');
 const rewardAdFor=(from:'scout'|'home'|'result')=><RewardAdButton key={'reward-ad-'+from} className={'reward-ad-'+from} label={from==='scout'?'広告を見て1回引く':'動画を見てスカウト1回'} hideWhenNone={from!=='scout'} disabled={busy||drawing||adPlaying||starter} onStart={()=>{adDrawPending.current=false;adFrom.current=from;lock.current=true;setAdPlaying(true);}} onReward={()=>{adDrawPending.current=true;track('reward_ad_draw',{from:adFrom.current});}} onEnd={()=>{lock.current=false;setAdPlaying(false);if(adDrawPending.current){adDrawPending.current=false;const f=adFrom.current;if(f==='result')setSeasonCard(null);if(f!=='scout'){track('page_open',{page:'scout'});stopGameAudio();setPage('scout');window.scrollTo({top:0,behavior:'auto'});}setTimeout(()=>drawRef.current(SIMPLE_SCOUT_COST),f==='scout'?0:120);}}}/>;
 const rewardAd=rewardAdFor('scout');
 // Detect only a newly earned title from this play action; loading/importing is silent.
 const commitPlayedSeason=(next:GameState)=>{const earned=firstTitleCelebration(state,next);
  if(next.season.completed&&next.season.postseason?.stage==='complete'&&state.season.postseason?.stage!=='complete'){const table=rankings(next.season,leagueFor(next.season,next.club));track('season_complete',{season:next.season.number,league:circuitOf(next.season),rank:table.findIndex(t=>t.team===next.club)+1,champion:next.season.postseason.champion===next.club,milestone:earned?.kind??'',team_overall:next.season.shareTeam?Math.round([...next.season.shareTeam.batters,...next.season.shareTeam.pitchers].reduce((a,p)=>a+p.overall,0)/Math.max(1,next.season.shareTeam.batters.length+next.season.shareTeam.pitchers.length)):0,points:next.gems,pulls:next.pulls});}setState(next);setCelebration(earned);setPendingCelebration(null);if(next.season.postseason?.stage==='complete'&&state.season.postseason?.stage!=='complete'&&next.season.postseason.champion===next.club)setTimeout(()=>maybeAskReview('title'),1500);try{const lg=rankPromptFor(state,next);if(lg)setRankPending(lg);}catch{/* ランキングはゲームの進行に関わらない */}return earned;};
 // Persist the offer and selected card before playing the reveal. Reloads,
 // imports and a second open tab resume the same one-time reward.
 const commitStarter=(index:number|null,name=state.name):boolean=>{
  const teamName=name.trim();
  if(lock.current||!teamName||teamName.length>20)return false;
  try{
   const raw=localStorage.getItem(saveKeyFor(profile));
   const current=raw?migrateState(JSON.parse(raw)):state;
   if(!current||(current.mode==='career')!==(profile==='career'))throw new Error('Invalid save');
   if(!starterScoutActive(current)||JSON.stringify(current.starterScout?.choices)!==JSON.stringify(state.starterScout?.choices)||(index!==null&&current.starterScout?.selected)){
    setState(current);return false;
   }
   const renamed={...current,name:teamName};
   const next=index===null?finishStarterScout(renamed):pickStarterCard(renamed,index);
   if(next===renamed)return false;
   const ready=index===null?equipScoutedPlayer(next,next.starterScout!.selected!):next;
   localStorage.setItem(saveKeyFor(profile),JSON.stringify(ready));setState(ready);
   if(index===null){track('starter_complete',{});stopGameAudio();setPage('season');setHasDrawn(false);setMessage('主力選手がチームに加入しました。最初のシーズンを始めよう！');window.scrollTo({top:0,behavior:'auto'});}
   return true;
  }catch{setSaveError('保存できませんでした。空き容量を確認して、もう一度お試しください。設定からデータを書き出すこともできます。');return false;}
 };
 const go=(p:Page)=>{if(starter)return;if(p!==page)track('page_open',{page:p});if(page==='scout'&&p!==page)stopGameAudio();setPage(p);window.scrollTo({top:0,behavior:'smooth'});};
 // 1年を進める。大事な試合(開幕戦・プレーオフ・王座決定戦)の前で止まり、選んだら続きから進める(runYear)。
 // year=止まる前も後も同じ1年の始まりの状態(終わった時の「獲得ポイント」などの差はここから数える)。
 const year=useRef<{start:GameState;from:number;target:number;kind:'year'|'post';skipSeries?:string|null}|null>(null);
 const play=(days:number)=>{
  if(lock.current||state.season.completed)return;
  if(soundRef.current)void prepareGameAudio();
  // 行動力: 進める試合ぶんを先に使う(足りなければ進めない)。計算に失敗したら返す。
  const staminaCost=days>0?costToFinish(state):0;
  if(staminaCost>0&&!updateStamina((r,now,rules)=>spendStamina(r,staminaCost,now,rules)))return;
  lock.current=true;setBusy(true);setProgress(0);
  year.current={start:state,from:state.season.day,target:Math.min(seasonGames(state.season),state.season.day+days),kind:'year'};
  runYear(state,staminaCost);
 };
 const runYear=(from:GameState,staminaCost=0)=>{
  const run=year.current??{start:from,from:from.season.day,target:seasonGames(from.season),kind:from.season.completed?'post' as const:'year' as const};year.current=run;
  const start=run.start;let current=from;
  const step=()=>{try{
   // 自分のチームの大事な試合の前で止める(1日ずつ見て、そうでない日はまとめて進める)。
   // 設定の「大事な試合でも止まらない」と「このシリーズの残りを一気に進める」の時は止まらない(おまかせと同じ計算で進む)。
   if(stopAt(current,{noStop:readNoStop(),skipSeries:run.skipSeries??null})){const game=managedGame(current);if(game){pauseAt(current,game);return;}}
   if(!current.season.completed&&current.season.day<run.target){
    current=simulateDays(current,Math.min(7,run.target-current.season.day));
    setProgress(Math.round((current.season.day-run.from)/Math.max(1,run.target-run.from)*100));
    timer.current=setTimeout(step,20);return;
   }
   if(current.season.completed&&current.season.postseason?.stage!=='complete'){current=simulatePostseason(current,1);timer.current=setTimeout(step,15);return;}
   year.current=null;
   if(run.kind==='post'){current=collectSimpleRewards(current);commitPlayedSeason(current);setMessage(`${circuitOf(current.season)==='SPACE'?'宇宙王座決定戦':circuitOf(current.season)==='MLB'?'世界王座決定戦':'プレーオフ・国内王座決定戦'}まで終了しました。獲得ポイント ＋${count(current.gems-start.gems)} pt`);lock.current=false;setBusy(false);return;}
   const from=run.from,target=run.target;
   current=collectSimpleRewards(current);let autumnPts=0;[current,autumnPts]=claimAutumnBonus(current,new Date());const a=start.season.standings.find(t=>t.team===state.club)!,b=current.season.standings.find(t=>t.team===state.club)!;const game=current.season.results.at(-1)!;const score=game.home===state.club?`${game.homeRuns} − ${game.awayRuns}`:`${game.awayRuns} − ${game.homeRuns}`;setMessage(`${target-from===1?`${teamById(game.home===state.club?game.away:game.home,current.season).short}戦 ${score}`:`${target-from}試合：${b.w-a.w}勝 ${b.l-a.l}敗 ${b.d-a.d}分`}　獲得ポイント ＋${count(current.gems-start.gems)} pt${current.season.completed?` · ${circuitOf(current.season)==='SPACE'?'宇宙王座決定戦':circuitOf(current.season)==='MLB'?'世界王座決定戦':'プレーオフ・国内王座決定戦'}まで終了！`:''}`);noteDailyMission('play');if(autumnPts)setMessage(m=>m+`　${AUTUMN_EVENT.name}ボーナス ＋${count(autumnPts)} pt`);track('games_played',{games:target-from,season:current.season.number,league:circuitOf(current.season),completed:current.season.completed});if(current.season.completed&&!start.season.completed&&seasonInterstitialDue(start.history.length+1))interstitialPending.current=true;const earned=commitPlayedSeason(current);if(current.season.completed&&!start.season.completed){const card=seasonCardFor(current,current.gems-start.gems,start.franchise.claimed);setLastCard(card);}lock.current=false;setBusy(false);
  }catch{if(staminaCost>0)updateStamina((r,now,rules)=>addStamina(r,staminaCost,now,rules));year.current=null;setMessage('試合を進められませんでした。編成をご確認ください。');setBusy(false);lock.current=false;}};
  timer.current=setTimeout(step,30);
 };
 /** 大事な試合の前で止まる。そこまでの結果は保存し(閉じてもここから)、選ぶ画面を出す。途中で閉じた試合があれば「続きから」。 */
 const pauseAt=(current:GameState,game:ManagedGame)=>{
  setState(current);setProgress(0);
  const back=readManage(profile,game.key);setKeyStop({at:current,game,saved:back?.inputs??null,mode:back?.mode});
  track('key_game_stop',{kind:game.kind,label:game.label,league:circuitOf(current.season)});
 };
 const chooseAuto=()=>{const stop=keyStop;if(!stop)return;clearManage(profile);setKeyStop(null);track('key_game_auto',{kind:stop.game.kind});
  try{runYear(advanceKeyDay(stop.at));}catch{setMessage('試合を進められませんでした。');lock.current=false;setBusy(false);}};
 const chooseManage=(fresh=false)=>{const stop=keyStop;if(!stop)return;if(fresh)clearManage(profile);setKeyStop(null);track('key_game_manage',{kind:stop.game.kind,resume:!fresh&&!!stop.saved});setManaging({...stop,saved:fresh?null:stop.saved,mode:fresh?'manage':stop.mode??'manage'});};
 /** おまかせで観る: 観戦の画面で動きを見せる。監督の操作は出さない(途中で「ここから監督する」にできる)。結果はおまかせと同じ。 */
 const chooseWatch=(fresh=false)=>{const stop=keyStop;if(!stop)return;const resume=!fresh&&stop.mode==='watch'&&!!stop.saved;if(!resume)clearManage(profile);setKeyStop(null);track('key_game_watch',{kind:stop.game.kind,resume});setManaging({...stop,saved:resume?stop.saved:null,mode:'watch'});};
 /** このシリーズの残りを一気に進める(短期決戦)。このシリーズの間は止まらない。 */
 const chooseSeries=()=>{const stop=keyStop;if(!stop||!stop.game.series)return;clearManage(profile);setKeyStop(null);track('key_game_series_skip',{kind:stop.game.kind});
  if(year.current)year.current.skipSeries=stop.game.series;else year.current={start:stop.at,from:stop.at.season.day,target:seasonGames(stop.at.season),kind:'post',skipSeries:stop.game.series};
  try{runYear(advanceKeyDay(stop.at));}catch{setMessage('試合を進められませんでした。');lock.current=false;setBusy(false);}};
 const pauseManaged=(inputs:(WatchOrder|null)[],mode:WatchMode='manage')=>{const m=managing;if(!m)return;saveManage(profile,{v:1,key:m.game.key,control:m.game.control,inputs,mode});setManaging(null);setKeyStop({...m,saved:inputs,mode});};
 const finishManaged=(inputs:(WatchOrder|null)[])=>{const m=managing;if(!m)return;setManaging(null);
  try{const next=commitManaged(m.at,m.game.control,inputs);clearManage(profile);track('key_game_done',{kind:m.game.kind,orders:inputs.filter(Boolean).length});runYear(next);}
  catch{setMessage('試合の結果を入れられませんでした。もう一度「1年進める」を押すと、この試合からやり直せます。');year.current=null;lock.current=false;setBusy(false);}};
 // 途中で閉じた試合があれば、開いた時にその試合の前から(選ぶ画面を出す)。
 useEffect(()=>{if(starterScoutActive(state)||lock.current)return;const k=keyGameAhead(state);if(!k||!readManage(profile,k.key))return;
  const game=managedGame(state);if(!game)return;lock.current=true;setBusy(true);year.current={start:state,from:state.season.day,target:seasonGames(state.season),kind:state.season.completed?'post':'year'};pauseAt(state,game);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const post=()=>{if(lock.current)return;if(soundRef.current)void prepareGameAudio();lock.current=true;setBusy(true);setProgress(0);year.current={start:state,from:state.season.day,target:state.season.day,kind:'post'};runYear(state);};
 const draw=(bonus=0)=>{
  if(lock.current||state.gems+bonus<SIMPLE_SCOUT_COST)return;
  lock.current=true;
  // Commit before the reveal; skipping/reloading never rerolls or charges twice.
  // bonus: 広告で引く1回分(同じ額を足してから引くので所持ポイントは減らない)。
  const next=drawSimplePlayer(bonus?{...state,gems:state.gems+bonus}:state,new Date());noteDailyMission('scout');setState(next);setHasDrawn(true);setDrawing(true);monetizeBridge()?.noteScout();
  const {tier}=scoutPresentation(playerMap[next.lastPulls[0].playerId],next.owned,next.training);
  track('scout_draw',{tier,is_new:next.lastPulls[0].isNew,overseas:!!playerMap[next.lastPulls[0].playerId].mlb,pulls:next.pulls,points_left:next.gems});
  // Sounds follow the card: placed → (gold/rainbow) drum roll → it turns over at 68% of the reveal.
  stopGameAudio();if(soundRef.current)drawSounds(tier,0);
  let flipped=false;const flipTimer=setTimeout(()=>{flipped=true;if(soundRef.current)revealSounds(tier);},Math.round(scoutDuration(tier)*.68));
  finishDraw.current=()=>{
   if(!finishDraw.current)return;finishDraw.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;clearTimeout(flipTimer);
   if(!flipped){stopGameAudio();if(soundRef.current)revealSounds(tier);}
   if(tier==='rainbow'||tier==='gold')setTimeout(()=>maybeAskReview(tier),1800);
   setDrawing(false);lock.current=false;
  };
  timer.current=setTimeout(()=>finishDraw.current?.(),scoutDuration(tier));
 };
 // 2026-11-04 vc43 10回まとめて引く: 10回分を先に引いて保存してから、専用の演出(PawaMultiReveal)を見せる。
 // 演出が終わる(飛ばす)と PawaScout が onSkip → finishDraw を呼ぶ。演出が止まっても60秒で必ず戻す。
 const drawMulti=()=>{
  if(lock.current||state.gems<MULTI_SCOUT_COST)return;
  const next=drawSimplePlayers(state,new Date());if(next===state)return;
  lock.current=true;
  noteDailyMission('scout');setState(next);setHasDrawn(true);setDrawing(true);
  for(let i=0;i<next.lastPulls.length;i++)monetizeBridge()?.noteScout();
  const tiers=next.lastPulls.map(p=>scoutPresentation(playerMap[p.playerId],next.owned,next.training).tier);
  track('scout_draw_multi',{count:next.lastPulls.length,rainbow:tiers.filter(t=>t==='rainbow').length,gold:tiers.filter(t=>t==='gold').length,is_new:next.lastPulls.filter(p=>p.isNew).length,pulls:next.pulls,points_left:next.gems});
  stopGameAudio();if(soundRef.current)void prepareGameAudio();
  const best=tiers.includes('rainbow')?'rainbow':tiers.includes('gold')?'gold':null;
  finishDraw.current=()=>{
   if(!finishDraw.current)return;finishDraw.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;
   if(best)setTimeout(()=>maybeAskReview(best),1800);
   setDrawing(false);lock.current=false;
  };
  timer.current=setTimeout(()=>finishDraw.current?.(),60000);
 };
 drawRef.current=draw;
 // ---- 行動力(stamina.ts) ----
 const stamina=useStaminaSummary();
 const staminaAdLock=useRef(false);
 const staminaActions={
  onPlay:()=>play(seasonGames(state.season)),
  onBuy:(option:StaminaPtOption)=>{
   if(lock.current)return null;
   const day=localDay();let got:[number,number]|null=null;
   updateStamina((x,t,rules)=>{const r=buyStaminaOption(option,x,state.gems,t,rules,day);if(!r)return null;got=[r[1],r[2]];return r[0];});
   if(!got)return null;const [price,amount]=got as [number,number];
   setState(prev=>({...prev,gems:prev.gems-price}));track('stamina_points',{cost:price,option,amount});return got;
  },
  onBuyDrinks:()=>{
   if(lock.current)return false;let price=0;
   updateStamina(x=>{const r=buyDrinkSet(x,state.gems,localDay());if(!r)return null;price=r[1];return r[0];});
   if(!price)return false;setState(prev=>({...prev,gems:prev.gems-price}));track('stamina_drink_buy',{cost:price});return true;
  },
  onDrink:()=>{if(lock.current)return false;const ok=!!updateStamina((r,now,rules)=>useDrink(r,now,rules));if(ok)track('stamina_drink',{});return ok;},
  onAdStart:()=>{staminaAdLock.current=true;lock.current=true;setAdPlaying(true);},
  onAdReward:(amount:number)=>{updateStamina((r,now,rules)=>addStamina(r,amount,now,rules));track('stamina_ad',{amount});},
  onAdEnd:()=>{if(staminaAdLock.current){staminaAdLock.current=false;lock.current=false;setAdPlaying(false);}},
 };
 // 回復ドリンクの配布: ログインで1本・今日の目標を全部で1本(1日1回ずつ、端末に記録)。
 useEffect(()=>{
  if(starter||busy||drawing||lock.current)return;
  const day=localDay();
  if(STAMINA_ENABLED&&dailyRecord.login){const [n,got]=claimDrinkGift(loadStamina(),'login',day);if(got){updateStamina(()=>n);setMessage(m=>(m?m+' · ':'')+`回復ドリンク ＋1本（1本で行動力 ＋${DRINK_RESTORE}）`);}}
  // 2026-11-02 vc36: 今日の目標を全部達成した時のドリンクはやめた(配るのはログインの1本だけ)。
 },[starter,busy,drawing,dailyRecord.day,dailyRecord.login,dailyRecord.all]);
 // 満タンになる時刻に通知(通知を許可した人だけ。端末の中だけで完結)。
 const staminaFullAt=stamina.fullAt;
 const [staminaIntro,setStaminaIntro]=useState(false);
 // 今日の目標「シーズンの結果を見る」
 useEffect(()=>{if(seasonCard||celebration)noteDailyMission('result');},[seasonCard,celebration]);
 // 以前の見た目には結果カードを開くボタンが無いので、終わったシーズンの成績が出ている時に数える。
 useEffect(()=>{if(!pawa&&page==='season'&&state.season.completed&&!busy)noteDailyMission('result');},[pawa,page,state.season.completed,busy]);
 useEffect(()=>{if(page==='season'&&!busy&&!drawing&&!starter&&!tutorialOn&&!celebration&&!seasonCard&&staminaIntroDue(state))setStaminaIntro(true);},[page,busy,drawing,starter,tutorialOn,celebration,seasonCard,state.season.number,state.pulls]);
 const closeStaminaIntro=()=>{markStaminaIntro();setStaminaIntro(false);};
 useEffect(()=>{if(typeof window!=='undefined')void window.diamondReminder?.staminaFull?.(STAMINA_ENABLED?staminaFullAt:null);},[staminaFullAt]);
 return <div className={"simple-app"+(pawa?" nv-app":"")} data-circuit={circuitOf(state.season)}>{managing&&<WatchScreen key={managing.game.key} state={state} game={managing.game} saved={managing.saved} sound={sound} mode={managing.mode??'manage'} onSave={(inputs,mode)=>saveManage(profile,{v:1,key:managing.game.key,control:managing.game.control,inputs,mode})} onPause={pauseManaged} onFinish={inputs=>finishManaged(inputs)}/>}{keyStop&&!managing&&<KeyGameStop stop={keyStop} name={state.name} club={state.club} onManage={()=>chooseManage(false)} onRestart={()=>keyStop.mode==='watch'?chooseWatch(true):chooseManage(true)} onWatch={()=>chooseWatch()} onAuto={chooseAuto} onSeries={chooseSeries}/>}<header className="s-header"><a href="#" onClick={e=>{e.preventDefault();go('season');}} className="s-brand"><img className="s-brand-icon" src="/assets/pro/diamond-nine-logo-v1.png" alt="" width={44} height={44}/><img className="s-brand-wordmark" src="/assets/pro/pawa/logo.webp" alt="" width={120} height={88}/><b>DIAMOND NINE</b></a><div>{pawa&&<span className="s-league">{circuitLabel(circuitOf(state.season))}・SEASON {pawaPad(state.season.number)}</span>}{!starter&&<StaminaChip onOpen={()=>go('season')} state={state} pawa={pawa} busy={busy||drawing} actions={staminaActions}/>}<span className="s-wallet"><img className="s-coin" src="/assets/pro/pawa/coin.webp" alt="" width={22} height={22}/>{count(state.gems)} <small>pt</small></span><button className="s-icon sound-toggle" aria-label={sound?"効果音をオフにする":"効果音をオンにする"} onClick={toggleSound}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button className="s-icon" aria-label="設定を開く" onClick={()=>setSettings(true)} disabled={busy||drawing}><Settings size={19}/></button></div></header><nav className="s-nav" aria-label="メインメニュー">{tabs.map(t=><button key={t.id} aria-current={(page==='catalog'?'team':page)===t.id?'page':undefined} onClick={()=>go(t.id)} disabled={busy||drawing||starter}><img className="s-nav-art" src={`/assets/pro/pawa/${t.art}.webp`} alt="" width={160} height={90}/><t.icon size={18}/><span className="s-nav-label">{t.label}</span>{t.id==='season'&&dailyReady.length>0&&page!=='season'&&<i className="s-nav-dot" aria-label="受け取れる報酬があります"/>}</button>)}</nav>{pawa&&<button className="s-nav-menu" onClick={()=>setSettings(true)} disabled={busy||drawing}><img className="s-nav-art" src="/assets/pro/pawa/tab-menu.webp" alt="" width={160} height={90}/><span className="s-nav-label">メニュー</span></button>}<main className="s-main">{!starter&&!tutorialOn&&<TesterBanner/>}{saveError&&<div className="s-save-error" role="alert">{saveError}<button onClick={()=>setSettings(true)}>設定を開く</button></div>}<BeginnerTutorial state={state} profile={profile} page={page} replay={tutorialReplay} busy={busy||drawing} onPage={go} onAuto={()=>change(buildByStrategy(state,'balanced'))} onPlay={()=>play(seasonGames(state.season))} onActive={setTutorialOn}/>{starter?pawa?<PawaStarter key={resetId+'-'+state.starterScout!.choices.join('-')} state={state} sound={sound} onPick={(index,name)=>commitStarter(index,name)} onFinish={name=>commitStarter(null,name)} onPlayer={p=>setSelected(p.id)}/>:<StarterScout key={resetId+'-'+state.starterScout!.choices.join('-')} state={state} sound={sound} onPick={(index,name)=>commitStarter(index,name)} onFinish={name=>commitStarter(null,name)} onPlayer={p=>setSelected(p.id)}/>:<>{page==='season'&&pawa&&<PawaSeason adSlot={rewardAdFor('home')} goalsOpen={goalsOpen} onGoals={setGoalsOpen} dailyReady={dailyReady.length} onShowResult={lastCard&&state.season.completed&&lastCard.number===state.season.number?()=>{if(pendingCelebration){setCelebration(pendingCelebration);setPendingCelebration(null);}else setSeasonCard(lastCard);}:undefined} state={state} busy={busy} progress={progress} onPlay={play} onPost={post} playSlot={<StaminaPlay state={state} busy={busy} pawa={pawa} actions={staminaActions}/>} onNext={()=>{showPendingInterstitial();track('season_next',{season:state.season.number+1});setPendingCelebration(null);{const next=nextSeason(state);change(next);setMessage('新しいシーズンが始まりました。');}}} onSwitchLeague={target=>{track('league_switch',{to:target});change(switchLeague(state,target));setMessage(circuitLabel(target)+'に切り替えました。選手・育成・ポイントは引き継いでいます。');}} onPlayer={p=>setSelected(p.id)} message={message} daily={<DailyPanel disabled={busy||drawing} onReward={addPoints}/>}/>}{page==='season'&&!pawa&&<SimpleSeason state={state} busy={busy} progress={progress} onPlay={play} onPost={post} playSlot={<StaminaPlay state={state} busy={busy} pawa={pawa} actions={staminaActions}/>} onNext={()=>{showPendingInterstitial();track('season_next',{season:state.season.number+1});setPendingCelebration(null);{const next=nextSeason(state);change(next);setMessage('新しいシーズンが始まりました。');}}} onSwitchLeague={target=>{track('league_switch',{to:target});change(switchLeague(state,target));setMessage(circuitLabel(target)+'に切り替えました。選手・育成・ポイントは引き継いでいます。');}} onPlayer={p=>setSelected(p.id)} message={message} daily={<DailyPanel disabled={busy||drawing} onReward={addPoints}/>}/ >}{page==='catalog'&&pawa&&<PawaCatalog state={state} onBack={()=>go('team')} onPlayer={p=>setSelected(p.id)}/>}{page==='catalog'&&!pawa&&<PlayerCatalog state={state} onBack={()=>go('team')} onPlayer={p=>setSelected(p.id)}/ >}{page==='team'&&pawa&&<PawaTeam key={resetId} state={state} onChange={teamChange} onPlayer={p=>setSelected(p.id)} onImpact={impact} onCatalog={()=>go('catalog')} onSeason={()=>go('season')} onReset={reset} onRestore={restore} onCompleteReset={askCompleteReset} canRestore={canRestore}/>}{page==='team'&&!pawa&&<DeckTeam key={resetId} state={state} onChange={teamChange} onPlayer={p=>setSelected(p.id)} onImpact={impact} onCatalog={()=>go('catalog')} onSeason={()=>go('season')} onReset={reset} onRestore={restore} onCompleteReset={askCompleteReset} canRestore={canRestore}/ >}{page==='scout'&&pawa&&<PawaScout state={state} sound={sound} onSkip={()=>finishDraw.current?.()} onDraw={()=>draw()} onDrawMulti={drawMulti} onEquip={id=>teamChange(equipScoutedPlayer(state,id))} drawing={drawing} hasDrawn={hasDrawn} onSeason={()=>go('season')} onPlayer={p=>setSelected(p.id)} adSlot={rewardAd}/>}{page==='scout'&&!pawa&&<SimpleScout state={state} onSkip={()=>finishDraw.current?.()} onDraw={()=>draw()} onEquip={id=>teamChange(equipScoutedPlayer(state,id))} drawing={drawing} hasDrawn={hasDrawn} onSeason={()=>go('season')} onPlayer={p=>setSelected(p.id)} adSlot={rewardAd}/ >}</>}{pawa&&!starter&&<PawaGoalsAside state={state} onOpen={()=>{go('season');setGoalsOpen(true);}}/>}</main><footer className="s-footer">自動保存 · 国内・海外の選手 · 非公式ゲーム<div className="s-public-links"><a href="/guide.html" target="_blank" rel="noopener noreferrer">遊び方ガイド</a><a href="/welcome.html" target="_blank" rel="noopener noreferrer">ゲームを紹介する</a><a href="/privacy.html" target="_blank" rel="noopener noreferrer">データ・プライバシー</a><a href="/legal.html" target="_blank" rel="noopener noreferrer">特定商取引法・資金決済法に基づく表示</a></div></footer>{selected&&<PlayerInfo player={playerMap[selected]} state={state} catalog={page==='catalog'} pawa={pawa} onChange={change} onClose={()=>setSelected(null)} onAwaken={()=>{if(sound)gameSound('awaken');}}/ >}{settings&&<SimpleSettings onTutorial={()=>{setSettings(false);setTutorialReplay(v=>v+1);window.scrollTo({top:0,behavior:'auto'});}} state={state} onChange={change} onClose={()=>setSettings(false)} onProfileChange={onProfileChange} onReset={reset} onRestore={restore} onCompleteReset={askCompleteReset} canRestore={canRestore} look={look} onLook={changeLook} onRanking={()=>{setSettings(false);track('ranking_open',{from:'menu'});setRankOpen('mlb');}}/ >}{confirmCompleteReset&&<Dialog title="完全リセット" onClose={()=>setConfirmCompleteReset(false)}><div className="complete-reset-dialog"><h3>このクラブの獲得カードをすべて消します。</h3><p>所持カード {Object.keys(state.owned).length}人分・重複獲得・覚醒・ポイント・シーズン成績と、リセット前の復元用データを削除します。</p><p>初期配布の26人、覚醒なし、0ポイントに戻り、スタートスカウトで1人を選んで再スタートします。</p><p><strong>完全リセット後は元に戻せません。</strong></p><div><button className="s-button" onClick={()=>setConfirmCompleteReset(false)}>キャンセル</button><button className="s-button complete-reset" onClick={completeReset}>所持カードを消して最初から</button></div></div></Dialog>}{seasonCard&&!celebration&&pawa&&<PawaSeasonResult card={seasonCard} state={state} onScout={()=>{closeSeasonCard();go('scout');}} onClose={()=>closeSeasonCard()} adSlot={rewardAdFor('result')}/>}{seasonCard&&!celebration&&!pawa&&<Dialog title={`SEASON ${String(seasonCard.number).padStart(2,'0')} 終了`} className="season-card-dialog" onClose={()=>closeSeasonCard()}><div className="season-card"><p className="season-card-rank"><b>{seasonCard.rank}</b>位<small>{seasonCard.teams}チーム中</small></p><p className="season-card-record">{seasonCard.w}勝 {seasonCard.l}敗{seasonCard.d?` ${seasonCard.d}分`:''}{seasonCard.better!==null&&<em className={seasonCard.better>0?'up':seasonCard.better<0?'down':''}>{seasonCard.better>0?`昨季より ＋${seasonCard.better}勝`:seasonCard.better<0?`昨季より ${seasonCard.better}勝`:'昨季と同じ勝ち数'}</em>}</p>{seasonCard.star&&<p className="season-card-star">チーム本塁打王 <strong>{seasonCard.star.name}</strong> {seasonCard.star.hr}本</p>}{seasonCard.goals.length>0&&<ul className="season-card-goals">{seasonCard.goals.map(g=><li key={g.title}><Check size={14}/>{g.title}<span>＋{count(g.reward)} pt</span></li>)}</ul>}<p className="season-card-points">獲得 <b>＋{count(seasonCard.points)}</b> pt{seasonCard.goalPoints>0&&seasonCard.goalPoints<seasonCard.points&&<small className="season-card-split">試合など ＋{count(seasonCard.points-seasonCard.goalPoints)} ・ 目標達成 ＋{count(seasonCard.goalPoints)}</small>}</p>{seasonCard.next&&<p className="season-card-next">次の目標：<strong>{seasonCard.next.title}</strong>（{seasonCard.next.detail}）</p>}{state.gems>=SIMPLE_SCOUT_COST?<button className="s-primary" onClick={()=>{closeSeasonCard();go('scout');}}><Sparkles size={18}/>スカウトで補強する（{count(Math.floor(state.gems/SIMPLE_SCOUT_COST))}回分）</button>:<p className="season-card-hint">次のスカウトまで あと{count(SIMPLE_SCOUT_COST-state.gems)} pt</p>}<button className="s-text-link" onClick={()=>closeSeasonCard()}>結果をくわしく見る</button></div></Dialog>}{staminaIntro&&<Dialog title="行動力のしくみ" className="gift-dialog stamina-intro" onClose={closeStaminaIntro}><div className="gift-body"><img className="st-intro-art" src="/assets/pro/stamina/stamina-bolt.webp" alt="" width={72} height={72}/><p>ここからは「1年進める」に行動力を使います。いまは1年 <b>{seasonCost(state)}</b>。</p><ul className="st-intro-list"><li>行動力は{regenLabel(STAMINA_REGEN_MS)}で1ずつ、待てば必ず戻ります（最大{STAMINA_MAX}）。</li><li>足りない時は「待つ」「広告を見る（＋{STAMINA_AD_POINTS}・アプリ版）」「ポイントで回復」から選べます。</li><li>回復ドリンク（1本 ＋{DRINK_RESTORE}）はログインで1日1本もらえます。ポイントでも買えます。</li></ul><button className="s-primary" onClick={closeStaminaIntro}>わかった</button></div></Dialog>}{reminderAsk&&<Dialog title="毎日のお知らせ" className="gift-dialog" onClose={()=>{markReminderAsked();setReminderAsk(false);}}><div className="gift-body"><p>ログインボーナスや今日の目標を、遊ばなかった日の夜7時にお知らせします。毎日開いている日は通知されません。</p><button className="s-primary" onClick={()=>{markReminderAsked();setReminderAsk(false);void window.diamondReminder?.ask().then(ok=>track('reminder_optin',{granted:ok?1:0}));}}>お知らせを受け取る</button><button className="s-text-link" onClick={()=>{markReminderAsked();setReminderAsk(false);track('reminder_optin',{granted:0,declined:1});}}>今はいい</button></div></Dialog>}{giftPopup>0&&!tutorialOn&&!starter&&!celebration&&<Dialog title="公開記念ボーナス" className="gift-dialog" onClose={()=>setGiftPopup(0)}><div className="gift-body"><p>DIAMOND NINE の公開を記念して、ポイントをプレゼントしました。</p><b>＋{count(giftPopup)}<small>pt</small></b><p className="gift-hint">スカウト{Math.floor(giftPopup/SIMPLE_SCOUT_COST)}回分です。打線を強くする選手を探しましょう。</p><button className="s-primary" onClick={()=>{track('launch_gift_scout',{});setGiftPopup(0);go('scout');}}><Sparkles size={18}/>スカウトで補強する</button><button className="s-text-link" onClick={()=>setGiftPopup(0)}>あとで</button></div></Dialog>}{rankOpen&&<Dialog title="オンラインランキング" className="rank-dialog" onClose={()=>setRankOpen(null)}><RankingScreen key={rankOpen} state={state} version={rankVersion} initial={rankOpen}/></Dialog>}{rankPending&&!rankOpen&&!celebration&&!seasonCard&&!settings&&!busy&&!tutorialOn&&!starter&&<Dialog title="オンラインランキング" className="rank-dialog" onClose={()=>setRankPending(null)}><RankRegisterPrompt state={state} league={rankPending} version={rankVersion} onClose={()=>setRankPending(null)} onOpenRanking={lg=>{setRankPending(null);track('ranking_open',{from:'register'});setRankOpen(lg);}}/></Dialog>}{celebration&&<TitleCelebration celebration={celebration} sound={sound} onToggleSound={toggleSound} onClose={()=>setCelebration(null)} onChoose={pawa?target=>{track('league_choice',{to:target,from:celebration.kind});setCelebration(null);change({...state,leagueChoice:target});setMessage(target==='NPB'?'国内リーグに残ります。海外リーグへの挑戦はいつでも選べます。':target==='MLB'&&circuitOf(state.season)==='NPB'?'次のシーズンは海外リーグに挑戦します。':target==='SPACE'?'次のシーズンは宇宙リーグに挑戦します。':'海外リーグに残ります。');}:undefined}/>}{dailyToast&&page!=='season'&&<div className="daily-toast" role="status">{dailyToast}</div>}<PlayerHoverPreview owned={page==='catalog'?{}:state.owned} training={page==='catalog'?{}:state.training} growth={page==='catalog'?undefined:state.careerGrowth}/></div>;
}
